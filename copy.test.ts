import { expect, test } from "bun:test";
import { BunSqlApi } from "./sql-api/bun.ts";
import { CreateExampleTable, InsertMockRecords } from "./mock-data.ts";
import { GetDataToCopy, InsertRecords } from "./copy.ts";
import { SequenceRange } from "./sync.ts";

test("GetDataToCopy returns correct rows", async () => {
  const db = new BunSqlApi(":memory:");
  try {
    await CreateExampleTable(db,'example');
    await InsertMockRecords("node1", db,'example');
    const range: SequenceRange = { node: "node1", start: 1, end: 1, direction: 'source_to_target' };
    const rows = await GetDataToCopy(db, range,'example', 1000);
    expect(rows.length).toBe(1);
    expect(rows[0].seq).toBe(1);
    expect(rows[0].data).toBe('{"hello":1}');
  } finally {
    db.close();
  }
});

test("GetDataToCopy returns at most limit rows, lowest seq first", async () => {
  // why: SY-pagul — sync reads must be bounded; the pagination loop relies on
  // getting the lowest remaining seqs so the cursor can advance without gaps.
  const db = new BunSqlApi(":memory:");
  try {
    // given: 5 rows for one node
    await CreateExampleTable(db,'example');
    await InsertRecords(db, [1, 2, 3, 4, 5].map(seq => (
      { node: "node1", seq, oid: String(seq), time: seq, data: `d${seq}` }
    )),'example');
    const range: SequenceRange = { node: "node1", start: 1, end: 5, direction: 'source_to_target' };

    // when: reading with a limit smaller than the range
    const firstPage = await GetDataToCopy(db, range,'example', 2);

    // then: only the first two seqs come back, in order
    expect(firstPage.map(r => r.seq)).toEqual([1, 2]);

    // when: reading the rest with a limit larger than what remains
    const rest = await GetDataToCopy(db, { ...range, start: 3 },'example', 100);

    // then: everything remaining comes back
    expect(rest.map(r => r.seq)).toEqual([3, 4, 5]);
  } finally {
    db.close();
  }
});

test("GetDataToCopy rejects a non-positive limit", async () => {
  // why: SY-pagul — a limit of 0 would make the pagination loop spin forever;
  // fail fast instead.
  const db = new BunSqlApi(":memory:");
  try {
    await CreateExampleTable(db,'example');
    const range: SequenceRange = { node: "node1", start: 1, end: 5, direction: 'source_to_target' };
    await expect(GetDataToCopy(db, range,'example', 0)).rejects.toThrow("limit");
  } finally {
    db.close();
  }
});

test("InsertRecords adds rows to table", async () => {
  const db = new BunSqlApi(":memory:");
  try {
    await CreateExampleTable(db,'example');
    await InsertRecords(db, [
      { node: "n", seq: 1, oid: "1", time: 0, data: "foo" },
      { node: "n", seq: 2, oid: "2", time: 0, data: "bar" }
    ],'example');
    const res = await db.query({ sql: "SELECT node, seq, oid, time, data FROM example ORDER BY seq", params: [] });
    expect(res.rows).toEqual([
      ["n", 1, "1", 0, "foo"],
      ["n", 2, "2", 0, "bar"]
    ]);
  } finally {
    db.close();
  }
});
