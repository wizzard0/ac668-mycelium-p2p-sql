# Requirements

## Sync pagination (2026-07-14)

- **SY-pagul** — Sync reads are paginated. `GetDataToCopy` takes an explicit `limit`
  (`LIMIT ?`); `copyRange` pulls at most `SYNC_PAGE_SIZE` (1000) rows per query,
  advancing a cursor by the last seq seen. Why: a cold replica or long-offline peer
  otherwise transfers its entire backlog as one buffered query result / one JSON HTTP
  response — unbounded memory on both ends.
  Tests: full.test.ts "SyncTables paginates", "exact multiple of the page size";
  copy.test.ts "returns at most limit rows", "rejects a non-positive limit".

- **SY-kotad** — Crash recovery relies on DB state only. Pages are read in seq order
  and each page is inserted before the next is read, so an interrupted sync leaves the
  target with a contiguous per-node seq prefix; the next run resumes from `max(seq)`.
  No in-memory cursor survives a crash — and none is needed. Why: reader and writer can
  both die mid-sync (deploy, OOM); a gap below the target's `max(seq)` would never be
  re-requested, so no such gap may ever be created.
  Test: full.test.ts "crash after first insert batch under concurrent writes".

- **SY-vimon** — Writes committed while a sync pass is mid-flight are safe:
  `GetSequencesToSync` fixes each range's `end` up front, so late rows are simply
  picked up by the next pass.
  Test: covered inside the crash test (writer injects rows before the first page read).
