'use client'

import { User, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { auth } from '@/app/lib/firebase';
import { FirebaseError } from 'firebase/app';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  error: string | null;
}

export function useAuth(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Update online status when user connects
    const userDoc = doc(db, 'users', user.uid);
    updateDoc(userDoc, {
      online: true,
      lastSeen: serverTimestamp()
    });

    // Set up presence system
    const presenceRef = doc(db, 'users', user.uid);
    
    // Handle disconnect
    const onDisconnect = () => {
      updateDoc(presenceRef, {
        online: false,
        lastSeen: serverTimestamp()
      });
    };

    // Listen for window close/reload
    window.addEventListener('beforeunload', onDisconnect);

    return () => {
      window.removeEventListener('beforeunload', onDisconnect);
      // Update status when component unmounts
      onDisconnect();
    };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        setError(error.message);
      }
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        setError(error.message);
      }
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        setError(error.message);
      }
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      setError(null);
      window.location.href = '/';
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        setError(error.message);
      }
      throw error;
    }
  };

  return {
    user,
    loading,
    signOut,
    signIn,
    signUp,
    signInWithGoogle,
    error
  };
}

