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
    lulavRequireTables(['lulav_api_task_map']);
    $campaign = lulavCampaign();
    $stmt = $MASHPIA_DB->prepare(
        'SELECT field_name, day_number, grid_id, start_date, end_date
         FROM lulav_api_task_map
         WHERE mivtzoim_id = :campaign
         ORDER BY field_name, day_number'
    );
    $stmt->execute([':campaign' => $campaign['mivtzoim_id']]);
    return $stmt->fetchAll();
}

function lulavCampaignDays(): array
{
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
    return array_values($days);
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
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_campaign_settings']);
    $stmt = $MASHPIA_DB->prepare(
        'SELECT per_kid_goal FROM lulav_campaign_settings WHERE mivtzoim_id = :campaign'
    );
    $stmt->execute([':campaign' => $campaign['mivtzoim_id']]);
    $goal = $stmt->fetchColumn();
    return $goal === false ? 3 : max(1, (int) $goal);
}

function lulavPercent(int $total, int $goal): int
{
    return max(0, (int) floor(($total / max(1, $goal)) * 100));
}

function lulavCurrentSchoolYear(): int
{
    $year = (int) GlobalSettings::getCurrentYear();
    if ($year < 1) {
        lulavError('The current school year is not configured.', 503);
    }
    return $year;
}

function lulavAustralianSchoolSql(): string
{
    $ids = array_map('intval', GlobalSettings::getAustralian());
    return $ids ? implode(',', $ids) : '0';
}

function lulavSchoolIsEligible(int $schoolId): bool
{
    global $MASHPIA_DB;
    $year = lulavCurrentSchoolYear();
    $stmt = $MASHPIA_DB->prepare(
        'SELECT 1
         FROM school_registrations registration
         WHERE registration.school_id = :school
           AND (
             registration.year = :year
             OR (
               registration.year = :previous_year
               AND registration.school_id IN (' . lulavAustralianSchoolSql() . ')
             )
           )
         LIMIT 1'
    );
    $stmt->execute([
        ':school' => $schoolId,
        ':year' => $year,
        ':previous_year' => $year - 1,
    ]);
    return (bool) $stmt->fetchColumn();
}

function lulavRequireEligibleSchool(int $schoolId): void
{
    if (!lulavSchoolIsEligible($schoolId)) {
        lulavError('School is not registered for this campaign.', 404);
    }
}

function lulavSchoolTotals(int $campaignId): array
{
    global $MASHPIA_DB;
    lulavRequireTables(['lulav_api_task_map']);
    $stmt = $MASHPIA_DB->prepare(
        "SELECT u.school_id, SUM(m.done_qty) AS total
         FROM lulav_api_task_map map
         JOIN date_tasks dt ON dt.grid_id = map.grid_id
         JOIN date_tasks_missions mission
           ON mission.date_tasks_mission_id = dt.date_tasks_mission_id
          AND mission.start_date >= map.start_date
          AND mission.end_date <= map.end_date
         JOIN date_tasks_marks m ON m.date_task_id = dt.date_task_id
         JOIN users u ON u.user_id = m.user_id
         WHERE map.mivtzoim_id = :campaign
           AND map.field_name = 'day'
           AND m.mark_inactive = 0
         GROUP BY u.school_id"
    );
    $stmt->execute([':campaign' => $campaignId]);
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

    $sql = "SELECT s.school_id, s.school_name, s.school_city,
                   COUNT(u.user_id) AS soldier_count,
                   settings.motto, settings.color, settings.goal_override
            FROM schools s
            LEFT JOIN users u
              ON u.school_id = s.school_id AND u.user_registered > 0
            LEFT JOIN lulav_school_settings settings
              ON settings.school_id = s.school_id
             AND settings.mivtzoim_id = :campaign
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
                            AND s.school_id IN (" . lulavAustralianSchoolSql() . ")
                        )
                    )
              )";
    $year = lulavCurrentSchoolYear();
    $params = [
        ':campaign' => $campaign['mivtzoim_id'],
        ':current_year' => $year,
        ':previous_year' => $year - 1,
    ];
    if ($onlyId !== null) {
        $sql .= ' AND s.school_id = :school';
        $params[':school'] = $onlyId;
    }
    $sql .= ' GROUP BY s.school_id ORDER BY s.school_name';

    $stmt = $MASHPIA_DB->prepare($sql);
    $stmt->execute($params);
    $totals = lulavSchoolTotals((int) $campaign['mivtzoim_id']);
    $perKidGoal = lulavPerKidGoal();
    $colors = ['#1479b8', '#e4a11b', '#25845b', '#9b3f87', '#d45145', '#5867b1'];
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $schoolId = (int) $row['school_id'];
        $kidCount = (int) $row['soldier_count'];
        $total = $totals[$schoolId] ?? 0;
        $automaticGoal = max(1, $kidCount * $perKidGoal);
        $goalCustom = $row['goal_override'] !== null && (int) $row['goal_override'] > 0;
        $goal = $goalCustom ? (int) $row['goal_override'] : $automaticGoal;
        $bonusActive = $total >= $goal;
        $bonusGoal = $goal + $kidCount;
        $rows[] = [
            'id' => (string) $schoolId,
            'name' => $row['school_name'],
            'city' => $row['school_city'],
            'kidCount' => $kidCount,
            'soldierCount' => $kidCount,
            'perKidGoal' => $perKidGoal,
            'automaticGoal' => $automaticGoal,
            'goalCustom' => $goalCustom,
            'goalOverride' => $goalCustom ? $goal : null,
            'goal' => $goal,
            'bonusGoal' => $bonusGoal,
            'activeGoal' => $bonusActive ? $bonusGoal : $goal,
            'bonusActive' => $bonusActive,
            'bonusComplete' => $bonusActive && $total >= $bonusGoal,
            'bonusLevel' => $bonusActive ? 1 : 0,
            'total' => $total,
            'goalReached' => $total >= $goal,
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
         WHERE u.school_id = :school AND u.user_registered > 0
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

function lulavPhotos(string $sourceType, int $sourceId, bool $allowPending): array
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_photos']);
    $stmt = $MASHPIA_DB->prepare(
        "SELECT * FROM lulav_photos
         WHERE source_type = :type AND source_id = :source
           AND mivtzoim_id = :campaign
           AND status != 'rejected'
         ORDER BY photo_id"
    );
    $stmt->execute([
        ':type' => $sourceType,
        ':source' => $sourceId,
        ':campaign' => $campaign['mivtzoim_id'],
    ]);
    $photos = [];
    foreach ($stmt->fetchAll() as $photo) {
        $value = lulavPhotoValue($photo, $allowPending);
        if ($value) {
            $photos[] = $value;
        }
    }
    return $photos;
}

