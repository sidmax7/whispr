import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {

    apiKey: "AIzaSyDJynbUShESW4szT7uGOdXSvCXCZ5usNGU",
  
    authDomain: "realtime-chat-12b2d.firebaseapp.com",
  
    projectId: "realtime-chat-12b2d",
  
    storageBucket: "realtime-chat-12b2d.firebasestorage.app",
  
    messagingSenderId: "977244332241",
  
    appId: "1:977244332241:web:cd1e53676358197a4a25f0"
  
  };
  

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };

