import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, Timestamp, where, getDocs } from 'firebase/firestore';
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
  isTyping?: boolean;
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

  // Listen for Firebase messages - only on initial load
  useEffect(() => {
    if (selectedChat) {
      console.log('Loading initial messages from Firebase for chat:', selectedChat.id);
      const q = query(
        collection(db, `chats/${selectedChat.id}/messages`), 
        orderBy('timestamp', 'asc')
      );

      // One-time load of messages
      const loadMessages = async () => {
        const snapshot = await getDocs(q);
        const loadedMessages = snapshot.docs.map(doc => {
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
        console.log('Loaded initial messages from Firebase:', loadedMessages);
        setMessages(loadedMessages);
      };

      loadMessages();

      // Cleanup function to save messages to Firebase when chat is closed
      return () => {
        console.log('Saving messages to Firebase before cleanup');
        // Save any unsaved messages
        messages.forEach(async (msg) => {
          if (msg.id.startsWith('temp-')) {
            try {
              await addDoc(collection(db, `chats/${selectedChat.id}/messages`), {
                text: msg.text,
                sender: msg.sender,
                timestamp: msg.timestamp,
                read: msg.read,
                readBy: msg.readBy
              });
            } catch (error) {
              console.error('Error saving message to Firebase:', error);
            }
          }
        });
      };
    }
  }, [selectedChat?.id]); // Only run when chat changes

  // Listen for real-time messages
  useEffect(() => {
    if (!selectedChat || !user?.uid) return;

    console.log('Setting up message listener for chat:', selectedChat.id);
    const cleanup = onMessageReceived((socketMessage: SocketMessage) => {
      console.log('Received real-time message:', socketMessage);
      if (socketMessage.chatId === selectedChat.id) {
        // Add message to local state
        const newMessage = {
          id: `temp-${Date.now()}`,
          text: socketMessage.text,
          sender: socketMessage.senderId,
          timestamp: Timestamp.fromDate(new Date(socketMessage.timestamp)),
          read: false,
          readBy: [socketMessage.senderId]
        };
        setMessages(prev => [...prev, newMessage]);

        // If we're the receiver, save to Firebase
        if (socketMessage.senderId !== user.uid) {
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
              lastMessageTime: serverTimestamp()
            });
          });
        }
      }
    });

    return cleanup;
  }, [selectedChat, user?.uid, onMessageReceived]);

  // Listen for typing states
  useEffect(() => {
    if (!selectedChat || !user?.uid) return;

    const handleTyping = ({ senderId, chatId, text }: { senderId: string; chatId: string; text: string }) => {
      if (chatId === selectedChat.id && senderId !== user.uid) {
        console.log('Received typing state:', { senderId, chatId, text });
        setTypingStates(prev => {
          // Remove any existing state for this user
          const filtered = prev.filter(state => state.user !== senderId);
          // Add new state if there's text
          return text ? [...filtered, { user: senderId, text }] : filtered;
        });
      }
    };

    const handleStopTyping = ({ senderId, chatId }: { senderId: string; chatId: string }) => {
      if (chatId === selectedChat.id && senderId !== user.uid) {
        console.log('Received stop typing:', { senderId, chatId });
        setTypingStates(prev => prev.filter(state => state.user !== senderId));
      }
    };

    console.log('Setting up typing state listeners');
    const cleanupTyping = onTypingStateReceived(handleTyping);
    const cleanupStopTyping = onStopTypingReceived(handleStopTyping);

    return () => {
      console.log('Cleaning up typing state listeners');
      cleanupTyping();
      cleanupStopTyping();
      setTypingStates([]);
    };
  }, [selectedChat?.id, user?.uid, onTypingStateReceived, onStopTypingReceived]);

  // Mark messages as read
  useEffect(() => {
    if (selectedChat && user?.uid) {
      const unreadMessages = messages.filter(
        msg => !msg.id.startsWith('temp-') && // Skip temporary messages
        msg.sender !== user.uid && 
        !msg.readBy.includes(user.uid)
      );

      unreadMessages.forEach(async (msg) => {
        try {
          const messageRef = doc(db, `chats/${selectedChat.id}/messages/${msg.id}`);
          await updateDoc(messageRef, {
            readBy: arrayUnion(user.uid)
          });
        } catch (error) {
          console.error('Error marking message as read:', error);
        }
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
      if (!otherUserId) return;

      // Add message to local state with temporary ID
      const tempMessage = {
        id: `temp-${Date.now()}`,
        text: messageText,
        sender: user.uid,
        timestamp: Timestamp.now(),
        read: false,
        readBy: [user.uid]
      };
      setMessages(prev => [...prev, tempMessage]);

      // Send through socket for real-time delivery
      console.log('Sending message to user:', otherUserId);
      sendMessage(otherUserId, messageText, selectedChat.id);

      // Update the chat's lastMessage in Firebase
      const chatRef = doc(db, 'chats', selectedChat.id);
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp()
      });
    }
  };

  const handleTyping = (text: string) => {
    if (selectedChat && user?.uid) {
      const otherUserId = getOtherUserId();
      if (!otherUserId) return;

      if (text) {
        console.log('Sending typing state:', { otherUserId, text });
        sendTypingState(otherUserId, selectedChat.id, text);
      } else {
        console.log('Sending stop typing:', { otherUserId });
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

  // Render messages and typing states
  const renderMessagesAndTypingStates = () => {
    const allItems = [...messages];
    
    // Add typing states as ghost messages at the end
    typingStates.forEach(state => {
      if (state.text) {  // Only add if there's text
        allItems.push({
          id: `typing-${state.user}`,
          text: state.text,
          sender: state.user,
          timestamp: Timestamp.now(),
          read: false,
          readBy: [],
          isTyping: true
        });
      }
    });

    return allItems;
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

      {/* Messages and typing states */}
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
                    ? 'bg-[#584ACB] text-white'
                    : 'bg-[#413F51] text-white'
                } rounded-[20px] ${
                  message.sender === user?.uid ? 'rounded-br-[5px]' : 'rounded-bl-[5px]'
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
        {typingStates.map(state => (
          state.text && (
            <div key={`typing-${state.user}`} className="flex justify-start mb-4">
              <div className="break-words max-w-[85%] md:max-w-[75%] w-fit animate-pulse">
                <div className="px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-all bg-[#2A2640]/50 text-gray-400 rounded-[20px] rounded-bl-[5px]">
                  {state.text}
                </div>
              </div>
            </div>
          )
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
