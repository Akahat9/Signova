import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const requiredFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
];
const hasFirebaseConfig = requiredFirebaseConfig.every(Boolean);
const useLocalEmulators = process.env.REACT_APP_SIGNOVA_FIREBASE_EMULATORS === 'true'
  && typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname);

export const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;
export const isFirebaseReady = Boolean(firebaseApp);
if (useLocalEmulators && firebaseAuth && firestoreDb && firebaseStorage) {
  connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestoreDb, '127.0.0.1', 8080);
  connectStorageEmulator(firebaseStorage, '127.0.0.1', 9199);
}
export const firebaseAnalyticsPromise = firebaseApp && firebaseConfig.measurementId && !useLocalEmulators
  ? isAnalyticsSupported().then((supported) => (supported ? getAnalytics(firebaseApp) : null)).catch(() => null)
  : Promise.resolve(null);

export default firebaseApp;
