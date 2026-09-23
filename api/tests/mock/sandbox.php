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
