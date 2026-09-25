<?php
/**
 * Canned rows for the Lulav API tests: two schools, three children, marks on
 * Sukkos days 2 and 3, and one approved photo. Dates are production's: Sukkos
 * day N is Julian day 2461309 + N, so day 2 is Sunday 27 September 2026.
 *
 * Day/minutes marks are modelled as date_task_id 101..107 (shakes) and 201..207
 * (minutes), one per Sukkos day, on grid ids 11 and 21.
 */

const T_SHAKE_DAY2 = 102;
const T_SHAKE_DAY3 = 103;
const T_MIN_DAY2 = 202;
const T_MIN_DAY3 = 203;

function lulav_test_task_map(): array
{
    $rows = [];
    $missing = (int) getenv('LULAV_TEST_MAP_MISSING_DAY');
    foreach ([2, 3, 4, 5, 6, 7] as $day) {
        if ($day === $missing) {
            continue;
        }
        $rows[] = [
            'field_name' => 'day', 'day_number' => $day,
            'date_task_id' => 100 + $day, 'grid_id' => 11,
            'start_date' => 2461309 + $day, 'end_date' => 2461309 + $day,
        ];
        $rows[] = [
            'field_name' => 'minutes', 'day_number' => $day,
            'date_task_id' => 200 + $day, 'grid_id' => 21,
            'start_date' => 2461309 + $day, 'end_date' => 2461309 + $day,
        ];
    }
    return $rows;
}

function lulav_test_kid(int $userId, int $serial, string $first, string $last, int $schoolId): array
{
    return [
        'user_id' => $userId, 'user_serial' => $serial,
        'first' => $first, 'last' => $last,
        'first_he' => '', 'last_he' => '',
        'dob' => '2014-05-05', 'gender' => 'B',
        'school_id' => $schoolId, 'class_id' => 7,
        'mobile_pic' => '', 'user_photo_id' => 0,
        'class_grade' => 5, 'class_sub' => 'Boys',
        'school_name' => $schoolId === 61 ? 'Sample Day School' : 'Sample Talmud Torah',
        'rank_name' => 'Colonel', 'rank_ord' => 6,
    ];
}

function lulav_test_kids(): array
{
    return [
        lulav_test_kid(9001, 555001, 'Mendel', 'Cohen', 61),
        lulav_test_kid(9002, 555002, 'Levi', 'Katz', 61),
        lulav_test_kid(9003, 555003, 'Shmuly', 'Gold', 269),
    ];
}

/** date_tasks_marks rows as lulavLoadDayMarks selects them. */
function lulav_test_marks(): array
{
    return [
        // LULAV_TEST_DAY2_COUNT lets a test start from an already-flagged day.
        ['user_id' => 9001, 'date_task_id' => T_SHAKE_DAY2, 'done_qty' => (int) (getenv('LULAV_TEST_DAY2_COUNT') ?: 12), 'mark_inactive' => 0,
         'mark_description' => 'We went to the park', 'updated' => '2026-10-05 10:00:00', 'mark_date' => 2461311],
        ['user_id' => 9001, 'date_task_id' => T_MIN_DAY2, 'done_qty' => 45, 'mark_inactive' => 0,
         'mark_description' => '', 'updated' => '2026-10-05 10:00:00', 'mark_date' => 2461311],
        ['user_id' => 9002, 'date_task_id' => T_SHAKE_DAY2, 'done_qty' => 7, 'mark_inactive' => (int) (getenv('LULAV_TEST_HIDE_9002') === '1'),
         'mark_description' => '', 'updated' => '2026-10-05 11:00:00', 'mark_date' => 2461311],
        ['user_id' => 9002, 'date_task_id' => T_MIN_DAY2, 'done_qty' => 20, 'mark_inactive' => 0,
         'mark_description' => '', 'updated' => '2026-10-05 11:00:00', 'mark_date' => 2461311],
        ['user_id' => 9003, 'date_task_id' => T_SHAKE_DAY3, 'done_qty' => 30, 'mark_inactive' => 0,
         'mark_description' => 'Big day', 'updated' => '2026-10-06 09:00:00', 'mark_date' => 2461312],
        ['user_id' => 9003, 'date_task_id' => T_MIN_DAY3, 'done_qty' => 60, 'mark_inactive' => 0,
         'mark_description' => '', 'updated' => '2026-10-06 09:00:00', 'mark_date' => 2461312],
    ];
}

