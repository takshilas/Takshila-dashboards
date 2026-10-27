// Signed session cookie: base64url(JSON {e: email, x: expiry seconds}) + '.' + HMAC-SHA256. Works in the edge and node runtimes (Web Crypto).
export const COOKIE = 'ciq_session';
export const MAX_AGE = 60 * 60 * 24 * 7;

const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function key() {
  const secret = process.env.SESSION_SECRET || process.env.DASHBOARD_PASSWORD || '';
  return crypto.subtle.importKey('raw', enc.encode('britax-dashboard:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signToken(email) {
  const payload = b64u(enc.encode(JSON.stringify({ e: email, x: Math.floor(Date.now() / 1000) + MAX_AGE })));
  const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(payload));
  return payload + '.' + b64u(sig);
}

export async function verifyToken(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [payload, sig] = token.split('.');
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(), fromB64u(sig), enc.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64u(payload)));
    return data.x > Date.now() / 1000 ? { email: data.e } : null;
  } catch (e) { return null; }
}

// Constant-time string comparison on SHA-256 digests (no early exit, equal length).
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(String(a))), crypto.subtle.digest('SHA-256', enc.encode(String(b)))]);
  const xa = new Uint8Array(x), ya = new Uint8Array(y); let d = 0;
  for (let i = 0; i < xa.length; i++) d |= xa[i] ^ ya[i];
  return d === 0;
}
