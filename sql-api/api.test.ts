import { expect, test } from "bun:test";
import { AbstractSql, MockApi } from "./api.ts";
import { BunSqlApi } from "./bun.ts";
import { unlinkSync } from "fs";
import {MakeMockRecords} from "../mock-data.ts";

test("sync api liveness", async () => {
  let api: AbstractSql = MockApi();
  let one = await api.query({ sql: 'select 1', params: [] });
  expect(one.rows.length == 1).toBe(true);
  expect(one.fields.length == 1).toBe(true);
  expect(one.rows[0][0] == 1).toBe(true);
});

test("BunSqlApi liveness", async () => {
  let api: AbstractSql = new BunSqlApi(":memory:");
  
  try {
    let one = await api.query({ sql: 'select 1', params: [] });
    expect(one.rows.length == 1).toBe(true);
    expect(one.fields.length == 1).toBe(true);
    expect(one.rows[0][0] == 1).toBe(true);
  } finally {
    (api as BunSqlApi).close();
  }
});

test("MakeMockRecords and retrieve", async () => {
  let api: AbstractSql = new BunSqlApi(":memory:");
  
  try {
    const testNode = "testNode";
    await MakeMockRecords(testNode, api,'example');

    // Retrieve and check the records
    const result = await api.query({
      sql: "SELECT * FROM example ORDER BY seq",
      params: []
    });

    expect(result.rows.length).toBe(2);
    expect(result.fields.length).toBe(5);

    // Check the first record
    expect(result.rows[0][0]).toBe(testNode);
    expect(result.rows[0][1]).toBe(1);
    expect(result.rows[0][2]).toBe("1");
    expect(typeof result.rows[0][3]).toBe("number");
    expect(result.rows[0][4]).toBe('{"hello":1}');

    // Check the second record
    expect(result.rows[1][0]).toBe(testNode);
    expect(result.rows[1][1]).toBe(2);
    expect(result.rows[1][2]).toBe("2");
    expect(typeof result.rows[1][3]).toBe("number");
    expect(result.rows[1][4]).toBe('{"world":1}');

  } finally {
    (api as BunSqlApi).close();
  }
});
