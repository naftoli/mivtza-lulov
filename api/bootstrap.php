<?php

declare(strict_types=1);

const LULAV_MIVTZOIM_ID = 10;
// A child whose language has no Lulav grid task for a day is marked on this
// language's task instead (Mivtzoim::markTasks' fallback). Lulav only: the
// Mashpia teacher grid does not pass it.
const LULAV_FALLBACK_LANG_ID = 1;

define('LULAV_PUBLIC_ROOT', dirname(__DIR__, 3));
define('LULAV_STORAGE_ROOT', dirname(LULAV_PUBLIC_ROOT) . '/storage/lulav');
define('LULAV_PHOTO_ROOT', LULAV_STORAGE_ROOT . '/photos');

// api/header/db.php prints "Connection failed: <PDO message>" and exit()s when
// MySQL is unreachable. That reached the client as HTTP 200 plain text, so the
// SPA saw response.ok with an unparseable body and rendered empty pages instead
// of an error — and the raw driver message leaked. Buffer the platform includes
// and turn any bail-out into a JSON 503.
$lulavBootstrapped = false;
ob_start();
register_shutdown_function(static function () use (&$lulavBootstrapped): void {
    if ($lulavBootstrapped) {
        return;
    }
    $stray = '';
    while (ob_get_level() > 0) {
        $stray .= (string) ob_get_clean();
    }
    if ($stray !== '') {
        error_log('Lulav API bootstrap output: ' . trim($stray));
    }
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_COMPILE_ERROR, E_CORE_ERROR], true)) {
        error_log('Lulav API bootstrap fatal: ' . $error['message']);
    }
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(503);
    }
    echo '{"error":"The Lulav API is temporarily unavailable. Please try again."}';
});

require_once LULAV_PUBLIC_ROOT . '/api/header/db.php';
require_once LULAV_PUBLIC_ROOT . '/api/auth/classes/Auth.php';
require_once LULAV_PUBLIC_ROOT . '/class.globalSettings.php';
require_once dirname(__DIR__, 2) . '/classes/mivtzoim.php';

// Nothing the legacy includes print belongs in a JSON body; log and drop it.
$lulavStrayOutput = (string) ob_get_clean();
if ($lulavStrayOutput !== '') {
    error_log('Lulav API stray include output: ' . trim($lulavStrayOutput));
}
$lulavBootstrapped = true;

if (!isset($MASHPIA_DB) || !$MASHPIA_DB instanceof PDO) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    exit('{"error":"The Lulav API is temporarily unavailable. Please try again."}');
}

$MASHPIA_DB->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

function lulavEnv(string $name, string $default = ''): string
{
    $value = getenv($name);
    if ($value === false || $value === '') {
        $value = $_SERVER[$name] ?? $_ENV[$name] ?? $default;
    }
    return (string) $value;
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Vary: Origin');

$requestOrigin = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
$requestHost = isset($_SERVER['HTTP_HOST']) ? (string) $_SERVER['HTTP_HOST'] : '';
$allowedOrigins = array_filter(array_map('trim', explode(',', lulavEnv('LULAV_ALLOWED_ORIGINS'))));
$originHost = $requestOrigin ? (string) parse_url($requestOrigin, PHP_URL_HOST) : '';
if ($requestOrigin && ($originHost === $requestHost || in_array($requestOrigin, $allowedOrigins, true))) {
    header('Access-Control-Allow-Origin: ' . $requestOrigin);
}

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function lulavJson($data, int $status = 200): void
{
    http_response_code($status);
    $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
    if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
        $flags |= JSON_INVALID_UTF8_SUBSTITUTE;
    }
    $json = json_encode($data, $flags);
    if ($json === false) {
        http_response_code(500);
        echo '{"error":"The request could not be completed."}';
        exit;
    }
    echo $json;
    exit;
}

function lulavError(string $message, int $status = 400, array $details = []): void
{
    lulavJson(array_merge(['error' => $message], $details), $status);
}

