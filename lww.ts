import { AbstractSql, SyncableRecord } from "./sql-api/api.ts";
import { validateTableName } from "./validate-table.ts";

export interface LWWRecord extends SyncableRecord {
  data: Record<string, unknown>;
}

const JSON_KEY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateJsonKeys(args: Record<string, string | number>): void {
  for (const key of Object.keys(args)) {
    if (!JSON_KEY_RE.test(key)) {
      throw new Error(`Invalid JSON field name: ${JSON.stringify(key)}`);
    }
  }
}

function parseRow(row: unknown[]): LWWRecord {
  return { node: row[0] as string, seq: row[1] as number, oid: row[2] as string, time: row[3] as number, data: JSON.parse(row[4] as string) };
}

export async function queryLWWByOid(db: AbstractSql, table: string, oid: string): Promise<LWWRecord | null> {
  validateTableName(table);
  const result = await db.query({
    sql: `SELECT node, seq, oid, time, data FROM ${table} WHERE oid = ? ORDER BY time DESC LIMIT 1`,
    params: [oid]
  });
  if (result.rows.length === 0) return null;
  return parseRow(result.rows[0]);
}

export async function queryLWW(db: AbstractSql, table: string, exactArgs: Record<string, string | number>): Promise<LWWRecord[]> {
  validateTableName(table);
  validateJsonKeys(exactArgs);
  const keys = Object.keys(exactArgs);
  const jsonClauses = keys.map(k => `json_extract(data, '$.${k}') = ?`).join(" AND ");
  const where = jsonClauses ? ` AND ${jsonClauses}` : "";
  const params = keys.map(k => exactArgs[k]);
  const result = await db.query({
    sql: `SELECT node, seq, oid, time, data FROM ${table} WHERE (oid, time) IN (SELECT oid, MAX(time) FROM ${table} GROUP BY oid)${where}`,
    params
  });
  return result.rows.map(parseRow);
}
