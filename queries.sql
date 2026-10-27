-- Britax US (client 1224) pricing and share dashboard: the queries behind private/data-*.js
-- Source: client_catalog.marketshare_cubes.ms_estimations_metadata (one row per ASIN x week, Amazon US).
-- Week index wi = datediff(WEEK_START_DATE, DATE'2024-10-06') / 7  (week 0 = 2024-10-06, week 105 = 2026-10-11, the latest week at build time).
-- Category si (Amazon CATEGORY, as in the CommerceIQ Market Share page): 0 Car Seats, 1 Strollers, 2 Travel Systems, 3 Accessories. Compare view: 4 = all categories.
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
-- H) Products behind the averages (data-skuall.js): same base and baseline as C, per ASIN. Britax group top 40 and competitors top 30 by covered units per segment,
--    with baseline, promo units and sales, non-promo units and sales, weeks on promo, weeks with data and average price in weeks 102..105; coverage rows give the number of
--    products with a baseline and the % of units the listed products cover. Query E also returns non-promo units x baseline price (for the brand baseline price).
--
-- I) Sales and ASINs by brand (data-compare.js): estimated sales (1P + 3P) per segment x brand for 2025 (weeks 13..64, weeks starting 2025-01-05 to 2025-12-28), the same 41 weeks of 2025 (13..53)
--    and 2026 YTD (65..105); distinct ASINs with sales in 2025 and 2026 YTD. Segment 6 = all six segments. Britax group brands (Britax, Bob Gear) plus the top 8 competitors by 2025 + 2026 sales;
--    segment totals cover every brand.
--
-- J) Retail price (data-retail.js): sales and units of ASIN-weeks with NUM_PROMO_DAYS = 0 (no promotion days), per segment x brand, for 2024 (weeks starting 2024-01-07 to 2024-12-29), 2025,
--    2025 and 2026 year to date (41 weeks each), Sep 2026 (weeks starting 09-06 to 09-27) and Oct 2026 (10-04 and 10-11). Retail price = sales / units.
--    Query E now returns, per brand, promo units and sales, off-promo units and sales, and promo sales with the same products' own off-promo price as reference.
--
-- Stitching, move detection, stability, promotion and share statistics are computed in the browser from these tables (private/analytics.js).
--   moves: avg(next 4 clean weeks) vs avg(prior 4 clean weeks) >= 5%, largest within +-3 weeks, kept if the level 4-7 weeks later has the same sign and >= 60% of the move.
--   clean weeks exclude Prime event weeks (e-2..e+1), Black Friday weeks (6, 7, 8, 59, 60) and weeks 0-1.

-- Validation: every table row carries a checksum printed by its query and re-checked by scripts/verify-*.mjs (npm run verify):
--  * basket 42 rows, 12-month series 48 rows, key products 76 rows, promo prices 42 rows, ladder 62 rows, range 12 rows, product detail 274 rows, brand sales 66 rows, segment totals 7 rows, retail prices 42 rows; tariff 72 rows checked against the SQL sums at build time.
--  * independent recompute as separate SQL: Britax convertible unit share 2.9% (wk 91-101); all-competitor convertible same-ASIN change Jan to Jun 2025 +14.2%.
-- Earlier check (Britax brand only, excluding Bob Gear; 52 weeks to Oct 2026): estimated sales $27.66M vs Vendor Central ordered revenue $35.71M (77%), estimated ASP $233.65 vs $253.2.

