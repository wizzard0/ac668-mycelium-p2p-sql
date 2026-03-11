import { expect, test } from "bun:test";
import { BunSqlApi } from "./sql-api/bun.ts";
import { CreateExampleTable } from "./mock-data.ts";
import { queryLWWByOid, queryLWW } from "./lww.ts";

// Why: LWW (last-writer-wins) query gives the latest state of each object
// by MAX(time), with optional json_extract filtering on data fields.

function insert(db: BunSqlApi, table: string, node: string, seq: number, oid: string, time: number, data: string) {
  return db.query({ sql: `INSERT INTO ${table} (node, seq, oid, time, data) VALUES (?, ?, ?, ?, ?)`, params: [node, seq, oid, time, data] });
}

test("queryLWWByOid returns latest record by time", async () => {
  // given two writes to the same oid at different times
  const db = new BunSqlApi(":memory:");
  try {
    await CreateExampleTable(db, "t");
    await insert(db, "t", "n1", 1, "obj1", 100, '{"v":1}');
    await insert(db, "t", "n2", 1, "obj1", 200, '{"v":2}');
    // when querying LWW for that oid
    const result = await queryLWWByOid(db, "t", "obj1");
    // then the later write wins
    expect(result).not.toBeNull();
    expect(result!.time).toBe(200);
    expect(result!.data).toEqual({ v: 2 });
    expect(result!.node).toBe("n2");
  } finally {
    db.close();
  }
});

test("queryLWWByOid returns null for missing oid", async () => {
  const db = new BunSqlApi(":memory:");
  try {
    await CreateExampleTable(db, "t");
    const result = await queryLWWByOid(db, "t", "missing");
    expect(result).toBeNull();
  } finally {
    db.close();
  }
});

test("queryLWW returns latest record per oid", async () => {
  // given two oids each with two writes
  const db = new BunSqlApi(":memory:");
  try {
    await CreateExampleTable(db, "t");
    await insert(db, "t", "n1", 1, "a", 100, '{"x":1}');
    await insert(db, "t", "n1", 2, "a", 300, '{"x":2}');
    await insert(db, "t", "n2", 1, "b", 200, '{"x":3}');
    await insert(db, "t", "n2", 2, "b", 400, '{"x":4}');
    // when querying LWW with no filter
    const results = await queryLWW(db, "t", {});
    // then one record per oid, the latest
    expect(results.length).toBe(2);
    const byOid = Object.fromEntries(results.map(r => [r.oid, r]));
    expect(byOid["a"].time).toBe(300);
    expect(byOid["a"].data).toEqual({ x: 2 });
    expect(byOid["b"].time).toBe(400);
    expect(byOid["b"].data).toEqual({ x: 4 });
  } finally {
    db.close();
  }
});

test("queryLWW filters by json fields", async () => {
  // given objects with different types
  const db = new BunSqlApi(":memory:");
  try {
    await CreateExampleTable(db, "t");
    await insert(db, "t", "n1", 1, "u1", 100, '{"type":"user","name":"alice"}');
    await insert(db, "t", "n1", 2, "u2", 200, '{"type":"user","name":"bob"}');
    await insert(db, "t", "n1", 3, "p1", 300, '{"type":"post","title":"hello"}');
    // when filtering by type=user
    const users = await queryLWW(db, "t", { type: "user" });
    // then only user records returned
    expect(users.length).toBe(2);
    expect(users.every(r => r.data.type === "user")).toBe(true);
    // when filtering by type=post
    const posts = await queryLWW(db, "t", { type: "post" });
    expect(posts.length).toBe(1);
    expect(posts[0].oid).toBe("p1");
  } finally {
    db.close();
  }
});

test("queryLWW filters combine LWW and json fields", async () => {
  // given an object that changes type over time
  const db = new BunSqlApi(":memory:");
  try {
    await CreateExampleTable(db, "t");
    await insert(db, "t", "n1", 1, "x", 100, '{"state":"active"}');
    await insert(db, "t", "n1", 2, "x", 200, '{"state":"archived"}');
    // when filtering for active objects
    const active = await queryLWW(db, "t", { state: "active" });
    // then x is excluded because its latest state is archived
    expect(active.length).toBe(0);
    const archived = await queryLWW(db, "t", { state: "archived" });
    expect(archived.length).toBe(1);
  } finally {
    db.close();
  }
});

test("queryLWW rejects invalid json key", async () => {
  const db = new BunSqlApi(":memory:");
  try {
    await CreateExampleTable(db, "t");
    expect(() => queryLWW(db, "t", { "bad key": "v" })).toThrow("Invalid JSON field name");
    expect(() => queryLWW(db, "t", { "'; DROP TABLE": "v" })).toThrow("Invalid JSON field name");
  } finally {
    db.close();
  }
});
