import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { message } = await request.json()
  
  // Simulate a delay
  await new Promise(resolve => setTimeout(resolve, 500))

  // Echo the message back
  return NextResponse.json({ 
    id: Date.now(),
    text: message,
    sender: 'them',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  })
}

