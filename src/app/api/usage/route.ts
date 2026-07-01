import { requireAuth } from "@/lib/auth/get-user";
import { getAnonMessageCount } from "@/lib/db/usages";
import { ANON_MESSAGE_LIMIT } from "@/lib/constants";

/**
 * Reports the caller's remaining free-question allowance so the client can
 * render the anonymous usage banner and prompt sign-up at the limit.
 * Signed-up users are unlimited.
 */
export async function GET() {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  const { user } = result;

  const isAnonymous = user.is_anonymous === true;

  if (!isAnonymous) {
    return Response.json({
      isAnonymous: false,
      count: 0,
      limit: ANON_MESSAGE_LIMIT,
      remaining: ANON_MESSAGE_LIMIT,
    });
  }

  try {
    const count = await getAnonMessageCount(user.id);
    const remaining = Math.max(0, ANON_MESSAGE_LIMIT - count);
    return Response.json({
      isAnonymous: true,
      count,
      limit: ANON_MESSAGE_LIMIT,
      remaining,
    });
  } catch {
    return Response.json({ error: "Failed to fetch usage" }, { status: 500 });
  }
}
