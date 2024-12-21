import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {

  apiKey: "AIzaSyD0Z0L0R49uro84LpDAbajPx94vHW30CHc",

  authDomain: "whispr-b2116.firebaseapp.com",

  projectId: "whispr-b2116",

  storageBucket: "whispr-b2116.firebasestorage.app",

  messagingSenderId: "720617211612",

  appId: "1:720617211612:web:bfe2c8a290352e39c39619"

};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };

