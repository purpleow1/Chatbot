import type { FileUIPart } from "ai";
import type { AttachmentInput } from "@/lib/api/uploads";
import type { DocumentAttachmentInput } from "@/lib/api/documents";

/**
 * A composed-but-not-yet-sent message, handed off between the home screen
 * (where a new chat is created) and the conversation view (which auto-sends it
 * once mounted). Kept in a module-level map so it survives client-side
 * navigation without a round-trip or URL params.
 */
export interface PendingMessage {
  text: string;
  files: FileUIPart[];
  attachments: AttachmentInput[];
  documents?: DocumentAttachmentInput[];
}

const store = new Map<string, PendingMessage>();
/** Tracks chats whose pending message was already dispatched (Strict Mode safe). */
const sentChats = new Set<string>();

export function setPendingMessage(chatId: string, message: PendingMessage) {
  store.set(chatId, message);
}

/** Read a pending message without removing it (safe under React Strict Mode). */
export function peekPendingMessage(chatId: string): PendingMessage | undefined {
  return store.get(chatId);
}

export function takePendingMessage(chatId: string): PendingMessage | undefined {
  const message = store.get(chatId);
  store.delete(chatId);
  return message;
}

export function wasPendingMessageSent(chatId: string): boolean {
  return sentChats.has(chatId);
}

export function markPendingMessageSent(chatId: string) {
  sentChats.add(chatId);
}