function lulavInput(): array
{
    static $input;
    if ($input !== null) {
        return $input;
    }

    $contentType = isset($_SERVER['CONTENT_TYPE']) ? (string) $_SERVER['CONTENT_TYPE'] : '';
    if (stripos($contentType, 'application/json') !== false) {
        $decoded = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($decoded)) {
            lulavError('The request body must contain valid JSON.');
        }
        return $input = $decoded;
    }

    return $input = $_POST;
}

function lulavBearerToken(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$header && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (preg_match('/^Bearer\s+(.+)$/i', trim((string) $header), $matches)) {
        return trim($matches[1]);
    }
    return null;
}

function lulavBase64UrlEncode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function lulavBase64UrlDecode(string $value): string
{
    $padding = strlen($value) % 4;
    if ($padding) {
        $value .= str_repeat('=', 4 - $padding);
    }
    $decoded = base64_decode(strtr($value, '-_', '+/'), true);
    return $decoded === false ? '' : $decoded;
}

function lulavSigningSecret(): string
{
    $secret = '';
    if (defined('LULAV_TOKEN_SECRET')) {
        $secret = (string) LULAV_TOKEN_SECRET;
    }
    if (strlen($secret) < 32) {
        $secret = lulavEnv('LULAV_TOKEN_SECRET');
    }
    if (strlen($secret) < 32) {
        lulavError('LULAV_TOKEN_SECRET must be configured with at least 32 characters.', 503);
    }
    return $secret;
}

function lulavIssueToken(string $type, int $id, array $extra = []): string
{
    $ttl = (int) (lulavEnv('LULAV_TOKEN_TTL') ?: 43200);
    $payload = array_merge([
        'v' => 1,
        'type' => $type,
        'id' => $id,
        'iat' => time(),
        'exp' => time() + max(300, $ttl),
    ], $extra);
    $encoded = lulavBase64UrlEncode((string) json_encode($payload));
    $signature = hash_hmac('sha256', $encoded, lulavSigningSecret(), true);
    return $encoded . '.' . lulavBase64UrlEncode($signature);
}

function lulavActor(bool $required = true): ?array
{
    $token = lulavBearerToken();
    if (!$token) {
        if ($required) {
            lulavError('Authentication required.', 401);
        }
        return null;
    }

    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        lulavError('Invalid authentication token.', 401);
    }
    [$encoded, $providedSignature] = $parts;
    $expected = lulavBase64UrlEncode(hash_hmac('sha256', $encoded, lulavSigningSecret(), true));
    if (!hash_equals($expected, $providedSignature)) {
        lulavError('Invalid authentication token.', 401);
    }

    $payload = json_decode(lulavBase64UrlDecode($encoded), true);
    if (!is_array($payload) || empty($payload['id']) || empty($payload['type']) || empty($payload['exp'])) {
        lulavError('Invalid authentication token.', 401);
    }
    if ((int) $payload['exp'] < time()) {
        lulavError('Authentication token expired.', 401);
    }
    return $payload;
}

function lulavRequireActor(array $types): array
{
    $actor = lulavActor();
    if (!in_array($actor['type'], $types, true)) {
        lulavError('You do not have permission to perform this action.', 403);
    }
    return $actor;
}

function lulavCampaign(): array
{
    global $MASHPIA_DB;
    static $campaign;
    if ($campaign) {
        return $campaign;
    }

    $stmt = $MASHPIA_DB->prepare(
        'SELECT mivtzoim_id, name, start, end
         FROM mivtzoim
         WHERE mivtzoim_id = :id
         LIMIT 1'
    );
    $stmt->execute([':id' => LULAV_MIVTZOIM_ID]);
    $campaign = $stmt->fetch();
    if (!$campaign) {
        lulavError('No Mivtza Lulav campaign is configured.', 503);
    }
    return $campaign;
}

