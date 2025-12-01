// SECURE FIREBASE CONFIGURATION
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableNetwork, disableNetwork } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Environment variable validation
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

// Check for missing variables only on the client-side for NEXT_PUBLIC_ variables
if (typeof window !== 'undefined') {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    // We log a warning instead of throwing an error to avoid crashing the app
    // The firebaseConfig object below has fallbacks.
    console.warn(`Missing optional environment variables: ${missingVars.join(', ')}. Using fallback values.`);
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAzmZ4p8Rpx8kusWuP3v8PnQyc0Ao_cU7Q",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-7831135066-b7ebf.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-7831135066-b7ebf",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-7831135066-b7ebf.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "427859065555",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:427859065555:web:3d0519e8804380fa4e3226",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Use emulators if running in development mode
if (process.env.NODE_ENV === 'development' && process.env.USE_FIREBASE_EMULATOR === 'true') {
    try {
        connectAuthEmulator(auth, "http://localhost:9099");
        // connectFirestoreEmulator(db, 'localhost', 8080);
        // connectStorageEmulator(storage, 'localhost', 9199);
    } catch (error) {
        console.warn("Firebase emulators might not be running. Skipping connection.", error);
    }
}

export { app, db, rtdb, auth, storage };

// Utility functions
export const FirebaseUtils = {
  enableNetwork: async () => {
    try {
      await enableNetwork(db);
    } catch (error) {
      console.warn('Failed to enable network:', error);
    }
  },
  
  disableNetwork: async () => {
    try {
      await disableNetwork(db);
    } catch (error) {
      console.warn('Failed to disable network:', error);
    }
  },
  
  isInitialized: () => {
    return !!getApp() && !!db && !!auth;
  },
};
