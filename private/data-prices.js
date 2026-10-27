// Average price on promotion vs off promotion, last 6 months (weeks 80..105: weeks of Apr 19 to Oct 11, 2026), per category x brand. Simple average across products.
// Baseline = each ASIN's median weekly price over the last 52 weeks (weeks 54..105; ASINs with 10+ weeks of 2+ units). Promotion = price 5% or more below baseline.
// Each product's price on promotion = its promo sales / promo units over the 6 months (likewise off promotion); the brand figure is the plain average of those product prices, every product counting once.
// Row: category | brand | products with promo weeks, sum of their promo prices, products with off-promo weeks, sum of their off-promo prices | checksum (sum of the four). Average = sum / products.
// Only units with a baseline are counted. Categories: 0 Car Seats, 1 Strollers, 2 Travel Systems, 3 Accessories. Source: client_catalog.marketshare_cubes.ms_estimations_metadata, client 1224.
window.BRITAX_PRICES = [
'0|All competitors|460,84916,736,163350|249462',
'0|Baby Trend|36,4045,41,5555|9677',
'0|Britax group|50,14670,60,20873|35653',
'0|Chicco|25,6511,54,14037|20627',
'0|Evenflo|28,10915,85,27818|38846',
'0|Graco|60,11340,83,20361|31844',
'0|Safety 1st|27,4382,60,9831|14300',
'1|All competitors|575,176251,986,337413|515225',
'1|Britax group|13,4639,13,6008|10673',
'1|Delta Children|13,1656,25,3264|4958',
'1|Graco|15,3788,17,5350|9170',
'1|Mamazing|12,2572,18,3749|6351',
'1|Mompush|33,9362,61,18007|27463',
'1|Uppababy|7,5155,39,33112|38313',
'2|All competitors|143,48975,220,95950|145288',
'2|Baby Trend|49,10898,56,14675|25678',
'2|Britax group|13,5304,17,8463|13797',
'2|Chicco|5,1958,14,6500|8477',
'2|Evenflo|22,9859,37,18815|28733',
'2|Graco|23,8275,25,10846|19169',
'2|Joie|7,3213,31,17233|20484',
'3|All competitors|2308,86776,3604,161402|254090',
'3|Britax group|17,1191,36,3548|4792',
'3|Graco|18,1620,18,1905|3561',
'3|JL Childress|41,1347,56,2056|3500',
'3|Momcozy|19,1030,19,1170|2238',
'3|Shynerk|3,54,3,62|122',
'3|Uppababy|13,1912,49,7646|9620'
];
