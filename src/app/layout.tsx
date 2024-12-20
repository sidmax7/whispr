import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Whispr',
  description: 'A messaging app from the new generation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <title>Whispr</title>
      </head>
      <body className={`${inter.className} bg-black text-white`}>{children}</body>
    </html>
  )
}

