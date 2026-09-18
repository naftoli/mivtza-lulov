<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function lulavRoutePath(): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $prefix = '/mivtzoim/lulav/api';
    if (strpos($path, $prefix) === 0) {
        $path = substr($path, strlen($prefix));
    }
    $path = preg_replace('#^/index\.php#', '', (string) $path);
    return '/' . trim((string) $path, '/');
}

function lulavCampaignTaskMap(): array
{
    global $MASHPIA_DB;
    static $map;
    if ($map !== null) {
        return $map;
    }
    lulavRequireTables(['lulav_api_task_map']);
    $campaign = lulavCampaign();
    $stmt = $MASHPIA_DB->prepare(
        'SELECT field_name, day_number, grid_id, start_date, end_date
         FROM lulav_api_task_map
         WHERE mivtzoim_id = :campaign AND school_year = :school_year
         ORDER BY field_name, day_number'
    );
    $stmt->execute([
        ':campaign' => $campaign['mivtzoim_id'],
        ':school_year' => lulavCurrentSchoolYear(),
    ]);
    return $map = $stmt->fetchAll();
}

/**
 * Resolves the campaign's teacher-grid cells to concrete date_task_id sets, ONCE
 * per request.
 *
 * Every aggregate used to re-derive this inside its own hot query:
 *
 *   lulav_api_task_map -> date_tasks ON grid_id -> date_tasks_missions -> marks
 *
 * date_tasks is MyISAM and is not indexed on grid_id, so each of the ~12 map rows
 * could drive a table scan — a leaderboard returning zero rows measured 3.3 s on
 * production, and the unfiltered nationwide variant in lulavSchoolTotals() never
 * finished at all (Cloudflare 524 after 125 s).
 *
 * Resolving the ids up front lets every caller filter on
 * `date_tasks_marks.date_task_id IN (...)`, which is covered by that table's
 * PRIMARY KEY (user_id, date_task_id) and UNIQUE KEY (date_task_id, user_id).
 *
 * A grid cell legitimately maps to many date_tasks (one per level / lang_id /
 * school_type_id), so each field+day owns a LIST of ids.
 *
 * @return array{byField: array<string, array<int, int[]>>, day: int[], minutes: int[], all: int[]}
 */
function lulavCampaignTaskIds(): array
{
    global $MASHPIA_DB;
    static $resolved;
    if ($resolved !== null) {
        return $resolved;
    }
    lulavRequireTables(['lulav_api_task_map']);
    $campaign = lulavCampaign();
    $stmt = $MASHPIA_DB->prepare(
        'SELECT map.field_name, map.day_number, task.date_task_id
         FROM lulav_api_task_map map
         JOIN date_tasks task ON task.grid_id = map.grid_id
         JOIN date_tasks_missions mission
           ON mission.date_tasks_mission_id = task.date_tasks_mission_id
          AND mission.start_date >= map.start_date
          AND mission.end_date <= map.end_date
         WHERE map.mivtzoim_id = :campaign
           AND map.school_year = :school_year'
    );
    $stmt->execute([
        ':campaign' => $campaign['mivtzoim_id'],
        ':school_year' => lulavCurrentSchoolYear(),
    ]);

    $byField = [];
    $flat = ['day' => [], 'minutes' => [], 'all' => []];
    foreach ($stmt->fetchAll() as $row) {
        $field = (string) $row['field_name'];
        $day = (int) $row['day_number'];
        $taskId = (int) $row['date_task_id'];
        $byField[$field][$day][] = $taskId;
        if (isset($flat[$field])) {
            $flat[$field][$taskId] = $taskId;
        }
        $flat['all'][$taskId] = $taskId;
    }

    return $resolved = [
        'byField' => $byField,
        'day' => array_values($flat['day']),
        'minutes' => array_values($flat['minutes']),
        'all' => array_values($flat['all']),
    ];
}

/** date_task_id list backing one field+day, or [] when the mapping is incomplete. */
function lulavTaskIdsFor(string $field, int $day): array
{
    return lulavCampaignTaskIds()['byField'][$field][$day] ?? [];
}

/** date_task_id => Sukkos day, for the given field. */
function lulavDayByTaskId(string $field): array
{
    $days = [];
    foreach (lulavCampaignTaskIds()['byField'][$field] ?? [] as $day => $taskIds) {
        foreach ($taskIds as $taskId) {
            $days[$taskId] = (int) $day;
        }
    }
    return $days;
}

function lulavCampaignDays(): array
{
    static $days;
    if ($days !== null) {
        return $days;
    }
    $days = [];
    foreach (lulavCampaignTaskMap() as $map) {
        if ($map['field_name'] === 'day') {
            $day = (int) $map['day_number'];
            if ($day >= 1 && $day <= 7) {
                $days[$day] = $day;
            }
        }
    }
    sort($days);
    return $days = array_values($days);
}

function lulavValidateTaskMap(array $mapping): void
{
    $mappedDays = ['day' => [], 'minutes' => []];
    foreach ($mapping as $row) {
        if (isset($mappedDays[$row['field_name']])) {
            $mappedDays[$row['field_name']][] = (int) $row['day_number'];
        }
    }
    $requiredDays = lulavCampaignDays();
    sort($requiredDays);
    foreach ($mappedDays as &$days) {
        sort($days);
    }
    unset($days);
    if (count($requiredDays) !== 6
        || $mappedDays['day'] !== $requiredDays
        || $mappedDays['minutes'] !== $requiredDays) {
        lulavError(
            'The Lulav teacher-grid task mapping is incomplete.',
            503,
            [
                'requiredShakeDays' => $requiredDays,
                'requiredMinuteDays' => $requiredDays,
            ]
        );
    }
}

function lulavPerKidGoal(): int
{
    global $MASHPIA_DB;
    static $cached;
    if ($cached !== null) {
        return $cached;
    }
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_campaign_settings']);
    $stmt = $MASHPIA_DB->prepare(
        'SELECT per_kid_goal FROM lulav_campaign_settings
         WHERE mivtzoim_id = :campaign AND school_year = :school_year'
    );
    $stmt->execute([
        ':campaign' => $campaign['mivtzoim_id'],
        ':school_year' => lulavCurrentSchoolYear(),
    ]);
    $goal = $stmt->fetchColumn();
    return $cached = ($goal === false ? 3 : max(1, (int) $goal));
}

function lulavPercent(int $total, int $goal): int
{
    return max(0, (int) floor(($total / max(1, $goal)) * 100));
}

function lulavSchoolTotals(?int $onlyId = null): array
{
    global $MASHPIA_DB;
    $taskIds = lulavCampaignTaskIds()['day'];
    if (!$taskIds) {
        return [];
    }
    [$taskIn, $params] = lulavIdPlaceholders('task', $taskIds);
    // Driven from date_tasks_marks on the resolved date_task_id set: the old
    // shape re-joined date_tasks/date_tasks_missions for the whole country and
    // never returned. Scoped to one school when only one is being rendered.
    $sql = "SELECT u.school_id, SUM(m.done_qty) AS total
            FROM date_tasks_marks m
            JOIN users u ON u.user_id = m.user_id
            WHERE m.date_task_id IN ($taskIn)
              AND m.mark_inactive = 0
              AND " . lulavEligibleUserCondition('u');
    if ($onlyId !== null) {
        $sql .= ' AND u.school_id = :school';
        $params[':school'] = $onlyId;
    }
    $sql .= ' GROUP BY u.school_id';

    $stmt = $MASHPIA_DB->prepare($sql);
    $stmt->execute($params);
    $totals = [];
    foreach ($stmt->fetchAll() as $row) {
        $totals[(int) $row['school_id']] = (int) $row['total'];
    }
    return $totals;
}

