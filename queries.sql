-- Britax US (client 1224) competitive pricing: queries behind data.js
-- Source: client_catalog.marketshare_cubes.ms_estimations_metadata (one row per ASIN x week, unique key verified).
-- Window is anchored on the latest week in the data: weeks [mx - 357 days, mx], 52 weeks.
-- Segment index: 0 Convertible, 1 Booster, 2 Infant, 3 Strollers > Other, 4 Strollers > Double, 5 Travel Systems.
-- Britax group = BRAND = 'Britax'; competitors = CLIENT_FLAG = 'comp'; Bob Gear (client_flag 'client') is excluded from both.
-- ASP = SUM(SALES_ESTIMATES_TOTAL) / SUM(UNIT_ESTIMATES_TOTAL).

-- 1) weekly Britax vs competitor ASP and units per segment  -> data.js "weekly"
WITH b AS (SELECT MAX(WEEK_START_DATE) mx FROM client_catalog.marketshare_cubes.ms_estimations_metadata WHERE CLIENT_ID = 1224),
f AS (
  SELECT datediff(WEEK_START_DATE, date_sub(b.mx, 357)) / 7 wi,
         CASE concat(CATEGORY, ' > ', COALESCE(SUB_CATEGORY_1, 'All'))
           WHEN 'Car Seats > Convertible Car Seats' THEN 0 WHEN 'Car Seats > Booster Car Seats' THEN 1
           WHEN 'Car Seats > Infant Car Seats' THEN 2 WHEN 'Strollers > Other Strollers' THEN 3
           WHEN 'Strollers > Double Strollers' THEN 4 WHEN 'Travel Systems > All' THEN 5 END si,
         BRAND = 'Britax' isb, CLIENT_FLAG = 'comp' isc, SALES_ESTIMATES_TOTAL s, UNIT_ESTIMATES_TOTAL u
  FROM client_catalog.marketshare_cubes.ms_estimations_metadata, b
  WHERE CLIENT_ID = 1224 AND WEEK_START_DATE >= date_sub(b.mx, 357) AND WEEK_START_DATE <= b.mx)
SELECT wi, si,
       SUM(CASE WHEN isb THEN s END) / NULLIF(SUM(CASE WHEN isb THEN u END), 0) britax_asp,
       SUM(CASE WHEN isc THEN s END) / NULLIF(SUM(CASE WHEN isc THEN u END), 0) comp_asp,
       SUM(CASE WHEN isb THEN u END) britax_units, SUM(CASE WHEN isc THEN u END) comp_units
FROM f WHERE si IS NOT NULL GROUP BY 1, 2;

-- 2) brand x segment: sales, units, last-13-week ASP (wi >= 39) and prior-13-week ASP (wi 26..38) -> data.js "brands"
--    Same CTE as (1) with BRAND added; keep the top 14 brands by sales plus Britax and Bob Gear.

-- 3) Britax top 40 ASINs by sales: 52-week ASP, last/prior 13-week ASP, weekly low/high ASP (weeks with >= 3 units) -> data.js "skus"
--    Same CTE as (1) with ASIN and TITLE added; filter BRAND = 'Britax'.

-- Validation used: Britax est. sales 2025-10-19..2026-10-04 = $27.66M, 118,365 units (ASP $233.65)
--   vs client_catalog.aramus.sales_diagnostic_details CLIENT_ID 1224 ordered revenue $35.71M, 141,017 units (ASP $253.2).
