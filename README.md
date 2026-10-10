# Agent Market

A working local B2B purchasing marketplace with two distinct negotiating agent roles, private commercial rules, persistent offers, explicit buyer and seller approval, and internal demo orders. All seeded businesses and inventory are fictional. EUR only; one stocked-chair category. No payment or fulfilment occurs.

## Run locally

Requires Node.js 22 LTS (20.9+ is supported by Next.js) and npm. SQLite runs locally; no cloud service is needed.

```sh
npm install
cp .env.example .env
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3000 and explicitly choose **Forma Studio / Maya Chen**. `npm run dev` starts both Next.js and the durable job worker. Keep both running. Stop with Ctrl+C. Database migrations and idempotent seed creation also run automatically when opening the database.

```sh
npm test
npm run typecheck
npm run build
```

`npm run start` runs the production build plus worker. **Demo account selection and demo sessions are always disabled when NODE_ENV=production.** This MVP intentionally does not supply production authentication, so use `npm run dev` for the demonstration. Do not use it as a public commercial deployment.

## Three-minute demo

1. Sign in to the buyer workspace, select **New request**, and use the 80-chair example. Extract requirements and review the fields, including Sofia, 80 stackable polypropylene chairs, a date 14 days from today, and €7,000 including delivery. Private deposit cap is explicitly reviewed. Save and find suppliers.
2. The engine matches Forma Supply and Nord Office. Atelier Works is excluded: 45 chairs available and 21-day delivery. Read the eligibility reasons.
3. Open each negotiation. Seller and buyer alternate structured offers using separate contexts. With seeded rules the deterministic provider produces a valid €6,880 offer (80 × €83 + €240 delivery), 30% deposit, delivery in 12 days. Nord cannot meet the budget and declines. Activity comes from persisted actions, never an animation.
4. Compare offers and approve Forma’s exact current version as the buyer. No order exists yet.
5. Use the profile menu to **Switch demo workspace** to Forma Supply / Elias Novak. Open the negotiation inbox, inspect the exact offer, and approve it as the seller.
6. View the internal confirmed demo order. Switch back to the buyer and refresh: the order, both approvals, terms, and activity remain. Other negotiations close, stock is allocated once, and no money is moved.

The initial catalogue supports three primary purchases before Forma runs out of stock. Use a deliberate demo reset before replaying a fresh scenario.

## Resettable scenarios

Open **Demo tools** in the buyer workspace:

- **Primary**: feasible Forma deal, incompatible Nord, excluded Atelier.
- **Low budget**: €4,000 produces no commercial agreement.
- **Impossible delivery**: two-day deadline produces no eligible suppliers.
- **Stock change**: negotiate, approve as one party, then use the explicit stock-change test in the buyer’s room. Old approvals are removed, and that offer remains invalid even if stock is restored. Restore stock in the seller catalogue, revise the offer, and approve the new version as both parties.
- **Untrusted message**: launch the scenario to place an adversarial message in each room before the first agent turn. The message asks agents to disclose private limits and bypass approval; the deterministic provider ignores it and policy enforcement still applies.

Reset in the UI requires typing `RESET DEMO DATA`. CLI equivalent:

```sh
npm run db:reset
```

Reset removes requests, rooms, jobs, offers, approvals, orders and sessions for explicitly marked demo buyer workspaces; restores seed stock; **preserves catalogue and private-rule edits**. It never targets unmarked workspace data. For repeatable tests, automated suites use isolated temporary databases and restore catalogue configuration.

Branding is centralized in `src/lib/brand.ts`; visual tokens are in `src/app/globals.css`.

## Architecture and trust boundaries

- `src/lib/types.ts`: shared Zod input/action schemas, typed DTOs, integer cents.
- `migrations/001_initial.sql`, `src/lib/db.ts`: SQLite WAL, relational tables, migration tracking, idempotent seeded users/workspaces/memberships, catalogue, policies, requests, negotiations, messages, immutable offer versions, approvals, orders, inventory allocations and jobs.
- `src/lib/auth.ts`: random server-issued, hashed, HttpOnly, SameSite session tokens. An explicit local account selection creates a session; client workspace IDs never authorize an operation. Memberships are rechecked at the service boundary. Demo switching is disabled in production.
- `src/lib/service.ts`: permission-scoped DTOs, hard-requirement matching, sender policy validation, exact-version human approvals and immediate SQLite order transactions. Unique constraints enforce one order per request/room/offer and one allocation per order. Conditional stock decrement prevents overselling across processes.
- `src/lib/engine.ts`, `scripts/worker.ts`: database-backed runner, up to three concurrent turns, 150-second leases, per-turn unique keys, ownership fencing, bounded retries and durable physical model-call accounting. HTTP starts jobs and returns; closing or refreshing the page does not restart work.
- `src/lib/provider.ts`: role-separated deterministic or OpenAI providers. Both return the same structured action vocabulary and pass independent runtime validation. Models cannot approve or create orders.
- `src/app/api/[...path]/route.ts`: authenticated REST, schema validation, same-origin write checks, non-cacheable private responses.
- `src/components`: buyer and seller workspaces using Tailwind CSS, Radix dialogs and Lucide icons.

Seller contexts receive only reviewed disclosed specifications, public product facts, their own policy, and their own room history. Raw buyer text/title can contain a budget, so the seller-visible description is reconstructed from reviewed fields. Buyer contexts receive their own private limits and public supplier facts, never supplier-private rules. Rival room histories and private data are never fetched into a role context. Persisted diagnostics exclude model request bodies and secrets. Model-generated free-form reasons are replaced with public action descriptions so accidental private numeric prose cannot become a public message. Terms still carry unavoidable commercial inference; this is not a claim that negotiation prevents inference or guarantees prompt-injection immunity for every live model.

Offers use one product line, server-calculated totals, fixed delivery charge, and an explicit final tax-inclusive demo price. Taxes are not calculated. Outbound offers must pass the sender’s policies; incoming offers may be unacceptable to the recipient, but both constraints are checked before agreement and again before ordering. Catalogue/availability changes invalidate active offers and clear approvals; restoration never revives an invalidated version. Offer expiry is 24 hours. Exploration never reserves stock.

Requests and rooms have separate lifecycle states. Launch requires a draft; edits require a non-active, non-ordered request; cancellation stops pending work; approval requires an active agreement; supplier revisions create a new immutable version and require two fresh human approvals. Failed jobs expose a safe retry action. A retry starts a new bounded attempt and clears approval/current-offer state while retaining history.

## Deterministic and live AI

Without `OPENAI_API_KEY`, the interface explicitly says **Deterministic demo provider / No live AI**. Buyer and seller policies choose actions from current catalogue, requirements, history and limits. Editing stock, delivery, floors, discount quantity or budget changes outcomes.

To use the real provider, set these values only in the server `.env` and restart `npm run dev`:

```dotenv
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4.1-mini
AGENT_MAX_ROUNDS=3
AGENT_MAX_CALLS=10
AGENT_MAX_TOKENS=600
AGENT_TIMEOUT_MS=20000
AGENT_MODEL_RETRIES=1
```

The live adapter calls the official OpenAI Chat Completions API with `json_schema` strict structured outputs and `store:false`. Choose a model supporting that API and structured outputs. Each physical HTTP attempt (including retries) consumes the durable per-room model-call budget. Model requests are bounded by a timeout, at most one provider retry, at most two attempts at a rejected turn, and at most three counteroffer rounds. The token setting caps completion tokens per call (128–2,000); prompt history is bounded to 20 messages/24 offers and 60,000 serialized characters. No secrets use a `NEXT_PUBLIC_` variable.

A failed or schema-invalid live action cannot bypass policy or silently fall back to deterministic AI. The room reports failure after bounded attempts. A live deal is not guaranteed. Real provider calls were not made during development because no credentials were configured; mocked transport tests verify shape, scope, timeout, retries and independent policy validation.

## Limitations

This is a local hackathon MVP, not a production marketplace. There is no production identity provider, payments, escrow, actual fulfilment, tax engine, legal-contract interpretation, external-agent interoperability or ERP integration. Seeded accounts have fixed buyer/seller personas; the relational workspace/membership model can be extended to more membership roles. Consumer type is reserved in the design but only `business` requests are accepted.

Natural-language extraction is a transparent deterministic parser. Missing fields are shown for human review; only material, stackability, quantity, city and delivery deadline are hard matched. Unsupported characteristics need manual resolution before launch. Structured fields are authoritative. Supplier capabilities use city lists and calendar-day lead times without carrier or holiday integrations. Best fit follows the reviewed preference and total-price tie breaker; lowest price is separately labelled.

SQLite and its worker are intended for one machine sharing one database file. Jobs provide at-most-once committed turns; a crash after an external API response but before commit can cause a repeat external model call, with call-budget accounting preserved. Use a production queue and full identity/audit controls before multi-host use.

Implementation references: [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). The installed Next.js 16.4 documentation was checked for async route params and request/response handling.