function lulavSchoolRows(?int $onlyId = null): array
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_school_settings', 'lulav_campaign_settings', 'lulav_api_task_map']);

    $year = lulavCurrentSchoolYear();
    $australian = lulavAustralianSchoolSql();
    $params = [
        ':campaign' => $campaign['mivtzoim_id'],
        ':current_year' => $year,
        ':previous_year' => $year - 1,
    ];

    // Headcount comes from a grouped derived table driven by user_registration
    // (selective on `year`) rather than a correlated EXISTS evaluated once per
    // row of `users`. The correlated form never returned on production.
    $rosterFilter = '';
    if ($onlyId !== null) {
        $rosterFilter = ' AND u.school_id = :roster_school';
        $params[':roster_school'] = $onlyId;
    }
    $sql = "SELECT s.school_id, s.school_name, s.school_city,
                   s.logo, s.school_logo_id, s.school_logo_kiosk_id,
                   COALESCE(roster.soldier_count, 0) AS soldier_count,
                   settings.motto, settings.color, settings.goal_override
            FROM schools s
            LEFT JOIN (
                SELECT u.school_id, COUNT(DISTINCT u.user_id) AS soldier_count
                FROM user_registration reg
                JOIN users u ON u.user_id = reg.user_id
                WHERE (
                        reg.year = :current_year
                        OR (
                            reg.year = :previous_year
                            AND u.school_id IN ($australian)
                        )
                      )
                      $rosterFilter
                GROUP BY u.school_id
            ) roster ON roster.school_id = s.school_id
            LEFT JOIN lulav_school_settings settings
              ON settings.school_id = s.school_id
             AND settings.mivtzoim_id = :campaign
             AND settings.school_year = :current_year
            WHERE s.school_era IS NULL
              AND s.test_school = 0
              AND EXISTS (
                  SELECT 1
                  FROM school_registrations registration
                  WHERE registration.school_id = s.school_id
                    AND (
                        registration.year = :current_year
                        OR (
                            registration.year = :previous_year
                            AND s.school_id IN ($australian)
                        )
                    )
              )";
    if ($onlyId !== null) {
        $sql .= ' AND s.school_id = :school';
        $params[':school'] = $onlyId;
    }
    $sql .= ' ORDER BY s.school_name';

    $stmt = $MASHPIA_DB->prepare($sql);
    $stmt->execute($params);
    $totals = lulavSchoolTotals($onlyId);
    $perKidGoal = lulavPerKidGoal();
    $colors = ['#1479b8', '#e4a11b', '#25845b', '#9b3f87', '#d45145', '#5867b1'];
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $schoolId = (int) $row['school_id'];
        $kidCount = (int) $row['soldier_count'];
        $total = $totals[$schoolId] ?? 0;
        // No max(1, ...) floor here. It was meant to keep a zero out of the
        // divisor, but lulavPercent() already guards that itself, so all the
        // floor did was give a school with no registered children a goal of 1 —
        // and /stats sums these, so the nationwide goal came out one too high
        // per empty school (9 of 76 on production: 25,260 instead of
        // 8,417 x 3 = 25,251). The goal is now exactly headcount x per-child.
        $automaticGoal = $kidCount * $perKidGoal;
        $goalCustom = $row['goal_override'] !== null && (int) $row['goal_override'] > 0;
        $goal = $goalCustom ? (int) $row['goal_override'] : $automaticGoal;
        // A zero goal must not read as "reached": 0 >= 0 is true, which would
        // badge every empty school as goal-complete and bonus-active.
        $goalReached = $goal > 0 && $total >= $goal;
        // Bonus rounds never run out. Reaching the goal starts round 1; each
        // round's target is one more shake per child than the last, and the next
        // round starts the moment a target is reached, so bonusGoal is always
        // still ahead of total. Must match decorateSchool() in src/services/api.js.
        $step = max(1, $kidCount);
        $bonusLevel = $goalReached ? intdiv($total - $goal, $step) + 1 : 0;
        $bonusGoal = $goal + max(1, $bonusLevel) * $step;
        // The school's own logo, from the same /schoolLogos/ file Base Commander
        // shows and uploads to. logo.png there is its generic placeholder
        // (DEFAULT_LOGO), so skip it and try the older files-table logo, which a
        // few schools only have. Null keeps the front end's initials tile.
        $logoFile = trim((string) $row['logo']);
        $logoId = (int) ($row['school_logo_id'] ?: $row['school_logo_kiosk_id']);
        $logo = null;
        if ($logoFile !== '' && $logoFile !== 'logo.png') {
            $logo = '/schoolLogos/' . rawurlencode($logoFile);
        } elseif ($logoId > 0) {
            $logo = '/file_view.php?id=' . $logoId;
        }
        $rows[] = [
            'id' => (string) $schoolId,
            'name' => $row['school_name'],
            'city' => $row['school_city'],
            'logo' => $logo,
            'kidCount' => $kidCount,
            'soldierCount' => $kidCount,
            'perKidGoal' => $perKidGoal,
            'goalCustom' => $goalCustom,
            'goalOverride' => $goalCustom ? $goal : null,
            'goal' => $goal,
            'bonusLevel' => $bonusLevel,
            'bonusGoal' => $bonusGoal,
            'bonusActive' => $goalReached,
            'total' => $total,
            'goalReached' => $goalReached,
            'percent' => lulavPercent($total, $goal),
            'percentOfBase' => lulavPercent($total, $goal),
            'motto' => $row['motto'] ?: '',
            'endDate' => lulavDateFromJd((int) $campaign['start'] + 9),
            'color' => $row['color'] ?: $colors[$schoolId % count($colors)],
        ];
    }
    return $rows;
}

function lulavKidsForSchool(int $schoolId): array
{
    global $MASHPIA_DB;
    lulavRequireEligibleSchool($schoolId);
    $stmt = $MASHPIA_DB->prepare(
        "SELECT u.user_id, u.user_serial, u.first, u.last, u.first_he, u.last_he,
                u.dob, u.gender, u.school_id, u.class_id, u.mobile_pic, u.user_photo_id,
                c.class_grade, c.class_sub, s.school_name,
                (SELECT r.rank_name
                   FROM rank_marks rm JOIN ranks r USING (rank_ord)
                  WHERE rm.user_id = u.user_id
                  ORDER BY rm.rank_ord DESC LIMIT 1) AS rank_name,
                (SELECT r.rank_image_id
                   FROM rank_marks rm JOIN ranks r USING (rank_ord)
                  WHERE rm.user_id = u.user_id
                  ORDER BY rm.rank_ord DESC LIMIT 1) AS rank_image_id
         FROM users u
         JOIN schools s ON s.school_id = u.school_id
         LEFT JOIN classes c ON c.class_id = u.class_id
         WHERE u.school_id = :school
           AND " . lulavEligibleUserCondition('u') . "
         ORDER BY c.class_grade, c.class_sub, u.last, u.first"
    );
    $stmt->execute([':school' => $schoolId]);
    return array_map('lulavSerializeKid', $stmt->fetchAll());
}

function lulavPhotoFile(array $photo): string
{
    return LULAV_PHOTO_ROOT . '/' . basename($photo['file_name']);
}

function lulavPhotoValue(array $photo, bool $allowPending): ?string
{
    if ($photo['status'] === 'approved') {
        return '/mivtzoim/lulav/api/photos/' . $photo['public_id'] . '/file';
    }
    if (!$allowPending || $photo['status'] === 'rejected') {
        return null;
    }
    $file = lulavPhotoFile($photo);
    if (!is_file($file)) {
        return null;
    }
    return 'data:' . $photo['mime_type'] . ';base64,' . base64_encode((string) file_get_contents($file));
}

function lulavValidatePhotos(array $photos, int $limit): void
{
    if (count($photos) > $limit) {
        lulavError('Too many photos were supplied.', 422);
    }
    foreach ($photos as $photo) {
        if (!is_string($photo)) {
            lulavError('Each photo must be a data URL or an existing API photo URL.', 422);
        }
        if (strpos($photo, 'data:image/') === 0) {
            if (!preg_match('#^data:image/(?:jpeg|png|webp);base64,#', $photo)) {
                lulavError('Photos must be JPEG, PNG, or WebP data URLs.', 422);
            }
            if (strlen($photo) > 7 * 1024 * 1024) {
                lulavError('Each photo must be no larger than 5 MB.', 422);
            }
        } elseif (!preg_match('#^/mivtzoim/lulav/api/photos/[a-f0-9]{32}/file$#', $photo)) {
            lulavError('Invalid photo value.', 422);
        }
    }
}

function lulavValidateMarkTargets(array $kid, array $mapping): void
{
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(
        'SELECT u.school_type_id, u.lang_id, ut.level
         FROM users u
         JOIN user_tracks ut ON ut.user_id = u.user_id AND ut.subject_id = 12
         WHERE u.user_id = :user
         LIMIT 1'
    );
    $stmt->execute([':user' => $kid['user_id']]);
    $track = $stmt->fetch();
    if (!$track) {
        lulavError('This soldier does not have a Mivtzoim track.', 422);
    }

    // One query for the whole mapping instead of one per mapped cell (12 round
    // trips on every child's save).
    $gridIds = array_map(static function (array $row): int {
        return (int) $row['grid_id'];
    }, $mapping);
    if (!$gridIds) {
        lulavError('The Lulav teacher-grid task mapping is incomplete.', 503);
    }
    [$gridIn, $params] = lulavIdPlaceholders('grid', array_unique($gridIds));
    $params += [
        ':level' => $track['level'],
        ':lang' => $track['lang_id'],
        ':school_type' => $track['school_type_id'],
    ];
    $stmt = $MASHPIA_DB->prepare(
        "SELECT task.grid_id, task.quantity, mission.start_date, mission.end_date
         FROM date_tasks task
         JOIN date_tasks_missions mission USING (date_tasks_mission_id)
         WHERE task.grid_id IN ($gridIn)
           AND mission.subject_id = 12
           AND mission.level = :level
           AND mission.lang_id = :lang
           AND mission.school_type_id = :school_type"
    );
    $stmt->execute($params);
    $candidates = [];
    foreach ($stmt->fetchAll() as $task) {
        $candidates[(int) $task['grid_id']][] = $task;
    }

    foreach ($mapping as $row) {
        $requiresQuantity = in_array($row['field_name'], ['day', 'minutes'], true);
        $matched = false;
        foreach ($candidates[(int) $row['grid_id']] ?? [] as $task) {
            if ((int) $task['start_date'] < (int) $row['start_date']
                || (int) $task['end_date'] > (int) $row['end_date']) {
                continue;
            }
            if ($requiresQuantity && (int) $task['quantity'] < 1) {
                continue;
            }
            $matched = true;
            break;
        }
        if (!$matched) {
            lulavError(
                'No matching quantity teacher-grid task exists for this soldier.',
                422,
                ['field' => $row['field_name'], 'day' => (int) $row['day_number']]
            );
        }
    }
}

