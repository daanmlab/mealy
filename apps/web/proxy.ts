import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC_PATHS = ['/login', '/register'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NextAuth handles its own routes — pass through untouched.
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // For proxied API requests: inject the raw session JWT as a Bearer token so
  // NestJS can validate it with the shared AUTH_SECRET.
  if (pathname.startsWith('/api/')) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return NextResponse.next();

    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
      raw: true,
    });

    const headers = new Headers(request.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Rewrite to external API with auth header
    const url = new URL(pathname + request.nextUrl.search, apiUrl);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // Page route protection — redirect to /login if no session.
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const sessionToken = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    raw: true,
  });

  if (!isPublic && !sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static assets (includes /api/* now).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};
