<?php

declare(strict_types=1);

const LULAV_MIVTZOIM_ID = 10;

define('LULAV_PUBLIC_ROOT', dirname(__DIR__, 3));
define('LULAV_STORAGE_ROOT', dirname(LULAV_PUBLIC_ROOT) . '/storage/lulav');
define('LULAV_PHOTO_ROOT', LULAV_STORAGE_ROOT . '/photos');

require_once LULAV_PUBLIC_ROOT . '/api/header/db.php';
require_once LULAV_PUBLIC_ROOT . '/api/auth/classes/Auth.php';
require_once LULAV_PUBLIC_ROOT . '/class.globalSettings.php';
require_once dirname(__DIR__, 2) . '/classes/mivtzoim.php';

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

function lulavEligibleUserCondition(string $userAlias): string
{
    // Keep campaign-child eligibility centralized: a future per-user Lulav
    // flag can replace this registration-year rule without rewriting queries.
    if (!preg_match('/^[a-z][a-z0-9_]*$/i', $userAlias)) {
        throw new InvalidArgumentException('Invalid user table alias.');
    }
    $year = lulavCurrentSchoolYear();
    return "EXISTS (
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
    )";
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

function lulavAdminScope(int $adminId): array
{
    global $MASHPIA_DB;

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

    return [
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
    return $row;
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

function lulavSerializeKid(array $row): array
{
    $grade = trim((string) ($row['class_grade'] ?? ''));
    if (!empty($row['class_sub'])) {
        $grade .= '-' . $row['class_sub'];
    }
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
        'photoUrl' => lulavPhotoUrl($row),
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

function lulavMarkPublicId(int $userId): string
{
    $signature = substr(hash_hmac('sha256', 'lulav-mark:' . $userId, lulavSigningSecret()), 0, 20);
    return 'mark-' . $userId . '-' . $signature;
}

function lulavUserIdFromMarkId(string $markId): ?int
{
    if (!preg_match('/^mark-(\d+)-([a-f0-9]{20})$/', $markId, $match)) {
        return null;
    }
    $userId = (int) $match[1];
    return hash_equals(lulavMarkPublicId($userId), $markId) ? $userId : null;
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
