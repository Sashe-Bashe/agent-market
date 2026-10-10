import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type {
  Bootstrap,
  Order,
  Product,
  Policy,
  RequestDetail,
  RequestInput,
  SellerRoomDetail,
} from "../src/lib/types";

// HTTP-only smoke test. The running app and worker must share a disposable demo
// database. This script never resets data; a successful run allocates 80 chairs.
const baseURL = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);
const negotiationTimeout = Number(process.env.API_SMOKE_TIMEOUT_MS || 45000);
const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const sessions = new Map<string, string>();
let createdRequestId: string | undefined;
let confirmed = false;
let checks = 0;

async function call<T>(
  account: string | null,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    status?: number;
    origin?: string;
  } = {},
): Promise<T> {
  const method = options.method || "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (account) {
    const cookie = sessions.get(account);
    assert.ok(cookie, `Missing session for ${account}`);
    headers.Cookie = cookie;
  }
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    headers.Origin = options.origin ?? new URL(baseURL).origin;
  }
  const response = await fetch(`${baseURL}/api/${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(
      `${method} /api/${path} returned non-JSON HTTP ${response.status}`,
    );
  }
  assert.equal(
    response.status,
    options.status ?? 200,
    `${method} /api/${path}: ${JSON.stringify(payload)}`,
  );
  assert.match(
    response.headers.get("cache-control") || "",
    /no-store/,
    "API payloads must not be cached across workspaces",
  );
  checks++;
  return payload as T;
}

async function ready(): Promise<Bootstrap> {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/api/bootstrap`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) return (await response.json()) as Bootstrap;
    } catch {
      /* The dev server may still be compiling or starting. */
    }
    await sleep(1000);
  }
  throw new Error(
    `API did not become ready at ${baseURL} within 90 seconds. Start both the web app and worker.`,
  );
}

