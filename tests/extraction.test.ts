import { test } from "node:test";
import assert from "node:assert/strict";
import { extractRequest } from "../src/lib/extract";
test("extracts explicit quantity, budget, date, material and destination for confirmation", () => {
  const r = extractRequest(
    "Buy 80 stackable polypropylene chairs, delivered to Sofia within 14 days, maximum €7,000 including delivery.",
  );
  assert.equal(r.fields.quantity, 80);
  assert.equal(r.fields.maxBudget, 700000);
  assert.equal(r.fields.destination, "Sofia");
  assert.equal(r.fields.material, "polypropylene");
  assert.equal(r.fields.stackable, true);
  assert.ok(r.fields.latestDelivery);
  assert.ok(r.missing.includes("maxDeposit"));
});
test("does not invent material requirements, budget or destination when missing", () => {
  const r = extractRequest("Buy some chairs soon");
  for (const key of [
    "destination",
    "quantity",
    "material",
    "latestDelivery",
    "maxBudget",
  ])
    assert.ok(r.missing.includes(key as never));
  assert.equal(r.fields.maxBudget, undefined);
});
test("flags unsupported requirements instead of silently pretending to match them", () => {
  const r = extractRequest(
    "80 ergonomic chairs with armrests, delivered to Sofia within 3 days.",
  );
  assert.ok(r.notes.some((n) => n.includes("outside the supported")));
});
test("ambiguous localized amounts are highlighted rather than partially extracted", () => {
  const r = extractRequest("80 chairs, budget €7.000,00");
  assert.equal(r.fields.maxBudget, undefined);
  assert.ok(r.notes.some((n) => n.includes("ambiguous")));
});
test("unsupported colour and additional product categories require review", () => {
  const r = extractRequest("80 black chairs and 20 desks, budget €7000");
  assert.ok(r.notes.some((n) => n.includes("outside the supported")));
});
