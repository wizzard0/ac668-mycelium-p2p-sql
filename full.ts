import type { AbstractSql } from "./sql-api/api.ts";
import { GetSequencesToSync } from "./sync.ts";
import type { SequenceRange } from "./sync.ts";
import { GetDataToCopy, InsertRecords } from "./copy.ts";
import { validateTableName } from "./validate-table.ts";

export async function SyncTables(source: AbstractSql, target: AbstractSql, addMessage: (message: string) => void, table: string): Promise<SequenceRange[]> {
    validateTableName(table);
    // Step 1: Get the ranges to sync
    addMessage("Getting sequences to sync..." + new Date().toISOString().substring(11, 19));
    const rangesToSync = await GetSequencesToSync(source, target,table);
    addMessage(`Found ${rangesToSync.length} ranges to sync.`);

    // Step 2: Copy data for each range
    for (const range of rangesToSync) {
        addMessage(`Syncing range: ${JSON.stringify(range)}`);
        if (range.direction === 'source_to_target') {
            await copyRange(source, target, range, addMessage, table);
        } else {
            await copyRange(target, source, range, addMessage, table);
        }
    }
    return rangesToSync;
}

async function copyRange(from: AbstractSql, to: AbstractSql, range: SequenceRange, addMessage: (message: string) => void, table: string): Promise<void> {
    // Get data from the source
    addMessage(`Getting data to copy for range: ${JSON.stringify(range)}`);
    const records = await GetDataToCopy(from, range,table);
    addMessage(`Found ${records.length} records to copy.`);

    // Insert records into the target
    addMessage("Inserting records into target...");
    await InsertRecords(to, records as any,table);
    addMessage("Records inserted successfully.");
}
