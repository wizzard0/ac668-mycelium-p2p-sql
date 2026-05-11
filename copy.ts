import type { AbstractSql } from "./sql-api/api.ts";
import type { SequenceRange } from "./sync.ts";
import type { ExampleRecord } from "./mock-data.ts";

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

const BATCH_SIZE = 100;

export async function InsertRecords(target: AbstractSql, records: ExampleRecord[],table:string): Promise<void> {
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const params: (string | number | null)[] = [];
    for (const r of batch) params.push(r.node, r.seq, r.oid, r.time, r.data);
    await target.query({
      sql: `INSERT OR IGNORE INTO ${table} (node, seq, oid, time, data) VALUES ${placeholders}`,
      params,
    });
  }
}
