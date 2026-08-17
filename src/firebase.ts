import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "MUSTERMUSTERMUSTERMUSTER",
  authDomain: "cars2georgia.firebaseapp.com",
  databaseURL: "https://cars2georgia-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "cars2georgia",
  storageBucket: "cars2georgia.firebasestorage.app",
  messagingSenderId: "948906992041",
  appId: "1:948906992041:web:2905a3540f60f442f6a4b8"
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
