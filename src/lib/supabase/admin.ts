import "server-only";

import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL) {
  throw new Error("Missing env var: SUPABASE_URL");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing env var: SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * Service-role Supabase client for server-side DB access.
 * Bypasses RLS — never import this in client components.
 * Protected by the "server-only" import above.
 */
export const adminClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