-- Category rebuild (all tables above use CATEGORY instead of sub-categories): brands per category = the five largest competitors by 52-week sales
--   Car Seats: Graco, Evenflo, Safety 1st, Chicco, Baby Trend | Strollers: Uppababy, Graco, Mompush, Delta Children, Mamazing
--   Travel Systems: Graco, Evenflo, Baby Trend, Joie, Chicco | Accessories: Uppababy, JL Childress, Graco, Momcozy, Shynerk.
-- Key products (D) are the best sellers by sales in Car Seats and Strollers (about 88% of Britax sales); product rows (H) are ranked by sales.
-- L) Same-product retail price change (data-retailidx.js): index of later price x earlier units / earlier sales over ASIN-weeks with NUM_PROMO_DAYS = 0 for 2025 vs 2024,
--    2026 YTD vs the same weeks of 2025 and Oct 2026 (weeks 10-04, 10-11) vs Sep 2026; coverage = share of the earlier period's sales with a matching product.
-- Validation: 'npm run verify' re-adds every row against the checksum its query printed (basket, 12-month series, key products, tariff, promo prices, ladder, range, products, sales, retail).

-- M) Weekly sales and units (data-weekly.js) - REPLACES A) and B) (data-tariff.js and data-basket.js were removed).
--    Per category (CATEGORY column) x brand (Britax group = Britax + Bob Gear, All competitors, Segment total, top 5 competitors): estimated
--    sales and units (1P + 3P) for each week index 0..105. Row = si|brand|106 sales|106 units|sumSales,sumUnits (checksum). Drives the average
--    selling price index (sales / units, all products), the who-raised-price and stability reads, and all share figures (share of SALES, as the platform).
-- Windows now match the CommerceIQ platform (weeks start Sunday): 2026 YTD = weeks 64..105 (2025-12-28 to 2026-10-11, 42 weeks), 2025 = weeks 12..63
--    (2024-12-29 to 2025-12-21), same weeks of 2025 = weeks 12..53. I) and J) were re-pulled on these windows (Car Seats Britax group $19.62M, category $431.27M).

-- N) Average selling price (data-asp.js): same query and layout as J) without the NUM_PROMO_DAYS = 0 filter (all ASIN-weeks), so the price table can show retail price or average selling price.
--    The brand price ladder (query F, data-ladder.js) was removed; share and units come from M).

-- O) Promo vs off-promo averages are now for the LAST 6 MONTHS (weeks 80..105 = 2026-04-19 to 2026-10-11): queries E) and H) keep the 52-week per-ASIN median baseline (weeks 54..105)
--    but count promo and non-promo units and sales only in weeks >= 80. data-prices.js rows are now: category|brand|promo units, promo sales, off-promo units, off-promo sales|checksum
--    (the matched-product reference columns were dropped); data-skuall.js holds the top 30 Britax and top 25 competitor ASINs by 6-month sales per category.

-- P) Retail price (query J, data-retail.js) was removed: the price table uses average selling price only (N).

-- Q) data-prices.js is now a simple average across products: per ASIN (6 months, same baseline and promo rule) promo price = promo sales / promo units and off-promo price likewise;
--    per brand: number of products with promo weeks, SUM of their promo prices, number with off-promo weeks, SUM of their off-promo prices. Average = sum / products.

-- R) data-asp.js is now a simple average across products: per ASIN and window, price = sales / units in that window (all weeks); per brand, the number of products and the SUM of their prices
--    for the six windows (2024, 2025, 2025 YTD same weeks, 2026 YTD, Sep 2026, Oct 2026). Average = sum / products; a window needs 3+ products.

-- S) Price tiers (data-tier-*.js). Tier per ASIN = its average price since 2024-01-07 (sales / units over all weeks, client + competitor ASINs of the category) against fixed cut-offs:
--    Car Seats 160 / 290, Strollers 200 / 550, Travel Systems 315 / 450, Accessories 25 / 75 (about one third of 2026 YTD category sales per tier). The same CTE is used by every tier query:
--    data-tier-weekly.js (weekly sales in $100 and units by category x tier x Britax group / all competitors), data-tier-asp.js (product counts and price sums for the six price windows),
--    data-tier-promo.js (6-month promo and off-promo product counts and price sums, plus the promo price index at weeks 89 and 104). scripts/verify-tier.mjs checks that the tiers add up to data-weekly.js.
-- T) Price elasticity (data-elasticity.js): client_catalog.aramus.price_elasticity_ds (client 1224; per ASIN several price-band rows with near-identical elasticity, averaged), feed 2026-03-29. Reliable model = elasticity < 0 and TOTPRICEPVAL < 0.05. Weights = 2026 YTD sales (weeks from 2025-12-28) of the ASIN from ms_estimations_metadata.
--    Only Britax group ASINs (Britax, Bob Gear) have elasticities; competitor ASINs are not modelled. The undated price_elasticity table (value + low / medium / high bucket) gives similar category values.

