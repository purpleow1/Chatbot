"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Used only for auth operations in client components
 * (signIn, signUp, signOut, signInAnonymously, signInWithOAuth).
 * Never use this for database queries — use API routes + service client instead.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
