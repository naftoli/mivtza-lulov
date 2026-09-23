<?php
class GlobalSettings {
    public static function getCurrentYear() { return 5787; }
    public static function getAustralian() { return [66, 110, 112, 180, 690, 713, 709]; }
    public static function isAustralian($schoolId) { return in_array((int) $schoolId, self::getAustralian(), true); }
}
