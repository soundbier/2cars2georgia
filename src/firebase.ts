import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Zusätzliche Bremse gegen automatisiertes Durchprobieren (z.B. von
// Anmeldedaten oder Roadtrip-IDs): App Check bestätigt serverseitig, dass
// Anfragen von der echten App kommen statt von einem Skript, und blockt den
// Rest ab – sobald in der Firebase Console für Auth/Firestore aktiviert
// (siehe README). Ohne VITE_RECAPTCHA_SITE_KEY bleibt es inaktiv, App und
// Rules verhalten sich dann exakt wie zuvor.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey) {
  if (import.meta.env.DEV) {
    // Erlaubt lokale Entwicklung/Emulator trotz aktivierter Enforcement in
    // der Console – Firebase loggt beim Start einen Debug-Token, der einmalig
    // in der Console unter App Check → Apps → Debug-Tokens hinterlegt wird.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Persönliche Firebase-Auth-Konten (E-Mail/Passwort oder Google, siehe
// lib/authAccount.ts) – jede Person hat eine eigene UID, unabhängig vom
// Roadtrip. `browserLocalPersistence` hält die Anmeldung über Neustarts
// hinweg, damit nicht jedes Mal erneut angemeldet werden muss.
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.error('Auth-Persistenz konnte nicht gesetzt werden:', err)
);

/** Google-Anmeldung, siehe lib/authAccount.ts. */
export const googleProvider = new GoogleAuthProvider();
