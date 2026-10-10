import {
  termsSchema,
  type Terms,
  type Product,
  type Policy,
  type RequestInput,
} from "./types";
export function calculateTotal(
  unitPrice: number,
  quantity: number,
  deliveryCharge: number,
) {
  const result = unitPrice * quantity + deliveryCharge;
  if (
    ![unitPrice, quantity, deliveryCharge, result].every(
      Number.isSafeInteger,
    ) ||
    unitPrice < 0 ||
    quantity < 1 ||
    deliveryCharge < 0
  )
    throw new Error("Invalid money arithmetic");
  return result;
}
export function validateTerms(
  input: Terms,
  product: Product,
  policy: Policy,
  request: RequestInput,
  side: "buyer" | "seller" | "both",
  today = new Date().toISOString().slice(0, 10),
): string[] {
  const parsed = termsSchema.safeParse(input);
  if (!parsed.success) return ["Offer terms are malformed"];
  const t = parsed.data,
    reasons: string[] = [];
  if (t.quantity !== request.quantity)
    reasons.push("Quantity does not match the request");
  if (t.quantity > product.stock)
    reasons.push(
      "Insufficient stock; a revised offer and fresh approvals are required",
    );
  if (request.material !== "any" && request.material !== product.material)
    reasons.push("Required material is unavailable");
  if (request.stackable && !product.stackable)
    reasons.push("Product must be stackable");
  if (
    !product.destinations.some(
      (d) => d.toLowerCase() === request.destination.toLowerCase(),
    )
  )
    reasons.push("Destination is outside supplier delivery coverage");
  const earliest = new Date(Date.parse(today) + product.leadDays * 86400000)
    .toISOString()
    .slice(0, 10);
  if (t.deliveryDate < earliest)
    reasons.push("Proposed date is earlier than the supplier can deliver");
  if (t.deliveryDate > request.latestDelivery)
    reasons.push("Delivery misses the buyer deadline");
  if (side !== "buyer") {
    const floor = Math.max(
      policy.minUnitPrice,
      Math.ceil((product.unitPrice * (100 - policy.maxDiscountPercent)) / 100),
      t.quantity < policy.discountMinQuantity ? product.unitPrice : 0,
    );
    if (t.unitPrice < floor)
      reasons.push("Price does not satisfy supplier commercial policy");
    if (t.depositPercent < policy.minDeposit)
      reasons.push("Deposit does not satisfy supplier commercial policy");
  }
  if (side !== "seller") {
    if (
      calculateTotal(t.unitPrice, t.quantity, product.deliveryCharge) >
      request.maxBudget
    )
      reasons.push("Total exceeds your private budget");
    if (t.depositPercent > request.maxDeposit)
      reasons.push("Deposit exceeds your private limit");
  }
  return reasons;
}
