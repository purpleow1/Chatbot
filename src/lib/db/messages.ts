import "server-only";

import { adminClient } from "@/lib/supabase/admin";
import type { Message, MessagePart, MessageRole } from "./types";

export async function getMessagesByChatId(chatId: string): Promise<Message[]> {
  const { data, error } = await adminClient
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Message[];
}

export async function createMessage(fields: {
  chatId: string;
  role: MessageRole;
  parts: MessagePart[];
}): Promise<Message> {
  const { data, error } = await adminClient
    .from("messages")
    .insert({
      chat_id: fields.chatId,
      role: fields.role,
      parts: fields.parts,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

export async function createMessages(
  rows: { chatId: string; role: MessageRole; parts: MessagePart[] }[],
): Promise<Message[]> {
  const { data, error } = await adminClient
    .from("messages")
    .insert(
      rows.map((r) => ({ chat_id: r.chatId, role: r.role, parts: r.parts })),
    )
    .select();

  if (error) throw error;
  return data as Message[];
}