function lulavDayReportId(int $userId, int $day): string
{
    $signature = substr(
        hash_hmac(
            'sha256',
            'lulav-day:' . lulavCurrentSchoolYear() . ':' . $userId . ':' . $day,
            lulavSigningSecret()
        ),
        0,
        20
    );
    return 'day-' . $userId . '-' . $day . '-' . $signature;
}

function lulavDayReportIdentity(string $reportId): ?array
{
    if (!preg_match('/^day-(\d+)-([1-7])-([a-f0-9]{20})$/', $reportId, $match)) {
        return null;
    }
    $userId = (int) $match[1];
    $day = (int) $match[2];
    return hash_equals(lulavDayReportId($userId, $day), $reportId)
        ? ['userId' => $userId, 'day' => $day]
        : null;
}

/**
 * Loads non-rejected photos for one school, or one child, in a SINGLE query and
 * folds them to [user_id][day] => [url|dataUrl, ...].
 */
function lulavLoadDayPhotos(?int $schoolId, ?int $userId, bool $allowPending): array
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_photos']);
    $sql = "SELECT user_id, day_number, public_id, status, mime_type, file_name
            FROM lulav_photos
            WHERE mivtzoim_id = :campaign
              AND school_year = :school_year
              AND status != 'rejected'";
    $params = [
        ':campaign' => $campaign['mivtzoim_id'],
        ':school_year' => lulavCurrentSchoolYear(),
    ];
    if ($userId !== null) {
        $sql .= ' AND user_id = :user';
        $params[':user'] = $userId;
    } elseif ($schoolId !== null) {
        $sql .= ' AND school_id = :school';
        $params[':school'] = $schoolId;
    }
    $sql .= ' ORDER BY photo_id';

    $stmt = $MASHPIA_DB->prepare($sql);
    $stmt->execute($params);
    $photos = [];
    foreach ($stmt->fetchAll() as $photo) {
        $value = lulavPhotoValue($photo, $allowPending);
        if ($value) {
            $photos[(int) $photo['user_id']][(int) $photo['day_number']][] = $value;
        }
    }
    return $photos;
}

function &lulavUserPhotoCache(): array
{
    static $cache = [];
    return $cache;
}

function lulavForgetUserPhotos(int $userId): void
{
    $cache = &lulavUserPhotoCache();
    unset($cache[$userId . ':pending'], $cache[$userId . ':approved']);
}

function lulavDayPhotos(int $userId, int $day, bool $allowPending): array
{
    $cache = &lulavUserPhotoCache();
    $key = $userId . ($allowPending ? ':pending' : ':approved');
    if (!isset($cache[$key])) {
        $cache[$key] = lulavLoadDayPhotos(null, $userId, $allowPending)[$userId] ?? [];
    }
    return $cache[$key][$day] ?? [];
}

function lulavStoreDayPhoto(string $dataUrl, array $kid, int $day): void
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    if (!preg_match('#^data:(image/(?:jpeg|png|webp));base64,(.+)$#s', $dataUrl, $matches)) {
        lulavError('Photos must be JPEG, PNG, or WebP data URLs.', 422);
    }
    $binary = base64_decode(str_replace(' ', '+', $matches[2]), true);
    if ($binary === false || strlen($binary) > 5 * 1024 * 1024) {
        lulavError('Each photo must be no larger than 5 MB.', 422);
    }
    $hash = hash('sha256', $binary);
    $stmt = $MASHPIA_DB->prepare(
        'SELECT photo_id, status FROM lulav_photos
         WHERE mivtzoim_id = :campaign AND user_id = :user
           AND school_year = :school_year
           AND day_number = :day AND content_hash = :hash'
    );
    $stmt->execute([
        ':campaign' => $campaign['mivtzoim_id'],
        ':school_year' => lulavCurrentSchoolYear(),
        ':user' => $kid['user_id'],
        ':day' => $day,
        ':hash' => $hash,
    ]);
    $existing = $stmt->fetch();
    if ($existing) {
        if ($existing['status'] === 'rejected') {
            $restore = $MASHPIA_DB->prepare(
                "UPDATE lulav_photos
                 SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
                 WHERE photo_id = :photo"
            );
            $restore->execute([':photo' => $existing['photo_id']]);
        }
        return;
    }

    if (!is_dir(LULAV_PHOTO_ROOT)
        && !mkdir(LULAV_PHOTO_ROOT, 0750, true)
        && !is_dir(LULAV_PHOTO_ROOT)) {
        lulavError('Photo storage is unavailable.', 503);
    }
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $publicId = bin2hex(random_bytes(16));
    $fileName = $publicId . '.' . $extensions[$matches[1]];
    if (file_put_contents(LULAV_PHOTO_ROOT . '/' . $fileName, $binary, LOCK_EX) === false) {
        lulavError('The photo could not be stored.', 500);
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            'INSERT INTO lulav_photos
                (public_id, mivtzoim_id, school_year, user_id, school_id, day_number,
                 file_name, mime_type, content_hash)
             VALUES
                (:public, :campaign, :school_year, :user, :school, :day, :file, :mime, :hash)'
        );
        $stmt->execute([
            ':public' => $publicId,
            ':campaign' => $campaign['mivtzoim_id'],
            ':school_year' => lulavCurrentSchoolYear(),
            ':user' => $kid['user_id'],
            ':school' => $kid['school_id'],
            ':day' => $day,
            ':file' => $fileName,
            ':mime' => $matches[1],
            ':hash' => $hash,
        ]);
    } catch (Throwable $error) {
        @unlink(LULAV_PHOTO_ROOT . '/' . $fileName);
        throw $error;
    }
}

function lulavReconcileDayPhotos(array $kid, int $day, array $photos): void
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    $retainedIds = [];
    $retainedHashes = [];
    foreach ($photos as $photo) {
        if (preg_match('#/photos/([a-f0-9]{32})/file$#', $photo, $match)) {
            $retainedIds[] = $match[1];
        } elseif (preg_match('#^data:image/(?:jpeg|png|webp);base64,(.+)$#s', $photo, $match)) {
            $binary = base64_decode(str_replace(' ', '+', $match[1]), true);
            if ($binary !== false) {
                $retainedHashes[] = hash('sha256', $binary);
            }
        }
    }
    $params = [
        ':campaign' => $campaign['mivtzoim_id'],
        ':school_year' => lulavCurrentSchoolYear(),
        ':user' => $kid['user_id'],
        ':day' => $day,
    ];
    $idPlaceholders = [];
    foreach ($retainedIds as $index => $value) {
        $key = ':retained_id_' . $index;
        $idPlaceholders[] = $key;
        $params[$key] = $value;
    }
    $hashPlaceholders = [];
    foreach ($retainedHashes as $index => $value) {
        $key = ':retained_hash_' . $index;
        $hashPlaceholders[] = $key;
        $params[$key] = $value;
    }
    $stmt = $MASHPIA_DB->prepare(
        "UPDATE lulav_photos
         SET status = 'rejected', reviewed_by = NULL, reviewed_at = NOW()
         WHERE mivtzoim_id = :campaign AND school_year = :school_year
           AND user_id = :user AND day_number = :day
           AND status != 'rejected'"
        . ($idPlaceholders ? ' AND public_id NOT IN (' . implode(',', $idPlaceholders) . ')' : '')
        . ($hashPlaceholders ? ' AND content_hash NOT IN (' . implode(',', $hashPlaceholders) . ')' : '')
    );
    $stmt->execute($params);
}

function lulavEmptyMark(): array
{
    return [
        'value' => 0,
        'hidden' => 0,
        'note' => '',
        'updated' => null,
        'mark_date' => null,
    ];
}

