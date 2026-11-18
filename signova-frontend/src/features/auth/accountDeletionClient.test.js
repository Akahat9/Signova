import { deleteCurrentAccountWithPassword, validateAccountDeletionPassword } from './accountDeletionClient';

test('validates the current password before a destructive delete', () => {
  expect(validateAccountDeletionPassword('secret1')).toBe('secret1');
  expect(() => validateAccountDeletionPassword('123')).toThrow(/current password/);
});

test('reauthenticates and calls the backend account deletion route with a fresh token', async () => {
  const user = {
    email: 'user@example.com',
    emailVerified: true,
    getIdToken: jest.fn(async (forceRefresh) => {
      expect(forceRefresh).toBe(true);
      return 'fresh-token';
    }),
  };
  const reauthenticate = jest.fn(async () => undefined);
  const credentialFactory = jest.fn(() => 'credential');
  const requestJsonImpl = jest.fn(async () => ({ deleted: true }));

  await expect(deleteCurrentAccountWithPassword({
    firebaseAuth: { currentUser: user },
    password: 'secret1',
    apiBaseUrl: 'https://api.example.test',
    requestJsonImpl,
    credentialFactory,
    reauthenticate,
  })).resolves.toMatchObject({ deleted: true });

  expect(credentialFactory).toHaveBeenCalledWith('user@example.com', 'secret1');
  expect(reauthenticate).toHaveBeenCalledWith(user, 'credential');
  expect(requestJsonImpl).toHaveBeenCalledWith(expect.objectContaining({
    baseUrl: 'https://api.example.test',
    path: '/api/account/delete',
    options: expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ confirm: 'DELETE' }),
    }),
  }));
  await expect(requestJsonImpl.mock.calls[0][0].getToken()).resolves.toBe('fresh-token');
});

test('fails closed without a verified Firebase email session', async () => {
  await expect(deleteCurrentAccountWithPassword({
    firebaseAuth: { currentUser: null },
    password: 'secret1',
  })).rejects.toThrow(/Login again/);

  await expect(deleteCurrentAccountWithPassword({
    firebaseAuth: { currentUser: { email: 'user@example.com', emailVerified: false, getIdToken: jest.fn() } },
    password: 'secret1',
  })).rejects.toThrow(/Verify your email/);
});
