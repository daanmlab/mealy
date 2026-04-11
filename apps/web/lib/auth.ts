import NextAuth, { type NextAuthResult } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { SignJWT, jwtVerify } from 'jose';
import type { JWT } from 'next-auth/jwt';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type DbUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
};

function toKey(secret: string | string[]): Uint8Array {
  return new TextEncoder().encode(Array.isArray(secret) ? secret[0] : secret);
}

async function upsertOAuthUser(input: {
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<DbUser> {
  const res = await fetch(`${API_URL}/api/auth/upsert-oauth-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': process.env.INTERNAL_API_KEY ?? '',
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OAuth user upsert failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<DbUser>;
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
}: NextAuthResult = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const res = await fetch(`${API_URL}/api/auth/validate-credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        });
        if (!res.ok) return null;
        return res.json() as Promise<{ id: string; email: string; name: string | null; avatarUrl: string | null; isAdmin: boolean }>;
      },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
      authorization: {
        params: { scope: 'openid email profile' },
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        return Boolean(user.email);
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (account?.provider === 'google') {
        const email = user?.email ?? token.email;
        if (!email) return token;

        const dbUser = await upsertOAuthUser({
          email,
          name: user?.name ?? token.name,
          avatarUrl:
            typeof user?.image === 'string'
              ? user.image
              : typeof token.picture === 'string'
                ? token.picture
                : null,
        });

        token.id = dbUser.id;
        token.sub = dbUser.id;
        token.email = dbUser.email;
        token.name = dbUser.name;
        token.picture = dbUser.avatarUrl ?? undefined;
        token.isAdmin = dbUser.isAdmin;
        return token;
      }

      if (user) {
        token.id = user.id;
        token.sub = user.id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },

    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.isAdmin = token.isAdmin as boolean;
      return session;
    },
  },

  // Use HS256 signing so NestJS can validate tokens with the shared AUTH_SECRET.
  jwt: {
    async encode({ token, secret, maxAge }) {
      const key = toKey(secret as string | string[]);
      return new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.round(Date.now() / 1000) + (maxAge ?? 7 * 24 * 60 * 60))
        .sign(key);
    },
    async decode({ token, secret }) {
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, toKey(secret as string | string[]));
        return payload as JWT;
      } catch {
        return null;
      }
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
});