/**
 * Loads every mapped mark for one school, or one child, in a SINGLE query and
 * folds it to [user_id][day] => ['day' => mark, 'minutes' => mark].
 *
 * This replaces two queries per child per Sukkos day (lulavMappedDayMark), which
 * made the report grid cost roster x 6 x 2 round trips.
 */
function lulavLoadDayMarks(?int $schoolId, ?int $userId): array
{
    global $MASHPIA_DB;
    $taskIds = lulavCampaignTaskIds()['all'];
    if (!$taskIds) {
        return [];
    }
    [$taskIn, $params] = lulavIdPlaceholders('task', $taskIds);
    // A plain JOIN rather than `user_id IN (SELECT ...)`: semi-join handling
    // varies across the MySQL/MariaDB versions this platform has run on, and
    // this shape is driven by date_tasks_marks' own index either way.
    $join = '';
    $where = '';
    if ($userId !== null) {
        $where = ' AND m.user_id = :user';
        $params[':user'] = $userId;
    } elseif ($schoolId !== null) {
        $join = 'JOIN users u ON u.user_id = m.user_id';
        $where = ' AND u.school_id = :school AND ' . lulavEligibleUserCondition('u');
        $params[':school'] = $schoolId;
    }
    $sql = "SELECT m.user_id, m.date_task_id, m.done_qty, m.mark_inactive,
                   m.mark_description, m.updated, m.mark_date
            FROM date_tasks_marks m
            $join
            WHERE m.date_task_id IN ($taskIn)$where";
    // Highest count wins, and its own note/timestamp travels with it. The old
    // per-column MAX() could pair one mark's count with another mark's story.
    $sql .= ' ORDER BY m.done_qty ASC, m.updated ASC';

    $stmt = $MASHPIA_DB->prepare($sql);
    $stmt->execute($params);

    $dayOf = [
        'day' => lulavDayByTaskId('day'),
        'minutes' => lulavDayByTaskId('minutes'),
    ];
    $marks = [];
    foreach ($stmt->fetchAll() as $row) {
        $taskId = (int) $row['date_task_id'];
        $user = (int) $row['user_id'];
        foreach ($dayOf as $field => $map) {
            if (!isset($map[$taskId])) {
                continue;
            }
            $marks[$user][$map[$taskId]][$field] = [
                'value' => (int) $row['done_qty'],
                'hidden' => (int) $row['mark_inactive'],
                'note' => (string) $row['mark_description'],
                'updated' => $row['updated'],
                'mark_date' => $row['mark_date'],
            ];
        }
    }
    return $marks;
}

/**
 * Per-child mark cache. Reads within one request hit it repeatedly (prefill,
 * then the response body); writes must drop it via lulavForgetUserMarks().
 */
function &lulavUserMarkCache(): array
{
    static $cache = [];
    return $cache;
}

function lulavForgetUserMarks(int $userId): void
{
    $cache = &lulavUserMarkCache();
    unset($cache[$userId]);
}

function lulavMarksForUser(int $userId): array
{
    $cache = &lulavUserMarkCache();
    if (!isset($cache[$userId])) {
        $cache[$userId] = lulavLoadDayMarks(null, $userId)[$userId] ?? [];
    }
    return $cache[$userId];
}

function lulavMappedDayMark(int $userId, string $field, int $day): array
{
    return lulavMarksForUser($userId)[$day][$field] ?? lulavEmptyMark();
}

function lulavDayReport(array $kid, int $day, bool $allowPending): array
{
    lulavRequireEligibleSchool((int) $kid['school_id']);
    if (!in_array($day, lulavCampaignDays(), true)) {
        lulavError('Invalid Sukkos day.', 422);
    }
    return lulavBuildDayReport(
        $kid,
        $day,
        lulavMappedDayMark((int) $kid['user_id'], 'day', $day),
        lulavMappedDayMark((int) $kid['user_id'], 'minutes', $day),
        lulavDayPhotos((int) $kid['user_id'], $day, $allowPending),
        $allowPending
    );
}

/**
 * Serializes one child/day report from values the caller already holds. The
 * batch endpoints load every mark and photo for a school in two queries and
 * call this, instead of issuing ~7 queries per row.
 */
function lulavBuildDayReport(
    array $kid,
    int $day,
    array $countMark,
    array $minuteMark,
    array $photos,
    bool $allowPending
): array {
    $updated = $countMark['updated'] ?: $minuteMark['updated'];
    $createdAt = $updated ? gmdate(DATE_ATOM, strtotime($updated)) : null;
    if (!$createdAt && !empty($countMark['mark_date'])) {
        $createdAt = lulavDateFromJd((int) $countMark['mark_date']) . 'T00:00:00Z';
    }
    return [
        'id' => lulavDayReportId((int) $kid['user_id'], $day),
        'kidId' => $allowPending ? (string) $kid['user_serial'] : null,
        'kidKey' => lulavPublicKidId((int) $kid['user_id']),
        'kidName' => trim($kid['first'] . ' ' . mb_substr($kid['last'], 0, 1)) . '.',
        'schoolId' => (string) $kid['school_id'],
        'classId' => $kid['class_id'] ? (string) $kid['class_id'] : null,
        'rank' => $kid['rank_name'] ?: '',
        'rankImageUrl' => !empty($kid['rank_image_id'])
            ? '/file_view.php?id=' . (int) $kid['rank_image_id']
            : null,
        'day' => $day,
        'count' => (int) $countMark['value'],
        'minutes' => (int) $minuteMark['value'],
        'note' => (string) ($countMark['note'] ?? ''),
        'photos' => $photos,
        'photo' => $photos[0] ?? null,
        'photoApproved' => !$photos || strpos($photos[0], 'data:') !== 0,
        'createdAt' => $createdAt,
        'hidden' => (bool) $countMark['hidden'],
    ];
}

function lulavMarkMapValue(array $kid, array $map, int $value): void
{
    $campaign = lulavCampaign();
    $marks = [
        (int) $map['grid_id'] => [
            (int) $kid['user_id'] => [
                (int) $map['start_date'] => [(int) $map['end_date'] => $value],
            ],
        ],
    ];
    $mivtzoim = new Mivtzoim((int) $campaign['mivtzoim_id']);
    $mivtzoim->markTasks($marks);
}

function lulavMapFor(string $field, int $day): array
{
    foreach (lulavCampaignTaskMap() as $map) {
        if ($map['field_name'] === $field && (int) $map['day_number'] === $day) {
            return $map;
        }
    }
    lulavError('The Lulav teacher-grid task mapping is incomplete.', 503);
}

function lulavUpdateDayDescription(array $kid, int $day, string $note): void
{
    global $MASHPIA_DB;
    $taskIds = lulavTaskIdsFor('day', $day);
    if (!$taskIds) {
        return;
    }
    [$taskIn, $params] = lulavIdPlaceholders('task', $taskIds);
    $params[':note'] = $note;
    $params[':user'] = (int) $kid['user_id'];
    $stmt = $MASHPIA_DB->prepare(
        "UPDATE date_tasks_marks mark
         SET mark.mark_description = :note, mark.updated = NOW()
         WHERE mark.user_id = :user AND mark.date_task_id IN ($taskIn)"
    );
    $stmt->execute($params);
}

