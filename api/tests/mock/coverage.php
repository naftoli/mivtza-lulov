<?php
/**
 * Which parts of the API the mock suite reaches: every function, every route
 * and every error exit (lulavError call), in bootstrap.php and index.php.
 *
 *   php api/tests/mock/coverage.php
 *
 * There is no Xdebug or PCOV here, so this marks the sandbox's COPY of the two
 * files -- a call on the same line as each function's opening brace, each
 * route's opening brace, and in front of each lulavError() -- runs the suite,
 * and lists whatever was never reached. The real files are never touched, and
 * no line moves, so every line number reported is the real one.
 */

$marks = sys_get_temp_dir() . '/lulav-coverage-' . getmypid() . '.log';
@unlink($marks);
putenv('LULAV_TEST_COVERAGE=' . $marks);

passthru('php ' . escapeshellarg(__DIR__ . '/run.php'), $status);

$hit = array_flip(array_filter(explode("\n", (string) @file_get_contents($marks))));
@unlink($marks);

$missed = [];
$totals = ['function' => [0, 0], 'route' => [0, 0], 'error exit' => [0, 0]];
foreach (lulav_coverage_points() as [$kind, $id, $label]) {
    $totals[$kind][0]++;
    if (isset($hit[$id])) {
        $totals[$kind][1]++;
    } else {
        $missed[$kind][] = $label;
    }
}

echo "\n== coverage ==\n";
foreach ($totals as $kind => [$all, $reached]) {
    printf("%-11s %3d of %3d reached\n", $kind . 's', $reached, $all);
}
foreach ($missed as $kind => $labels) {
    echo "\nnever reached ($kind):\n";
    foreach ($labels as $label) {
        echo "  $label\n";
    }
}
exit($status);

/**
 * Every point the instrumentation marks, as [kind, id, label]. Shares its
 * patterns with lulav_mock_instrument() in sandbox.php, so the two agree.
 */
function lulav_coverage_points(): array
{
    require_once __DIR__ . '/sandbox.php';
    $points = [];
    foreach (LULAV_COVERED_FILES as $file) {
        $source = (string) file_get_contents(dirname(__DIR__, 2) . '/' . $file);
        foreach (lulav_mock_coverage_sites($source) as [$kind, $line, $name]) {
            $id = "$file:$line";
            $label = "$file:$line  " . ($name !== '' ? $name : '');
            $points[] = [$kind, $id, rtrim($label)];
        }
    }
    return $points;
}
