<?php
require_once __DIR__ . '/../../../fakedb.php';
require_once __DIR__ . '/../../../fixtures.php';
$MASHPIA_DB = new FakeDb();
FakeDb::$patterns = lulav_test_patterns();
