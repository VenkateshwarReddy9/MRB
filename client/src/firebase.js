// client/src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtqpNj3x8Fw4ndhjgSKhcSSe0ihL7fyR0",
  authDomain: "mr-burger-ledger.firebaseapp.com",
  projectId: "mr-burger-ledger",
  storageBucket: "mr-burger-ledger.firebasestorage.app",
  messagingSenderId: "479072466064",
  appId: "1:479072466064:web:a6b4e9c96a260c8c2b5415"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);