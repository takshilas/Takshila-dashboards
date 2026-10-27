import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

// Only these files are served, and only behind the session check in middleware.js.
const FILES = ['data-weekly.js', 'data-r12.js', 'data-prices.js', 'data-skuall.js', 'data-brand-weekly.js', 'data-asp.js', 'data-tier-weekly.js', 'data-tier-asp.js', 'data-tier-promo.js', 'data-tier-brand.js', 'data-tier-skus.js', 'data-elasticity.js', 'analytics.js', 'app.js'];

export async function GET(_req, { params }) {
  if (!FILES.includes(params.file)) return new Response('Not found', { status: 404 });
  const body = readFileSync(join(process.cwd(), 'private', params.file), 'utf8');
  return new Response(body, { headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'private, no-store' } });
}