function lulavStorePhoto(
    string $dataUrl,
    int $campaignId,
    int $userId,
    int $schoolId,
    string $sourceType,
    int $sourceId
): void {
    global $MASHPIA_DB;
    if (!preg_match('#^data:(image/(?:jpeg|png|webp));base64,(.+)$#s', $dataUrl, $matches)) {
        lulavError('Photos must be JPEG, PNG, or WebP data URLs.', 422);
    }
    if (strlen($matches[2]) > 7 * 1024 * 1024) {
        lulavError('Each photo must be no larger than 5 MB.', 422);
    }
    $binary = base64_decode(str_replace(' ', '+', $matches[2]), true);
    if ($binary === false || strlen($binary) > 5 * 1024 * 1024) {
        lulavError('Each photo must be no larger than 5 MB.', 422);
    }
    $contentHash = hash('sha256', $binary);
    $stmt = $MASHPIA_DB->prepare(
        'SELECT photo_id, status FROM lulav_photos
         WHERE mivtzoim_id = :campaign AND source_type = :type
           AND source_id = :source AND content_hash = :hash'
    );
    $stmt->execute([
        ':campaign' => $campaignId,
        ':type' => $sourceType,
        ':source' => $sourceId,
        ':hash' => $contentHash,
    ]);
    $existing = $stmt->fetch();
    if ($existing) {
        if ($existing['status'] === 'rejected') {
            $restore = $MASHPIA_DB->prepare(
                "UPDATE lulav_photos
                 SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
                 WHERE photo_id = :id"
            );
            $restore->execute([':id' => $existing['photo_id']]);
        }
        return;
    }
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!is_dir(LULAV_PHOTO_ROOT) && !mkdir(LULAV_PHOTO_ROOT, 0750, true) && !is_dir(LULAV_PHOTO_ROOT)) {
        lulavError('Photo storage is unavailable.', 503);
    }
    $publicId = bin2hex(random_bytes(16));
    $fileName = $publicId . '.' . $extensions[$matches[1]];
    if (file_put_contents(LULAV_PHOTO_ROOT . '/' . $fileName, $binary, LOCK_EX) === false) {
        lulavError('The photo could not be stored.', 500);
    }
    try {
        $stmt = $MASHPIA_DB->prepare(
            "INSERT INTO lulav_photos
                (public_id, mivtzoim_id, user_id, school_id, source_type, source_id,
                 file_name, mime_type, content_hash)
             VALUES
                (:public, :campaign, :user, :school, :type, :source, :file, :mime, :hash)"
        );
        $stmt->execute([
            ':public' => $publicId,
            ':campaign' => $campaignId,
            ':user' => $userId,
            ':school' => $schoolId,
            ':type' => $sourceType,
            ':source' => $sourceId,
            ':file' => $fileName,
            ':mime' => $matches[1],
            ':hash' => $contentHash,
        ]);
    } catch (PDOException $error) {
        @unlink(LULAV_PHOTO_ROOT . '/' . $fileName);
        lulavSchemaError($error);
    }
}

