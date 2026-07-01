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
 * hydrate a conversation from history.
 *
 * Text and file (image) parts are included. File parts have their `url`
 * already replaced with a fresh signed URL by the messages route handler,
 * so they are ready for display and for re-sending to the model.
 */
export function toUIMessage(message: Message): UIMessage {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts.flatMap((p): UIMessage["parts"] => {
      if (p.type === "text") {
        return [{ type: "text" as const, text: p.text }] as UIMessage["parts"];
      }
      if (p.type === "file") {
        return [
          {
            type: "file" as const,
            url: p.url,
            mediaType: p.mediaType,
            ...(p.filename ? { filename: p.filename } : {}),
          },
        ] as UIMessage["parts"];
      }
      // UI-only document chip — passed through for rendering in the thread.
      if (p.type === "data-document") {
        return [{ type: "data-document", data: p.data }] as UIMessage["parts"];
      }
      return [];
    }) as UIMessage["parts"],
  };
}
