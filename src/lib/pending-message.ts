import type { FileUIPart } from "ai";
import type { AttachmentInput } from "@/lib/api/uploads";

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
}

const store = new Map<string, PendingMessage>();

export function setPendingMessage(chatId: string, message: PendingMessage) {
  store.set(chatId, message);
}

export function takePendingMessage(chatId: string): PendingMessage | undefined {
  const message = store.get(chatId);
  store.delete(chatId);
  return message;
}
