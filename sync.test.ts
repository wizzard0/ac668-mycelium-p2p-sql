import { expect, test } from "bun:test";
import { AbstractSql } from "./sql-api/api.ts";
import { BunSqlApi } from "./sql-api/bun.ts";
import { MakeMockRecords, CreateExampleTable } from "./mock-data.ts";
import { GetSequences, GetSequencesToSync } from "./sync.ts";

test("GetSequences after MakeMockRecords", async () => {
  let api: AbstractSql = new BunSqlApi(":memory:");
  
  try {
    const testNode = "testNode";
    await MakeMockRecords(testNode, api, 'example');

    const sequences = await GetSequences(api,'example');

    expect(Object.keys(sequences).length).toBe(1);
    expect(sequences[testNode]).toBe(2);
  } finally {
    (api as BunSqlApi).close();
  }
});

test("GetSequencesToSync with empty and non-empty databases", async () => {
  let dbWithRecords: AbstractSql = new BunSqlApi(":memory:");
  let emptyDb: AbstractSql = new BunSqlApi(":memory:");
  
  try {
    const testNode = "testNode";
    await MakeMockRecords(testNode, dbWithRecords, 'example');
    await CreateExampleTable(emptyDb, 'example');

    // Check GetSequencesToSync for two identical databases
    let syncRanges = await GetSequencesToSync(dbWithRecords, dbWithRecords,'example');
    expect(syncRanges.length).toBe(0);

    syncRanges = await GetSequencesToSync(emptyDb, emptyDb,'example');
    expect(syncRanges.length).toBe(0);

    // Check GetSequencesToSync for dbWithRecords against itself
    syncRanges = await GetSequencesToSync(dbWithRecords, dbWithRecords,'example');
    expect(syncRanges.length).toBe(0);

    // Check GetSequencesToSync for empty and non-empty databases
    syncRanges = await GetSequencesToSync(dbWithRecords, emptyDb,'example');
    expect(syncRanges.length).toBe(1);
    expect(syncRanges[0]).toEqual({
      node: testNode,
      start: 1,
      end: 2,
      direction: 'source_to_target'
    });

    syncRanges = await GetSequencesToSync(emptyDb, dbWithRecords,'example');
    expect(syncRanges.length).toBe(1);
    expect(syncRanges[0]).toEqual({
      node: testNode,
      start: 1,
      end: 2,
      direction: 'target_to_source'
    });
  } finally {
    (dbWithRecords as BunSqlApi).close();
    (emptyDb as BunSqlApi).close();
  }
});
