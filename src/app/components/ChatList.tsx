import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/hooks/useAuth';
import UserSearch from './UserSearch';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Timestamp;
  read: boolean;
  readBy: string[];
}

interface Chat {
  id: string;
  users: string[];
  lastMessage?: string;
  timestamp?: string;
  messages?: Message[];
}

interface ChatListProps {
  onSelectChat: (chat: Chat) => void;
  selectedChat: Chat | null;
}

export default function ChatList({ onSelectChat, selectedChat }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.email) {
      const q = query(
        collection(db, 'chats'),
        where('users', 'array-contains', user.email)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setChats(
          snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<Chat, 'id'>)
          }))
        );
      });

      return () => unsubscribe();
    }
  }, [user]);

  const getChatName = (chat: Chat) => {
    if (!user?.email || !chat.users) return 'Chat';
    const otherUser = chat.users.find(email => email !== user.email);
    return otherUser?.split('@')[0] || 'Chat';
  };

  const handleSelectUser = async (recipientEmail: string) => {
    if (!user?.email) return;

    // Check if chat already exists
    const existingChat = chats.find(chat => 
      chat.users.includes(recipientEmail) && user.email ? chat.users.includes(user.email) : false
    );

    if (existingChat) {
      onSelectChat(existingChat);
    } else {
      // Create new chat
      const chatRef = await addDoc(collection(db, 'chats'), {
        users: [user.email, recipientEmail],
        createdAt: serverTimestamp(),
      });

      const newChat: Chat = {
        id: chatRef.id,
        users: [user.email, recipientEmail],
        timestamp: 'Just now'
      };

      onSelectChat(newChat);
    }
  };

  const getUnreadCount = (chat: Chat) => {
    if (!user?.uid) return 0;
    return (chat.messages || []).filter(
      msg => msg.sender !== user.uid && !msg.readBy.includes(user.uid)
    ).length;
  };

  return (
    <div className="bg-black w-screen lg:w-80 h-full overflow-y-auto border-r border-[#1A1A1A]">
      <div className="p-4 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-white">Messages</h1>
        
      </div>
      
      <div className="px-4 pb-2 relative">
        <div className="relative">
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearching(true)}
            className="w-full bg-[#1A1A1A] text-white rounded-full py-2 pl-9 pr-4 focus:outline-none"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {isSearching && (
          <>
            <div 
              className="fixed inset-0 bg-transparent" 
              onClick={() => setIsSearching(false)}
            />
            <UserSearch
              searchQuery={searchQuery}
              onSelectUser={handleSelectUser}
              onClose={() => setIsSearching(false)}
            />
          </>
        )}
      </div>

      <div className="mt-2">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`px-4 py-3 cursor-pointer hover:bg-[#1A1A1A] ${
              selectedChat?.id === chat.id ? 'bg-[#1A1A1A]' : ''
            }`}
            onClick={() => onSelectChat(chat)}
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center">
                <span className="text-white text-lg">
                  {getChatName(chat).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="text-white font-medium truncate">
                    {getChatName(chat)}
                  </h3>
                  <div className="flex items-center space-x-2">
                    {getUnreadCount(chat) > 0 && (
                      <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {getUnreadCount(chat)}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{chat.timestamp || 'Today'}</span>
                  </div>
                </div>
                {chat.lastMessage && (
                  <p className="text-gray-500 text-sm truncate">
                    {chat.lastMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

