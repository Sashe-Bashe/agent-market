import type { RequestInput } from "./types";
const addDays = (n: number) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
export function extractRequest(text: string) {
  const fields: Partial<RequestInput> = {
      description: text,
      buyerType: "business",
    },
    notes: string[] = [];
  const quantity = text.match(
    /\b(\d+)\s+(?:(?:stackable|office|polypropylene|wooden|fabric|black|white)\s+)*chairs?\b/i,
  );
  if (quantity) fields.quantity = Number(quantity[1]);
  const budget =
    text.match(
      /(?:maximum|max(?:imum)?\s+budget|budget(?:\s+of)?|up\s+to)\s*[:=]?\s*(?:€|EUR\s*)?([\d,]+(?:\.\d{1,2})?)/i,
    ) || text.match(/€\s*([\d,]+(?:\.\d{1,2})?)/);
  if (budget)
    fields.maxBudget = Math.round(Number(budget[1].replaceAll(",", "")) * 100);
  if (/(?:€|EUR)\s*\d{1,3}\.\d{3}|\d+,\d{1,2}\b/.test(text)) {
    delete fields.maxBudget;
    notes.push(
      "The budget number format is ambiguous. Enter the exact EUR amount in the review form.",
    );
  }
  const days = text.match(/within\s+(\d+)\s+days?/i);
  const date = text.match(/\b(?:by|before)\s+(\d{4}-\d{2}-\d{2})/i);
  if (days) fields.latestDelivery = addDays(Number(days[1]));
  else if (date) fields.latestDelivery = date[1];
  const destination = text.match(
    /(?:delivered?\s+to|delivery\s+to|destination\s*:)\s*([\p{L} -]+?)(?=\s+(?:within|by|before|with|maximum)|[,.;\n]|$)/iu,
  );
  if (destination) fields.destination = destination[1].trim();
  if (/\bstackable\b/i.test(text))
    fields.stackable = !/\bnot\s+stackable\b/i.test(text);
  if (/\bpolypropylene\b/i.test(text)) fields.material = "polypropylene";
  else if (/\bwood(?:en)?\b/i.test(text)) fields.material = "wood";
  else if (/\bfabric\b/i.test(text)) fields.material = "fabric";
  const deposit = text.match(
    /(?:max(?:imum)?\s+)?(?:deposit\s+(?:of\s+)?(?:up to\s+)?)?(\d+)\s*%\s*(?:deposit)?/i,
  );
  if (deposit) fields.maxDeposit = Number(deposit[1]);
  fields.title = fields.quantity
    ? `${fields.quantity} ${fields.stackable ? "stackable " : ""}chairs`
    : "Office chair purchase";
  if (/low(?:er)?\s+deposit/i.test(text)) fields.preference = "lower_deposit";
  else if (/(?:earliest|fastest)\s+delivery/i.test(text))
    fields.preference = "earliest_delivery";
  else if (/(?:lowest|cheapest)\s+(?:price|total)/i.test(text))
    fields.preference = "lowest_total";
  if (
    /\b(?:armrests|ergonomic|warranty|certified|recycled|fireproof|leather|adjustable|steel|metal|upholstered|black|white|grey|gray|blue|red|green|beige|color|colour|desks|tables)\b/i.test(
      text,
    )
  )
    notes.push(
      "This request includes characteristics outside the supported material and stacking fields. Do not launch until those requirements are resolved; this demo cannot validate them.",
    );
  notes.push(
    "Review every field. Only the confirmed structured specifications are disclosed and matched. Your original text stays private.",
  );
  const required: (keyof RequestInput)[] = [
    "quantity",
    "destination",
    "latestDelivery",
    "maxBudget",
    "material",
    "stackable",
    "maxDeposit",
    "preference",
  ];
  return {
    fields,
    missing: required.filter((k) => fields[k] === undefined),
    notes,
  };
}
