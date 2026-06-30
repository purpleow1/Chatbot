import "server-only";

import { adminClient } from "@/lib/supabase/admin";
import type { Attachment } from "./types";

export async function createAttachment(fields: {
  messageId: string;
  chatId: string;
  userId: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<Attachment> {
  const { data, error } = await adminClient
    .from("attachments")
    .insert({
      message_id: fields.messageId,
      chat_id: fields.chatId,
      user_id: fields.userId,
      storage_path: fields.storagePath,
      mime_type: fields.mimeType,
      size_bytes: fields.sizeBytes,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Attachment;
}

export async function getAttachmentsByMessageId(
  messageId: string,
): Promise<Attachment[]> {
  const { data, error } = await adminClient
    .from("attachments")
    .select("*")
    .eq("message_id", messageId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Attachment[];
}

export async function getAttachmentsByChatId(
  chatId: string,
): Promise<Attachment[]> {
  const { data, error } = await adminClient
    .from("attachments")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Attachment[];
}

export async function deleteAttachment(
  id: string,
  userId: string,
): Promise<string> {
  const { data, error } = await adminClient
    .from("attachments")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("storage_path")
    .single();

  if (error) throw error;
  return (data as { storage_path: string }).storage_path;
}
