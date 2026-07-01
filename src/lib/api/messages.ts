import type { UIMessage } from "ai";
import type { Message } from "@/lib/db/types";

export const messageKeys = {
  all: ["messages"] as const,
  list: (chatId: string) => [...messageKeys.all, chatId] as const,
};

export async function fetchMessages(chatId: string): Promise<Message[]> {
  const res = await fetch(`/api/chats/${chatId}/messages`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

/**
 * Maps a stored DB message into an AI SDK `UIMessage` so `useChat` can
 * hydrate a conversation from history. Only text parts are supported in
 * Phase 5; image/file parts arrive in Phase 7.
 */
export function toUIMessage(message: Message): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts
      .filter((p) => p.type === "text")
      .map((p) => ({ type: "text" as const, text: (p as { text: string }).text })),
  };
}
