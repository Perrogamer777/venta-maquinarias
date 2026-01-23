import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// DEBUG: Log config to verify env vars
console.log('🔥 Firebase Config:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasProjectId: !!firebaseConfig.projectId,
  projectId: firebaseConfig.projectId,
  isInBrowser: typeof window !== 'undefined'
});

// Initialize Firebase only if in browser with valid config
let app;
if (typeof window !== 'undefined') {
  if (!getApps().length && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
  } else if (getApps().length) {
    app = getApp();
  }
}

// Export with fallback to avoid build errors
export const db = app ? getFirestore(app) : null as any;
export const auth = app ? getAuth(app) : null as any;
export const storage = app ? getStorage(app) : null as any;
