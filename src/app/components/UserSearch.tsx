import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/hooks/useAuth';

interface UserSearchProps {
  searchQuery: string;
  onSelectUser: (email: string) => void;
  onClose: () => void;
}

export default function UserSearch({ searchQuery, onSelectUser, onClose }: UserSearchProps) {
  const [users, setUsers] = useState<{ email: string }[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 3) return;
      
      const q = query(
        collection(db, 'users'),
        where('email', '>=', searchQuery),
        where('email', '<=', searchQuery + '\uf8ff')
      );

      const snapshot = await getDocs(q);
      const searchResults = snapshot.docs
        .map(doc => ({ email: doc.data().email }))
        .filter(u => u.email !== user?.email);
      
      setUsers(searchResults);
    };

    searchUsers();
  }, [searchQuery, user?.email]);

  return (
    <div className="absolute top-full left-0 right-0 bg-black border border-[#1A1A1A] rounded-lg mt-2 shadow-lg">
      {users.map((user) => (
        <div
          key={user.email}
          className="px-4 py-3 hover:bg-[#1A1A1A] cursor-pointer flex items-center space-x-3"
          onClick={() => {
            onSelectUser(user.email);
            onClose();
          }}
        >
          <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center">
            <span className="text-white">
              {user.email && user.email[0].toUpperCase()}
            </span>
          </div>
          <span className="text-white">{user.email}</span>
        </div>
      ))}
      {users.length === 0 && searchQuery.length >= 3 && (
        <div className="px-4 py-3 text-gray-500">No users found</div>
      )}
      {searchQuery.length < 3 && (
        <div className="px-4 py-3 text-gray-500">Type at least 3 characters to search</div>
      )}
    </div>
  );
} 