import ChatWindow from '@/components/chat-window'

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const chatId = params.chatId

  return <ChatWindow chatId={chatId} />
} 