function lulavReconcileReportPhotos(array $kid, array $photos): void
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

    $stmt = $MASHPIA_DB->prepare(
        "SELECT photo_id, public_id, content_hash
         FROM lulav_photos
         WHERE mivtzoim_id = :campaign
           AND source_type = 'report'
           AND source_id = :user
           AND status != 'rejected'"
    );
    $stmt->execute([':campaign' => $campaign['mivtzoim_id'], ':user' => $kid['user_id']]);
    $reject = $MASHPIA_DB->prepare(
        "UPDATE lulav_photos
         SET status = 'rejected', reviewed_by = NULL, reviewed_at = NOW()
         WHERE photo_id = :id"
    );
    foreach ($stmt->fetchAll() as $existing) {
        if (!in_array($existing['public_id'], $retainedIds, true)
            && !in_array($existing['content_hash'], $retainedHashes, true)) {
            $reject->execute([':id' => $existing['photo_id']]);
        }
    }
}

function lulavMappedMarks(int $userId): array
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    $mapping = lulavCampaignTaskMap();
    lulavValidateTaskMap($mapping);

    $stmt = $MASHPIA_DB->prepare(
        "SELECT map.field_name, map.day_number, COALESCE(MAX(mark.done_qty), 0) AS value
         FROM lulav_api_task_map map
         JOIN date_tasks task ON task.grid_id = map.grid_id
         JOIN date_tasks_missions mission
           ON mission.date_tasks_mission_id = task.date_tasks_mission_id
          AND mission.start_date >= map.start_date
          AND mission.end_date <= map.end_date
         LEFT JOIN date_tasks_marks mark
           ON mark.date_task_id = task.date_task_id
          AND mark.user_id = :user
         WHERE map.mivtzoim_id = :campaign
         GROUP BY map.field_name, map.day_number"
    );
    $stmt->execute([':user' => $userId, ':campaign' => $campaign['mivtzoim_id']]);
    $result = [
        'days' => [],
        'minutes' => null,
        'peopleWithFriends' => null,
        'peoplePersonal' => null,
    ];
    foreach ($stmt->fetchAll() as $row) {
        $value = (int) $row['value'];
        if ($row['field_name'] === 'day') {
            if ($value > 0) {
                $result['days'][] = (int) $row['day_number'];
            }
        } else {
            $result[$row['field_name']] = $value ?: null;
        }
    }
    sort($result['days']);
    return $result;
}

function lulavReadReport(array $kid, bool $allowPending = true): array
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_reports', 'lulav_photos', 'lulav_api_task_map']);
    $stmt = $MASHPIA_DB->prepare(
        'SELECT story, updated_at FROM lulav_reports
         WHERE mivtzoim_id = :campaign AND user_id = :user'
    );
    $stmt->execute([':campaign' => $campaign['mivtzoim_id'], ':user' => $kid['user_id']]);
    $meta = $stmt->fetch() ?: ['story' => '', 'updated_at' => null];
    $marks = lulavMappedMarks((int) $kid['user_id']);
    return array_merge($marks, [
        'kidId' => (string) $kid['user_serial'],
        'schoolId' => (string) $kid['school_id'],
        'story' => $meta['story'],
        'photos' => lulavPhotos('report', (int) $kid['user_id'], $allowPending),
        'updatedAt' => $meta['updated_at'] ? gmdate(DATE_ATOM, strtotime($meta['updated_at'])) : null,
    ]);
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

    $stmt = $MASHPIA_DB->prepare(
        'SELECT task.quantity
         FROM date_tasks task
         JOIN date_tasks_missions mission USING (date_tasks_mission_id)
         WHERE task.grid_id = :grid
           AND mission.start_date >= :start
           AND mission.end_date <= :end
           AND mission.subject_id = 12
           AND mission.level = :level
           AND mission.lang_id = :lang
           AND mission.school_type_id = :school_type
         LIMIT 1'
    );
    foreach ($mapping as $row) {
        $stmt->execute([
            ':grid' => $row['grid_id'],
            ':start' => $row['start_date'],
            ':end' => $row['end_date'],
            ':level' => $track['level'],
            ':lang' => $track['lang_id'],
            ':school_type' => $track['school_type_id'],
        ]);
        $task = $stmt->fetch();
        $requiresQuantity = in_array($row['field_name'], ['day', 'minutes'], true);
        if (!$task || ($requiresQuantity && (int) $task['quantity'] < 1)) {
            lulavError(
                'No matching quantity teacher-grid task exists for this soldier.',
                422,
                ['field' => $row['field_name'], 'day' => (int) $row['day_number']]
            );
        }
    }
}