function lulavSaveDayReport(array $kid, int $day, array $input): array
{
    global $MASHPIA_DB;
    if (!in_array($day, lulavCampaignDays(), true)) {
        lulavError('Invalid Sukkos day.', 422);
    }
    $count = $input['count'] ?? null;
    $minutes = $input['minutes'] ?? 0;
    if (!is_numeric($count) || (int) $count < 1 || (int) $count > 65535) {
        lulavError('Count must be between 1 and 65,535.', 422);
    }
    if (!is_numeric($minutes) || (int) $minutes < 0 || (int) $minutes > 65535) {
        lulavError('Minutes must be between 0 and 65,535.', 422);
    }
    // An ABSENT field leaves the stored value alone; an explicitly empty one
    // clears it. Previously both read as "clear", so any caller that omitted
    // these keys -- the documented POST /shakes alias among them -- erased the
    // child's story and rejected every photo on that day, while count and
    // minutes were protected by max(). A stale form could not lower a
    // teacher-entered number but could still wipe a teacher-entered story.
    // The UI always sends both keys, so its per-photo delete button and an
    // emptied story still work exactly as before.
    $note = null;
    if (array_key_exists('note', $input)) {
        $note = trim((string) $input['note']);
        if (strlen($note) > 10000) {
            lulavError('The story must be 10,000 characters or fewer.', 422);
        }
    }
    $photos = null;
    if (array_key_exists('photos', $input)) {
        if (!is_array($input['photos'])) {
            lulavError('Photos must be supplied as an array.', 422);
        }
        $photos = $input['photos'];
        lulavValidatePhotos($photos, 8);
    }

    return lulavWithUserLock((int) $kid['user_id'], static function () use (
        $kid,
        $day,
        $count,
        $minutes,
        $note,
        $photos,
        $MASHPIA_DB
    ): array {
        $mapping = lulavCampaignTaskMap();
        lulavValidateTaskMap($mapping);
        lulavValidateMarkTargets($kid, $mapping);
        $countMap = lulavMapFor('day', $day);
        $minuteMap = lulavMapFor('minutes', $day);
        $currentCount = (int) lulavMappedDayMark((int) $kid['user_id'], 'day', $day)['value'];
        $currentMinutes = (int) lulavMappedDayMark((int) $kid['user_id'], 'minutes', $day)['value'];
        lulavMarkMapValue($kid, $countMap, max($currentCount, (int) $count));
        lulavMarkMapValue($kid, $minuteMap, max($currentMinutes, (int) $minutes));
        if ($note !== null) {
            lulavUpdateDayDescription($kid, $day, $note);
        }
        if ($photos !== null) {
            foreach ($photos as $photo) {
                if (strpos($photo, 'data:image/') === 0) {
                    lulavStoreDayPhoto($photo, $kid, $day);
                }
            }
            lulavReconcileDayPhotos($kid, $day, $photos);
        }
        // The marks and photos just changed — drop the per-request read caches
        // so the response body reflects what was written.
        lulavForgetUserMarks((int) $kid['user_id']);
        lulavForgetUserPhotos((int) $kid['user_id']);
        return lulavDayReport($kid, $day, true);
    });
}

/** Roster rows for a set of user ids, in one query, keyed by user_id. */
function lulavKidRowsByUserId(array $userIds): array
{
    global $MASHPIA_DB;
    $unique = array_values(array_unique(array_map('intval', $userIds)));
    if (!$unique) {
        return [];
    }
    [$userIn, $params] = lulavIdPlaceholders('user', $unique);
    $stmt = $MASHPIA_DB->prepare(
        "SELECT u.user_id, u.user_serial, u.first, u.last, u.first_he, u.last_he,
                u.dob, u.gender, u.school_id, u.class_id, u.mobile_pic, u.user_photo_id,
                c.class_grade, c.class_sub, s.school_name,
                (SELECT r.rank_name
                   FROM rank_marks rm JOIN ranks r USING (rank_ord)
                  WHERE rm.user_id = u.user_id
                  ORDER BY rm.rank_ord DESC LIMIT 1) AS rank_name,
                (SELECT r.rank_image_id
                   FROM rank_marks rm JOIN ranks r USING (rank_ord)
                  WHERE rm.user_id = u.user_id
                  ORDER BY rm.rank_ord DESC LIMIT 1) AS rank_image_id
         FROM users u
         JOIN schools s ON s.school_id = u.school_id
         LEFT JOIN classes c ON c.class_id = u.class_id
         WHERE u.user_id IN ($userIn)
           AND " . lulavEligibleUserCondition('u')
    );
    $stmt->execute($params);
    $kids = [];
    foreach ($stmt->fetchAll() as $row) {
        $kids[(int) $row['user_id']] = $row;
    }
    return $kids;
}

/**
 * Cumulative daily reports for a school or a single child.
 *
 * Three queries total (marks, photos, roster). The previous implementation ran
 * one row-set query and then ~7 more per row — a 200-child school produced
 * roughly 8,400 round trips on a page the public campaign view polls every 30 s.
 *
 * $limit caps the feed; RecentShakes only renders the newest handful.
 */
function lulavDailyRows(
    ?int $schoolId,
    ?int $userId,
    bool $includeHidden,
    bool $allowPending,
    int $limit = 0
): array {
    if ($schoolId !== null) {
        lulavRequireEligibleSchool($schoolId);
    }

    $marks = $userId !== null
        ? [$userId => lulavMarksForUser($userId)]
        : lulavLoadDayMarks($schoolId, null);
    $photos = lulavLoadDayPhotos($schoolId, $userId, $allowPending);

    $entries = [];
    foreach ($marks as $markUserId => $days) {
        foreach ($days as $day => $fields) {
            if ((int) ($fields['day']['value'] ?? 0) < 1) {
                continue;
            }
            if (!$includeHidden && !empty($fields['day']['hidden'])) {
                continue;
            }
            $entries[] = [
                'userId' => (int) $markUserId,
                'day' => (int) $day,
                'sort' => (string) ($fields['day']['updated'] ?? ''),
            ];
        }
    }
    // One entry per child/day, newest first. The old SELECT DISTINCT included
    // mark.updated, so a child holding marks on two mapped tasks (a level or
    // language change) was emitted twice with duplicate ids.
    usort($entries, static function (array $a, array $b): int {
        return strcmp($b['sort'], $a['sort'])
            ?: ($a['userId'] <=> $b['userId'] ?: $a['day'] <=> $b['day']);
    });
    if ($limit > 0) {
        $entries = array_slice($entries, 0, $limit);
    }

    $kids = lulavKidRowsByUserId(array_column($entries, 'userId'));
    $rows = [];
    foreach ($entries as $entry) {
        $kid = $kids[$entry['userId']] ?? null;
        // Same gate lulavDayReport() applies per row; lulavSchoolIsEligible() is
        // memoized, so this stays one query per distinct school.
        if (!$kid || !lulavSchoolIsEligible((int) $kid['school_id'])) {
            continue;
        }
        $fields = $marks[$entry['userId']][$entry['day']] ?? [];
        $rows[] = lulavBuildDayReport(
            $kid,
            $entry['day'],
            $fields['day'] ?? lulavEmptyMark(),
            $fields['minutes'] ?? lulavEmptyMark(),
            $photos[$entry['userId']][$entry['day']] ?? [],
            $allowPending
        );
    }
    return $rows;
}

function lulavSchoolReportRows(int $schoolId): array
{
    // Two queries: the roster, then every mapped mark for that roster.
    $marks = lulavLoadDayMarks($schoolId, null);
    $days = lulavCampaignDays();
    $rows = [];
    foreach (lulavKidsForSchool($schoolId) as $serialized) {
        $userId = (int) $serialized['userId'];
        $row = [
            'id' => $serialized['serial'],
            'name' => trim($serialized['firstName'] . ' ' . $serialized['lastName']),
            'grade' => $serialized['grade'],
            'rank' => $serialized['rank'],
            'perDay' => [],
            'totalShakes' => 0,
            'totalMinutes' => 0,
        ];
        foreach ($days as $day) {
            $fields = $marks[$userId][$day] ?? [];
            $hidden = !empty($fields['day']['hidden']);
            $count = $hidden ? 0 : (int) ($fields['day']['value'] ?? 0);
            $minutes = $hidden ? 0 : (int) ($fields['minutes']['value'] ?? 0);
            $row['perDay'][(string) $day] = $count;
            $row['totalShakes'] += $count;
            $row['totalMinutes'] += $minutes;
        }
        $rows[] = $row;
    }
    return $rows;
}

function lulavLeaderboard(int $schoolId): array
{
    global $MASHPIA_DB;
    lulavRequireEligibleSchool($schoolId);
    $taskIds = lulavCampaignTaskIds()['day'];
    if (!$taskIds) {
        return [];
    }
    [$taskIn, $params] = lulavIdPlaceholders('task', $taskIds);
    $params[':school'] = $schoolId;
    $stmt = $MASHPIA_DB->prepare(
        "SELECT u.user_id, u.first, u.last, SUM(mark.done_qty) AS total,
                (SELECT r.rank_name
                   FROM rank_marks rm JOIN ranks r USING (rank_ord)
                  WHERE rm.user_id = u.user_id
                  ORDER BY rm.rank_ord DESC LIMIT 1) AS rank_name,
                (SELECT r.rank_image_id
                   FROM rank_marks rm JOIN ranks r USING (rank_ord)
                  WHERE rm.user_id = u.user_id
                  ORDER BY rm.rank_ord DESC LIMIT 1) AS rank_image_id
         FROM date_tasks_marks mark
         JOIN users u ON u.user_id = mark.user_id
         WHERE mark.date_task_id IN ($taskIn)
           AND mark.mark_inactive = 0
           AND u.school_id = :school
           AND " . lulavEligibleUserCondition('u') . "
         GROUP BY u.user_id
         ORDER BY total DESC, u.last, u.first
         LIMIT 100"
    );
    $stmt->execute($params);
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $rows[] = [
            'kidKey' => lulavPublicKidId((int) $row['user_id']),
            'name' => trim($row['first'] . ' ' . mb_substr($row['last'], 0, 1)) . '.',
            'rank' => $row['rank_name'] ?: '',
            'rankImageUrl' => !empty($row['rank_image_id'])
                ? '/file_view.php?id=' . (int) $row['rank_image_id']
                : null,
            'count' => (int) $row['total'],
            'entries' => null,
        ];
    }
    return $rows;
}

