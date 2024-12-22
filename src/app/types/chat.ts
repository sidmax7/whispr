import { Timestamp } from 'firebase/firestore';

export interface ChatUser {
  email: string;
  displayName: string;
}

export interface UserProfile {
  email: string;
  displayName: string | null;
  photoURL: string | null;
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