import { AbstractSql } from "./sql-api/api.ts";
import { createWasmSqlApi, WasmSqlApi } from "./sql-api/wasm.ts";
import { CreateExampleTable } from "./mock-data.ts";
import { SyncTables } from "./full.ts";
import { GetRemote } from "./sql-api/remote.ts";
import { validateTableName } from "./validate-table.ts";

let dbInstance: AbstractSql | null = null;
let dbInitPromise: Promise<AbstractSql> | null = null;

/**
 * @param dbFileName like "/p4804.sqlite3"
 * @constructor
 */
export async function InitSql(dbFileName:string): Promise<AbstractSql> {
  if (dbInstance) {
    return dbInstance;
  }
  if (dbInitPromise) {
    return dbInitPromise;
  }
  dbInitPromise = createWasmSqlApi(dbFileName).then(async (db) => {
    await CreateExampleTable(db, "example");
    dbInstance = db;
    dbInitPromise = null;
    return db;
  });
  return dbInitPromise;
}

let alreadySyncing=false;

const tableMessage = (workspaceId: string, addMessage: (message: string) => void) =>
  (message: string) => addMessage(`[${workspaceId}] ${message}`);

const base64Encode = (value: string) => {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(unescape(encodeURIComponent(value)));
  }
  const buffer = (globalThis as any)?.Buffer;
  if (buffer?.from) {
    return buffer.from(value, 'utf-8').toString('base64');
  }
  throw new Error('No base64 encoder available');
};

export const workspaceResyncTopic = (workspaceId: string) =>
  `ac888flower_ws_change_${base64Encode(workspaceId).replaceAll('=','').replaceAll('+','-').replaceAll('/','_')}`;

const notifyWorkspaceResync = async (
  workspaceId: string,
  nodeId: string,
  addMessage: (message: string) => void,
) => {
  if (typeof fetch !== 'function') {
    addMessage('Failed to notify ntfy: fetch unavailable');
    return;
  }
  const topic = workspaceResyncTopic(workspaceId);
  try {
    const response = await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      body: JSON.stringify({src: nodeId, at: Date.now()}),
      headers: {'Content-Type': 'text/plain'},
    });
    if (!response.ok) {
      addMessage(`Failed to notify ntfy: ${response.status}`);
    } else {
      addMessage(`Notified ntfy for ${workspaceId}`);
    }
  } catch (error) {
    const message = (error as any)?.message || String(error);
    addMessage(`Failed to notify ntfy: ${message}`);
  }
};

export let browserFilename = "/p4804.sqlite3"
export function setBrowserFilename(filename: string){
  browserFilename = filename;
}

export async function SyncBrowser(
  workspaces: string[],
  addMessage: (message: string) => void,
  url: string,
  nodeId: string,
): Promise<void> {
  if (!workspaces || workspaces.length === 0) {
    addMessage('No workspaces requested for synchronization.');
    return;
  }
  if(alreadySyncing) {
    addMessage('alreadySyncing');
    return;
  }
  alreadySyncing = true;
  const localDb = await InitSql(browserFilename);

  try {
    for (const workspace of workspaces) {
      if (!workspace) {
        addMessage('Skipping workspace sync due to missing workspace id.');
        continue;
      }
      validateTableName(workspace);
      const remoteDb = GetRemote(url);
      addMessage(`Syncing workspace ${workspace} via ${url}`);
      await CreateExampleTable(localDb, workspace);
      await CreateExampleTable(remoteDb, workspace);
      const ranges = await SyncTables(localDb, remoteDb, tableMessage(workspace, addMessage), workspace);
      if (ranges.length && nodeId) {
        await notifyWorkspaceResync(workspace, nodeId, addMessage);
      }
    }
    addMessage("Synchronization completed successfully.");
  } catch (error) {
    const message = (error as Error).message;
    addMessage(`An error occurred during synchronization: ${message}`);
  } finally {
    alreadySyncing = false;
  }
}
