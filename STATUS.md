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
