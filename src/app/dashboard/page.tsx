'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import ChatArea from '../components/ChatArea';
import ChatList from '../components/ChatList';
import { Chat } from '../types/chat';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isChatListOpen, setIsChatListOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="flex h-screen bg-[#2C2A42] overflow-hidden">
      {/* Hamburger Menu Button */}
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

      {/* Chat List with Slide Animation */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-80 lg:w-80 lg:relative lg:flex
          transform transition-transform duration-300 ease-in-out
          ${isChatListOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <ChatList 
          onSelectChat={(chat) => {
            setSelectedChat(chat);
            setIsChatListOpen(false);
          }}
          selectedChat={selectedChat}
          onClose={() => setIsChatListOpen(false)}
        />
      </div>

      {/* Overlay for Mobile */}
      {isChatListOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsChatListOpen(false)}
        />
      )}

      {/* Chat Area */}
      <div className="flex-1 relative overflow-hidden">
        <ChatArea 
          selectedChat={selectedChat}
          onOpenChatList={() => setIsChatListOpen(true)}
        />
      </div>
    </main>
  );
} 