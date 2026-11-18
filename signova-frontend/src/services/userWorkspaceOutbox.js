export const USER_WORKSPACE_OUTBOX_SCHEMA_VERSION = 1;
export const USER_WORKSPACE_OUTBOX_LIMIT = 500;
const MAX_OUTBOX_BYTES = 5 * 1024 * 1024;
const SAFE_SEGMENT = /^[A-Za-z0-9._-]{1,128}$/;

function safeOwnerSegment(ownerId) {
  return encodeURIComponent(String(ownerId || '').trim() || 'unknown');
}

export function workspaceOutboxKey(ownerId) {
  return `signova-user-outbox:${safeOwnerSegment(ownerId)}`;
}

export function validateWorkspaceCollectionName(collectionName) {
  const collection = String(collectionName || '').trim();
  if (!SAFE_SEGMENT.test(collection)) throw new Error('Invalid workspace collection');
  return collection;
}

export function workspaceOperationKey(collectionName, documentId) {
  const collection = validateWorkspaceCollectionName(collectionName);
  const id = String(documentId || '').trim();
  if (!SAFE_SEGMENT.test(id)) throw new Error('Invalid workspace document path');
  return `${collection}/${id}`;
}

function isValidOperation(operation) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) return false;
  if (!['upsert', 'delete'].includes(operation.kind)) return false;
  if (!SAFE_SEGMENT.test(operation.collection) || !SAFE_SEGMENT.test(operation.documentId)) return false;
  if (operation.key !== `${operation.collection}/${operation.documentId}`) return false;
  if (!SAFE_SEGMENT.test(operation.token)) return false;
  if (!Number.isFinite(operation.queuedAt) || operation.queuedAt < 0) return false;
  if (operation.kind === 'upsert' && (!operation.item || typeof operation.item !== 'object' || Array.isArray(operation.item) || operation.item.id !== operation.documentId)) return false;
  return operation.kind !== 'delete' || operation.item === undefined;
}

function serializeOperations(operations) {
  return JSON.stringify({ version: USER_WORKSPACE_OUTBOX_SCHEMA_VERSION, operations });
}

export function readWorkspaceOutbox(storage, ownerId) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(workspaceOutboxKey(ownerId)) || 'null');
    if (!parsed || parsed.version !== USER_WORKSPACE_OUTBOX_SCHEMA_VERSION || !Array.isArray(parsed.operations)) return [];
    return parsed.operations.filter(isValidOperation).slice(-USER_WORKSPACE_OUTBOX_LIMIT);
  } catch {
    return [];
  }
}

function writeWorkspaceOutbox(storage, ownerId, operations) {
  if (!storage) return false;
  try {
    const serialized = serializeOperations(operations.slice(-USER_WORKSPACE_OUTBOX_LIMIT));
    if (serialized.length * 2 > MAX_OUTBOX_BYTES) return false;
    storage.setItem(workspaceOutboxKey(ownerId), serialized);
    return true;
  } catch {
    return false;
  }
}

export function enqueueWorkspaceOperation(storage, ownerId, {
  kind,
  collection,
  documentId,
  item,
}, {
  now = () => Date.now(),
  tokenFactory = () => (typeof window !== 'undefined' && window.crypto?.randomUUID?.()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
} = {}) {
  const key = workspaceOperationKey(collection, documentId);
  if (!['upsert', 'delete'].includes(kind)) throw new Error('Invalid workspace operation');
  const token = String(tokenFactory()).replace(/[^A-Za-z0-9._-]/g, '').slice(0, 128);
  if (!SAFE_SEGMENT.test(token)) throw new Error('Invalid workspace operation token');
  const operation = {
    kind,
    collection,
    documentId,
    key,
    token,
    queuedAt: Number(now()),
    ...(kind === 'upsert' ? { item } : {}),
  };
  if (!isValidOperation(operation)) throw new Error('Invalid workspace operation payload');
  const current = readWorkspaceOutbox(storage, ownerId);
  const next = [...current.filter((entry) => entry.key !== key), operation];
  return writeWorkspaceOutbox(storage, ownerId, next) ? operation : null;
}

export function acknowledgeWorkspaceOperation(storage, ownerId, token) {
  const current = readWorkspaceOutbox(storage, ownerId);
  const next = current.filter((operation) => operation.token !== token);
  if (next.length === current.length) return false;
  return writeWorkspaceOutbox(storage, ownerId, next);
}
