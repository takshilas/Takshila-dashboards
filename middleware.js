import { NextResponse } from 'next/server';
import { COOKIE, verifyToken } from './lib/session';

// Gates every page, asset and API route. Only the login page and the login/logout endpoints are open.
const OPEN = ['/login', '/api/login', '/api/logout'];

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (!process.env.DASHBOARD_PASSWORD) {
    // fail closed: never serve data when no password is configured
    return new NextResponse('This dashboard is not configured yet.', { status: 503 });
  }
  if (OPEN.includes(pathname)) return NextResponse.next();
  const session = await verifyToken(req.cookies.get(COOKIE)?.value);
  if (session) return NextResponse.next();
  if (pathname.startsWith('/api/') || pathname.startsWith('/assets/')) return new NextResponse('Unauthorized', { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}
