import { requireAuth } from "@/lib/auth/get-user";
import { getChatById, updateChat, deleteChat } from "@/lib/db/chats";
import { broadcastChatEvent } from "@/lib/realtime/broadcast";
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
    const chat = await getChatById(chatId, user.id);
    if (!chat) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(chat);
  } catch {
    return Response.json({ error: "Failed to fetch chat" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params },
) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  const { chatId } = await params;

  let body: { title?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body?.title !== "string" || !body.title.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const existing = await getChatById(chatId, user.id);
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    const updated = await updateChat(chatId, user.id, { title: body.title.trim() });
    await broadcastChatEvent(user.id, { type: "chat.updated", chatId });
    return Response.json(updated);
  } catch {
    return Response.json({ error: "Failed to update chat" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params },
) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  const { chatId } = await params;

  try {
    const existing = await getChatById(chatId, user.id);
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

    await deleteChat(chatId, user.id);
    await broadcastChatEvent(user.id, { type: "chat.deleted", chatId });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}
