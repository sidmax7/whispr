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
      console.log('Initializing socket connection for user:', user.uid);
      socketRef.current = io(SOCKET_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        query: { userId: user.uid }
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected! User ID:', user.uid, 'Socket ID:', socketRef.current?.id);
        // Add user to connected users list
        socketRef.current?.emit('addUser', user.uid, (response: any) => {
          console.log('Server response to addUser:', response);
        });
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message, error);
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('Socket disconnected. User ID:', user.uid, 'Reason:', reason);
      });

      // Set up core event listeners immediately
      socketRef.current.on('typing', (data: { senderId: string; chatId: string; text: string }) => {
        console.log('Raw typing event received for user', user.uid, ':', data);
      });

      socketRef.current.on('stop-typing', (data: { senderId: string; chatId: string }) => {
        console.log('Raw stop typing event received for user', user.uid, ':', data);
      });

      socketRef.current.on('getMessage', (message: Message) => {
        console.log('Raw message received for user', user.uid, ':', message);
      });

      // Debug all events
      socketRef.current.onAny((eventName, ...args) => {
        console.log('Socket Event for user', user.uid, '-', eventName, 'Data:', args);
      });

      return () => {
        console.log('Cleaning up socket connection for user:', user.uid);
        if (socketRef.current) {
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
          socketRef.current = null;
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
    if (!socketRef.current) {
      console.warn('Cannot send typing state: Socket not connected');
      return;
    }
    if (!user?.uid) {
      console.warn('Cannot send typing state: User not authenticated');
      return;
    }

    const data = {
      senderId: user.uid,
      receiverId,
      chatId,
      text
    };
    console.log('Emitting typing state:', data);
    socketRef.current.emit('typing', data, (error: any) => {
      if (error) {
        console.error('Error sending typing state:', error);
      } else {
        console.log('Typing state sent successfully');
      }
    });
  }, [user?.uid]);

  const stopTyping = useCallback((receiverId: string, chatId: string) => {
    if (!socketRef.current) {
      console.warn('Cannot send stop typing: Socket not connected');
      return;
    }
    if (!user?.uid) {
      console.warn('Cannot send stop typing: User not authenticated');
      return;
    }

    const data = {
      senderId: user.uid,
      receiverId,
      chatId
    };
    console.log('Emitting stop typing:', data);
    socketRef.current.emit('stop-typing', data, (error: any) => {
      if (error) {
        console.error('Error sending stop typing:', error);
      } else {
        console.log('Stop typing sent successfully');
      }
    });
  }, [user?.uid]);

  const onTypingStateReceived = useCallback((callback: (data: { senderId: string; chatId: string; text: string }) => void) => {
    if (!socketRef.current) {
      console.warn('Cannot listen for typing: Socket not connected');
      return () => {};
    }

    console.log('Setting up typing state listener');
    const handleTyping = (data: { senderId: string; chatId: string; text: string }) => {
      console.log('Typing callback triggered with data:', data);
      callback(data);
    };

    // Remove any existing listeners to prevent duplicates
    socketRef.current.off('typing');
    socketRef.current.on('typing', handleTyping);

    return () => {
      console.log('Removing typing state listener');
      socketRef.current?.off('typing', handleTyping);
    };
  }, []);

  const onStopTypingReceived = useCallback((callback: (data: { senderId: string; chatId: string }) => void) => {
    if (!socketRef.current) {
      console.warn('Cannot listen for stop typing: Socket not connected');
      return () => {};
    }

    console.log('Setting up stop typing listener');
    const handleStopTyping = (data: { senderId: string; chatId: string }) => {
      console.log('Stop typing callback triggered with data:', data);
      callback(data);
    };

    // Remove any existing listeners to prevent duplicates
    socketRef.current.off('stop-typing');
    socketRef.current.on('stop-typing', handleStopTyping);

    return () => {
      console.log('Removing stop typing listener');
      socketRef.current?.off('stop-typing', handleStopTyping);
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