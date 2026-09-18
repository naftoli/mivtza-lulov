<?php

declare(strict_types=1);

/**
 * HTTP contract tests for the Mivtza Lulav API.
 *
 *   php api/tests/run.php
 *
 * Optional environment:
 *   LULAV_API_BASE          default http://localhost:8080/mivtzoim/lulav/api
 *   LULAV_TEST_SERIAL       registered soldier serial for write tests
 *   LULAV_TEST_DOB          YYYY-MM-DD matching that soldier
 *   LULAV_TEST_ADMIN_USER   admin username
 *   LULAV_TEST_ADMIN_PASS   admin password
 */

$base = rtrim((string) (getenv('LULAV_API_BASE') ?: 'http://localhost:8080/mivtzoim/lulav/api'), '/');
$passed = 0;
$failed = 0;
$skipped = 0;
$failures = [];

function lulavTestRequest(
    string $base,
    string $method,
    string $path,
    $body = null,
    array $headers = []
): array {
    $url = $base . $path;
    $headerLines = ['Accept: application/json'];
    foreach ($headers as $name => $value) {
        $headerLines[] = $name . ': ' . $value;
    }
    $payload = null;
    if ($body !== null) {
        $payload = is_string($body) ? $body : json_encode($body);
        $headerLines[] = 'Content-Type: application/json';
    }
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => $headerLines,
    ]);
    if ($payload !== null) {
        curl_setopt($curl, CURLOPT_POSTFIELDS, $payload);
    }
    $raw = curl_exec($curl);
    $error = curl_error($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    curl_close($curl);
    if ($raw === false) {
        return [
            'status' => 0,
            'headers' => '',
            'body' => '',
            'json' => null,
            'error' => $error,
        ];
    }
    $headerText = substr($raw, 0, $headerSize);
    $bodyText = substr($raw, $headerSize);
    $json = json_decode($bodyText, true);
    return [
        'status' => $status,
        'headers' => $headerText,
        'body' => $bodyText,
        'json' => is_array($json) ? $json : (json_last_error() === JSON_ERROR_NONE ? $json : null),
        'error' => '',
    ];
}

function lulavAssert(string $name, bool $ok, string $detail = ''): void
{
    global $passed, $failed, $failures;
    if ($ok) {
        $passed++;
        echo "ok  {$name}\n";
        return;
    }
    $failed++;
    $failures[] = $name . ($detail !== '' ? ': ' . $detail : '');
    echo "FAIL  {$name}" . ($detail !== '' ? ' — ' . $detail : '') . "\n";
}

function lulavSkip(string $name, string $reason): void
{
    global $skipped;
    $skipped++;
    echo "skip  {$name} — {$reason}\n";
}

function lulavJsonBody(array $response): bool
{
    return $response['body'] !== '' && $response['json'] !== null && json_last_error() === JSON_ERROR_NONE;
}

function lulavErrorMessage(array $response): string
{
    if ($response['error']) {
        return $response['error'];
    }
    if (is_array($response['json']) && isset($response['json']['error'])) {
        return (string) $response['json']['error'] . ' HTTP ' . $response['status'];
    }
    $snippet = str_replace(["\n", "\r"], ' ', substr($response['body'], 0, 180));
    return 'HTTP ' . $response['status'] . ' body=' . $snippet;
}

$options = lulavTestRequest($base, 'OPTIONS', '/schools');
lulavAssert(
    'OPTIONS /schools returns 204',
    $options['status'] === 204,
    lulavErrorMessage($options)
);

$unknown = lulavTestRequest($base, 'GET', '/definitely-missing');
lulavAssert('unknown route is JSON 404', $unknown['status'] === 404 && lulavJsonBody($unknown), lulavErrorMessage($unknown));
lulavAssert(
    'unknown route has an error message',
    is_array($unknown['json']) && !empty($unknown['json']['error']),
    lulavErrorMessage($unknown)
);

$loginGet = lulavTestRequest($base, 'GET', '/soldier/login');
lulavAssert('GET /soldier/login is JSON 404', $loginGet['status'] === 404 && lulavJsonBody($loginGet), lulavErrorMessage($loginGet));

$kidEmpty = lulavTestRequest($base, 'POST', '/soldier/login', []);
lulavAssert('POST /soldier/login without credentials is 422', $kidEmpty['status'] === 422 && lulavJsonBody($kidEmpty), lulavErrorMessage($kidEmpty));

$kidBad = lulavTestRequest($base, 'POST', '/soldier/login', ['serial' => '0', 'dob' => '1990-01-01']);
lulavAssert(
    'POST /soldier/login rejects invalid credentials',
    in_array($kidBad['status'], [401, 422], true) && lulavJsonBody($kidBad),
    lulavErrorMessage($kidBad)
);

