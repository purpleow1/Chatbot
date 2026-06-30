import { requireAuth } from "@/lib/auth/get-user";
import { getChatsByUserId, createChat } from "@/lib/db/chats";
import type { NextRequest } from "next/server";

export async function GET() {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  try {
    const chats = await getChatsByUserId(user.id);
    return Response.json(chats);
  } catch {
    return Response.json({ error: "Failed to fetch chats" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  let title: string | undefined;
  try {
    const body = await request.json();
    title = typeof body?.title === "string" ? body.title.trim() || undefined : undefined;
  } catch {
    // body is optional; proceed without a title
  }

  try {
    const chat = await createChat(user.id, title);
    return Response.json(chat, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create chat" }, { status: 500 });
  }
}
