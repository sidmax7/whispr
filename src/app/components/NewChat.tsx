import { useState } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/hooks/useAuth';
import { Chat, UserProfile } from '../types/chat';

export default function NewChat() {
  const [recipientEmail, setRecipientEmail] = useState('');
  const { user } = useAuth();

  const createNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim() || !user?.email || !user?.uid) return;

    try {
      // First fetch the recipient's profile
      const recipientQuery = await getDocs(query(
        collection(db, 'users'), 
        where('email', '==', recipientEmail)
      ));
      
      const recipientData = recipientQuery.docs[0]?.data() || {
        displayName: recipientEmail.split('@')[0],
        photoURL: null,
        uid: recipientEmail,
        email: recipientEmail
      };

      // Get current user's profile
      const currentUserQuery = await getDocs(query(
        collection(db, 'users'),
        where('email', '==', user.email)
      ));

      const currentUserData = currentUserQuery.docs[0]?.data() || {
        displayName: user.displayName || user.email?.split('@')[0],
        photoURL: user.photoURL,
        uid: user.uid
      };

      const chatData = {
        users: [
          { email: user.email },
          { email: recipientEmail }
        ],
        createdAt: serverTimestamp(),
        messages: [],
        lastMessage: '',
        timestamp: serverTimestamp(),
        userProfiles: {
          [user.email]: {
            email: user.email,
            displayName: currentUserData.displayName || user.email.split('@')[0],
            photoURL: currentUserData.photoURL || null,
            uid: user.uid,
            online: true,
            lastSeen: serverTimestamp()
          } as UserProfile,
          [recipientEmail]: {
            email: recipientEmail,
            displayName: recipientData.displayName || recipientEmail.split('@')[0],
            photoURL: recipientData.photoURL || null,
            uid: recipientData.uid || recipientEmail,
            online: false,
            lastSeen: serverTimestamp()
          } as UserProfile
        }
      };

      await addDoc(collection(db, 'chats'), chatData);
      setRecipientEmail('');
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  return (
    <form onSubmit={createNewChat} className="p-4 bg-[#252436] border-b border-[#2A2640]">
      <div className="flex">
        <input
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="Enter recipient's email"
          className="flex-1 px-4 py-2 bg-[#2C2A42] text-white rounded-l-full focus:outline-none focus:ring-1 focus:ring-violet-600 border-0"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-violet-600 text-white rounded-r-full hover:bg-violet-700 transition-colors duration-200"
        >
          New Chat
        </button>
      </div>
    </form>
  );
}

