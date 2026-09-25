<?php
class GlobalSettings {
    // LULAV_TEST_YEAR models a year that is not configured (0).
    public static function getCurrentYear() { $y = getenv('LULAV_TEST_YEAR'); return $y === false ? 5787 : (int) $y; }
    public static function getAustralian() { return [66, 110, 112, 180, 690, 713, 709]; }
    public static function isAustralian($schoolId) { return in_array((int) $schoolId, self::getAustralian(), true); }
}