function lulavClassLeaderboard(int $schoolId): array
{
    global $MASHPIA_DB;
    lulavRequireEligibleSchool($schoolId);
    $taskIds = lulavCampaignTaskIds()['day'];
    // The mark join is now filtered directly on the resolved date_task_id set.
    // Previously `mission` was LEFT JOINed, so date_tasks rows whose mission fell
    // OUTSIDE the campaign window survived with mission.* = NULL and their marks
    // were still summed — every prior year's Lulav marks landed in this year's
    // class standings. (Observed on production: school 40 reported 14 shakes and
    // 233% here while /leaderboard, whose joins are inner, correctly reported 0.)
    $taskCondition = 'FALSE';
    $params = [':school' => $schoolId];
    if ($taskIds) {
        [$taskIn, $taskParams] = lulavIdPlaceholders('task', $taskIds);
        $taskCondition = "mark.date_task_id IN ($taskIn)";
        $params += $taskParams;
    }
    $stmt = $MASHPIA_DB->prepare(
        "SELECT c.class_id, c.class_grade, c.class_sub,
                COUNT(DISTINCT roster.user_id) AS kid_count,
                COALESCE(SUM(mark.done_qty), 0) AS total
         FROM classes c
         LEFT JOIN users roster
           ON roster.class_id = c.class_id
          AND " . lulavEligibleUserCondition('roster') . "
         LEFT JOIN date_tasks_marks mark
           ON mark.user_id = roster.user_id
          AND mark.mark_inactive = 0
          AND $taskCondition
         WHERE c.school_id = :school AND c.class_era = 0
         GROUP BY c.class_id
         -- A class with no registered children can't race (0 of 0), so leave it
         -- out, as lulavSchoolRows() leaves out schools with no children.
         HAVING kid_count > 0
         ORDER BY c.class_grade, c.class_sub"
    );
    $stmt->execute($params);
    $perKidGoal = lulavPerKidGoal();
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $kidCount = (int) $row['kid_count'];
        // Same rule as the school goal: headcount x per-child, no floor. An
        // empty class shows 0 of 0 rather than a phantom target of 1.
        $goal = $kidCount * $perKidGoal;
        $total = (int) $row['total'];
        $grade = lulavGradeLabel($row);
        $rows[] = [
            'classId' => (string) $row['class_id'],
            'grade' => $grade,
            'count' => $total,
            'kidCount' => $kidCount,
            'goal' => $goal,
            'percent' => lulavPercent($total, $goal),
        ];
    }
    usort($rows, static function (array $a, array $b): int {
        // Goal accomplished, then alphabetically by class name (natural order, so
        // 2 sorts before 10). Must match ClassLeaderboard.jsx.
        return $b['percent'] <=> $a['percent'] ?: strnatcasecmp($a['grade'], $b['grade']);
    });
    return $rows;
}

function lulavHandleKidLogin(): void
{
    global $MASHPIA_DB;
    lulavRateLimit('kid-login', 12, 900);
    $input = lulavInput();
    $serial = trim((string) ($input['serial'] ?? $input['id'] ?? ''));
    $dob = trim((string) ($input['dob'] ?? ''));
    if (!$serial || !preg_match('/^\d+$/', $serial) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob)) {
        lulavError('Serial number and date of birth are required.', 422);
    }
    $stmt = $MASHPIA_DB->prepare(
        'SELECT 1 FROM users
         WHERE user_serial = :serial AND dob = :dob
           AND ' . lulavEligibleUserCondition('users') . '
         LIMIT 1'
    );
    $stmt->execute([':serial' => $serial, ':dob' => $dob]);
    if (!$stmt->fetchColumn()) {
        lulavError('Invalid serial number or date of birth.', 401);
    }
    $kid = lulavKidBySerial($serial);
    lulavRequireEligibleSchool((int) $kid['school_id']);
    $token = lulavIssueToken('kid', (int) $kid['user_id'], ['serial' => (string) $kid['user_serial']]);
    lulavJson(['token' => $token, 'expiresIn' => (int) (lulavEnv('LULAV_TOKEN_TTL') ?: 43200), 'soldier' => lulavSerializeKid($kid)]);
}

function lulavHandleAdminLogin(): void
{
    lulavRateLimit('admin-login', 12, 900);
    $input = lulavInput();
    $username = trim((string) ($input['username'] ?? ''));
    $password = (string) ($input['password'] ?? '');
    if (!$username || !$password) {
        lulavError('Username and password are required.', 422);
    }
    $login = \mashpia\api\auth\Auth::login($username, $password);
    if (!$login || empty($login['id'])) {
        lulavError('Invalid username or password.', 401);
    }
    $scope = lulavAdminScope((int) $login['id']);
    if (!$scope['isHq'] && !$scope['schoolIds']) {
        lulavError('This account does not administer a school.', 403);
    }
    $token = lulavIssueToken('admin', (int) $scope['id']);
    $admin = [
        'id' => (string) $scope['id'],
        'username' => $scope['username'],
        'name' => $scope['name'],
        'role' => $scope['role'],
        'schoolId' => $scope['isHq'] ? null : (string) $scope['schoolIds'][0],
        'schoolIds' => array_map('strval', $scope['schoolIds']),
    ];
    lulavJson(['token' => $token, 'expiresIn' => (int) (lulavEnv('LULAV_TOKEN_TTL') ?: 43200), 'admin' => $admin]);
}

