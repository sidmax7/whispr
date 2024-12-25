import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/hooks/useAuth';
import { Chat } from '../types/chat';
import ChatInput from './ChatInput';
import { Check } from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center h-screen bg-[#2C2A42] text-white p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 flex items-center justify-center">
            <img 
              src="/assets/pirate.svg" 
              alt="Ghost Logo" 
              width={96} 
              height={96}
              className="w-full h-full"
            />
          </div>
          <h1 className="text-3xl font-bold">Say hi</h1>
          <p className="text-gray-400">small talk, big connections</p>
          <div className="mt-auto pt-8">
            <div className="flex items-center gap-2 text-gray-400">
              <img src="/assets/secure.svg" alt="Secure" className="w-6 h-6" />
              <span>End - to - end encrypted</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full max-w-full overflow-x-hidden bg-[#2C2A42]">
      {/* Chat Header - Updated z-index and adjusted positioning */}
      <div className="sticky top-0 left-0 right-0 z-50 flex items-center px-4 py-3 border-b border-[#2A2640] bg-[#252436]">
        <button
          onClick={onOpenChatList}
          className="lg:hidden mr-2 p-2 rounded-full hover:bg-[#2A2640] transition-colors"
          aria-label="Open chat list"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-white font-medium text-lg">
            {selectedChat.users.find(u => u.email !== user?.email)?.displayName || 'Chat'}
          </h2>
        </div>
      </div>

      {/* Messages - Updated padding to account for header */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-20">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === user?.uid ? 'justify-end' : 'justify-start'
            } mb-4`}
          >
            <div className="break-words max-w-[85%] md:max-w-[75%] w-fit">
              <div
                className={`px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-all ${
                  message.sender === user?.uid
                    ? 'bg-[#584ACB] text-white rounded-[20px] rounded-br-[5px]'
                    : 'bg-[#413F51] text-white rounded-[20px] rounded-bl-[5px]'
                }`}
              >
                {message.text}
              </div>
              {message.sender === user?.uid && (
                <div className="flex justify-end mt-1">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    {message.readBy.length > 1 ? (
                      <>
                        Read
                        <Check className="w-3 h-3 text-violet-500" />
                        <Check className="w-3 h-3 text-violet-500 -ml-2" />
                      </>
                    ) : (
                      <>
                        Sent
                        <Check className="w-3 h-3 text-gray-500" />
                      </>
                    )}
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
            <div key={state.user} className="flex justify-start mb-4">
              <div className="break-words max-w-[85%] md:max-w-[75%]">
                <div className="px-4 py-3 bg-[#2A2640]/50 text-gray-400 rounded-[20px] rounded-bl-[5px]">
                  {state.text}
                </div>
              </div>
            </div>
          ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      {user && selectedChat && (
        <div className="sticky bottom-0 left-0 right-0 z-10 bg-[#2C2A42] border-t border-[#2A2640] px-4 py-3">
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
