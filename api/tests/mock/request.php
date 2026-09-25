<?php
/**
 * Runs ONE Lulav API request against the fake database and prints
 * {status, body, unmatched, queries} as JSON. run.php calls this once per
 * request so the API's procedural index.php gets a clean process each time.
 *
 * argv: method, path, json-body, actor ('' | 'kid' | 'admin')
 */

$method = $argv[1];
$path = $argv[2];
$body = $argv[3] ?? '';
$actor = $argv[4] ?? '';
$sandbox = $argv[5];
$env = json_decode($argv[6] ?? '{}', true) ?: [];

$root = $sandbox . '/public';
$_SERVER['REQUEST_METHOD'] = $method;
$_SERVER['REQUEST_URI'] = '/mivtzoim/lulav/api' . $path;
parse_str((string) parse_url($path, PHP_URL_QUERY), $_GET);
$_SERVER['DOCUMENT_ROOT'] = $root;
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
putenv('LULAV_TOKEN_SECRET=lulav-test-signing-secret-at-least-32-chars');
putenv('LULAV_TEST_MARKLOG=' . $sandbox . '/marks.json');
@unlink($sandbox . '/marks.json');
// Alerts are captured, never mailed.
putenv('LULAV_MAIL_CAPTURE=' . $sandbox . '/mail.jsonl');
@unlink($sandbox . '/mail.jsonl');
foreach ($env as $name => $value) {
    putenv($name . '=' . $value);
}

// lulavInput() falls back to $_POST when the content type is not JSON, so the
// body goes there rather than through a php://input stream wrapper.
// "@<file>" reads the body from a file: one command-line argument tops out
// around 128 KB, and the photo-size tests need several megabytes.
if (strpos($body, '@') === 0) {
    $body = (string) file_get_contents(substr($body, 1));
}
if ($body !== '') {
    $_POST = json_decode($body, true) ?: [];
}
// A test may declare a content type, e.g. JSON with no body at all.
if (isset($env['CONTENT_TYPE'])) {
    $_SERVER['CONTENT_TYPE'] = $env['CONTENT_TYPE'];
}

ob_start();
register_shutdown_function(static function () {
    $out = ob_get_clean();
    $code = http_response_code();
    $marks = @file_get_contents($GLOBALS['sandbox'] . '/marks.json');
    $mail = array_values(array_filter(array_map(static function ($line) {
        return json_decode($line, true);
    }, explode("\n", (string) @file_get_contents($GLOBALS['sandbox'] . '/mail.jsonl')))));
    // A zip (or any binary body) is not UTF-8 and would break json_encode.
    $binary = !mb_check_encoding((string) $out, 'UTF-8');
    fwrite(STDOUT, json_encode([
        'status' => $code === false ? 200 : $code,
        'body' => $binary ? '' : $out,
        'body_b64' => $binary ? base64_encode((string) $out) : null,
        'unmatched' => array_values(array_unique(FakeDb::$unmatched)),
        'queries' => count(FakeDb::$log),
        'marked' => $marks ? json_decode($marks, true) : null,
        'mail' => $mail,
    ]));
});

// Coverage marks from an instrumented sandbox (coverage.php); a no-op otherwise.
function lulav_cov(string $id): void
{
    static $seen = [];
    $file = getenv('LULAV_TEST_COVERAGE');
    if (!$file || isset($seen[$id])) {
        return;
    }
    $seen[$id] = true;
    file_put_contents($file, $id . "\n", FILE_APPEND | LOCK_EX);
}

// bootstrap.php first: it wires the fake PDO and defines lulavIssueToken, so a
// token can be signed with the very secret the route will verify against.
require $root . '/mivtzoim/lulav/api/bootstrap.php';

if (strpos($actor, 'bearer:') === 0) {
    // A raw token, for proving a non-session token cannot pass as one.
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . substr($actor, 7);
} elseif ($actor === 'kid') {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . lulavIssueToken('kid', 9001, ['serial' => '555001']);
} elseif ($actor === 'admin') {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . lulavIssueToken('admin', 1, ['isHq' => true]);
}

require $root . '/mivtzoim/lulav/api/index.php';
