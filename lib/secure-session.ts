/** A client-only signal for requests that cannot be signed with this tab's session. */
export const SECURE_SESSION_MISSING_EVENT = "kellon:secure-session-missing";

let secureSessionRequired = false;

export function requireSecureSessionLogin(): void {
  if (typeof window === "undefined") return;

  secureSessionRequired = true;
  window.dispatchEvent(new Event(SECURE_SESSION_MISSING_EVENT));
}

export function isSecureSessionLoginRequired(): boolean {
  return secureSessionRequired;
}

export function clearSecureSessionLoginRequired(): void {
  secureSessionRequired = false;
}
