import "server-only";

import { adminClient } from "@/lib/supabase/admin";
import type { Usage } from "./types";

export async function getUsage(userId: string): Promise<Usage | null> {
  const { data, error } = await adminClient
    .from("usages")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as Usage;
}

/**
 * Atomically increments the anonymous message count.
 * Creates the usage row if it doesn't exist yet (upsert).
 * Returns the updated row.
 */
export async function incrementAnonCount(userId: string): Promise<Usage> {
  // Use upsert + raw increment via RPC to avoid a race condition.
  const { data, error } = await adminClient.rpc("increment_anon_count", {
    p_user_id: userId,
  });

  if (error) throw error;
  return data as Usage;
}

export async function getAnonMessageCount(userId: string): Promise<number> {
  const usage = await getUsage(userId);
  return usage?.anon_message_count ?? 0;
}
