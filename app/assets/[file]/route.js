import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const dynamic = 'force-dynamic';

// Only these files are served, and only behind the session check in middleware.js.
const FILES = ['data-basket.js', 'data-tariff.js', 'data-r12.js', 'data-skus.js', 'data-prices.js', 'data-ladder.js', 'data-range.js', 'analytics.js', 'app.js'];

export async function GET(_req, { params }) {
  if (!FILES.includes(params.file)) return new Response('Not found', { status: 404 });
  const body = readFileSync(join(process.cwd(), 'private', params.file), 'utf8');
  return new Response(body, { headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'private, no-store' } });
}
