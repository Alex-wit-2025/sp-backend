import { firestore } from 'firebase-admin';
import { User } from 'firebase/auth';

export interface DocumentData {
  id: string;
  title: string;
  content: string;
  createdAt: firestore.Timestamp;
  updatedAt: firestore.Timestamp;
  createdBy: string;
  collaborators: string[];
}
