
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  projectId: "studio-7831135066-b7ebf",
  appId: "1:427859065555:web:3d0519e8804380fa4e3226",
  apiKey: "AIzaSyAzmZ4p8Rpx8kusWuP3v8PnQyc0Ao_cU7Q",
  authDomain: "studio-7831135066-b7ebf.firebaseapp.com",
  messagingSenderId: "427859065555",
  storageBucket: "studio-7831135066-b7ebf.appspot.com",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app, "gs://studio-7831135066-b7ebf.appspot.com");


export { app, db, rtdb, auth, storage };
