import { signInAnonymously } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseReady } from './firebase';

const LOCAL_PREFIX = 'signova-public-db';
let activeSession = null;
const STARTUP_NETWORK_TIMEOUT_MS = 1800;

function withStartupTimeout(promise, fallbackValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(fallbackValue), STARTUP_NETWORK_TIMEOUT_MS);
    }),
  ]);
}

function localKey(collectionName) {
  return `${LOCAL_PREFIX}:${collectionName}`;
}

function readLocalCollection(collectionName) {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(localKey(collectionName)) || '[]');
  } catch {
    return [];
  }
}

function writeLocalCollection(collectionName, items) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(localKey(collectionName), JSON.stringify(items));
  } catch {
    // Local persistence is best effort only.
  }
}

function upsertLocalDoc(collectionName, item) {
  const items = readLocalCollection(collectionName);
  const nextItems = [item, ...items.filter((entry) => entry.id !== item.id)];
  writeLocalCollection(collectionName, nextItems);
}

function removeLocalDoc(collectionName, id) {
  const items = readLocalCollection(collectionName).filter((entry) => entry.id !== id);
  writeLocalCollection(collectionName, items);
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

export async function startDatabaseSession() {
  if (activeSession) return activeSession;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    activeSession = { mode: 'local', uid: getLocalOwnerId(), reason: 'Device offline' };
    return activeSession;
  }
  if (!isFirebaseReady || !firebaseAuth || !firestoreDb) {
    activeSession = { mode: 'local', uid: getLocalOwnerId(), reason: 'Firebase not configured' };
    return activeSession;
  }

  try {
    const credential = firebaseAuth.currentUser
      ? { user: firebaseAuth.currentUser }
      : await withStartupTimeout(signInAnonymously(firebaseAuth), null);
    if (!credential?.user) {
      activeSession = { mode: 'local', uid: getLocalOwnerId(), reason: 'Cloud startup timed out' };
      return activeSession;
    }
    activeSession = { mode: 'firestore', uid: credential.user.uid };
    return activeSession;
  } catch (error) {
    activeSession = { mode: 'local', uid: getLocalOwnerId(), reason: error.message || 'Anonymous auth unavailable' };
    return activeSession;
  }
}

export function resetDatabaseSession() {
  activeSession = null;
}

export async function loadUserCollection(collectionName) {
  const session = await startDatabaseSession();
  if (session.mode !== 'firestore') return readLocalCollection(collectionName);

  try {
    const snapshot = await withStartupTimeout(
      getDocs(collection(firestoreDb, 'users', session.uid, collectionName)),
      null,
    );
    if (!snapshot) return readLocalCollection(collectionName);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch {
    return readLocalCollection(collectionName);
  }
}

export async function saveUserDoc(collectionName, item) {
  upsertLocalDoc(collectionName, item);
  const session = await startDatabaseSession();
  if (session.mode !== 'firestore') return { mode: 'local' };

  const { id, ...payload } = item;
  await setDoc(doc(firestoreDb, 'users', session.uid, collectionName, id), {
    ...payload,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { mode: 'firestore' };
}

export async function deleteUserDoc(collectionName, id) {
  removeLocalDoc(collectionName, id);
  const session = await startDatabaseSession();
  if (session.mode !== 'firestore') return { mode: 'local' };

  await deleteDoc(doc(firestoreDb, 'users', session.uid, collectionName, id));
  return { mode: 'firestore' };
}
