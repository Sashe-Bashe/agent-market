import { z } from "zod";
export const money = z.number().int().min(0).max(100_000_000);
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Use a valid calendar date",
  );
export const requestSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(3).max(3000),
    buyerType: z.literal("business").default("business"),
    quantity: z.number().int().min(1).max(10000),
    material: z.enum(["any", "polypropylene", "wood", "fabric"]),
    stackable: z.boolean(),
    destination: z.string().trim().min(2).max(100),
    latestDelivery: dateOnly,
    maxBudget: money.refine((v) => v > 0),
    maxDeposit: z.number().int().min(0).max(100),
    preference: z.enum(["lowest_total", "lower_deposit", "earliest_delivery"]),
  })
  .strict();
export type RequestInput = z.infer<typeof requestSchema>;
export const productSchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    sku: z.string().trim().min(2).max(40),
    material: z.enum(["polypropylene", "wood", "fabric"]),
    stackable: z.boolean(),
    color: z.string().trim().min(2).max(40),
    stock: z.number().int().min(0).max(100000),
    unitPrice: money.refine((v) => v > 0),
    deliveryCharge: money,
    leadDays: z.number().int().min(1).max(90),
    destinations: z.array(z.string().trim().min(2).max(100)).min(1).max(20),
  })
  .strict();
export const policySchema = z
  .object({
    minUnitPrice: money.refine((v) => v > 0),
    discountMinQuantity: z.number().int().min(1).max(10000),
    minDeposit: z.number().int().min(0).max(100),
    maxDiscountPercent: z.number().int().min(0).max(100),
  })
  .strict();
export type Policy = z.infer<typeof policySchema>;
export type Product = z.infer<typeof productSchema> & {
  id: string;
  workspaceId: string;
  supplierName: string;
};
export type RequestState =
  | "draft"
  | "matching"
  | "negotiating"
  | "awaiting_approval"
  | "ordered"
  | "no_match"
  | "declined"
  | "expired"
  | "cancelled"
  | "failed";
export type RoomState =
  | "negotiating"
  | "awaiting_approval"
  | "ordered"
  | "declined"
  | "expired"
  | "cancelled"
  | "failed";
export type Account = {
  id: string;
  name: string;
  workspaceName: string;
  workspaceId: string;
  role: "buyer" | "seller";
};
export type Actor = Account;
export type Offer = {
  id: string;
  negotiationId: string;
  version: number;
  sender: "buyer" | "seller";
  productId: string;
  sku: string;
  productName: string;
  specifications: { material: string; stackable: boolean; color: string };
  quantity: number;
  currency: "EUR";
  unitPrice: number;
  lineTotal: number;
  deliveryCharge: number;
  taxTreatment: string;
  grandTotal: number;
  deliveryDate: string;
  depositPercent: number;
  expiresAt: string;
  createdAt: string;
};
export type Approval = {
  workspaceId: string;
  role: "buyer" | "seller";
  offerId: string;
  createdAt: string;
};
export type Message = {
  id: string;
  role: "buyer" | "seller" | "system";
  action: string;
  text: string;
  createdAt: string;
  offerId: string | null;
};
export type Eligibility = {
  supplierId: string;
  supplierName: string;
  productId: string;
  eligible: boolean;
  reasons: string[];
};
export type PurchaseRequest = RequestInput & {
  id: string;
  workspaceId: string;
  state: RequestState;
  createdAt: string;
  eligibility: Eligibility[];
};
export type PublicRequest = Omit<
  PurchaseRequest,
  "maxBudget" | "maxDeposit" | "preference"
>;
export type Room = {
  id: string;
  requestId: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  state: RoomState;
  turn: number;
  reason: string | null;
  offers: Offer[];
  messages: Message[];
  approvals: Approval[];
  currentOffer: Offer | null;
  valid: boolean;
  invalidReasons: string[];
};
export type Order = {
  id: string;
  requestId: string;
  negotiationId: string;
  offerId: string;
  buyerId: string;
  supplierId: string;
  supplierName: string;
  buyerName: string;
  offer: Offer;
  createdAt: string;
  status: "confirmed_demo";
};
export type RequestDetail = {
  request: PurchaseRequest;
  rooms: Room[];
  order: Order | null;
};
export type SellerRoomDetail = { request: PublicRequest; room: Room };
export type Bootstrap = {
  account: Account | null;
  accounts: Account[];
  demoMode: boolean;
  provider: "deterministic" | "openai";
  model: string | null;
};
export const termsSchema = z
  .object({
    unitPrice: money.refine((v) => v > 0),
    quantity: z.number().int().min(1).max(10000),
    deliveryDate: dateOnly,
    depositPercent: z.number().int().min(0).max(100),
  })
  .strict();
export type Terms = z.infer<typeof termsSchema>;
export const actionSchema = z
  .object({
    type: z.enum([
      "ask_clarification",
      "answer",
      "propose",
      "counter",
      "agree",
      "decline",
      "human_help",
    ]),
    reason: z.string().max(500),
    offerId: z.string().nullable(),
    terms: termsSchema.nullable(),
  })
  .strict();
export type AgentAction = z.infer<typeof actionSchema>;
export type AgentContext = {
  role: "buyer" | "seller";
  request: PublicRequest;
  product: Product;
  messages: Message[];
  offers: Offer[];
  round: number;
  maxRounds: number;
  privateBuyer?: {
    maxBudget: number;
    maxDeposit: number;
    preference: RequestInput["preference"];
  };
  privateSeller?: Policy;
};
export const TAX_TREATMENT =
  "Demo final price, tax included. No separate tax calculation.";
export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n / 100);