-- U) Competitor detail by price tier (data-tier-brand.js): same tier CTE as S), restricted to the top 5 competitors of each category (the 'sel' list used on the Price and promo tab):
--    weekly sales in $100 for weeks 12..105, product counts and price sums for the six price windows, 6-month promo and off-promo counts and price sums, and the promo price index at weeks 89 and 104.
--    scripts/verify-tier.mjs also checks that the competitors' tier sales do not exceed all competitors' sales in the tier.

-- V) Key products by price tier (data-tier-skus.js): same tier CTE as S). Per category x tier: the 3 best-selling Britax group ASINs and the 5 best-selling competitor ASINs by sales over weeks 80..105 (ASINs with a 52-week baseline: median weekly price over weeks 54..105,
--    10+ weeks of 2+ units), with units per week over weeks 93..105, the 52-week average selling price (sales / units) and the weekly price (sales / units where units >= 2) for weeks 54..105.
--    data-skus.js (top products by sales, not by tier) and data-range.js (price range by category) were removed.

-- W) Month selector, price anchors (data-anchor-asp.js): one block per selectable month (Jan 2026 to the latest month). A week counts in the month its Saturday falls in. Query below is run with the anchor list (month index = year*12 + month-1, e.g. 24312 = Jan 2026);
--    the prior-year window only uses weeks that have a 2026 counterpart (date_add(WEEK_START_DATE,364) <= latest week start) so the latest month reproduces data-asp.js / data-tier-asp.js (checked by scripts/verify-anchor.mjs).
--    Month, share, sales and tier-share figures are computed in the browser from the weekly files (data-weekly.js, data-tier-weekly.js, data-brand-weekly.js), so they need no anchor.
--    Still precomputed for the latest week only (flagged on the page when an earlier month is selected): promo on / off-promo prices and their 12-month baseline, Prime-event price index, elasticity weights, key products by tier.
WITH f AS (SELECT year(date_add(WEEK_START_DATE,6))*12+month(date_add(WEEK_START_DATE,6))-1 em, year(date_add(WEEK_START_DATE,370))*12+month(date_add(WEEK_START_DATE,370))-1 emp,
  CASE CATEGORY WHEN 'Car Seats' THEN 0 WHEN 'Strollers' THEN 1 WHEN 'Travel Systems' THEN 2 WHEN 'Accessories' THEN 3 END si, ASIN asin, BRAND brand, CLIENT_FLAG='client' isb, SALES_ESTIMATES_TOTAL s, UNIT_ESTIMATES_TOTAL u
 FROM client_catalog.marketshare_cubes.ms_estimations_metadata WHERE CLIENT_ID=1224 AND WEEK_START_DATE>=DATE'2024-01-07' AND BRAND IS NOT NULL AND CLIENT_FLAG IN ('client','comp') AND UNIT_ESTIMATES_TOTAL>0 AND SALES_ESTIMATES_TOTAL>0),