function lulav_test_photo_rows(): array
{
    return [[
        'photo_id' => 1, 'public_id' => str_repeat('a', 32),
        'mivtzoim_id' => 10, 'school_year' => 5787,
        'user_id' => 9001, 'school_id' => 61, 'day_number' => 2,
        'file_name' => str_repeat('a', 32) . '.jpg', 'mime_type' => 'image/jpeg',
        'content_hash' => str_repeat('b', 64), 'status' => 'approved',
        'reviewed_by' => 1, 'reviewed_at' => null, 'created_at' => '2026-10-05 10:00:00',
    ]];
}

function lulav_test_patterns(): array
{
    $kids = lulav_test_kids();
    $byId = [];
    foreach ($kids as $k) {
        $byId[$k['user_id']] = $k;
    }

    return [
        // --- schema guards -------------------------------------------------
        // LULAV_TEST_NO_TABLES=1: the Lulav tables were never installed.
        ['/FROM information_schema\.tables/i', static function (): array {
            return [['COUNT(*)' => getenv('LULAV_TEST_NO_TABLES') === '1' ? 0 : 1]];
        }],
        ['/FROM information_schema\.columns/i', [['COUNT(*)' => 1]]],

        // --- campaign + settings -------------------------------------------
        // LULAV_TEST_NO_CAMPAIGN=1: no campaign row.
        ['/FROM mivtzoim WHERE mivtzoim_id/i', static function (): array {
            return getenv('LULAV_TEST_NO_CAMPAIGN') === '1' ? [] : [[
                'mivtzoim_id' => 10, 'name' => 'Mivtza Lulav',
                'start' => 2461311, 'end' => 2461316,
            ]];
        }],
        ['/FROM lulav_campaign_settings/i', [['per_kid_goal' => 3]]],
        ['/INSERT INTO lulav_campaign_settings/i', []],
        // LULAV_TEST_MAP_MISSING_DAY=<n>: the teacher-grid map lacks day n.
        ['/FROM lulav_api_task_map map/i', 'lulav_test_task_map'],
        ['/FROM lulav_api_task_map WHERE/i', 'lulav_test_task_map'],
        ['/FROM lulav_school_settings/i', []],
        ['/INSERT INTO lulav_school_settings|UPDATE lulav_school_settings/i', []],

        // --- the child's Mivtzoim track, and the grid cells a save may target ---
        // LULAV_TEST_NO_TRACK=1: the child has no Mivtzoim track.
        ['/SELECT u\.school_type_id, u\.lang_id, ut\.level/i', static function (): array {
            return getenv('LULAV_TEST_NO_TRACK') === '1' ? [] : [['school_type_id' => 1, 'lang_id' => 1, 'level' => 3]];
        }],
        ['/SELECT task\.grid_id, task\.quantity, mission\.start_date/i', static function (): array {
            // One quantity cell per mapped grid, spanning every campaign day, so
            // lulavValidateMarkTargets() finds a target for each mapped cell.
            // LULAV_TEST_NO_GRID=1: no cell matches the child's track.
            if (getenv('LULAV_TEST_NO_GRID') === '1') {
                return [];
            }
            $rows = [];
            foreach ([11, 21] as $gridId) {
                foreach ([2, 3, 4, 5, 6, 7] as $day) {
                    $rows[] = [
                        'grid_id' => $gridId, 'quantity' => 1,
                        'start_date' => 2461309 + $day, 'end_date' => 2461309 + $day,
                        'lang_id' => 1,
                    ];
                }
            }
            return $rows;
        }],

        // --- locks ----------------------------------------------------------
        // LULAV_TEST_LOCK_BUSY=1: another save holds the child's lock.
        ['/GET_LOCK/i', static function (): array {
            return [['GET_LOCK' => getenv('LULAV_TEST_LOCK_BUSY') === '1' ? 0 : 1]];
        }],
        ['/RELEASE_LOCK/i', [['RELEASE_LOCK' => 1]]],

        // --- schools --------------------------------------------------------
        ['/FROM schools s.*LEFT JOIN/is', [
            ['school_id' => 61, 'school_name' => 'Sample Day School', 'school_city' => 'Monsey',
             'logo' => '', 'school_logo_id' => 0, 'school_logo_kiosk_id' => 0,
             'soldier_count' => 2, 'motto' => 'Go!', 'color' => null, 'goal_override' => null],
            ['school_id' => 269, 'school_name' => 'Sample Talmud Torah', 'school_city' => 'Brooklyn',
             'logo' => '', 'school_logo_id' => 0, 'school_logo_kiosk_id' => 0,
             'soldier_count' => 1, 'motto' => '', 'color' => null, 'goal_override' => null],
        ]],
        // LULAV_TEST_NOT_ELIGIBLE=1: the school is not registered this year.
        ['/FROM school_registrations|EXISTS \(\s*SELECT 1 FROM school_registrations/i', static function (): array {
            return getenv('LULAV_TEST_NOT_ELIGIBLE') === '1' ? [] : [['1' => 1]];
        }],
        // LULAV_TEST_NO_SCHOOL=1: no such school.
        ['/SELECT 1 FROM schools WHERE school_id/i', static function (): array {
            return getenv('LULAV_TEST_NO_SCHOOL') === '1' ? [] : [['1' => 1]];
        }],

        // --- the combined shakes/minutes totals ------------------------------
        ['/SUM\(CASE WHEN m\.date_task_id IN .* THEN m\.done_qty/is', [
            ['school_id' => 61, 'day_total' => 19, 'minute_total' => 65],
            ['school_id' => 269, 'day_total' => 30, 'minute_total' => 60],
        ]],

        // --- photos -----------------------------------------------------------
        ['/SELECT school_id, COUNT\(\*\) AS total FROM lulav_photos/i', [
            ['school_id' => 61, 'total' => 1],
        ]],
        ['/SELECT COUNT\(\*\) FROM lulav_photos/i', [['COUNT(*)' => 1]]],
        ['/COUNT\(DISTINCT CONCAT\(user_id/i', [['c' => 2]]],
        // The duplicate check before a photo is stored: new by default;
        // LULAV_TEST_PHOTO_EXISTS=rejected|approved models a re-upload.
        ['/SELECT photo_id, status FROM lulav_photos/i', static function (): array {
            $status = getenv('LULAV_TEST_PHOTO_EXISTS');
            return $status ? [['photo_id' => 7, 'status' => $status]] : [];
        }],
        ['/UPDATE lulav_photos/i', []],
        ['/DELETE FROM lulav_photos/i', []],
        ['/INSERT INTO lulav_photos/i', []],
        ['/user_id, day_number, public_id, status, mime_type, file_name FROM lulav_photos/i', lulav_test_photo_rows()],
        ['/SELECT photo\.user_id, photo\.day_number, u\.user_serial FROM lulav_photos/i', [
            ['user_id' => 9001, 'day_number' => 2, 'user_serial' => 555001],
        ]],
        // A school's approved photos, for the zip download: Mendel has two on
        // day 2, Levi one, and one row whose file is not on disk.
        // LULAV_TEST_NO_APPROVED=1 models a school with none.
        // Upload times: Mendel's first on Sun 27 Sep 7:30 PM, his second and
        // Levi's on Mon 28 Sep, 10:00 AM and 8:00 PM (New York time).
        ['/SELECT user_id, day_number, file_name, mime_type, UNIX_TIMESTAMP\(created_at\) AS uploaded_at FROM lulav_photos/i', static function (): array {
            if (getenv('LULAV_TEST_NO_APPROVED') === '1') {
                return [];
            }
            return [
                ['user_id' => 9001, 'day_number' => 2, 'file_name' => 'zip-mendel-1.jpg', 'mime_type' => 'image/jpeg', 'uploaded_at' => strtotime('2026-09-27 19:30 America/New_York')],
                ['user_id' => 9001, 'day_number' => 2, 'file_name' => 'zip-mendel-2.png', 'mime_type' => 'image/png', 'uploaded_at' => strtotime('2026-09-28 10:00 America/New_York')],
                ['user_id' => 9002, 'day_number' => 2, 'file_name' => 'zip-levi-1.jpg', 'mime_type' => 'image/jpeg', 'uploaded_at' => strtotime('2026-09-28 20:00 America/New_York')],
                ['user_id' => 9001, 'day_number' => 2, 'file_name' => 'zip-missing.jpg', 'mime_type' => 'image/jpeg', 'uploaded_at' => strtotime('2026-09-28 12:00 America/New_York')],
            ];
        }],
        // LULAV_TEST_NO_PHOTO=1: no photo with that id.
        ['/SELECT \* FROM lulav_photos/i', static function (): array {
            return getenv('LULAV_TEST_NO_PHOTO') === '1' ? [] : lulav_test_photo_rows();
        }],

        // --- marks -------------------------------------------------------------
        ['/FROM date_tasks_marks m\b(?!ark)/i', static function (string $sql) {
            $rows = lulav_test_marks();
            if (preg_match('/m\.user_id = :user/', $sql)) {
                return $rows; // the harness narrows by fixture, not by SQL
            }
            return $rows;
        }],
        ['/UPDATE date_tasks_marks/i', []],
        ['/FROM date_tasks_marks mark\b/i', [
            ['user_id' => 9001, 'first' => 'Mendel', 'last' => 'Cohen', 'total' => 19,
             'rank_name' => 'Colonel', 'rank_ord' => 6, 'class_id' => 7],
        ]],

        // --- children -----------------------------------------------------------
        ['/FROM users u.*u\.school_id = :school/is', array_values(array_filter($kids, static function ($k) {
            return $k['school_id'] === 61;
        }))],
        ['/FROM users u.*u\.user_id IN/is', $kids],
        // One child by serial or by id: whoever was actually asked for.
        ['/FROM users u.*(u\.user_serial|u\.user_id) = :value/is', static function (string $sql, array $params) use ($kids): array {
            $column = strpos($sql, 'u.user_serial = :value') !== false ? 'user_serial' : 'user_id';
            return array_filter($kids, static function (array $kid) use ($column, $params): bool {
                return (string) $kid[$column] === (string) ($params[':value'] ?? '');
            });
        }],
        // Sign-in: the serial and date of birth have to belong together.
        ['/SELECT 1 FROM users WHERE user_serial = :serial AND dob/i', static function (string $sql, array $params) use ($kids): array {
            foreach ($kids as $kid) {
                if ((string) $kid['user_serial'] === (string) $params[':serial'] && $kid['dob'] === $params[':dob']) {
                    return [['1' => 1]];
                }
            }
            return [];
        }],
        ['/SELECT user_serial, school_id FROM users/i', static function (string $sql, array $params) use ($byId): array {
            $kid = $byId[(int) ($params[':user'] ?? 0)] ?? null;
            return $kid ? [['user_serial' => $kid['user_serial'], 'school_id' => $kid['school_id']]] : [];
        }],
        ['/FROM classes c/i', [
            ['class_id' => 7, 'class_grade' => 5, 'class_sub' => 'Boys', 'kid_count' => 2],
        ]],
        ['/FROM users u/i', [$kids[0]]],
        ['/FROM users/i', [$kids[0]]],

        // --- admin --------------------------------------------------------------
        // LULAV_TEST_ADMIN: missing | inactive | school (administers school 61
        // only) | none (administers nothing); HQ ('super') by default.
        ['/SELECT auth, first, last, username FROM admins/i', static function (): array {
            $kind = getenv('LULAV_TEST_ADMIN') ?: 'hq';
            if ($kind === 'missing') {
                return [];
            }
            $auth = ['inactive' => 'inactive', 'school' => '', 'none' => ''][$kind] ?? 'super';
            return [['auth' => $auth, 'first' => 'Test', 'last' => 'Admin', 'username' => 'testadmin']];
        }],
        // A parent's children: parent 501 (the "parent-token" session) has
        // Mendel and Levi; anyone else, none.
        ['/SELECT u\.user_id, u\.user_serial FROM admin_auths aa JOIN users u/i', static function (string $sql, array $params) use ($kids): array {
            if ((int) ($params[':admin'] ?? 0) !== 501) {
                return [];
            }
            $rows = [];
            foreach ($kids as $kid) {
                if (in_array($kid['user_id'], [9001, 9002], true)
                    && (!isset($params[':user']) || (int) $params[':user'] === $kid['user_id'])) {
                    $rows[] = ['user_id' => $kid['user_id'], 'user_serial' => $kid['user_serial']];
                }
            }
            return $rows;
        }],
        // The school's admins, for high-number alerts: one Base Commander (in
        // mixed case, to prove addresses are normalised) and one principal who
        // is not. LULAV_TEST_NO_BC=1 models a school with no Base Commander.
        // Placed before the generic admin_auths pattern, which would answer it.
        ['/SELECT a\.admin_email, MAX\(/i', static function (): array {
            $noCommander = getenv('LULAV_TEST_NO_BC') === '1';
            return [
                ['admin_email' => 'Commander@School61.test', 'is_base_commander' => $noCommander ? 0 : 1],
                ['admin_email' => 'principal@school61.test', 'is_base_commander' => 0],
            ];
        }],
        ['/FROM admin_auths/i', static function (): array {
            return getenv('LULAV_TEST_ADMIN') === 'none' ? [] : [['school_id' => 61]];
        }],
        ['/FROM admins/i', [[
            'admin_id' => 1, 'auth' => 'super', 'first' => 'Test', 'last' => 'Admin', 'username' => 'testadmin',
        ]]],
    ];
}
