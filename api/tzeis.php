<?php

declare(strict_types=1);

/**
 * The evening moment, as a Unix timestamp, the sun is $angle degrees below the
 * horizon at $lat/$lng on the civil day containing $dateTs; null where it never
 * gets that low. A line-for-line port of sunEventUTC() in src/lib/tzeis.js
 * (itself from SunCalc), so the API's sign-in gate and the SPA's campaignLock
 * agree to the second. Kept apart from bootstrap.php so it can be tested
 * without a database.
 */
function lulavSunEvent(int $dateTs, float $lat, float $lng, float $angle): ?int
{
    $rad = M_PI / 180;
    $j1970 = 2440588;
    $j2000 = 2451545;
    $j0 = 0.0009;
    $lw = $rad * -$lng;
    $phi = $rad * $lat;
    $d = $dateTs / 86400 - 0.5 + $j1970 - $j2000;
    $n = round($d - $j0 - $lw / (2 * M_PI));
    $ds = $j0 + $lw / (2 * M_PI) + $n;
    $m = $rad * (357.5291 + 0.98560028 * $ds);
    $l = $m + $rad * (1.9148 * sin($m) + 0.02 * sin(2 * $m) + 0.0003 * sin(3 * $m)) + $rad * 102.9372 + M_PI;
    $dec = asin(sin($rad * 23.4397) * sin($l));
    $cosH = (sin($rad * -$angle) - sin($phi) * sin($dec)) / (cos($phi) * cos($dec));
    if ($cosH < -1 || $cosH > 1) {
        return null;
    }
    $a = $j0 + (acos($cosH) + $lw) / (2 * M_PI) + $n;
    $transit = $j2000 + $a + 0.0053 * sin($m) - 0.0069 * sin(2 * $l);
    return (int) round(($transit + 0.5 - $j1970) * 86400);
}
