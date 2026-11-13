import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBb-UaORA_qOw4OWJtSxUb1h436B0f7lAo",
  authDomain: "pkbae-97006.firebaseapp.com",
  projectId: "pkbae-97006",
  storageBucket: "pkbae-97006.firebasestorage.app",
  messagingSenderId: "433043786942",
  appId: "1:433043786942:web:348c7f96bada9cd5d9e2ef"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);