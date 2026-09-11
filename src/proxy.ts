import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Baseline security headers applied on the edge to every response. CSP and
// HSTS are intentionally not set here — CSP must be tuned per-app (Next injects
// inline scripts/styles) and HSTS only belongs on a production TLS host.
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), usb=()",
};

export function proxy(request: NextRequest) {
  // This proxy provides a foundation for server-side route protection.
  // Currently, Firebase Auth state is client-side only — real protection is
  // handled by the ProtectedRoute component.
  //
  // Future: Add Firebase Admin SDK + session cookies for true server-side
  // protection. When implemented, check the session cookie here and redirect
  // unauthenticated users to /login.
  void request;

  const response = NextResponse.next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico|txt|xml|webmanifest|css|js|woff2?|map)$).*)",
  ],
};