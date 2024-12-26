import { useRef, useEffect, useState } from 'react';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { Plus, Mic } from 'lucide-react';
import { IoIosSend } from 'react-icons/io';

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
        inputRef.current.style.height = '44px';
        inputRef.current.style.height = `${Math.min(Math.max(inputRef.current.scrollHeight, 44), 120)}px`;
      } else {
        inputRef.current.style.height = '44px';
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
      inputRef.current.style.height = '44px';
    }
  }, [newMessage]);

  return (
    <div className="w-full bg-[#2C2A42]">
      <form onSubmit={handleSubmit} className="px-2 py-2 flex items-center gap-2">
        <div className="relative flex items-center flex-1 bg-[#413F51] rounded-full">
          <button 
            type="button" 
            className="p-1.5 ml-2 rounded-full transition-colors bg-white hover:bg-[#363150] group"
          >
            <Plus className="w-5 h-5 text-[#2C2A42] group-hover:text-white" />
          </button>
          
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message"
            className="flex-1 bg-transparent text-white px-4 py-[8px] focus:outline-none resize-none h-[44px] max-h-[120px] border-none placeholder-gray-400 text-[15px] leading-[24px] overflow-hidden"
            style={{ height: 'auto' }}
          />

          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="p-1.5 mr-2 rounded-full transition-colors bg-white hover:bg-[#363150] group"
          >
            <IoIosSend className="w-5 h-5 text-[#2C2A42] group-hover:text-white" />
          </button>
        </div>

        <button 
          type="button"
          className="p-2.5 bg-[#413F51] hover:bg-white rounded-full transition-colors group"
        >
          <Mic className="w-5 h-5 text-white group-hover:text-[#2C2A42]" />
        </button>
      </form>
    </div>
  );
}

