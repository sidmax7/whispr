import { Timestamp } from 'firebase/firestore';

export interface ChatUser {
  uid?: string;
  email: string;
  displayName: string;
  photoURL?: string;
  lastSeen?: Timestamp;
}

export interface UserProfile {
  email: string;
  displayName: string | null;
  photoURL: string | null;
  online?: boolean;
  lastSeen?: Timestamp;
}

export interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Timestamp;
  read: boolean;
  readBy: string[];
}

export interface Chat {
  id: string;
  users: ChatUser[];
  lastMessage?: string;
  timestamp?: Timestamp;
  messages?: Message[];
  userProfiles?: { [key: string]: UserProfile };
} 