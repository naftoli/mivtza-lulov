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

function req(string $method, string $path, array $body = null, string $actor = '', array $env = []): array
{
    global $sandbox;
    $cmd = sprintf(
        'php %s %s %s %s %s %s %s 2>&1',
        escapeshellarg(__DIR__ . '/request.php'),
        escapeshellarg($method),
        escapeshellarg($path),
        escapeshellarg($body === null ? '' : json_encode($body)),
        escapeshellarg($actor),
        escapeshellarg($sandbox),
        escapeshellarg(json_encode((object) $env))
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


echo "== soldier sign-in gate ==\n";

$closed = ['LULAV_KID_LOGIN_OPENS_AT' => '2099-01-01 00:00 UTC'];

$gatedLogin = req('POST', '/soldier/login', ['serial' => '555001', 'dob' => '2014-05-05'], '', $closed);
check('gate: /soldier/login refused while closed', $gatedLogin['status'] === 403, $gatedLogin['body']);
check('gate: refusal says when it opens', strpos((string) ($gatedLogin['json']['error'] ?? ''), 'opens for soldiers') !== false, $gatedLogin['body']);
check('gate: refusal carries opensAt', !empty($gatedLogin['json']['opensAt']), $gatedLogin['body']);
check('gate: no token issued', empty($gatedLogin['json']['token']));
check('gate: credentials never looked up', ($gatedLogin['queries'] ?? 99) === 0, 'queries=' . ($gatedLogin['queries'] ?? '?'));

$gatedHandoff = req('POST', '/soldier/handoff', ['code' => 'anything'], '', $closed);
check('gate: /soldier/handoff refused while closed', $gatedHandoff['status'] === 403, $gatedHandoff['body']);

$gatedParent = req('POST', '/parent/handoff', ['parent' => 'tok', 'child' => 9001], '', $closed);
check('gate: /parent/handoff refused while closed', $gatedParent['status'] === 403, $gatedParent['body']);

$gatedSession = req('GET', '/me/shakes', null, 'kid', $closed);
check('gate: an existing kid session is refused too', $gatedSession['status'] === 403, $gatedSession['body']);

$gatedSave = req('PUT', '/me/days/2', ['count' => 5, 'minutes' => 5], 'kid', $closed);
check('gate: a kid cannot save while closed', $gatedSave['status'] === 403, $gatedSave['body']);
check('gate: nothing marked while closed', empty($gatedSave['marked']));

$adminWhileClosed = req('GET', '/schools/61/report-rows', null, 'admin', $closed);
check('gate: admins unaffected', $adminWhileClosed['status'] === 200, $adminWhileClosed['body']);

$publicWhileClosed = req('GET', '/stats', null, '', $closed);
check('gate: public pages unaffected', $publicWhileClosed['status'] === 200, $publicWhileClosed['body']);

// No override at all: the real rule, sunset in Crown Heights on 27 Sep 2026.
$realRule = req('POST', '/soldier/login', ['serial' => '555001', 'dob' => '2014-05-05'], '', ['LULAV_KID_LOGIN_OPENS_AT' => '']);
$expectOpen = time() >= strtotime('2026-09-27 18:44:51 America/New_York');
check('gate: real rule opens at Sun 27 Sep 2026 6:44 PM Eastern',
    $expectOpen ? $realRule['status'] === 200 : ($realRule['status'] === 403 && strpos((string) $realRule['json']['opensAt'], '2026-09-27T18:44') === 0),
    $realRule['body']);

echo "== high-number alerts ==\n";

$quiet = req('PUT', '/me/days/2', ['count' => 49, 'minutes' => 179, 'note' => '', 'photos' => []], 'kid');
check('alert: 49 shakes / 179 minutes sends nothing', $quiet['status'] === 200 && $quiet['mail'] === [], json_encode($quiet['mail']));

$loud = req('PUT', '/me/days/2', ['count' => 60, 'minutes' => 45, 'note' => 'Whole shul', 'photos' => []], 'kid');
check('alert: 60 shakes saves normally', $loud['status'] === 200, $loud['body']);
check('alert: 60 shakes sends one email', count($loud['mail']) === 1, json_encode($loud['mail']));
$mail = $loud['mail'][0] ?? ['to' => [], 'subject' => '', 'body' => ''];
check('alert: addressed to HQ', in_array('cth@tzivoshashem.org', $mail['to'], true), json_encode($mail['to']));
check('alert: addressed to Shimmy', in_array('shimmyweinbaum@gmail.com', $mail['to'], true), json_encode($mail['to']));
check('alert: only HQ and Shimmy in To', count($mail['to']) === 2, json_encode($mail['to']));
check('alert: Base Commander is Cc', in_array('commander@school61.test', $mail['cc'] ?? [], true), json_encode($mail['cc'] ?? null));
check('alert: Cc addresses are normalised', !in_array('Commander@School61.test', $mail['cc'] ?? [], true));
check('alert: a principal who is not a Base Commander is left off', !in_array('principal@school61.test', array_merge($mail['to'], $mail['cc'] ?? []), true), json_encode($mail));
check('alert: nobody in both To and Cc', array_intersect($mail['to'], $mail['cc'] ?? []) === []);
check('alert: subject names the soldier and number', strpos($mail['subject'], 'Mendel Cohen reported 60 shakes on day 2') !== false, $mail['subject']);
check('alert: subject is not tagged with a host', strpos($mail['subject'], 'Mivtza Lulav check:') === 0, $mail['subject']);
check('alert: link is the live admin screen', strpos($mail['body'], 'https://mashpia.com/mivtzoim/lulav/admin') !== false, $mail['body']);
foreach (['(c) ' . date('Y') . ' Tzivos Hashem', '792 Eastern Pkwy, Brooklyn, NY 11213', 'Privacy Policy: https://mashpia.com/privacy_policy.php', 'To unsubscribe from these emails, visit https://mashpia.com/unsubscribe.php'] as $needle) {
    check('alert: footer has ' . $needle, strpos($mail['body'], $needle) !== false, substr($mail['body'], -200));
}
foreach (['Mendel Cohen', 'serial 555001', "School:   Sample Day School\n", 'Sukkos day 2 -- Sunday, September 27, 2026', 'Shakes:   60', 'Minutes:  45', 'Whole shul', '/mivtzoim/lulav/admin'] as $needle) {
    check('alert: body has ' . $needle, strpos($mail['body'], $needle) !== false, $mail['body']);
}

$noCommander = req('PUT', '/me/days/2', ['count' => 60, 'minutes' => 45, 'note' => '', 'photos' => []], 'kid', ['LULAV_TEST_NO_BC' => '1']);
$fallbackCc = $noCommander['mail'][0]['cc'] ?? [];
check('alert: no Base Commander falls back to the school admins', in_array('commander@school61.test', $fallbackCc, true) && in_array('principal@school61.test', $fallbackCc, true), json_encode($fallbackCc));

$minutesOnly = req('PUT', '/me/days/2', ['count' => 5, 'minutes' => 200, 'note' => '', 'photos' => []], 'kid');
check('alert: 200 minutes alone sends one', count($minutesOnly['mail']) === 1, json_encode($minutesOnly['mail']));
check('alert: names the minutes', strpos($minutesOnly['mail'][0]['subject'] ?? '', '200 minutes') !== false, $minutesOnly['mail'][0]['subject'] ?? '');

$boundary = req('PUT', '/me/days/2', ['count' => 50, 'minutes' => 180, 'note' => '', 'photos' => []], 'kid');
check('alert: exactly 50 / 180 counts', count($boundary['mail']) === 1, json_encode($boundary['mail']));
check('alert: both reasons listed', strpos($boundary['mail'][0]['subject'] ?? '', '50 shakes and 180 minutes') !== false, $boundary['mail'][0]['subject'] ?? '');

// POST /shakes may leave minutes out: stored minutes (45) are reported, and do not trigger on their own.
$alias = req('POST', '/shakes', ['day' => 2, 'count' => 75], 'kid');
check('alert: POST /shakes over threshold alerts', count($alias['mail']) === 1, json_encode($alias['mail']));
check('alert: absent minutes reported as stored', strpos($alias['mail'][0]['body'] ?? '', 'Minutes:  45') !== false, $alias['mail'][0]['body'] ?? '');

// Already flagged at 60: saving 60 again (a photo, a story) must not mail again,
// but a different high number must.
$flagged = ['LULAV_TEST_DAY2_COUNT' => '60'];
$resave = req('PUT', '/me/days/2', ['count' => 60, 'minutes' => 45, 'note' => 'added a photo', 'photos' => []], 'kid', $flagged);
check('alert: re-saving an unchanged flagged day sends nothing', $resave['status'] === 200 && $resave['mail'] === [], json_encode($resave['mail']));
$raised = req('PUT', '/me/days/2', ['count' => 500, 'minutes' => 45, 'note' => '', 'photos' => []], 'kid', $flagged);
check('alert: 60 -> 500 alerts again', count($raised['mail']) === 1, json_encode($raised['mail']));
$lowered = req('PUT', '/me/days/2', ['count' => 10, 'minutes' => 45, 'note' => '', 'photos' => []], 'kid', $flagged);
check('alert: 60 -> 10 sends nothing', $lowered['mail'] === [], json_encode($lowered['mail']));

$blocked = req('PUT', '/me/days/2', ['count' => 60, 'minutes' => 501], 'kid');
check('alert: a rejected save sends nothing', $blocked['status'] === 422 && $blocked['mail'] === [], json_encode($blocked['mail']));


echo "== approved-photo zip ==\n";

// Signs a token exactly as bootstrap.php does, with request.php's test secret,
// so the suite can forge the tokens an attacker would try.
function signTest(array $payload): string
{
    $b64 = static function (string $v): string { return rtrim(strtr(base64_encode($v), '+/', '-_'), '='); };
    $encoded = $b64(json_encode($payload));
    return $encoded . '.' . $b64(hash_hmac('sha256', $encoded, 'lulav-test-signing-secret-at-least-32-chars', true));
}

/** Unpacks a zip response: ['name' => [bytes, compression method]]. */
function zipEntries(array $res): array
{
    $bytes = base64_decode((string) ($res['body_b64'] ?? ''), true);
    if ($bytes === false || $bytes === '') {
        return [];
    }
    $file = tempnam(sys_get_temp_dir(), 'lulav-zip-test-');
    file_put_contents($file, $bytes);
    $zip = new ZipArchive();
    $out = [];
    if ($zip->open($file) === true) {
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $stat = $zip->statIndex($i);
            $out[$stat['name']] = [$zip->getFromIndex($i), $stat['comp_method']];
        }
        $zip->close();
    }
    unlink($file);
    return $out;
}

// The photos on disk. zip-missing.jpg is deliberately not written.
$photoDir = $sandbox . '/storage/lulav/photos';
@mkdir($photoDir, 0750, true);
file_put_contents($photoDir . '/zip-mendel-1.jpg', "mendel photo one");
file_put_contents($photoDir . '/zip-mendel-2.png', "mendel photo two");
file_put_contents($photoDir . '/zip-levi-1.jpg', "levi photo");

$link = req('POST', '/schools/61/photos/download-link', [], 'admin');
check('zip: admin gets a link', $link['status'] === 200, $link['body']);
check('zip: link points at the zip with a token', strpos((string) ($link['json']['url'] ?? ''), '/mivtzoim/lulav/api/schools/61/photos/approved.zip?token=') === 0, $link['body']);
check('zip: link lasts two minutes', ($link['json']['expiresIn'] ?? null) === 120, $link['body']);
check('zip: count skips the photo whose file is missing', ($link['json']['count'] ?? null) === 3, $link['body']);
checkClean('zip link', $link);

$kidLink = req('POST', '/schools/61/photos/download-link', [], 'kid');
check('zip: a soldier cannot get a link', $kidLink['status'] === 403, $kidLink['body']);
$anonLink = req('POST', '/schools/61/photos/download-link', []);
check('zip: no token, no link', $anonLink['status'] === 401, $anonLink['body']);

$zipPath = substr((string) ($link['json']['url'] ?? ''), strlen('/mivtzoim/lulav/api'));
$zip = req('GET', $zipPath);
check('zip: download 200', $zip['status'] === 200, $zip['body']);
check('zip: body is a zip', strpos((string) base64_decode((string) ($zip['body_b64'] ?? '')), "PK\x03\x04") === 0);
$entries = zipEntries($zip);
check('zip: three photos, named by soldier and day, in order',
    array_keys($entries) === ['Levi Katz - Day 2.jpg', 'Mendel Cohen - Day 2 - 1.jpg', 'Mendel Cohen - Day 2 - 2.png'],
    json_encode(array_keys($entries)));
check('zip: file contents intact', ($entries['Mendel Cohen - Day 2 - 2.png'][0] ?? '') === 'mendel photo two');
check('zip: photos stored, not re-compressed', ($entries['Levi Katz - Day 2.jpg'][1] ?? -1) === ZipArchive::CM_STORE,
    'method=' . ($entries['Levi Katz - Day 2.jpg'][1] ?? '?'));
checkClean('zip download', $zip);

$hidden = req('POST', '/schools/61/photos/download-link', [], 'admin', ['LULAV_TEST_HIDE_9002' => '1']);
check('zip: a removed entry is left out', ($hidden['json']['count'] ?? null) === 2, $hidden['body']);
$hiddenZip = zipEntries(req('GET', substr((string) ($hidden['json']['url'] ?? ''), strlen('/mivtzoim/lulav/api')), null, '', ['LULAV_TEST_HIDE_9002' => '1']));
check('zip: ...and not in the zip', !isset($hiddenZip['Levi Katz - Day 2.jpg']) && count($hiddenZip) === 2, json_encode(array_keys($hiddenZip)));

$none = req('POST', '/schools/61/photos/download-link', [], 'admin', ['LULAV_TEST_NO_APPROVED' => '1']);
check('zip: no approved photos is a message, not a link', $none['status'] === 404 && strpos((string) ($none['json']['error'] ?? ''), 'no approved photos') !== false, $none['body']);

$good = ['v' => 1, 'type' => 'photozip', 'id' => 61, 'admin' => 1, 'iat' => time(), 'exp' => time() + 120];
$noToken = req('GET', '/schools/61/photos/approved.zip');
check('zip: no token is refused', $noToken['status'] === 401, $noToken['body']);
$forged = req('GET', '/schools/61/photos/approved.zip?token=' . rawurlencode(signTest($good) . 'x'));
check('zip: a tampered token is refused', $forged['status'] === 401, $forged['body']);
$expired = req('GET', '/schools/61/photos/approved.zip?token=' . rawurlencode(signTest(['exp' => time() - 1] + $good)));
check('zip: an expired token is refused', $expired['status'] === 401, $expired['body']);
$otherSchool = req('GET', '/schools/61/photos/approved.zip?token=' . rawurlencode(signTest(['id' => 269] + $good)));
check("zip: another school's token is refused", $otherSchool['status'] === 401, $otherSchool['body']);
$handoff = req('GET', '/schools/61/photos/approved.zip?token=' . rawurlencode(signTest(['type' => 'handoff'] + $good)));
check('zip: a different kind of token is refused', $handoff['status'] === 401, $handoff['body']);


// --- the upload-time window ---
$ny = static function (string $when): int { return (int) strtotime($when . ' America/New_York'); };

$times = req('GET', '/schools/61/photos/approved-times', null, 'admin');
check('window: admin gets upload times', $times['status'] === 200, $times['body']);
check('window: one per downloadable photo, oldest first (missing file left out)',
    ($times['json']['times'] ?? null) === [$ny('2026-09-27 19:30'), $ny('2026-09-28 10:00'), $ny('2026-09-28 20:00')],
    $times['body']);
checkClean('approved-times', $times);
check('window: a soldier cannot list them', req('GET', '/schools/61/photos/approved-times', null, 'kid')['status'] === 403);
$hiddenTimes = req('GET', '/schools/61/photos/approved-times', null, 'admin', ['LULAV_TEST_HIDE_9002' => '1']);
check('window: a removed entry has no time listed', count($hiddenTimes['json']['times'] ?? []) === 2, $hiddenTimes['body']);

$monday = req('POST', '/schools/61/photos/download-link', ['from' => $ny('2026-09-28 00:00'), 'to' => $ny('2026-09-28 23:59:59')], 'admin');
check('window: Monday only counts two', ($monday['json']['count'] ?? null) === 2, $monday['body']);
$mondayZip = zipEntries(req('GET', substr((string) ($monday['json']['url'] ?? ''), strlen('/mivtzoim/lulav/api'))));
// Numbered by what is in this zip: one of Mendel's that day, so no " - 1".
check('window: Monday zip holds exactly those two',
    array_keys($mondayZip) === ['Levi Katz - Day 2.jpg', 'Mendel Cohen - Day 2.png'],
    json_encode(array_keys($mondayZip)));

$edges = req('POST', '/schools/61/photos/download-link', ['from' => $ny('2026-09-27 19:30'), 'to' => $ny('2026-09-28 10:00')], 'admin');
check('window: both ends are inclusive', ($edges['json']['count'] ?? null) === 2, $edges['body']);

$openEnded = req('POST', '/schools/61/photos/download-link', ['from' => $ny('2026-09-28 12:00')], 'admin');
check('window: an open "to" runs to the latest', ($openEnded['json']['count'] ?? null) === 1, $openEnded['body']);

$empty = req('POST', '/schools/61/photos/download-link', ['from' => $ny('2026-10-01 00:00'), 'to' => $ny('2026-10-01 23:59')], 'admin');
check('window: nothing in range is a message', $empty['status'] === 404 && strpos((string) ($empty['json']['error'] ?? ''), 'in that range') !== false, $empty['body']);

$backwards = req('POST', '/schools/61/photos/download-link', ['from' => $ny('2026-09-28 00:00'), 'to' => $ny('2026-09-27 00:00')], 'admin');
check('window: from after to is refused', $backwards['status'] === 422, $backwards['body']);
$junk = req('POST', '/schools/61/photos/download-link', ['from' => 'yesterday'], 'admin');
check('window: a non-number is refused', $junk['status'] === 422, $junk['body']);

// The window is inside the signature: a token signed for Sunday only yields Sunday.
$sundayToken = signTest(['from' => $ny('2026-09-27 00:00'), 'to' => $ny('2026-09-27 23:59:59')] + $good);
$sundayZip = zipEntries(req('GET', '/schools/61/photos/approved.zip?token=' . rawurlencode($sundayToken)));
check('window: the zip honours the signed window', array_keys($sundayZip) === ['Mendel Cohen - Day 2.jpg'], json_encode(array_keys($sundayZip)));

// The zip token must never work as a login.
$asSession = req('GET', '/schools/61/report-rows', null, 'bearer:' . signTest($good));
check('zip: the download token is not a session', $asSession['status'] === 401, $asSession['body']);


echo "== sample send script ==\n";

// The real mail() path, into a file: headers and footer as a recipient sees them.
// Also guards the script's copy of lulavSendMail() and the constants it needs.
$eml = $sandbox . '/sample.eml';
$output = (string) shell_exec(sprintf('php -d %s %s naftolir@gmail.com 2>&1',
    escapeshellarg('sendmail_path=cat > ' . $eml), escapeshellarg(dirname(__DIR__) . '/send-sample-alert.php')));
$sent = (string) @file_get_contents($eml);
check('sample: runs without warnings', stripos($output, 'warning') === false && stripos($output, 'error') === false, $output);
check('sample: addressed only to the given address', strpos($sent, "To: naftolir@gmail.com\n") !== false && strpos($sent, 'Cc:') === false, substr($sent, 0, 300));
check('sample: List-Unsubscribe header', strpos($sent, 'List-Unsubscribe: <https://mashpia.com/unsubscribe.php>, <mailto:cth@mashpia.com?subject=unsubscribe>') !== false, substr($sent, 0, 400));
check('sample: not the one-click form', strpos($sent, 'List-Unsubscribe-Post') === false);
check('sample: footer address', strpos($sent, "792 Eastern Pkwy, Brooklyn, NY 11213\n") !== false, substr($sent, -250));
check('sample: footer privacy policy', strpos($sent, "Privacy Policy: https://mashpia.com/privacy_policy.php\n") !== false, substr($sent, -250));
check('sample: footer unsubscribe', strpos($sent, "To unsubscribe from these emails, visit https://mashpia.com/unsubscribe.php\n") !== false, substr($sent, -250));
check('sample: no link to the pages that are broken', strpos($sent, 'unsubscribe.html') === false && strpos($sent, 'privacy.html') === false);

echo "== not found ==\n";
$missing = req('GET', '/nope');
check('unknown route is 404', $missing['status'] === 404, $missing['body']);

printf("\n%d passed, %d failed\n", $pass, $fail);
foreach ($failures as $f) {
    echo "  FAIL  $f\n";
}
exit($fail === 0 ? 0 : 1);
