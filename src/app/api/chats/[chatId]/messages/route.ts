import { requireAuth } from "@/lib/auth/get-user";
import { getChatById } from "@/lib/db/chats";
import { getMessagesByChatId } from "@/lib/db/messages";
import type { NextRequest } from "next/server";

type Params = Promise<{ chatId: string }>;

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
    return Response.json(messages);
  } catch {
    return Response.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
