import {Hono} from 'hono';
import {cors} from 'hono/cors';
import type {AbstractSql, SqlInput, SqlOutput} from './sql-api/api.ts';
import {BunSqlApi} from './sql-api/bun.ts';
import {serve} from 'bun';
import {ensureGitRoot} from "./os/ensure-git-root.ts";

// this file is a db server entrypoint

const DEFAULT_PORT = 3000;

export function createApp(db: AbstractSql) {
  console.log({createApp: process.cwd()});
  ensureGitRoot();

  const app = new Hono();

  app.use('*', cors({
    origin: '*',
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  }));

  app.post('/sql/query', async (c) => {
    const body = await c.req.json() as SqlInput;
    try {
      const result: SqlOutput = await db.query(body);
      return c.json(result);
    } catch (error: any) {
      return c.json({ error: (error?.message || ""+error) }, 500);
    }
  });

  return app;
}

export function startServer() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('Usage: bun run http.ts <db_path> <port>');
    process.exit(1);
  }else{
    console.log({startServer:args})
  }

  const [dbPath, port] = args;
  const db = new BunSqlApi(dbPath);
  const app = createApp(db);

  const serverPort = parseInt(port);
  if (isNaN(serverPort)) {
    console.error('Invalid port number');
    process.exit(1);
  }

  serve({
    fetch: app.fetch,
    port: serverPort,
  });

  console.log(`Sync server running on port ${serverPort}`);
}

if (import.meta.main) {
  startServer();
}
