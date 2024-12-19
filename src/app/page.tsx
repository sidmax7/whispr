'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from './contexts/AuthContext'
import ChatList from '@/components/chat-list'
import ChatWindow from '@/components/chat-window'

export default function Home({ params }: { params: { chatId?: string } }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const chatId = params.chatId

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading || !user) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-1/4 bg-white border-r">
        <ChatList />
      </div>
      <div className="w-3/4">
        {chatId ? (
          <ChatWindow chatId={chatId} />
        ) : (
          <div>Select a chat to start messaging</div>
        )}
      </div>
    </div>
  )
}

