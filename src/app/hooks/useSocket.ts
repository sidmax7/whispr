import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

const SOCKET_URL = 'http://localhost:4000';

export interface Message {
  senderId: string;
  text: string;
  chatId: string;
  timestamp: Date;
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid) {
      // Initialize socket connection
      console.log('Initializing socket connection...');
      socketRef.current = io(SOCKET_URL);

      socketRef.current.on('connect', () => {
        console.log('Socket connected!');
        // Add user to connected users list
        socketRef.current?.emit('addUser', user.uid);
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      socketRef.current.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      return () => {
        if (socketRef.current) {
          console.log('Disconnecting socket...');
          socketRef.current.disconnect();
        }
      };
    }
  }, [user?.uid]);

  const sendMessage = useCallback((receiverId: string, text: string, chatId: string) => {
    if (socketRef.current && user?.uid) {
      console.log('Sending message:', { receiverId, text, chatId });
      socketRef.current.emit('sendMessage', {
        senderId: user.uid,
        receiverId,
        text,
        chatId,
        timestamp: new Date().toISOString()
      });
    } else {
      console.warn('Socket not connected or user not authenticated');
    }
  }, [user?.uid]);

  const onMessageReceived = useCallback((callback: (message: Message) => void) => {
    if (socketRef.current) {
      console.log('Setting up message listener');
      socketRef.current.on('getMessage', (message: Message) => {
        console.log('Received message through socket:', message);
        callback(message);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('getMessage');
      }
    };
  }, []);

  const sendTypingState = useCallback((receiverId: string, chatId: string, text: string) => {
    if (socketRef.current && user?.uid) {
      console.log('Sending typing state:', { receiverId, chatId, text });
      socketRef.current.emit('typing', {
        senderId: user.uid,
        receiverId,
        chatId,
        text
      });
    }
  }, [user?.uid]);

  const stopTyping = useCallback((receiverId: string, chatId: string) => {
    if (socketRef.current && user?.uid) {
      console.log('Sending stop typing:', { receiverId, chatId });
      socketRef.current.emit('stopTyping', {
        senderId: user.uid,
        receiverId,
        chatId
      });
    }
  }, [user?.uid]);

  const onTypingStateReceived = useCallback((callback: (data: { senderId: string; chatId: string; text: string }) => void) => {
    if (socketRef.current) {
      console.log('Setting up typing state listener');
      socketRef.current.on('userTyping', (data) => {
        console.log('Received typing state:', data);
        callback(data);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('userTyping');
      }
    };
  }, []);

  const onStopTypingReceived = useCallback((callback: (data: { senderId: string; chatId: string }) => void) => {
    if (socketRef.current) {
      console.log('Setting up stop typing listener');
      socketRef.current.on('userStopTyping', (data) => {
        console.log('Received stop typing:', data);
        callback(data);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('userStopTyping');
      }
    };
  }, []);

  return {
    sendMessage,
    onMessageReceived,
    sendTypingState,
    stopTyping,
    onTypingStateReceived,
    onStopTypingReceived
  };
} 