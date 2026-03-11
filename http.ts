import {Hono} from 'hono';
import {cors} from 'hono/cors';
import {AbstractSql, SqlInput, SqlOutput} from './sql-api/api.ts';
import {BunSqlApi} from './sql-api/bun.ts';
import {serve} from 'bun';
import {ensureGitRoot} from "./os/ensure-git-root.ts";

// this file is a db server entrypoint

const DEFAULT_PORT = 3000;

function createApp(db: AbstractSql) {
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

  // app.post('/deploy', async (c) => {
  //   const bodyText = await c.req.text();
  //   let body: DeployInput;
  //   try {
  //     body = JSON.parse(bodyText) as DeployInput;
  //   } catch (error) {
  //     console.error('Failed to parse /deploy body', { bodyText, error });
  //     return c.text(bodyText, 500);
  //   }
  //
  //   try {
  //     const result: DeployOutput = await doDeploy(body);
  //     return c.json(result);
  //   } catch (error) {
  //     return c.json({ error: error.message }, 500);
  //   }
  // });

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

function logPort(port: number): number {
  console.log(`Sync server running on port ${port}`);
  return port;
}

export default {
  port: logPort(process.argv[3] ? parseInt(process.argv[3]) : DEFAULT_PORT),
  fetch: createApp(new BunSqlApi(process.argv[2])).fetch as any,
};
