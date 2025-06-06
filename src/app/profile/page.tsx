'use client'

import { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';
import Image from 'next/image';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { setDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Camera, ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { query, getDocs, where, writeBatch, collection } from 'firebase/firestore';
import { auth } from '../lib/firebase';

interface ChatUser {
  email: string;
  displayName?: string;
}

export default function Profile() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
    }
  }, [user, loading, router]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploading(true);
      const storageRef = ref(storage, `profile-pictures/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setPhotoURL(url);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const updateUserChats = async (newDisplayName: string) => {
    if (!user?.email) return;

    const chatsQuery = query(
      collection(db, 'chats'),
      where('users', 'array-contains', { email: user.email })
    );

    const chatsSnapshot = await getDocs(chatsQuery);
    const batch = writeBatch(db);
    
    chatsSnapshot.docs.forEach((chatDoc) => {
      const chatData = chatDoc.data();
      
      const updatedUsers = chatData.users.map((u: ChatUser) => 
        u.email === user.email ? { ...u, displayName: newDisplayName } : u
      );

      const updatedUserProfiles = {
        ...chatData.userProfiles,
        [user.email as string]: {
          ...chatData.userProfiles[user.email as string],
          displayName: newDisplayName
        }
      };

      batch.update(chatDoc.ref, {
        users: updatedUsers,
        userProfiles: updatedUserProfiles
      });
    });

    await batch.commit();
  };

  const handleProfileUpdate = async (newDisplayName: string) => {
    try {
      // Update user profile in auth
      await updateProfile(auth.currentUser!, {
        displayName: newDisplayName
      });

      // Update user document in Firestore
      const userRef = doc(db, 'users', user!.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName
      });

      // Update all chats containing this user
      await updateUserChats(newDisplayName);

      // ... rest of your profile update logic
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setIsSaving(true);
      await handleProfileUpdate(displayName);
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      router.push('/dashboard');
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 flex items-center justify-center">
      <Card className="w-full max-w-md bg-zinc-900 border-zinc-800">
        <CardHeader className="relative">
          <Button 
            variant="ghost" 
            size="icon"
            className="absolute left-4 top-4"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <CardTitle className="text-center">Profile Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-zinc-800">
                  {photoURL ? (
                    <Image
                      src={user?.photoURL || ''}
                      alt="Profile"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-400">
                      {displayName ? displayName[0].toUpperCase() : user.email?.[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 cursor-pointer">
                  <div className="bg-zinc-800 p-2 rounded-full hover:bg-zinc-700 transition-colors duration-200">
                    <Camera className="w-5 h-5" />
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </div>
            {isUploading && (
              <p className="text-blue-400 text-center mt-2">Uploading image...</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
                placeholder="Enter your display name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                id="email"
                value={user.email || ''}
                disabled
                className="bg-zinc-800 border-zinc-700 opacity-60"
              />
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-end space-x-4">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            onClick={handleSubmit}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

