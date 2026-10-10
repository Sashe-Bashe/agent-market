import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import type { Actor, Product, RequestInput, Terms } from "../src/lib/types";

// Import the database only after assigning a unique path. Tests never open data/.
mkdirSync(join(process.cwd(), "work"), { recursive: true });
const scratch = mkdtempSync(join(process.cwd(), "work", "integrity-test-"));
process.env.DATABASE_PATH = join(scratch, "market.sqlite");
Object.assign(process.env, { NODE_ENV: "test" });
process.env.OPENAI_API_KEY = "";
let service: typeof import("../src/lib/service");
let storage: typeof import("../src/lib/db");
let buyer: Actor, forma: Actor, nord: Actor;
let defaults: { id: string; data: string; stock: number; policy: string }[];

before(async () => {
  storage = await import("../src/lib/db");
  service = await import("../src/lib/service");
  buyer = service.accountFor("buyer");
  forma = service.accountFor("forma");
  nord = service.accountFor("nord");
  defaults = storage.db
    .prepare(
      "SELECT p.id,p.data,p.stock,r.data AS policy FROM products p JOIN policies r ON r.product_id=p.id",
    )
    .all() as typeof defaults;
});

function restoreCatalogue() {
  for (const row of defaults) {
    storage.db
      .prepare("UPDATE products SET data=?,stock=? WHERE id=?")
      .run(row.data, row.stock, row.id);
    storage.db
      .prepare("UPDATE policies SET data=? WHERE product_id=?")
      .run(row.policy, row.id);
  }
}

beforeEach(() => {
  storage.resetDemo();
  restoreCatalogue();
});

after(() => {
  if (storage) {
    restoreCatalogue();
    storage.db.close();
  }
  rmSync(scratch, { recursive: true, force: true });
});

function input(patch: Partial<RequestInput> = {}): RequestInput {
  return {
    title: "80 stackable chairs",
    description: "Buy 80 polypropylene chairs for our Sofia office.",
    buyerType: "business",
    quantity: 80,
    material: "polypropylene",
    stackable: true,
    destination: "Sofia",
    latestDelivery: storage.addDays(14),
    maxBudget: 700000,
    maxDeposit: 100,
    preference: "lower_deposit",
    ...patch,
  };
}

function terms(patch: Partial<Terms> = {}): Terms {
  return {
    unitPrice: 8300,
    quantity: 80,
    deliveryDate: storage.addDays(12),
    depositPercent: 30,
    ...patch,
  };
}

function flow(patch: Partial<RequestInput> = {}) {
  const request = service.createRequest(buyer, input(patch));
  service.launchRequest(buyer, request.id);
  const detail = service.getRequest(buyer, request.id);
  const room = detail.rooms.find((item) => item.productId === "prod-forma");
  assert.ok(room, "Forma must match this test request");
  return { request, room };
}

function agreed(patch: Partial<RequestInput> = {}) {
  const { request, room } = flow(patch);
  const offer = service.createOffer(room.id, "seller", terms());
  service.markAgreement(room.id, offer.id);
  return { request, room, offer };
}

function editableProduct(product: Product) {
  const {
    id: _id,
    workspaceId: _workspace,
    supplierName: _supplier,
    ...fields
  } = product;
  return fields;
}

async function approvalInNewProcess(
  accountId: string,
  roomId: string,
  offerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const script = `const s = require('./src/lib/service.ts'); try { s.approve(s.accountFor(process.env.TEST_ACCOUNT_ID), process.env.TEST_ROOM_ID, process.env.TEST_OFFER_ID); process.stdout.write(JSON.stringify({ok:true})); } catch(error) { process.stdout.write(JSON.stringify({ok:false,error:error.message})); }`;
  const result = await promisify(execFile)(
    process.execPath,
    ["--import", "tsx", "--eval", script],
    {
      cwd: process.cwd(),
      timeout: 20000,
      env: {
        ...process.env,
        TEST_ACCOUNT_ID: accountId,
        TEST_ROOM_ID: roomId,
        TEST_OFFER_ID: offerId,
      },
    },
  );
  return JSON.parse(result.stdout);
}

test("buyers cannot read or edit seller-private catalogue rules", () => {
  assert.throws(() => service.getCatalogue(buyer));
  const product = service.getProduct("prod-forma");
  const policy = service.getPolicy(product.id);
  assert.throws(() =>
    service.updateCatalogue(buyer, product.id, {
      product: editableProduct(product),
      policy: { ...policy, minUnitPrice: 1 },
    }),
  );
  assert.deepEqual(service.getPolicy(product.id), policy);
});

