# Britax US pricing and share dashboard

Password-protected dashboard for Britax on Amazon US. It answers seven questions from Market Share estimates (prices and units) for Jan 2025 to Oct 2026:
who raised prices for tariffs, where competitors are moving now, off-promo price moves and the Britax flag, whether prices have stabilised, lower vs hold,
where the market sits on price, and how competitors perform after Prime events.

Definitions: tariff period = Jan to Jun 2025. Promotional periods = June and October Prime events (Prime Day Jul 2025 stands in for June 2025, which had no event; Prime Big Deal Days Oct 2025; Prime Day Jun 2026; Prime Big Deal Days Oct 2026).

## How it is built
- Next.js 14 (App Router). The page and its data are precomputed from Databricks (see `queries.sql`), so nothing is queried at view time.
- `middleware.js` gates **every** route, including `/assets/*` (the data files), behind a signed session cookie. Login needs `DASHBOARD_PASSWORD` plus a work email (logged to Vercel logs). With no password configured the app returns 503.
- `private/` holds the dashboard (`index.html`, `app.js`, `analytics.js`) and data (`data-*.js`). These are served only by route handlers after the session check.
- `npm run verify` re-checks the copied data against the checksums the queries produced.

## Deploy on Vercel
1. Import this repo in Vercel (framework: Next.js; `vercel.json` is set).
2. Set the production env var `DASHBOARD_PASSWORD`. Optionally set `SESSION_SECRET` (a long random string) to sign cookies with something other than the password.
3. Redeploy, open the link, and check it asks for the password. Send the link and password separately.
4. Register the dashboard (name, client, URL, one-line description) with the dashboard owner.

Local: `npm install`, then `DASHBOARD_PASSWORD=choose-one npm run dev`.

## Refreshing the data
Re-run the queries in `queries.sql` for the new latest week, rewrite `private/data-*.js`, run `npm run verify`, and update the week constants in `private/analytics.js` (`CLEAN_NOW`, `CLEAN_PRIOR`, `CLEAN_LY`, `EVENTS`) and `private/app.js` (`LAST`).
