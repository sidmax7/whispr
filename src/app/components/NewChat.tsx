import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/hooks/useAuth';

export default function NewChat() {
  const [recipientEmail, setRecipientEmail] = useState('');
  const { user } = useAuth();

  const createNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipientEmail.trim() && user?.email && user?.uid) {
      const chatRef = await addDoc(collection(db, 'chats'), {
        users: [user.email, recipientEmail],
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, `users/${user.uid}/chats`), {
        chatId: chatRef.id,
        recipientEmail,
        lastMessageTime: serverTimestamp(),
      });

      setRecipientEmail('');
    }
  };

  return (
    <form onSubmit={createNewChat} className="p-4 bg-[#111111]">
      <div className="flex">
        <input
          type="email"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="Enter recipient's email"
          className="flex-1 px-4 py-2 bg-black text-white rounded-l-full focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-r-full hover:bg-blue-700 transition-colors duration-200"
        >
          New Chat
        </button>
      </div>
    </form>
  );
}

