'use client'

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/hooks/useAuth';
import UserSearch from './UserSearch';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Chat, UserProfile } from '../types/chat';
import { Timestamp } from 'firebase/firestore';

interface ChatListProps {
  onSelectChat: (chat: Chat) => void;
  selectedChat: Chat | null;
  onClose: () => void;
}

export default function ChatList({ onSelectChat, selectedChat, onClose }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();

  const fetchUserProfiles = async (chat: Chat) => {
    const userProfiles: { [key: string]: UserProfile } = {};
    
    for (const user of chat.users) {
      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        userProfiles[user.email] = {
          email: user.email,
          displayName: userData.displayName || null,
          photoURL: userData.photoURL || null,
        };
      }
    }
    
    return userProfiles;
  };

  useEffect(() => {
    if (user?.email) {
      const q = query(
        collection(db, 'chats'),
        where('users', 'array-contains', { 
          email: user.email, 
          displayName: user.displayName || '' 
        })
      );
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const chatsWithProfiles = await Promise.all(
          snapshot.docs.map(async (doc) => {
            const chatData = doc.data() as Omit<Chat, 'id'>;
            const userProfiles = await fetchUserProfiles({
              id: doc.id,
              ...chatData,
            });
            
            return {
              id: doc.id,
              ...chatData,
              userProfiles,
            };
          })
        );
        
        setChats(chatsWithProfiles);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const getChatUser = (chat: Chat) => {
    if (!user?.email || !chat.users) return null;
    const otherUser = chat.users.find(u => u.email !== user.email);
    if (!otherUser || !chat.userProfiles) return null;
    return chat.userProfiles[otherUser.email];
  };

  const handleSelectUser = async (recipientEmail: string) => {
    if (!user?.email) return;

    // First fetch the recipient's profile
    const recipientQuery = await getDocs(query(
      collection(db, 'users'), 
      where('email', '==', recipientEmail)
    ));
    
    const recipientData = recipientQuery.docs[0]?.data() || {
      displayName: recipientEmail.split('@')[0],
      photoURL: null
    };

    // Get current user's profile to ensure we have latest display name
    const currentUserQuery = await getDocs(query(
      collection(db, 'users'),
      where('email', '==', user.email)
    ));

    const currentUserData = currentUserQuery.docs[0]?.data() || {
      displayName: user.displayName || user.email?.split('@')[0],
      photoURL: user.photoURL
    };

    const chatData = {
      users: [
        { 
          email: user.email, 
          displayName: currentUserData.displayName || user.email.split('@')[0]  // Use current user's display name
        },
        { 
          email: recipientEmail, 
          displayName: recipientData.displayName || recipientEmail.split('@')[0] 
        }
      ],
      createdAt: serverTimestamp(),
      messages: [],
      lastMessage: '',
      timestamp: serverTimestamp(),
      userProfiles: {
        [user.email as string]: {
          email: user.email,
          displayName: currentUserData.displayName || user.email.split('@')[0],
          photoURL: currentUserData.photoURL
        },
        [recipientEmail]: {
          email: recipientEmail,
          displayName: recipientData.displayName || recipientEmail.split('@')[0],
          photoURL: recipientData.photoURL
        }
      }
    };

    // Check if chat already exists
    const existingChat = chats.find(chat => 
      chat.users.some(u => u.email === recipientEmail) && 
      chat.users.some(u => u.email === user.email)
    );

    if (existingChat) {
      onSelectChat(existingChat);
    } else {
      const chatRef = await addDoc(collection(db, 'chats'), chatData);

      const newChat: Chat = {
        id: chatRef.id,
        ...chatData,
        timestamp: serverTimestamp() as unknown as Timestamp
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

  const sortedChats = [...chats].sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    // Firestore timestamps can be compared directly
    return b.timestamp.toMillis() - a.timestamp.toMillis();
  });

  const formatTimestamp = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return 'Today';
    return new Date(timestamp.seconds * 1000).toLocaleDateString();
  };

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <div className="flex flex-col h-full bg-black w-full overflow-hidden">
      <div className="p-4 flex justify-between items-center border-b border-[#1A1A1A]">
        <h1 className="text-2xl font-semibold text-white">Messages</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => router.push('/profile')}
            className="p-2 rounded-full hover:bg-[#252525] transition-colors"
            title="Profile Settings"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-full hover:bg-[#252525] transition-colors"
            title="Close chat list"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
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

      <div className="flex-1 overflow-y-auto">
        {sortedChats.map((chat) => {
          const otherUser = getChatUser(chat);
          
          return (
            <div
              key={chat.id}
              className={`px-4 py-3 cursor-pointer hover:bg-[#1A1A1A] ${
                selectedChat?.id === chat.id ? 'bg-[#1A1A1A]' : ''
              }`}
              onClick={() => onSelectChat(chat)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center overflow-hidden">
                  {otherUser?.photoURL ? (
                    <Image
                      src={otherUser.photoURL}
                      alt={otherUser.displayName || otherUser.email}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-white text-lg">
                      {(otherUser?.displayName || otherUser?.email || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-white font-medium truncate">
                      {otherUser?.displayName || otherUser?.email.split('@')[0] || 'Unknown User'}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {getUnreadCount(chat) > 0 && (
                        <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                          {getUnreadCount(chat)}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{formatTimestamp(chat.timestamp)}</span>
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
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
            />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