function lulavDateFromJd($jd): ?string
{
    if (!$jd) {
        return null;
    }
    $parts = explode('/', jdtogregorian((int) $jd));
    if (count($parts) !== 3) {
        return null;
    }
    return sprintf('%04d-%02d-%02d', (int) $parts[2], (int) $parts[0], (int) $parts[1]);
}

/**
 * The school year everything in this API is scoped by: the task map, campaign
 * and school settings, photos, and child/school eligibility.
 *
 * getCurrentYear(), NOT getRegistrationYear() — deliberately, and it is the
 * only year source in this API. Most of the platform gates user_registration
 * and school_registrations on getRegistrationYear(), because those flows ask
 * "which year are we selling". This one asks "which cohort is enrolled right
 * now", and user_registration.year records the school year a child enrolled
 * for, so current_year is the right question. Do not "align" this with the
 * registration flow; the two settings can legitimately differ at a rollover
 * and following registration_year would swap the campaign's roster for next
 * year's sign-ups.
 *
 * The Australian offset is handled differently here too, on purpose:
 * getRegistrationYear() picks a single year by calendar month, while
 * lulavEligibleUserCondition() accepts either the current or previous year for
 * those schools. That superset is month-independent, which is what a one-week
 * Succos campaign wants. Both read the same school list via getAustralian().
 */
function lulavCurrentSchoolYear(): int
{
    // Memoized: this is read while building almost every SQL string (see
    // lulavEligibleUserCondition), and GlobalSettings::getHelper() queries
    // global_settings on every call.
    static $year;
    if ($year !== null) {
        return $year;
    }
    $year = (int) GlobalSettings::getCurrentYear();
    if ($year < 1) {
        lulavError('The current school year is not configured.', 503);
    }
    return $year;
}

/**
 * Builds a named-placeholder list for an integer id set, e.g.
 * [':task_0,:task_1', [':task_0' => 7, ':task_1' => 9]].
 */
function lulavIdPlaceholders(string $prefix, array $ids): array
{
    $placeholders = [];
    $params = [];
    foreach (array_values($ids) as $index => $id) {
        $key = ':' . $prefix . $index;
        $placeholders[] = $key;
        $params[$key] = (int) $id;
    }
    return [implode(',', $placeholders), $params];
}

function lulavAustralianSchoolSql(): string
{
    $ids = array_map('intval', GlobalSettings::getAustralian());
    return $ids ? implode(',', $ids) : '0';
}

function lulavEligibleUserCondition(string $userAlias): string
{
    // Keep campaign-child eligibility centralized: a future per-user Lulav
    // flag can replace this registration-year rule without rewriting queries.
    if (!preg_match('/^[a-z][a-z0-9_]*$/i', $userAlias)) {
        throw new InvalidArgumentException('Invalid user table alias.');
    }
    $year = lulavCurrentSchoolYear();
    // Children checked off for Lulav on their Settings tab
    // (users.lulav) take part without being registered.
    return "({$userAlias}.lulav = 1 OR EXISTS (
        SELECT 1
        FROM user_registration lulav_registration
        WHERE lulav_registration.user_id = {$userAlias}.user_id
          AND (
            lulav_registration.year = {$year}
            OR (
              lulav_registration.year = " . ($year - 1) . "
              AND {$userAlias}.school_id IN (" . lulavAustralianSchoolSql() . ")
            )
          )
    ))";
}

/**
 * The same eligibility rule as lulavEligibleUserCondition(), as a JOIN against
 * the list of registered children. Use it in any query that also reads
 * date_tasks_marks.
 *
 * Next to marks, MariaDB 11.4 turns the EXISTS form into a semi-join driven by
 * every user_registration row (~94,000), then reads each child's entire mark
 * history (~400 rows each, in a 102-million-row table) before keeping this
 * campaign's. Once the task map resolved, that measured 46 s for the nationwide
 * totals and 66 s for Oholei Torah's class leaderboard. A DISTINCT derived
 * table is materialized on its own, so the query starts from the campaign's
 * marks on the date_task_id index instead: 0.08 s and 0.1 s, same results.
 * DISTINCT also keeps a child registered in both years from being counted twice.
 * The UNION (which also de-duplicates) adds children flagged through the Lulav
 * Mivtza setting (users.lulav), registered or not.
 */