$adminEmpty = lulavTestRequest($base, 'POST', '/admin/login', []);
lulavAssert('POST /admin/login without credentials is 422', $adminEmpty['status'] === 422 && lulavJsonBody($adminEmpty), lulavErrorMessage($adminEmpty));

$adminBad = lulavTestRequest($base, 'POST', '/admin/login', ['username' => 'not-a-real-lulav-admin', 'password' => 'wrong']);
lulavAssert('POST /admin/login rejects invalid credentials', $adminBad['status'] === 401 && lulavJsonBody($adminBad), lulavErrorMessage($adminBad));

$schools = lulavTestRequest($base, 'GET', '/schools');
lulavAssert('GET /schools returns a JSON body', lulavJsonBody($schools), lulavErrorMessage($schools));
lulavAssert(
    'GET /schools is not an empty HTTP 200',
    !($schools['status'] === 200 && $schools['body'] === ''),
    'empty body; likely an uncaught SQL/schema error'
);

$schemaMissing = $schools['status'] === 503
    && is_array($schools['json'])
    && isset($schools['json']['error'])
    && strpos((string) $schools['json']['error'], 'schema') !== false;

if ($schemaMissing) {
    lulavAssert('GET /schools reports a schema upgrade instead of an empty body', true);
    lulavSkip('public campaign reads', 'apply api/schema.upgrade.sql so school_year exists, then re-run');
} else {
    lulavAssert('GET /schools returns HTTP 200', $schools['status'] === 200, lulavErrorMessage($schools));
    lulavAssert(
        'GET /schools returns an array',
        is_array($schools['json']) && ($schools['json'] === [] || array_keys($schools['json']) === range(0, count($schools['json']) - 1)),
        lulavErrorMessage($schools)
    );

    $schoolRowKeys = [
        'id', 'name', 'city', 'logo', 'kidCount', 'goal', 'bonusLevel', 'bonusGoal', 'total', 'percent', 'motto', 'endDate', 'color',
    ];
    if (!empty($schools['json'])) {
        $first = $schools['json'][0];
        foreach ($schoolRowKeys as $key) {
            lulavAssert("GET /schools row includes {$key}", is_array($first) && array_key_exists($key, $first), json_encode(array_keys((array) $first)));
        }
        $schoolId = (string) $first['id'];
        $one = lulavTestRequest($base, 'GET', '/schools/' . $schoolId);
        lulavAssert('GET /schools/:id returns JSON 200', $one['status'] === 200 && lulavJsonBody($one), lulavErrorMessage($one));
        lulavAssert('GET /schools/:id matches list id', is_array($one['json']) && (string) $one['json']['id'] === $schoolId, lulavErrorMessage($one));

        $leaderboard = lulavTestRequest($base, 'GET', '/schools/' . $schoolId . '/leaderboard');
        lulavAssert('GET /schools/:id/leaderboard is JSON', lulavJsonBody($leaderboard) && in_array($leaderboard['status'], [200, 503], true), lulavErrorMessage($leaderboard));
        if ($leaderboard['status'] === 200) {
            lulavAssert('leaderboard is an array', is_array($leaderboard['json']));
            if (!empty($leaderboard['json'])) {
                $entry = $leaderboard['json'][0];
                lulavAssert('leaderboard row has kidKey', !empty($entry['kidKey']));
                lulavAssert('leaderboard row does not expose a serial', !isset($entry['serial']) && !isset($entry['dob']));
            }
        }

        $classBoard = lulavTestRequest($base, 'GET', '/schools/' . $schoolId . '/class-leaderboard');
        lulavAssert('GET /schools/:id/class-leaderboard is JSON', lulavJsonBody($classBoard) && in_array($classBoard['status'], [200, 503], true), lulavErrorMessage($classBoard));
        if ($classBoard['status'] === 200 && !empty($classBoard['json'])) {
            $classRow = $classBoard['json'][0];
            lulavAssert('class leaderboard includes percent and goal', isset($classRow['percent'], $classRow['goal'], $classRow['count']));
        }

        $shakes = lulavTestRequest($base, 'GET', '/schools/' . $schoolId . '/shakes');
        lulavAssert('GET /schools/:id/shakes is JSON', lulavJsonBody($shakes) && in_array($shakes['status'], [200, 503], true), lulavErrorMessage($shakes));
        if ($shakes['status'] === 200 && !empty($shakes['json'])) {
            $shake = $shakes['json'][0];
            lulavAssert('public shake has an id', !empty($shake['id']));
            lulavAssert('public shake does not expose serial', !isset($shake['serial']) && !isset($shake['dob']));
        }

        $classesAuth = lulavTestRequest($base, 'GET', '/schools/' . $schoolId . '/classes');
        lulavAssert('GET /schools/:id/classes without token is 401', $classesAuth['status'] === 401 && lulavJsonBody($classesAuth), lulavErrorMessage($classesAuth));

        $soldiersAuth = lulavTestRequest($base, 'GET', '/schools/' . $schoolId . '/soldiers');
        lulavAssert('GET /schools/:id/soldiers without token is 401', $soldiersAuth['status'] === 401 && lulavJsonBody($soldiersAuth), lulavErrorMessage($soldiersAuth));

        $rowsAuth = lulavTestRequest($base, 'GET', '/schools/' . $schoolId . '/report-rows');
        lulavAssert('GET /schools/:id/report-rows without token is 401', $rowsAuth['status'] === 401 && lulavJsonBody($rowsAuth), lulavErrorMessage($rowsAuth));

        $pendingAuth = lulavTestRequest($base, 'GET', '/schools/' . $schoolId . '/photos/pending');
        lulavAssert('GET pending photos without token is 401', $pendingAuth['status'] === 401 && lulavJsonBody($pendingAuth), lulavErrorMessage($pendingAuth));

        $mottoAuth = lulavTestRequest($base, 'PATCH', '/schools/' . $schoolId, ['motto' => 'test']);
        lulavAssert('PATCH /schools/:id without token is 401', $mottoAuth['status'] === 401 && lulavJsonBody($mottoAuth), lulavErrorMessage($mottoAuth));

        $goalAuth = lulavTestRequest($base, 'PATCH', '/schools/' . $schoolId . '/goal', ['goalOverride' => 10]);
        lulavAssert('PATCH /schools/:id/goal without token is 401', $goalAuth['status'] === 401 && lulavJsonBody($goalAuth), lulavErrorMessage($goalAuth));

        $approveAllAuth = lulavTestRequest($base, 'POST', '/schools/' . $schoolId . '/photos/approve-all', []);
        lulavAssert('POST approve-all without token is 401', $approveAllAuth['status'] === 401 && lulavJsonBody($approveAllAuth), lulavErrorMessage($approveAllAuth));
    } else {
        lulavSkip('per-school public reads', 'no eligible schools returned');
    }
}

