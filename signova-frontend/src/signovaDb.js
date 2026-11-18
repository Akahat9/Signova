import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseReady } from './firebase';
import { readWorkspaceCache, removeWorkspaceCacheDoc, upsertWorkspaceCacheDoc, writeWorkspaceCache } from './services/userWorkspaceCache';
import { acknowledgeWorkspaceOperation, enqueueWorkspaceOperation, readWorkspaceOutbox, validateWorkspaceCollectionName, workspaceOperationKey } from './services/userWorkspaceOutbox';

let activeSession = null;
let sessionPromise = null;
let sessionGeneration = 0;
const writeChains = new Map();
const STARTUP_NETWORK_TIMEOUT_MS = 6000;
const WRITE_NETWORK_TIMEOUT_MS = 5000;
const OUTBOX_FLUSH_LIMIT = 50;
const CLOUD_RETRY_BACKOFF_MS = 10000;

function withTimeout(promise, timeoutMs, fallbackValue) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function getBrowserStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function getLocalOwnerId() {
  if (typeof window === 'undefined') return 'server';
  const key = 'signova-public-owner-id';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const nextId = `local-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
    window.localStorage.setItem(key, nextId);
    return nextId;
  } catch {
    return `local-${Date.now()}`;
  }
}

function runSerialized(ownerId, task) {
  const previous = writeChains.get(ownerId) || Promise.resolve();
  const operation = previous.catch(() => undefined).then(task);
  const tracked = operation.finally(() => {
    if (writeChains.get(ownerId) === tracked) writeChains.delete(ownerId);
  });
  writeChains.set(ownerId, tracked);
  return tracked;
}

function canSyncSession(session) {
  return Boolean(
    session
    && isFirebaseReady
    && firestoreDb
    && firebaseAuth?.currentUser?.uid === session.uid
    && session.generation === sessionGeneration,
  );
}

async function executeFirestoreOperation(session, operation) {
  if (!canSyncSession(session)) throw new Error('Database session changed');
  const documentRef = doc(firestoreDb, 'users', session.uid, operation.collection, operation.documentId);
  if (operation.kind === 'delete') {
    const completed = await withTimeout(deleteDoc(documentRef).then(() => true), WRITE_NETWORK_TIMEOUT_MS, false);
    if (!completed) throw new Error('Firestore delete timed out');
    return;
  }
  const { id, ...payload } = operation.item;
  const completed = await withTimeout(setDoc(documentRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  }, { merge: true }).then(() => true), WRITE_NETWORK_TIMEOUT_MS, false);
  if (!completed) throw new Error('Firestore write timed out');
}

async function flushOutboxForSession(session) {
  if (session.mode !== 'firestore' || !canSyncSession(session)) return { attempted: 0, completed: 0, remaining: 0 };
  return runSerialized(session.uid, async () => {
    const storage = getBrowserStorage();
    const operations = readWorkspaceOutbox(storage, session.uid).slice(0, OUTBOX_FLUSH_LIMIT);
    let completed = 0;
    for (const operation of operations) {
      try {
        await executeFirestoreOperation(session, operation);
        acknowledgeWorkspaceOperation(storage, session.uid, operation.token);
        completed += 1;
      } catch {
        break;
      }
    }
    return {
      attempted: operations.length,
      completed,
      remaining: readWorkspaceOutbox(storage, session.uid).length,
    };
  });
}

async function resolveCurrentFirebaseUser(timeoutMs = 1800) {
  if (!isFirebaseReady || !firebaseAuth) return null;
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;

  if (typeof firebaseAuth.authStateReady === 'function') {
    try {
      await withTimeout(firebaseAuth.authStateReady(), timeoutMs, null);
      if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
    } catch {
      // ignore
    }
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(firebaseAuth?.currentUser || null);
      }
    }, timeoutMs);

    let unsubscribe = () => {};
    try {
      unsubscribe = firebaseAuth.onAuthStateChanged((user) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          unsubscribe();
          resolve(user || null);
        }
      }, () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(null);
        }
      });
    } catch {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

async function createDatabaseSession(generation) {
  let currentUser = firebaseAuth?.currentUser || null;
  if (!currentUser && isFirebaseReady && firebaseAuth && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    currentUser = await resolveCurrentFirebaseUser(1800);
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const session = { mode: 'local', uid: currentUser?.uid || getLocalOwnerId(), reason: 'Device offline', authenticated: Boolean(currentUser), retryAfter: 0, generation };
    if (generation === sessionGeneration) activeSession = session;
    return session;
  }
  if (!isFirebaseReady || !firebaseAuth || !firestoreDb) {
    const session = { mode: 'local', uid: currentUser?.uid || getLocalOwnerId(), reason: 'Firebase not configured', authenticated: Boolean(currentUser), retryAfter: Number.POSITIVE_INFINITY, generation };
    if (generation === sessionGeneration) activeSession = session;
    return session;
  }

  try {
    const user = currentUser || firebaseAuth.currentUser;
    if (!user) {
      // Authentication is owned by App's verified-account flow. Starting an
      // anonymous session here races onAuthStateChanged and can replace a real
      // account with an unverified identity while the app is booting.
      const session = { mode: 'local', uid: getLocalOwnerId(), reason: 'Authenticated Firebase session unavailable', authenticated: false, retryAfter: Date.now() + CLOUD_RETRY_BACKOFF_MS, generation };
      if (generation === sessionGeneration) activeSession = session;
      return session;
    }
    const session = { mode: 'firestore', uid: user.uid, authenticated: true, generation };
    if (generation !== sessionGeneration) return session;
    activeSession = session;
    // Do not make the first paint wait for cloud retry work. A slow/offline
    // network must never leave the app behind its startup skeleton. The
    // outbox remains durable and is flushed in the background; explicit
    // callers can still await flushUserWorkspaceOutbox when they need a
    // confirmed sync result.
    void flushOutboxForSession(session).catch(() => undefined);
    return session;
  } catch (error) {
    const session = { mode: 'local', uid: firebaseAuth.currentUser?.uid || getLocalOwnerId(), reason: error.message || 'Cloud session unavailable', authenticated: Boolean(firebaseAuth.currentUser), retryAfter: Date.now() + CLOUD_RETRY_BACKOFF_MS, generation };
    if (generation === sessionGeneration) activeSession = session;
    return session;
  }
}

export async function startDatabaseSession() {
  const currentFirebaseUid = firebaseAuth?.currentUser?.uid || '';
  if (activeSession
    && (currentFirebaseUid || activeSession.authenticated)
    && activeSession.uid !== currentFirebaseUid) resetDatabaseSession();
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (activeSession?.mode === 'local'
    && online
    && isFirebaseReady
    && firebaseAuth
    && firestoreDb
    && Date.now() >= Number(activeSession.retryAfter || 0)) activeSession = null;
  if (activeSession) return activeSession;
  if (sessionPromise) return sessionPromise;
  const generation = sessionGeneration;
  const pending = createDatabaseSession(generation);
  const tracked = pending.finally(() => {
    if (sessionPromise === tracked) sessionPromise = null;
  });
  sessionPromise = tracked;
  return tracked;
}

export function resetDatabaseSession() {
  sessionGeneration += 1;
  activeSession = null;
  sessionPromise = null;
}

export async function flushUserWorkspaceOutbox() {
  const session = await startDatabaseSession();
  const result = await flushOutboxForSession(session);
  return { ...result, mode: session.mode, reason: session.reason || '' };
}

export async function loadUserCollection(collectionName) {
  validateWorkspaceCollectionName(collectionName);
  const session = await startDatabaseSession();
  if (session.generation !== sessionGeneration) return [];
  const readCache = () => readWorkspaceCache(getBrowserStorage(), session.uid, collectionName, { migrateLegacy: session.mode === 'local' && !session.authenticated });
  if (session.mode !== 'firestore') return readCache();

  try {
    const snapshot = await withTimeout(
      getDocs(collection(firestoreDb, 'users', session.uid, collectionName)),
      STARTUP_NETWORK_TIMEOUT_MS,
      null,
    );
    if (session.generation !== sessionGeneration) return [];
    if (!snapshot) return readCache();
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    if (items.length === 0) {
      const cached = readCache();
      if (cached.length > 0) return cached;
    }
    writeWorkspaceCache(getBrowserStorage(), session.uid, collectionName, items);
    return items;
  } catch {
    return readCache();
  }
}

export async function saveUserDoc(collectionName, item) {
  workspaceOperationKey(collectionName, item?.id);
  const session = await startDatabaseSession();
  const storage = getBrowserStorage();
  upsertWorkspaceCacheDoc(storage, session.uid, collectionName, item);
  return runSerialized(session.uid, async () => {
    const queuedOperation = canSyncSession(session)
      ? enqueueWorkspaceOperation(storage, session.uid, { kind: 'upsert', collection: collectionName, documentId: item.id, item })
      : null;
    if (session.mode !== 'firestore') return { mode: 'local', queued: Boolean(queuedOperation) };
    try {
      await executeFirestoreOperation(session, queuedOperation || { kind: 'upsert', collection: collectionName, documentId: item.id, item });
      if (queuedOperation) acknowledgeWorkspaceOperation(storage, session.uid, queuedOperation.token);
      return { mode: 'firestore', queued: false };
    } catch (error) {
      if (queuedOperation) return { mode: 'local', queued: true, reason: error.message };
      throw error;
    }
  });
}

export async function deleteUserDoc(collectionName, id) {
  workspaceOperationKey(collectionName, id);
  const session = await startDatabaseSession();
  const storage = getBrowserStorage();
  removeWorkspaceCacheDoc(storage, session.uid, collectionName, id);
  return runSerialized(session.uid, async () => {
    const queuedOperation = canSyncSession(session)
      ? enqueueWorkspaceOperation(storage, session.uid, { kind: 'delete', collection: collectionName, documentId: id })
      : null;
    if (session.mode !== 'firestore') return { mode: 'local', queued: Boolean(queuedOperation) };
    try {
      await executeFirestoreOperation(session, queuedOperation || { kind: 'delete', collection: collectionName, documentId: id });
      if (queuedOperation) acknowledgeWorkspaceOperation(storage, session.uid, queuedOperation.token);
      return { mode: 'firestore', queued: false };
    } catch (error) {
      if (queuedOperation) return { mode: 'local', queued: true, reason: error.message };
      throw error;
    }
  });
}
