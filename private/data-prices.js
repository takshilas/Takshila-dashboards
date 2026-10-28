// Average price on promotion vs off promotion, last 6 months (weeks 80..105: weeks of Apr 19 to Oct 11, 2026), per category x brand. Simple average across products.
// Baseline = each ASIN's average selling price over the last 12 months (sales ÷ units, weeks 54..105; ASINs with 10+ weeks of 2+ units). Promotion = price 5% or more below baseline.
// Each product's price on promotion = its promo sales / promo units over the 6 months (likewise off promotion); the brand figure is the plain average of those product prices, every product counting once.
// Row: category | brand | products with promo weeks, sum of their promo prices, products with off-promo weeks, sum of their off-promo prices | checksum (sum of the four). Average = sum / products.
// Only units with a baseline are counted. Categories: 0 Car Seats, 1 Strollers, 2 Travel Systems, 3 Accessories. Source: client_catalog.marketshare_cubes.ms_estimations_metadata, client 1224.
window.BRITAX_PRICES = [
'0|All competitors|442,78930,735,162777|242884',
'0|Baby Trend|37,4129,41,5515|9722',
'0|Britax group|47,13657,60,20515|34279',
'0|Chicco|24,6172,54,13937|20187',
'0|Evenflo|24,8947,85,27686|36742',
'0|Graco|58,10942,84,20445|31529',
'0|Safety 1st|27,3882,59,9701|13669',
'1|All competitors|574,172472,982,336843|510871',
'1|Britax group|13,4598,13,5805|10429',
'1|Delta Children|16,1984,25,3362|5387',
'1|Graco|15,3748,17,5324|9104',
'1|Mamazing|13,2845,18,3723|6599',
'1|Mompush|33,9263,61,17977|27334',
'1|Uppababy|7,5164,39,33113|38323',
'2|All competitors|137,46725,220,96129|143211',
'2|Baby Trend|47,10227,56,14649|24979',
'2|Britax group|11,4391,17,8455|12874',
'2|Chicco|6,2276,14,6541|8837',
'2|Evenflo|20,8783,37,18736|27576',
'2|Graco|23,8143,25,10800|18991',
'2|Joie|7,3151,31,17226|20415',
'3|All competitors|2352,87063,3549,159865|252829',
'3|Britax group|14,850,37,3726|4627',
'3|Graco|18,1597,18,1893|3526',
'3|JL Childress|45,1465,54,2038|3602',
'3|Momcozy|19,1022,19,1167|2227',
'3|Shynerk|2,29,3,62|96',
'3|Uppababy|15,2003,43,7072|9133'
];
