import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Meldet die Crew am Roadtrip an (siehe lib/roadtrip.ts) – pro Roadtrip gibt
// es einen technischen Auth-User, dessen Passwort das gemeinsame
// Roadtrip-Passwort ist. `browserLocalPersistence` hält die Anmeldung über
// Neustarts hinweg, damit nicht jedes Mal erneut das Passwort nötig ist.
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.error('Auth-Persistenz konnte nicht gesetzt werden:', err)
);
