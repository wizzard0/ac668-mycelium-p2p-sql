import type { AbstractSql } from "./sql-api/api.ts";
import { GetSequencesToSync } from "./sync.ts";
import type { SequenceRange } from "./sync.ts";
import { GetDataToCopy, InsertRecords } from "./copy.ts";
import { validateTableName } from "./validate-table.ts";

export const SYNC_PAGE_SIZE = 1000;

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

// One-directional sync: copies rows `from` has that `to` lacks, never the
// reverse. Callers pick the direction (pull: OneWay(remote, local); push:
// OneWay(local, remote)).
export async function SyncTablesOneWay(from: AbstractSql, to: AbstractSql, addMessage: (message: string) => void, table: string): Promise<SequenceRange[]> {
    validateTableName(table);
    addMessage("Getting sequences to sync (one-way)..." + new Date().toISOString().substring(11, 19));
    const rangesToSync = await GetSequencesToSync(from, to, table);
    const oneWayRanges = rangesToSync.filter((r) => r.direction === 'source_to_target');
    addMessage(`Found ${oneWayRanges.length} one-way ranges to sync.`);

    for (const range of oneWayRanges) {
        addMessage(`Syncing range: ${JSON.stringify(range)}`);
        await copyRange(from, to, range, addMessage, table);
    }
    return oneWayRanges;
}

async function copyRange(from: AbstractSql, to: AbstractSql, range: SequenceRange, addMessage: (message: string) => void, table: string): Promise<void> {
    addMessage(`Getting data to copy for range: ${JSON.stringify(range)}`);
    // Crash-recovery invariant: pages are read in seq order and each page is
    // inserted before the next is read, so an interrupted sync always leaves
    // the target with a contiguous per-node seq prefix. The next run resumes
    // from max(seq) — a gap below it would never be re-requested. Do not
    // reorder or parallelize pages.
    let start = range.start;
    while (start <= range.end) {
        const page = await GetDataToCopy(from, { ...range, start }, table, SYNC_PAGE_SIZE);
        if (page.length === 0) break;
        await InsertRecords(to, page as any, table);
        const lastSeq = page[page.length - 1].seq;
        if (typeof lastSeq !== "number" || lastSeq < start) {
            throw new Error(`copyRange: page for node ${range.node} ended at seq ${lastSeq}, below cursor ${start}`);
        }
        addMessage(`Copied ${page.length} records (seq ${start}..${lastSeq}).`);
        if (page.length < SYNC_PAGE_SIZE) break;
        start = lastSeq + 1;
    }
}
