import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config: providers are added in auth.ts (the credentials
 * provider needs Node APIs / Prisma). This file holds the pieces that must run
 * in the edge runtime (used by proxy.ts for route protection): callbacks, pages,
 * and the session strategy.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      // Public routes that never require a session. /api/auth/* is NextAuth's
      // own routes; /api/cron/* is server-to-server and guards itself with
      // CRON_SECRET (no user session exists for a cron call).
      const isAuthPage = path === "/login" || path === "/signup";
      const isPublicApi =
        path === "/api/auth" ||
        path.startsWith("/api/auth/") ||
        path.startsWith("/api/cron/");

      if (isAuthPage) {
        // Logged-in users shouldn't sit on login/signup.
        if (isLoggedIn) {
          return Response.redirect(new URL("/find", nextUrl));
        }
        return true;
      }

      if (isPublicApi) return true;

      // Everything else requires a session.
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
