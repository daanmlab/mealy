import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/auth/callback'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const hasRefreshCookie = request.cookies.has('refresh_token');

  if (!isPublic && !hasRefreshCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isPublic && hasRefreshCookie && !pathname.startsWith('/auth/callback')) {
    return NextResponse.redirect(new URL('/plan', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};
