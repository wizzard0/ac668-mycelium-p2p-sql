import { AbstractSql } from "./sql-api/api.ts";
import { SequenceRange } from "./sync.ts";
import {ExampleRecord} from "./mock-data.ts";

export async function GetDataToCopy<T extends ExampleRecord>(source: AbstractSql, range: SequenceRange, table:string): Promise<T[]> {
  const { node, start, end } = range;
  
  const result = await source.query({
    sql: `SELECT node, seq, oid, time, data FROM ${table} 
          WHERE node = ? AND seq >= ? AND seq <= ? 
          ORDER BY seq`,
    params: [node, start, end]
  });

  return result.rows.map(row => ({
    node: row[0],
    seq: row[1],
    oid: row[2],
    time: row[3],
    data: row[4]
  } as T));
}

export async function InsertRecords(target: AbstractSql, records: ExampleRecord[],table:string): Promise<void> {
  for (const record of records) {
    await target.query({
      sql: `INSERT INTO ${table} (node, seq, oid, time, data)
            VALUES (?, ?, ?, ?, ?)`,
      params: [
        record.node, record.seq, record.oid, record.time, record.data
      ]
    });
  }
}
