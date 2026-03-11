import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "bun";
import { BunSqlApi } from "./sql-api/bun.ts";
import { SqlInput, SqlOutput } from "./sql-api/api.ts";
import { CreateExampleTable } from "./mock-data.ts";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const libDir = join(here, "sqlite-wasm");

const [dbPath, portStr] = process.argv.slice(2);
if (!dbPath || !portStr) {
  console.error("Usage: bun run integration-server.ts <db> <port>");
  process.exit(1);
}

const db = new BunSqlApi(dbPath);
await CreateExampleTable(db, "test_table");

const app = new Hono();
app.use("*", cors({ origin: "*" }));

app.post("/sql/query", async (c) => {
  const body = (await c.req.json()) as SqlInput;
  try {
    const result: SqlOutput = await db.query(body);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get("/test.html", (c) => {
  return c.html(testHtml);
});

app.get("/lib/*", async (c) => {
  const path = c.req.path.replace("/lib/", "");
  const file = Bun.file(join(libDir, path));
  if (await file.exists()) {
    const ct = path.endsWith(".mjs") || path.endsWith(".js")
      ? "application/javascript" : path.endsWith(".wasm")
      ? "application/wasm" : "application/octet-stream";
    return new Response(file, { headers: { "Content-Type": ct } });
  }
  return c.notFound();
});

app.get("/t348.mjs", async (c) => {
  return new Response(Bun.file(join(here, "t348.mjs")), {
    headers: { "Content-Type": "application/javascript" }
  });
});

app.get("/*", async (c) => {
  const path = c.req.path.slice(1);
  if (!path.endsWith(".ts")) return c.notFound();
  const file = Bun.file(join(here, path));
  if (await file.exists()) {
    return new Response(file, { headers: { "Content-Type": "application/typescript" } });
  }
  return c.notFound();
});

const port = parseInt(portStr);
serve({ fetch: app.fetch, port });
console.log(`Integration server running on port ${port}`);

const testHtml = `<!DOCTYPE html>
<html><head><title>Sync Test</title></head>
<body>
<div id="status">Loading...</div>
<script src="/t348.mjs" type="module" data-global-repo="./$HASH.ts"></script>
<script src="/test-browser.ts" type="text/typescript"></script>
</body></html>`;
