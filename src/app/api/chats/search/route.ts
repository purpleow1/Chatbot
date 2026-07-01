import { requireAuth } from "@/lib/auth/get-user";
import { searchChats } from "@/lib/db/chats";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json([]);

  try {
    const results = await searchChats(user.id, q);
    return Response.json(results);
  } catch {
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
