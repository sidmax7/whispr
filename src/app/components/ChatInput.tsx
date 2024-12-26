import { useRef, useEffect, useState } from 'react';
import { Plus, Mic } from 'lucide-react';
import { IoIosSend } from 'react-icons/io';

interface ChatInputProps {
  selectedChatId: string;
  userId: string;
  onSendMessage: (message: string) => Promise<void>;
  onTyping?: (text: string) => void;
}

let typingTimeout: NodeJS.Timeout;

export default function ChatInput({ selectedChatId, userId, onSendMessage, onTyping }: ChatInputProps) {
  const [newMessage, setNewMessage] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep focus on input
  useEffect(() => {
    const keepFocus = (e: MouseEvent | TouchEvent) => {
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

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setNewMessage(text);

    // Adjust textarea height
    if (inputRef.current) {
      if (text) {
        inputRef.current.style.height = '44px';
        inputRef.current.style.height = `${Math.min(Math.max(inputRef.current.scrollHeight, 44), 120)}px`;
      } else {
        inputRef.current.style.height = '44px';
      }
    }

    // Handle typing state
    if (onTyping) {
      console.log('Handling typing state change:', text);
      onTyping(text);
      
      // Clear previous timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      // Set new timeout to clear typing state
      typingTimeout = setTimeout(() => {
        console.log('Clearing typing state after timeout');
        onTyping('');
      }, 2000);
    } else {
      console.warn('onTyping callback not provided');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      console.log('Submitting message:', newMessage);
      await onSendMessage(newMessage);
      if (onTyping) {
        console.log('Clearing typing state after submit');
        onTyping('');
        if (typingTimeout) {
          clearTimeout(typingTimeout);
        }
      }
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

