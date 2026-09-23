<?php
/**
 * Drives every Lulav API route against the fake database.
 *
 * Each case runs in its own process (request.php). Assertions cover the status,
 * the response shape, the arithmetic the new queries feed, and that no route
 * issued a query the fixture did not recognise -- an unmatched query is how a
 * broken rewrite shows up here.
 */

require __DIR__ . '/sandbox.php';
$sandbox = lulav_mock_sandbox();
register_shutdown_function(static function () use ($sandbox) { lulav_mock_rmtree($sandbox); });

$pass = 0;
$fail = 0;
$failures = [];

function req(string $method, string $path, array $body = null, string $actor = ''): array
{
    global $sandbox;
    $cmd = sprintf(
        'php %s %s %s %s %s %s 2>&1',
        escapeshellarg(__DIR__ . '/request.php'),
        escapeshellarg($method),
        escapeshellarg($path),
        escapeshellarg($body === null ? '' : json_encode($body)),
        escapeshellarg($actor),
        escapeshellarg($sandbox)
    );
    $raw = shell_exec($cmd);
    // The harness prints one JSON object last; anything before it is PHP noise.
    $start = strrpos($raw, '{"status"');
    $result = $start === false ? null : json_decode(substr($raw, $start), true);
    if (!is_array($result)) {
        return ['status' => 0, 'json' => null, 'body' => trim((string) $raw), 'unmatched' => [], 'noise' => trim((string) $raw)];
    }
    $result['json'] = json_decode((string) $result['body'], true);
    $result['noise'] = $start > 0 ? trim(substr($raw, 0, $start)) : '';
    return $result;
}

function check(string $name, bool $ok, string $detail = ''): void
{
    global $pass, $fail, $failures;
    if ($ok) {
        $pass++;
        return;
    }
    $fail++;
    $failures[] = $name . ($detail !== '' ? ' -- ' . $detail : '');
}

/** Every route must run without hitting a query the fixture cannot answer. */
function checkClean(string $name, array $res): void
{
    check($name . ': no unrecognised query', empty($res['unmatched']), implode(' | ', array_slice($res['unmatched'], 0, 2)));
    check($name . ': no PHP notice', ($res['noise'] ?? '') === '', substr((string) ($res['noise'] ?? ''), 0, 200));
}

echo "== public reads ==\n";

$stats = req('GET', '/stats');
check('/stats 200', $stats['status'] === 200, 'got ' . $stats['status'] . ' ' . $stats['body']);
check('/stats totalShakes = 19+30', ($stats['json']['totalShakes'] ?? null) === 49, json_encode($stats['json']));
check('/stats totalMinutes = 65+60', ($stats['json']['totalMinutes'] ?? null) === 125, json_encode($stats['json']));
check('/stats totalGoal = 3 kids x 3', ($stats['json']['totalGoal'] ?? null) === 9);
check('/stats activeSoldiers', ($stats['json']['activeSoldiers'] ?? null) === 3);
check('/stats totalSchools', ($stats['json']['totalSchools'] ?? null) === 2);
check('/stats totalPhotos', ($stats['json']['totalPhotos'] ?? null) === 1);
checkClean('/stats', $stats);

$schools = req('GET', '/schools');
check('/schools 200', $schools['status'] === 200, $schools['body']);
check('/schools is a list of 2', is_array($schools['json']) && count($schools['json']) === 2);
$first = $schools['json'][0] ?? [];
check('/schools carries total', ($first['total'] ?? null) === 19, json_encode($first));
check('/schools carries totalMinutes', ($first['totalMinutes'] ?? null) === 65, json_encode($first));
check('/schools carries totalPhotos', ($first['totalPhotos'] ?? null) === 1, json_encode($first));
check('/schools percent uncapped above goal (19 of 6)', ($first['percent'] ?? null) === 317, json_encode($first['percent'] ?? null));
check('/schools goalReached', ($first['goalReached'] ?? null) === true);
checkClean('/schools', $schools);

$school = req('GET', '/schools/61');
check('/schools/:id 200', $school['status'] === 200, $school['body']);
check('/schools/:id is one object', isset($school['json']['id']) && !isset($school['json'][0]));
check('/schools/:id totalMinutes', ($school['json']['totalMinutes'] ?? null) === 65);
checkClean('/schools/:id', $school);

$feed = req('GET', '/schools/61/shakes');
check('/schools/:id/shakes 200', $feed['status'] === 200, $feed['body']);
check('/schools/:id/shakes is a list', is_array($feed['json']));
checkClean('/schools/:id/shakes', $feed);

