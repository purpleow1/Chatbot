"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Provides the current Supabase user to the component tree.
 * On first visit (no session), automatically signs the user in anonymously
 * so every visitor gets a persistent identity and chat history from the start.
 *
 * Note: Supabase docs warn that anonymous users cached by Next.js static
 * rendering can bleed across users. This provider runs client-side only,
 * which avoids that issue.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const signInAnonymously = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("[AuthProvider] anonymous sign-in failed:", error.message);
    }
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    // Get the initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setIsLoading(false);
      } else {
        // No session → create an anonymous one
        signInAnonymously().finally(() => setIsLoading(false));
      }
    });

    // Keep user state in sync with auth events (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [signInAnonymously]);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