function lulavRegisteredUsersJoin(string $userAlias): string
{
    if (!preg_match('/^[a-z][a-z0-9_]*$/i', $userAlias)) {
        throw new InvalidArgumentException('Invalid user table alias.');
    }
    $year = lulavCurrentSchoolYear();
    return "JOIN (
        SELECT DISTINCT lulav_reg.user_id
        FROM user_registration lulav_reg
        JOIN users lulav_reg_user ON lulav_reg_user.user_id = lulav_reg.user_id
        WHERE lulav_reg.year = {$year}
           OR (
             lulav_reg.year = " . ($year - 1) . "
             AND lulav_reg_user.school_id IN (" . lulavAustralianSchoolSql() . ")
           )
        UNION
        SELECT lulav_flagged.user_id
        FROM users lulav_flagged
        WHERE lulav_flagged.lulav = 1
    ) lulav_registered ON lulav_registered.user_id = {$userAlias}.user_id";
}

function lulavSchoolIsEligible(int $schoolId): bool
{
    global $MASHPIA_DB;
    // Memoized: report and feed endpoints re-check the same school for every row.
    static $cache = [];
    if (isset($cache[$schoolId])) {
        return $cache[$schoolId];
    }
    $year = lulavCurrentSchoolYear();
    // Mirrors the filter in lulavSchoolRows(). Without the school_era /
    // test_school checks, a closed or test school was rejected from /schools but
    // still passed the gate on /schools/:id/leaderboard, /shakes and
    // /report-rows.
    // A school with a child checked off for Lulav takes part
    // even when it is not registered itself.
    $stmt = $MASHPIA_DB->prepare(
        'SELECT 1
         FROM schools s
         WHERE s.school_id = :school
           AND s.school_era IS NULL
           AND s.test_school = 0
           AND (
             EXISTS (
               SELECT 1
               FROM school_registrations registration
               WHERE registration.school_id = s.school_id
                 AND (
                   registration.year = :year
                   OR (
                     registration.year = :previous_year
                     AND registration.school_id IN (' . lulavAustralianSchoolSql() . ')
                   )
                 )
             )
             OR EXISTS (
               SELECT 1 FROM users flagged
               WHERE flagged.school_id = s.school_id AND flagged.lulav = 1
             )
           )
         LIMIT 1'
    );
    $stmt->execute([
        ':school' => $schoolId,
        ':year' => $year,
        ':previous_year' => $year - 1,
    ]);
    return $cache[$schoolId] = (bool) $stmt->fetchColumn();
}

function lulavRequireEligibleSchool(int $schoolId): void
{
    if (!lulavSchoolIsEligible($schoolId)) {
        lulavError('School is not registered for this campaign.', 404);
    }
}

