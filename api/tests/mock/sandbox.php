<?php
/**
 * Builds the throwaway tree the mock suite runs the API inside.
 *
 * bootstrap.php resolves the platform includes from its OWN directory
 * (dirname(__DIR__, 3) and friends), so they cannot be redirected with an
 * environment variable -- the API has to sit at the same depth under a root we
 * control. This copies the two real API files into that shape and fills the
 * four platform includes with stubs.
 */

// The API files coverage.php measures. school-locations.php is data -- it only
// returns an array -- so it has no functions or exits to count.
const LULAV_COVERED_FILES = ['bootstrap.php', 'index.php'];

function lulav_mock_sandbox(): string
{
    $root = sys_get_temp_dir() . '/lulav-mock-' . getmypid();
    lulav_mock_rmtree($root);

    $api = $root . '/public/mivtzoim/lulav/api';
    foreach ([
        $api,
        $root . '/public/api/header',
        $root . '/public/api/auth/classes',
        $root . '/public/mivtzoim/classes',
    ] as $dir) {
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            fwrite(STDERR, "Could not create $dir\n");
            exit(1);
        }
    }

    // The API under test: copied, never edited.
    $source = dirname(__DIR__, 2);
    copy($source . '/bootstrap.php', $api . '/bootstrap.php');
    copy($source . '/index.php', $api . '/index.php');
    copy($source . '/school-locations.php', $api . '/school-locations.php');
    // coverage.php sets this: mark the copies so the suite can report what it
    // never reached. The real files are never touched.
    if (getenv('LULAV_TEST_COVERAGE')) {
        foreach (LULAV_COVERED_FILES as $file) {
            $copy = $api . '/' . $file;
            file_put_contents($copy, lulav_mock_instrument((string) file_get_contents($copy), $file));
        }
    }

    // The platform, stubbed.
    $stubs = __DIR__ . '/stubs';
    copy($stubs . '/db.php', $root . '/public/api/header/db.php');
    copy($stubs . '/Auth.php', $root . '/public/api/auth/classes/Auth.php');
    copy($stubs . '/class.globalSettings.php', $root . '/public/class.globalSettings.php');
    copy($stubs . '/mivtzoim.php', $root . '/public/mivtzoim/classes/mivtzoim.php');

    // db.php reaches for these two beside the sandbox root.
    copy(__DIR__ . '/fakedb.php', $root . '/fakedb.php');
    copy(__DIR__ . '/fixtures.php', $root . '/fixtures.php');

    return $root;
}

function lulav_mock_rmtree(string $path): void
{
    if (!is_dir($path)) {
        return;
    }
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($items as $item) {
        $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
    }
    @rmdir($path);
}

/**
 * The points coverage.php counts in one PHP file, as [kind, line, name, offset]:
 * each top-level function (at its opening brace), each route in the router (at
 * the brace that opens its body) and each statement that starts with
 * lulavError(). `offset` is where a marker goes, always on that same line.
 */
function lulav_mock_coverage_sites(string $source): array
{
    $sites = [];
    $lines = explode("\n", $source);
    $offset = 0;
    $function = '';
    $pendingFunction = null;
    $pendingRoute = null;
    foreach ($lines as $index => $line) {
        $number = $index + 1;
        if (preg_match('/^function\s+&?(\w+)/', $line, $m)) {
            $function = $m[1];
            $pendingFunction = $m[1];
        }
        // PSR-2: a function's brace sits alone on the line after its signature.
        if ($pendingFunction !== null && $line === '{') {
            $sites[] = ['function', $number, $pendingFunction, $offset + 1];
            $pendingFunction = null;
        }
        if (preg_match('/^    if \(\$method === /', $line)) {
            $pendingRoute = trim(preg_replace('/\s+/', ' ', $line));
            $function = '(router)';
        }
        if ($pendingRoute !== null && preg_match('/\) \{$/', $line)) {
            $sites[] = ['route', $number, $pendingRoute, $offset + strlen($line)];
            $pendingRoute = null;
        }
        if (preg_match('/^(\s*)lulavError\(/', $line, $m)) {
            $sites[] = ['error exit', $number, 'in ' . $function, $offset + strlen($m[1])];
        }
        $offset += strlen($line) + 1;
    }
    return array_map(static function (array $site): array {
        return [$site[0], $site[1], $site[2], $site[3]];
    }, $sites);
}

/** $source with a lulav_cov('file:line') call at every coverage site. */
function lulav_mock_instrument(string $source, string $file): string
{
    $sites = lulav_mock_coverage_sites($source);
    // Back to front, so earlier offsets stay valid.
    usort($sites, static function (array $a, array $b): int { return $b[3] <=> $a[3]; });
    foreach ($sites as [$kind, $line, $name, $at]) {
        $source = substr($source, 0, $at) . " lulav_cov('$file:$line'); " . substr($source, $at);
    }
    return $source;
}
