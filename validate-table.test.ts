import { expect, test } from "bun:test";
import { validateTableName } from "./validate-table.ts";

// Why: table names are interpolated into SQL strings, so we must reject
// anything that could enable SQL injection (P0 from review).

test("accepts simple lowercase name", () => {
  // given a plain alpha table name
  // when validated
  // then no error
  expect(() => validateTableName("example")).not.toThrow();
});

test("accepts underscore-prefixed name", () => {
  expect(() => validateTableName("_private")).not.toThrow();
});

test("accepts mixed alphanumeric with underscores", () => {
  expect(() => validateTableName("my_table_2")).not.toThrow();
});

test("accepts single character", () => {
  expect(() => validateTableName("x")).not.toThrow();
});

test("accepts 256 character name", () => {
  const name = "a" + "b".repeat(255);
  expect(name.length).toBe(256);
  expect(() => validateTableName(name)).not.toThrow();
});

test("rejects empty string", () => {
  expect(() => validateTableName("")).toThrow("Invalid table name");
});

test("rejects name starting with digit", () => {
  expect(() => validateTableName("2fast")).toThrow("Invalid table name");
});

test("rejects name with spaces", () => {
  expect(() => validateTableName("my table")).toThrow("Invalid table name");
});

test("rejects name with dash", () => {
  expect(() => validateTableName("my-table")).toThrow("Invalid table name");
});

test("rejects name with semicolon (SQL injection)", () => {
  expect(() => validateTableName("x; DROP TABLE y--")).toThrow("Invalid table name");
});

test("rejects name with quotes", () => {
  expect(() => validateTableName('x"')).toThrow("Invalid table name");
  expect(() => validateTableName("x'")).toThrow("Invalid table name");
});

test("rejects name with parentheses", () => {
  expect(() => validateTableName("x()")).toThrow("Invalid table name");
});

test("rejects 257 character name", () => {
  const name = "a" + "b".repeat(256);
  expect(name.length).toBe(257);
  expect(() => validateTableName(name)).toThrow("Invalid table name");
});