function lulavAdminScope(int $adminId): array
{
    global $MASHPIA_DB;
    // Memoized: lulavRequireSchoolAccess() re-resolves the same admin on every
    // moderation row, and the scope query is three UNIONed joins.
    static $cache = [];
    if (isset($cache[$adminId])) {
        return $cache[$adminId];
    }

    $stmt = $MASHPIA_DB->prepare('SELECT auth, first, last, username FROM admins WHERE admin_id = :id');
    $stmt->execute([':id' => $adminId]);
    $admin = $stmt->fetch();
    if (!$admin) {
        lulavError('Administrator not found.', 401);
    }
    if ($admin['auth'] === 'inactive') {
        lulavError('This administrator account is inactive.', 403);
    }

    $isHq = $admin['auth'] === 'super';
    $schoolIds = [];
    if (!$isHq) {
        $stmt = $MASHPIA_DB->prepare(
            "SELECT DISTINCT school_id FROM (
                SELECT aa.id AS school_id
                FROM admin_auths aa
                WHERE aa.admin_id = :admin_school AND aa.auth = 'school'
                UNION
                SELECT c.school_id
                FROM admin_auths aa
                JOIN classes c ON c.class_id = aa.id
                WHERE aa.admin_id = :admin_class AND aa.auth = 'class'
                UNION
                SELECT s.school_id
                FROM admin_auths aa
                JOIN schools s ON s.inst_id = aa.id
                WHERE aa.admin_id = :admin_institution AND aa.auth = 'institution'
            ) scoped_schools"
        );
        $stmt->execute([
            ':admin_school' => $adminId,
            ':admin_class' => $adminId,
            ':admin_institution' => $adminId,
        ]);
        $schoolIds = array_map('intval', array_column($stmt->fetchAll(), 'school_id'));
    }

    return $cache[$adminId] = [
        'id' => $adminId,
        'name' => trim($admin['first'] . ' ' . $admin['last']),
        'username' => $admin['username'],
        'role' => $isHq ? 'hq' : 'school',
        'isHq' => $isHq,
        'schoolIds' => $schoolIds,
    ];
}

function lulavRequireSchoolAccess(array $actor, int $schoolId): array
{
    if ($actor['type'] !== 'admin') {
        lulavError('School administrator access required.', 403);
    }
    $scope = lulavAdminScope((int) $actor['id']);
    if (!$scope['isHq'] && !in_array($schoolId, $scope['schoolIds'], true)) {
        lulavError('You do not administer this school.', 403);
    }
    return $scope;
}

function lulavKidBySerial(string $serial): array
{
    global $MASHPIA_DB;
    // Memoized: feed and moderation endpoints look the same child up once per
    // Sukkos day, and this query carries two correlated rank subqueries.
    static $cache = [];
    if (isset($cache[$serial])) {
        return $cache[$serial];
    }
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
         WHERE u.user_serial = :serial
           AND " . lulavEligibleUserCondition('u') . "
         LIMIT 1"
    );
    $stmt->execute([':serial' => $serial]);
    $row = $stmt->fetch();
    if (!$row) {
        lulavError('Soldier not found.', 404);
    }
    return $cache[$serial] = $row;
}

function lulavPhotoUrl(array $user): string
{
    if (!empty($user['mobile_pic'])) {
        return '/mobile/reg/' . ltrim($user['mobile_pic'], '/');
    }
    if (!empty($user['user_photo_id'])) {
        return '/file_view.php?id=' . (int) $user['user_photo_id'];
    }
    return '/mobile/reg/images/profile-photo-default.jpg';
}

// The platoon label ("5-Boys") for a row carrying class_grade / class_sub. The
// soldier record, the class leaderboard and the classes list all go through
// here, because the page highlights a soldier's own platoon by comparing these
// strings: a stray space in one copy and not the other broke that match.
function lulavGradeLabel(array $row): string
{
    $grade = trim((string) ($row['class_grade'] ?? ''));
    $sub = trim((string) ($row['class_sub'] ?? ''));
    return empty($sub) ? $grade : $grade . '-' . $sub;
}

function lulavSerializeKid(array $row): array
{
    $grade = lulavGradeLabel($row);
    return [
        'id' => (string) $row['user_serial'],
        'serial' => (string) $row['user_serial'],
        'userId' => (int) $row['user_id'],
        'firstName' => $row['first'],
        'lastName' => $row['last'],
        'hebFirst' => $row['first_he'],
        'hebLast' => $row['last_he'],
        'dob' => $row['dob'],
        'gender' => $row['gender'],
        'grade' => $grade,
        'class' => $grade,
        'classId' => $row['class_id'] ? (string) $row['class_id'] : null,
        'rank' => $row['rank_name'] ?: '',
        'rankImageUrl' => !empty($row['rank_image_id'])
            ? '/file_view.php?id=' . (int) $row['rank_image_id']
            : null,
        'schoolId' => (string) $row['school_id'],
        'schoolName' => $row['school_name'],
        'photo' => lulavPhotoUrl($row),
        'kidKey' => lulavPublicKidId((int) $row['user_id']),
    ];
}

