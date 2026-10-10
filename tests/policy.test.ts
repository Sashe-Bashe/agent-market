import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTerms, calculateTotal } from "../src/lib/policy";
import type { Product, Policy, RequestInput } from "../src/lib/types";
const product: Product = {
  id: "p",
  workspaceId: "s",
  supplierName: "Seller",
  name: "Chair",
  sku: "C1",
  stock: 100,
  material: "polypropylene",
  color: "Slate",
  stackable: true,
  unitPrice: 9500,
  deliveryCharge: 24000,
  leadDays: 12,
  destinations: ["Sofia"],
};
const policy: Policy = {
  minUnitPrice: 8300,
  discountMinQuantity: 50,
  minDeposit: 30,
  maxDiscountPercent: 20,
};
const request: RequestInput = {
  title: "Chairs",
  description: "80 chairs",
  buyerType: "business",
  quantity: 80,
  material: "polypropylene",
  stackable: true,
  destination: "Sofia",
  latestDelivery: "2099-10-24",
  maxBudget: 700000,
  maxDeposit: 100,
  preference: "lower_deposit",
};
const terms = {
  unitPrice: 8300,
  quantity: 80,
  deliveryDate: "2099-10-22",
  depositPercent: 30,
};
test("integer arithmetic produces 6880 EUR final total", () =>
  assert.equal(calculateTotal(8300, 80, 24000), 688000));
test("valid bilateral offer satisfies policies", () =>
  assert.deepEqual(
    validateTerms(terms, product, policy, request, "both", "2099-10-10"),
    [],
  ));
for (const [label, patch] of [
  ["floor", { unitPrice: 8000 }],
  ["quantity", { quantity: 81 }],
  ["lead time", { deliveryDate: "2099-10-15" }],
  ["deadline", { deliveryDate: "2099-10-25" }],
  ["deposit", { depositPercent: 20 }],
] as const)
  test("rejects invalid " + label, () =>
    assert.ok(
      validateTerms(
        { ...terms, ...patch },
        product,
        policy,
        request,
        "both",
        "2099-10-10",
      ).length,
    ),
  );
test("buyer cannot commit above private budget", () =>
  assert.ok(
    validateTerms(
      { ...terms, unitPrice: 9500 },
      product,
      policy,
      request,
      "buyer",
      "2099-10-10",
    ).length,
  ));
test("seller may send expensive offer but buyer cannot approve it", () =>
  assert.deepEqual(
    validateTerms(
      { ...terms, unitPrice: 9500 },
      product,
      policy,
      request,
      "seller",
      "2099-10-10",
    ),
    [],
  ));
test("discount quantity condition is enforced", () =>
  assert.ok(
    validateTerms(
      { ...terms, quantity: 20 },
      product,
      policy,
      { ...request, quantity: 20 },
      "seller",
      "2099-10-10",
    ).length,
  ));
