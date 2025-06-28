import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Secrets } from './secrets';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: Secrets.get('VITE_FIREBASE_API_KEY'),
  authDomain: Secrets.get('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: Secrets.get('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: Secrets.get('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: Secrets.get('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: Secrets.get('VITE_FIREBASE_APP_ID'),
  measurementId: Secrets.get('VITE_FIREBASE_MEASUREMENT_ID')
};

// Initialize Firebase (client SDK)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Firebase Admin SDK with serviceAccountKey.json
if (!admin.apps.length) {
  const serviceAccountPath = path.resolve(__dirname, Secrets.get('GOOGLE_APPLICATION_CREDENTIALS'));
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`serviceAccountKey.json not found at ${serviceAccountPath}`);
  }
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: Secrets.get('VITE_FIREBASE_PROJECT_ID'),
    // Optionally, you can specify storageBucket, databaseURL, etc.
  });
}

export { admin };

export default app;