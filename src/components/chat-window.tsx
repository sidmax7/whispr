'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore'
import { db } from '@/app/lib/firebase'
import { useAuth } from '@/app/contexts/AuthContext'

interface Message {
  id: string
  sender: string
  content: string
  timestamp: any
}

export default function ChatWindow({ chatId }: { chatId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const { user } = useAuth()

  useEffect(() => {
    if (!chatId) return

    const messagesRef = collection(db, 'chats', chatId, 'messages')
    const q = query(messagesRef, orderBy('timestamp', 'asc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = []
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as Message)
      })
      setMessages(fetchedMessages)
    })

    return () => unsubscribe()
  }, [chatId])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newMessage.trim() === '') return

    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages')
      await addDoc(messagesRef, {
        sender: user?.uid,
        content: newMessage,
        timestamp: serverTimestamp(),
      })
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  return (
    <div>
      <div>
        {messages.map((message) => (
          <div key={message.id}>
            <p>{message.content}</p>
            <span>{message.sender === user?.uid ? 'You' : 'Other'}</span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  )
}

