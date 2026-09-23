<?php
/**
 * A fake PDO for the Lulav API tests.
 *
 * It is not a SQL engine. Each prepared statement is matched against an ordered
 * list of patterns; the first pattern whose regex matches the (whitespace
 * collapsed) SQL supplies the rows. Anything unmatched returns no rows and is
 * recorded, so a test can assert that every query a route issued was one the
 * fixture actually understood.
 */

class FakeStatement extends PDOStatement
{
    /** @var array<int,array<string,mixed>> */
    private $rows = [];
    private $cursor = 0;
    public $sql = '';
    public $params = [];

    public function __construct(string $sql, array $rows)
    {
        $this->sql = $sql;
        $this->rows = $rows;
    }

    #[\ReturnTypeWillChange]
    public function execute($params = null)
    {
        $this->params = $params ?? [];
        $this->cursor = 0;
        FakeDb::$log[] = ['sql' => $this->sql, 'params' => $this->params];
        return true;
    }

    #[\ReturnTypeWillChange]
    public function fetch($mode = null, $orientation = null, $offset = null)
    {
        if ($this->cursor >= count($this->rows)) {
            return false;
        }
        return $this->rows[$this->cursor++];
    }

    #[\ReturnTypeWillChange]
    public function fetchAll($how = null, $class_name = null, $ctor_args = null)
    {
        $rest = array_slice($this->rows, $this->cursor);
        $this->cursor = count($this->rows);
        return $rest;
    }

    #[\ReturnTypeWillChange]
    public function fetchColumn($column = 0)
    {
        $row = $this->fetch();
        if ($row === false) {
            return false;
        }
        $values = array_values($row);
        return $values[$column] ?? false;
    }

    #[\ReturnTypeWillChange]
    public function rowCount()
    {
        return count($this->rows);
    }
}

class FakeDb extends PDO
{
    /** @var array<int,array{0:string,1:mixed}> */
    public static $patterns = [];
    /** @var array<int,array{sql:string,params:array}> */
    public static $log = [];
    /** @var array<int,string> */
    public static $unmatched = [];

    public function __construct()
    {
        // No parent::__construct — nothing connects anywhere.
    }

    #[\ReturnTypeWillChange]
    public function setAttribute($attribute, $value)
    {
        return true;
    }

    #[\ReturnTypeWillChange]
    public function prepare($sql, $options = [])
    {
        $flat = trim(preg_replace('/\s+/', ' ', (string) $sql));
        foreach (self::$patterns as [$pattern, $rows]) {
            if (preg_match($pattern, $flat)) {
                return new FakeStatement($flat, is_callable($rows) ? $rows($flat) : $rows);
            }
        }
        self::$unmatched[] = $flat;
        return new FakeStatement($flat, []);
    }

    #[\ReturnTypeWillChange]
    public function query($sql, ...$args)
    {
        return $this->prepare($sql);
    }

    #[\ReturnTypeWillChange]
    public function lastInsertId($name = null)
    {
        return '1';
    }
}
