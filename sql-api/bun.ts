import { Database } from "bun:sqlite";
import type { AbstractSql, SqlInput, SqlOutput } from "./api.ts";

export class BunSqlApi implements AbstractSql {
  private db: Database;
  type: 'file' | 'remote' = 'file';

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.setJournalMode();
  }

  private setJournalMode() {
    this.db.exec("PRAGMA journal_mode=WAL");
  }

  async query(input: SqlInput): Promise<SqlOutput> {
    const statement = this.db.prepare(input.sql);
    const result = statement.all(...input.params);

    // Get field information
    const fields = statement.columnNames.map(column => ({ name: column }));

    // Convert result to rows
    const rows = Array.isArray(result) ? result.map(r => Object.values(r as Record<string, unknown>)) : [Object.values(result as Record<string, unknown>)];

    return { rows, fields };
  }

  close() {
    this.db.close();
  }
}
