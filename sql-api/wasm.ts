import type { AbstractSql, SqlInput, SqlOutput } from "./api.ts";

const getSqlite = async () => {
  const url = new URL('/lib/sqlite.mjs', location.href).href;
  const mod = await import(/* @vite-ignore */ url);
  return mod.sqlite3Worker1Promiser;
};


export class WasmSqlApi implements AbstractSql {
  private worker: any;
  type: 'file' | 'remote' = 'file';
  private dbId: any;

  constructor(worker: any, dbId: any) {
    this.worker = worker;
    this.dbId = dbId;
  }


  async query(input: SqlInput): Promise<SqlOutput> {
    const result1 = await this.worker('exec',{
      sql: input.sql,
      bind: input.params,
      rowMode: 'object', // not the best option, fix later.
      dbId: this.dbId,
    });
    console.log('result1', result1);
    let {resultRows} = result1.result;
    const fields = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];
    const rows = resultRows.map((row: any) => {
      return fields.map((key) => row[key]);
    });

    return { rows, fields };
  }

  async close() {
    await this.worker('close', { dbId: this.dbId });
  }
}

export async function createWasmSqlApi(dbName: string): Promise<AbstractSql> {
  return create(dbName);
}

async function create(dbName: string): Promise<WasmSqlApi> {
  const sqlite3Worker1Promiser = await getSqlite();
  const promiser = await new Promise((resolve) => {
    const _promiser = sqlite3Worker1Promiser({
      onready: () => resolve(_promiser),
    } as any);
  }) as any;
  const configResponse = await promiser('config-get', {});
  console.log('Running SQLite3 version', configResponse.result.version.libVersion);
  const filename = dbName === ':memory:' ? ':memory:' : `file:${dbName}?vfs=opfs`;
  const openResponse = await promiser('open', { filename });
  const { dbId } = openResponse;
  const isOpfs = openResponse.result.filename.includes('vfs=opfs');
  console.log(isOpfs ? 'OPFS database:' : 'In-memory database:', openResponse.result.filename);
  return new WasmSqlApi(promiser, dbId);
}
