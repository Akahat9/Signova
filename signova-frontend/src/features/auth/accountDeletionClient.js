import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { requestJson } from '../../services/apiClient';

export function validateAccountDeletionPassword(password) {
  const value = String(password || '');
  if (value.length < 6) throw new Error('Enter your current password before deleting the account.');
  return value;
}

export async function deleteCurrentAccountWithPassword({
  firebaseAuth,
  password,
  apiBaseUrl,
  requestJsonImpl = requestJson,
  credentialFactory = EmailAuthProvider.credential,
  reauthenticate = reauthenticateWithCredential,
} = {}) {
  const user = firebaseAuth?.currentUser || null;
  if (!user?.email || !user?.getIdToken) throw new Error('Login again before deleting this account.');
  if (!user.emailVerified) throw new Error('Verify your email before deleting this account.');
  const currentPassword = validateAccountDeletionPassword(password);
  await reauthenticate(user, credentialFactory(user.email, currentPassword));
  const freshToken = await user.getIdToken(true);
  return requestJsonImpl({
    baseUrl: apiBaseUrl,
    path: '/api/account/delete',
    options: {
      method: 'POST',
      body: JSON.stringify({ confirm: 'DELETE' }),
    },
    getToken: async () => freshToken,
  });
}
