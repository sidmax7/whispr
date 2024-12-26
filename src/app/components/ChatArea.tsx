import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, Timestamp, where, getDocs, getDoc } from 'firebase/firestore';
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
    onStopTypingReceived,
    sendReadReceipt,
    onMessageReadReceived
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
      const q = query(
        collection(db, `chats/${selectedChat.id}/messages`), 
        orderBy('timestamp', 'asc')
      );

      // One-time load of messages
      const loadMessages = async () => {
        try {
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
          // Clear any existing messages before setting new ones
          setMessages(loadedMessages);
        } catch (error) {
          console.error('Error loading messages:', error);
        }
      };

      loadMessages();
    }
  }, [selectedChat?.id]); // Only run when chat changes

  // Listen for real-time messages
  useEffect(() => {
    if (!selectedChat || !user?.uid) return;

    const cleanup = onMessageReceived((socketMessage: SocketMessage) => {
      if (socketMessage.chatId === selectedChat.id) {
        // Clear typing state for this user when receiving their message
        setTypingStates(prev => prev.filter(state => state.user !== socketMessage.senderId));

        // Add message to local state only if it doesn't already exist
        setMessages(prev => {
          // Check if message already exists by comparing text and timestamp
          const messageExists = prev.some(msg => 
            msg.text === socketMessage.text && 
            msg.sender === socketMessage.senderId &&
            Math.abs(msg.timestamp.toMillis() - new Date(socketMessage.timestamp).getTime()) < 1000
          );

          if (messageExists) {
            return prev;
          }

          const newMessage = {
            id: socketMessage.messageId,
            text: socketMessage.text,
            sender: socketMessage.senderId,
            timestamp: Timestamp.fromDate(new Date(socketMessage.timestamp)),
            read: false,
            readBy: [socketMessage.senderId]
          };

          // If we're the receiver, send read receipt immediately
          if (socketMessage.senderId !== user.uid) {
            console.log('📤 Sending read receipt for new message:', socketMessage.messageId);
            sendReadReceipt(socketMessage.messageId, selectedChat.id, socketMessage.senderId);
            newMessage.readBy.push(user.uid);
          }

          return [...prev, newMessage];
        });

        // Only save to Firebase if we're the sender
        if (socketMessage.senderId === user.uid) {
          addDoc(collection(db, `chats/${selectedChat.id}/messages`), {
            text: socketMessage.text,
            sender: socketMessage.senderId,
            timestamp: serverTimestamp(),
            read: false,
            readBy: [socketMessage.senderId]
          }).then(docRef => {
            // Update local message ID to match Firebase ID
            setMessages(prev => prev.map(msg => 
              msg.id === socketMessage.messageId ? { ...msg, id: docRef.id } : msg
            ));
            
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
  }, [selectedChat, user?.uid, onMessageReceived, sendReadReceipt]);

  // Listen for typing states
  useEffect(() => {
    if (!selectedChat || !user?.uid) return;

    const handleTyping = ({ senderId, chatId, text }: { senderId: string; chatId: string; text: string }) => {
      if (chatId === selectedChat.id && senderId !== user.uid) {
        setTypingStates(prev => {
          const filtered = prev.filter(state => state.user !== senderId);
          if (text) {
            return [...filtered, { user: senderId, text }];
          }
          return filtered;
        });
      }
    };

    const handleStopTyping = ({ senderId, chatId }: { senderId: string; chatId: string }) => {
      if (chatId === selectedChat.id && senderId !== user.uid) {
        setTypingStates(prev => prev.filter(state => state.user !== senderId));
      }
    };

    const cleanupTyping = onTypingStateReceived(handleTyping);
    const cleanupStopTyping = onStopTypingReceived(handleStopTyping);

    return () => {
      cleanupTyping();
      cleanupStopTyping();
      setTypingStates([]);
    };
  }, [selectedChat?.id, user?.uid, onTypingStateReceived, onStopTypingReceived]);

  // Mark messages as read when chat is opened or new messages arrive
  useEffect(() => {
    if (selectedChat && user?.uid) {
      const markMessagesAsRead = () => {
        const unreadMessages = messages.filter(
          msg => msg.sender !== user.uid && !msg.readBy.includes(user.uid)
        );

        unreadMessages.forEach(msg => {
          console.log('📤 Marking message as read:', msg.id);
          sendReadReceipt(msg.id, selectedChat.id, msg.sender);
          
          // Update local state immediately
          setMessages(prev => prev.map(message => 
            message.id === msg.id
              ? { ...message, readBy: [...new Set([...message.readBy, user.uid])] }
              : message
          ));

          // Update Firebase in background
          const messageRef = doc(db, `chats/${selectedChat.id}/messages/${msg.id}`);
          updateDoc(messageRef, {
            readBy: arrayUnion(user.uid)
          }).catch(error => {
            console.error('Error updating read status in Firebase:', error);
          });
        });
      };

      // Mark messages as read immediately when component mounts or messages change
      markMessagesAsRead();

      // Set up an interval to periodically check for and mark unread messages
      const interval = setInterval(markMessagesAsRead, 5000);

      return () => clearInterval(interval);
    }
  }, [messages, selectedChat, user?.uid, sendReadReceipt]);

  // Listen for read receipts and online status
  useEffect(() => {
    if (!selectedChat || !user?.uid) return;

    const cleanup = onMessageReadReceived(({ messageId, readerId, timestamp }) => {
      console.log('📥 Updating message read status:', { messageId, readerId, timestamp });
      
      // Update messages immediately in state
      setMessages(prev => prev.map(msg => {
        // If messageId is provided, only update that specific message
        if (messageId && msg.id === messageId) {
          const newReadBy = [...new Set([...msg.readBy, readerId])];
          console.log(`Message ${messageId} read by:`, newReadBy);
          return { 
            ...msg, 
            readBy: newReadBy
          };
        }
        // If no messageId, update all messages from before the timestamp
        if (!messageId && msg.sender === user.uid && msg.timestamp.toMillis() <= new Date(timestamp).getTime()) {
          const newReadBy = [...new Set([...msg.readBy, readerId])];
          console.log(`Message ${msg.id} read by:`, newReadBy);
          return { 
            ...msg, 
            readBy: newReadBy
          };
        }
        return msg;
      }));

      // Update Firebase in background
      if (messageId && !messageId.startsWith('temp-')) {
        const messageRef = doc(db, `chats/${selectedChat.id}/messages/${messageId}`);
        updateDoc(messageRef, {
          readBy: arrayUnion(readerId)
        }).catch(error => {
          console.error('Error updating read status in Firebase:', error);
        });
      }
    });

    return cleanup;
  }, [selectedChat?.id, user?.uid, onMessageReadReceived]);

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

      const messageId = `msg-${Date.now()}`;

      // Add message to local state first
      const newMessage = {
        id: messageId,
        text: messageText,
        sender: user.uid,
        timestamp: Timestamp.now(),
        read: false,
        readBy: [user.uid]
      };
      setMessages(prev => [...prev, newMessage]);

      // Send through socket for real-time delivery
      sendMessage(otherUserId, messageText, selectedChat.id, messageId);

      // Save to Firebase in background
      try {
        const messageDoc = await addDoc(collection(db, `chats/${selectedChat.id}/messages`), {
          text: messageText,
          sender: user.uid,
          timestamp: serverTimestamp(),
          read: false,
          readBy: [user.uid]
        });

        // Update local message ID to match Firebase ID
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, id: messageDoc.id } : msg
        ));

        // Update the chat's lastMessage
        const chatRef = doc(db, 'chats', selectedChat.id);
        await updateDoc(chatRef, {
          lastMessage: messageText,
          lastMessageTime: serverTimestamp()
        });
      } catch (error) {
        console.error('Error saving message:', error);
      }
    }
  };

  const handleTyping = (text: string) => {
    if (selectedChat && user?.uid) {
      const otherUserId = getOtherUserId();
      if (!otherUserId) return;

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

  // Render messages with read status
  const renderMessagesAndTypingStates = () => {
    const allItems = [...messages];
    
    // Add typing states as ghost messages at the end
    typingStates.forEach(state => {
      allItems.push({
        id: `typing-${state.user}-${Date.now()}`,
        text: state.text,
        sender: state.user,
        timestamp: Timestamp.now(),
        read: false,
        readBy: [],
        isTyping: true
      });
    });

    // Sort messages by timestamp
    allItems.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

    return allItems.map((message, index) => (
      <div
        key={`${message.id}-${index}`}
        className={`flex ${
          message.sender === user?.uid ? 'justify-end' : 'justify-start'
        } mb-4`}
      >
        <div className="break-words max-w-[85%] md:max-w-[75%] w-fit">
          <div
            className={`px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap break-all ${
              message.isTyping 
                ? 'bg-[#2A2640]/50 text-gray-400'
                : message.sender === user?.uid
                ? 'bg-[#584ACB] text-white'
                : 'bg-[#413F51] text-white'
            } rounded-[20px] ${
              message.sender === user?.uid ? 'rounded-br-[5px]' : 'rounded-bl-[5px]'
            } ${message.isTyping ? 'animate-pulse' : ''}`}
          >
            {message.text}
            {message.isTyping && (
              <span className="ml-2 inline-flex">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce delay-100">.</span>
                <span className="animate-bounce delay-200">.</span>
              </span>
            )}
          </div>
          {!message.isTyping && message.sender === user?.uid && (
            <div className="flex justify-end mt-1">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                {message.readBy.some(id => id !== user.uid && id === otherUserProfile?.uid) ? (
                  <>
                    Read
                    <Check className="w-3 h-3 text-violet-500 transition-colors duration-300" />
                    <Check className="w-3 h-3 text-violet-500 -ml-2 transition-colors duration-300" />
                  </>
                ) : (
                  <>
                    Sent
                    <Check className="w-3 h-3 text-gray-500 transition-colors duration-300" />
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    ));
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
        {renderMessagesAndTypingStates()}
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
