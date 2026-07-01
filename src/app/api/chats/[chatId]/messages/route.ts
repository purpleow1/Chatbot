import { requireAuth } from "@/lib/auth/get-user";
import { getChatById } from "@/lib/db/chats";
import { getMessagesByChatId } from "@/lib/db/messages";
import { adminClient } from "@/lib/supabase/admin";
import type { Message, MessagePart } from "@/lib/db/types";
import type { NextRequest } from "next/server";

type Params = Promise<{ chatId: string }>;

/** Signed URL TTL in seconds — 1 hour is enough for a viewing session. */
const SIGNED_URL_TTL = 3600;

/**
 * For each "file" part whose `url` is a Supabase Storage path (not an https URL),
 * generate a fresh signed URL so the client can display the image without
 * needing access to the service-role key.
 */
async function hydrateFileParts(messages: Message[]): Promise<Message[]> {
  // Collect all unique storage paths that need signing in one pass.
  const paths = new Set<string>();
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === "file" && !part.url.startsWith("http")) {
        paths.add(part.url);
      }
    }
  }

  if (paths.size === 0) return messages;

  // Sign all paths in parallel.
  const signedMap = new Map<string, string>();
  await Promise.all(
    [...paths].map(async (path) => {
      const { data } = await adminClient.storage
        .from("attachments")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (data?.signedUrl) {
        signedMap.set(path, data.signedUrl);
      }
    }),
  );

  return messages.map((msg) => ({
    ...msg,
    parts: msg.parts.map((part): MessagePart => {
      if (
        part.type === "file" &&
        !part.url.startsWith("http") &&
        signedMap.has(part.url)
      ) {
        return { ...part, url: signedMap.get(part.url)! };
      }
      return part;
    }),
  }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Params },
) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  const { chatId } = await params;

  try {
    // Verify the chat belongs to the requesting user before returning its messages.
    const chat = await getChatById(chatId, user.id);
    if (!chat) return Response.json({ error: "Not found" }, { status: 404 });

    const messages = await getMessagesByChatId(chatId);
    const hydrated = await hydrateFileParts(messages);
    return Response.json(hydrated);
  } catch {
    return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
