import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import type { ManagerProfile } from '../types/game';
import { DEMO_PROFILE, DEMO_USER_UID, isAutostartDemo } from '../utils/demoLeagueState';

interface AuthContextValue {
  user: User | null;
  profile: ManagerProfile | null;
  suggestedName: string;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (p: ManagerProfile | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [suggestedName, setSuggestedName] = useState('');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncWithBackend = useCallback(async (firebaseUser: User) => {
    try {
      const data = await apiFetch<{
        profile: ManagerProfile | null;
        suggestedName?: string;
      }>('/api/auth/sync', { method: 'POST' });
      setProfile(data.profile);
      setSuggestedName(data.suggestedName || firebaseUser.displayName || '');
      setAuthError(null);
    } catch (err: any) {
      console.error('Backend auth sync failed:', err);
      setAuthError(err.message || 'Unable to reach game server.');
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      if (nextUser) {
        setUser(nextUser);
        await syncWithBackend(nextUser);
      } else if (isAutostartDemo()) {
        setUser({
          uid: DEMO_USER_UID,
          email: 'gaffer@yorkshire-cm27.local',
          displayName: 'L.FM',
        } as unknown as User);
        setProfile(DEMO_PROFILE);
        setSuggestedName('L.FM');
      } else {
        setUser(null);
        setProfile(null);
        setSuggestedName('');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [syncWithBackend]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        setAuthError(err?.message || 'Sign-in failed. Please try again.');
      }
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      await syncWithBackend(auth.currentUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        suggestedName,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        refreshProfile,
        setProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
