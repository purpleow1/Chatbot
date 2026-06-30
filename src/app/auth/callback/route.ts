import { createAuthClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * OAuth callback handler.
 * Supabase redirects here after Google/GitHub sign-in with a `code` param.
 * We exchange it for a session, which @supabase/ssr writes into cookies.
 * Also handles anonymous → permanent account upgrade (linkIdentity flow).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page if code exchange fails
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
