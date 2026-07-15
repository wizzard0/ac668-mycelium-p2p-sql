import { expect, test } from "bun:test";
import { AbstractSql, SqlInput } from "./sql-api/api.ts";
import { BunSqlApi } from "./sql-api/bun.ts";
import { CreateExampleTable, InsertMockRecords, ExampleRecord } from "./mock-data";
import { InsertRecords } from "./copy.ts";
import { SyncTables, SyncTablesOneWay, SYNC_PAGE_SIZE } from "./full";

async function seedSequentialRecords(db: AbstractSql, node: string, startSeq: number, count: number): Promise<void> {
  const records: ExampleRecord[] = [];
  for (let i = 0; i < count; i++) {
    const seq = startSeq + i;
    records.push({ node, seq, oid: String(seq), time: 1000 + seq, data: `{"n":${seq}}` });
  }
  await InsertRecords(db, records, 'example');
}

// Passthrough wrapper that records the largest result set any single query returned.
function trackLargestRead(inner: AbstractSql, largest: { rows: number }): AbstractSql {
  return {
    type: inner.type,
    query: async (input: SqlInput) => {
      const out = await inner.query(input);
      if (out.rows.length > largest.rows) largest.rows = out.rows.length;
      return out;
    },
    close: () => {},
  };
}

// Simulates the reader process dying: allows `allowedBatches` INSERT statements
// through, then throws on every later INSERT.
function crashAfterInsertBatches(inner: AbstractSql, allowedBatches: number): AbstractSql {
  let batches = 0;
  return {
    type: inner.type,
    query: async (input: SqlInput) => {
      if (input.sql.trimStart().toUpperCase().startsWith("INSERT")) {
        if (batches >= allowedBatches) throw new Error("simulated crash");
        batches++;
      }
      return inner.query(input);
    },
    close: () => {},
  };
}

// Simulates a writer committing new rows while a sync pass is mid-flight:
// runs `inject` once, just before the first page read is served.
function injectWritesBeforeFirstPageRead(inner: AbstractSql, inject: () => Promise<void>): AbstractSql {
  let injected = false;
  return {
    type: inner.type,
    query: async (input: SqlInput) => {
      if (!injected && input.sql.includes("ORDER BY seq")) {
        injected = true;
        await inject();
      }
      return inner.query(input);
    },
    close: () => {},
  };
}

test("SyncTables with different records in each database", async () => {
  let db1: AbstractSql = new BunSqlApi(":memory:");
  let db2: AbstractSql = new BunSqlApi(":memory:");
  
  try {
    // Set up tables in both databases
    await CreateExampleTable(db1,'example');
    await CreateExampleTable(db2,'example');

    // Insert different records in each database
    await InsertMockRecords("node1", db1,'example');
    await InsertMockRecords("node2", db2,'example');

    // Perform the sync once
    await SyncTables(db1, db2, (message: string) => {}, 'example');

    // After the initial run, both databases should be identical
    const checkQuery = "SELECT * FROM example ORDER BY node, seq";
    const resultAfterFirstRun1 = await db1.query({ sql: checkQuery, params: [] });
    const resultAfterFirstRun2 = await db2.query({ sql: checkQuery, params: [] });

    expect(resultAfterFirstRun1.rows).toEqual(resultAfterFirstRun2.rows);
    expect(resultAfterFirstRun1.rows.length).toBe(4); // 2 records from each original database

    // Run the sync again to verify that calling SyncTables twice does not
    // create any additional records. This ensures the operation is idempotent.
    await SyncTables(db1, db2, (message: string) => {}, 'example');

    // After the second run, verify that both databases remain identical
    const resultAfterSecondRun1 = await db1.query({ sql: checkQuery, params: [] });
    const resultAfterSecondRun2 = await db2.query({ sql: checkQuery, params: [] });

    expect(resultAfterSecondRun1.rows).toEqual(resultAfterSecondRun2.rows);
    expect(resultAfterSecondRun1.rows.length).toBe(4); // still only 4 records

    // Check specific content
    const expectedNodes = ["node1", "node1", "node2", "node2"];
    const expectedSeqs = [1, 2, 1, 2];
    const expectedData = ['{"hello":1}', '{"world":1}', '{"hello":1}', '{"world":1}'];

    for (let i = 0; i < 4; i++) {
      expect(resultAfterSecondRun1.rows[i][0]).toBe(expectedNodes[i]); // node
      expect(resultAfterSecondRun1.rows[i][1]).toBe(expectedSeqs[i]);  // seq
      expect(resultAfterSecondRun1.rows[i][4]).toBe(expectedData[i]);  // data
    }

  } finally {
    (db1 as BunSqlApi).close();
    (db2 as BunSqlApi).close();
  }
});

