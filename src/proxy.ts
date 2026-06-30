import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (replaces middleware.ts).
 * Sole responsibility: refresh the Supabase session cookie on every request
 * so server components and route handlers always see an up-to-date session.
 * Also redirects signed-in (non-anonymous) users away from auth pages.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not add any logic between createServerClient and getUser().
  // Calling getUser() refreshes the session token if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect already-authenticated (non-anonymous) users away from auth pages.
  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup");
  if (isAuthPage && user && !user.is_anonymous) {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    // Forward any refreshed session cookies onto the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on all routes except static assets, images, and favicon
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
