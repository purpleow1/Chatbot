"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Public Supabase client — used only for Realtime Broadcast subscriptions.
 * This is the sole place the anon key is used on the client side.
 */
export const realtimeClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
