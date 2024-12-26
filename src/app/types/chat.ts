import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  online?: boolean;
  lastSeen?: Timestamp;
}

export interface Participant {
  uid: string;
  email: string;
}

export interface Chat {
  id: string;
  participants: Participant[];
  lastMessage: string;
  lastMessageTime: Timestamp;
  createdAt: Timestamp;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  timestamp: Timestamp;
  read: boolean;
} 