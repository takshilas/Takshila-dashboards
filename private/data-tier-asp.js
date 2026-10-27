// Average price by price tier, simple average across products (every product counts once, not weighted by units sold). Tiers as in data-tier-weekly.js.
// Row: category | tier (0 Value, 1 Mid, 2 Premium) | Britax group or All competitors | for six windows, products sold and the sum of their prices (each product's price = its sales / its units in the window, promotions included):
//   2024 (weeks of Jan 7 to Dec 22, 2024) | 2025 (Dec 29, 2024 to Dec 21, 2025) | 2025 year to date, same 42 weeks (to Oct 12, 2025) | 2026 year to date (Dec 28, 2025 to Oct 11, 2026) | Sep 2026 (Sep 6 to Sep 27) | Oct 2026 (Oct 4 and Oct 11) | checksum.
// Average = sum / products. Britax has no Travel Systems Value-tier products, so that row is absent. Source: client_catalog.marketshare_cubes.ms_estimations_metadata, client 1224.
window.BRITAX_TIERASP = [
'0|0|All competitors|661,40932,514,43572,485,41919,447,36658,326,25582,295,22970|214361',
'0|0|Britax group|2,117,5,341,5,338,5,351,4,319,4,308|1799',
'0|1|All competitors|266,57925,305,68764,295,66876,256,58949,188,42226,172,38410|334632',
'0|1|Britax group|31,6928,23,5620,23,5584,25,6774,20,5250,17,4261|34556',
'0|2|All competitors|187,71074,301,120406,273,106262,264,111566,189,79581,187,79007|569297',
'0|2|Britax group|54,17935,53,18622,43,14740,50,19339,38,13722,34,12632|97262',
'1|0|All competitors|876,117664,896,114352,821,105525,734,92811,509,64752,480,59935|559355',
'1|0|Britax group|3,207,3,368,3,364,3,372,2,257,2,248|1832',
'1|1|All competitors|1268,413699,784,259899,766,254793,564,187641,372,121441,335,108682|1350244',
'1|1|Britax group|21,7340,13,4950,13,5007,13,4638,11,3790,11,3817|29624',
'1|2|All competitors|300,262091,276,228745,269,226241,299,260963,195,165327,163,141736|1286605',
'1|2|Britax group|4,2590,3,2026,3,1999,2,1458,2,1416,2,1390|10895',
'2|0|All competitors|1032,274282,283,70511,278,69385,112,25772,85,18710,83,18293|478826',
'2|1|All competitors|365,125263,98,35947,96,35230,68,27487,53,20333,48,18421|263409',
'2|1|Britax group|10,3865,11,4361,11,4351,10,4072,10,3884,10,4015|24610',
'2|2|All competitors|96,67353,126,79177,118,74060,138,93043,93,62478,89,58842|435613',
'2|2|Britax group|11,6084,8,4534,8,4565,7,4103,5,3188,5,3208|25726',
'3|0|All competitors|3280,52301,3016,47363,2791,43884,2953,45639,1958,30511,1805,27581|263082',
'3|0|Britax group|4,100,4,74,3,54,6,116,2,50,2,50|465',
'3|1|All competitors|1630,67145,1809,72946,1671,67709,1907,75944,1311,52206,1196,47160|392634',
'3|1|Britax group|37,1684,31,1420,31,1415,26,1311,20,1024,15,760|7774',
'3|2|All competitors|598,113009,684,131503,606,116950,810,159445,505,87580,486,89524|701700',
'3|2|Britax group|22,2441,21,2603,21,2571,20,2914,17,1931,17,1921|14499'
];
