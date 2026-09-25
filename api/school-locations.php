<?php
/**
 * Where each Lulav school is, by school_id. /schools sends these as lat/lng, so
 * the SPA's campaignLock.js reopens soldier logging at that community's own
 * tzeis after Yom Tov.
 *
 * Mashpia's schools table has an address but no coordinates, so these are
 * placed by the school's postal code -- close enough, since tzeis moves about
 * a minute per 15 km east-west.
 *
 * Deliberately missing: 61 MyShliach and 870 Nigri Shluchim Online School,
 * whose soldiers live wherever their parents are shluchim. A school not listed
 * here sends null, and campaignLock.js falls back to its city map, or to
 * reopening once Yom Tov is over everywhere. Add a school when it joins the
 * campaign.
 */

return [
    // Australia
    110 => ['lat' => -33.873, 'lng' => 151.281],     // Dover Heights NSW 2030
    66 => ['lat' => -37.870, 'lng' => 144.995],   // Melbourne VIC 3183
    112 => ['lat' => -37.870, 'lng' => 144.995],  // Melbourne VIC 3183
    // Brazil
    690 => ['lat' => -22.933, 'lng' => -43.187],    // Rio de Janeiro 22240
    516 => ['lat' => -23.527, 'lng' => -46.640],    // Sao Paulo 01126
    65 => ['lat' => -23.527, 'lng' => -46.640],     // Sao Paulo 01126
    // Canada
    45 => ['lat' => 43.771, 'lng' => -79.487],        // Toronto M3J
    106 => ['lat' => 43.809, 'lng' => -79.451],       // Thornhill L4J
    58 => ['lat' => 45.489, 'lng' => -73.634],        // Montreal H3W
    2 => ['lat' => 45.489, 'lng' => -73.634],         // Montreal H3W
    // South Africa
    180 => ['lat' => -26.150, 'lng' => 28.083],   // Orchards, Johannesburg 2192
    // United Kingdom
    3 => ['lat' => 51.563, 'lng' => -0.059],            // London E5
    265 => ['lat' => 51.566, 'lng' => -0.074],          // London N16
    432 => ['lat' => 51.566, 'lng' => -0.074],          // London N16
    // United States
    806 => ['lat' => 37.779, 'lng' => -122.493],  // San Francisco CA 94121
    869 => ['lat' => 26.273, 'lng' => -80.268],      // Coral Springs FL 33065
    430 => ['lat' => 33.791, 'lng' => -84.443],      // Atlanta GA 30318
    471 => ['lat' => 40.621, 'lng' => -73.965],      // Brooklyn NY 11230
    86 => ['lat' => 41.261, 'lng' => -75.891],       // Kingston PA 18704
    805 => ['lat' => 41.246, 'lng' => -75.881],      // Wilkes-Barre PA 18701
    470 => ['lat' => 33.567, 'lng' => -112.056],      // Phoenix AZ 85020
    544 => ['lat' => 33.660, 'lng' => -117.999],  // Huntington Beach CA
    4 => ['lat' => 34.052, 'lng' => -118.388],    // Los Angeles CA 90035
    162 => ['lat' => 34.052, 'lng' => -118.388],  // Los Angeles CA 90035
    472 => ['lat' => 34.176, 'lng' => -119.227],  // Oxnard CA 93035
    517 => ['lat' => 34.165, 'lng' => -118.396],  // Valley Village CA 91401
    105 => ['lat' => 41.311, 'lng' => -72.933],      // New Haven CT 06511
    577 => ['lat' => 41.279, 'lng' => -73.026],      // Orange CT 06477
    615 => ['lat' => 26.318, 'lng' => -80.100],      // Deerfield Beach FL 33441
    185 => ['lat' => 26.245, 'lng' => -80.206],      // Margate FL 33063
    726 => ['lat' => 26.245, 'lng' => -80.206],      // Margate FL 33063
    19 => ['lat' => 25.940, 'lng' => -80.212],       // Miami FL 33169
    42 => ['lat' => 25.940, 'lng' => -80.212],       // Miami FL 33169
    434 => ['lat' => 25.940, 'lng' => -80.212],      // Miami FL 33169
    480 => ['lat' => 25.940, 'lng' => -80.212],      // Miami FL 33169
    796 => ['lat' => 25.940, 'lng' => -80.212],      // Miami FL 33169
    659 => ['lat' => 25.928, 'lng' => -80.178],      // Miami FL 33162
    483 => ['lat' => 28.076, 'lng' => -82.524],      // Tampa FL 33624
    176 => ['lat' => 43.085, 'lng' => -91.568],       // Postville IA 52162
    50 => ['lat' => 42.009, 'lng' => -87.697],        // Chicago IL 60645
    5 => ['lat' => 42.034, 'lng' => -87.756],         // Skokie IL 60077
    81 => ['lat' => 39.345, 'lng' => -76.684],       // Baltimore MD 21215
    693 => ['lat' => 39.345, 'lng' => -76.684],      // Baltimore MD 21215
    21 => ['lat' => 40.797, 'lng' => -74.481],       // Morristown NJ 07960
    37 => ['lat' => 40.797, 'lng' => -74.481],       // Morristown NJ 07960
    60 => ['lat' => 40.448, 'lng' => -74.482],       // North Brunswick NJ 08902
    694 => ['lat' => 36.155, 'lng' => -115.189],  // Las Vegas NV 89102
    7 => ['lat' => 40.649, 'lng' => -73.934],        // Brooklyn NY 11203
    33 => ['lat' => 40.649, 'lng' => -73.934],       // Brooklyn NY 11203
    9 => ['lat' => 40.669, 'lng' => -73.942],        // Brooklyn NY 11213
    13 => ['lat' => 40.669, 'lng' => -73.942],       // Brooklyn NY 11213
    30 => ['lat' => 40.669, 'lng' => -73.942],       // Brooklyn NY 11213
    255 => ['lat' => 40.669, 'lng' => -73.942],      // Brooklyn NY 11213
    269 => ['lat' => 40.669, 'lng' => -73.942],      // Brooklyn NY 11213
    542 => ['lat' => 40.669, 'lng' => -73.942],      // Brooklyn NY 11213
    54 => ['lat' => 40.663, 'lng' => -73.954],       // Brooklyn NY 11225
    585 => ['lat' => 40.577, 'lng' => -73.949],      // Brooklyn NY 11235
    48 => ['lat' => 43.040, 'lng' => -78.776],       // Buffalo NY 14228
    614 => ['lat' => 40.787, 'lng' => -73.727],      // Great Neck NY 11021
    49 => ['lat' => 41.117, 'lng' => -74.047],       // Spring Valley NY 10977
    63 => ['lat' => 40.665, 'lng' => -73.704],       // Valley Stream NY 11580
    837 => ['lat' => 39.189, 'lng' => -84.453],      // Cincinnati OH 45237
    518 => ['lat' => 41.497, 'lng' => -81.537],      // University Heights OH 44118
    89 => ['lat' => 39.985, 'lng' => -75.222],       // Philadelphia PA 19131
    11 => ['lat' => 40.432, 'lng' => -79.921],       // Pittsburgh PA 15217
    40 => ['lat' => 40.432, 'lng' => -79.921],       // Pittsburgh PA 15217
    692 => ['lat' => 32.991, 'lng' => -96.791],       // Dallas TX 75252
    84 => ['lat' => 29.668, 'lng' => -95.482],        // Houston TX 77096
    263 => ['lat' => 47.585, 'lng' => -122.299],  // Seattle WA 98144
    80 => ['lat' => 43.160, 'lng' => -87.928],        // Milwaukee WI 53217
];
