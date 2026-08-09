import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const onboarded = request.cookies.get("kellon_onboarded")?.value;
  const sessionToken = request.cookies.get("session_token")?.value;

  const { pathname } = request.nextUrl;

  // Define our "Safe Zones"
  const isOnboardingPage = pathname.startsWith("/onboarding");
  const isContinuePage = pathname.startsWith("/continue");

  /**
   * 1. Force onboarding if they haven't seen the intro.
   * (Exception: Don't redirect if they are already on the onboarding page)
   */
  if (!onboarded && !isOnboardingPage) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (onboarded && isOnboardingPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  /**
   * 2. Protect the app if they aren't logged in.
   * (Exception: Don't redirect if they are already on the /continue page
   * OR still in the onboarding flow)
   */
  if (onboarded && !sessionToken && !isContinuePage && !isOnboardingPage) {
    return NextResponse.redirect(new URL("/continue", request.url));
  }

  /**
   * 3. Prevent logged-in users from visiting onboarding or login pages.
   */
  if (sessionToken && (isOnboardingPage || isContinuePage)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Pattern to skip all internal Next.js paths and static files
  matcher: [
    // sw.js must be excluded: a redirect to /onboarding would be served as the service
    // worker script and registration would fail.
    "/((?!_next/static|_next/image|api|favicon.ico|manifest.json|sw.js|.*\\.(?:json|svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
