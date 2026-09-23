<?php
/**
 * Canned rows for the Lulav API tests: two schools, three children, marks on
 * Sukkos days 1 and 2, and one approved photo.
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
    foreach ([2, 3, 4, 5, 6, 7] as $day) {
        $rows[] = [
            'field_name' => 'day', 'day_number' => $day,
            'date_task_id' => 100 + $day, 'grid_id' => 11,
            'start_date' => 2461300 + $day, 'end_date' => 2461300 + $day,
        ];
        $rows[] = [
            'field_name' => 'minutes', 'day_number' => $day,
            'date_task_id' => 200 + $day, 'grid_id' => 21,
            'start_date' => 2461300 + $day, 'end_date' => 2461300 + $day,
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
        'school_name' => 'Test School ' . $schoolId,
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
        ['user_id' => 9001, 'date_task_id' => T_SHAKE_DAY2, 'done_qty' => 12, 'mark_inactive' => 0,
         'mark_description' => 'We went to the park', 'updated' => '2026-10-05 10:00:00', 'mark_date' => 2461301],
        ['user_id' => 9001, 'date_task_id' => T_MIN_DAY2, 'done_qty' => 45, 'mark_inactive' => 0,
         'mark_description' => '', 'updated' => '2026-10-05 10:00:00', 'mark_date' => 2461301],
        ['user_id' => 9002, 'date_task_id' => T_SHAKE_DAY2, 'done_qty' => 7, 'mark_inactive' => 0,
         'mark_description' => '', 'updated' => '2026-10-05 11:00:00', 'mark_date' => 2461301],
        ['user_id' => 9002, 'date_task_id' => T_MIN_DAY2, 'done_qty' => 20, 'mark_inactive' => 0,
         'mark_description' => '', 'updated' => '2026-10-05 11:00:00', 'mark_date' => 2461301],
        ['user_id' => 9003, 'date_task_id' => T_SHAKE_DAY3, 'done_qty' => 30, 'mark_inactive' => 0,
         'mark_description' => 'Big day', 'updated' => '2026-10-06 09:00:00', 'mark_date' => 2461302],
        ['user_id' => 9003, 'date_task_id' => T_MIN_DAY3, 'done_qty' => 60, 'mark_inactive' => 0,
         'mark_description' => '', 'updated' => '2026-10-06 09:00:00', 'mark_date' => 2461302],
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
        ['/FROM information_schema\.tables/i', [['COUNT(*)' => 1]]],
        ['/FROM information_schema\.columns/i', [['COUNT(*)' => 1]]],

        // --- campaign + settings -------------------------------------------
        ['/FROM mivtzoim WHERE mivtzoim_id/i', [[
            'mivtzoim_id' => 10, 'name' => 'Mivtza Lulav',
            'start' => 2461301, 'end' => 2461307,
        ]]],
        ['/FROM lulav_campaign_settings/i', [['per_kid_goal' => 3]]],
        ['/INSERT INTO lulav_campaign_settings/i', []],
        ['/FROM lulav_api_task_map map/i', lulav_test_task_map()],
        ['/FROM lulav_api_task_map WHERE/i', lulav_test_task_map()],
        ['/FROM lulav_school_settings/i', []],
        ['/INSERT INTO lulav_school_settings|UPDATE lulav_school_settings/i', []],

        // --- the child's Mivtzoim track, and the grid cells a save may target ---
        ['/SELECT u\.school_type_id, u\.lang_id, ut\.level/i', [[
            'school_type_id' => 1, 'lang_id' => 1, 'level' => 3,
        ]]],
        ['/SELECT task\.grid_id, task\.quantity, mission\.start_date/i', static function (): array {
            // One quantity cell per mapped grid, spanning every campaign day, so
            // lulavValidateMarkTargets() finds a target for each mapped cell.
            $rows = [];
            foreach ([11, 21] as $gridId) {
                foreach ([2, 3, 4, 5, 6, 7] as $day) {
                    $rows[] = [
                        'grid_id' => $gridId, 'quantity' => 1,
                        'start_date' => 2461300 + $day, 'end_date' => 2461300 + $day,
                        'lang_id' => 1,
                    ];
                }
            }
            return $rows;
        }],

        // --- locks ----------------------------------------------------------
        ['/GET_LOCK/i', [['GET_LOCK' => 1]]],
        ['/RELEASE_LOCK/i', [['RELEASE_LOCK' => 1]]],

        // --- schools --------------------------------------------------------
        ['/FROM schools s.*LEFT JOIN/is', [
            ['school_id' => 61, 'school_name' => 'Test School 61', 'school_city' => 'Monsey',
             'logo' => '', 'school_logo_id' => 0, 'school_logo_kiosk_id' => 0,
             'soldier_count' => 2, 'motto' => 'Go!', 'color' => null, 'goal_override' => null],
            ['school_id' => 269, 'school_name' => 'Test School 269', 'school_city' => 'Brooklyn',
             'logo' => '', 'school_logo_id' => 0, 'school_logo_kiosk_id' => 0,
             'soldier_count' => 1, 'motto' => '', 'color' => null, 'goal_override' => null],
        ]],
        ['/FROM school_registrations|EXISTS \(\s*SELECT 1 FROM school_registrations/i', [['1' => 1]]],
        ['/SELECT 1 FROM schools WHERE school_id/i', [['1' => 1]]],

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
        ['/UPDATE lulav_photos/i', []],
        ['/DELETE FROM lulav_photos/i', []],
        ['/INSERT INTO lulav_photos/i', []],
        ['/user_id, day_number, public_id, status, mime_type, file_name FROM lulav_photos/i', lulav_test_photo_rows()],
        ['/SELECT photo\.user_id, photo\.day_number, u\.user_serial FROM lulav_photos/i', [
            ['user_id' => 9001, 'day_number' => 2, 'user_serial' => 555001],
        ]],
        ['/SELECT \* FROM lulav_photos/i', lulav_test_photo_rows()],

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
        ['/FROM users u.*(u\.user_serial|u\.user_id) = :value/is', [$kids[0]]],
        ['/SELECT 1 FROM users WHERE user_serial = :serial AND dob/i', [['1' => 1]]],
        ['/SELECT user_serial, school_id FROM users/i', [[
            'user_serial' => 555001, 'school_id' => 61,
        ]]],
        ['/FROM classes c/i', [
            ['class_id' => 7, 'class_grade' => 5, 'class_sub' => 'Boys', 'kid_count' => 2],
        ]],
        ['/FROM users u/i', [$kids[0]]],
        ['/FROM users/i', [$kids[0]]],

        // --- admin --------------------------------------------------------------
        ['/SELECT auth, first, last, username FROM admins/i', [[
            'auth' => 'super', 'first' => 'Test', 'last' => 'Admin', 'username' => 'testadmin',
        ]]],
        ['/FROM admin_auths/i', [['school_id' => 61]]],
        ['/FROM admins/i', [[
            'admin_id' => 1, 'auth' => 'super', 'first' => 'Test', 'last' => 'Admin', 'username' => 'testadmin',
        ]]],
    ];
}
