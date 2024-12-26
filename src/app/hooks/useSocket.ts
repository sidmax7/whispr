import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

const SOCKET_URL = 'http://localhost:4000';

export interface Message {
  senderId: string;
  text: string;
  chatId: string;
  timestamp: Date;
  messageId: string;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const connectedRef = useRef<boolean>(false);
  const onlineUsersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (user?.uid) {
      socketRef.current = io(SOCKET_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        query: { userId: user.uid }
      });

      socketRef.current.on('connect', () => {
        console.log('🔌 Socket connected');
        connectedRef.current = true;
        socketRef.current?.emit('addUser', user.uid);
      });

      socketRef.current.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
        connectedRef.current = false;
        onlineUsersRef.current.clear();
      });

      socketRef.current.on('getUsers', (users: User[]) => {
        onlineUsersRef.current = new Set(users.map(u => u.userId));
      });

      socketRef.current.on('userConnected', ({ userId, timestamp }: { userId: string, timestamp: string }) => {
        onlineUsersRef.current.add(userId);
        // When a user connects, emit read status for their active chat
        if (userId !== user.uid) {
          socketRef.current?.emit('getReadStatus', { chatId: userId });
        }
      });

      socketRef.current.on('userDisconnected', (userId: string) => {
        onlineUsersRef.current.delete(userId);
      });

      return () => {
        console.log('🔌 Cleaning up socket connection');
        if (socketRef.current) {
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
          socketRef.current = null;
          connectedRef.current = false;
          onlineUsersRef.current.clear();
        }
      };
    }
  }, [user?.uid]);

  const isUserOnline = useCallback((userId: string) => {
    return onlineUsersRef.current.has(userId);
  }, []);

  const sendMessage = useCallback((receiverId: string, text: string, chatId: string, messageId: string) => {
    if (socketRef.current && user?.uid) {
      socketRef.current.emit('sendMessage', {
        senderId: user.uid,
        receiverId,
        text,
        chatId,
        messageId,
        timestamp: new Date().toISOString()
      });
    }
  }, [user?.uid]);

  const onMessageReceived = useCallback((callback: (message: Message) => void) => {
    if (socketRef.current) {
      socketRef.current.on('getMessage', callback);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('getMessage');
      }
    };
  }, []);

  const sendTypingState = useCallback((receiverId: string, chatId: string, text: string) => {
    if (!socketRef.current || !user?.uid) return;

    socketRef.current.emit('typing', {
      senderId: user.uid,
      receiverId,
      chatId,
      text
    });
  }, [user?.uid]);

  const stopTyping = useCallback((receiverId: string, chatId: string) => {
    if (!socketRef.current || !user?.uid) return;

    socketRef.current.emit('stop-typing', {
      senderId: user.uid,
      receiverId,
      chatId
    });
  }, [user?.uid]);

  const onTypingStateReceived = useCallback((callback: (data: { senderId: string; chatId: string; text: string }) => void) => {
    if (!socketRef.current) return () => {};

    socketRef.current.off('userTyping');
    socketRef.current.on('userTyping', callback);

    return () => {
      socketRef.current?.off('userTyping');
    };
  }, []);

  const onStopTypingReceived = useCallback((callback: (data: { senderId: string; chatId: string }) => void) => {
    if (!socketRef.current) return () => {};

    socketRef.current.off('userStopTyping');
    socketRef.current.on('userStopTyping', callback);

    return () => {
      socketRef.current?.off('userStopTyping');
    };
  }, []);

  const sendReadReceipt = useCallback((messageId: string, chatId: string, senderId: string) => {
    if (!socketRef.current || !user?.uid) {
      console.log('❌ Cannot send read receipt: socket or user not ready');
      return;
    }

    const data = {
      messageId,
      chatId,
      readerId: user.uid,
      senderId
    };
    console.log('📤 Sending read receipt:', data);
    socketRef.current.emit('messageRead', data);
  }, [user?.uid]);

  const onMessageReadReceived = useCallback((callback: (data: { messageId?: string; chatId: string; readerId: string; timestamp: string }) => void) => {
    if (!socketRef.current) return () => {};

    const handleReadReceipt = (data: { messageId?: string; chatId: string; readerId: string; timestamp: string }) => {
      console.log('📥 Received read receipt:', data);
      callback(data);
    };

    // Remove any existing listener
    socketRef.current.off('messageRead');
    
    // Add new listener
    socketRef.current.on('messageRead', handleReadReceipt);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('messageRead');
      }
    };
  }, []);

  return {
    sendMessage,
    onMessageReceived,
    sendTypingState,
    stopTyping,
    onTypingStateReceived,
    onStopTypingReceived,
    sendReadReceipt,
    onMessageReadReceived,
    isUserOnline
  };
} 