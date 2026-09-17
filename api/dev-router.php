<?php

declare(strict_types=1);

// Built-in PHP server router for local `npm run dev` testing.
// Do not use this file under Apache.

if (!getenv('LULAV_TOKEN_SECRET')) {
    putenv('LULAV_TOKEN_SECRET=local-dev-only-lulav-token-secret-min-32');
}
set_time_limit(0);
ini_set('max_execution_time', '0');

// Mashpia's DB picker treats Host: localhost as the public database.
$_SERVER['HTTP_HOST'] = 'localhost';

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (preg_match('#^/mivtzoim/lulav/api(?:/|$)#', (string) $uri)) {
    require __DIR__ . '/index.php';
    return true;
}

return false;
