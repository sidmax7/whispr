'use client'

import { useState, useEffect } from 'react'
import { collection, query, onSnapshot, where, getDocs, getDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"

interface Chat {
  id: string
  participants: string[]
  lastMessage: string
  time: any
  name: string
}

interface User {
  uid: string
  displayName: string
}

export default function ChatList() {
  const [chats, setChats] = useState<Chat[]>([])
  const [users, setUsers] = useState<User[]>([])
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user) return

    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid))
    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      try {
        const fetchedChats: Chat[] = []
        for (const doc of querySnapshot.docs) {
          const chatData = doc.data() as Chat
          const otherUserId = chatData.participants.find((uid) => uid !== user.uid)
          if (otherUserId) {
            const userDocRef = doc(db, 'users', otherUserId)
            const userDoc = await getDoc(userDocRef)
            if (userDoc.exists()) {
              const userData = userDoc.data() as { displayName: string }
              fetchedChats.push({
                ...chatData,
                id: doc.id,
                name: userData.displayName || 'Unknown User',
              })
            } else {
              console.log('No user found with ID:', otherUserId)
            }
          }
        }
        setChats(fetchedChats)
      } catch (error) {
        console.error('Error fetching chats:', error)
      }
    })

    return () => unsubscribe()
  }, [user])

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return
      try {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('uid', '!=', user.uid))
        const querySnapshot = await getDocs(q)
        const userList = querySnapshot.docs.map((doc) => ({
          ...(doc.data() as User),
          id: doc.id
        }))
        setUsers(userList)
      } catch (error) {
        console.error('Error fetching users:', error)
      }
    }

    fetchUsers()
  }, [user])

  const handleNewChat = async (selectedUser: User) => {
    try {
      if (!user) return
      const newChatRef = await addDoc(collection(db, 'chats'), {
        participants: [user.uid, selectedUser.uid],
        lastMessage: '',
        time: serverTimestamp()
      })
      router.push(`/chats/${newChatRef.id}`)
    } catch (error) {
      console.error('Error creating new chat:', error)
    }
  }

  const handleChatClick = (chatId: string) => {
    router.push(`/chats/${chatId}`)
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Chats</h2>
      {chats.map((chat) => (
        <div
          key={chat.id}
          onClick={() => handleChatClick(chat.id)}
          className="flex items-center space-x-4 mb-4 cursor-pointer hover:bg-gray-100 p-2 rounded"
        >
          <Avatar>
            <AvatarImage src={`https://api.dicebear.com/6.x/initials/svg?seed=${chat.name}`} />
            <AvatarFallback>{chat.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold">{chat.name}</h3>
            <p className="text-sm text-gray-500">{chat.lastMessage}</p>
          </div>
          <span className="text-xs text-gray-400">
            {chat.time?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ))}

      <h3 className="text-xl font-bold mt-8 mb-4">Start a New Chat</h3>
      <div className="grid grid-cols-2 gap-4">
        {users.map((u) => (
          <Button
            key={u.uid}
            onClick={() => handleNewChat(u)}
            variant="outline"
            className="justify-start"
          >
            <Avatar className="w-6 h-6 mr-2">
              <AvatarImage src={`https://api.dicebear.com/6.x/initials/svg?seed=${u.displayName}`} />
              <AvatarFallback>{u.displayName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            {u.displayName}
          </Button>
        ))}
      </div>
    </div>
  )
}

