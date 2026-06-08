import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 renamed middleware -> proxy. This runs in the edge runtime, so it
// uses the edge-safe authConfig (no Prisma adapter). The `authorized` callback
// in authConfig decides who can access what.
export const { auth: proxy } = NextAuth(authConfig);

export default proxy;

export const config = {
  // Run on all routes except static assets, image optimizer, favicon, and
  // brand assets. API auth routes are allowed through inside authConfig.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
