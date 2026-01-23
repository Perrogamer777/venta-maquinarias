import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDTJS6YiJUAhDMXwcfU3zPvaW7lXHdtWrQ',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'venta-maquinarias-2627e.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'venta-maquinarias-2627e',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'venta-maquinarias-2627e.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '200861292545',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:200861292545:web:cac05f4d2bcf5187d68800',
};

// DEBUG: Log config to verify env vars
console.log('[Firebase] Config:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasProjectId: !!firebaseConfig.projectId,
  projectId: firebaseConfig.projectId,
  isInBrowser: typeof window !== 'undefined'
});

// Validate required config
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('[Firebase] Missing required configuration. Check environment variables.');
}

// Initialize Firebase
let app;
if (!getApps().length && firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
} else if (getApps().length) {
  app = getApp();
}

// Export Firebase services
export const db = app ? getFirestore(app) : (null as any);
export const auth = app ? getAuth(app) : (null as any);
export const storage = app ? getStorage(app) : (null as any);
