import "server-only";
import { FirebaseAuthError } from "firebase-admin/auth";
import { getAdminAuth } from "./firebase/admin";

/**
 * Server-side Firebase Authentication helper for API routes.
 *
 * Every protected route MUST call `authenticateRequest(req)` and use the
 * returned `uid` as the resource owner key — the client's `uid` claim is never
 * trusted. Authorization header format: `Bearer <idToken>`.
 */

export class UnauthorizedError extends Error {
  readonly status: number;
  constructor(message = "غير مصرح", status = 401) {
    super(message);
    this.name = "UnauthorizedError";
    this.status = status;
  }
}

export async function authenticateRequest(req: Request): Promise<string> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) {
    throw new UnauthorizedError("مطلوب تسجيل الدخول للوصول إلى هذه الحماية.");
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (!decoded.uid) {
      throw new UnauthorizedError();
    }
    return decoded.uid;
  } catch (err) {
    if (err instanceof FirebaseAuthError) {
      throw new UnauthorizedError("الجلسة منتهية أو غير صالحة — سجّل الدخول مجددًا.");
    }
    throw new UnauthorizedError();
  }
}

/** Verify + return Promise.all style two-value convenience for route handlers. */
export async function requireUser(req: Request): Promise<{ uid: string }> {
  const uid = await authenticateRequest(req);
  return { uid };
}