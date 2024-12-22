import { useRef, useEffect, useState } from 'react';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

interface ChatInputProps {
  selectedChatId: string;
  userId: string;
  onSendMessage: (message: string) => Promise<void>;
}

export default function ChatInput({ selectedChatId, userId, onSendMessage }: ChatInputProps) {
  const [newMessage, setNewMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep focus on input
  useEffect(() => {
    const keepFocus = (e: MouseEvent | TouchEvent) => {
      // Check if the click is on the hamburger button
      const target = e.target as HTMLElement;
      if (target.closest('[aria-label="Open chat list"]')) {
        return;
      }
      inputRef.current?.focus();
    };

    document.addEventListener('click', keepFocus);
    document.addEventListener('touchend', keepFocus);

    return () => {
      document.removeEventListener('click', keepFocus);
      document.removeEventListener('touchend', keepFocus);
    };
  }, []);

  const handleMessageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setNewMessage(text);

    const typingRef = doc(db, `chats/${selectedChatId}/typing`, userId);
    if (text) {
      await setDoc(typingRef, { text }, { merge: true });
    } else {
      await deleteDoc(typingRef);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      await onSendMessage(newMessage);
      const typingRef = doc(db, `chats/${selectedChatId}/typing`, userId);
      await deleteDoc(typingRef);
      setNewMessage('');
    }
  };

  return (
    <div className="w-full bg-black">
      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        <button type="button" className="text-gray-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        <input
          type="text"
          ref={inputRef}
          value={newMessage}
          onChange={handleMessageChange}
          placeholder="Type a message..."
          className="flex-1 bg-[#1A1A1A] text-white rounded-full px-3 py-2 focus:outline-none"
          enterKeyHint="send"
        />
        <button type="submit" className="text-blue-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>
    </div>
  );
} 