function lulavAssertKidAccess(array $actor, array $kid): void
{
    if ($actor['type'] === 'kid' && (int) $actor['id'] !== (int) $kid['user_id']) {
        lulavError('This token is scoped to another soldier.', 403);
    }
    if ($actor['type'] === 'admin') {
        lulavRequireSchoolAccess($actor, (int) $kid['school_id']);
    }
}

function lulavPublicKidId(int $userId): string
{
    return substr(hash_hmac('sha256', 'lulav-kid:' . $userId, lulavSigningSecret()), 0, 20);
}

function lulavSchemaError(PDOException $error): void
{
    $sqlState = (string) ($error->errorInfo[0] ?? $error->getCode());
    if ($sqlState === '42S02' || $sqlState === '42S22') {
        lulavError(
            'The Lulav API schema is missing required tables or columns. Apply api/schema.sql, and api/schema.upgrade.sql if the tables already exist.',
            503
        );
    }
    error_log('Lulav API SQL: ' . $error->getMessage());
    lulavError('The request could not be completed.', 500);
}

function lulavRequireTables(array $tables): void
{
    global $MASHPIA_DB;
    static $known = [];

    foreach ($tables as $table) {
        if (isset($known[$table])) {
            continue;
        }
        $stmt = $MASHPIA_DB->prepare(
            'SELECT COUNT(*) FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = :table'
        );
        $stmt->execute([':table' => $table]);
        if (!(int) $stmt->fetchColumn()) {
            lulavError('The Lulav API schema has not been installed. Apply api/schema.sql first.', 503);
        }
        $known[$table] = true;
    }
}

function lulavRateLimit(string $bucket, int $limit, int $windowSeconds): void
{
    if (!is_dir(LULAV_STORAGE_ROOT)
        && !mkdir(LULAV_STORAGE_ROOT, 0750, true)
        && !is_dir(LULAV_STORAGE_ROOT)) {
        lulavError('Rate limiting is unavailable.', 503);
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = LULAV_STORAGE_ROOT . '/rate-' . hash('sha256', $bucket . '|' . $ip) . '.json';
    $handle = fopen($file, 'c+');
    if (!$handle || !flock($handle, LOCK_EX)) {
        if ($handle) {
            fclose($handle);
        }
        lulavError('Rate limiting is unavailable.', 503);
    }

    $raw = stream_get_contents($handle);
    $state = $raw ? json_decode($raw, true) : null;
    $now = time();
    if (!is_array($state) || empty($state['started']) || $now - (int) $state['started'] >= $windowSeconds) {
        $state = ['started' => $now, 'count' => 0];
    }
    $state['count']++;
    if ($state['count'] > $limit) {
        flock($handle, LOCK_UN);
        fclose($handle);
        lulavError('Too many login attempts. Please try again later.', 429);
    }

    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($state));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
}

function lulavWithUserLock(int $userId, callable $callback)
{
    global $MASHPIA_DB;
    $name = 'lulav-api-user-' . $userId;
    $stmt = $MASHPIA_DB->prepare('SELECT GET_LOCK(:name, 10)');
    $stmt->execute([':name' => $name]);
    if ((int) $stmt->fetchColumn() !== 1) {
        lulavError('This soldier is already being updated. Please try again.', 409);
    }

    try {
        return $callback();
    } finally {
        $stmt = $MASHPIA_DB->prepare('SELECT RELEASE_LOCK(:name)');
        $stmt->execute([':name' => $name]);
    }
}
