// Dashboard-Logicbot/src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDZpi84dvBn5ODvaLi6f9TnvKUqF6I8WFA",
  authDomain: "logicbot-db.firebaseapp.com",
  projectId: "logicbot-db",
  storageBucket: "logicbot-db.firebasestorage.app",
  messagingSenderId: "901583573080",
  appId: "1:901583573080:web:3890ee43d43d508746fa2d",
  measurementId: "G-Z6GVEBKCDH"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
