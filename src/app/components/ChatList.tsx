'use client'

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where, addDoc, serverTimestamp, getDocs, WhereFilterOp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/hooks/useAuth';
import UserSearch from './UserSearch';
import Image from 'next/image';
import { Chat, UserProfile } from '../types/chat';
import { Timestamp } from 'firebase/firestore';
import { Search, X } from 'lucide-react';
import { SettingsDialog } from './settings-dialog';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/app/lib/firebase';

interface ChatListProps {
  onSelectChat: (chat: Chat) => void;
  selectedChat: Chat | null;
  onClose: () => void;
}

interface OnlineStatus {
  online: boolean;
  lastSeen: Timestamp;
}

export default function ChatList({ onSelectChat, selectedChat, onClose }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [onlineStatuses, setOnlineStatuses] = useState<{[key: string]: OnlineStatus}>({});
  const { user} = useAuth();
  
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);

  const fetchUserProfiles = async (chat: Chat) => {
    const userProfiles: { [key: string]: UserProfile } = {};
    
    for (const participant of chat.participants) {
      const q = query(collection(db, 'users'), where('email', '==', participant.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        userProfiles[participant.email] = {
          email: participant.email,
          displayName: userData.displayName || null,
          photoURL: userData.photoURL || null,
          uid: userData.uid || participant.email,
          online: userData.online || false,
          lastSeen: userData.lastSeen || serverTimestamp()
        };
      }
    }
    
    return userProfiles;
  };

  useEffect(() => {
    if (user?.email) {
      console.log('Setting up chat listener for user:', user);
      
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', {
          uid: user.uid,
          email: user.email
        })
      );

      console.log('Chat query:', q);
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        console.log('Chat snapshot received:', snapshot.docs.length, 'chats');
        console.log('Snapshot docs:', snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })));
        
        const chatsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            participants: data.participants || [],
            lastMessage: data.lastMessage || '',
            lastMessageTime: data.lastMessageTime || serverTimestamp(),
            createdAt: data.createdAt || serverTimestamp()
          } as Chat;
        });
        
        console.log('Setting chats:', chatsData);
        setChats(chatsData);
      }, (error) => {
        console.error('Error in chat listener:', error);
      });

      return () => unsubscribe();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const usersRef = collection(db, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const statuses: {[key: string]: OnlineStatus} = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        statuses[data.email] = {
          online: data.online || false,
          lastSeen: data.lastSeen
        };
      });
      setOnlineStatuses(statuses);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const fetchUserPhoto = async () => {
      if (!user?.uid) return;
      
      try {
        const photoRef = ref(storage, `profile-pictures/${user.uid}`);
        const url = await getDownloadURL(photoRef);
        setUserPhotoURL(url);
      } catch (error) {
        console.log('No profile picture found, using default');
        setUserPhotoURL(null);
      }
    };

    fetchUserPhoto();
  }, [user?.uid]);

  const getChatUser = async (chat: Chat) => {
    if (!user?.email) return null;
    const otherParticipant = chat.participants.find(p => p.email !== user.email);
    if (!otherParticipant) return null;
    
    // Type assertion since email is required in Participant interface
    const email: string = otherParticipant.email;
    
    // Fetch user profile from users collection
    const userDoc = await getDocs(query(
      collection(db, 'users'),
      where('email', '==', email)
    ));
    
    if (!userDoc.empty) {
      const userData = userDoc.docs[0].data();
      return {
        email: otherParticipant.email,
        uid: otherParticipant.uid,
        displayName: userData.displayName || otherParticipant.email.split('@')[0],
        photoURL: userData.photoURL || null,
        online: userData.online || false,
        lastSeen: userData.lastSeen
      };
    }
    
    return {
      email: otherParticipant.email,
      uid: otherParticipant.uid,
      displayName: otherParticipant.email.split('@')[0],
      photoURL: null,
      online: false,
      lastSeen: null
    };
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
      email: recipientEmail,
      uid: recipientEmail
    };

    // Simplified chat data structure
    const chatData = {
      participants: [
        { 
          uid: user.uid,
          email: user.email
        },
        { 
          uid: recipientData.uid,
          email: recipientEmail
        }
      ],
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    // Check if chat already exists
    const existingChat = chats.find(chat => {
      const participantEmails = chat.participants.map(p => p.email);
      return participantEmails.includes(recipientEmail) && participantEmails.includes(user.email!);
    });

    if (existingChat) {
      console.log('Found existing chat:', existingChat.id);
      onSelectChat(existingChat);
    } else {
      // Check in Firebase for existing chat
      const chatsRef = collection(db, 'chats');
      const userChatsQuery = query(
        chatsRef,
        where('participants', 'array-contains', {
          uid: user.uid,
          email: user.email
        })
      );
      
      const querySnapshot = await getDocs(userChatsQuery);
      const existingFirebaseChat = querySnapshot.docs.find(doc => {
        const data = doc.data();
        return data.participants.some((p: any) => p.email === recipientEmail);
      });

      if (existingFirebaseChat) {
        console.log('Found existing chat in Firebase:', existingFirebaseChat.id);
        const chatData = existingFirebaseChat.data();
        const chat: Chat = {
          id: existingFirebaseChat.id,
          participants: chatData.participants,
          lastMessage: chatData.lastMessage || '',
          lastMessageTime: chatData.lastMessageTime,
          createdAt: chatData.createdAt
        };
        onSelectChat(chat);
      } else {
        console.log('Creating new chat with:', recipientEmail);
        const chatRef = await addDoc(collection(db, 'chats'), chatData);

        const newChat: Chat = {
          id: chatRef.id,
          participants: chatData.participants,
          lastMessage: '',
          lastMessageTime: serverTimestamp() as unknown as Timestamp,
          createdAt: serverTimestamp() as unknown as Timestamp
        };

        onSelectChat(newChat);
      }
    }
  };

  const getUnreadCount = async (chat: Chat) => {
    if (!user?.uid) return 0;
    
    // Get unread messages from messages subcollection
    const messagesRef = collection(db, `chats/${chat.id}/messages`);
    const q = query(
      messagesRef,
      where('senderId', '!=', user.uid),
      where('read', '==', false)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.length;
  };

  const sortedChats = [...chats].sort((a, b) => {
    if (!a.lastMessageTime || !b.lastMessageTime) return 0;
    return b.lastMessageTime.toMillis() - a.lastMessageTime.toMillis();
  });

  const ChatItem = ({ chat }: { chat: Chat }) => {
    const [otherUser, setOtherUser] = useState<any>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
      const loadUserData = async () => {
        const userData = await getChatUser(chat);
        setOtherUser(userData);
        const count = await getUnreadCount(chat);
        setUnreadCount(count);
      };
      loadUserData();
    }, [chat]);

    if (!otherUser) return null;

    return (
      <div
        key={chat.id}
        className={`px-4 py-2 cursor-pointer hover:bg-[#2A2640] transition-colors ${
          selectedChat?.id === chat.id ? 'bg-[#2C2A42]' : ''
        }`}
        onClick={() => onSelectChat(chat)}
      >
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#6C5DD3] flex items-center justify-center overflow-hidden">
              {otherUser.photoURL ? (
                <Image
                  src={otherUser.photoURL}
                  alt={otherUser.displayName || otherUser.email}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full rounded-full"
                  priority
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-white text-base font-medium">
                  {(otherUser.displayName || otherUser.email || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#252436] ${
              otherUser.online ? 'bg-green-500' : 'bg-gray-500'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline">
              <h3 className="text-white font-medium text-sm truncate">
                {otherUser.displayName || otherUser.email?.split('@')[0] || 'Unknown User'}
              </h3>
            </div>
            {chat.lastMessage && (
              <p className="text-gray-400 text-xs truncate">
                {chat.lastMessage}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <span className="bg-[#6C5DD3] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-2">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#252436] w-full overflow-hidden">
      <div className="p-4 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-white">Messages</h1>
        <button
          onClick={onClose}
          className="lg:hidden p-2 rounded-full hover:bg-[#2A2640] transition-colors text-gray-400 hover:text-white"
          title="Close chat list"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <div className="px-4 relative">
        <div className="relative">
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearching(true)}
            className="w-full bg-[#2C2A42] text-white rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-[#363150] placeholder-gray-400 text-sm"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>

        {isSearching && (
          <>
            <div 
              className="fixed inset-0 bg-black/50" 
              onClick={() => setIsSearching(false)}
            />
            <UserSearch
              searchQuery={searchQuery}
              onSelectUser={handleSelectUser}
              onClose={() => setIsSearching(false)}
            />
          </>
        )}

        {chats.length === 0 && !isSearching && (
          <div className="h-full flex flex-col items-center justify-center p-8 mt-12">
            <div className="w-32 h-32 mb-6">
              <Image
                src="/placeholder.svg"
                alt="No messages"
                width={128}
                height={128}
                className="w-full h-full opacity-60"
              />
            </div>
            <p className="text-gray-400 text-center text-sm">
              No messages yet. Start a conversation!
            </p>
            <p className="text-gray-500 text-center text-xs mt-2">
              Use the search bar above to find someone to chat with
            </p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto mt-4">
        {sortedChats.map((chat) => (
          <ChatItem key={chat.id} chat={chat} />
        ))}
      </div>

      <div className="mt-auto border-t border-[#2A2640] p-2">
        <div className="flex items-center justify-between p-2 hover:bg-[#2A2640] rounded-lg transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#6C5DD3] flex items-center justify-center overflow-hidden">
              {userPhotoURL ? (
                <Image
                  src={userPhotoURL}
                  alt={user?.displayName || 'User'}
                  width={40}
                  height={40}
                  className="object-cover w-full h-full rounded-full"
                  priority
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-white text-base font-medium">
                  {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-white font-medium">
              {user?.displayName || user?.email?.split('@')[0] || 'User'}
            </span>
          </div>
          <SettingsDialog />
        </div>
      </div>
      </div>
  );
}
    
    
      

