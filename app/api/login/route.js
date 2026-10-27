import { NextResponse } from 'next/server';
import { COOKIE, MAX_AGE, safeEqual, signToken } from '../../../lib/session';

export async function POST(req) {
  const expected = process.env.DASHBOARD_PASSWORD;
  const form = await req.formData();
  const email = String(form.get('email') || '').trim().toLowerCase();
  const password = String(form.get('password') || '');
  const back = (e) => NextResponse.redirect(new URL('/login?e=' + e, req.url), 303);
  if (!expected) return new NextResponse('This dashboard is not configured yet.', { status: 503 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return back('email');
  if (!(await safeEqual(password, expected))) return back('password');
  console.log('dashboard login', email); // visible in Vercel logs: who opened the dashboard
  const res = NextResponse.redirect(new URL('/', req.url), 303);
  res.cookies.set(COOKIE, await signToken(email), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE });
  return res;
}