test("SyncTables paginates: no single read exceeds SYNC_PAGE_SIZE rows", async () => {
  // why: SY-pagul — a cold replica catching up must never buffer a whole
  // backlog in one query result / one HTTP response.
  const db1: AbstractSql = new BunSqlApi(":memory:");
  const db2: AbstractSql = new BunSqlApi(":memory:");
  try {
    // given: source is 2.5 pages ahead, target is empty
    await CreateExampleTable(db1, 'example');
    await CreateExampleTable(db2, 'example');
    await seedSequentialRecords(db1, "node1", 1, 2500);
    const largest = { rows: 0 };
    const messages: string[] = [];

    // when: syncing with the source instrumented to record read sizes
    await SyncTables(trackLargestRead(db1, largest), db2, (m: string) => messages.push(m), 'example');

    // then: every row arrived, exactly once
    const res = await db2.query({
      sql: "SELECT count(*), count(DISTINCT seq), min(seq), max(seq) FROM example WHERE node = 'node1'",
      params: []
    });
    expect(res.rows[0]).toEqual([2500, 2500, 1, 2500]);

    // then: reads were paginated — 1000 + 1000 + 500, never more per query
    expect(largest.rows).toBeLessThanOrEqual(SYNC_PAGE_SIZE);
    expect(messages.filter(m => m.startsWith("Copied")).length).toBe(3);
  } finally {
    (db1 as BunSqlApi).close();
    (db2 as BunSqlApi).close();
  }
});

test("SyncTables terminates when the range is an exact multiple of the page size", async () => {
  // why: SY-pagul — the page loop must stop cleanly when the final page is
  // exactly full, without an extra empty read or an infinite loop.
  const db1: AbstractSql = new BunSqlApi(":memory:");
  const db2: AbstractSql = new BunSqlApi(":memory:");
  try {
    // given: source is exactly 2 pages ahead
    await CreateExampleTable(db1, 'example');
    await CreateExampleTable(db2, 'example');
    await seedSequentialRecords(db1, "node1", 1, 2 * SYNC_PAGE_SIZE);
    const messages: string[] = [];

    // when: syncing twice (second run checks idempotency)
    await SyncTables(db1, db2, (m: string) => messages.push(m), 'example');
    await SyncTables(db1, db2, () => {}, 'example');

    // then: exactly two full pages were copied and nothing was duplicated
    expect(messages.filter(m => m.startsWith("Copied")).length).toBe(2);
    const res = await db2.query({ sql: "SELECT count(*), count(DISTINCT seq) FROM example", params: [] });
    expect(res.rows[0]).toEqual([2 * SYNC_PAGE_SIZE, 2 * SYNC_PAGE_SIZE]);
  } finally {
    (db1 as BunSqlApi).close();
    (db2 as BunSqlApi).close();
  }
});

