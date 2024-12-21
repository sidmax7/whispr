'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChatArea from './components/ChatArea';
import ChatList from './components/ChatList';
import { useAuth } from './hooks/useAuth';
import { Chat } from './types/chat';

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
    <main className="flex h-screen bg-black overflow-hidden">
      {!isChatListOpen && (
        <button
          onClick={() => setIsChatListOpen(true)}
          className="lg:hidden fixed top-4 left-4 z-50 text-white p-2 rounded-full bg-[#1A1A1A] hover:bg-[#252525]"
          aria-label="Open chat list"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-80 lg:w-80 lg:relative lg:flex
          transform transition-transform duration-300 ease-in-out
          ${isChatListOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <ChatList
          onSelectChat={handleSelectChat}
          selectedChat={selectedChat}
          onClose={() => setIsChatListOpen(false)}
        />
      </div>

      {isChatListOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsChatListOpen(false)}
        />
      )}

      <div className="flex-1 relative overflow-hidden">
        <ChatArea 
          selectedChat={selectedChat}
          onOpenChatList={() => setIsChatListOpen(true)}
        />
      </div>
    </main>
  );
}