$board = req('GET', '/schools/61/leaderboard');
check('/schools/:id/leaderboard 200 or 404', in_array($board['status'], [200, 404], true), $board['body']);
checkClean('/schools/:id/leaderboard', $board);

$classes = req('GET', '/schools/61/classes', null, 'admin');
check('/schools/:id/classes 200', $classes['status'] === 200, $classes['body']);
checkClean('/schools/:id/classes', $classes);

echo "== auth ==\n";

$badLogin = req('POST', '/soldier/login', ['serial' => '555001', 'dob' => '2014-05-05']);
check('/soldier/login returns a token', ($badLogin['status'] === 200 && !empty($badLogin['json']['token'])), $badLogin['body']);
checkClean('/soldier/login', $badLogin);

$noAuth = req('GET', '/me/shakes');
check('/me/shakes without a token is 401', $noAuth['status'] === 401, $noAuth['body']);

$mine = req('GET', '/me/shakes', null, 'kid');
check('/me/shakes with a token is 200', $mine['status'] === 200, $mine['body']);
check('/me/shakes is a list', is_array($mine['json']));
checkClean('/me/shakes', $mine);

$day = req('GET', '/me/days/2', null, 'kid');
check('/me/days/2 200', $day['status'] === 200, $day['body']);
check('/me/days/2 count = 12', ($day['json']['count'] ?? null) === 12, json_encode($day['json']));
check('/me/days/2 minutes = 45', ($day['json']['minutes'] ?? null) === 45, json_encode($day['json']));
check('/me/days/2 note', ($day['json']['note'] ?? null) === 'We went to the park', json_encode($day['json']['note'] ?? null));
checkClean('/me/days/2', $day);

echo "== writes ==\n";

$save = req('PUT', '/me/days/2', ['count' => 5, 'minutes' => 30, 'note' => 'ok', 'photos' => []], 'kid');
check('PUT /me/days/2 200', $save['status'] === 200, $save['body']);
$marked = $save['marked'][0]['marks'] ?? null;
check('PUT marked the grid', is_array($marked), json_encode($save['marked']));
// The overwrite change: what was submitted is what gets marked, even though 12
// is already on record for that day.
$values = [];
$savedMarks = (array) $save['marked'];
array_walk_recursive($savedMarks, static function ($v) use (&$values) {
    if (is_int($v)) { $values[] = $v; }
});
check('PUT marks the submitted count, not max(12, 5)', in_array(5, $values, true) && !in_array(12, $values, true), json_encode($save['marked']));
check('PUT marks the submitted minutes', in_array(30, $values, true));
checkClean('PUT /me/days/2', $save);

$lower = req('PUT', '/me/days/2', ['count' => 1, 'minutes' => 1, 'note' => '', 'photos' => []], 'kid');
check('PUT accepts a lower count', $lower['status'] === 200, $lower['body']);

$tooMany = req('PUT', '/me/days/2', ['count' => 5, 'minutes' => 501], 'kid');
check('PUT rejects minutes over 500', $tooMany['status'] === 422, $tooMany['body']);

$zeroCount = req('PUT', '/me/days/2', ['count' => 0, 'minutes' => 5], 'kid');
check('PUT rejects count 0', $zeroCount['status'] === 422, $zeroCount['body']);

$shakeAlias = req('POST', '/shakes', ['day' => 2, 'count' => 4], 'kid');
check('POST /shakes 200', $shakeAlias['status'] === 200, $shakeAlias['body']);
$aliasValues = [];
$aliasMarks = (array) $shakeAlias['marked'];
array_walk_recursive($aliasMarks, static function ($v) use (&$aliasValues) {
    if (is_int($v)) { $aliasValues[] = $v; }
});
// minutes was absent, so only the count task may be marked.
check('POST /shakes without minutes marks only the count', count($shakeAlias['marked'] ?? []) === 1, json_encode($shakeAlias['marked']));
checkClean('POST /shakes', $shakeAlias);

echo "== admin ==\n";

$pending = req('GET', '/schools/61/photos/pending', null, 'admin');
check('pending photos 200', $pending['status'] === 200, $pending['body']);
checkClean('pending photos', $pending);

$rows = req('GET', '/schools/61/report-rows', null, 'admin');
check('report-rows 200', $rows['status'] === 200, $rows['body']);
check('report-rows is a list', is_array($rows['json']));
checkClean('report-rows', $rows);

