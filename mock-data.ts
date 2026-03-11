import {AbstractSql, SyncableRecord} from "./sql-api/api.ts";

export interface ExampleRecord extends SyncableRecord {
  data: string;
}

async function insertExampleRecord(target: AbstractSql, record: ExampleRecord,table:string): Promise<void> {
  await target.query({
    sql: `INSERT INTO ${table} (node, seq, oid, time, data) VALUES (?, ?, ?, ?, ?)`,
    params: [record.node, record.seq, record.oid, record.time, record.data]
  });
}

export async function CreateExampleTable(target: AbstractSql, table: string): Promise<void> {
  await target.query({
    sql: `CREATE TABLE IF NOT EXISTS ${table} (
      node TEXT,
      seq INTEGER,
      oid TEXT,
      time INTEGER,
      data TEXT
    )`,
    params: []
  });
}

export async function InsertMockRecords(node: string, target: AbstractSql, table: string): Promise<void> {
  const record1: ExampleRecord = {
    node,
    seq: 1,
    oid: '1',
    time: Date.now(),
    data: '{"hello":1}'
  };

  const record2: ExampleRecord = {
    node,
    seq: 2,
    oid: '2',
    time: Date.now(),
    data: '{"world":1}'
  };

  await insertExampleRecord(target, record1, table);
  await insertExampleRecord(target, record2, table);
}

export async function MakeMockRecords(node: string, target: AbstractSql, table: string): Promise<void> {
  await CreateExampleTable(target, table);
  await InsertMockRecords(node, target, table);
}