function lulavWriteMarks(array $kid, array $input): void
{
    $campaign = lulavCampaign();
    $mapping = lulavCampaignTaskMap();
    lulavValidateTaskMap($mapping);
    lulavValidateMarkTargets($kid, $mapping);
    $days = array_map('intval', is_array($input['days'] ?? null) ? $input['days'] : []);
    $allowedDays = [1, 2, 3, 4, 6, 7];
    if (array_diff($days, $allowedDays)) {
        lulavError('Invalid Succos day.', 422);
    }

    $marks = [];
    foreach ($mapping as $row) {
        $field = $row['field_name'];
        if ($field === 'day') {
            $value = in_array((int) $row['day_number'], $days, true) ? 1 : 0;
        } else {
            $raw = $input[$field] ?? null;
            if ($raw !== null && (!is_numeric($raw) || (int) $raw < 0 || (int) $raw > 65535)) {
                lulavError($field . ' must be between 0 and 65,535.', 422);
            }
            $value = $raw === null ? 0 : (int) $raw;
        }
        $marks[(int) $row['grid_id']][(int) $kid['user_id']]
            [(int) $row['start_date']][(int) $row['end_date']] = $value;
    }

    $mivtzoim = new Mivtzoim((int) $campaign['mivtzoim_id']);
    $mivtzoim->markTasks($marks);
}

function lulavSaveReportUnlocked(array $kid, array $input): array
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_reports', 'lulav_photos', 'lulav_api_task_map']);
    $story = trim((string) ($input['story'] ?? ''));
    if (strlen($story) > 10000) {
        lulavError('The story must be 10,000 characters or fewer.', 422);
    }
    $photos = is_array($input['photos'] ?? null) ? $input['photos'] : [];
    lulavValidatePhotos($photos, 8);
    lulavWriteMarks($kid, $input);

    $stmt = $MASHPIA_DB->prepare(
        "INSERT INTO lulav_reports (mivtzoim_id, user_id, story)
         VALUES (:campaign, :user, :story)
         ON DUPLICATE KEY UPDATE story = VALUES(story), updated_at = CURRENT_TIMESTAMP"
    );
    $stmt->execute([
        ':campaign' => $campaign['mivtzoim_id'],
        ':user' => $kid['user_id'],
        ':story' => $story,
    ]);

    foreach ($photos as $photo) {
        if (is_string($photo) && strpos($photo, 'data:image/') === 0) {
            lulavStorePhoto(
                $photo,
                (int) $campaign['mivtzoim_id'],
                (int) $kid['user_id'],
                (int) $kid['school_id'],
                'report',
                (int) $kid['user_id']
            );
        }
    }
    lulavReconcileReportPhotos($kid, $photos);
    return lulavReadReport($kid, true);
}

function lulavSaveReport(array $kid, array $input): array
{
    return lulavWithUserLock((int) $kid['user_id'], static function () use ($kid, $input): array {
        return lulavSaveReportUnlocked($kid, $input);
    });
}

function lulavShakeRows(?int $schoolId, ?int $userId, bool $includeHidden, bool $allowPending): array
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_api_task_map', 'lulav_photos']);
    $sql = "SELECT u.user_id, u.user_serial, u.first, u.last, u.school_id, u.class_id,
                   SUM(mark.done_qty) AS shake_count,
                   MAX(mark.mark_description) AS note,
                   MAX(mark.mark_inactive) AS hidden,
                   MAX(mark.mark_date) AS mark_date
            FROM lulav_api_task_map map
            JOIN date_tasks task ON task.grid_id = map.grid_id
            JOIN date_tasks_missions mission
              ON mission.date_tasks_mission_id = task.date_tasks_mission_id
             AND mission.start_date >= map.start_date
             AND mission.end_date <= map.end_date
            JOIN date_tasks_marks mark ON mark.date_task_id = task.date_task_id
            JOIN users u ON u.user_id = mark.user_id
            WHERE map.mivtzoim_id = :campaign
              AND map.field_name = 'peoplePersonal'
              AND u.user_registered > 0";
    $params = [':campaign' => $campaign['mivtzoim_id']];
    if ($schoolId !== null) {
        $sql .= ' AND u.school_id = :school';
        $params[':school'] = $schoolId;
    }
    if ($userId !== null) {
        $sql .= ' AND u.user_id = :user';
        $params[':user'] = $userId;
    }
    if (!$includeHidden) {
        $sql .= ' AND mark.mark_inactive = 0';
    }
    $sql .= ' GROUP BY u.user_id
              HAVING shake_count > 0
              ORDER BY mark_date DESC';
    $stmt = $MASHPIA_DB->prepare($sql);
    $stmt->execute($params);
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $photos = lulavPhotos('shake', (int) $row['user_id'], $allowPending);
        $rows[] = [
            'id' => lulavMarkPublicId((int) $row['user_id']),
            'kidId' => $allowPending
                ? (string) $row['user_serial']
                : lulavPublicKidId((int) $row['user_id']),
            'kidName' => trim($row['first'] . ' ' . mb_substr($row['last'], 0, 1)) . '.',
            'schoolId' => (string) $row['school_id'],
            'classId' => $row['class_id'] ? (string) $row['class_id'] : null,
            'count' => (int) $row['shake_count'],
            'note' => $row['note'],
            'photos' => $photos,
            'photo' => $photos[0] ?? null,
            'photoApproved' => !$photos || strpos($photos[0], 'data:') !== 0,
            'createdAt' => lulavDateFromJd($row['mark_date']) . 'T00:00:00Z',
            'hidden' => (bool) $row['hidden'],
        ];
    }
    return $rows;
}