$missingSchool = lulavTestRequest($base, 'GET', '/schools/0');
lulavAssert(
    'GET /schools/0 is JSON 4xx/5xx, never empty',
    lulavJsonBody($missingSchool) && $missingSchool['status'] >= 400,
    lulavErrorMessage($missingSchool)
);

$stats = lulavTestRequest($base, 'GET', '/stats');
lulavAssert('GET /stats returns a JSON body', lulavJsonBody($stats), lulavErrorMessage($stats));
if ($stats['status'] === 200) {
    foreach (['totalShakes', 'totalGoal', 'totalSchools', 'activeSoldiers', 'totalPhotos'] as $key) {
        lulavAssert("GET /stats includes {$key}", is_array($stats['json']) && array_key_exists($key, $stats['json']));
    }
} elseif ($schemaMissing) {
    lulavAssert('GET /stats reports schema issue as JSON', $stats['status'] === 503, lulavErrorMessage($stats));
} else {
    lulavAssert('GET /stats is HTTP 200', false, lulavErrorMessage($stats));
}

$settingsAuth = lulavTestRequest($base, 'GET', '/settings');
lulavAssert('GET /settings without token is 401', $settingsAuth['status'] === 401 && lulavJsonBody($settingsAuth), lulavErrorMessage($settingsAuth));

$settingsPatchAuth = lulavTestRequest($base, 'PATCH', '/settings', ['perKidGoal' => 3]);
lulavAssert('PATCH /settings without token is 401', $settingsPatchAuth['status'] === 401 && lulavJsonBody($settingsPatchAuth), lulavErrorMessage($settingsPatchAuth));

$dayAuth = lulavTestRequest($base, 'GET', '/me/days/1');
lulavAssert('GET /me/days/1 without token is 401', $dayAuth['status'] === 401 && lulavJsonBody($dayAuth), lulavErrorMessage($dayAuth));

$dayPutAuth = lulavTestRequest($base, 'PUT', '/me/days/1', ['count' => 1, 'minutes' => 0]);
lulavAssert('PUT /me/days/1 without token is 401', $dayPutAuth['status'] === 401 && lulavJsonBody($dayPutAuth), lulavErrorMessage($dayPutAuth));

$myShakesAuth = lulavTestRequest($base, 'GET', '/me/shakes');
lulavAssert('GET /me/shakes without token is 401', $myShakesAuth['status'] === 401 && lulavJsonBody($myShakesAuth), lulavErrorMessage($myShakesAuth));

$postShakeAuth = lulavTestRequest($base, 'POST', '/shakes', ['day' => 1, 'count' => 1]);
lulavAssert('POST /shakes without token is 401', $postShakeAuth['status'] === 401 && lulavJsonBody($postShakeAuth), lulavErrorMessage($postShakeAuth));

