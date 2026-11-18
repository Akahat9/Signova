import { acknowledgeWorkspaceOperation, enqueueWorkspaceOperation, readWorkspaceOutbox, USER_WORKSPACE_OUTBOX_LIMIT, workspaceOperationKey, workspaceOutboxKey } from './userWorkspaceOutbox';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: jest.fn((key) => values.get(key) ?? null),
    setItem: jest.fn((key, value) => values.set(key, value)),
    values,
  };
}

function enqueue(storage, ownerId, input, token, queuedAt = 1) {
  return enqueueWorkspaceOperation(storage, ownerId, input, { tokenFactory: () => token, now: () => queuedAt });
}

test('isolates operations by owner and compacts repeated writes to the same document', () => {
  const storage = createStorage();
  enqueue(storage, 'uid-a', { kind: 'upsert', collection: 'chatState', documentId: 'messages', item: { id: 'messages', value: 1 } }, 'token-a1', 1);
  enqueue(storage, 'uid-a', { kind: 'upsert', collection: 'chatState', documentId: 'messages', item: { id: 'messages', value: 2 } }, 'token-a2', 2);
  enqueue(storage, 'uid-b', { kind: 'delete', collection: 'chatState', documentId: 'messages' }, 'token-b1', 3);
  expect(readWorkspaceOutbox(storage, 'uid-a')).toEqual([expect.objectContaining({ token: 'token-a2', item: { id: 'messages', value: 2 } })]);
  expect(readWorkspaceOutbox(storage, 'uid-b')).toEqual([expect.objectContaining({ token: 'token-b1', kind: 'delete' })]);
  expect(workspaceOutboxKey('uid-a')).not.toBe(workspaceOutboxKey('uid-b'));
});

test('latest delete supersedes an unsent upsert and a later upsert supersedes delete', () => {
  const storage = createStorage();
  enqueue(storage, 'uid-a', { kind: 'upsert', collection: 'contacts', documentId: 'contact-1', item: { id: 'contact-1' } }, 'save-1');
  enqueue(storage, 'uid-a', { kind: 'delete', collection: 'contacts', documentId: 'contact-1' }, 'delete-1');
  expect(readWorkspaceOutbox(storage, 'uid-a')[0]).toMatchObject({ kind: 'delete', token: 'delete-1' });
  enqueue(storage, 'uid-a', { kind: 'upsert', collection: 'contacts', documentId: 'contact-1', item: { id: 'contact-1', restored: true } }, 'save-2');
  expect(readWorkspaceOutbox(storage, 'uid-a')[0]).toMatchObject({ kind: 'upsert', token: 'save-2' });
});

test('acknowledges by immutable token without deleting a newer replacement', () => {
  const storage = createStorage();
  enqueue(storage, 'uid-a', { kind: 'delete', collection: 'calls', documentId: 'call-1' }, 'old-token');
  enqueue(storage, 'uid-a', { kind: 'delete', collection: 'calls', documentId: 'call-1' }, 'new-token');
  expect(acknowledgeWorkspaceOperation(storage, 'uid-a', 'old-token')).toBe(false);
  expect(readWorkspaceOutbox(storage, 'uid-a')).toHaveLength(1);
  expect(acknowledgeWorkspaceOperation(storage, 'uid-a', 'new-token')).toBe(true);
  expect(readWorkspaceOutbox(storage, 'uid-a')).toEqual([]);
});

test('rejects unsafe paths and malformed payloads and ignores corrupt stored envelopes', () => {
  expect(() => workspaceOperationKey('../users', 'id')).toThrow('Invalid workspace');
  const storage = createStorage({ [workspaceOutboxKey('uid-a')]: '{bad-json' });
  expect(readWorkspaceOutbox(storage, 'uid-a')).toEqual([]);
  expect(() => enqueue(storage, 'uid-a', { kind: 'upsert', collection: 'contacts', documentId: 'contact-1', item: { id: 'wrong' } }, 'token')).toThrow('Invalid workspace operation payload');
});

test('bounds the retained queue and fails closed when storage cannot persist it', () => {
  const storage = createStorage();
  for (let index = 0; index < USER_WORKSPACE_OUTBOX_LIMIT + 3; index += 1) {
    enqueue(storage, 'uid-a', { kind: 'delete', collection: 'calls', documentId: `call-${index}` }, `token-${index}`, index);
  }
  expect(readWorkspaceOutbox(storage, 'uid-a')).toHaveLength(USER_WORKSPACE_OUTBOX_LIMIT);
  storage.setItem.mockImplementation(() => { throw new Error('quota'); });
  expect(enqueueWorkspaceOperation(storage, 'uid-a', { kind: 'delete', collection: 'calls', documentId: 'call-new' }, { tokenFactory: () => 'new-token' })).toBeNull();
});