g AS (SELECT * FROM f WHERE si IS NOT NULL),
ap AS (SELECT si, asin, SUM(s)/SUM(u) p FROM g GROUP BY 1,2),
t AS (SELECT si, asin, CASE si WHEN 0 THEN CASE WHEN p<160 THEN 0 WHEN p<290 THEN 1 ELSE 2 END WHEN 1 THEN CASE WHEN p<200 THEN 0 WHEN p<550 THEN 1 ELSE 2 END WHEN 2 THEN CASE WHEN p<315 THEN 0 WHEN p<450 THEN 1 ELSE 2 END ELSE CASE WHEN p<25 THEN 0 WHEN p<75 THEN 1 ELSE 2 END END tier FROM ap),
sel AS (SELECT * FROM VALUES (0,'Graco'),(0,'Evenflo'),(0,'Safety 1st'),(0,'Chicco'),(0,'Baby Trend'),(1,'Uppababy'),(1,'Graco'),(1,'Mompush'),(1,'Delta Children'),(1,'Mamazing'),(2,'Graco'),(2,'Evenflo'),(2,'Baby Trend'),(2,'Joie'),(2,'Chicco'),(3,'Uppababy'),(3,'JL Childress'),(3,'Graco'),(3,'Momcozy'),(3,'Shynerk') AS t(si,b)),
anch AS (SELECT * FROM VALUES (24312),(24313),(24314) -- add one value per month AS t(a)),
a AS (SELECT an.a, g.si, t.tier, g.isb, g.brand, g.asin,
  SUM(CASE WHEN g.em BETWEEN (an.a DIV 12)*12 AND an.a THEN g.s END)/SUM(CASE WHEN g.em BETWEEN (an.a DIV 12)*12 AND an.a THEN g.u END) p_ytd,
  SUM(CASE WHEN g.emp BETWEEN (an.a DIV 12)*12 AND an.a THEN g.s END)/SUM(CASE WHEN g.emp BETWEEN (an.a DIV 12)*12 AND an.a THEN g.u END) p_pytd,
  SUM(CASE WHEN g.em=an.a THEN g.s END)/SUM(CASE WHEN g.em=an.a THEN g.u END) p_m,
  SUM(CASE WHEN g.em=an.a-1 THEN g.s END)/SUM(CASE WHEN g.em=an.a-1 THEN g.u END) p_pm
  FROM g JOIN t ON t.si=g.si AND t.asin=g.asin CROSS JOIN anch an GROUP BY 1,2,3,4,5,6),
x AS (SELECT a.*, b.bg, tt.tr FROM a LATERAL VIEW explode(array(CASE WHEN isb THEN 'Britax group' ELSE brand END, CASE WHEN NOT isb THEN 'All competitors' END)) b AS bg LATERAL VIEW explode(array(tier, 9)) tt AS tr WHERE b.bg IS NOT NULL),
w AS (SELECT x.a, x.si, x.tr, x.bg, COUNT(p_ytd) n1, COALESCE(SUM(p_ytd),0) t1, COUNT(p_pytd) n2, COALESCE(SUM(p_pytd),0) t2, COUNT(p_m) n3, COALESCE(SUM(p_m),0) t3, COUNT(p_pm) n4, COALESCE(SUM(p_pm),0) t4
  FROM x LEFT JOIN sel ON sel.si=x.si AND sel.b=x.bg WHERE x.bg IN ('Britax group','All competitors') OR sel.b IS NOT NULL GROUP BY 1,2,3,4)
SELECT concat(CAST(a DIV 12 AS STRING),'-',lpad(CAST(a%12+1 AS STRING),2,'0'),'|',CAST(si AS STRING),'|',CASE WHEN tr=9 THEN 'A' ELSE CAST(tr AS STRING) END,'|',bg,'|',array_join(array(CAST(n1 AS STRING),CAST(ROUND(t1) AS STRING),CAST(n2 AS STRING),CAST(ROUND(t2) AS STRING),CAST(n3 AS STRING),CAST(ROUND(t3) AS STRING),CAST(n4 AS STRING),CAST(ROUND(t4) AS STRING)),',',''),'|',
 CAST(CAST(n1+ROUND(t1)+n2+ROUND(t2)+n3+ROUND(t3)+n4+ROUND(t4) AS BIGINT) AS STRING)) row FROM w WHERE n1+n2+n3+n4>0 ORDER BY a, si, tr, bg
;
