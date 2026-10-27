# Britax US pricing and share dashboard

Password-protected dashboard for Britax on Amazon US, built from Market Share estimates (prices and units) for Oct 2024 to Oct 2026. Six tabs, each by Amazon category (Car Seats, Strollers, Travel Systems, Accessories; the comparison and summary tabs also have All categories):
1. **Price and promo** (each table also has a closed “By price tier” block: Value, Mid and Premium tiers by each product's own average price, Britax vs all competitors): who raised price (tariff period Jan to Jun 2025) with a trend chart of Britax, all competitors combined and single brands; average retail price (discounted weeks left out) for Britax vs each brand: 2025 vs 2024, 2026 YTD vs 2025 YTD, Oct 2026 vs Sep 2026; average price on and off promotion against a 12-month baseline, by brand or by product; Britax vs competitors by segment; brand price ladder.
2. **Market share**: weekly share for the last 12 months with Prime weeks and Britax promo weeks marked, and share in Prime weeks vs other weeks.
3. **Key competitor products**: price low, median, high and % promo for Britax vs competitors by segment, then the best-selling Britax and competitor products with recent promotions (Britax's two largest categories, Car Seats and Strollers).
4. **Share around Prime days**: six-month share change and before / during / after tables for each Prime event, with promo columns.
5. **Price elasticity**: elasticity of Britax group products from the CommerceIQ feed (latest 2026 feed), by category, price tier and brand.
6. **Share comparison and category summary**: 2026 year-to-date vs 2025 estimated sales and market share for competitor and Britax brands, by category or all categories, followed by donut charts of Britax vs others and of Britax and top competitor brands for 2026 YTD and 2025, ASIN counts by brand and the category total.

All promo comparisons use each product's median price over the last 52 weeks as the baseline. Tariff comparisons use the pre-tariff level (Q4 2024) because the 52-week window starts after the tariff move.

Definitions: tariff period = Jan to Jun 2025. Prime events = June and October (Prime Day Jul 2025 stands in for June 2025, which had no event; Prime Big Deal Days Oct 2025; Prime Day Jun 2026; Prime Big Deal Days Oct 2026).

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
Re-run the queries in `queries.sql` for the new latest week, rewrite `private/data-*.js`, run `npm run verify`, and update the week constants in `private/analytics.js` (`W`, `R12_START`, `PRIME`) and the six-month windows in `analytics.js` (`stability`, `shareChange`) and `app.js`.


**Update:** prices are now the average selling price of all products (sales ÷ units), so they include promotions and move with product mix; share is share of sales ($), matching the CommerceIQ platform. 2026 YTD = 42 weeks from Dec 28, 2025 to Oct 11, 2026 (platform weeks). The same-product basket and tariff datasets were replaced by `private/data-weekly.js` (query M in `queries.sql`).
