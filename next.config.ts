import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Firebase Admin + its JWT verification chain out of the server bundle
  // so Node resolves them natively at runtime. Bundling them makes Next
  // `require()` the ESM-only `jose` used by `jwks-rsa` (firebase-admin/auth
  // token verification) → `ERR_REQUIRE_ESM` on Vercel. `firebase-admin` is on
  // Next's default external list; `jwks-rsa` / `jose` are listed explicitly so
  // the ESM-only jose@6 never gets bundled even transitively.
  serverExternalPackages: ["firebase-admin", "jwks-rsa", "jose"],
};

export default nextConfig;
