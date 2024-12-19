'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChatArea from './components/ChatArea';
import ChatList from './components/ChatList';
import { useAuth } from './hooks/useAuth';

interface Chat {
  id: string;
  users: string[];
  lastMessage?: string;
  timestamp?: string;
}

export default function Home() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isChatListOpen, setIsChatListOpen] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setIsChatListOpen(false); // Close chat list on mobile when chat is selected
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="flex h-screen bg-black">
      {/* Mobile menu button - only shows on mobile */}
      {!isChatListOpen && (
        <button
          onClick={() => setIsChatListOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-50 text-white p-2 rounded-full bg-[#1A1A1A] hover:bg-[#252525]"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Chat list - responsive */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 lg:relative lg:flex
          transform transition-transform duration-300 ease-in-out
          ${isChatListOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <ChatList
          onSelectChat={handleSelectChat}
          selectedChat={selectedChat}
        />
        {/* Close button for mobile */}
        <button
          onClick={() => setIsChatListOpen(false)}
          className="lg:hidden absolute top-2 right-2 text-white p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Overlay for mobile */}
      {isChatListOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsChatListOpen(false)}
        />
      )}

      {/* Chat area */}
      <div className="flex-1 relative">
        <ChatArea 
          selectedChat={selectedChat}
        />
      </div>
    </main>
  );
}

