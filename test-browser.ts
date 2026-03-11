import { createWasmSqlApi } from './sql-api/wasm.ts';
import { CreateExampleTable } from './mock-data.ts';
import { GetRemote } from './sql-api/remote.ts';
import { SyncTables } from './full.ts';

const status = document.getElementById('status')!;
const log = (msg: string) => { status.textContent = msg; console.log(msg); };

async function main() {
  try {
    log('Creating WASM SQLite...');
    const localDb = await createWasmSqlApi(':memory:');

    log('Creating local table...');
    await CreateExampleTable(localDb, 'test_table');

    log('Inserting browser data...');
    await localDb.query({
      sql: 'INSERT INTO test_table VALUES (?, ?, ?, ?, ?)',
      params: ['browser-node', 1, 'b1', Date.now(), '{"from":"browser"}']
    });

    log('Connecting to remote...');
    const remoteDb = GetRemote('');

    log('Syncing...');
    await SyncTables(localDb, remoteDb, log, 'test_table');

    const result = await localDb.query({sql: 'SELECT * FROM test_table', params: []});
    (window as any).__BROWSER_ROWS__ = result.rows;
    log('Sync complete: ' + result.rows.length + ' rows');
  } catch (e: any) {
    log('Error: ' + e.message);
    console.error(e);
  }
}

main();
