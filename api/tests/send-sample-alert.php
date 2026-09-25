<?php
/**
 * Sends ONE sample high-number alert to ONE address, through the same
 * lulavSendMail() -- the same mail() call, headers and sender -- the real alerts
 * use. For checking that alerts leave the server and arrive, without saving a
 * report or touching the database.
 *
 *   php mashpia.com/public/mivtzoim/lulav/api/tests/send-sample-alert.php you@example.com
 *
 * The sample is addressed to the given address only. HQ, Shimmy and the Base
 * Commanders are named in the body, not mailed. Command line only.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$to = $argv[1] ?? '';
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Usage: php send-sample-alert.php you@example.com\n");
    exit(2);
}

// lulavSendMail() lives in bootstrap.php, which also connects to the database
// and sends HTTP headers. Take only the function, so this runs anywhere.
function lulavEnv(string $name, string $default = ''): string
{
    $value = getenv($name);
    return $value === false || $value === '' ? $default : (string) $value;
}
$source = (string) file_get_contents(dirname(__DIR__) . '/bootstrap.php');
// From the footer constants just above it, which it uses.
$start = strpos($source, 'const LULAV_MAIL_ADDRESS');
$end = strpos($source, 'function lulavWithUserLock(');
if ($start === false || $end === false) {
    fwrite(STDERR, "Could not find lulavSendMail() and its constants in bootstrap.php\n");
    exit(1);
}
eval(substr($source, $start, $end - $start));

// Exactly what lulavSendHighNumberAlert() writes for a 60-shake, 200-minute day,
// with a line on top saying who a real one would go to.
$body = implode("\n", [
    'TEST -- a sample of the Mivtza Lulav high-number alert. A real one is',
    'addressed to cth@tzivoshashem.org and shimmyweinbaum@gmail.com, and copied',
    "to the soldier's Base Commanders. This one went only to " . $to . '.',
    '',
    'A Mivtza Lulav report for one day is at or over the review threshold',
    '(50 shakes or 180 minutes). Please check it with the soldier.',
    '',
    'Soldier:  Mendel Cohen (serial 555001)',
    'School:   Sample Day School',
    'Class:    5-Boys',
    'Day:      Sukkos day 2 -- Sunday, September 27, 2026',
    'Shakes:   60',
    'Minutes:  200',
    'Flagged:  60 shakes (50 or more); 200 minutes (180 or more)',
    '',
    'Their story:',
    'We went to 3 shuls and the park. Mendel helped 12 people in the old age home too.',
    '',
    'Review it in the admin screen: https://mashpia.com/mivtzoim/lulav/admin',
]) . "\n";

$sent = lulavSendMail(
    [$to],
    '[TEST] Mivtza Lulav check: Mendel Cohen reported 60 shakes and 200 minutes on day 2',
    $body
);

echo $sent
    ? "Handed to the mail system for $to. Check the inbox, and the spam folder.\n"
    : "mail() refused the message; see the PHP error log.\n";
exit($sent ? 0 : 1);
