<?php

declare(strict_types=1);

const LULAV_MIVTZOIM_ID = 10;
// A child whose language has no Lulav grid task for a day is marked on this
// language's task instead (Mivtzoim::markTasks' fallback). Lulav only: the
// Mashpia teacher grid does not pass it.
const LULAV_FALLBACK_LANG_ID = 1;

// How long a parent's handoff code stays valid, in seconds. Long enough for
// the SPA to load in the app's webview, short enough that a code left in a
// browser history is dead by the time anyone reads it.
const LULAV_HANDOFF_TTL = 120;

define('LULAV_PUBLIC_ROOT', dirname(__DIR__, 3));
define('LULAV_STORAGE_ROOT', dirname(LULAV_PUBLIC_ROOT) . '/storage/lulav');
define('LULAV_PHOTO_ROOT', LULAV_STORAGE_ROOT . '/photos');
// The photo types the API accepts, and the extension each is stored under.
const LULAV_PHOTO_EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

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
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
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

function lulavSignPayload(array $payload): string
{
    $encoded = lulavBase64UrlEncode((string) json_encode($payload));
    $signature = hash_hmac('sha256', $encoded, lulavSigningSecret(), true);
    return $encoded . '.' . lulavBase64UrlEncode($signature);
}

/**
 * Verifies an HMAC token issued by lulavSignPayload() and returns its payload,
 * or null when the token is malformed, tampered with or expired.
 */
function lulavVerifySignedPayload(string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        return null;
    }
    [$encoded, $providedSignature] = $parts;
    $expected = lulavBase64UrlEncode(hash_hmac('sha256', $encoded, lulavSigningSecret(), true));
    if (!hash_equals($expected, $providedSignature)) {
        return null;
    }
    $payload = json_decode(lulavBase64UrlDecode($encoded), true);
    if (!is_array($payload) || empty($payload['id']) || empty($payload['type']) || empty($payload['exp'])) {
        return null;
    }
    if ((int) $payload['exp'] < time()) {
        return null;
    }
    return $payload;
}

function lulavIssueToken(string $type, int $id, array $extra = []): string
{
    $ttl = (int) (lulavEnv('LULAV_TOKEN_TTL') ?: 43200);
    return lulavSignPayload(array_merge([
        'v' => 1,
        'type' => $type,
        'id' => $id,
        'iat' => time(),
        'exp' => time() + max(300, $ttl),
    ], $extra));
}

/**
 * A single-child, single-use-window code the parent site hands to the SPA in a
 * URL (see /parent/handoff). It only names a child: it carries no parent
 * session and cannot call anything, so the two-minute window it is valid for
 * is the whole of its power. The SPA trades it for a real kid token.
 */
function lulavIssueHandoffCode(int $userId): string
{
    return lulavSignPayload([
        'v' => 1,
        'type' => 'handoff',
        'id' => $userId,
        'iat' => time(),
        'exp' => time() + LULAV_HANDOFF_TTL,
    ]);
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

    $payload = lulavVerifySignedPayload($token);
    if (!$payload) {
        lulavError('Invalid authentication token.', 401);
    }
    // Only kid and admin tokens are sessions. Handoff codes and photo-download
    // links are signed with the same secret, but each buys one thing at one
    // endpoint and must never pass as a login.
    if (!in_array($payload['type'], ['kid', 'admin'], true)) {
        lulavError('Invalid authentication token.', 401);
    }
    return $payload;
}

