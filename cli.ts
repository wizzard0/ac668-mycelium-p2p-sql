import {AbstractSql} from "./sql-api/api.ts";
import {CreateExampleTable} from "./mock-data";
import {SyncTables} from "./full";
import {getAbstractSql} from "./get-abstract-sql.ts";

async function main() {
  if (process.argv.length !== 5) {
    console.error("Usage: bun run cli.ts sync <db1_path_or_url> <db2_path_or_url>");
    process.exit(1);
  }

  const action = process.argv[2];
  const db1Source = process.argv[3];
  const db2Source = process.argv[4];

  if (action === "sync") {
    await syncDatabases(db1Source, db2Source);
  } else {
    console.error("Invalid action. Available action: sync");
    process.exit(1);
  }
}

async function syncDatabases(db1Source: string, db2Source: string) {
  let db1: AbstractSql = getAbstractSql(db1Source);
  let db2: AbstractSql = getAbstractSql(db2Source);

  try {
    // Initialize tables if they don't exist (only for local databases)
    if (db1.type === 'file') {
      await CreateExampleTable(db1, 'example');
    }
    if (db2.type === 'file') {
      await CreateExampleTable(db2, 'example');
    }

    // Sync the tables
    await SyncTables(db1, db2, console.log, 'example');

    console.log("Synchronization completed successfully.");
  } catch (error) {
    console.error("An error occurred during synchronization:", error);
  } finally {
    // Close connections for both local and remote databases
    db1.close();
    db2.close();
  }
}

main();
