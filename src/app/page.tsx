'use client'

import { useState } from "react"
import { useRouter } from 'next/navigation'
import Image from "next/image"
import { Eye, EyeOff} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from "@/app/hooks/useAuth"
import { toast } from "sonner"
import { setDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from "@/app/lib/firebase"
import { FirebaseError } from 'firebase/app'

export default function WelcomePage() {
  const router = useRouter()
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [showLoginForm, setShowLoginForm] = useState(false)
  const [showSignUpForm, setShowSignUpForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form data
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [signUpEmail, setSignUpEmail] = useState("")
  const [signUpPassword, setSignUpPassword] = useState("")
  const [username, setUsername] = useState("")

  const resetForms = () => {
    setShowLoginForm(false)
    setShowSignUpForm(false)
    setLoginEmail("")
    setLoginPassword("")
    setSignUpEmail("")
    setSignUpPassword("")
    setUsername("")
    setLoading(false)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await signIn(loginEmail, loginPassword)
      router.push('/dashboard')
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        toast.error(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      // Sign up the user first
      const userCredential = await signUp(signUpEmail, signUpPassword)
      
      // Create the user document in Firestore
      
      await setDoc(doc(db, 'users', userCredential.uid), {
        createdAt: serverTimestamp(),
        displayName: username,
        email: signUpEmail,
        lastMessage: "",
        lastSeen: serverTimestamp(),
        messages: [],
        photoURL: userCredential.photoURL || "",
        status: "online",
        timestamp: serverTimestamp(),
        uid: userCredential.uid,
        updatedAt: serverTimestamp()
      })

      router.push('/dashboard')
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        toast.error(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    
    try {
      await signInWithGoogle()
      router.push('/dashboard')
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        toast.error(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#2C2A42] p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Back Button */}
      <Button
        onClick={resetForms}
        variant="ghost"
        className={`absolute top-4 left-4 text-white hover:text-gray-200 hover:bg-[#1A1B2D] transition-opacity duration-300 ${
          showLoginForm || showSignUpForm 
            ? 'opacity-100 visible' 
            : 'opacity-0 invisible'
        }`}
      >
        Back
      </Button>

      <div className="w-full max-w-[320px] sm:max-w-[380px] md:max-w-[440px] flex flex-col items-center gap-6 sm:gap-8 lg:gap-10">
        {/* Ghost Logo */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 flex items-center justify-center">
          <Image 
            src="/assets/pirate.svg" 
            alt="Ghost Logo" 
            width={96} 
            height={96}
            className="w-full h-full"
            priority
          />
        </div>

        {/* Welcome Text */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight whitespace-nowrap">
            {showLoginForm ? "Welcome Back" : showSignUpForm ? "Join Whispr" : "Welcome To Whispr"}
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            small talk, big connections
          </p>
        </div>

        {/* Initial Buttons */}
        <div className={`w-full space-y-4 transition-opacity duration-300 ${
          showLoginForm || showSignUpForm 
            ? 'opacity-0 invisible absolute' 
            : 'opacity-100 visible'
        }`}>
          <Button 
            onClick={() => setShowLoginForm(true)}
            className="w-full h-12 rounded-full bg-white text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Log In
          </Button>
          
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 bg-[#2C2A42] text-sm text-gray-400">OR</span>
            </div>
          </div>

          <Button
            onClick={() => setShowSignUpForm(true)}
            className="w-full h-12 rounded-full bg-[#1A1B2D] text-white hover:bg-[#232435] transition-colors"
          >
            Sign Up
          </Button>
        </div>

        {/* Login Form */}
        <form 
          onSubmit={handleLogin}
          className={`w-full space-y-4 transition-opacity duration-300 ${
            showLoginForm 
              ? 'opacity-100 visible' 
              : 'opacity-0 invisible absolute'
          }`}
        >
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="h-12 rounded-full bg-white border-0 focus-visible:ring-2 focus-visible:ring-gray-500 placeholder:text-gray-400 text-gray-900"
              required
            />
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="h-12 rounded-full bg-white border-0 pr-10 focus-visible:ring-2 focus-visible:ring-gray-500 placeholder:text-gray-400 text-gray-900"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <div className="flex justify-end">
              <button 
                type="button"
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 rounded-full bg-white text-gray-900 hover:bg-gray-100 transition-colors"
            disabled={loading}
          >
            {loading ? "Loading..." : "Log In"}
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 bg-[#2C2A42] text-sm text-gray-400">OR</span>
            </div>
          </div>

          <Button 
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            variant="outline" 
            className="w-full h-12 rounded-full bg-white text-gray-900 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            <Image
              src="/assets/google.svg"
              alt="Google"
              width={20}
              height={20}
            />
            {loading ? "Loading..." : "Login with Google"}
          </Button>
        </form>

        {/* Sign Up Form */}
        <form 
          onSubmit={handleSignUp}
          className={`w-full space-y-4 transition-opacity duration-300 ${
            showSignUpForm 
              ? 'opacity-100 visible' 
              : 'opacity-0 invisible absolute'
          }`}
        >
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 rounded-full bg-white border-0 focus-visible:ring-2 focus-visible:ring-gray-500 placeholder:text-gray-400 text-gray-900"
              required
            />
            <Input
              type="email"
              placeholder="Email address"
              value={signUpEmail}
              onChange={(e) => setSignUpEmail(e.target.value)}
              className="h-12 rounded-full bg-white border-0 focus-visible:ring-2 focus-visible:ring-gray-500 placeholder:text-gray-400 text-gray-900"
              required
            />
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                className="h-12 rounded-full bg-white border-0 pr-10 focus-visible:ring-2 focus-visible:ring-gray-500 placeholder:text-gray-400 text-gray-900"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 rounded-full bg-white text-gray-900 hover:bg-gray-100 transition-colors"
            disabled={loading}
          >
            {loading ? "Loading..." : "Sign Up"}
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 bg-[#2C2A42] text-sm text-gray-400">OR</span>
            </div>
          </div>

          <Button 
            type="button"
            variant="outline" 
            className="w-full h-12 rounded-full bg-white text-gray-900 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
          >
            <Image
              src="/assets/google.svg"
              alt="Google"
              width={20}
              height={20}
            />
            Sign up with Google
          </Button>
        </form>
      </div>
    </div>
  )
}

