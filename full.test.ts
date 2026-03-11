import { expect, test } from "bun:test";
import { AbstractSql } from "./sql-api/api.ts";
import { BunSqlApi } from "./sql-api/bun.ts";
import { CreateExampleTable, InsertMockRecords } from "./mock-data";
import { SyncTables } from "./full";

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
