import { Secrets } from './secrets';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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

// Export Firestore and Auth from Admin SDK
export const db = admin.firestore();
export const auth = admin.auth();
export { admin };