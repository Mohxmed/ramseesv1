import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/golden-target", "/settings"];
const authRoutes = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // This middleware provides a foundation for server-side route protection.
  // Currently, Firebase Auth state is client-side only.
  // The primary route protection is handled by the ProtectedRoute component.
  //
  // Future: Add Firebase Admin SDK + session cookies for true server-side protection.
  // When implemented, this middleware will check the session cookie and redirect
  // unauthenticated users to /login.

  // For now, allow all requests through. Client-side protection handles auth.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
  ],
};