function lulavDayReportId(int $userId, int $day): string
{
    $signature = substr(
        hash_hmac('sha256', 'lulav-day:' . $userId . ':' . $day, lulavSigningSecret()),
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

function lulavDayPhotos(int $userId, int $day, bool $allowPending): array
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_photos']);
    $stmt = $MASHPIA_DB->prepare(
        "SELECT * FROM lulav_photos
         WHERE mivtzoim_id = :campaign AND user_id = :user
           AND day_number = :day AND status != 'rejected'
         ORDER BY photo_id"
    );
    $stmt->execute([
        ':campaign' => $campaign['mivtzoim_id'],
        ':user' => $userId,
        ':day' => $day,
    ]);
    $photos = [];
    foreach ($stmt->fetchAll() as $photo) {
        $value = lulavPhotoValue($photo, $allowPending);
        if ($value) {
            $photos[] = $value;
        }
    }
    return $photos;
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
           AND day_number = :day AND content_hash = :hash'
    );
    $stmt->execute([
        ':campaign' => $campaign['mivtzoim_id'],
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
                (public_id, mivtzoim_id, user_id, school_id, day_number,
                 file_name, mime_type, content_hash)
             VALUES
                (:public, :campaign, :user, :school, :day, :file, :mime, :hash)'
        );
        $stmt->execute([
            ':public' => $publicId,
            ':campaign' => $campaign['mivtzoim_id'],
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
         WHERE mivtzoim_id = :campaign AND user_id = :user AND day_number = :day
           AND status != 'rejected'"
        . ($idPlaceholders ? ' AND public_id NOT IN (' . implode(',', $idPlaceholders) . ')' : '')
        . ($hashPlaceholders ? ' AND content_hash NOT IN (' . implode(',', $hashPlaceholders) . ')' : '')
    );
    $stmt->execute($params);
}

function lulavMappedDayMark(int $userId, string $field, int $day): array
{
    global $MASHPIA_DB;
    $campaign = lulavCampaign();
    $stmt = $MASHPIA_DB->prepare(
        "SELECT COALESCE(MAX(mark.done_qty), 0) AS value,
                COALESCE(MAX(mark.mark_inactive), 0) AS hidden,
                MAX(mark.mark_description) AS note,
                MAX(mark.updated) AS updated,
                MAX(mark.mark_date) AS mark_date
         FROM lulav_api_task_map map
         JOIN date_tasks task ON task.grid_id = map.grid_id
         JOIN date_tasks_missions mission
           ON mission.date_tasks_mission_id = task.date_tasks_mission_id
          AND mission.start_date >= map.start_date
          AND mission.end_date <= map.end_date
         LEFT JOIN date_tasks_marks mark
           ON mark.date_task_id = task.date_task_id AND mark.user_id = :user
         WHERE map.mivtzoim_id = :campaign
           AND map.field_name = :field AND map.day_number = :day"
    );
    $stmt->execute([
        ':user' => $userId,
        ':campaign' => $campaign['mivtzoim_id'],
        ':field' => $field,
        ':day' => $day,
    ]);
    return $stmt->fetch() ?: [
        'value' => 0,
        'hidden' => 0,
        'note' => '',
        'updated' => null,
        'mark_date' => null,
    ];
}

function lulavDayReport(array $kid, int $day, bool $allowPending): array
{
    lulavRequireEligibleSchool((int) $kid['school_id']);
    if (!in_array($day, lulavCampaignDays(), true)) {
        lulavError('Invalid Sukkos day.', 422);
    }
    $countMark = lulavMappedDayMark((int) $kid['user_id'], 'day', $day);
    $minuteMark = lulavMappedDayMark((int) $kid['user_id'], 'minutes', $day);
    $photos = lulavDayPhotos((int) $kid['user_id'], $day, $allowPending);
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

function lulavUpdateDayDescription(array $kid, array $map, string $note): void
{
    global $MASHPIA_DB;
    $stmt = $MASHPIA_DB->prepare(
        'UPDATE date_tasks_marks mark
         JOIN date_tasks task ON task.date_task_id = mark.date_task_id
         JOIN date_tasks_missions mission USING (date_tasks_mission_id)
         SET mark.mark_description = :note, mark.updated = NOW()
         WHERE mark.user_id = :user AND task.grid_id = :grid
           AND mission.start_date >= :start AND mission.end_date <= :end'
    );
    $stmt->execute([
        ':note' => $note,
        ':user' => $kid['user_id'],
        ':grid' => $map['grid_id'],
        ':start' => $map['start_date'],
        ':end' => $map['end_date'],
    ]);
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
    $note = trim((string) ($input['note'] ?? ''));
    if (strlen($note) > 10000) {
        lulavError('The story must be 10,000 characters or fewer.', 422);
    }
    $photos = is_array($input['photos'] ?? null) ? $input['photos'] : [];
    lulavValidatePhotos($photos, 8);

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
        lulavUpdateDayDescription($kid, $countMap, $note);
        foreach ($photos as $photo) {
            if (strpos($photo, 'data:image/') === 0) {
                lulavStoreDayPhoto($photo, $kid, $day);
            }
        }
        lulavReconcileDayPhotos($kid, $day, $photos);
        return lulavDayReport($kid, $day, true);
    });
}

function lulavDailyRows(?int $schoolId, ?int $userId, bool $includeHidden, bool $allowPending): array
{
    global $MASHPIA_DB;
    if ($schoolId !== null) {
        lulavRequireEligibleSchool($schoolId);
    }
    $campaign = lulavCampaign();
    $sql = "SELECT DISTINCT u.user_serial, map.day_number, mark.updated
            FROM lulav_api_task_map map
            JOIN date_tasks task ON task.grid_id = map.grid_id
            JOIN date_tasks_missions mission
              ON mission.date_tasks_mission_id = task.date_tasks_mission_id
             AND mission.start_date >= map.start_date
             AND mission.end_date <= map.end_date
            JOIN date_tasks_marks mark
              ON mark.date_task_id = task.date_task_id AND mark.done_qty > 0
            JOIN users u ON u.user_id = mark.user_id AND u.user_registered > 0
            WHERE map.mivtzoim_id = :campaign AND map.field_name = 'day'";
    $params = [':campaign' => $campaign['mivtzoim_id']];
    if ($schoolId !== null) {
        $sql .= ' AND u.school_id = :school';
        $params[':school'] = $schoolId;
    }
    if ($userId !== null) {
        $sql .= ' AND u.user_id = :user';
        $params[':user'] = $userId;
    }
    if (!$includeHidden) {
        $sql .= ' AND mark.mark_inactive = 0';
    }
    $sql .= ' ORDER BY mark.updated DESC';
    $stmt = $MASHPIA_DB->prepare($sql);
    $stmt->execute($params);
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $kid = lulavKidBySerial((string) $row['user_serial']);
        $report = lulavDayReport($kid, (int) $row['day_number'], $allowPending);
        if ($includeHidden || !$report['hidden']) {
            $rows[] = $report;
        }
    }
    return $rows;
}

