import "server-only";

export type ChatBroadcastEvent =
  | { type: "chat.created"; chatId: string }
  | { type: "chat.updated"; chatId: string }
  | { type: "chat.deleted"; chatId: string };

/** Per-user Broadcast channel name. Must match the client subscription. */
export const userChannel = (userId: string) => `user:${userId}`;

/**
 * Broadcasts a chat lifecycle event to a per-user Realtime Broadcast channel
 * using the Supabase Realtime HTTP API — no WebSocket connection needed,
 * which is safe for serverless / short-lived route handlers.
 *
 * Failures are non-fatal: the client will fall back to the next polling cycle.
 */
export async function broadcastChatEvent(
  userId: string,
  event: ChatBroadcastEvent,
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  try {
    const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: userChannel(userId),
            event: event.type,
            payload: event,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[realtime] broadcast failed (${res.status}): ${text}`);
    }
  } catch (err) {
    console.error("[realtime] broadcast error:", err);
  }
}