/** A school's ['lat', 'lng'] from school-locations.php, or null. */
function lulavSchoolLocation(int $schoolId): ?array
{
    static $locations;
    if ($locations === null) {
        $locations = require __DIR__ . '/school-locations.php';
    }
    return $locations[$schoolId] ?? null;
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
 * The :campaign and :school_year parameters nearly every Lulav query filters
 * on: this campaign's row, and this school year -- the same mivtzoim_id is
 * reused every year. Merge in the query's own: lulavCampaignParams() + [...].
 */
function lulavCampaignParams(): array
{
    return [
        ':campaign' => lulavCampaign()['mivtzoim_id'],
        ':school_year' => lulavCurrentSchoolYear(),
    ];
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
 * The rank columns every child row carries -- the name of the child's highest
 * rank mark, and its ord, which the insignia is drawn from -- as select-list SQL
 * for the users table aliased $userAlias. One copy, where there were four.
 */
function lulavRankColumns(string $userAlias): string
{
    if (!preg_match('/^[a-z][a-z0-9_]*$/i', $userAlias)) {
        throw new InvalidArgumentException('Invalid user table alias.');
    }
    return "(SELECT r.rank_name
                   FROM rank_marks rm JOIN ranks r USING (rank_ord)
                  WHERE rm.user_id = {$userAlias}.user_id
                  ORDER BY rm.rank_ord DESC LIMIT 1) AS rank_name,
                (SELECT rm.rank_ord
                   FROM rank_marks rm
                  WHERE rm.user_id = {$userAlias}.user_id
                  ORDER BY rm.rank_ord DESC LIMIT 1) AS rank_ord";
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

/**
 * The parent behind a mobile session token (the `admin` cookie the parent site
 * posts to mobile/reg/ajax/*.php), or a 401.
 *
 * Deliberately not lulavAdminScope(): that answers "which schools may this
 * staff account moderate", and a parent is an ordinary admins row with no
 * school scope at all. A parent token buys exactly one thing here — a handoff
 * code for a child of their own.
 */
function lulavParentAdminId(string $mobileToken): int
{
    $adminId = \mashpia\api\auth\Auth::authenticate(['key' => $mobileToken], 'mobile');
    if (!$adminId || !ctype_digit((string) $adminId)) {
        lulavError('Please sign in again on the parent site.', 401);
    }
    return (int) $adminId;
}

/**
 * The serials of that parent's children who take part in this campaign, keyed
 * by user_id. admin_auths is the family link the parent site itself reads (see
 * mobile/reg/ajax/getChildren.php): role_id 1 + auth 'user' rows whose id is
 * the child's user_id.
 *
 * Pass $userId to ask about one child — an empty result then means "not this
 * parent's child, or not in the campaign", which is the ownership check.
 */
function lulavParentChildSerials(int $adminId, ?int $userId = null): array
{
    global $MASHPIA_DB;
    $sql = "SELECT u.user_id, u.user_serial
              FROM admin_auths aa
              JOIN users u ON u.user_id = aa.id
             WHERE aa.admin_id = :admin
               AND aa.role_id = 1
               AND aa.auth = 'user'
               AND " . lulavEligibleUserCondition('u');
    $params = [':admin' => $adminId];
    if ($userId !== null) {
        $sql .= ' AND u.user_id = :user';
        $params[':user'] = $userId;
    }
    $stmt = $MASHPIA_DB->prepare($sql . ' ORDER BY u.user_id');
    $stmt->execute($params);

    $serials = [];
    foreach ($stmt->fetchAll() as $row) {
        $serials[(int) $row['user_id']] = (string) $row['user_serial'];
    }
    return $serials;
}

function lulavKidBySerial(string $serial, bool $required = true): ?array
{
    return lulavKidRow('user_serial', $serial, $required);
}

/**
 * The same campaign-eligible soldier row, by user_id — what a handoff code
 * names, since the parent site knows its children by user_id and never sees
 * the serial.
 */
function lulavKidByUserId(int $userId, bool $required = true): ?array
{
    return lulavKidRow('user_id', (string) $userId, $required);
}

/**
 * @param string $column user_serial or user_id — never request input.
 */
function lulavKidRow(string $column, string $value, bool $required): ?array
{
    global $MASHPIA_DB;
    if (!in_array($column, ['user_serial', 'user_id'], true)) {
        throw new InvalidArgumentException('Invalid soldier lookup column.');
    }
    // Memoized: feed and moderation endpoints look the same child up once per
    // Sukkos day, and this query carries two correlated rank subqueries.
    static $cache = [];
    $key = $column . '|' . $value;
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    $stmt = $MASHPIA_DB->prepare(
        "SELECT u.user_id, u.user_serial, u.first, u.last, u.first_he, u.last_he,
                u.dob, u.gender, u.school_id, u.class_id, u.mobile_pic, u.user_photo_id,
                c.class_grade, c.class_sub, s.school_name,
                " . lulavRankColumns('u') . "
         FROM users u
         JOIN schools s ON s.school_id = u.school_id
         LEFT JOIN classes c ON c.class_id = u.class_id
         WHERE u.{$column} = :value
           AND " . lulavEligibleUserCondition('u') . "
         LIMIT 1"
    );
    $stmt->execute([':value' => $value]);
    $row = $stmt->fetch();
    if (!$row) {
        if ($required) {
            lulavError('Soldier not found.', 404);
        }
        return null;
    }
    return $cache[$key] = $row;
}

/**
 * The rank insignia for a row carrying rank_ord: the same SVG the parent site
 * draws beside each child (mobile/img_new/ranks/<ord>.svg), rather than
 * ranks.rank_image_id through file_view.php. One artwork set, one look, and a
 * flat file instead of a database-backed image request per row.
 */
function lulavRankImageUrl(array $row): ?string
{
    $ord = (int) ($row['rank_ord'] ?? 0);
    if ($ord < 1) {
        return null;
    }
    return '/mobile/img_new/ranks/' . $ord . '.svg';
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
        'rankImageUrl' => lulavRankImageUrl($row),
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

/**
 * A short-lived cache for the public, whole-country reads.
 *
 * /stats and /schools recompute every school's shakes and minutes from
 * date_tasks_marks -- around 100,000 rows at campaign volume, on a table of
 * 103 million -- and they are the pages everyone opens at once. Nothing there
 * is per-viewer, and nobody needs the totals to the second, so a few seconds of
 * staleness buys back the whole query.
 *
 * Writes call lulavCacheFlush(), so a save or a moderation shows up at once
 * rather than after the TTL. Anything actor-specific (a child's own report, an
 * admin's pending queue) is never cached.
 */
const LULAV_CACHE_TTL = 30;

function lulavCacheRoot(): string
{
    return LULAV_STORAGE_ROOT . '/cache';
}

function lulavCacheFile(string $key): string
{
    // The campaign and school year are part of the key, so a rollover cannot
    // serve last year's numbers.
    $scope = LULAV_MIVTZOIM_ID . '|' . lulavCurrentSchoolYear() . '|' . $key;
    return lulavCacheRoot() . '/c-' . hash('sha256', $scope) . '.json';
}

/** The cached value for $key, or null when it is missing, stale or unreadable. */
function lulavCacheGet(string $key, int $ttl = LULAV_CACHE_TTL)
{
    $file = lulavCacheFile($key);
    $age = @filemtime($file);
    if ($age === false || time() - $age >= $ttl) {
        return null;
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $value = json_decode($raw, true);
    return json_last_error() === JSON_ERROR_NONE ? $value : null;
}

function lulavCacheSet(string $key, $value): void
{
    $root = lulavCacheRoot();
    if (!is_dir($root) && !mkdir($root, 0750, true) && !is_dir($root)) {
        return;
    }
    $encoded = json_encode($value);
    if ($encoded === false) {
        return;
    }
    // Written to a temp file and renamed, so a reader never sees a half-written
    // body. A cache that cannot be written is not an error: the request has its
    // answer either way.
    $file = lulavCacheFile($key);
    $temp = $file . '.' . getmypid() . '.tmp';
    if (@file_put_contents($temp, $encoded, LOCK_EX) === false) {
        return;
    }
    if (!@rename($temp, $file)) {
        @unlink($temp);
    }
}

/** Build $key once and reuse it for LULAV_CACHE_TTL seconds. */
function lulavCached(string $key, callable $build, int $ttl = LULAV_CACHE_TTL)
{
    $cached = lulavCacheGet($key, $ttl);
    if ($cached !== null) {
        return $cached;
    }
    $value = $build();
    lulavCacheSet($key, $value);
    return $value;
}

/** Drop every cached read. Called after anything that changes the totals. */
function lulavCacheFlush(): void
{
    foreach ((array) @glob(lulavCacheRoot() . '/c-*.json') as $file) {
        @unlink($file);
    }
}

// The footer every Lulav email carries: Mashpia's standard email footer
// (addFooterToMessage() in emails/sendEmail.php) -- HQ's address, the privacy
// policy and an unsubscribe link. Its two links are pointed at the pages that
// work: that footer's unsubscribe.html is a 404, and its privacy.html holds
// only the words "Privacy Policy"; privacy_policy.php is the real policy.
const LULAV_MAIL_ADDRESS = '792 Eastern Pkwy, Brooklyn, NY 11213';
const LULAV_MAIL_PRIVACY = 'https://mashpia.com/privacy_policy.php';
const LULAV_MAIL_UNSUBSCRIBE = 'https://mashpia.com/unsubscribe.php';

/**
 * Sends one plain-text email through PHP's mail(), the way the rest of Mashpia
 * does (classes/email.php turns on SMTP debug output, which would land in the
 * JSON body). Anyone in both $to and $cc is kept in $to only.
 *
 * With LULAV_MAIL_CAPTURE set to a file path, the message is appended there as
 * a JSON line instead of being sent -- for local development and the tests, so
 * neither mails real people.
 *
 * Returns whether the message was handed off; never throws, because no save
 * should fail over an email.
 */
function lulavSendMail(array $to, string $subject, string $body, array $cc = []): bool
{
    $clean = static function (array $addresses): array {
        return array_values(array_unique(array_filter(array_map(static function ($address): string {
            $address = strtolower(trim((string) $address));
            return filter_var($address, FILTER_VALIDATE_EMAIL) ? $address : '';
        }, $addresses))));
    };
    $to = $clean($to);
    $cc = array_values(array_diff($clean($cc), $to));
    if (!$to && !$cc) {
        return false;
    }
    // mail() needs a To; with none, the first Cc moves up to fill it.
    if (!$to) {
        $to = [array_shift($cc)];
    }
    // Header injection: nothing user-supplied may carry a line break.
    $subject = trim(preg_replace('/[\r\n]+/', ' ', $subject));
    // Mail with no postal address, privacy policy or unsubscribe link reads as
    // bulk mail to spam filters.
    $body = rtrim($body) . "\n\n--\n"
        . '(c) ' . date('Y') . " Tzivos Hashem\n"
        . LULAV_MAIL_ADDRESS . "\n"
        . 'Privacy Policy: ' . LULAV_MAIL_PRIVACY . "\n"
        . 'To unsubscribe from these emails, visit ' . LULAV_MAIL_UNSUBSCRIBE . "\n";

    $capture = lulavEnv('LULAV_MAIL_CAPTURE');
    if ($capture !== '') {
        $line = json_encode(['to' => $to, 'cc' => $cc, 'subject' => $subject, 'body' => $body], JSON_UNESCAPED_UNICODE);
        return @file_put_contents($capture, $line . "\n", FILE_APPEND | LOCK_EX) !== false;
    }

    $headers = [
        'From: Mivtza Lulav <cth@mashpia.com>',
        'Reply-To: cth@mashpia.com',
        // The header Gmail and Yahoo look for, beyond the footer. Not the
        // one-click (List-Unsubscribe-Post) form: that promises an automatic
        // unsubscribe, and unsubscribe.php records nothing.
        'List-Unsubscribe: <' . LULAV_MAIL_UNSUBSCRIBE . '>, <mailto:cth@mashpia.com?subject=unsubscribe>',
    ];
    if ($cc) {
        $headers[] = 'Cc: ' . implode(', ', $cc);
    }
    $headers = implode("\r\n", array_merge($headers, [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ]));
    $encodedSubject = function_exists('mb_encode_mimeheader')
        ? mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n")
        : $subject;
    $sent = @mail(implode(', ', $to), $encodedSubject, $body, $headers);
    if (!$sent) {
        error_log('Lulav API: mail() refused "' . $subject . '" to ' . implode(', ', array_merge($to, $cc)));
    }
    return $sent;
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
