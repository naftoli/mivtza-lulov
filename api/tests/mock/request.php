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

$root = $sandbox . '/public';
$_SERVER['REQUEST_METHOD'] = $method;
$_SERVER['REQUEST_URI'] = '/mivtzoim/lulav/api' . $path;
$_SERVER['DOCUMENT_ROOT'] = $root;
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
putenv('LULAV_TOKEN_SECRET=lulav-test-signing-secret-at-least-32-chars');
putenv('LULAV_TEST_MARKLOG=' . $sandbox . '/marks.json');
@unlink($sandbox . '/marks.json');

// lulavInput() falls back to $_POST when the content type is not JSON, so the
// body goes there rather than through a php://input stream wrapper.
if ($body !== '') {
    $_POST = json_decode($body, true) ?: [];
}

ob_start();
register_shutdown_function(static function () {
    $out = ob_get_clean();
    $code = http_response_code();
    $marks = @file_get_contents($GLOBALS['sandbox'] . '/marks.json');
    fwrite(STDOUT, json_encode([
        'status' => $code === false ? 200 : $code,
        'body' => $out,
        'unmatched' => array_values(array_unique(FakeDb::$unmatched)),
        'queries' => count(FakeDb::$log),
        'marked' => $marks ? json_decode($marks, true) : null,
    ]));
});

// bootstrap.php first: it wires the fake PDO and defines lulavIssueToken, so a
// token can be signed with the very secret the route will verify against.
require $root . '/mivtzoim/lulav/api/bootstrap.php';

if ($actor === 'kid') {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . lulavIssueToken('kid', 9001, ['serial' => '555001']);
} elseif ($actor === 'admin') {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . lulavIssueToken('admin', 1, ['isHq' => true]);
}

require $root . '/mivtzoim/lulav/api/index.php';