function lulavSchoolReportRows(int $schoolId): array
{
    $rows = [];
    foreach (lulavKidsForSchool($schoolId) as $serialized) {
        $row = [
            'id' => $serialized['serial'],
            'name' => trim($serialized['firstName'] . ' ' . $serialized['lastName']),
            'grade' => $serialized['grade'],
            'rank' => $serialized['rank'],
            'perDay' => [],
            'totalShakes' => 0,
            'totalMinutes' => 0,
        ];
        $kid = lulavKidBySerial((string) $serialized['serial']);
        foreach (lulavCampaignDays() as $day) {
            $report = lulavDayReport($kid, $day, true);
            $count = $report['hidden'] ? 0 : (int) $report['count'];
            $minutes = $report['hidden'] ? 0 : (int) $report['minutes'];
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
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_api_task_map']);
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
         FROM lulav_api_task_map map
         JOIN date_tasks task ON task.grid_id = map.grid_id
         JOIN date_tasks_missions mission
           ON mission.date_tasks_mission_id = task.date_tasks_mission_id
          AND mission.start_date >= map.start_date
          AND mission.end_date <= map.end_date
         JOIN date_tasks_marks mark
           ON mark.date_task_id = task.date_task_id AND mark.mark_inactive = 0
         JOIN users u ON u.user_id = mark.user_id
         WHERE map.mivtzoim_id = :campaign
           AND map.field_name = 'day'
           AND u.school_id = :school
           AND u.user_registered > 0
         GROUP BY u.user_id
         ORDER BY total DESC, u.last, u.first
         LIMIT 100"
    );
    $stmt->execute([':campaign' => $campaign['mivtzoim_id'], ':school' => $schoolId]);
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
    $campaign = lulavCampaign();
    lulavRequireTables(['lulav_api_task_map']);
    $stmt = $MASHPIA_DB->prepare(
        "SELECT c.class_id, c.class_grade, c.class_sub,
                COUNT(DISTINCT roster.user_id) AS kid_count,
                COALESCE(SUM(mark.done_qty), 0) AS total
         FROM classes c
         LEFT JOIN users roster
           ON roster.class_id = c.class_id AND roster.user_registered > 0
         LEFT JOIN lulav_api_task_map map
           ON map.mivtzoim_id = :campaign AND map.field_name = 'day'
         LEFT JOIN date_tasks task ON task.grid_id = map.grid_id
         LEFT JOIN date_tasks_missions mission
           ON mission.date_tasks_mission_id = task.date_tasks_mission_id
          AND mission.start_date >= map.start_date
          AND mission.end_date <= map.end_date
         LEFT JOIN date_tasks_marks mark
           ON mark.date_task_id = task.date_task_id
          AND mark.user_id = roster.user_id
          AND mark.mark_inactive = 0
         WHERE c.school_id = :school AND c.class_era = 0
         GROUP BY c.class_id
         ORDER BY c.class_grade, c.class_sub"
    );
    $stmt->execute([':campaign' => $campaign['mivtzoim_id'], ':school' => $schoolId]);
    $perKidGoal = lulavPerKidGoal();
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $kidCount = (int) $row['kid_count'];
        $goal = max(1, $kidCount * $perKidGoal);
        $total = (int) $row['total'];
        $grade = $row['class_grade'] . ($row['class_sub'] ? '-' . $row['class_sub'] : '');
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
        return $b['percent'] <=> $a['percent'] ?: $b['count'] <=> $a['count'];
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
         WHERE user_serial = :serial AND dob = :dob AND user_registered > 0
         LIMIT 1'
    );
    $stmt->execute([':serial' => $serial, ':dob' => $dob]);
    if (!$stmt->fetchColumn()) {
        lulavError('Invalid serial number or date of birth.', 401);
    }
    $kid = lulavKidBySerial($serial);
    lulavRequireEligibleSchool((int) $kid['school_id']);
    $token = lulavIssueToken('kid', (int) $kid['user_id'], ['serial' => (string) $kid['user_serial']]);
    lulavJson(['token' => $token, 'expiresIn' => (int) (getenv('LULAV_TOKEN_TTL') ?: 43200), 'soldier' => lulavSerializeKid($kid)]);
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
    lulavJson(['token' => $token, 'expiresIn' => (int) (getenv('LULAV_TOKEN_TTL') ?: 43200), 'admin' => $admin]);
}

