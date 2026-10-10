// Upstream @sqlite.org/sqlite-wasm 3.53.4-build1 dist, served at /lib/ (see sql-api/wasm.ts).
// The worker, OPFS proxy and wasm resolve next to index.mjs via import.meta.url.
export { default, sqlite3Worker1Promiser } from './index.mjs';
