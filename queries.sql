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
-- C) Weekly implied ASP and units for Britax group vs all competitors per segment (data-weekly.js).
-- D) Events (data-events.js): lead-in = weeks e-6..e-3, event = e, post = e+1..e+3 (week 105 only for the Oct-26 event). Units per week, same-ASIN price vs lead-in.
-- E) Price ladder (data-ladder.js): brand ASP and units/week for now, a year ago and prior; unit-weighted p25/p50/p75 of ASIN prices; share of units priced below Britax.
-- F) Sustained moves (data-moves.js): on the clean series, avg(next 4 weeks) vs avg(prior 4 weeks), |change| >= 5%, largest within +-3 weeks,
--    kept if the level 4-7 weeks later is the same sign and >= 60% of the move (or if there are not 2 clean weeks left to check).

-- Validation used when building: row counts from SQL (72 tariff rows, 216 event rows, 178 move rows) match the data files; every weekly and basket series
-- carries a checksum printed by the query and re-checked by scripts/verify-*.mjs (npm run verify).
-- Earlier check (52 weeks to Oct 2026): Britax estimated sales $27.66M vs Vendor Central ordered revenue $35.71M (77%), estimated ASP $233.65 vs $253.2.
