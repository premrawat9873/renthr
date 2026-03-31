import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

// Derive a sensible NEXTAUTH_URL at runtime so production does not fall back to localhost.
const derivedSiteUrl =
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  "http://localhost:3000";

if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = derivedSiteUrl;
}

const providers: AuthOptions["providers"] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password;

      if (!email || !password) {
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user?.passwordHash) {
        return null;
      }

      const isPasswordValid = await verifyPassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return null;
      }

      return {
        id: String(user.id),
        email: user.email,
        name: user.name ?? user.email.split("@")[0],
      };
    },
  }),
];

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
const facebookClientId = process.env.FACEBOOK_CLIENT_ID || process.env.AUTH_FACEBOOK_ID;
const facebookClientSecret = process.env.FACEBOOK_CLIENT_SECRET || process.env.AUTH_FACEBOOK_SECRET;

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    })
  );
}

if (facebookClientId && facebookClientSecret) {
  providers.push(
    FacebookProvider({
      clientId: facebookClientId,
      clientSecret: facebookClientSecret,
    })
  );
}

export const authOptions: AuthOptions = {
  providers,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
};
