import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync, savePushToken } from '@/lib/notifications';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// Важно за Android OAuth
WebBrowser.maybeCompleteAuthSession();

type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: 'admin' | 'client';
  created_by_admin: boolean;
  phone_verified: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  needsPhoneVerification: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithFacebook: () => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any; userId: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPhoneVerification, setNeedsPhoneVerification] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Обработка на OAuth redirect URL-и
    const handleUrl = async (event: { url: string }) => {
      // Проверяваме дали това е OAuth redirect
      if (event.url.includes('#access_token=') || event.url.includes('?code=')) {
        // Supabase автоматично ще обработи URL-а през onAuthStateChange
        // но трябва да го "подадем" на auth системата
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Error processing OAuth redirect:', error);
        }
      }
    };

    // Слушаме за URL events на мобилни устройства
    const urlSubscription = Linking.addEventListener('url', handleUrl);

    // Проверяваме дали приложението е отворено с URL (за initial load)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    });

    return () => {
      subscription.unsubscribe();
      urlSubscription.remove();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    setLoading(true);
    try {
      let retries = 3;
      let data = null;
      let error = null;

      while (retries > 0 && !data) {
        const result = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        data = result.data;
        error = result.error;

        if (!data && retries > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
          retries--;
        } else {
          break;
        }
      }

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      if (data) {
        setProfile(data);

        const isClient = data.role === 'client';
        const hasNoPhone = !data.phone || data.phone === '';
        const phoneNotVerified = data.phone_verified !== true;

        // ВСЕКИ клиент трябва да има верифициран телефон
        const needsPhone = isClient && (hasNoPhone || phoneNotVerified);
        setNeedsPhoneVerification(needsPhone);

        const pushToken = await registerForPushNotificationsAsync();
        if (pushToken && userId) {
          await savePushToken(userId, pushToken);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    try {
      // Получаваме правилния redirect URL за платформата
      const redirectUrl = Platform.OS === 'web'
        ? window.location.origin
        : Linking.createURL('/');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // На мобилни ще отворим браузъра ръчно
          queryParams: {
            prompt: 'select_account', // Винаги показва избор на акаунт
          },
        },
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        return { error };
      }

      // На мобилни устройства отваряме браузъра ръчно
      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        // Ако браузърът върна URL с token (success)
        if (result.type === 'success' && result.url) {
          // Извличаме token/code от URL-а
          const url = new URL(result.url);
          const params = new URLSearchParams(url.hash.substring(1) || url.search);

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('❌ Error setting session:', sessionError);
              return { error: sessionError };
            }
          }
        } else if (result.type === 'cancel') {
          return { error: new Error('User cancelled') };
        }
      }

      return { error: null };
    } catch (error) {
      console.error('💥 Google Sign-In exception:', error);
      return { error };
    }
  };

  const signInWithFacebook = async () => {
    try {
      // Получаваме правилния redirect URL за платформата
      const redirectUrl = Platform.OS === 'web'
        ? window.location.origin
        : Linking.createURL('/');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // На мобилни ще отворим браузъра ръчно
          queryParams: {
            prompt: 'select_account', // Винаги показва избор на акаунт
          },
        },
      });

      if (error) {
        console.error('❌ Facebook OAuth error:', error);
        return { error };
      }

      // На мобилни устройства отваряме браузъра ръчно
      if (Platform.OS !== 'web' && data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        // Ако браузърът върна URL с token (success)
        if (result.type === 'success' && result.url) {
          // Извличаме token/code от URL-а
          const url = new URL(result.url);
          const params = new URLSearchParams(url.hash.substring(1) || url.search);

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) {
              console.error('❌ Error setting session:', sessionError);
              return { error: sessionError };
            }
          }
        } else if (result.type === 'cancel') {
          return { error: new Error('User cancelled') };
        }
      }

      return { error: null };
    } catch (error) {
      console.error('💥 Facebook Sign-In exception:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error && data.user) {
      return { error: null, userId: data.user.id };
    }

    return { error, userId: null };
  };

  const signOut = async () => {
    setProfile(null);
    setUser(null);
    setSession(null);
    setNeedsPhoneVerification(false);
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        needsPhoneVerification,
        signIn,
        signInWithGoogle,
        signInWithFacebook,
        signUp,
        signOut,
        refreshProfile,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
