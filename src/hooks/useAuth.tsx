import { useState, useEffect, createContext, useContext } from 'react';
import { LocalSession, LocalSessionInfo, LocalUser, supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: LocalUser | null;
  session: LocalSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signUp: (email: string, password: string) => Promise<{ error: unknown }>;
  signOut: () => Promise<void>;
  localSignOut: () => void;
  clearSession: () => void;
  signOutAll: () => Promise<{ error: Error | null }>;
  refreshUser: () => Promise<{ user: LocalUser | null; error: Error | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  resetPassword: (payload: { token: string; password: string }) => Promise<{ error: Error | null }>;
  changePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<{ error: Error | null }>;
  changeEmail: (payload: { password: string; newEmail: string }) => Promise<{ error: Error | null }>;
  confirmEmail: (token: string) => Promise<{ error: Error | null }>;
  listSessions: () => Promise<{ data: LocalSessionInfo[] | null; error: Error | null }>;
  deleteAccount: (password: string) => Promise<{ error: Error | null }>;
  resendConfirmation: (email?: string) => Promise<{ error: Error | null }>;
  refreshSession: () => Promise<{ session: LocalSession | null; error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const localSignOut = () => {
    supabase.auth.localSignOut();
  };

  const clearSession = () => {
    supabase.auth.clearSession();
  };

  const signOutAll = async () => {
    return await supabase.auth.signOutAll();
  };

  const refreshUser = async () => {
    const result = await supabase.auth.refreshUser();
    if (result.user) {
      setUser(result.user);
    }
    return result;
  };

  const resetPasswordForEmail = async (email: string) => {
    return await supabase.auth.resetPasswordForEmail(email);
  };

  const resetPassword = async (payload: { token: string; password: string }) => {
    return await supabase.auth.resetPassword(payload);
  };

  const changePassword = async (payload: { currentPassword: string; newPassword: string }) => {
    return await supabase.auth.changePassword(payload);
  };

  const changeEmail = async (payload: { password: string; newEmail: string }) => {
    return await supabase.auth.changeEmail(payload);
  };

  const confirmEmail = async (token: string) => {
    const res = await supabase.auth.confirmEmail(token);
    if (!res.error) {
      await refreshUser();
    }
    return res;
  };

  const listSessions = async () => {
    return await supabase.auth.listSessions();
  };

  const deleteAccount = async (password: string) => {
    return await supabase.auth.deleteAccount(password);
  };

  const resendConfirmation = async (email?: string) => {
    return await supabase.auth.resendConfirmation(email);
  };

  const refreshSession = async () => {
    const res = await supabase.auth.refreshSession();
    if (res.data?.session) {
      setSession(res.data.session);
      setUser(res.data.session.user);
    }
    return { session: res.data?.session ?? null, error: res.error };
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    localSignOut,
    clearSession,
    signOutAll,
    refreshUser,
    refreshSession,
    resetPasswordForEmail,
    resetPassword,
    changePassword,
    changeEmail,
    confirmEmail,
    listSessions,
    deleteAccount,
    resendConfirmation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
