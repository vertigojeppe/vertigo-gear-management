import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { isRole, type Role } from "../../../config/app.config";
import { twoFactor, users } from "@/modules/users";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
  interface User {
    role?: string;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** App code or recovery code; required when the user has 2FA on. */
  code: z.string().optional(),
});

/**
 * Auth.js configuration.
 *
 * Strategy: JWT sessions (required by the Credentials provider). The token
 * carries the user id (and the role at sign-in time, used only by the
 * proxy's optimistic check). `getActor` in session.ts loads the user once
 * per request, so role changes and deactivation apply immediately and a
 * stale cookie is signed out.
 *
 * Adding Google login later: add the Google provider here and set
 * AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET. Nothing else changes.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, code: {} },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await users.verifyCredentials(parsed.data.email, parsed.data.password);
        if (!user) return null;
        if (user.twoFactor && !(parsed.data.code && (await twoFactor.verify(user.id, parsed.data.code)))) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = isRole(token.role) ? token.role : "viewer";
      return session;
    },
  },
});