test("crash after first insert batch under concurrent writes: fresh sync converges from DB state alone", async () => {
  // why: SY-kotad, SY-vimon — reader and writer can both die mid-sync. Recovery
  // must rely only on what is durably in the databases (per-node max(seq) +
  // contiguous-prefix inserts), never on an in-memory cursor. A gap below the
  // target's max(seq) would never be re-requested, so none may ever exist.
  const db1: AbstractSql = new BunSqlApi(":memory:");
  const db2: AbstractSql = new BunSqlApi(":memory:");
  try {
    // given: source has 2500 committed rows; a writer commits 50 more while the
    // first sync pass is mid-flight; the reader dies after its first 100-row
    // INSERT batch lands on the target
    await CreateExampleTable(db1, 'example');
    await CreateExampleTable(db2, 'example');
    await seedSequentialRecords(db1, "node1", 1, 2500);
    const source = injectWritesBeforeFirstPageRead(db1, () => seedSequentialRecords(db1, "node1", 2501, 50));
    const target = crashAfterInsertBatches(db2, 1);

    // when: the first sync pass crashes
    await expect(SyncTables(source, target, () => {}, 'example')).rejects.toThrow("simulated crash");

    // then: the target holds a contiguous prefix — exactly the first batch
    const afterCrash = await db2.query({
      sql: "SELECT count(*), count(DISTINCT seq), max(seq) FROM example",
      params: []
    });
    expect(afterCrash.rows[0]).toEqual([100, 100, 100]);

    // given: the writer appends 50 more rows, then dies too
    await seedSequentialRecords(db1, "node1", 2551, 50);

    // when: both processes restart — plain handles, no shared in-memory state
    await SyncTables(db1, db2, () => {}, 'example');

    // then: every committed row is present exactly once, no gaps
    const final = await db2.query({
      sql: "SELECT count(*), count(DISTINCT seq), min(seq), max(seq) FROM example WHERE node = 'node1'",
      params: []
    });
    expect(final.rows[0]).toEqual([2600, 2600, 1, 2600]);

    // then: another sync is a no-op
    await SyncTables(db1, db2, () => {}, 'example');
    const again = await db2.query({ sql: "SELECT count(*) FROM example", params: [] });
    expect(again.rows[0][0]).toBe(2600);
  } finally {
    (db1 as BunSqlApi).close();
    (db2 as BunSqlApi).close();
  }
});

test("SyncTablesOneWay copies from→to and never the reverse", async () => {
  // why: SY-ronuk — replicas can be pull-only or push-only (e.g. don't write
  // into a production node, or don't take rows from an untrusted one). The
  // one-way primitive must leave `from` untouched.
  const db1: AbstractSql = new BunSqlApi(":memory:");
  const db2: AbstractSql = new BunSqlApi(":memory:");
  try {
    // given: each side has rows the other lacks
    await CreateExampleTable(db1, 'example');
    await CreateExampleTable(db2, 'example');
    await InsertMockRecords("node1", db1, 'example');
    await InsertMockRecords("node2", db2, 'example');

    // when: syncing one way, twice (idempotency)
    await SyncTablesOneWay(db1, db2, () => {}, 'example');
    await SyncTablesOneWay(db1, db2, () => {}, 'example');

    // then: db2 gained db1's rows; db1 did NOT gain db2's rows
    const r2 = await db2.query({ sql: "SELECT count(*) FROM example", params: [] });
    expect(r2.rows[0]![0]).toBe(4);
    const r1 = await db1.query({ sql: "SELECT node, count(*) FROM example GROUP BY node", params: [] });
    expect(r1.rows).toEqual([["node1", 2]]);
  } finally {
    (db1 as BunSqlApi).close();
    (db2 as BunSqlApi).close();
  }
});

test("SyncTablesOneWay paginates large one-way ranges", async () => {
  // why: SY-ronuk — one-way sync must inherit the paginated, crash-safe copy.
  const db1: AbstractSql = new BunSqlApi(":memory:");
  const db2: AbstractSql = new BunSqlApi(":memory:");
  try {
    // given: from-side is 1.5 pages ahead
    await CreateExampleTable(db1, 'example');
    await CreateExampleTable(db2, 'example');
    await seedSequentialRecords(db1, "node1", 1, SYNC_PAGE_SIZE + 500);
    const messages: string[] = [];

    // when: one-way sync
    await SyncTablesOneWay(db1, db2, (m: string) => messages.push(m), 'example');

    // then: all rows arrive in two pages
    const res = await db2.query({ sql: "SELECT count(*), count(DISTINCT seq) FROM example", params: [] });
    expect(res.rows[0]).toEqual([SYNC_PAGE_SIZE + 500, SYNC_PAGE_SIZE + 500]);
    expect(messages.filter(m => m.startsWith("Copied")).length).toBe(2);
  } finally {
    (db1 as BunSqlApi).close();
    (db2 as BunSqlApi).close();
  }
});