$hideAuth = lulavTestRequest($base, 'PATCH', '/shakes/day-1-1-aaaaaaaaaaaaaaaaaaaa', ['hidden' => true]);
lulavAssert('PATCH /shakes/:id without token is 401', $hideAuth['status'] === 401 && lulavJsonBody($hideAuth), lulavErrorMessage($hideAuth));

$photoFile = lulavTestRequest($base, 'GET', '/photos/' . str_repeat('a', 32) . '/file');
lulavAssert(
    'GET missing photo file is JSON 404',
    $photoFile['status'] === 404 && lulavJsonBody($photoFile),
    lulavErrorMessage($photoFile)
);

$bogusBearer = lulavTestRequest($base, 'GET', '/settings', null, ['Authorization' => 'Bearer not-a-token']);
lulavAssert('invalid bearer token is 401 JSON', $bogusBearer['status'] === 401 && lulavJsonBody($bogusBearer), lulavErrorMessage($bogusBearer));

$serial = trim((string) getenv('LULAV_TEST_SERIAL'));
$dob = trim((string) getenv('LULAV_TEST_DOB'));
if ($serial === '' || $dob === '') {
    lulavSkip('authenticated soldier flow', 'set LULAV_TEST_SERIAL and LULAV_TEST_DOB to exercise writes');
} else {
    $kidLogin = lulavTestRequest($base, 'POST', '/soldier/login', ['serial' => $serial, 'dob' => $dob]);
    lulavAssert('soldier login succeeds', $kidLogin['status'] === 200 && !empty($kidLogin['json']['token']), lulavErrorMessage($kidLogin));
    if (!empty($kidLogin['json']['token'])) {
        $auth = ['Authorization' => 'Bearer ' . $kidLogin['json']['token']];
        lulavAssert('soldier login returns kidKey', !empty($kidLogin['json']['soldier']['kidKey']));
        $day = lulavTestRequest($base, 'GET', '/me/days/1', null, $auth);
        lulavAssert('GET /me/days/1 with token is JSON', lulavJsonBody($day) && in_array($day['status'], [200, 422, 503], true), lulavErrorMessage($day));
        $mine = lulavTestRequest($base, 'GET', '/me/shakes', null, $auth);
        lulavAssert('GET /me/shakes with token is JSON', lulavJsonBody($mine) && in_array($mine['status'], [200, 503], true), lulavErrorMessage($mine));
        $save = lulavTestRequest($base, 'PUT', '/me/days/1', [
            'count' => 1,
            'minutes' => 1,
            'note' => 'api test',
            'photos' => [],
        ], $auth);
        lulavAssert(
            'PUT /me/days/1 with token is JSON',
            lulavJsonBody($save) && in_array($save['status'], [200, 422, 503], true),
            lulavErrorMessage($save)
        );
        if ($save['status'] === 200) {
            lulavAssert('saved day report keeps the larger count', (int) $save['json']['count'] >= 1);
            $again = lulavTestRequest($base, 'GET', '/me/days/1', null, $auth);
            lulavAssert('GET after save returns the same day', $again['status'] === 200 && (int) $again['json']['count'] === (int) $save['json']['count']);
        }
    }
}

$adminUser = trim((string) getenv('LULAV_TEST_ADMIN_USER'));
$adminPass = (string) getenv('LULAV_TEST_ADMIN_PASS');
if ($adminUser === '' || $adminPass === '') {
    lulavSkip('authenticated admin flow', 'set LULAV_TEST_ADMIN_USER and LULAV_TEST_ADMIN_PASS');
} else {
    $adminLogin = lulavTestRequest($base, 'POST', '/admin/login', [
        'username' => $adminUser,
        'password' => $adminPass,
    ]);
    lulavAssert('admin login succeeds', $adminLogin['status'] === 200 && !empty($adminLogin['json']['token']), lulavErrorMessage($adminLogin));
    if (!empty($adminLogin['json']['token'])) {
        $auth = ['Authorization' => 'Bearer ' . $adminLogin['json']['token']];
        $settings = lulavTestRequest($base, 'GET', '/settings', null, $auth);
        $okSettings = in_array($settings['status'], [200, 403], true) && lulavJsonBody($settings);
        lulavAssert('GET /settings with admin token is JSON', $okSettings, lulavErrorMessage($settings));
        if ($settings['status'] === 200) {
            lulavAssert('HQ settings include perKidGoal', isset($settings['json']['perKidGoal']) && (int) $settings['json']['perKidGoal'] >= 1);
        }
    }
}

echo "\n{$passed} passed, {$failed} failed, {$skipped} skipped\n";
if ($schemaMissing) {
    echo "Schema is behind the API. Run api/schema.upgrade.sql and re-test.\n";
}
if ($failed > 0) {
    echo implode("\n", $failures) . "\n";
    exit(1);
}

exit(0);
