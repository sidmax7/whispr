import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/hooks/useAuth';
import { Chat } from '../types/chat';
import ChatInput from './ChatInput';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Timestamp;
  read: boolean;
  readBy: string[];  // Array of user IDs who have read the message
}

interface ChatAreaProps {
  selectedChat: Chat | null;
  onOpenChatList: () => void;
}

interface TypingState {
  text: string;
  user: string;
}

export default function ChatArea({ selectedChat, onOpenChatList }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingStates, setTypingStates] = useState<TypingState[]>([]);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedChat) {
      const q = query(collection(db, `chats/${selectedChat.id}/messages`), orderBy('timestamp'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMessages(
          snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Message, 'id'>)
          }))
        );
      });

      return () => unsubscribe();
    }
  }, [selectedChat]);

  // Listen for typing states
  useEffect(() => {
    if (selectedChat) {
      const typingRef = collection(db, `chats/${selectedChat.id}/typing`);
      const unsubscribe = onSnapshot(typingRef, (snapshot) => {
        const states = snapshot.docs.map(doc => ({
          user: doc.id,
          text: doc.data().text
        }));
        setTypingStates(states);
      });

      return () => unsubscribe();
    }
  }, [selectedChat]);

  // Mark messages as read when they're viewed
  useEffect(() => {
    if (selectedChat && user?.uid) {
      const unreadMessages = messages.filter(
        msg => msg.sender !== user.uid && !msg.readBy.includes(user.uid)
      );

      // Update read status for unread messages
      unreadMessages.forEach(async (msg) => {
        const messageRef = doc(db, `chats/${selectedChat.id}/messages/${msg.id}`);
        await updateDoc(messageRef, {
          readBy: arrayUnion(user.uid)
        });
      });
    }
  }, [messages, selectedChat, user?.uid]);

  // Add this effect to maintain focus
  useEffect(() => {
    const keepFocus = () => {
      messagesEndRef.current?.focus();
    };

    // Keep focus when component mounts
    keepFocus();

    // Add event listeners to maintain focus
    document.addEventListener('click', keepFocus);
    document.addEventListener('touchend', keepFocus);

    return () => {
      document.removeEventListener('click', keepFocus);
      document.removeEventListener('touchend', keepFocus);
    };
  }, [selectedChat]);

  const handleSendMessage = async (messageText: string) => {
    if (selectedChat && user?.uid) {
      await addDoc(collection(db, `chats/${selectedChat.id}/messages`), {
        text: messageText,
        sender: user.uid,
        timestamp: serverTimestamp(),
        read: false,
        readBy: [user.uid]
      });
    }
  };

  // Scroll to bottom when new messages arrive or when keyboard appears/disappears
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    };

    // Listen for viewport height changes (keyboard appearing/disappearing)
    const handleResize = () => {
      scrollToBottom();
    };

    // Add event listeners
    window.addEventListener('resize', handleResize);
    scrollToBottom();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [messages]);

  if (!selectedChat) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-4">
        <div className="relative w-full max-w-sm">
          <div className="absolute top-0 left-4 transform -translate-y-full">
            <svg className="w-12 h-12 text-blue-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <button
            onClick={onOpenChatList}
            className="w-full py-3 px-4 bg-blue-500 text-white rounded-lg font-medium text-lg flex items-center justify-center space-x-2 hover:bg-blue-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Start a new chat</span>
          </button>
          <p className="mt-4 text-center text-gray-400">
            Tap the button above to open the chat list and start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-full overflow-x-hidden">
      {/* Chat Header */}
      <div className="fixed top-0 left-0 right-0 z-10 flex items-center px-4 py-2 border-b border-[#1A1A1A] bg-black">
        <button
          onClick={onOpenChatList}
          className="lg:hidden mr-2 p-2 rounded-full hover:bg-[#252525] transition-colors"
          aria-label="Open chat list"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <h2 className="text-white font-medium text-lg truncate">
            {selectedChat.users.find(u => u.email !== user?.email)?.displayName || 'Chat'}
          </h2>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-16 pb-20">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === user?.uid ? 'justify-end' : 'justify-start'
            } mb-2`}
          >
            <div className="break-words max-w-[85%] md:max-w-[75%] w-fit">
              <div
                className={`px-3 py-2 whitespace-pre-wrap break-all ${
                  message.sender === user?.uid
                    ? 'bg-blue-500 text-white rounded-2xl rounded-br-none'
                    : 'bg-[#1A1A1A] text-white rounded-2xl rounded-bl-none'
                }`}
              >
                {message.text}
              </div>
              {message.sender === user?.uid && (
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-gray-500">
                    {message.readBy.length > 1 ? 'Read' : 'Delivered'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicators */}
        {typingStates
          .filter(state => state.user !== user?.uid && state.text)
          .map(state => (
            <div key={state.user} className="flex justify-start">
              <div className="break-words max-w-[85%] md:max-w-[75%]">
                <div className="px-3 py-2 bg-[#1A1A1A]/50 text-gray-400 rounded-2xl rounded-bl-none">
                  {state.text}
                </div>
              </div>
            </div>
          ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      {user && selectedChat && (
        <div className="sticky bottom-0 left-0 right-0 z-10 bg-black border-t border-[#1A1A1A] px-4 py-2">
          <ChatInput
            selectedChatId={selectedChat.id}
            userId={user.uid}
            onSendMessage={handleSendMessage}
          />
        </div>
      )}
    </div>
  );
}