test("seller views reconstruct disclosed requirements without private limits or raw request text", () => {
  const marker = "PRIVATE_REQUEST_MARKER_93471";
  const { request, room } = flow({
    title: `Chairs ${marker}`,
    description: `I privately have EUR 6,999.93. ${marker}. Never disclose this text.`,
    maxBudget: 699993,
    maxDeposit: 97,
    preference: "lowest_total",
  });
  const view = service.getRoom(forma, room.id);
  assert.equal(view.request.quantity, 80);
  assert.equal(view.request.destination, "Sofia");
  for (const field of ["maxBudget", "maxDeposit", "preference"])
    assert.equal(Object.hasOwn(view.request, field), false);
  const serialized = JSON.stringify(view);
  assert.equal(
    serialized.includes(marker),
    false,
    "unreviewed raw text can contain private instructions or budget",
  );
  assert.equal(serialized.includes("699993"), false);
  assert.equal(serialized.includes("6,999.93"), false);
  assert.throws(() => service.getRequest(forma, request.id));
  assert.throws(() => service.listRequests(forma));
});

test("a supplier cannot read or approve another supplier room or change its rules", () => {
  const { room, offer } = agreed();
  assert.throws(() => service.getRoom(nord, room.id));
  assert.throws(() => service.approve(nord, room.id, offer.id));
  assert.throws(() => service.reviseOffer(nord, room.id, terms()));
  const product = service.getProduct("prod-forma");
  assert.throws(() =>
    service.updateCatalogue(nord, product.id, {
      product: editableProduct(product),
      policy: service.getPolicy(product.id),
    }),
  );
  assert.equal(service.getRoom(forma, room.id).room.approvals.length, 0);
});

test("a forged actor cannot grant a real user another workspace or role", () => {
  const { request, room, offer } = agreed();
  const forgedSeller = {
    ...buyer,
    role: "seller" as const,
    workspaceId: forma.workspaceId,
  };
  const forgedBuyer = {
    ...forma,
    role: "buyer" as const,
    workspaceId: buyer.workspaceId,
  };
  assert.throws(() => service.getCatalogue(forgedSeller));
  assert.throws(() => service.getRequest(forgedBuyer, request.id));
  assert.throws(() => service.approve(forgedSeller, room.id, offer.id));
  assert.throws(() => service.createRequest(forgedBuyer, input()));
  assert.equal(service.getRoom(forma, room.id).room.approvals.length, 0);
});

test("invalid seller offers cannot bypass floor, quantity, delivery, or deposit validation", () => {
  const { room } = flow();
  const cases: Partial<Terms>[] = [
    { unitPrice: 8299 },
    { quantity: 81 },
    { deliveryDate: storage.addDays(11) },
    { deliveryDate: storage.addDays(15) },
    { depositPercent: 29 },
  ];
  for (const patch of cases)
    assert.throws(() => service.createOffer(room.id, "seller", terms(patch)));
  assert.equal(
    service.readOffers(room.id).length,
    0,
    "rejected offers never become visible versions",
  );
});

test("buyer offers cannot exceed the private budget or private deposit limit", () => {
  const { room } = flow({ maxDeposit: 40 });
  assert.throws(() =>
    service.createOffer(room.id, "buyer", terms({ unitPrice: 9000 })),
  );
  assert.throws(() =>
    service.createOffer(room.id, "buyer", terms({ depositPercent: 41 })),
  );
  assert.equal(service.readOffers(room.id).length, 0);
});

test("an incoming expensive offer remains visible but cannot become an agreed order", () => {
  const { room } = flow();
  const offer = service.createOffer(
    room.id,
    "seller",
    terms({ unitPrice: 9500 }),
  );
  assert.equal(offer.grandTotal, 784000);
  assert.equal(service.getRoom(buyer, room.id).room.valid, false);
  assert.throws(() => service.markAgreement(room.id, offer.id));
  assert.throws(() => service.approve(buyer, room.id, offer.id));
  assert.equal(service.listOrders(buyer).length, 0);
});

