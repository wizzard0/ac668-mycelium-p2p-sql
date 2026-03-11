/// <reference lib="dom" />
import { test, expect } from "bun:test";
import { Subprocess } from "bun";
import { join, dirname } from "path";
import { rmSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { Database } from "bun:sqlite";
import { BunSqlApi } from "./sql-api/bun.ts";
import { MakeMockRecords, CreateExampleTable } from "./mock-data.ts";
const playwrightPromise = import("playwright").catch(() => null) as Promise<any>;
const playwright = await playwrightPromise;
if (!playwright) console.warn("[integration] Playwright not installed");
const run = playwright ? test : test.skip;

const here = dirname(fileURLToPath(import.meta.url));
const tmpDir = join(here, "tmp");
const dbPath = join(tmpDir, "integration.db");
const decode = new TextDecoder();

async function waitFor(proc: Subprocess, needle: string, timeout = 10_000) {
  const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();
  let buf = "";
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decode.decode(value);
    if (buf.includes(needle)) { reader.releaseLock(); return; }
  }
  reader.releaseLock();
  throw new Error("missing " + needle + " got " + buf);
}

run("browser syncs with cli server", async () => {
  const { chromium } = playwright as any;
  mkdirSync(tmpDir, { recursive: true });
  rmSync(dbPath, { force: true });

  // Initialize server database with test data
  const serverDb = new BunSqlApi(dbPath);
  await MakeMockRecords("server-node", serverDb, "test_table");
  serverDb.close();

  const port = 37599;
  const server = Bun.spawn({
    cmd: ["bun", "run", join(here, "integration-server.ts"), dbPath, "" + port],
    cwd: here,
    stdout: "pipe",
    stderr: "pipe",
  });

  try {
    await waitFor(server, "Integration server running");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      page.on("console", (msg: any) => console.log("[browser]", msg.text()));

      await page.goto(`http://127.0.0.1:${port}/test.html`);
      await page.waitForSelector("#status");

      // Wait for sync to complete
      await page.waitForFunction(() => {
        const el = document.getElementById("status");
        return el?.textContent?.includes("Sync complete");
      }, { timeout: 15000 });

      // Verify browser received server data
      const browserRows = await page.evaluate(() => {
        return (window as any).__BROWSER_ROWS__ || [];
      });
      expect(browserRows.length).toBeGreaterThanOrEqual(2);

      // Verify server received browser data
      const checkDb = new BunSqlApi(dbPath);
      const serverRows = await checkDb.query({
        sql: "SELECT * FROM test_table WHERE node = ?",
        params: ["browser-node"],
      });
      checkDb.close();
      expect(serverRows.rows.length).toBeGreaterThanOrEqual(1);

      console.log("Browser rows:", browserRows.length);
      console.log("Server rows from browser:", serverRows.rows.length);
    } finally {
      await browser.close().catch(() => {});
    }
  } finally {
    server.kill();
    await server.exited;
  }
}, 60_000);
