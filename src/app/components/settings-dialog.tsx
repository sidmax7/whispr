'use client'

import { LogOut, Settings, User } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/hooks/useAuth'
import Link from 'next/link'

export function SettingsDialog() {
  const router = useRouter()
  const { signOut } = useAuth()

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="p-2 rounded-full hover:bg-[#2A2640] transition-colors text-gray-400 hover:text-white"
          title="Settings"
        >
          <Settings className="w-6 h-6" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-[#252436] text-white border-[#2A2640]">
        <DialogTitle className="text-lg font-medium mb-4">Settings</DialogTitle>
        <div className="flex flex-col gap-4">
          <Link
            href="/profile"
            className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-[#2A2640] transition-colors text-white"
          >
            <User className="w-5 h-5" />
            <span>Profile</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 p-3 rounded-lg hover:bg-[#2A2640] transition-colors text-red-500 hover:text-red-400"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
