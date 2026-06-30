import "server-only";

import { cache } from "react";
import { createAuthClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type AuthUser = User;

/**
 * Returns the authenticated Supabase user from the session cookie,
 * or null if there is no valid session.
 *
 * Memoized with React cache() so multiple calls within a single
 * request render pass only hit Supabase once.
 *
 * Use this in API route handlers to identify the caller.
 */
export const getUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

/**
 * Convenience wrapper for route handlers that require authentication.
 * Returns { user } on success, or a 401 Response to return early.
 *
 * Usage:
 *   const result = await requireAuth();
 *   if (result instanceof Response) return result;
 *   const { user } = result;
 */
export async function requireAuth(): Promise<{ user: AuthUser } | Response> {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user };
}
