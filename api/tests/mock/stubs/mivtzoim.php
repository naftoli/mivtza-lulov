<?php
/** Records markTasks() calls instead of writing to the teacher grid. */
class Mivtzoim {
    public static $marked = [];
    private $id;
    public function __construct($id) { $this->id = $id; }
    public function markTasks(array $marks, $langId) {
        self::$marked[] = ['marks' => $marks, 'lang' => $langId];
        file_put_contents(getenv('LULAV_TEST_MARKLOG'), json_encode(self::$marked));
        return true;
    }
}