$settings = req('GET', '/settings', null, 'admin');
check('/settings 200', $settings['status'] === 200, $settings['body']);
check('/settings perKidGoal', ($settings['json']['perKidGoal'] ?? null) === 3, $settings['body']);

$patchSettings = req('PATCH', '/settings', ['perKidGoal' => 5], 'admin');
check('PATCH /settings 200', $patchSettings['status'] === 200, $patchSettings['body']);
checkClean('PATCH /settings', $patchSettings);

$goal = req('PATCH', '/schools/61/goal', ['goalOverride' => 40], 'admin');
check('PATCH goal 200', $goal['status'] === 200, $goal['body']);
checkClean('PATCH goal', $goal);

$approveAll = req('POST', '/schools/61/photos/approve-all', [], 'admin');
check('approve-all 200', $approveAll['status'] === 200, $approveAll['body']);
checkClean('approve-all', $approveAll);

$review = req('POST', '/photos/' . str_repeat('a', 32) . '/approve', [], 'admin');
check('photo approve 200', $review['status'] === 200, $review['body']);
checkClean('photo approve', $review);

$del = req('DELETE', '/photos/' . str_repeat('a', 32), null, 'admin');
check('photo delete 200', $del['status'] === 200, $del['body']);
checkClean('photo delete', $del);


echo "== response cache ==\n";

$cacheDir = $sandbox . '/storage/lulav/cache';
array_map('unlink', (array) glob($cacheDir . '/*.json'));

$cold = req('GET', '/stats');
$warm = req('GET', '/stats');
check('cache: cold and warm bodies match', $cold['body'] === $warm['body'], $cold['body'] . ' vs ' . $warm['body']);
check('cache: warm request issues fewer queries',
    $warm['queries'] < $cold['queries'],
    'cold=' . $cold['queries'] . ' warm=' . $warm['queries']);
check('cache: a file was written', count((array) glob($cacheDir . '/c-*.json')) > 0);

// A save must flush the cache, so the next read is computed again.
req('PUT', '/me/days/2', ['count' => 9, 'minutes' => 9, 'note' => '', 'photos' => []], 'kid');
check('cache: a save flushed it', count((array) glob($cacheDir . '/c-*.json')) === 0);
$afterWrite = req('GET', '/stats');
check('cache: rebuilt after a write', $afterWrite['queries'] === $cold['queries'],
    'cold=' . $cold['queries'] . ' after=' . $afterWrite['queries']);

// Distinct keys must not collide.
req('GET', '/schools');
req('GET', '/schools/61');
check('cache: separate entries per key', count((array) glob($cacheDir . '/c-*.json')) >= 2,
    (string) count((array) glob($cacheDir . '/c-*.json')));

echo "== a photo whose file is gone ==\n";

$photoRoot = $sandbox . '/storage/lulav/photos';
$photoFile = $photoRoot . '/' . str_repeat('a', 32) . '.jpg';
@unlink($photoFile);
array_map('unlink', (array) glob($cacheDir . '/*.json'));

$gone = req('GET', '/me/days/2', null, 'kid');
check('missing file: photo is not listed', ($gone['json']['photos'] ?? null) === [], json_encode($gone['json']['photos'] ?? null));
// ?? would swallow a genuine null, so this asks whether the key is present AND null.
check('missing file: photo field is null',
    array_key_exists('photo', (array) $gone['json']) && $gone['json']['photo'] === null,
    json_encode($gone['json']['photo'] ?? 'MISSING'));

@mkdir($photoRoot, 0750, true);
file_put_contents($photoFile, "not really a jpeg, but it exists");
array_map('unlink', (array) glob($cacheDir . '/*.json'));

$present = req('GET', '/me/days/2', null, 'kid');
check('present file: photo is listed', count($present['json']['photos'] ?? []) === 1, json_encode($present['json']['photos'] ?? null));
check('present file: url points at the api', ($present['json']['photos'][0] ?? '') === '/mivtzoim/lulav/api/photos/' . str_repeat('a', 32) . '/file',
    json_encode($present['json']['photos'][0] ?? null));
@unlink($photoFile);

echo "== not found ==\n";
$missing = req('GET', '/nope');
check('unknown route is 404', $missing['status'] === 404, $missing['body']);

printf("\n%d passed, %d failed\n", $pass, $fail);
foreach ($failures as $f) {
    echo "  FAIL  $f\n";
}
exit($fail === 0 ? 0 : 1);
