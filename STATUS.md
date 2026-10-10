# Status

## 2026-07-30 — hono loosened to ^4.12.4

- hono@4.11.7 (exact pin) carried two HIGH advisories fixed in >= 4.12.4:
  GHSA-q5qw-h33p-qvwr (serveStatic file access), GHSA-88fw-hqm2-52qc (CORS
  reflects any Origin with credentials). Range is now `^4.12.4`; lock resolves
  4.12.31.

## 2026-07-14 — paginated sync reads

- `GetDataToCopy(source, range, table, limit)`: explicit limit parameter, `LIMIT ?` in
  SQL, fail-fast on non-positive limit. (SY-pagul)
- `copyRange` loops in `SYNC_PAGE_SIZE` (1000) pages, cursor = last seq + 1; each page
  is inserted before the next read so a crash leaves a contiguous prefix. (SY-kotad)
- Tests: read-size bound, exact-multiple termination, reader+writer crash after first
  100-row insert batch with concurrent writes → fresh sync converges gap-free.
  (SY-pagul, SY-kotad, SY-vimon)
- doc.md updated (removed "assume everything fits (no paging)").
- Verified: `bun test` 33 pass, `bunx tsc --noEmit` clean.

## 2026-07-15 — one-way sync

- `SyncTablesOneWay`: direction-filtered variant of `SyncTables`, same paginated
  copyRange. (SY-ronuk)
- Verified: `bun test` 35 pass, `bunx tsc --noEmit` clean.

## 2026-10-10 — sqlite-wasm 3.46.0 -> 3.53.4

- `sqlite-wasm/` now holds the upstream `@sqlite.org/sqlite-wasm` 3.53.4-build1 `dist`
  (`index.mjs`, `sqlite3-worker1.mjs`, `sqlite3-opfs-async-proxy.js`, `sqlite3.wasm`,
  `index.d.mts`). `sqlite.mjs` re-exports `default` and `sqlite3Worker1Promiser` from
  `index.mjs`, so `/lib/sqlite.mjs` and `sql-api/wasm.ts` are unchanged. The promiser files
  and bundler-friendly variants are gone: 3.53 ships the promiser inside `index.mjs` and
  starts `sqlite3-worker1.mjs` relative to it.
- Why: 3.46.0's `opfs` VFS answered `xCheckReservedLock` from its own lock state, so a hot
  journal left by a killed worker could be skipped instead of rolled back. Ferry hit it and
  moved to 3.53.4 (its BD-pusoh); this brings the same bundle to other users of `/lib/`.
- Verified: `bun test` 34 pass; the Playwright integration test fails only because its
  chromium-1208 is not downloaded. Ran its page by hand in a browser against
  `integration-server.ts`: "Running SQLite3 version 3.53.4", "Sync complete: 3 rows".
  The OPFS path was not exercised (the page uses `:memory:`).