function lulavHandleAddShake(): void
{
    global $MASHPIA_DB;
    $actor = lulavRequireActor(['kid']);
    $input = lulavInput();
    $count = (int) ($input['count'] ?? 0);
    if ($count < 1 || $count > 10000) {
        lulavError('Shake count must be between 1 and 10,000.', 422);
    }
    $stmt = $MASHPIA_DB->prepare('SELECT user_serial FROM users WHERE user_id = :id');
    $stmt->execute([':id' => $actor['id']]);
    $serial = (string) $stmt->fetchColumn();
    $kid = lulavKidBySerial($serial);
    lulavRequireTables(['lulav_photos', 'lulav_api_task_map']);

    $photos = is_array($input['photos'] ?? null) ? $input['photos'] : [];
    lulavValidatePhotos($photos, 5);
    $saved = lulavWithUserLock((int) $kid['user_id'], static function () use (
        $kid,
        $count,
        $input,
        $photos,
        $MASHPIA_DB
    ): array {
        $marks = lulavMappedMarks((int) $kid['user_id']);
        $marks['peoplePersonal'] = (int) ($marks['peoplePersonal'] ?? 0) + $count;
        if ($marks['peoplePersonal'] > 65535) {
            lulavError('The cumulative shake total cannot exceed 65,535.', 422);
        }
        $campaign = lulavCampaign();
        lulavWriteMarks($kid, $marks);

        $stmt = $MASHPIA_DB->prepare(
            "UPDATE date_tasks_marks mark
             JOIN date_tasks task ON task.date_task_id = mark.date_task_id
             JOIN date_tasks_missions mission
               ON mission.date_tasks_mission_id = task.date_tasks_mission_id
             JOIN lulav_api_task_map map
               ON map.grid_id = task.grid_id
              AND mission.start_date >= map.start_date
              AND mission.end_date <= map.end_date
             SET mark.mark_description = :note
             WHERE mark.user_id = :user
               AND map.mivtzoim_id = :campaign
               AND map.field_name = 'peoplePersonal'"
        );
        $stmt->execute([
            ':note' => trim((string) ($input['note'] ?? '')),
            ':campaign' => $campaign['mivtzoim_id'],
            ':user' => $kid['user_id'],
        ]);

        foreach ($photos as $photo) {
            if (strpos($photo, 'data:image/') === 0) {
                lulavStorePhoto(
                    $photo,
                    (int) $campaign['mivtzoim_id'],
                    (int) $kid['user_id'],
                    (int) $kid['school_id'],
                    'shake',
                    (int) $kid['user_id']
                );
            }
        }
        $rows = lulavShakeRows(null, (int) $kid['user_id'], true, true);
        foreach ($rows as $row) {
            if ($row['id'] === lulavMarkPublicId((int) $kid['user_id'])) {
                return $row;
            }
        }
        throw new RuntimeException('Shake was saved but could not be reloaded.');
    });
    lulavJson($saved, 201);
}