test("agreement does not order; both humans approve one immutable exact version", () => {
  const { request, room, offer } = agreed();
  assert.equal(offer.lineTotal, 664000);
  assert.equal(offer.grandTotal, 688000);
  assert.equal(offer.currency, "EUR");
  assert.ok(offer.taxTreatment);
  assert.equal(service.getRequest(buyer, request.id).order, null);
  assert.equal(service.approve(buyer, room.id, offer.id).order, null);
  assert.equal(service.getProduct("prod-forma").stock, 240);
  const result = service.approve(forma, room.id, offer.id);
  assert.ok(result.order);
  assert.equal(result.order.offerId, offer.id);
  assert.deepEqual(result.order.offer, offer);
  assert.equal(service.getProduct("prod-forma").stock, 160);
  assert.equal(service.getRequest(buyer, request.id).request.state, "ordered");
  assert.throws(
    () =>
      storage.db
        .prepare("UPDATE offers SET data=data WHERE id=?")
        .run(offer.id),
    /immutable/i,
  );
});

test("a revised offer invalidates old approvals and needs two fresh exact-version approvals", () => {
  const { room, offer } = agreed();
  service.approve(buyer, room.id, offer.id);
  assert.throws(() =>
    service.reviseOffer(buyer, room.id, terms({ unitPrice: 8400 })),
  );
  service.reviseOffer(forma, room.id, terms({ unitPrice: 8400 }));
  const view = service.getRoom(forma, room.id).room;
  assert.ok(view.currentOffer);
  assert.notEqual(view.currentOffer.id, offer.id);
  assert.equal(view.currentOffer.version, offer.version + 1);
  assert.equal(view.approvals.length, 0);
  assert.deepEqual(
    service.readOffers(room.id)[0],
    offer,
    "revision must retain the original version unchanged",
  );
  assert.throws(() => service.approve(buyer, room.id, offer.id));
  assert.throws(() => service.approve(forma, room.id, offer.id));
  if (view.state === "negotiating")
    service.markAgreement(room.id, view.currentOffer.id);
  assert.equal(
    service.approve(forma, room.id, view.currentOffer.id).order,
    null,
  );
  assert.ok(service.approve(buyer, room.id, view.currentOffer.id).order);
});

test("expired immutable offers cannot be approved or create an order", () => {
  const { room } = flow();
  const original = service.createOffer(room.id, "seller", terms());
  const expired = {
    ...original,
    id: storage.id(),
    version: original.version + 1,
    expiresAt: new Date(Date.now() - 60000).toISOString(),
  };
  storage.db
    .prepare(
      "INSERT INTO offers(id,negotiation_id,version,data,created_at) VALUES(?,?,?,?,?)",
    )
    .run(
      expired.id,
      room.id,
      expired.version,
      JSON.stringify(expired),
      expired.createdAt,
    );
  storage.db
    .prepare(
      "UPDATE negotiations SET current_offer_id=?,state='awaiting_approval' WHERE id=?",
    )
    .run(expired.id, room.id);
  assert.throws(() => service.approve(buyer, room.id, expired.id));
  assert.throws(() => service.approve(forma, room.id, expired.id));
  assert.equal(service.listOrders(buyer).length, 0);
  assert.equal(service.getProduct("prod-forma").stock, 240);
});

test("duplicate concurrent approvals across application processes allocate inventory only once", async () => {
  const { room, offer } = agreed();
  service.approve(buyer, room.id, offer.id);
  service.approve(buyer, room.id, offer.id);
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      approvalInNewProcess(index % 2 ? "buyer" : "forma", room.id, offer.id),
    ),
  );
  assert.ok(
    results.every((result) => result.ok),
    JSON.stringify(results),
  );
  assert.equal(service.listOrders(buyer).length, 1);
  assert.equal(service.listOrders(forma).length, 1);
  assert.equal(service.listOrders(nord).length, 0);
  assert.equal(service.getProduct("prod-forma").stock, 160);
  assert.equal(
    (
      storage.db.prepare("SELECT COUNT(*) AS n FROM allocations").get() as {
        n: number;
      }
    ).n,
    1,
  );
});

