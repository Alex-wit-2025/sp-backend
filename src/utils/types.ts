import { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

export interface DocumentData {
  id: string;
  title: string;
  content: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  collaborators: string[];
}
