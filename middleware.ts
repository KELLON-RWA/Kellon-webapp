import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REFERRAL_COOKIE = "kellon_ref";
const REFERRAL_CODE = /^@?[A-Za-z0-9_-]{3,64}$/;

export function middleware(request: NextRequest) {
  const onboarded = request.cookies.get("kellon_onboarded")?.value;
  const sessionToken = request.cookies.get("session_token")?.value;

  const { pathname, searchParams } = request.nextUrl;

  // Referral links (/join?ref=CODE, /r/CODE) land before sign-up. Keep the code in a cookie so
  // it survives onboarding and login; ReferralAttributor claims it once the user is in.
  const referral =
    pathname === "/join"
      ? searchParams.get("ref")
      : pathname.match(/^\/r\/([^/]+)$/)?.[1];
  if (pathname === "/join" || pathname.startsWith("/r/")) {
    const target = !onboarded
      ? "/onboarding"
      : sessionToken
        ? "/rewards"
        : "/continue";
    const response = NextResponse.redirect(new URL(target, request.url));
    if (referral && REFERRAL_CODE.test(referral)) {
      response.cookies.set(REFERRAL_COOKIE, referral, {
        maxAge: 7 * 24 * 60 * 60,
        sameSite: "lax",
        path: "/",
      });
    }
    return response;
  }

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
