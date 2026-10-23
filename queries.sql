-- Britax US (client 1224) pricing and share dashboard: the queries behind private/data-*.js
-- Source: client_catalog.marketshare_cubes.ms_estimations_metadata (one row per ASIN x week, Amazon US).
-- Week index wi = datediff(WEEK_START_DATE, DATE'2024-10-06') / 7  (week 0 = 2024-10-06, week 105 = 2026-10-11, the latest week at build time).
-- Segment si: 0 Convertible, 1 Booster, 2 Infant, 3 Strollers > Other, 4 Strollers > Double, 5 Travel Systems.
-- Britax group = CLIENT_FLAG = 'client' (Britax + Bob Gear); competitors = CLIENT_FLAG = 'comp'. Price = SALES_ESTIMATES_TOTAL / UNIT_ESTIMATES_TOTAL.
-- Key weeks: baseline 2-5 and 9-12 | tariff window 13-38 | Jan-25 level 13-16 | Prime events 39 (Jul-25), 52 (Oct-25), 89 (Jun-26), 104 (Oct-26)
--   now = 91-101 | prior = 76-86 | same weeks last year = 41-49.
-- Weeks removed before moves are detected (event weeks, +-1 week, Oct-26 pre-event weeks, Black Friday / Cyber Monday):
--   0,1,6,7,8,37,38,39,40,50,51,52,53,59,60,87,88,89,90,102,103,104,105.

-- Shared base used by every query below.
WITH f AS (
  SELECT CAST(datediff(WEEK_START_DATE, DATE'2024-10-06')/7 AS INT) wi,
         CASE concat(CATEGORY,' > ',COALESCE(SUB_CATEGORY_1,'All'))
           WHEN 'Car Seats > Convertible Car Seats' THEN 0 WHEN 'Car Seats > Booster Car Seats' THEN 1 WHEN 'Car Seats > Infant Car Seats' THEN 2
           WHEN 'Strollers > Other Strollers' THEN 3 WHEN 'Strollers > Double Strollers' THEN 4 WHEN 'Travel Systems > All' THEN 5 END si,
         CASE WHEN CLIENT_FLAG='client' THEN 'Britax group' ELSE BRAND END brand, CLIENT_FLAG='client' isb,
         ASIN asin, SALES_ESTIMATES_TOTAL s, UNIT_ESTIMATES_TOTAL u
  FROM client_catalog.marketshare_cubes.ms_estimations_metadata
  WHERE CLIENT_ID = 1224 AND WEEK_START_DATE >= DATE'2024-10-06' AND BRAND IS NOT NULL AND UNIT_ESTIMATES_TOTAL > 0 AND SALES_ESTIMATES_TOTAL > 0)
SELECT 1;

-- A) Same-ASIN price comparisons (data-tariff.js). For a window pair (A, B): ASINs with >= 3 units in A and B, B price within 0.5x-2x of A price,
--    index = SUM(priceB * unitsA) / SUM(priceA * unitsA) * 100; coverage = matched A revenue / all A revenue.
--    Pairs: baseline->Jan-25, baseline->Jun-25 (33-36), Jan->Jun, baseline->now, prior->now, last 4 vs prior 4 (98-101 vs 94-97), last year->now.
--    Brands are exploded with LATERAL VIEW explode(array(brand, CASE WHEN NOT isb THEN 'All competitors' END)) to get the competitor total.
-- B) Weekly fixed-basket index (data-basket.js). Basket = ASINs with >= 8 baseline units; week index = SUM(price_t * baseline units) / SUM(baseline price * baseline units)
--    over basket ASINs with >= 2 units that week; blank when matched revenue < 40% of the basket. Rise start = first clean week from 17 where the
--    index and the next two are >= 1.04 x the Jan-25 level (1.08 for the second column).
-- C) 12-month series (data-r12.js, weeks 54..105 = 2025-10-19 to 2026-10-11): per segment x brand (Britax group, All competitors, Segment total, top competitors):
--    price index vs baseline, % of units sold on promotion, and units, by week.
--    baseline = percentile(price, 0.5) per ASIN over weeks 54..105, ASINs with >= 10 weeks of >= 2 units;
--    promotion = SKU-week price <= 0.95 x baseline (rows with >= 2 units, price within 0.5x-2x of baseline);
--    index = SUM(sales) / SUM(baseline price x units) over covered units x 100. Rows are printed with array_join(array(...), ',', '') so NULLs stay empty.
--
-- D) Key products (data-skus.js): top Britax and competitor ASINs by units over weeks 93..105 in segments 0, 1, 3, 4 (convertible, booster, other strollers, double strollers),
--    with ASIN, brand, title (COALESCE(title, '(title not available)')), baseline price, units per week and the 52 weekly prices. ORDER BY ..., asin for a stable order.
--
-- E) Promo prices (data-prices.js): same base and baseline as C. Per segment x brand: units, sales and units x baseline price for promoted rows, and units and sales for non-promoted rows.
--    avg price on promo = promo sales / promo units; off promo = non-promo sales / non-promo units; depth = 1 - promo sales / SUM(baseline price x units).
-- F) Price ladder (data-ladder.js): per segment x brand (top 10 by units plus Britax group, shown as 'Britax'): units and sales for weeks 54..105, 93..105 and 80..92. All rows with units and sales > 0.
-- G) Price range (data-range.js): per segment x own/competitor: count, min, median and max 52-week average price (sales / units) of products with 100+ units; % of covered units on promo for weeks 54..105 and 93..105.
--
-- Stitching, move detection, stability, promotion and share statistics are computed in the browser from these tables (private/analytics.js).
--   moves: avg(next 4 clean weeks) vs avg(prior 4 clean weeks) >= 5%, largest within +-3 weeks, kept if the level 4-7 weeks later has the same sign and >= 60% of the move.
--   clean weeks exclude Prime event weeks (e-2..e+1), Black Friday weeks (6, 7, 8, 59, 60) and weeks 0-1.

-- Validation: every table row carries a checksum printed by its query and re-checked by scripts/verify-*.mjs (npm run verify):
--  * basket 42 rows, 12-month series 48 rows, key products 76 rows, promo prices 42 rows, ladder 62 rows, range 12 rows; tariff 72 rows checked against the SQL sums at build time.
--  * independent recompute as separate SQL: Britax convertible unit share 2.9% (wk 91-101); all-competitor convertible same-ASIN change Jan to Jun 2025 +14.2%.
-- Earlier check (Britax brand only, excluding Bob Gear; 52 weeks to Oct 2026): estimated sales $27.66M vs Vendor Central ordered revenue $35.71M (77%), estimated ASP $233.65 vs $253.2.
