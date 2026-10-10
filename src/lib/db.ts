import "dotenv/config";
import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const addDays = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const file = process.env.DATABASE_PATH || "./data/agent-market.sqlite";
if (file !== ":memory:")
  mkdirSync(dirname(resolve(/* turbopackIgnore: true */ file)), {
    recursive: true,
  });
export const db = new Database(file);
db.pragma("busy_timeout = 5000");
db.pragma("foreign_keys = ON");
// Journal-mode transitions can return SQLITE_BUSY before the normal busy handler.
for (let attempt = 0; ; attempt++) {
  try {
    db.pragma("journal_mode = WAL");
    break;
  } catch (error) {
    if ((error as { code?: string }).code !== "SQLITE_BUSY" || attempt >= 30)
      throw error;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
}
db.transaction(() => {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  if (!db.prepare("SELECT 1 FROM schema_migrations WHERE version=1").get()) {
    db.exec(readFileSync(resolve("migrations/001_initial.sql"), "utf8"));
    db.prepare("INSERT INTO schema_migrations VALUES(1,?)").run(now());
  }
  if (!db.prepare("SELECT 1 FROM schema_migrations WHERE version=2").get()) {
    if (
      !(db.pragma("table_info(jobs)") as { name: string }[]).some(
        (c) => c.name === "model_calls",
      )
    )
      db.exec(
        "ALTER TABLE jobs ADD COLUMN model_calls INTEGER NOT NULL DEFAULT 0",
      );
    db.exec(readFileSync(resolve("migrations/002_demo_scenarios.sql"), "utf8"));
    db.prepare("INSERT INTO schema_migrations VALUES(2,?)").run(now());
  }
}).immediate();
export function seed() {
  db.transaction(() => {
    if (db.prepare("SELECT 1 FROM workspaces WHERE id='ws-buyer'").get())
      return;
    const entries = [
      ["buyer", "Maya Chen", "Forma Studio", "buyer"],
      ["forma", "Elias Novak", "Forma Supply", "seller"],
      ["nord", "Sofia Berg", "Nord Office", "seller"],
      ["atelier", "Luca Rossi", "Atelier Works", "seller"],
    ];
    for (const [key, name, company, role] of entries) {
      db.prepare("INSERT INTO workspaces VALUES(?,?,1)").run(
        "ws-" + key,
        company,
      );
      db.prepare("INSERT INTO users VALUES(?,?,1)").run(key, name);
      db.prepare("INSERT INTO memberships VALUES(?,?,?)").run(
        key,
        "ws-" + key,
        role,
      );
    }
    const products = [
      {
        key: "forma",
        name: "Arc stack chair",
        sku: "ARC-01",
        material: "polypropylene",
        color: "Slate",
        stackable: true,
        stock: 240,
        unitPrice: 9500,
        deliveryCharge: 24000,
        leadDays: 12,
        destinations: ["Sofia", "Plovdiv", "Varna"],
        policy: {
          minUnitPrice: 8300,
          discountMinQuantity: 50,
          minDeposit: 30,
          maxDiscountPercent: 20,
        },
      },
      {
        key: "nord",
        name: "Loop meeting chair",
        sku: "LOOP-02",
        material: "polypropylene",
        color: "Cloud",
        stackable: true,
        stock: 150,
        unitPrice: 11000,
        deliveryCharge: 16000,
        leadDays: 8,
        destinations: ["Sofia", "Plovdiv"],
        policy: {
          minUnitPrice: 9900,
          discountMinQuantity: 60,
          minDeposit: 50,
          maxDiscountPercent: 10,
        },
      },
      {
        key: "atelier",
        name: "Mono stack chair",
        sku: "MONO-03",
        material: "polypropylene",
        color: "Forest",
        stackable: true,
        stock: 45,
        unitPrice: 8500,
        deliveryCharge: 20000,
        leadDays: 21,
        destinations: ["Sofia"],
        policy: {
          minUnitPrice: 7900,
          discountMinQuantity: 100,
          minDeposit: 40,
          maxDiscountPercent: 8,
        },
      },
    ];
    for (const { key, policy, stock, ...product } of products) {
      db.prepare("INSERT INTO products VALUES(?,?,?,?)").run(
        "prod-" + key,
        "ws-" + key,
        JSON.stringify(product),
        stock,
      );
      db.prepare("INSERT INTO policies VALUES(?,?)").run(
        "prod-" + key,
        JSON.stringify(policy),
      );
    }
  }).immediate();
}
export function resetDemo() {
  db.transaction(() => {
    // Only records belonging to explicitly marked demo workspaces may be removed.
    const demo = "SELECT id FROM workspaces WHERE demo=1";
    const req = `SELECT id FROM requests WHERE workspace_id IN (${demo})`;
    const rooms = `SELECT id FROM negotiations WHERE request_id IN (${req})`;
    db.exec(
      `DELETE FROM allocations WHERE order_id IN (SELECT id FROM orders WHERE request_id IN (${req})); DELETE FROM orders WHERE request_id IN (${req}); DELETE FROM approvals WHERE offer_id IN (SELECT id FROM offers WHERE negotiation_id IN (${rooms})); DELETE FROM messages WHERE negotiation_id IN (${rooms}); DELETE FROM jobs WHERE negotiation_id IN (${rooms}); DELETE FROM offers WHERE negotiation_id IN (${rooms}); DELETE FROM negotiations WHERE request_id IN (${req}); DELETE FROM requests WHERE id IN (${req}); DELETE FROM sessions WHERE workspace_id IN (${demo});`,
    );
    // Catalogue may be referenced by non-demo records; never delete other tenants' data.
    for (const [key, stock] of [
      ["forma", 240],
      ["nord", 150],
      ["atelier", 45],
    ] as const)
      db.prepare(
        "UPDATE products SET stock=? WHERE id=? AND workspace_id IN (SELECT id FROM workspaces WHERE demo=1)",
      ).run(stock, "prod-" + key);
  }).immediate();
}
seed();
