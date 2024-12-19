'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '@/app/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      router.push('/')
    } catch (error) {
      console.error('Authentication error:', error)
      // Here you would typically show an error message to the user
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Store user information in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: displayName,
        email: user.email,
      })

      console.log('User signed up successfully:', user)
      router.push('/')
    } catch (error) {
      console.error('Error signing up:', error)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>{isSignUp ? 'Sign Up' : 'Login'}</CardTitle>
          <CardDescription>Enter your details to {isSignUp ? 'create an account' : 'login'}</CardDescription>
        </CardHeader>
        <form onSubmit={isSignUp ? handleSignup : handleAuth}>
          <CardContent>
            <div className="grid w-full items-center gap-4">
              {isSignUp && (
                <div className="flex flex-col space-y-1.5">
                  <Input
                    id="displayName"
                    placeholder="Display Name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div className="flex flex-col space-y-1.5">
                <Input
                  id="email"
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Input
                  id="password"
                  placeholder="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col">
            <Button className="w-full" type="submit">
              {isSignUp ? 'Sign Up' : 'Login'}
            </Button>
            <Button
              className="w-full mt-2"
              variant="outline"
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