test("one request can order from only one supplier and closes rival negotiations", () => {
  const { request, room, offer } = agreed({ maxBudget: 1000000 });
  const rival = service
    .getRequest(buyer, request.id)
    .rooms.find((item) => item.productId === "prod-nord");
  assert.ok(rival);
  const rivalOffer = service.createOffer(
    rival.id,
    "seller",
    terms({
      unitPrice: 9900,
      deliveryDate: storage.addDays(8),
      depositPercent: 50,
    }),
  );
  service.markAgreement(rival.id, rivalOffer.id);
  service.approve(buyer, rival.id, rivalOffer.id);
  service.approve(buyer, room.id, offer.id);
  service.approve(forma, room.id, offer.id);
  assert.throws(() => service.approve(nord, rival.id, rivalOffer.id));
  const detail = service.getRequest(buyer, request.id);
  assert.equal(detail.order?.negotiationId, room.id);
  assert.equal(
    detail.rooms.find((item) => item.id === rival.id)?.state,
    "cancelled",
  );
  assert.equal(service.listOrders(buyer).length, 1);
  assert.equal(service.getProduct("prod-nord").stock, 150);
});

test("stock changing after first approval invalidates commitment and requires fresh agreement", () => {
  const { room, offer } = agreed();
  service.approve(buyer, room.id, offer.id);
  const product = service.getProduct("prod-forma");
  service.updateCatalogue(forma, product.id, {
    product: { ...editableProduct(product), stock: 79 },
    policy: service.getPolicy(product.id),
  });
  assert.throws(() => service.approve(forma, room.id, offer.id));
  assert.equal(service.listOrders(buyer).length, 0);
  assert.equal(service.getProduct(product.id).stock, 79);
  assert.equal(
    service.getRoom(forma, room.id).room.approvals.length,
    0,
    "an availability change must invalidate previous approvals",
  );
  service.updateCatalogue(forma, product.id, {
    product: { ...editableProduct(product), stock: 240 },
    policy: service.getPolicy(product.id),
  });
  assert.throws(
    () => service.approve(forma, room.id, offer.id),
    "restoring stock must not revive approval of the old version",
  );
});

test("competing purchases cannot oversell the same stock", async () => {
  const product = service.getProduct("prod-forma");
  service.updateCatalogue(forma, product.id, {
    product: { ...editableProduct(product), stock: 100 },
    policy: service.getPolicy(product.id),
  });
  const first = agreed();
  const second = agreed();
  service.approve(buyer, first.room.id, first.offer.id);
  service.approve(buyer, second.room.id, second.offer.id);
  const results = await Promise.all(
    [first, second].map((item) =>
      approvalInNewProcess("forma", item.room.id, item.offer.id),
    ),
  );
  assert.equal(
    results.filter((result) => result.ok).length,
    1,
    JSON.stringify(results),
  );
  assert.equal(
    results.filter((result) => !result.ok).length,
    1,
    JSON.stringify(results),
  );
  assert.equal(service.listOrders(buyer).length, 1);
  assert.equal(service.getProduct(product.id).stock, 20);
  assert.equal(
    (
      storage.db
        .prepare("SELECT SUM(quantity) AS n FROM allocations")
        .get() as { n: number }
    ).n,
    80,
  );
});

test("cancelled requests cannot accept further offers or human approvals", () => {
  const { request, room, offer } = agreed();
  service.approve(buyer, room.id, offer.id);
  service.cancelRequest(buyer, request.id);
  assert.throws(() => service.createOffer(room.id, "seller", terms()));
  assert.throws(() => service.approve(forma, room.id, offer.id));
  assert.equal(
    service.getRequest(buyer, request.id).request.state,
    "cancelled",
  );
  assert.equal(service.listOrders(buyer).length, 0);
});

test("requests, offer versions, approvals, and orders survive a new application process", () => {
  const { request, room, offer } = agreed();
  service.approve(buyer, room.id, offer.id);
  const order = service.approve(forma, room.id, offer.id).order;
  assert.ok(order);
  const script = `const s = require('./src/lib/service.ts'); const d = s.getRequest(s.accountFor('buyer'), process.env.TEST_REQUEST_ID); process.stdout.write(JSON.stringify(d));`;
  const persisted = JSON.parse(
    execFileSync(process.execPath, ["--import", "tsx", "--eval", script], {
      cwd: process.cwd(),
      env: { ...process.env, TEST_REQUEST_ID: request.id },
      encoding: "utf8",
      timeout: 20000,
    }),
  );
  assert.equal(persisted.request.state, "ordered");
  assert.equal(persisted.order.id, order.id);
  assert.deepEqual(persisted.order.offer, offer);
  const persistedRoom = persisted.rooms.find(
    (item: { id: string }) => item.id === room.id,
  );
  assert.equal(persistedRoom.approvals.length, 2);
  assert.equal(persistedRoom.offers.length, 1);
});