async function signIn(accountId: string) {
  const response = await fetch(`${baseURL}/api/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(baseURL).origin,
    },
    body: JSON.stringify({ accountId }),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, `Demo sign-in failed for ${accountId}`);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = setCookie.split(";")[0];
  assert.match(cookie, /^am_session=[a-f0-9]{64}$/);
  sessions.set(accountId, cookie);
  const bootstrap = await call<Bootstrap>(accountId, "bootstrap");
  assert.equal(bootstrap.account?.id, accountId);
  checks++;
}

async function main() {
  const bootstrap = await ready();
  assert.equal(
    bootstrap.demoMode,
    true,
    "Use a development server with local demo mode enabled.",
  );
  assert.equal(
    bootstrap.provider,
    "deterministic",
    "This smoke test requires OPENAI_API_KEY to be empty; it must not spend live-provider credits.",
  );
  assert.equal(
    bootstrap.account,
    null,
    "A request without a cookie must be anonymous.",
  );
  assert.deepEqual(
    new Set(bootstrap.accounts.map((account) => account.id)),
    new Set(["buyer", "forma", "nord", "atelier"]),
  );
  await call(null, "requests", { status: 401 });
  await call(null, "session", {
    method: "POST",
    body: { accountId: "buyer" },
    origin: "https://untrusted.example",
    status: 403,
  });
  for (const accountId of ["buyer", "forma", "nord", "atelier"])
    await signIn(accountId);

  await call("buyer", "catalogue", { status: 403 });
  await call("forma", "requests", { status: 403 });
  for (const accountId of ["forma", "nord", "atelier"]) {
    const catalogue = await call<{ product: Product; policy: Policy }[]>(
      accountId,
      "catalogue",
    );
    assert.equal(catalogue.length, 1);
    assert.equal(catalogue[0].product.workspaceId, `ws-${accountId}`);
    assert.ok(catalogue[0].policy.minUnitPrice > 0);
    if (accountId === "forma")
      assert.ok(
        catalogue[0].product.stock >= 80,
        "This run needs 80 Forma chairs. Use a fresh disposable demo database or deliberately reset the demo first.",
      );
  }

  const ambiguous = await call<{ missing: string[] }>("buyer", "extract", {
    method: "POST",
    body: { text: "Buy 80 chairs, maximum €7,000." },
  });
  assert.ok(ambiguous.missing.includes("destination"));
  assert.ok(ambiguous.missing.includes("material"));
  const text =
    "Buy 80 stackable polypropylene chairs, delivered to Sofia within 14 days, maximum €7,000 including delivery, maximum 100% deposit, lower deposit.";
  const extracted = await call<{
    fields: Partial<RequestInput>;
    missing: string[];
    notes: string[];
  }>("buyer", "extract", { method: "POST", body: { text } });
  assert.deepEqual(extracted.missing, []);
  assert.equal(extracted.fields.quantity, 80);
  assert.equal(extracted.fields.material, "polypropylene");
  assert.equal(extracted.fields.destination, "Sofia");
  assert.equal(extracted.fields.maxBudget, 700000);
  const marker = `PRIVATE_SMOKE_${randomUUID()}`;
  const input = {
    ...extracted.fields,
    title: `API smoke ${new Date().toISOString()} ${randomUUID().slice(0, 6)}`,
    description: `${text} ${marker}`,
  } as RequestInput;
  await call("forma", "requests", { method: "POST", body: input, status: 403 });
  await call("buyer", "requests", {
    method: "POST",
    body: { ...input, workspaceId: "ws-forma" },
    status: 422,
  });
  const created = await call<{ id: string; state: string }>(
    "buyer",
    "requests",
    { method: "POST", body: input, status: 201 },
  );
  createdRequestId = created.id;
  assert.equal(created.state, "draft");
  await call("buyer", `requests/${created.id}/launch`, {
    method: "POST",
    body: {},
  });

  let detail = await call<RequestDetail>("buyer", `requests/${created.id}`);
  assert.equal(detail.rooms.length, 2);
  assert.equal(
    detail.request.eligibility.find((item) => item.productId === "prod-atelier")
      ?.eligible,
    false,
  );
  const formaRoomId = detail.rooms.find(
    (room) => room.productId === "prod-forma",
  )?.id;
  const nordRoomId = detail.rooms.find(
    (room) => room.productId === "prod-nord",
  )?.id;
  assert.ok(formaRoomId && nordRoomId);
  await call("nord", `rooms/${formaRoomId}`, { status: 404 });
  await call("atelier", `rooms/${formaRoomId}`, { status: 404 });
  await call("forma", `rooms/${nordRoomId}`, { status: 404 });
  await call("forma", `requests/${created.id}`, { status: 403 });

  const deadline = Date.now() + negotiationTimeout;
  while (
    detail.rooms.some((room) => room.state === "negotiating") &&
    Date.now() < deadline
  ) {
    await sleep(400);
    detail = await call<RequestDetail>("buyer", `requests/${created.id}`);
  }
  assert.ok(
    detail.rooms.every((room) => room.state !== "negotiating"),
    "Negotiations did not finish. Check the durable worker is running against the same DATABASE_PATH.",
  );
  const winner = detail.rooms.find((room) => room.id === formaRoomId);
  const rival = detail.rooms.find((room) => room.id === nordRoomId);
  assert.ok(
    winner?.currentOffer,
    "Forma must reach a valid offer with the default seeded rules.",
  );
  assert.equal(winner.state, "awaiting_approval");
  assert.equal(winner.valid, true);
  assert.ok(winner.currentOffer.grandTotal <= 700000);
  assert.equal(rival?.state, "declined");
  assert.equal(detail.order, null);
  assert.equal(winner.approvals.length, 0);
  assert.ok(winner.messages.some((message) => message.role === "buyer"));
  assert.ok(winner.messages.some((message) => message.role === "seller"));
  const sellerView = await call<SellerRoomDetail>(
    "forma",
    `rooms/${formaRoomId}`,
  );
  for (const field of ["maxBudget", "maxDeposit", "preference"])
    assert.equal(Object.hasOwn(sellerView.request, field), false);
  assert.equal(JSON.stringify(sellerView).includes(marker), false);
  assert.deepEqual(sellerView.request.eligibility, []);
  const inbox = await call<SellerRoomDetail[]>("forma", "inbox");
  assert.ok(inbox.some((item) => item.room.id === formaRoomId));
  assert.ok(inbox.every((item) => item.room.supplierId === "ws-forma"));
  await call("nord", `rooms/${formaRoomId}/approve`, {
    method: "POST",
    body: { offerId: winner.currentOffer.id },
    status: 404,
  });
  await call("buyer", `rooms/${formaRoomId}/approve`, {
    method: "POST",
    body: { offerId: winner.currentOffer.id, workspaceId: "ws-forma" },
    status: 422,
  });
  const buyerApproval = await call<{ order: Order | null }>(
    "buyer",
    `rooms/${formaRoomId}/approve`,
    { method: "POST", body: { offerId: winner.currentOffer.id } },
  );
  assert.equal(buyerApproval.order, null);
  const sellerApproval = await call<{ order: Order | null }>(
    "forma",
    `rooms/${formaRoomId}/approve`,
    { method: "POST", body: { offerId: winner.currentOffer.id } },
  );
  assert.ok(sellerApproval.order);
  confirmed = true;
  assert.equal(sellerApproval.order.status, "confirmed_demo");
  assert.equal(sellerApproval.order.offerId, winner.currentOffer.id);
  const duplicate = await call<{ order: Order | null }>(
    "buyer",
    `rooms/${formaRoomId}/approve`,
    { method: "POST", body: { offerId: winner.currentOffer.id } },
  );
  assert.equal(duplicate.order?.id, sellerApproval.order.id);
  // A fresh server-issued session models re-opening the page independently of
  // the session used to create the order; durable restart is covered separately.
  await signIn("buyer");
  const refreshed = await call<RequestDetail>(
    "buyer",
    `requests/${created.id}`,
  );
  assert.equal(refreshed.request.state, "ordered");
  assert.equal(refreshed.order?.id, sellerApproval.order.id);
  assert.equal(
    refreshed.rooms.find((room) => room.id === nordRoomId)?.state,
    "cancelled",
  );
  for (const account of ["buyer", "forma"]) {
    const orders = await call<Order[]>(account, "orders");
    assert.equal(
      orders.filter((order) => order.requestId === created.id).length,
      1,
    );
  }
  for (const account of ["nord", "atelier"]) {
    const orders = await call<Order[]>(account, "orders");
    assert.equal(
      orders.some((order) => order.requestId === created.id),
      false,
    );
  }
  console.log(`PASS: ${checks} HTTP checks against ${baseURL}`);
  console.log(
    `Request ${created.id}; confirmed internal demo order ${sellerApproval.order.id}; total EUR ${(sellerApproval.order.offer.grandTotal / 100).toFixed(2)}.`,
  );
  console.log(
    "Allocated 80 Forma demo chairs. Existing data was not reset or deleted.",
  );
}

main().catch(async (error) => {
  if (createdRequestId && !confirmed) {
    try {
      await call("buyer", `requests/${createdRequestId}/cancel`, {
        method: "POST",
        body: {},
      });
    } catch {
      /* Preserve the original failure. */
    }
  }
  console.error(
    `FAIL: ${error instanceof Error ? error.message : "API smoke failed"}`,
  );
  if (createdRequestId)
    console.error(`Diagnostic request retained: ${createdRequestId}`);
  process.exitCode = 1;
});
