import "server-only";

import { adminClient } from "@/lib/supabase/admin";
import type { Chat } from "./types";

export async function getChatsByUserId(userId: string): Promise<Chat[]> {
  const { data, error } = await adminClient
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data as Chat[];
}

export async function getChatById(
  id: string,
  userId: string,
): Promise<Chat | null> {
  const { data, error } = await adminClient
    .from("chats")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data as Chat;
}

export async function createChat(userId: string, title?: string): Promise<Chat> {
  const { data, error } = await adminClient
    .from("chats")
    .insert({ user_id: userId, title: title ?? null })
    .select()
    .single();

  if (error) throw error;
  return data as Chat;
}

export async function updateChat(
  id: string,
  userId: string,
  fields: Partial<Pick<Chat, "title">>,
): Promise<Chat> {
  const { data, error } = await adminClient
    .from("chats")
    .update(fields)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as Chat;
}

export async function deleteChat(id: string, userId: string): Promise<void> {
  const { error } = await adminClient
    .from("chats")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

/** Delete every chat belonging to a user (cascades to messages/attachments). */
export async function deleteAllChats(userId: string): Promise<void> {
  const { error } = await adminClient
    .from("chats")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}

export interface ChatSearchResult {
  id: string;
  title: string | null;
  updated_at: string;
  snippet: string | null;
}

/** Search chats by title and message content for the given user. */
export async function searchChats(
  userId: string,
  query: string,
): Promise<ChatSearchResult[]> {
  const { data, error } = await adminClient.rpc("search_chats", {
    p_user_id: userId,
    p_query: query,
  });
  if (error) throw error;
  return (data ?? []) as ChatSearchResult[];
}

/** Bump updated_at so the chat floats to the top of the sidebar. */
export async function touchChat(id: string): Promise<void> {
  const { error } = await adminClient
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