function lulavHandlePhotoReview(string $publicId, string $decision): void
{
    global $MASHPIA_DB;
    $actor = lulavRequireActor(['admin']);
    lulavRequireTables(['lulav_photos']);
    $stmt = $MASHPIA_DB->prepare('SELECT * FROM lulav_photos WHERE public_id = :id');
    $stmt->execute([':id' => $publicId]);
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
            'INSERT INTO lulav_campaign_settings (mivtzoim_id, per_kid_goal)
             VALUES (:campaign, :goal)
             ON DUPLICATE KEY UPDATE per_kid_goal = VALUES(per_kid_goal)'
        );
        $stmt->execute([
            ':campaign' => $campaign['mivtzoim_id'],
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
                (mivtzoim_id, school_id, goal_override)
             VALUES (:campaign, :school, :goal)
             ON DUPLICATE KEY UPDATE goal_override = VALUES(goal_override)"
        );
        $stmt->execute([
            ':campaign' => $campaign['mivtzoim_id'],
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
        $motto = trim((string) ($input['motto'] ?? ''));
        $stmt = $MASHPIA_DB->prepare(
            "INSERT INTO lulav_school_settings (mivtzoim_id, school_id, motto)
             VALUES (:campaign, :school, :motto)
             ON DUPLICATE KEY UPDATE motto = VALUES(motto)"
        );
        $stmt->execute([
            ':campaign' => $campaign['mivtzoim_id'],
            ':school' => $schoolId,
            ':motto' => $motto,
        ]);
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
               ON u.class_id = c.class_id AND u.user_registered > 0
             WHERE c.school_id = :school AND c.class_era = 0
             GROUP BY c.class_id
             ORDER BY c.class_grade, c.class_sub"
        );
        $stmt->execute([':school' => $schoolId]);
        $classes = [];
        foreach ($stmt->fetchAll() as $row) {
            $name = $row['class_grade'] . ($row['class_sub'] ? '-' . $row['class_sub'] : '');
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
        lulavJson(lulavDailyRows($schoolId, null, $includeHidden, $allowPending));
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
             WHERE user_id = :user AND user_registered > 0'
        );
        $stmt->execute([':user' => $userId]);
        $user = $stmt->fetch();
        if (!$user) {
            lulavError('Shake not found.', 404);
        }
        lulavRequireSchoolAccess($actor, (int) $user['school_id']);
        lulavRequireEligibleSchool((int) $user['school_id']);
        $hidden = !empty(lulavInput()['hidden']) ? 1 : 0;
        lulavWithUserLock($userId, static function () use (
            $userId,
            $day,
            $hidden,
            $MASHPIA_DB
        ): void {
            $campaign = lulavCampaign();
            $stmt = $MASHPIA_DB->prepare(
                "UPDATE date_tasks_marks mark
                 JOIN date_tasks task ON task.date_task_id = mark.date_task_id
                 JOIN date_tasks_missions mission
                   ON mission.date_tasks_mission_id = task.date_tasks_mission_id
                 JOIN lulav_api_task_map map
                   ON map.grid_id = task.grid_id
                  AND mission.start_date >= map.start_date
                  AND mission.end_date <= map.end_date
                 SET mark.mark_inactive = :hidden
                 WHERE mark.user_id = :user
                   AND map.mivtzoim_id = :campaign
                   AND map.field_name IN ('day', 'minutes')
                   AND map.day_number = :day"
            );
            $stmt->execute([
                ':hidden' => $hidden,
                ':user' => $userId,
                ':campaign' => $campaign['mivtzoim_id'],
                ':day' => $day,
            ]);
        });
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
               AND photo.status = 'pending'
             GROUP BY photo.user_id, photo.day_number, u.user_serial
             ORDER BY MAX(photo.created_at) DESC"
        );
        $campaign = lulavCampaign();
        $stmt->execute([':school' => $schoolId, ':campaign' => $campaign['mivtzoim_id']]);
        $pending = [];
        foreach ($stmt->fetchAll() as $row) {
            $kid = lulavKidBySerial((string) $row['user_serial']);
            $pending[] = lulavDayReport($kid, (int) $row['day_number'], true);
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
            'SELECT user_serial, school_id FROM users WHERE user_id = :user AND user_registered > 0'
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
             WHERE mivtzoim_id = :campaign AND user_id = :user AND day_number = :day
               AND status = \'pending\''
        );
        $campaign = lulavCampaign();
        $update->execute([
            ':status' => $status,
            ':admin' => $actor['id'],
            ':campaign' => $campaign['mivtzoim_id'],
            ':user' => $identity['userId'],
            ':day' => $identity['day'],
        ]);
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
             WHERE mivtzoim_id = :campaign AND school_id = :school AND status = 'pending'"
        );
        $countStmt->execute([':campaign' => $campaign['mivtzoim_id'], ':school' => $schoolId]);
        $count = (int) $countStmt->fetchColumn();
        $update = $MASHPIA_DB->prepare(
            "UPDATE lulav_photos
             SET status = 'approved', reviewed_by = :admin, reviewed_at = NOW()
             WHERE mivtzoim_id = :campaign AND school_id = :school AND status = 'pending'"
        );
        $update->execute([
            ':admin' => $actor['id'],
            ':campaign' => $campaign['mivtzoim_id'],
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
             WHERE mivtzoim_id = :campaign AND status = 'approved'"
        );
        $stmt->execute([':campaign' => $campaign['mivtzoim_id']]);
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
