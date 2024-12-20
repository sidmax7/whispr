import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/hooks/useAuth';

// Define interfaces for our types
interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Timestamp;
  read: boolean;
  readBy: string[];  // Array of user IDs who have read the message
}

interface Chat {
  id: string;
  users: string[];
  lastMessage?: string;
  timestamp?: string;
}

interface ChatAreaProps {
  selectedChat: Chat | null;
}

interface TypingState {
  text: string;
  user: string;
}

export default function ChatArea({ selectedChat }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingStates, setTypingStates] = useState<TypingState[]>([]);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Update typing state as user types
  const handleMessageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setNewMessage(text);

    if (selectedChat && user?.uid) {
      const typingRef = doc(db, `chats/${selectedChat.id}/typing`, user.uid);
      if (text) {
        await setDoc(typingRef, { text }, { merge: true });
      } else {
        await deleteDoc(typingRef);
      }
    }
  };

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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat && user?.uid) {
      await addDoc(collection(db, `chats/${selectedChat.id}/messages`), {
        text: newMessage,
        sender: user.uid,
        timestamp: serverTimestamp(),
        read: false,
        readBy: [user.uid]  // Message is "read" by sender
      });

      // Clear typing state
      const typingRef = doc(db, `chats/${selectedChat.id}/typing`, user.uid);
      await deleteDoc(typingRef);
      setNewMessage('');

      // Focus the input field after sending the message
      inputRef.current?.focus();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!selectedChat) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <p className="text-xl text-gray-500">Select a chat to start messaging</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Chat Header */}
      <div className="flex items-center px-4 py-2 border-b border-[#1A1A1A]">
        <div className="flex-1 text-center">
          <h2 className="text-white font-medium text-lg truncate">
            {selectedChat.users.find(u => u !== user?.email)?.split('@')[0] || 'Chat'}
          </h2>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === user?.uid ? 'justify-end' : 'justify-start'
            }`}
          >
            <div className="flex flex-col max-w-[85%]">
              <div
                className={`px-3 py-2 ${
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
              <div className="flex flex-col max-w-[85%]">
                <div className="px-3 py-2 bg-[#1A1A1A]/50 text-gray-400 rounded-2xl rounded-bl-none">
                  {state.text}
                </div>
              </div>
            </div>
          ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 p-2 border-t border-[#1A1A1A] bg-black">
        <form onSubmit={sendMessage} className="flex items-center space-x-2">
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
            placeholder="iMessage"
            className="flex-1 bg-[#1A1A1A] text-white rounded-full px-3 py-2 focus:outline-none"
            enterKeyHint="send"
            autoFocus
            onBlur={() => inputRef.current?.focus()}
          />
          <button type="submit" className="text-blue-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

