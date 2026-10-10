import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

mkdirSync(join(process.cwd(), "work"), { recursive: true });
const scratch = mkdtempSync(join(process.cwd(), "work", "auth-test-"));
Object.assign(process.env, {
  DATABASE_PATH: join(scratch, "market.sqlite"),
  NODE_ENV: "test",
  DEMO_MODE: "true",
  OPENAI_API_KEY: "",
});
let storage: typeof import("../src/lib/db");
let auth: typeof import("../src/lib/auth");
before(async () => {
  storage = await import("../src/lib/db");
  auth = await import("../src/lib/auth");
});
beforeEach(() => storage.resetDemo());
after(() => {
  storage?.db.close();
  rmSync(scratch, { recursive: true, force: true });
});

test("server-issued opaque sessions map to seeded workspace membership and are stored as hashes", () => {
  const token = auth.newSession("buyer");
  assert.match(token, /^[a-f0-9]{64}$/);
  const row = storage.db
    .prepare("SELECT token_hash,user_id,workspace_id FROM sessions")
    .get() as { token_hash: string; user_id: string; workspace_id: string };
  assert.notEqual(row.token_hash, token);
  assert.equal(row.user_id, "buyer");
  assert.equal(row.workspace_id, "ws-buyer");
  assert.equal(auth.sessionActor(token).workspaceId, "ws-buyer");
  assert.throws(() => auth.sessionActor("buyer"));
  assert.throws(() => auth.sessionActor());
});

test("expired or workspace-mismatched sessions do not authorize a user", () => {
  const token = auth.newSession("buyer");
  storage.db.prepare("UPDATE sessions SET workspace_id='ws-nord'").run();
  assert.throws(() => auth.sessionActor(token));
  storage.db
    .prepare(
      "UPDATE sessions SET workspace_id='ws-buyer',expires_at='2000-01-01T00:00:00.000Z'",
    )
    .run();
  assert.throws(() => auth.sessionActor(token));
});

test("production disables demo account selection and rejects even previously valid demo sessions", () => {
  const token = auth.newSession("buyer");
  const script = `const assert = require('node:assert/strict'); const auth = require('./src/lib/auth.ts'); assert.equal(auth.demoEnabled(), false); assert.deepEqual(auth.accounts(), []); assert.throws(() => auth.newSession('buyer'), error => error.status === 403); assert.throws(() => auth.sessionActor(process.env.TEST_DEMO_TOKEN), error => error.status === 401); process.stdout.write('production-demo-disabled');`;
  const result = execFileSync(
    process.execPath,
    ["--import", "tsx", "--eval", script],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        DEMO_MODE: "true",
        TEST_DEMO_TOKEN: token,
      },
      encoding: "utf8",
      timeout: 20000,
    },
  );
  assert.equal(result, "production-demo-disabled");
});

test("HTTP origin checks use the browser-facing host even when Next canonicalizes its URL", async () => {
  const { NextRequest } = await import("next/server");
  const { POST } = await import("../src/app/api/[...path]/route");
  const request = (origin: string) =>
    new NextRequest("http://localhost:3000/api/session", {
      method: "POST",
      headers: {
        Host: "127.0.0.1:3000",
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountId: "buyer" }),
    });
  const context = { params: Promise.resolve({ path: ["session"] }) };
  const legitimate = await POST(request("http://127.0.0.1:3000"), context);
  assert.equal(legitimate.status, 200);
  assert.match(legitimate.headers.get("set-cookie") || "", /am_session=/);
  for (const origin of [
    "https://untrusted.example",
    "http://127.0.0.1:3001",
    "https://127.0.0.1:3000",
  ]) {
    const rejected = await POST(request(origin), context);
    assert.equal(
      rejected.status,
      403,
      `${origin} is not the browser-facing request origin`,
    );
    assert.equal(rejected.headers.get("set-cookie"), null);
  }
  assert.equal(
    (
      storage.db.prepare("SELECT COUNT(*) AS n FROM sessions").get() as {
        n: number;
      }
    ).n,
    1,
  );
});
