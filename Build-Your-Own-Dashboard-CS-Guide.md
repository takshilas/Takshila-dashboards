# Build your own client dashboard with Claude Code

*The CommerceIQ CS playbook · v2, October 2026 · owner: Kenan Kaymakcan · internal, don't share outside CommerceIQ*

This file is the only document you need. It assumes two things:
- you have **Claude Code** installed,
- you have **Databricks** access.

Everything else is here: how to set up, how to ask, which table holds what, the SQL that's been proven to work, the traps that have caused wrong numbers before, and how to ship safely to a client.

> **How to use it.** Save this file in the folder where you build. Start every Claude Code session with:
> *"Read Build-Your-Own-Dashboard-CS-Guide.md first and follow it."*
> Claude then knows the tables, the rules and the checks, and you can talk to it in plain English.

The guide comes from about 80 client dashboards built this way in 2026:
- Gap Explorers
- Prime Day trackers
- the Andon monitor
- content compliance
- Net PPM
- PRA overviews
- competitive recaps

Every trap in section 9 has produced a wrong number at least once.

---

## Contents

**Part 1 — Start here**
1. [What you can build](#1-what-you-can-build)
2. [How it works](#2-how-it-works)
3. [One-time setup](#3-one-time-setup)
4. [Your first dashboard, step by step](#4-your-first-dashboard-step-by-step)
5. [Writing a good prompt](#5-writing-a-good-prompt)

**Part 2 — The data map**

6. [Orientation: catalogs, querying, client ids, freshness](#6-orientation)
7. [Table reference by business question](#7-table-reference-by-business-question)
8. [SQL recipes that are proven to work](#8-sql-recipes)
9. [The traps (read before you trust a number)](#9-the-traps)

**Part 3 — Build and ship**

10. [How a CS dashboard is built](#10-how-a-cs-dashboard-is-built)
11. [Checking the numbers](#11-checking-the-numbers)
12. [Shipping safely to a client](#12-shipping-safely-to-a-client)
13. [Changes after launch, and when to ask for help](#13-changes-after-launch-and-when-to-ask-for-help)

**Part 4 — Reference**

14. [Prompt library](#14-prompt-library)
15. [Checklist before you send a link](#15-checklist-before-you-send-a-link)
16. [Glossary](#16-glossary)
17. [Appendix: the Databricks query helper](#17-appendix-the-databricks-query-helper)

---

# Part 1 — Start here

## 1. What you can build

If the data is in Databricks, you can usually have a first version of a dashboard in an afternoon. Examples already live with clients:

| Dashboard | The question it answers | Main tables |
|---|---|---|
| **Sales Gap Explorer** | Where did sales move vs last year, the prior period or the plan, and why: traffic, conversion or price? | `aramus.sales_diagnostic_details` |
| **Prime Day / event tracker** | How is the event pacing, hour by hour, vs last year's event and the lead-in? | `avc.item_sales_event_change` |
| **Competitive event recap** | How did competitors do on our client's searches, what promos did they run, how did they rank? | `core_daily_sku_search`, `core_daily_sku_detail`, roster |
| **Andon / suppression monitor** | Which listings did Amazon take down while it still held stock, and what did it cost? | daily sales, `inventory_health`, ticket replies |
| **Content compliance** | Which products fail title, image, bullet or A+ checks at each retailer? | `edm_derived.dsa_scorecard_final_display` |
| **Net PPM explorer** | Which ASINs drag blended Net PPM down, and how did it move vs last year? | `aramus.net_ppm`, shipped revenue |
| **PRA / shortage overview** | How much did we recover, and in which month was the money paid back? | the PRA payment and dispute tables |
| **Share of search** | What share of page 1 does the client own, organic vs sponsored, by keyword? | `ams_cubes.sov_search_term_level_performance_post_output` |
| **Availability / buy box** | Which SKUs are out of stock or losing the buy box, to whom, and what is it costing? | `asin_esm_workbench`, intraday buy-box table |

Each one does a few things well:
- answers **one** business question,
- uses the **client's own taxonomy** where CIQ has it,
- **matches the CIQ platform**, or says exactly why not,
- sits behind a **password**.

## 2. How it works

```
 You (plain English)  ──►  Claude Code  ──►  Databricks (the CIQ data lake)
                              │                     │
                              │  writes SQL, checks │
                              │  the numbers        ▼
                              ├──►  a small web app (Next.js) running on your laptop
                              │
                              └──►  Vercel  ──►  https://<name>.vercel.app  (password-protected)
```

- **Claude Code** reads this file, writes and runs SQL, builds the app, and checks its own numbers. Use it from the **Claude desktop app → Code** tab.
- **Databricks** holds CIQ's data. Your personal access token lets Claude query it.
- **Vercel** hosts the finished app on a link you can send. Every app has a password, and every viewer gives an email at login.

## 3. One-time setup

1. **Claude Code:** install the Claude desktop app, sign in with your CommerceIQ account, and open the **Code** tab.
2. **Node.js 20+:** `brew install node`, then check with `node -v`.
3. **Databricks:** you need read access to `client_catalog` and `common_catalog`. Three values go into a file called `.env.local` in each app folder:
   ```
   DATABRICKS_HOST=https://dbc-b3e2823d-6d7a.cloud.databricks.com
   DATABRICKS_WAREHOUSE_ID=88a298e586f4e513
   DATABRICKS_TOKEN=<your personal access token: Databricks → User settings → Developer → Access tokens>
   ```
   The host and warehouse are the ones our dashboards use today. If yours differ, take them from *SQL Warehouses → your warehouse → Connection details*.
4. **Test it.** Ask Claude: *"Using the helper in section 17 of the guide, run `SELECT current_date()` against Databricks."* The first query of the day can take 30–60 seconds while the warehouse wakes up.
5. **Vercel:** create an account with your work email and run `npx vercel login` once. Ask Kenan which Vercel team client-facing dashboards should live in.

> **Your token is a password.** It lives only in `.env.local`. Never paste it into Slack, a doc, an email or Claude's chat box. Never commit it. If you ever see it printed on screen, rotate it in Databricks.

## 4. Your first dashboard, step by step

**Step 1 · Ask.** Open Claude Code in an empty folder and describe the dashboard (template in section 5). Keep version 1 small: one question, one client, one page.

**Step 2 · Plan and find the data.**
> *"Read the guide. Find this client's ids (recipe R1) and confirm which tables have data up to yesterday. Tell me your plan in 5 bullets before building."*

Check the plan: client ids, date window, the metric definitions. Correct anything that's off.

**Step 3 · Build and preview.**
> *"Build it following section 10 of the guide. Run it locally and show me a screenshot."*

Ask for changes in plain English: *"weekly not daily"*, *"add conversion"*, *"sort by revenue lost"*.

**Step 4 · Check the numbers** (section 11). Never skip this.
> *"Recompute the headline numbers with a separate SQL query and show both side by side. Then compare last week's total with the CIQ platform."*

**Step 5 · Ship.**
> *"Deploy to Vercel as `<client>-<topic>` with password `<password>`. Check the link asks for a password and that no other client's name appears anywhere, including the login page and the Slack preview text."*

Send the link and the password to the client separately.

**Step 6 · Register.** Send Kenan the dashboard name, client, URL and a one-line description, so it goes into the Dashboard List that tracks adoption.

## 5. Writing a good prompt

```
Build a dashboard for [CLIENT] ([market, e.g. Amazon US]) that answers: [the one question].

Audience: [who reads it: the client's brand team / their exec / our CSM].
Data: [table if you know it, or "use the guide's data map"]. Client: [name; Claude finds the ids with recipe R1].
Show:
  - [headline numbers, e.g. revenue, units, conversion for the latest week vs prior week and vs last year]
  - [a chart, e.g. 13-week trend]
  - [a table, e.g. top 25 ASINs with change vs last year, sortable, exportable]
Hierarchy: [the client's own taxonomy if CIQ has it: section 7.11].
Filters: [date range, category, ASIN search, retailer...].
Rules: follow the guide; windows from the latest data, never hard-coded dates; "—" for missing, never 0;
       check every headline number with a separate query before showing me.
Ship: password [password], deploy to Vercel as [name].
```

Habits that make the biggest difference:
- **Paste the client's words and screenshots.** Claude reads both.
- **Say what "right" looks like:** *"Last week's revenue in the platform was $1.23M; the dashboard must match."*
- **Name the metric precisely.** "Sales" could be ordered revenue, shipped revenue or CIQ OPS. They differ (section 7.1).
- **One change per message** once the app exists.
- **Make Claude challenge itself:** *"What could make these numbers wrong? Check each one."*

---

# Part 2 — The data map

## 6. Orientation

### 6.1 Catalogs: where things live

| Catalog | What it is | Use it? |
|---|---|---|
| `client_catalog` | Client-partitioned product data: `aramus` (Amazon vendor retail), `avc` (Vendor Central API layer, incl. the hourly feed), `ams_cubes` (Amazon ads + SOV), `brands_cubes`/`brands_base` (app widgets, PRA, taxonomy), `edm_derived` (DSA scorecards), `marketshare_cubes`, `target_rms_*`, `dvt` (automation trackers), `cs_tools` (our writable area) | **Yes, primary** |
| `common_catalog` | Cross-client and shared: `core` (the crawl warehouse: search, product pages, availability, roster, promos), `pim` (client-approved copy), `datalake` (reviews), `efundamentals` (DSA tenant registry), `gather_data` | **Yes** |
| `admin_catalog` | `ciq.parent_child_mapping` (parent ↔ child instance ids) | For id lookup |
| `ciq_data_share_catalog` | The curated DaaS share. Some tables are empty (e.g. `datalake.reviews`) | Only after checking it has rows |
| `client_view_catalog`, `common_view_catalog` | Row-scoped views. **They return 0 rows for our tokens, with no error** | **Never** |

**Ignore these patterns:**
- schemas named `temp*`;
- tables named `e[0-9]+__*` (per-execution artifacts);
- `*backup*`, `*_bk*`, `__staging_*`, `*_dev0*`;
- date-suffixed clones (`*_2025_10_23`);
- BI artifacts `*_pivot`, `*_unpivot`, `*_timeslice`, `*_py_*`, `*_monthly`, `*_qtr`.

**`fresh_*` tables are Amazon Fresh** (the grocery business line), not "recent data".

**Product usage (Heap) is not in Databricks.** It lives in Snowflake (`HEAP_MAIN_PRODUCTION.heap.pageviews`), and every Databricks look-alike is dead.

### 6.2 How Claude queries Databricks

- Use the **SQL Statement Execution API** through the helper in section 17. It handles warehouse wake-up, polling and result chunks.
- **Cold start:** the first query after idle can take 30–60 s. A timeout on the first try is normal; retry.
- **Result size:** a result defaults to 100,000 rows (raise `rowLimit` if needed), and one inline result is capped at about 25 MB. Aggregate in SQL. For big pulls, split the query (e.g. fetch product titles separately).
- **The dialect is Spark SQL.** Patterns that work:
  - `DATE'2026-06-23'`, `TIMESTAMP'2026-06-23 07:00:00'`, `date_sub(current_date(), 30)`
  - `from_utc_timestamp(START_TIME, 'America/Los_Angeles')` converts UTC to local time
  - `QUALIFY ROW_NUMBER() OVER (PARTITION BY … ORDER BY …) = 1` keeps the latest row per key
  - `dayofweek(d)` returns 1 = Sunday … 7 = Saturday
  - backticks for column names with spaces: `` `WEEK ENDING` ``
  - arrays: `size(arr) > 0`, `array_contains(arr, 'x')`, `explode(arr)`, `array_join(arr, ',')`
- **Escaping quotes: `''` does NOT work here.** `'Elmer''s'` silently matches nothing. Use `'Elmer\'s'`.
- Always use the **full three-part name** (`client_catalog.aramus.sales_diagnostic_details`). Bare `aramus.…` fails.

### 6.3 Client identity: the most common source of wrong numbers

CIQ has **three kinds of client key**, and different tables use different ones:

| Key | Looks like | Where it's used | Where to look it up |
|---|---|---|---|
| **Numeric instance id** (`CLIENT_ID`, sometimes `CLIENTDETAILSID` or `client_id`) | `538`, `994`, `1965` | `aramus.*`, `avc.*`, `ams_cubes.*`, `brands_cubes.*`, `edm_derived.*` (numeric `client_id`), `marketshare_cubes.*`, `dvt.*`, taxonomy tables | `client_catalog.aramus.client_details` (`CLIENT_ID`, `CLIENT` slug, `ENV`, `ACCOUNT`, `AVC_LOCATION`) |
| **Crawl/DSA slug** | `'mondelez-us'`, `'ferrero-usa'`, `'meta-us'` | `common_catalog.core.core_client_products`, `core_client_search_terms`, `promo_sku_details_precomputed`, `datalake.reviews`, `pim.pim_config_client_mapping`, `efundamentals.*`, DSA `client_dsa` | `SELECT DISTINCT client_id FROM common_catalog.core.core_client_products WHERE client_id LIKE '%name%'` |
| **Platform settings id** | numeric, but a DIFFERENT space | `client_catalog.client_settings.*` only | **Never join it to the others.** The same number means a different client |

**One client usually has several instance ids, and each feed can sit on a different one:**
- **Parent and child accounts:** `admin_catalog.ciq.parent_child_mapping` (`parent_client_id`, `child_client_id`) gives the pairs.
- **The hourly feed is often on the parent and daily sales on a child.** Examples seen:
  - hourly on 946, daily on 949 + 1109 (summed);
  - hourly on 704, daily on 4654;
  - hourly and buy-box loss on 5289, daily sales on 5290.
- **Ads and CIQ OPS are usually on the parent id; retail on the child.**
- **The client taxonomy can be on the parent** (e.g. 704) **or on the instance itself** (e.g. 538).
- **Re-onboarding creates a NEW id**, and the old one's history freezes. Stitch them with a date cutover:
  `(CLIENT_ID = new AND FEED_DATE >= cutover) OR (CLIENT_ID = old AND FEED_DATE < cutover)`.
- **The same vendor feed can be onboarded under two ids with byte-identical rows.** For example, Hallmark 871 is a strict subset of 870. Summing them double-counts. Before adding ids together, check overlap (recipe R1, step 4).
- **A slug in the crawl world can differ from the `CLIENT` slug in `client_details`.** For example, numeric 953 'mondelez' vs crawl slug 'mondelez-us'.

**Rule:** before building, run recipe R1 and write down, per table, which id is live up to yesterday.

### 6.4 Freshness: check it every time

- **Typical lag:**
  - the daily vendor tables are T-2;
  - the ads cubes are T-1;
  - the hourly feed lands about 10 minutes after each hour closes;
  - the crawl tables land overnight (day D arrives around 01:00 UTC on D+1).
- **Probe `MAX(date)` per client id per table** before trusting a window. A feed can die for one client while the table looks healthy for others.
- **The latest day is often partial.** Compare its row count with the previous days.
- **A moving date doesn't prove fresh data.** Some tables re-stamp the date daily with a frozen payload. Check the spread of the values too: `COUNT(DISTINCT metric)` over the last 30 days.

---

## 7. Table reference by business question

Each entry gives the grain, the key columns, which id type it uses, and the trap to watch. The full name is always `catalog.schema.table`.

### 7.1 Amazon retail sales (daily)

**`client_catalog.aramus.sales_diagnostic_details`** is THE daily retail table.
- **Grain:** `CLIENT_ID` × `FEED_DATE` × `ASIN`. Partitioned by (CLIENT_ID, FEED_DATE). Numeric child ids. Fresh at about T-2.
- **Columns:** `ASIN`, `PRODUCT_TITLE`, `BRAND`, `CATEGORY`, `SUB_CATEGORY`, `ORDERED_REVENUE`, `ORDERED_UNITS`, `GLANCEVIEWS`, `CONVERSION_RATE`, `AVERAGE_SELLING_PRICE_ORDERED_UNITS`, `PARENT_ASIN`, `UPC`, `EAN`.
  - It also carries precomputed `*_PRIOR_PERIOD_PERCENT_CHANGE` / `*_PRIOR_YEAR_PERCENT_CHANGE` columns. Compute your own instead.
- **KPI math:**
  - ASP = Σrevenue / Σunits
  - conversion = Σunits / Σglance views
  - a "% column" averaged across rows is wrong; weight by glance views
- ⚠ **`REP_OOS` and `LOSTBUYBOX` here are dead** (nulled from 2026-07). Use `asin_esm_workbench` (7.4).
- ⚠ **Ordered units only.** Shipped units are in the sibling table below.

**`client_catalog.aramus.sales_diagnostic_shipped_revenue`** has the same keys and grain.
- **Columns:** `SHIPPED_REVENUE`, `SHIPPED_UNITS`, `ORDERED_UNITS` (identical to the table above), `CUSTOMER_RETURNS`, `FREE_REPLACEMENTS`, `AVERAGE_SALES_PRICE`, `LBB_PRICE`.
- Use it whenever a shipped figure is needed: Net PPM weighting, Subscribe & Save adoption.

**CIQ OPS**, the number the platform and the CS GDR report, = **`client_catalog.ams_cubes.asin_esm_workbench.ORDERED_REVENUE`** summed on the **parent/instance id** by `REPORT_DATE`.
- It is scoped to the instance's own catalog, so it can be lower than the raw vendor feed.
- The latest `REPORT_DATE` often has NULL revenue for a day.
- **Rule:** if a client compares to "OPS" in the platform, use this. If they compare to their Vendor Central download, use `sales_diagnostic_details`.

**`client_catalog.brands_cubes.sales_dashboard_widget_data`** is the ESM Sales Dashboard cube.
- It sits on parent ids and is the union of the children's feeds, with each ASIN-day once.
- Its `ORDERED_PRODUCT_SALES` column is a legacy sibling with NULL days. Don't use it as OPS.

### 7.2 Hourly sales (events, Prime Day, live tracking)

**`client_catalog.avc.item_sales_event_change`** is the Amazon vendor real-time sales feed, and the only hourly sales data in the lake.
- **Columns:** `CLIENT_ID`, `MARKETPLACE_ID`, `CURRENCY_CODE`, `START_TIME`, `END_TIME` (the hour window), `ASIN`, `ORDERED_UNITS`, `ORDERED_REVENUE`, `PUBLISH_TIME`, `INGESTION_TIME`.
- **Three rules, or the numbers are wrong:**
  1. **`START_TIME` is UTC.** Convert to the market's local time before grouping by day. Without it, days are off by about 16%.
  2. **Amazon republishes hours with corrections.** Keep only the newest row per (CLIENT_ID, MARKETPLACE_ID, ASIN, START_TIME), ordered by `PUBLISH_TIME DESC, INGESTION_TIME DESC`. A naive SUM double-counts.
  3. **A market is the (CLIENT_ID, MARKETPLACE_ID) pair.** One client id carries several marketplaces.
- **Marketplace ids:**

  | Market | MARKETPLACE_ID |
  |---|---|
  | US | `ATVPDKIKX0DER` |
  | CA | `A2EUQ1WTGCTBG2` |
  | MX | `A1AM78C64UM0Y8` |
  | BR | `A2Q3Y263D00KWC` |
  | UK | `A1F83G8C2ARO7P` |
  | DE | `A1PA6795UKMFR9` |
  | FR | `A13V1IB3VIYZZH` |
  | IT | `APJ6JRA9NG5V4` |
  | ES | `A1RKKUPIHCS9HS` |
  | NL | `A1805IZSGTT6HS` |
  | SE | `A2NODRKZP88ZB9` |
  | BE | `AMEN7PMS3EDWL` |
  | IE | `A28R8C7NBKEWEA` |
  | AE | `A2VIGQ35RCS4UG` |
- **History is per market.** Some clients' EU feeds start in late 2025. Check `MIN(START_TIME)` per client × marketplace before promising year-over-year.
- **The feed has gaps.** Seen so far:
  - one client at 1–7% of normal for four days in Sep 2026;
  - one client at about 53% of daily sales during Oct 2025.

  Before trusting a window, compare the hourly totals with the daily table (recipe R4b). Where hourly is partial, keep the hourly shape but scale to the daily totals.
- It agrees with the daily table to about 0.1% when healthy.

### 7.3 Traffic, inventory, purchase orders, forecast, catalog

| Table | Grain / date column | Use it for | Trap |
|---|---|---|---|
| `client_catalog.aramus.traffic_diagnostic` | ASIN × FEED_DATE | Glance views, unique visitors, fast-track GV | T-2 |
| `client_catalog.aramus.inventory_health` | ASIN × FEED_DATE | `SELLABLE_ON_HAND_UNITS`, `UNSELLABLE_ON_HAND_UNITS`, `OPEN_PURCHASE_ORDER_QUANTITY`, `SELL_THROUGH_RATE`, aged/unhealthy inventory | A daily snapshot: don't SUM across days |
| `client_catalog.aramus.purchase_orders_sku_level_details_v2` | PO × ASIN, `creation_date` | Submitted / accepted / received / outstanding cases, costs, backorders | **Use `_v2`**; v1 and `po_details` are dead |
| `client_catalog.aramus.forecast_and_inventory_planning` | ASIN × FEED_DATE | `WEEKS_ON_HAND`, `UNFILLED_CUSTOMER_ORDERED_UNITS`, `MEAN_/P70_/P80_/P90_FORECAST_WEEK_01..26`, `OPEN_PURCHASE_ORDER_QUANTITY` | **The last ~3 snapshot dates are empty shells.** Pick the latest date where `WEEKS_ON_HAND IS NOT NULL` |
| `client_catalog.aramus.catalog_listing` | ASIN × FEED_DATE | Listing snapshot: `LIST_PRICE`, `REPLENISHMENT_CODE`, `YOUR_UNITS_AT_AMAZON_WAREHOUSES` | |
| `client_catalog.brands_cubes.v2_client_workbench_full_catalogue_latest_comp_data` | ASIN × FEED_DATE (`CLIENTDETAILSID`) | One wide row per ASIN: price, promos, BSR by category, weeks of cover, shipped COGS, `DIMENSION1..100` (client taxonomy, 7.11) | One ASIN can carry several rows: take the latest per ASIN |

### 7.4 Out of stock, lost buy box, suppression (andon)

**`client_catalog.ams_cubes.asin_esm_workbench`** has one row per ASIN × day. It is fresh at T-1 and sits on parent/ads ids.
- **Availability columns:**
  - `REP_OOS` (out-of-stock %),
  - `LBB_RATE` (lost buy box, 0–100),
  - `SDD_GLANCE_VIEWS`, to weight both.
- **Other columns:**
  - `ORDERED_REVENUE` (CIQ OPS), `ORGANIC_SALES`, `CUSTOMER_ORDERS` and `UNIT_COGS` (PCOGS = CUSTOMER_ORDERS × UNIT_COGS);
  - prices: `CLIENT_OFFER_PRICE`, `SUBSCRIBE_AND_SAVE_PRICE`;
  - best-seller ranks: `CATEGORY_1..4`, `CATEGORY_n_BEST_SELLER_RANK`;
  - reviews: `TOTAL_REVIEW_COUNT`, `NEW_REVIEW_COUNT`, `AVG_PRODUCT_RATING`;
  - promotions: `PROMOTION_TYPES`, `PROMOTION_MESSAGES`;
  - `IMAGE_URL`, `PRODUCT_PAGE_URL`.
- It's the best single table for an "ASIN 360" view.

**`client_catalog.aramus.intraday_unavailability_buyboxloss_client_details`** is the live lost-buy-box feed, refreshed same-day.
- **Columns:**
  - who won the buy box: `LOST_BUYBOX_TO_SELLERNAME`, `LOST_BUYBOX_TO_SELLER_DAYS`, `LOST_BUYBOX_TIMELINE`;
  - money: `EST_REVENUE_LOST`;
  - stock: `ITEM_AVAILABILITY_STATUS`, `CURRENT_UNITS_AT_AMAZON`.
- **It is an exception list:** an ASIN appears only while it's losing the buy box, so the denominator must come from elsewhere.
- Rows repeat about 2.3× within a run, so `SELECT DISTINCT` on (day, ASIN, seller).
- `'No buybox winner'` means the listing is live but nobody is winning. That's a third state, not a loss.
- ⚠ Its non-intraday twin `unavailability_buyboxloss_client_details` has been frozen since 2022.

**Andon / suppression:**
- No andon feed exists. `ANDON_CORD_FLAG` is never filled.
- Explicit andon labels exist only in Amazon's replies to CIQ suppression tickets:
  - **`client_catalog.dvt.automation_tracker_supressed_asins`** (`OUTCOME`, `COMMMENTS`, `TICKET_NUMBER`, `TICKET_STATUS`, `INITIATION_DATE`, `RESOLUTION_DATE`);
  - note the spelling "supressed" in the table name;
  - rows repeat per ticket, so use `DISTINCT TICKET_NUMBER`.
- **Detection signature:** ordered units drop to 0 while `inventory_health.SELLABLE_ON_HAND_UNITS` > 0, meaning Amazon holds the stock but isn't selling it.

### 7.5 Profitability: Net PPM, COGS

**`client_catalog.aramus.net_ppm`** (weekly, Saturday week-ends: `WEEK_START_DATE`, `WEEK_END_DATE`) and **`client_catalog.aramus.monthly_net_ppm`** (`MONTH_START_DATE`, `MONTH_END_DATE`).
- **Columns:** `ASIN`, `NET_PPM`, `SUBCATEGORY`, `PRODUCT_TITLE`.
- ⚠ `NET_PPM_PRIOR_PERIOD` and `NET_PPM_LAST_YEAR` are **NULL for every client** in the feed we receive. Compute comparisons from history yourself.
- ⚠ **Some ASIN-weeks are duplicated.** Dedupe before averaging.
- ⚠ **Amazon only publishes Net PPM for ASINs that are selling.** Missing = "no data", never 0.
  - A value of exactly 0 in a week with no shipped revenue is also "no data".
- **Multi-week or portfolio Net PPM:** weight each week by that ASIN-week's **shipped** revenue (Amazon's Net PPM is on net sales). Ordered revenue gives visibly different numbers. Recipe R13.

**PCOGS** = `asin_esm_workbench.CUSTOMER_ORDERS × UNIT_COGS`, ASIN × day. It moved there in Jul 2026; the old copies in `campaigns_asin_workbench` read NULL.

### 7.6 Advertising

| Table | Grain | Use it for | Trap |
|---|---|---|---|
| `client_catalog.ams_cubes.campaigns_asin_workbench` | client × REPORT_DATE × campaign × ad group × **ad** × ASIN | Ad sales/spend by ASIN: `ATTRIBUTEDSALES{1,7,14,30}D`, `ATTRIBUTEDUNITSORDERED*`, `COST`, `CLICKS`, `IMPRESSIONS`, `CAMPAIGN_TYPE`, `PLACEMENT` | One row per AD: an ASIN-level value joined onto it fans out. Aggregate to ASIN × day first |
| `client_catalog.ams_cubes.keyword_campaigns_workbench_v2` | keyword grain | Keyword performance, bids | Prefer v2 |
| `client_catalog.ams_cubes.campaigns_campaign_workbench` | campaign × day | Campaign roll-ups | |
| `client_catalog.ams_cubes.amazon_hourly_campaigns_stream_workbench` / `_keywords_` | hourly | Dayparting | |
| `client_catalog.ams.*` | raw API reports | Only when the cubes lack a field; "missing ads data" is often a cube rebuild, not an API problem | |

- **Organic sales = ordered revenue − ad-attributed sales (14-day window)**, the official definition ("OPS − Search Ad Sales").
- Join ads to retail on **ASIN + date**, never on CLIENT_ID: ads and retail often sit on different ids.

### 7.7 Share of search (SOV)

**`client_catalog.ams_cubes.sov_search_term_level_performance_post_output`** has one row per CLIENT_ID × SEARCH_TERM × FEED_DATE × BRAND. A Walmart sibling, `walmart_cubes.sov_…`, has the same shape.
- **Columns:**
  - `CLIENT_FLAG` ('client' = the client's own brand rows);
  - slot counts `{SP,ORGANIC,SB,ALL}_{PAGE_1,TOP_2,TOP_3,TOP_5,TOP_10}_COUNT`, each with a `TOTAL_…` twin;
  - `NO_OF_CRAWLS`, `SOURCE`.
- ⚠ **Counts are per-day, crawl-averaged, fractional.** SUM across days grows with the window: divide by `COUNT(DISTINCT FEED_DATE)` computed inside the same filter.
- ⚠ **`TOTAL_*` columns are the all-brands denominator repeated on every brand row.** Take `MAX` per term-day. Never SUM them across brands (inflates about 22×).
- **Shares are safe:** `SUM(ALL_PAGE_1_COUNT) / SUM(TOTAL_ALL_PAGE_1_COUNT)`.
- For brands and competitors outside a client's SOV setup, use the raw search crawl (7.8).

### 7.8 Digital shelf crawl: search ranks, product pages, availability, promos

The crawl tables in `common_catalog.core` have **no client column**. Scope them through the client's **roster** (recipe R7).

**`common_catalog.core.core_client_products`** is the roster: the products the client tracks, competitors included.
- **Key:** `client_id` (slug) × `retailer` × `product_id`.
- **Columns:**
  - flags `client_product` (own product) and `key_competitor_product` (competitor) — these are independent booleans, so filter on the one you mean;
  - `brand`, `sub_brand`, `manufacturer`, `category`, `sub_category`, `sku_groups`, `gtin`, `weight_value`/`weight_unit`;
  - `product_name`, which is the crawled retailer title, not approved copy.
- **Always join on `product_id` AND `retailer`.** Product ids repeat across marketplaces.
- Aggregate to one row per (retailer, product_id) first.

**`common_catalog.core.core_client_search_terms`** is the client's tracked keyword list: `client_id` (slug), `search_term`, `branded` (0/1).

**`common_catalog.core.core_daily_sku_search`** is the search results crawl.
- **Grain:** date × retailer × **`journey` (= the search term)** × `rank`.
- **Columns:**
  - `product_id`, `product_name`;
  - `sponsored` (boolean);
  - `promotion_type` (e.g. `PRICE_CUT`, `COUPON`) and `promotion_text` (e.g. "was $8.44", "Save 15% with coupon", "Extra 5% off when you subscribe");
  - `price`, `currency`, `screenshot_url`.
- It covers the whole page (every brand, competitors included) for the terms crawled. Ranks run up to about 60 on Amazon, 52 on Walmart and 30 on Target.
- `journey` values are raw: always `lower(trim(journey))`.

**`common_catalog.core.core_daily_sku_detail`** is the product-page crawl. Scope it to the roster.
- **Columns:**
  - prices and promos: `price`, `original_price`, `promotion_type` (`COUPON`/`PRICE_CUT`/`MULTI_BUY`), `promotion_text`, `promotion_price`, `discount`;
  - deal badges: **`badge` (array: e.g. "Prime Day Deal", "Ends in 14:14:54" = a limited-time deal)**;
  - Subscribe & Save: `subscription`, `subscription_price`;
  - ratings: **`comment_count` (= ratings count)**, `average_rating`;
  - buy box: `seller` (the buy-box winner's name), `seller_type` (1P/3P/Not Available);
  - content: `bullet_points` (array), `product_image_count`, `has_rich_content`, `video`;
  - captures: `archive_url` (page HTML) and `screenshot_url` (both on public storage);
  - `manufacturer`, `price_per_unit`, `per_unit`, `net_quantity`.
- ⚠ Here `journey` is the crawl job name, NOT a search term.

**`common_catalog.core.core_daily_sku_listing_status`** has one row per date × retailer × product_id.
- `status` takes the values `LISTED`, `OUT OF STOCK`, `DELISTED`, `NOT SEEN` and `IGNORED`. There's also `seller_type`.
- **In-stock rate = LISTED ÷ (LISTED + OUT OF STOCK).** Say explicitly how you treat DELISTED.

**`common_catalog.core.promo_sku_details_precomputed`** holds roster-scoped promotion rows: `client_id` (slug), `date`, `retailer`, **`store_id`**, `product_id`, `promotion_type`, `promotion_text`, `promotion_price`, `original_price`, plus roster attributes.
- `promotion_type` is '' (none), `PRICE_CUT`, `MULTI_BUY`, `COUPON`, `BUNDLE`, `UNCLASSIFIED` or `EXTRA_FREE`.
- ⚠ It is **store-level** (millions of rows a day for big clients). Count distinct product-days, not rows.

**Other crawl tables:**
- **Zip-level availability:** `client_catalog.aramus.omni_product_data_output` (`ZIP_CODE`, `AVAILABILITY_STATUS`, `OFFER_PRICE`).
  - `CLIENT_ID = 0` is a shared pool.
  - Its retailer dim is `aramus.omni_retailer_info` — not `retailer_attributes`, which is a different id space.
- **Crawl configuration:**
  - `common_catalog.efundamentals.client_retailer_priority_v2` answers "which retailers is this client crawled on?";
  - `common_catalog.core.core_client_products_stores_gathered` is the store-level enrolment.

### 7.9 Content and DSA scorecards

**`client_catalog.edm_derived.dsa_scorecard_final_display`** is the DSA scorecard: content, availability, search, reviews.
- It's partitioned by **`client_id` (numeric), `date`, `scorecard_type`** (`Standard`, `Enterprise` or `Cross Market`). Always filter all three.
- It is usually T-2, but some clients' scorecards lag a week or more. Use the client's own `MAX(date)` (recipe R11 step 1).
- **Columns:**
  - who and where: `client_dsa` (slug), `client_name`, `retailer_dsa` (e.g. 'Amazon-US'; use it as the retailer label), `retailer_iso_code`;
  - the measure: `measure_group`, `measure`, `measure_display`, `score`, `score_pct`;
  - weights: `measure_weighting`, `retailer_weighting`, `retailer_brand_weight`, `retailer_measure_weight`, `search_term_weight`;
  - targets: `measure_target`, `retailer_measure_target`, `brand_measure_target`;
  - the product: `gtin`, `retailer_product_id`, `product_name`, `brand`, `sub_brand`, `category`, `search_term`, `search_group`, `assortment`, `seller_type`;
  - `aggregation`, `data_resolution`.
- **Common content measures:**
  - `has_gsn_keywords_in_title` (title keywords), `has_gsn_match` (name match);
  - `has_enough_bullet_points`, `bullet_points_tracker`, `has_description`;
  - `has_gsi_match` (hero image), `has_enough_images`;
  - `has_rich_content` (A+), `has_video`;
  - `has_good_rating`, `average_review_pct`.
- **Rules for matching the platform exactly:**
  - drop rows where `score` is NULL or any of the four weight columns is NULL;
  - "average" measures = Σ(score × weight) / Σweight;
  - "sum" measures (share of search) are SHARES: Σscore over the client's brands within each (date, search_term), ÷ the count of term-days;
  - the overall score = Σ(measure score × measure_weighting) / Σmeasure_weighting, excluding scalar measures.
- ⚠ **Measure-group names and target meaning vary by client.**
  - Groups can be 'Content', 'Content - Compliance', or even 'N/A' for one account.
  - For some accounts `measure_target` holds a weight, not a target.
  - Inspect the client's rows before writing the headline.
- ⚠ `region_name` and `retailer_group_name` are mostly NULL, so don't group by them.
- ⚠ `retailer_id` is its own id space. Never join it to a retailer dim.
- `category` often carries the client's full "Reporting Unit - Family - Line" string. Split on " - ", first two separators only.

**Client-approved copy (PIM)** is `common_catalog.pim.audit`. Map the client with `pim.pim_config_client_mapping` (slug ↔ `pim_config`, many-to-many).
- It's a daily snapshot, so take the latest `timestamp_date` per `pim_config`.
- **Normalise GTINs on both sides:** `regexp_replace(gtin,'^0+','')`.
- `status` (MATCH / MISMATCH / ERROR) is not a compliance KPI by itself.

### 7.10 Ratings and reviews

- **`common_catalog.datalake.reviews`** is the review corpus: `client_id` (slug), `retailer`, `retailer_product_id`, `review_rating`, `review_title`, `review_text`, `review_date`, `review_id`.
  - It accumulates, so dedupe on (retailer, retailer_product_id, review_id).
  - Fresh at about T-2.
- **Ratings velocity (a demand signal for competitors):** the daily change in `core_daily_sku_detail.comment_count`.
  - Amazon's "comment count" is the RATINGS count.
  - Listing merges make it jump. Drop implausible jumps (e.g. more than 10× the product's normal daily gain).
- For the client's own ASINs, `asin_esm_workbench.NEW_REVIEW_COUNT` / `TOTAL_REVIEW_COUNT`.
- ⚠ `ciq_data_share_catalog.datalake.reviews` is EMPTY. No sentiment column exists anywhere.

### 7.11 The client's own taxonomy and custom flags

This is where "Category › Sub-category", "BU › Brand", and flags like **"PBDD 2026"** or "Prime Day 2026" live.

- **Labels:** `client_catalog.brands_base.taxonomy_metadata` gives `client_id` (numeric), `dimension_column` (e.g. `dimension20`), `dimension_label` (e.g. 'PBDD 2026'), `entity_type`, `is_deleted`.
- **Values:** `client_catalog.brands_base.entity_taxonomy` gives `client_id`, `retailer` ('amazon'), `entity_type` ('catalog' for products), `entity_id` (= the ASIN), `dimension1` … `dimension100`.
- `dimension86`/`87`/`88`/`89` are the common Category / Sub Category / Brand / Sub Brand slots, often partly empty. Lower numbers are client-defined.
- Values are lower-case. Flags are usually 'yes'/'no' or a group code: anything other than empty/'no' means "flagged".
- **Labels are per client.** dimension20 is 'PBDD 2026' for one client and something else for another. Always read `taxonomy_metadata` first.
- The same `dimension_column` can carry different labels per `entity_type` (catalog vs dsp vs campaign). Use `entity_type = 'catalog'`.
- The taxonomy can be registered on the **parent** id. If the instance has no rows, check its parent.
- An alternative copy is in the workbench cube (`v2_client_workbench_full_catalogue_latest_comp_data.DIMENSION1..100`, keyed by `CLIENTDETAILSID` + `ASIN`). Take the latest row per ASIN.

### 7.12 Profit recovery (PRA), disputes, chargebacks, deductions

| Table | What | Dedupe rule / trap |
|---|---|---|
| `client_catalog.brands_cubes.shortage_invoice_reconciliation_payment_report` | Invoices, deductions, payments (the "Payments Report"). Root invoices have `INVOICE_NUMBER = ROOT_INVOICE`; `…SCR` children are re-invoiced shortfalls | Its `DISPUTE_CREATION_DATE` is NULL on recent rows: never filter on it |
| `client_catalog.brands_cubes.shortage_automation_summary_purchase_order` | PO + ASIN shortage detail with dispute status, approved, paid and remaining amounts | Parent ids |
| `client_catalog.aramus.dispute_management_invoice_summary` | Every dispute: `DISPUTE_TYPE`, `DISPUTE_AMOUNT`, `APPROVED_AMOUNT`, `DISPUTE_STATUS`, `DISPUTE_TITLE` (holds the invoice: `CIQ <invoice>SCR… DSPT<case>`) | **Snapshot-append: one row per dispute per day.** Keep the latest row per `DISPUTE_ID` or you inflate about 100× |
| `client_catalog.aramus.payments_report` | Amazon's remittance; `INVOICE_DESCRIPTION` is the only deduction-reason text in the lake | Snapshot-append: dedupe on CLIENT_ID + INVOICE_NUMBER + PAYMENT_NUMBER |
| `client_catalog.aramus.all_invoice_summary` | Every invoice document | Snapshot-append: dedupe on CLIENT_ID + INVOICE_NUMBER; collapse `SCR` chains onto the root (`regexp_replace(INVOICE_NUMBER,'(SCR)+$','')`); unpaid = `PAID_AMOUNT` NULL, not 0 |
| `client_catalog.aramus.chargeback_report_all` | Vendor chargebacks (`ISSUE_ID`, `ISSUE_TYPE`, `FINANCIAL_CHARGE`, `PURCHASE_ORDER`, `ASIN`) | Snapshot-append: dedupe on ISSUE_ID |
| `client_catalog.aramus.case_log_details` | Support cases; `LATEST_MESSAGE` holds Amazon's replies for some clients | Dedupe on CASE_ID |

⚠ Which id is live **flips with the table** for some clients: one id is live on the invoice-grain tables and another on the dispute-grain tables. Probe each.

### 7.13 Market share

- **`client_catalog.marketshare_cubes.ms_asin_weekly_combined_share_data`** has weekly, ASIN-level sales estimates for all brands in a category: `RETAIL SALES`, `UNITS SOLD`, `1P SALES`, `3P SALES`, `BRAND`, `MANUFACTURER`, categories, `WEEK ID`, `WEEK ENDING`.
  - It exists **only for clients with a Market Share subscription** (`marketshare_cubes.ms_clients`; about 22 clients serve data).
  - ⚠ `` `WEEK ENDING` `` is a dd/MM/yyyy STRING: `to_date(\`WEEK ENDING\`,'dd/MM/yyyy')`.
- **⚠ Never use another client's market share data for a different client's dashboard.** If your client has no Market Share, competitor "performance" must come from public signals: search share, deals, ratings velocity (7.8, 7.10).

### 7.14 Retail media beyond Amazon, GBO

**Target RMS:**
- `client_catalog.target_rms_ds.campaign_incrementality_report`: filter `REPORT_CALCULATION_TYPE = 'Incrementality'`, and note `CAMPAIGN_ID` here is the line-item id. It covers search placements only.
- `target_rms_cubes.line_items_summary`: names and spend (dedupe the latest name per id).
- `target_rms_cubes.campaign_line_items_bid_budget`: the daily bid/budget snapshot.

**Other networks:**
- `client_catalog.criteo.*` (generic Criteo-network clients; dim `criteo.client_attributes`);
- `client_catalog.rmm_edm.campaigns_performance` (ramping, partial).

**GBO bid/budget actions** (old → new): `client_catalog.edm.omni_bid_budget_actions` (`status = 'SUCCEEDED'`) and `client_catalog.aramus_ds.gbo_v1_budget_change_actions_table`. Both are live from 2026-07-14.

### 7.15 Where you can write: client files

- **`client_catalog.cs_tools.*`** (and `common_catalog.cs_tools`, `*.temp`) are the only schemas our token can CREATE / INSERT / DELETE in. Every production schema refuses writes.
- Load a client's plan, ASIN list or taxonomy workbook into its own table with `loaded_at` and `source` columns.
- Reload idempotently: delete by `source`, then insert. Recipe R16.
- Check the table names already there first, and never overwrite another tool's table.

### 7.16 Dead or misleading tables (don't build on these)

| Looks useful | Reality | Use instead |
|---|---|---|
| `aramus.sales_diagnostic_details_materialized_view` | Dead since 2025 | `sales_diagnostic_details` |
| `sales_diagnostic_details.LOSTBUYBOX` / `REP_OOS` | Nulled from 2026-07 | `asin_esm_workbench.LBB_RATE` / `REP_OOS` |
| `campaigns_asin_workbench.CUSTOMER_ORDERS` / `UNIT_COGS` | NULL since 2026-07 | `asin_esm_workbench` |
| `aramus.unavailability_buyboxloss_client_details` | Frozen 2022 | the `intraday_` version |
| `aramus.purchase_orders_sku_level_details` (v1), `po_details` | Dead | `_v2` |
| `aramus.view_shortage_dispute` | Frozen 2023 | `shortage_automation_summary_purchase_order` |
| `ciq_data_share_catalog.datalake.reviews` | Empty | `common_catalog.datalake.reviews` |
| `common_catalog.jira_integration.*` | Stale since 2025-04 | Jira itself |
| `scorecard_factory.*`, `score.*` | Pipeline staging, empty or frozen | `dsa_scorecard_final_display` |
| Heap tables in Databricks; `analytics.planhat_login_daily` | Dead, or a frozen payload with a moving date | Heap is in Snowflake |
| `edm.benchmark_metrics`, `esm_edm.benchmark_unified` | Target-only and stale / never filled | No anonymized Amazon benchmark exists |

---

## 8. SQL recipes

Replace `{id}` (numeric instance id), `{slug}` (crawl slug), dates and names. These are proven patterns; adapt them, don't reinvent them.

### R1 · Find a client's ids and what's live

```sql
-- 1. Candidate numeric ids
SELECT CAST(CLIENT_ID AS INT) id, CLIENT, ACCOUNT, AVC_LOCATION
FROM client_catalog.aramus.client_details
WHERE lower(CLIENT) LIKE '%hills%' OR lower(ACCOUNT) LIKE '%hills%'
ORDER BY 1;

-- 2. Parent / child pairs
SELECT parent_client_id, child_client_id FROM admin_catalog.ciq.parent_child_mapping
WHERE parent_client_id IN (538, 5121) OR child_client_id IN (538, 5121);

-- 3. Which id is live in which table (last 30 days)
SELECT 'daily sales' src, CAST(CLIENT_ID AS INT) id, CAST(MAX(FEED_DATE) AS STRING) latest, COUNT(DISTINCT ASIN) asins
FROM client_catalog.aramus.sales_diagnostic_details WHERE CLIENT_ID IN ({ids}) AND FEED_DATE >= current_date() - 30 GROUP BY 1, 2
UNION ALL
SELECT 'hourly ' || MARKETPLACE_ID, CAST(CLIENT_ID AS INT), CAST(MAX(START_TIME) AS STRING), COUNT(DISTINCT ASIN)
FROM client_catalog.avc.item_sales_event_change WHERE CLIENT_ID IN ({ids}) AND START_TIME >= current_timestamp() - INTERVAL 30 DAYS GROUP BY 1, 2
UNION ALL
SELECT 'ops/workbench', CAST(CLIENT_ID AS INT), CAST(MAX(REPORT_DATE) AS STRING), COUNT(DISTINCT ASIN)
FROM client_catalog.ams_cubes.asin_esm_workbench WHERE CLIENT_ID IN ({ids}) AND REPORT_DATE >= current_date() - 30 GROUP BY 1, 2
UNION ALL
SELECT 'ads', CAST(CLIENT_ID AS INT), CAST(MAX(REPORT_DATE) AS STRING), COUNT(DISTINCT ASIN)
FROM client_catalog.ams_cubes.campaigns_asin_workbench WHERE CLIENT_ID IN ({ids}) AND REPORT_DATE >= current_date() - 30 GROUP BY 1, 2;

-- 4. Before SUMMING two ids: do they carry the same rows? (100% identical = one feed onboarded twice → use one)
SELECT COUNT(*) shared_keys, SUM(CASE WHEN a.ORDERED_REVENUE = b.ORDERED_REVENUE THEN 1 ELSE 0 END) identical
FROM client_catalog.aramus.sales_diagnostic_details a
JOIN client_catalog.aramus.sales_diagnostic_details b ON a.ASIN = b.ASIN AND a.FEED_DATE = b.FEED_DATE
WHERE a.CLIENT_ID = {id_a} AND b.CLIENT_ID = {id_b} AND a.FEED_DATE >= current_date() - 30;

-- 5. Crawl / DSA slugs
SELECT DISTINCT client_id FROM common_catalog.core.core_client_products WHERE client_id LIKE '%hill%';
SELECT DISTINCT client_id, client_dsa, client_name, scorecard_type FROM client_catalog.edm_derived.dsa_scorecard_final_display
WHERE date >= date_sub(current_date(), 14) AND lower(client_name) LIKE '%hill%';
```

### R2 · Weekly KPIs: latest complete week vs prior week vs same week last year

```sql
WITH w AS (   -- the latest Saturday on or before the newest data (weeks run Sun–Sat)
  SELECT date_sub(MAX(FEED_DATE), dayofweek(MAX(FEED_DATE)) % 7) we
  FROM client_catalog.aramus.sales_diagnostic_details WHERE CLIENT_ID = {id})
SELECT CASE WHEN s.FEED_DATE BETWEEN date_sub(w.we, 6)   AND w.we                THEN '1 this week'
            WHEN s.FEED_DATE BETWEEN date_sub(w.we, 13)  AND date_sub(w.we, 7)   THEN '2 prior week'
            WHEN s.FEED_DATE BETWEEN date_sub(w.we, 370) AND date_sub(w.we, 364) THEN '3 same week LY' END period,
       SUM(ORDERED_REVENUE) revenue, SUM(ORDERED_UNITS) units, SUM(GLANCEVIEWS) glance_views,
       SUM(ORDERED_UNITS) / NULLIF(SUM(GLANCEVIEWS), 0) conversion,
       SUM(ORDERED_REVENUE) / NULLIF(SUM(ORDERED_UNITS), 0) asp
FROM client_catalog.aramus.sales_diagnostic_details s CROSS JOIN w
WHERE s.CLIENT_ID = {id}
  AND (s.FEED_DATE BETWEEN date_sub(w.we, 13) AND w.we OR s.FEED_DATE BETWEEN date_sub(w.we, 370) AND date_sub(w.we, 364))
GROUP BY 1 ORDER BY 1;
```
Last year is **364 days back** (same weekday), as Vendor Central does.

### R3 · Sales drill tree in one query (brand › sub-category › ASIN)

```sql
WITH b AS (SELECT MAX(FEED_DATE) d FROM client_catalog.aramus.sales_diagnostic_details WHERE CLIENT_ID = {id}),
s AS (
  SELECT CASE WHEN t.FEED_DATE > date_sub(b.d, 28) THEN 'cur' ELSE 'prev' END period,
         BRAND, SUB_CATEGORY, ASIN, PRODUCT_TITLE, ORDERED_REVENUE, ORDERED_UNITS, GLANCEVIEWS
  FROM client_catalog.aramus.sales_diagnostic_details t CROSS JOIN b
  WHERE t.CLIENT_ID = {id} AND t.FEED_DATE > date_sub(b.d, 56) AND t.FEED_DATE <= b.d)
SELECT period, BRAND, SUB_CATEGORY, ASIN, GROUPING(BRAND) g_b, GROUPING(SUB_CATEGORY) g_s, GROUPING(ASIN) g_a,
       MAX(PRODUCT_TITLE) title, SUM(ORDERED_REVENUE) rev, SUM(ORDERED_UNITS) units, SUM(GLANCEVIEWS) gv
FROM s
GROUP BY GROUPING SETS ((period), (period, BRAND), (period, BRAND, SUB_CATEGORY), (period, BRAND, SUB_CATEGORY, ASIN));
```
For year-over-year, make the prior window the same dates − 364 days.

### R4 · Hourly event sales (local time, deduped)

```sql
SELECT CAST(DATE(from_utc_timestamp(START_TIME, 'America/Los_Angeles')) AS STRING) local_day,
       HOUR(from_utc_timestamp(START_TIME, 'America/Los_Angeles')) local_hour,
       SUM(ORDERED_REVENUE) revenue, SUM(ORDERED_UNITS) units
FROM (
  SELECT * FROM client_catalog.avc.item_sales_event_change
  WHERE CLIENT_ID = {id} AND MARKETPLACE_ID = 'ATVPDKIKX0DER'
    AND START_TIME BETWEEN TIMESTAMP'2026-06-22 00:00:00' AND TIMESTAMP'2026-06-28 00:00:00'   -- pad ±1 day around local days
  QUALIFY ROW_NUMBER() OVER (PARTITION BY CLIENT_ID, MARKETPLACE_ID, ASIN, START_TIME
                             ORDER BY PUBLISH_TIME DESC, INGESTION_TIME DESC) = 1)
WHERE DATE(from_utc_timestamp(START_TIME, 'America/Los_Angeles')) BETWEEN DATE'2026-06-23' AND DATE'2026-06-26'
GROUP BY 1, 2 ORDER BY 1, 2;
```
**R4b, the health check:** run the same query by day and compare it with `sales_diagnostic_details` for the daily id. Within about 2% is healthy; anything else needs a note on the page.

During a live event:
- hours that haven't happened yet are **null, not 0**;
- compare like hours with like hours (today through hour H vs last year through hour H).

### R5 · Organic vs ad-attributed sales by ASIN

```sql
WITH ads AS (
  SELECT ASIN, REPORT_DATE d, SUM(ATTRIBUTEDSALES14D) ad_sales, SUM(COST) spend
  FROM client_catalog.ams_cubes.campaigns_asin_workbench
  WHERE CLIENT_ID = {ads_id} AND REPORT_DATE >= date_sub(current_date(), 28) GROUP BY 1, 2),
ret AS (
  SELECT ASIN, FEED_DATE d, SUM(ORDERED_REVENUE) rev
  FROM client_catalog.aramus.sales_diagnostic_details
  WHERE CLIENT_ID = {retail_id} AND FEED_DATE >= date_sub(current_date(), 28) GROUP BY 1, 2)
SELECT r.ASIN, SUM(r.rev) ordered, SUM(coalesce(a.ad_sales, 0)) ad_sales,
       SUM(r.rev) - SUM(coalesce(a.ad_sales, 0)) organic, SUM(coalesce(a.spend, 0)) spend
FROM ret r LEFT JOIN ads a ON a.ASIN = r.ASIN AND a.d = r.d      -- join on ASIN + date, never CLIENT_ID
GROUP BY 1 ORDER BY ordered DESC;
```

### R6 · Share of search from the SOV cube

```sql
SELECT SEARCH_TERM,
       SUM(ALL_PAGE_1_COUNT) / NULLIF(SUM(TOTAL_ALL_PAGE_1_COUNT), 0)      AS share_page1,      -- a ratio: safe
       SUM(ORGANIC_PAGE_1_COUNT) / NULLIF(SUM(TOTAL_ORGANIC_PAGE_1_COUNT), 0) AS share_organic,
       SUM(ALL_PAGE_1_COUNT) / COUNT(DISTINCT FEED_DATE)                    AS slots_per_day     -- absolute: divide by days
FROM client_catalog.ams_cubes.sov_search_term_level_performance_post_output
WHERE CLIENT_ID = {id} AND CLIENT_FLAG = 'client' AND FEED_DATE >= date_sub(current_date(), 28)
GROUP BY 1 ORDER BY slots_per_day DESC;
```
All-brands view of one term: take `MAX(TOTAL_…)` per term-day as the denominator, and each brand's own `ALL_PAGE_1_COUNT`.

### R7 · Competitor search rank and share on the client's own keywords (raw crawl)

```sql
WITH terms AS (SELECT DISTINCT lower(trim(search_term)) term
               FROM common_catalog.core.core_client_search_terms WHERE client_id = '{slug}'),
roster AS (SELECT retailer, product_id, MAX(brand) brand, MAX(manufacturer) manufacturer,
                  MAX(CAST(client_product AS INT)) own, MAX(CAST(key_competitor_product AS INT)) key_comp
           FROM common_catalog.core.core_client_products WHERE client_id = '{slug}' GROUP BY 1, 2),
s AS (SELECT s.date, lower(trim(s.journey)) term, s.rank, s.sponsored, coalesce(r.brand, 'Unattributed') brand,
             coalesce(r.manufacturer, 'Unattributed') manufacturer
      FROM common_catalog.core.core_daily_sku_search s
      JOIN terms t ON lower(trim(s.journey)) = t.term
      LEFT JOIN roster r ON r.retailer = s.retailer AND r.product_id = s.product_id
      WHERE s.retailer = 'Amazon-US' AND s.date BETWEEN DATE'2026-06-23' AND DATE'2026-06-26' AND s.rank <= 20)
SELECT brand, manufacturer, COUNT(*) top20_slots,
       COUNT(*) / SUM(COUNT(*)) OVER () share_of_top20,
       SUM(CASE WHEN sponsored THEN 1 ELSE 0 END) sponsored_slots,
       AVG(rank) avg_rank, COUNT(DISTINCT term) terms_present
FROM s GROUP BY 1, 2 ORDER BY top20_slots DESC;
```

**Attribution:** roster brand first. For unattributed rows you can match the title against the roster's brand list (e.g. a title starting with "Oreo"); mark those "from title". Report coverage: the share of slots attributed.

**Retailers:** `'Walmart-US'`, `'Target-US'` and others work the same way. Check which retailers the client's terms are crawled on.

### R8 · Promotions: who ran what

```sql
-- a) Badges in search results, all products on the page (PRICE_CUT 'was $X', COUPON incl. Subscribe & Save extras)
SELECT r.brand, s.promotion_type,
       CASE WHEN lower(s.promotion_text) LIKE '%subscribe%' THEN 'S&S coupon' ELSE s.promotion_type END promo,
       COUNT(DISTINCT s.product_id || s.date) listing_days
FROM common_catalog.core.core_daily_sku_search s
JOIN (SELECT DISTINCT lower(trim(search_term)) term FROM common_catalog.core.core_client_search_terms WHERE client_id = '{slug}') t
  ON lower(trim(s.journey)) = t.term
LEFT JOIN (SELECT retailer, product_id, MAX(brand) brand FROM common_catalog.core.core_client_products
           WHERE client_id = '{slug}' GROUP BY 1, 2) r ON r.retailer = s.retailer AND r.product_id = s.product_id
WHERE s.retailer = 'Amazon-US' AND s.date BETWEEN DATE'2026-06-23' AND DATE'2026-06-26'
GROUP BY 1, 2, 3;

-- b) Product pages, roster products only: deal badges and true discount depth
SELECT r.brand, d.date, d.product_id, d.price, d.original_price,
       1 - d.price / NULLIF(d.original_price, 0) discount,
       array_contains(d.badge, 'Prime Day Deal') prime_day_deal,
       exists(d.badge, x -> x LIKE 'Ends in%') limited_time_deal,
       d.promotion_type, d.promotion_text
FROM common_catalog.core.core_daily_sku_detail d
JOIN (SELECT retailer, product_id, MAX(brand) brand FROM common_catalog.core.core_client_products
      WHERE client_id = '{slug}' GROUP BY 1, 2) r ON r.retailer = d.retailer AND r.product_id = d.product_id
WHERE d.retailer = 'Amazon-US' AND d.date BETWEEN DATE'2026-06-23' AND DATE'2026-06-26';
```

Notes:
- Drop discounts above about 90% as crawl errors.
- Walmart pages record price cuts only, and Target has no badges. Show "—" for promo types a retailer doesn't record, not 0%.

### R9 · Price tracking

```sql
SELECT d.date, d.product_id, d.price, d.original_price, d.price_per_unit, d.per_unit, d.seller, d.seller_type
FROM common_catalog.core.core_daily_sku_detail d
JOIN common_catalog.core.core_client_products r ON r.retailer = d.retailer AND r.product_id = d.product_id
WHERE r.client_id = '{slug}' AND r.client_product AND d.retailer = 'Amazon-US' AND d.date >= date_sub(current_date(), 30);
```
⚠ `price_per_unit` is per-KG only when `per_unit = 'KG'`. `net_quantity` can mis-parse from titles, so use medians across variants.

### R10 · Availability (in-stock rate)

```sql
SELECT l.date,
       SUM(CASE WHEN l.status = 'LISTED' THEN 1 ELSE 0 END) /
       NULLIF(SUM(CASE WHEN l.status IN ('LISTED', 'OUT OF STOCK') THEN 1 ELSE 0 END), 0) in_stock_rate
FROM common_catalog.core.core_daily_sku_listing_status l
JOIN (SELECT DISTINCT retailer, product_id FROM common_catalog.core.core_client_products
      WHERE client_id = '{slug}' AND client_product) r ON r.retailer = l.retailer AND r.product_id = l.product_id
WHERE l.retailer = 'Amazon-US' AND l.date >= date_sub(current_date(), 30)
GROUP BY 1 ORDER BY 1;
```
Scope by the roster, not by brand-matching titles. Title-matched listings pull in third-party resellers and can halve the rate.

### R11 · Content compliance from the DSA scorecard

```sql
-- 1. Which scorecard types exist for this client, and how fresh (some clients lag a week or more)
SELECT client_id, scorecard_type, MAX(date) latest FROM client_catalog.edm_derived.dsa_scorecard_final_display
WHERE client_dsa = '{slug}' AND date >= date_sub(current_date(), 30) GROUP BY 1, 2;

-- 2. What this client's content rows look like on that date (measure groups and names vary by client)
SELECT measure_group, measure, COUNT(*) FROM client_catalog.edm_derived.dsa_scorecard_final_display
WHERE client_id = {dsa_id} AND scorecard_type = '{type}' AND date = DATE'{latest}' GROUP BY 1, 2;

-- 3. Compliance by retailer × measure over a window
SELECT retailer_dsa, measure,
       SUM(score_pct * measure_weighting) / NULLIF(SUM(measure_weighting), 0) compliance,
       COUNT(DISTINCT gtin) products,
       COUNT(DISTINCT CASE WHEN score_pct < 1 THEN gtin END) failing
FROM client_catalog.edm_derived.dsa_scorecard_final_display
WHERE client_id = {dsa_id} AND scorecard_type = '{type}' AND date BETWEEN DATE'...' AND DATE'{latest}'
  AND measure_group = '{content group from step 2}' AND score_pct IS NOT NULL AND measure_weighting > 0
GROUP BY 1, 2;
```
- `scorecard_type` is `Standard`, `Enterprise` or `Cross Market`. Use the one the client sees in the platform; the "Country Scorecard" is Enterprise.
- Content groups are named differently per client, e.g. 'Content', 'Content - Compliance' or 'Content - Best in Class'.
- To match the platform's overall score exactly, apply the rules in 7.9.

### R12 · The client's taxonomy and a custom flag (e.g. "PBDD 2026")

```sql
-- 1. Which dimensions exist and what they're called
SELECT dimension_column, dimension_label, entity_type FROM client_catalog.brands_base.taxonomy_metadata
WHERE client_id = {id} AND (is_deleted IS NULL OR NOT is_deleted) ORDER BY 1;

-- 2. Values per ASIN (pick the columns from step 1)
SELECT entity_id AS asin, MAX(dimension86) category, MAX(dimension87) sub_category, MAX(dimension20) pbdd_2026
FROM client_catalog.brands_base.entity_taxonomy
WHERE client_id = {id} AND retailer = 'amazon' AND entity_type = 'catalog'
GROUP BY 1;

-- 3. The flagged ASIN list
SELECT DISTINCT entity_id FROM client_catalog.brands_base.entity_taxonomy
WHERE client_id = {id} AND retailer = 'amazon' AND entity_type = 'catalog'
  AND lower(trim(dimension20)) NOT IN ('', 'no', 'n', 'false', '0', 'n/a', 'none', 'null', '-');
```
If step 1 returns nothing for the instance, try its parent id (R1 step 2). Show ASINs with no value as "Not in taxonomy", never drop them.

### R13 · Net PPM over a period (shipped-revenue weighted)

```sql
WITH p AS (   -- dedupe repeated ASIN-weeks
  SELECT ASIN, WEEK_START_DATE ws, WEEK_END_DATE we, MAX(NET_PPM) ppm
  FROM client_catalog.aramus.net_ppm
  WHERE CLIENT_ID = {id} AND WEEK_END_DATE BETWEEN DATE'2026-09-05' AND DATE'2026-09-26'
  GROUP BY 1, 2, 3),
rev AS (
  SELECT p.ASIN, p.ws, SUM(s.SHIPPED_REVENUE) shipped
  FROM p JOIN client_catalog.aramus.sales_diagnostic_shipped_revenue s
    ON s.CLIENT_ID = {id} AND s.ASIN = p.ASIN AND s.FEED_DATE BETWEEN p.ws AND p.we
  GROUP BY 1, 2)
SELECT SUM(p.ppm * r.shipped) / NULLIF(SUM(r.shipped), 0) blended_net_ppm
FROM p JOIN rev r ON r.ASIN = p.ASIN AND r.ws = p.ws
WHERE r.shipped > 0;            -- a 0 with no shipments is "no value"
```
Comparison periods: the same weeks 52 weeks back (LY), or the same number of weeks immediately before (PP). Check the scale of `NET_PPM` on a known ASIN before labelling it.

### R14 · PRA: invoiced, paid and recovered

```sql
-- Root invoices only (INVOICE_NUMBER = ROOT_INVOICE) = the "Payments Report" totals
SELECT date_trunc('month', INVOICE_DATE) month, SUM(INVOICE_AMOUNT) invoiced, SUM(PAID_AMOUNT) paid
FROM client_catalog.brands_cubes.shortage_invoice_reconciliation_payment_report
WHERE CLIENT_ID = {id} AND INVOICE_NUMBER = ROOT_INVOICE AND INVOICE_DATE >= DATE'2026-01-01'
GROUP BY 1 ORDER BY 1;

-- Disputes: always the latest snapshot per DISPUTE_ID
SELECT DISPUTE_TYPE, COUNT(*) disputes, SUM(DISPUTE_AMOUNT) disputed, SUM(APPROVED_AMOUNT) approved
FROM (SELECT * FROM client_catalog.aramus.dispute_management_invoice_summary
      WHERE CLIENT_ID = {id} AND DISPUTE_CREATION_DATE >= DATE'2026-01-01'
      QUALIFY ROW_NUMBER() OVER (PARTITION BY DISPUTE_ID ORDER BY CREATION_DATE DESC) = 1)
GROUP BY 1;
```

### R15 · Ratings velocity (a demand signal for products you have no sales for)

```sql
WITH c AS (
  SELECT d.product_id, d.date, MAX(d.comment_count) ratings
  FROM common_catalog.core.core_daily_sku_detail d
  JOIN (SELECT DISTINCT retailer, product_id FROM common_catalog.core.core_client_products WHERE client_id = '{slug}') r
    ON r.retailer = d.retailer AND r.product_id = d.product_id
  WHERE d.retailer = 'Amazon-US' AND d.date BETWEEN DATE'2026-06-16' AND DATE'2026-06-26' AND d.comment_count IS NOT NULL
  GROUP BY 1, 2)
SELECT product_id,
       MAX_BY(ratings, date) - MIN_BY(ratings, date) new_ratings,
       DATEDIFF(MAX(date), MIN(date)) days
FROM c GROUP BY 1;
```
Then:
- divide by days to get a per-day rate;
- drop negative values;
- drop jumps over about 10× the product's normal daily gain (listing merges);
- compare the event against the lead-in on products measured in both.

Label it "new ratings (a signal), not sales". Check the counts actually refreshed during the window: one retailer's counts froze for two days during an event.

### R16 · Load a client file (plan, ASIN list, taxonomy) into cs_tools

```sql
CREATE TABLE IF NOT EXISTS client_catalog.cs_tools.{client}_{topic}
  (asin STRING, week_start DATE, units DOUBLE, loaded_at TIMESTAMP, source STRING);
DELETE FROM client_catalog.cs_tools.{client}_{topic} WHERE source = '{file name}';   -- idempotent reload
INSERT INTO client_catalog.cs_tools.{client}_{topic} VALUES (...), (...);
SELECT COUNT(*), SUM(units) FROM client_catalog.cs_tools.{client}_{topic} WHERE source = '{file name}';  -- must equal the file
```
Ask Claude for a reusable loader script that reads the xlsx and checks that the totals match the file exactly after loading.

---

## 9. The traps

Each of these has produced a wrong number before. Claude should check the relevant ones on every build.

**Identity and scope**
1. **The `*_view_catalog` schemas return 0 rows** with no error. Always use `client_catalog` / `common_catalog`.
2. **One client, several ids, and each feed can live on a different one** (retail, ads, hourly, taxonomy, PRA). Probe each table (R1).
3. **Three key types:** numeric ids, crawl slugs, and the unrelated `client_settings` ids.
4. **Instance migrations** split history across an old and a new id. Stitch by date.
5. **Sibling ids can carry identical copies of one feed.** Check overlap before summing (R1 step 4).
6. **Crawl tables have no client column.** Scope via the roster on `product_id` AND `retailer`. The roster includes competitors: filter `client_product` or `key_competitor_product` explicitly.
7. **`journey` means the search term in `core_daily_sku_search`**, but the crawl job name in `core_daily_sku_detail`.
8. **`core_client_products.product_name` is the crawled title**, not client-approved copy (that's `pim.audit`).
9. **Brand-matching titles pulls in 3P resellers.** Default to the roster; make title matching an explicit, labelled extra.
10. **Never use another client's data** — sales, market share, rosters — in a client's dashboard. Not even "anonymously" without Kenan's OK. Peer averages need at least 2 companies, never one.

**Time and freshness**

11. **Hard-coded dates go stale silently.** Always compute windows from the latest date in the data.
12. **Daily tables are T-2 and the latest day can be partial.** Check row counts.
13. **Hourly feed:** UTC → local time, dedupe republished hours, use the market = client × marketplace pair, history is per market, and gaps happen. Compare with the daily table (R4b).
14. **Never compare a part-finished day or event with a complete one.** Use like hours and like days.
15. **Last year = 364 days back**, so the weekday matches.
16. **Some tables re-stamp the date with a frozen payload.** Check the value spread, not just `MAX(date)`.
17. **`forecast_and_inventory_planning`'s newest snapshots are empty shells.**

**Metrics**

18. **`LOSTBUYBOX` / `REP_OOS` on the daily sales table are dead.** Use `asin_esm_workbench`.
19. **PCOGS lives on `asin_esm_workbench`.** `campaigns_asin_workbench` fans out per ad row.
20. **Shipped units are only in `sales_diagnostic_shipped_revenue`.**
21. **CIQ OPS ≠ the raw vendor feed.** OPS is catalog-scoped and sits on parent ids. Say which one you show.
22. **The SOV cube's counts are per-day fractions, and `TOTAL_*` are denominators.** Ratios are safe; absolute sums are not.
23. **DSA SOV:** aggregate per term-date first, then average across days (otherwise about 7× inflation).
24. **DSA scorecard:** filter its partitions, drop null-weight rows, treat "sum" measures as shares, never join `retailer_id` to a dim, and check what `measure_target` means for this client.
25. **Content fields differ per retailer.** `bullet_points` is an array (`size() > 0`); `has_rich_content` NULL means "not captured", not "no A+".
26. **`price_per_unit` units vary** (check `per_unit`), and `net_quantity` mis-parses.
27. **Net PPM:** the PP/LY columns are NULL, rows are duplicated, missing ≠ 0, and you weight by shipped revenue.
28. **Ratings:** `comment_count` is the ratings count, and merges make it jump.
29. **Store-level promo tables:** count distinct product-days, not rows.

**PRA**

30. **PRA tables are snapshot-append.** Dedupe on DISPUTE_ID, CLIENT_ID+INVOICE_NUMBER, or +PAYMENT_NUMBER.
31. **SCR re-invoices cascade.** Collapse them onto the root, or one deduction counts 2–3×.
32. **Unpaid means `PAID_AMOUNT` is NULL**, not 0. The payment report's `DISPUTE_CREATION_DATE` is NULL on recent rows.

**SQL mechanics**

33. **`''` doesn't escape a quote.** Use `\'`.
34. **Columns with spaces need backticks.** Some dates are strings (`WEEK ENDING` is dd/MM/yyyy).
35. **Inline results cap at about 100K rows / 25 MB.** Aggregate, raise the limit, or split.
36. **A failure in one crawl section can leave the rest of the crawl looking normal** (e.g. sponsored slots missing for a week). Check capture per day for each slot type before trusting a share.

---

# Part 3 — Build and ship

## 10. How a CS dashboard is built

This is the standard architecture. Tell Claude *"build it the guide's way"* and it follows this.

**Stack:** Next.js (App Router, TypeScript), Tailwind, charts as inline SVG (no chart library needed), deployed on Vercel.

**Data access:**
- All SQL runs **on the server** in API routes, through the helper in section 17. The browser never sees the token or the SQL.
- Cache results in memory: 5–30 minutes for live data, hours for historical windows.
- **Historical windows** (a past event, a fixed recap) can be **precomputed**: a script runs the SQL and writes compact JSON that the app reads. That makes the app fast, and it can't break when the warehouse is cold.
- Live views query on demand, and the page shows "data through \<date\>".

**Login and identity:**
- Every app has a **password page** (`DASHBOARD_PASSWORD`) **plus an email field**. The email goes into a signed cookie, so we can see who uses it.
- Gate the whole app, page and API, through middleware. Without a valid cookie an API returns 401 and a page redirects to `/login`.

**Client safety:**
- Client configuration (ids, names, taxonomy settings) is **server-only**.
- When one codebase serves several clients, each deployment gets only its own config, through an env var at build time. Never import a table of all clients into browser code, or every client's name ships in the public login page.
- Set the page `<title>` and the **meta description, openGraph and twitter tags** to describe this dashboard. They are what Slack shows when the link is pasted.

**Behaviour:**
- Date windows come from the latest data, never hard-coded.
- Missing data shows as "—" with a reason, never as 0.
- Tables are sortable, filters live in the URL (so a view can be shared), and there's an Excel/CSV export of what's on screen.
- Summary first (tiles), then the trend chart, then the detail table, then a short "Method & data" note listing the sources and caveats.

**Vercel:**
- A `vercel.json` with `{"framework":"nextjs"}`.
- Production env vars: `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`, `DASHBOARD_PASSWORD`, plus any config.
- ⚠ **Vercel env values are write-only once saved.** Keep a non-secret copy of each config in the repo (e.g. `instances/<name>.json`).
- Keep `.env.local` out of uploads (a `.vercelignore` with `.env*.local`).

## 11. Checking the numbers

Before any link leaves CIQ:

- [ ] **Independent recompute.** A second SQL, written separately, for every headline number. They must match exactly.
- [ ] **Matches the platform.** One figure the client sees in CIQ (e.g. last week's revenue) is the same here, or the page says why not.
- [ ] **Parts add up.** Categories sum to the total, ASINs to their category, days to the week, markets to "all markets" (after currency conversion).
- [ ] **Latest date is right.** "Data through \<date\>" is visible and recent.
- [ ] **Three ASINs spot-checked:** one big seller, one small one, one new one.
- [ ] **No duplicate rows** per key in the source (and none from summing sibling ids).
- [ ] **Blanks are blanks.** Missing is "—", never 0.
- [ ] **Coverage is stated.** If a filter or attribution covers 70% of rows, the page says so.

A good closing question to Claude: *"Pretend you're the client's analyst trying to prove this dashboard wrong. What would you check? Check it."*

## 12. Shipping safely to a client

1. **Password on every dashboard**, sent separately from the link.
2. **No other client's name or data anywhere.** Not in a chart, a filter, the login page, the browser tab or the Slack preview. Before deploying a copy of another client's app, ask Claude to *search the whole app and the built login page for other client names*.
3. **Benchmarks against other companies** must be anonymous averages of at least 2 companies, never one, and need Kenan's OK first.
4. **No internal references:** no Freshdesk or Jira numbers, internal channel names or people's names.
5. **Read-only on the lake.** The only writes go to `client_catalog.cs_tools` (client files).
6. **Custom domains** (`client.commerceiq.ai`) need IT/DNS. Ask Kenan.
7. **Never paste tokens or passwords into chat, docs or code.** `.env.local` only.

## 13. Changes after launch, and when to ask for help

**Changes:**
- Paste the client's message and screenshots into Claude in the same app folder: *"Here is the client's feedback. Make these changes, re-check the numbers, and redeploy."*
- If a change moves a headline number, tell the client, with the old and new values side by side.
- If the client asks for data CIQ doesn't have, say so plainly and offer the closest honest alternative. Never build a number that only looks right.

**Ping Kenan before going further if:**
- the numbers don't match the platform and Claude can't explain why after two tries;
- the data doesn't seem to exist, or only exists in another client's account;
- you'd need to write anywhere outside `cs_tools`;
- the dashboard compares the client with other companies;
- you need a custom domain, or the client's IT blocks `vercel.app`;
- anything involves shoppers' personal data.

---

# Part 4 — Reference

## 14. Prompt library

**Start any build**
```
Read Build-Your-Own-Dashboard-CS-Guide.md first and follow it. I want a dashboard for [CLIENT] that answers [question].
Find the client's ids with recipe R1 and tell me which tables are live, then give me a 5-bullet plan before building.
```

**Weekly business pulse**
```
Build a one-page dashboard for [CLIENT] on Amazon [US]: last 13 complete weeks (Sun–Sat) of ordered revenue, units,
glance views and conversion from sales_diagnostic_details (recipe R2), a KPI row (latest week vs prior week vs same
week last year), a weekly line chart with last year as a second line, and a sortable top-25 ASIN table with
week-over-week change. Password [pw]. Deploy as [name].
```

**Event tracker (Prime Day, BFCM)**
```
Build an hourly event dashboard for [CLIENT] for [event dates] vs last year's event and the 10-day lead-in, from
avc.item_sales_event_change (section 7.2 rules, recipe R4; check feed health with R4b). Show cumulative revenue by
hour vs last year at the same hour, a drill by the client's own taxonomy (7.11), and a filter for the ASINs flagged
[flag name] in their taxonomy (R12). Hours that haven't happened are blank, never zero.
```

**Competitive recap (no competitor sales needed)**
```
For [CLIENT], build a recap of [event/dates] on their own tracked keywords (core_client_search_terms) across
[Amazon/Walmart/Target]: competitor share of top-20 search results and average rank (R7), promo types and discount
depth (R8), and new-ratings velocity (R15), vs the two weeks before and vs last year's event. Use ONLY this client's
own instance data (their terms, their roster, their own sales). No other client's sales or market share.
```

**Top movers / gap explanation**
```
For [CLIENT], list the 30 ASINs whose ordered revenue fell most (in $) in the last 4 weeks vs the same weeks last
year, with units, glance views, conversion and price change for each, so I can see whether traffic, conversion or
price drove it. Sortable and exportable.
```

**Availability and buy box**
```
For [CLIENT], show in-stock rate by day (R10) for their own products, the ASINs currently losing the buy box and to
whom (intraday buy-box table, 7.4), and OOS / lost-buy-box rates weighted by glance views from asin_esm_workbench.
```

**Content compliance**
```
Build a content compliance dashboard for [CLIENT] from dsa_scorecard_final_display (R11): compliance % per retailer
and per measure for the latest week, a 12-week trend, and the failing products. First show me this client's measure
groups and measures so we pick the right ones.
```

**Net PPM**
```
Build a Net PPM explorer for [CLIENT] (R13): blended Net PPM for the last 4 / 13 weeks vs prior period and vs last
year, per-ASIN values with "weeks with a value", and a "what if we cut these ASINs" selection.
```

**PRA overview**
```
Build a PRA overview for [CLIENT] (7.12, R14): invoiced vs paid by month from root invoices, disputes by type with
approved amounts (latest snapshot per dispute), and recovery by the month the money came back.
```

**Load a client file**
```
Here's the client's [plan / ASIN list / taxonomy]: [path]. Load it into client_catalog.cs_tools.[client]_[topic]
with a reusable loader (R16), check the totals match the file exactly, and use it in the dashboard as [how].
```

## 15. Checklist before you send a link

- [ ] Answers the one question the client asked, in their words and their hierarchy
- [ ] The right client ids per table (R1); no duplicate feeds summed
- [ ] Headline numbers recomputed independently and matched to the platform
- [ ] "Data through \<date\>" visible and recent; no hard-coded dates
- [ ] Missing data shows "—", never 0; coverage gaps are stated
- [ ] Password works; the login page, tab title and Slack preview name only this client
- [ ] No other client's name or data anywhere (Claude has searched the app and the built login page)
- [ ] No internal ticket numbers or people's names
- [ ] Config copy kept in the repo; the token only in `.env.local` and Vercel
- [ ] Registered with Kenan (Dashboard List)
- [ ] Link and password sent to the client separately

## 16. Glossary

- **ASIN:** Amazon's product id. **Parent ASIN:** the variation family.
- **Instance / client id:** CIQ's numeric id for a client account. One client usually has several (parent, children, per country).
- **Slug:** the text id the crawl, DSA and reviews tables use (e.g. `mondelez-us`).
- **Roster:** the products a client tracks in CIQ (`core_client_products`), their own and competitors'.
- **Ordered revenue / OPS:** sales value at order time. **CIQ OPS** is the platform's catalog-scoped version on parent ids.
- **Shipped revenue:** value when Amazon ships. Closer to Amazon's "net sales".
- **Glance views (GV):** product page views. **Conversion** = units ÷ glance views. **ASP** = revenue ÷ units.
- **SOV / share of search:** the share of search-result slots a brand holds (page 1, top 10, organic vs sponsored).
- **Net PPM:** Amazon's net pure product margin, published weekly and monthly per ASIN.
- **PRA:** profit recovery: shortage claims, disputes, chargebacks, deductions.
- **Lead-in:** the days just before an event, the "normal" baseline.
- **T-2:** data arrives two days after the day it describes.
- **Vercel:** the hosting service behind the dashboard link. **`.env.local`:** the private settings file holding the token.

## 17. Appendix: the Databricks query helper

Save this as `src/lib/databricks.ts`. It's the helper every CS dashboard uses: server-only, with polling and chunking.

```ts
/** Server-side Databricks SQL client. Env: DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_WAREHOUSE_ID. */
function creds() {
  const host = process.env.DATABRICKS_HOST, token = process.env.DATABRICKS_TOKEN, warehouse = process.env.DATABRICKS_WAREHOUSE_ID;
  return host && token && warehouse ? { host, token, warehouse } : null;
}
export const databricksConfigured = () => creds() !== null;

interface StatementResponse {
  statement_id?: string;
  status?: { state?: string; error?: { message?: string } };
  result?: { data_array?: (string | null)[][]; next_chunk_internal_link?: string };
}

export async function runSql(sql: string, opts?: { rowLimit?: number }): Promise<(string | null)[][]> {
  const c = creds();
  if (!c) throw new Error("Databricks not configured");
  const headers = { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" };
  const res = await fetch(`${c.host}/api/2.0/sql/statements`, {
    method: "POST", headers,
    body: JSON.stringify({ statement: sql, warehouse_id: c.warehouse, wait_timeout: "30s",
                           disposition: "INLINE", row_limit: opts?.rowLimit ?? 100000 }),
  });
  let data = (await res.json()) as StatementResponse;
  const deadline = Date.now() + 45_000;          // a cold warehouse takes 30–60 s to wake
  while (["PENDING", "RUNNING"].includes(data.status?.state ?? "") && data.statement_id && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    data = (await (await fetch(`${c.host}/api/2.0/sql/statements/${data.statement_id}`, { headers })).json()) as StatementResponse;
  }
  if (data.status?.state !== "SUCCEEDED")
    throw new Error(["PENDING", "RUNNING"].includes(data.status?.state ?? "")
      ? "The data warehouse is still starting — try again in ~30 seconds"
      : `Query ${data.status?.state ?? "failed"}: ${data.status?.error?.message ?? "unknown"}`);
  const rows = data.result?.data_array ?? [];
  let next = data.result?.next_chunk_internal_link;
  while (next) {                                   // results larger than one chunk arrive in pages
    const chunk = (await (await fetch(`${c.host}${next}`, { headers })).json()) as
      { data_array?: (string | null)[][]; next_chunk_internal_link?: string };
    rows.push(...(chunk.data_array ?? []));
    next = chunk.next_chunk_internal_link;
  }
  return rows;   // every value arrives as a string (or null): convert numbers with Number(...)
}
```

To run a one-off query from the terminal, ask Claude to write a small script that imports this helper and loads the env file:

```bash
npx tsx --env-file=.env.local scripts/query.ts
```
