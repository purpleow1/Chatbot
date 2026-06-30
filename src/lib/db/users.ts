import "server-only";

import { adminClient } from "@/lib/supabase/admin";
import type { User } from "./types";

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await adminClient
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw error;
  }

  return data as User;
}

export async function updateUser(
  id: string,
  fields: Partial<Pick<User, "name" | "avatar_url">>,
): Promise<User> {
  const { data, error } = await adminClient
    .from("users")
    .update(fields)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as User;
}