function lulavHandlePhotoReview(string $publicId, string $decision): void
{
    global $MASHPIA_DB;
    $actor = lulavRequireActor(['admin']);
    lulavRequireTables(['lulav_photos']);
    $campaign = lulavCampaign();
    $stmt = $MASHPIA_DB->prepare(
        'SELECT * FROM lulav_photos
         WHERE public_id = :id AND mivtzoim_id = :campaign AND school_year = :school_year'
    );
    $stmt->execute([
        ':id' => $publicId,
        ':campaign' => $campaign['mivtzoim_id'],
        ':school_year' => lulavCurrentSchoolYear(),
    ]);
    $photo = $stmt->fetch();
    if (!$photo) {
        lulavError('Photo not found.', 404);
    }
    lulavRequireSchoolAccess($actor, (int) $photo['school_id']);
    $status = $decision === 'approve' ? 'approved' : 'rejected';
    $stmt = $MASHPIA_DB->prepare(
        'UPDATE lulav_photos
         SET status = :status, reviewed_by = :admin, reviewed_at = NOW()
         WHERE photo_id = :id'
    );
    $stmt->execute([':status' => $status, ':admin' => $actor['id'], ':id' => $photo['photo_id']]);
    $photo['status'] = $status;
    lulavJson(['id' => $photo['public_id'], 'status' => $status]);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = lulavRoutePath();

try {
    if ($method === 'POST' && $path === '/soldier/login') {
        lulavHandleKidLogin();
    }
    if ($method === 'POST' && $path === '/admin/login') {
        lulavHandleAdminLogin();
    }
    if ($method === 'GET' && $path === '/schools') {
        lulavJson(lulavSchoolRows());
    }
    if ($method === 'GET' && preg_match('#^/schools/(\d+)$#', $path, $match)) {
        $schools = lulavSchoolRows((int) $match[1]);
        lulavJson($schools[0] ?? null, $schools ? 200 : 404);
    }
    if ($method === 'GET' && $path === '/settings') {
        $actor = lulavRequireActor(['admin']);
        $scope = lulavAdminScope((int) $actor['id']);
        if (!$scope['isHq']) {
            lulavError('HQ access required.', 403);
        }
        lulavJson(['perKidGoal' => lulavPerKidGoal()]);
    }
    if ($method === 'PATCH' && $path === '/settings') {
        global $MASHPIA_DB;
        $actor = lulavRequireActor(['admin']);
        $scope = lulavAdminScope((int) $actor['id']);
        if (!$scope['isHq']) {
            lulavError('HQ access required.', 403);
        }
        $input = lulavInput();
        if (!is_numeric($input['perKidGoal'] ?? null)
            || (int) $input['perKidGoal'] < 1
            || (int) $input['perKidGoal'] > 1000) {
            lulavError('perKidGoal must be between 1 and 1,000.', 422);
        }
        $campaign = lulavCampaign();
        $stmt = $MASHPIA_DB->prepare(
            'INSERT INTO lulav_campaign_settings (mivtzoim_id, school_year, per_kid_goal)
             VALUES (:campaign, :school_year, :goal)
             ON DUPLICATE KEY UPDATE per_kid_goal = VALUES(per_kid_goal)'
        );
        $stmt->execute([
            ':campaign' => $campaign['mivtzoim_id'],
            ':school_year' => lulavCurrentSchoolYear(),
            ':goal' => (int) $input['perKidGoal'],
        ]);
        lulavJson(['perKidGoal' => (int) $input['perKidGoal']]);
    }
    if ($method === 'PATCH' && preg_match('#^/schools/(\d+)/goal$#', $path, $match)) {
        global $MASHPIA_DB;
        $actor = lulavRequireActor(['admin']);
        $scope = lulavAdminScope((int) $actor['id']);
        if (!$scope['isHq']) {
            lulavError('HQ access required.', 403);
        }
        $schoolId = (int) $match[1];
        $schoolStmt = $MASHPIA_DB->prepare('SELECT 1 FROM schools WHERE school_id = :school');
        $schoolStmt->execute([':school' => $schoolId]);
        if (!$schoolStmt->fetchColumn()) {
            lulavError('School not found.', 404);
        }
        lulavRequireEligibleSchool($schoolId);
        $input = lulavInput();
        $override = $input['goalOverride'] ?? null;
        if ($override !== null && $override !== ''
            && (!is_numeric($override) || (int) $override < 1 || (int) $override > 10000000)) {
            lulavError('goalOverride must be null or a positive number.', 422);
        }
        $override = $override === null || $override === '' ? null : (int) $override;
        $campaign = lulavCampaign();
        $stmt = $MASHPIA_DB->prepare(
            "INSERT INTO lulav_school_settings
                (mivtzoim_id, school_year, school_id, goal_override)
             VALUES (:campaign, :school_year, :school, :goal)
             ON DUPLICATE KEY UPDATE goal_override = VALUES(goal_override)"
        );
        $stmt->execute([
            ':campaign' => $campaign['mivtzoim_id'],
            ':school_year' => lulavCurrentSchoolYear(),
            ':school' => $schoolId,
            ':goal' => $override,
        ]);
        $schools = lulavSchoolRows($schoolId);
        lulavJson($schools[0] ?? null, $schools ? 200 : 404);
    }
    if ($method === 'PATCH' && preg_match('#^/schools/(\d+)$#', $path, $match)) {
        global $MASHPIA_DB;
        $actor = lulavRequireActor(['admin']);
        $schoolId = (int) $match[1];
        lulavRequireSchoolAccess($actor, $schoolId);
        lulavRequireEligibleSchool($schoolId);
        lulavRequireTables(['lulav_school_settings']);
        $input = lulavInput();
        $campaign = lulavCampaign();
        // Only write the motto when the caller actually sent one — an unrelated
        // PATCH used to blank it, because `?? ''` made "absent" and "cleared"
        // indistinguishable.
        if (array_key_exists('motto', $input)) {
            $stmt = $MASHPIA_DB->prepare(
                "INSERT INTO lulav_school_settings (mivtzoim_id, school_year, school_id, motto)
                 VALUES (:campaign, :school_year, :school, :motto)
                 ON DUPLICATE KEY UPDATE motto = VALUES(motto)"
            );
            $stmt->execute([
                ':campaign' => $campaign['mivtzoim_id'],
                ':school_year' => lulavCurrentSchoolYear(),
                ':school' => $schoolId,
                ':motto' => trim((string) $input['motto']),
            ]);
        }
        $schools = lulavSchoolRows($schoolId);
        lulavJson($schools[0] ?? null);
    }
    if ($method === 'GET' && preg_match('#^/schools/(\d+)/classes$#', $path, $match)) {
        global $MASHPIA_DB;
        $actor = lulavRequireActor(['admin']);
        $schoolId = (int) $match[1];
        lulavRequireSchoolAccess($actor, $schoolId);
        lulavRequireEligibleSchool($schoolId);
        $stmt = $MASHPIA_DB->prepare(
            "SELECT c.class_id, c.class_grade, c.class_sub, COUNT(u.user_id) AS kid_count
             FROM classes c
             LEFT JOIN users u
               ON u.class_id = c.class_id
              AND " . lulavEligibleUserCondition('u') . "
             WHERE c.school_id = :school AND c.class_era = 0
             GROUP BY c.class_id
             ORDER BY c.class_grade, c.class_sub"
        );
        $stmt->execute([':school' => $schoolId]);
        $classes = [];
        foreach ($stmt->fetchAll() as $row) {
            $name = lulavGradeLabel($row);
            $classes[] = [
                'id' => (string) $row['class_id'],
                'name' => $name,
                'schoolId' => (string) $schoolId,
                'kidCount' => (int) $row['kid_count'],
            ];
        }
        lulavJson($classes);
    }
    if ($method === 'GET' && preg_match('#^/schools/(\d+)/soldiers$#', $path, $match)) {
        $actor = lulavRequireActor(['admin']);
        lulavRequireSchoolAccess($actor, (int) $match[1]);
        lulavJson(lulavKidsForSchool((int) $match[1]));
    }
    if ($method === 'GET' && preg_match('#^/me/days/([1-7])$#', $path, $match)) {
        $actor = lulavRequireActor(['kid']);
        $kid = lulavKidBySerial((string) $actor['serial']);
        lulavJson(lulavDayReport($kid, (int) $match[1], true));
    }
    if ($method === 'PUT' && preg_match('#^/me/days/([1-7])$#', $path, $match)) {
        $actor = lulavRequireActor(['kid']);
        $kid = lulavKidBySerial((string) $actor['serial']);
        lulavJson(lulavSaveDayReport($kid, (int) $match[1], lulavInput()));
    }
    if ($method === 'POST' && $path === '/shakes') {
        $actor = lulavRequireActor(['kid']);
        $kid = lulavKidBySerial((string) $actor['serial']);
        $input = lulavInput();
        lulavJson(lulavSaveDayReport($kid, (int) ($input['day'] ?? 0), $input));
    }
    if ($method === 'GET' && $path === '/me/shakes') {
        $actor = lulavRequireActor(['kid']);
        lulavJson(lulavDailyRows(null, (int) $actor['id'], true, true));
    }
    if ($method === 'GET' && preg_match('#^/soldier/(\d+)/shakes$#', $path, $match)) {
        $actor = lulavRequireActor(['kid', 'admin']);
        $kid = lulavKidBySerial($match[1]);
        lulavAssertKidAccess($actor, $kid);
        lulavJson(lulavDailyRows(null, (int) $kid['user_id'], true, true));
    }
    if ($method === 'GET' && preg_match('#^/schools/(\d+)/shakes$#', $path, $match)) {
        $schoolId = (int) $match[1];
        $actor = lulavActor(false);
        $includeHidden = false;
        $allowPending = false;
        if ($actor && $actor['type'] === 'admin') {
            lulavRequireSchoolAccess($actor, $schoolId);
            $includeHidden = !empty($_GET['includeHidden']);
            $allowPending = true;
        }
        // Public callers only render a short feed; cap the payload so the
        // campaign page's 30-second poll stays cheap.
        $limit = isset($_GET['limit']) ? max(0, min(500, (int) $_GET['limit'])) : 0;
        lulavJson(lulavDailyRows($schoolId, null, $includeHidden, $allowPending, $limit));
    }
    if ($method === 'GET' && preg_match('#^/schools/(\d+)/leaderboard$#', $path, $match)) {
        lulavJson(lulavLeaderboard((int) $match[1]));
    }
    if ($method === 'GET' && preg_match('#^/schools/(\d+)/class-leaderboard$#', $path, $match)) {
        lulavJson(lulavClassLeaderboard((int) $match[1]));
    }
    if ($method === 'PATCH' && preg_match('#^/shakes/(day-\d+-[1-7]-[a-f0-9]{20})$#', $path, $match)) {
        global $MASHPIA_DB;
        $actor = lulavRequireActor(['admin']);
        lulavRequireTables(['lulav_api_task_map']);
        $identity = lulavDayReportIdentity($match[1]);
        if (!$identity) {
            lulavError('Shake not found.', 404);
        }
        $userId = $identity['userId'];
        $day = $identity['day'];
        $stmt = $MASHPIA_DB->prepare(
            'SELECT user_serial, school_id FROM users
             WHERE user_id = :user
               AND ' . lulavEligibleUserCondition('users')
        );
        $stmt->execute([':user' => $userId]);
        $user = $stmt->fetch();
        if (!$user) {
            lulavError('Shake not found.', 404);
        }
        lulavRequireSchoolAccess($actor, (int) $user['school_id']);
        lulavRequireEligibleSchool((int) $user['school_id']);
        $hidden = !empty(lulavInput()['hidden']) ? 1 : 0;
        $taskIds = array_merge(
            lulavTaskIdsFor('day', $day),
            lulavTaskIdsFor('minutes', $day)
        );
        if (!$taskIds) {
            lulavError('The Lulav teacher-grid task mapping is incomplete.', 503);
        }
        lulavWithUserLock($userId, static function () use (
            $userId,
            $hidden,
            $taskIds,
            $MASHPIA_DB
        ): void {
            [$taskIn, $params] = lulavIdPlaceholders('task', $taskIds);
            $params[':hidden'] = $hidden;
            $params[':user'] = $userId;
            $stmt = $MASHPIA_DB->prepare(
                "UPDATE date_tasks_marks mark
                 SET mark.mark_inactive = :hidden
                 WHERE mark.user_id = :user AND mark.date_task_id IN ($taskIn)"
            );
            $stmt->execute($params);
        });
        lulavForgetUserMarks($userId);
        $kid = lulavKidBySerial((string) $user['user_serial']);
        lulavJson(lulavDayReport($kid, $day, true));
    }
    if ($method === 'GET' && preg_match('#^/schools/(\d+)/report-rows$#', $path, $match)) {
        $actor = lulavRequireActor(['admin']);
        $schoolId = (int) $match[1];
        lulavRequireSchoolAccess($actor, $schoolId);
        lulavRequireEligibleSchool($schoolId);
        lulavJson(lulavSchoolReportRows($schoolId));
    }
    if ($method === 'GET' && preg_match('#^/schools/(\d+)/photos/pending$#', $path, $match)) {
        global $MASHPIA_DB;
        $actor = lulavRequireActor(['admin']);
        $schoolId = (int) $match[1];
        lulavRequireSchoolAccess($actor, $schoolId);
        lulavRequireEligibleSchool($schoolId);
        lulavRequireTables(['lulav_photos']);
        $stmt = $MASHPIA_DB->prepare(
            "SELECT photo.user_id, photo.day_number, u.user_serial
             FROM lulav_photos photo
             JOIN users u ON u.user_id = photo.user_id
             WHERE photo.school_id = :school
               AND photo.mivtzoim_id = :campaign
               AND photo.school_year = :school_year
               AND photo.status = 'pending'
             GROUP BY photo.user_id, photo.day_number, u.user_serial
             ORDER BY MAX(photo.created_at) DESC"
        );
        $campaign = lulavCampaign();
        $stmt->execute([
            ':school' => $schoolId,
            ':campaign' => $campaign['mivtzoim_id'],
            ':school_year' => lulavCurrentSchoolYear(),
        ]);
        $queue = $stmt->fetchAll();
        // Batch the roster, marks and photos instead of ~7 queries per queued row.
        $kids = lulavKidRowsByUserId(array_column($queue, 'user_id'));
        $marks = lulavLoadDayMarks($schoolId, null);
        $photos = lulavLoadDayPhotos($schoolId, null, true);
        $pending = [];
        foreach ($queue as $row) {
            $userId = (int) $row['user_id'];
            $day = (int) $row['day_number'];
            if (!isset($kids[$userId])) {
                continue;
            }
            $fields = $marks[$userId][$day] ?? [];
            $pending[] = lulavBuildDayReport(
                $kids[$userId],
                $day,
                $fields['day'] ?? lulavEmptyMark(),
                $fields['minutes'] ?? lulavEmptyMark(),
                $photos[$userId][$day] ?? [],
                true
            );
        }
        lulavJson($pending);
    }
    if ($method === 'POST'
        && preg_match('#^/shakes/(day-\d+-[1-7]-[a-f0-9]{20})/photos/(approve|reject)$#', $path, $match)) {
        global $MASHPIA_DB;
        $actor = lulavRequireActor(['admin']);
        $identity = lulavDayReportIdentity($match[1]);
        if (!$identity) {
            lulavError('Shake not found.', 404);
        }
        $stmt = $MASHPIA_DB->prepare(
            'SELECT user_serial, school_id FROM users
             WHERE user_id = :user AND ' . lulavEligibleUserCondition('users')
        );
        $stmt->execute([':user' => $identity['userId']]);
        $user = $stmt->fetch();
        if (!$user) {
            lulavError('Shake not found.', 404);
        }
        lulavRequireSchoolAccess($actor, (int) $user['school_id']);
        lulavRequireEligibleSchool((int) $user['school_id']);
        $status = $match[2] === 'approve' ? 'approved' : 'rejected';
        $update = $MASHPIA_DB->prepare(
            'UPDATE lulav_photos
             SET status = :status, reviewed_by = :admin, reviewed_at = NOW()
             WHERE mivtzoim_id = :campaign AND school_year = :school_year
               AND user_id = :user AND day_number = :day
               AND status = \'pending\''
        );
        $campaign = lulavCampaign();
        $update->execute([
            ':status' => $status,
            ':admin' => $actor['id'],
            ':campaign' => $campaign['mivtzoim_id'],
            ':school_year' => lulavCurrentSchoolYear(),
            ':user' => $identity['userId'],
            ':day' => $identity['day'],
        ]);
        lulavForgetUserPhotos((int) $identity['userId']);
        $kid = lulavKidBySerial((string) $user['user_serial']);
        lulavJson(lulavDayReport($kid, $identity['day'], true));
    }
    if ($method === 'POST' && preg_match('#^/schools/(\d+)/photos/approve-all$#', $path, $match)) {
        global $MASHPIA_DB;
        $actor = lulavRequireActor(['admin']);
        $schoolId = (int) $match[1];
        lulavRequireSchoolAccess($actor, $schoolId);
        lulavRequireEligibleSchool($schoolId);
        $campaign = lulavCampaign();
        $countStmt = $MASHPIA_DB->prepare(
            "SELECT COUNT(DISTINCT CONCAT(user_id, ':', day_number))
             FROM lulav_photos
             WHERE mivtzoim_id = :campaign AND school_year = :school_year
               AND school_id = :school AND status = 'pending'"
        );
        $countStmt->execute([
            ':campaign' => $campaign['mivtzoim_id'],
            ':school_year' => lulavCurrentSchoolYear(),
            ':school' => $schoolId,
        ]);
        $count = (int) $countStmt->fetchColumn();
        $update = $MASHPIA_DB->prepare(
            "UPDATE lulav_photos
             SET status = 'approved', reviewed_by = :admin, reviewed_at = NOW()
             WHERE mivtzoim_id = :campaign AND school_year = :school_year
               AND school_id = :school AND status = 'pending'"
        );
        $update->execute([
            ':admin' => $actor['id'],
            ':campaign' => $campaign['mivtzoim_id'],
            ':school_year' => lulavCurrentSchoolYear(),
            ':school' => $schoolId,
        ]);
        lulavJson(['approved' => $count]);
    }
    if ($method === 'POST' && preg_match('#^/photos/([a-f0-9]{32})/(approve|reject)$#', $path, $match)) {
        lulavHandlePhotoReview($match[1], $match[2]);
    }
    if ($method === 'GET' && preg_match('#^/photos/([a-f0-9]{32})/file$#', $path, $match)) {
        global $MASHPIA_DB;
        lulavRequireTables(['lulav_photos']);
        $stmt = $MASHPIA_DB->prepare(
            "SELECT * FROM lulav_photos WHERE public_id = :id AND status = 'approved'"
        );
        $stmt->execute([':id' => $match[1]]);
        $photo = $stmt->fetch();
        if (!$photo || !is_file(lulavPhotoFile($photo))) {
            lulavError('Photo not found.', 404);
        }
        header('Content-Type: ' . $photo['mime_type']);
        header('Cache-Control: public, max-age=86400');
        readfile(lulavPhotoFile($photo));
        exit;
    }
    if ($method === 'GET' && $path === '/stats') {
        $schools = lulavSchoolRows();
        $campaign = lulavCampaign();
        lulavRequireTables(['lulav_photos']);
        global $MASHPIA_DB;
        $stmt = $MASHPIA_DB->prepare(
            "SELECT COUNT(*) FROM lulav_photos
             WHERE mivtzoim_id = :campaign
               AND school_year = :school_year
               AND status = 'approved'"
        );
        $stmt->execute([
            ':campaign' => $campaign['mivtzoim_id'],
            ':school_year' => lulavCurrentSchoolYear(),
        ]);
        lulavJson([
            'totalShakes' => array_sum(array_column($schools, 'total')),
            'totalGoal' => array_sum(array_column($schools, 'goal')),
            'totalSchools' => count($schools),
            'activeSoldiers' => array_sum(array_column($schools, 'kidCount')),
            'totalPhotos' => (int) $stmt->fetchColumn(),
        ]);
    }
} catch (PDOException $error) {
    lulavSchemaError($error);
} catch (Throwable $error) {
    error_log('Lulav API: ' . $error->getMessage());
    lulavError('The request could not be completed.', 500);
}

lulavError('Endpoint not found.', 404);
