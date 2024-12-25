import { useRef, useEffect, useState } from 'react';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import Image from 'next/image';

interface ChatInputProps {
  selectedChatId: string;
  userId: string;
  onSendMessage: (message: string) => Promise<void>;
}

export default function ChatInput({ selectedChatId, userId, onSendMessage }: ChatInputProps) {
  const [newMessage, setNewMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const handleMessageChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewMessage(text);

    // Adjust textarea height only when there's content
    if (inputRef.current) {
      if (text) {
        inputRef.current.style.height = '36px';
        inputRef.current.style.height = `${Math.min(Math.max(inputRef.current.scrollHeight, 36), 120)}px`;
      } else {
        inputRef.current.style.height = '36px';
      }
    }

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
      
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (inputRef.current && !newMessage) {
      inputRef.current.style.height = '36px';
    }
  }, [newMessage]);

  return (
    <div className="w-full bg-[#1E1B2E]">
      <form onSubmit={handleSubmit} className="flex items-center gap-3 px-2 py-2">
        <button 
          type="button" 
          className="p-1.5 rounded-full bg-[#2A2640] hover:bg-[#363150] transition-colors"
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            className="text-gray-400"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 5v14m-7-7h14"
            />
          </svg>
        </button>
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message"
            className="w-full bg-[#2A2640] text-white rounded-full px-4 py-[6px] focus:outline-none resize-none h-[36px] max-h-[120px] border-none placeholder-gray-400 text-[15px] leading-[24px] overflow-hidden"
            style={{ height: 'auto' }}
          />
        </div>
        <button 
          type="submit"
          disabled={!newMessage.trim()}
          className="p-1.5 rounded-full bg-[#2A2640] hover:bg-[#363150] transition-colors disabled:opacity-50"
        >
          <img
            src="/assets/send.svg"
            alt="Send"
            width={20}
            height={20}
            className="opacity-80"
          />
        </button>
        <button 
          type="button"
          className="p-1.5 rounded-full bg-[#2A2640] hover:bg-[#363150] transition-colors"
        >
          <svg 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            className="text-gray-400"
          >
            <path 
              d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" 
              fill="currentColor"
            />
            <path 
              d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" 
              fill="currentColor"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}

