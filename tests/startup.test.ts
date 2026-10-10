import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

test("six simultaneous application processes initialize one fresh database safely", async () => {
  const work = join(process.cwd(), "work");
  mkdirSync(work, { recursive: true });
  const scratch = mkdtempSync(join(work, "startup-test-"));
  const env = { ...process.env, DATABASE_PATH: join(scratch, "fresh.sqlite") };
  const options = { cwd: process.cwd(), env, timeout: 20000 };
  try {
    // The real dev/start commands boot independent web and worker processes.
    // Use the actual database module in fresh processes so migration checking,
    // WAL setup and seed locking race exactly as they do on a clean checkout.
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        exec(
          process.execPath,
          [
            "--import",
            "tsx",
            "--eval",
            "require('./src/lib/db.ts').db.close()",
          ],
          options,
        ),
      ),
    );
    const failures = results.flatMap((result, index) =>
      result.status === "rejected"
        ? [
            `Process ${index + 1}: ${result.reason instanceof Error ? result.reason.message : "failed"}`,
          ]
        : [],
    );
    assert.deepEqual(
      failures,
      [],
      "Every process must survive concurrent first-run setup",
    );

    const { stdout } = await exec(
      process.execPath,
      [
        "--import",
        "tsx",
        "--eval",
        `
      const {db}=require('./src/lib/db.ts');
      process.stdout.write(JSON.stringify({
        migrations:db.prepare('SELECT COUNT(*) n FROM schema_migrations WHERE version=1').get().n,
        products:db.prepare('SELECT COUNT(*) n FROM products').get().n,
        modelCallsColumn:db.pragma('table_info(jobs)').some(column=>column.name==='model_calls'),
        integrity:db.pragma('integrity_check',{simple:true})
      }));
      db.close();
    `,
      ],
      options,
    );
    assert.deepEqual(JSON.parse(stdout), {
      migrations: 1,
      products: 3,
      modelCallsColumn: true,
      integrity: "ok",
    });
  } finally {
    // All child processes have settled before removing their isolated database.
    rmSync(scratch, { recursive: true, force: true });
  }
});
