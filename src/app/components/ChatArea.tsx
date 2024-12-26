import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, Timestamp, where } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/hooks/useAuth';
import { Chat } from '../types/chat';
import ChatInput from './ChatInput';
import { Check } from 'lucide-react';
import { useSocket, Message as SocketMessage } from '../hooks/useSocket';

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Timestamp;
  read: boolean;
  readBy: string[];
}

interface ChatAreaProps {
  selectedChat: Chat | null;
  onOpenChatList: () => void;
}

interface TypingState {
  text: string;
  user: string;
}

interface UserProfile {
  email: string;
  uid: string;
  displayName: string;
  photoURL: string | null;
  online: boolean;
  lastSeen: Timestamp | undefined;
}

export default function ChatArea({ selectedChat, onOpenChatList }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingStates, setTypingStates] = useState<TypingState[]>([]);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { 
    sendMessage, 
    onMessageReceived, 
    sendTypingState, 
    stopTyping, 
    onTypingStateReceived, 
    onStopTypingReceived 
  } = useSocket();
  const [otherUserProfile, setOtherUserProfile] = useState<UserProfile | null>(null);

  // Get the other user's ID
  const getOtherUserId = useCallback(() => {
    if (!selectedChat || !user) return null;
    const otherUser = selectedChat.participants.find(p => p.email !== user.email);
    return otherUser?.uid;
  }, [selectedChat, user]);

  // Fetch other user's profile
  useEffect(() => {
    if (!selectedChat || !user?.email) return;
    
    const otherParticipant = selectedChat.participants.find(p => p.email !== user.email);
    if (!otherParticipant) return;

    const userDoc = query(
      collection(db, 'users'),
      where('email', '==', otherParticipant.email)
    );

    const unsubscribe = onSnapshot(userDoc, (snapshot) => {
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        setOtherUserProfile({
          email: otherParticipant.email,
          uid: otherParticipant.uid,
          displayName: userData.displayName || otherParticipant.email.split('@')[0],
          photoURL: userData.photoURL || null,
          online: userData.online || false,
          lastSeen: userData.lastSeen
        });
      }
    });

    return () => unsubscribe();
  }, [selectedChat, user?.email]);

  // Listen for Firebase messages
  useEffect(() => {
    if (selectedChat) {
      console.log('Setting up Firebase message listener for chat:', selectedChat.id);
      const q = query(
        collection(db, `chats/${selectedChat.id}/messages`), 
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newMessages = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text,
            sender: data.sender,
            timestamp: data.timestamp,
            read: data.read || false,
            readBy: data.readBy || []
          } as Message;
        });
        console.log('Received Firebase messages:', newMessages);
        setMessages(prev => {
          // Keep temporary messages that haven't been synced to Firebase yet
          const tempMessages = prev.filter(msg => 
            msg.id.startsWith('temp-') && 
            !newMessages.some(newMsg => newMsg.text === msg.text && newMsg.sender === msg.sender)
          );
          return [...newMessages, ...tempMessages];
        });
      });

      return () => {
        console.log('Cleaning up Firebase message listener');
        unsubscribe();
      };
    }
  }, [selectedChat]);

  // Listen for real-time messages
  useEffect(() => {
    if (!selectedChat) return;

    console.log('Setting up message listener for chat:', selectedChat.id);
    const cleanup = onMessageReceived((socketMessage: SocketMessage) => {
      console.log('Received real-time message:', socketMessage);
      if (socketMessage.chatId === selectedChat.id) {
        // Add message to local state immediately
        const tempMessage = {
          id: `temp-${Date.now()}`,
          text: socketMessage.text,
          sender: socketMessage.senderId,
          timestamp: Timestamp.now(),
          read: false,
          readBy: [socketMessage.senderId]
        };
        console.log('Adding temp message:', tempMessage);
        setMessages(prev => [...prev, tempMessage]);

        // Only save to Firebase if we're the receiver
        if (socketMessage.senderId !== user?.uid) {
          console.log('Saving received message to Firebase');
          addDoc(collection(db, `chats/${selectedChat.id}/messages`), {
            text: socketMessage.text,
            sender: socketMessage.senderId,
            timestamp: serverTimestamp(),
            read: false,
            readBy: [socketMessage.senderId]
          }).then(() => {
            // Update the chat's lastMessage
            const chatRef = doc(db, 'chats', selectedChat.id);
            updateDoc(chatRef, {
              lastMessage: socketMessage.text,
              timestamp: serverTimestamp()
            });
          });
        }
      }
    });

    return cleanup;
  }, [selectedChat, onMessageReceived, user?.uid]);

  // Listen for typing states
  useEffect(() => {
    if (!selectedChat) return;

    const handleTyping = ({ senderId, chatId, text }: { senderId: string; chatId: string; text: string }) => {
      console.log('Received typing state:', { senderId, chatId, text });
      if (chatId === selectedChat.id) {
        setTypingStates(prev => {
          const existing = prev.find(state => state.user === senderId);
          if (existing) {
            return prev.map(state => 
              state.user === senderId ? { ...state, text } : state
            );
          }
          return [...prev, { user: senderId, text }];
        });
      }
    };

    const handleStopTyping = ({ senderId, chatId }: { senderId: string; chatId: string }) => {
      console.log('Received stop typing:', { senderId, chatId });
      if (chatId === selectedChat.id) {
        setTypingStates(prev => prev.filter(state => state.user !== senderId));
      }
    };

    const cleanupTyping = onTypingStateReceived(handleTyping);
    const cleanupStopTyping = onStopTypingReceived(handleStopTyping);

    return () => {
      cleanupTyping();
      cleanupStopTyping();
    };
  }, [selectedChat, onTypingStateReceived, onStopTypingReceived]);

  // Mark messages as read
  useEffect(() => {
    if (selectedChat && user?.uid) {
      const unreadMessages = messages.filter(
        msg => msg.sender !== user.uid && !msg.readBy.includes(user.uid)
      );

      unreadMessages.forEach(async (msg) => {
        const messageRef = doc(db, `chats/${selectedChat.id}/messages/${msg.id}`);
        await updateDoc(messageRef, {
          readBy: arrayUnion(user.uid)
        });
      });
    }
  }, [messages, selectedChat, user?.uid]);

  // Scroll to bottom
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    };

    const handleResize = () => {
      scrollToBottom();
    };

    window.addEventListener('resize', handleResize);
    scrollToBottom();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [messages]);

  const handleSendMessage = async (messageText: string) => {
    if (selectedChat && user?.uid) {
      const otherUserId = getOtherUserId();
      if (!otherUserId) {
        console.error('Could not find other user ID');
        return;
      }

      // Add message to local state immediately
      setMessages(prev => [...prev, {
        id: `temp-${Date.now()}`,
        text: messageText,
        sender: user.uid,
        timestamp: Timestamp.now(),
        read: false,
        readBy: [user.uid]
      }]);

      // Send message through socket for real-time delivery
      console.log('Sending message to user:', otherUserId);
      sendMessage(otherUserId, messageText, selectedChat.id);

      // Save message to Firebase (sender's copy)
      const messageRef = await addDoc(collection(db, `chats/${selectedChat.id}/messages`), {
        text: messageText,
        sender: user.uid,
        timestamp: serverTimestamp(),
        read: false,
        readBy: [user.uid]
      });

      // Update the chat's lastMessage
      const chatRef = doc(db, 'chats', selectedChat.id);
      await updateDoc(chatRef, {
        lastMessage: messageText,
        timestamp: serverTimestamp()
      });

      console.log('Message saved with ID:', messageRef.id);
    }
  };

  const handleTyping = (text: string) => {
    if (selectedChat && user?.uid) {
      const otherUserId = getOtherUserId();
      if (!otherUserId) {
        console.error('Could not find other user ID');
        return;
      }

      console.log('Sending typing state to user:', otherUserId);
      if (text) {
        sendTypingState(otherUserId, selectedChat.id, text);
      } else {
        stopTyping(otherUserId, selectedChat.id);
      }
    }
  };

  const formatLastSeen = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return 'Offline';
    
    const now = new Date();
    const lastSeen = timestamp.toDate();
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    // Consider user online if last seen within last 2 minutes
    if (diffInMinutes < 2) return 'Online';
    if (diffInMinutes < 60) return `Last seen ${diffInMinutes} minutes ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Last seen ${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Last seen yesterday';
    if (diffInDays < 7) return `Last seen ${diffInDays} days ago`;
    
    return lastSeen.toLocaleDateString();
  };

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

        <div className="flex items-center gap-3 flex-1">
          <div className="relative">
            {otherUserProfile?.photoURL ? (
              <img 
                src={otherUserProfile.photoURL}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/assets/default-avatar.png';
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center">
                <span className="text-white text-lg font-medium">
                  {otherUserProfile?.displayName?.[0].toUpperCase() || '?'}
                </span>
              </div>
            )}
            
            {/* Online status indicator */}
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full bg-${otherUserProfile?.online ? 'green' : 'gray'}-500 border-2 border-[#252436]`}></span>
          </div>

          <div className="flex flex-col">
            <h2 className="text-white font-medium text-lg leading-tight">
              {otherUserProfile?.displayName || 'Chat'}
            </h2>
            <span className="text-sm text-gray-400">
              {otherUserProfile?.lastSeen ? formatLastSeen(otherUserProfile.lastSeen) : 'Offline'}
            </span>
          </div>
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
            onTyping={handleTyping}
          />
        </div>
      )}
    </div>
  );
}
