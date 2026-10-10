# Agent Market implementation plan

Goal: a local, persistent B2B procurement demonstration with separate buyer and seller agents, private policies, exact-version bilateral approval, and internal order records.

Architecture: Next.js / TypeScript, Tailwind and Radix UI, SQLite with SQL migrations, Zod schemas, a separate durable database-backed worker, and a server-only model adapter. No paid services or deployment. Demo sessions disabled in production. Fixed EUR final prices including tax; no legal tax calculation.

1. Establish public/shared schemas, SQL migration, seeded accounts and products. Test policy arithmetic and rejection boundaries before completing implementations.
2. Implement sessions and workspace-authorized services, explicit DTO projections, immutable offers, approval transactions, inventory allocation and unique winning orders. Tests cover access isolation, expiry, stale versions, competing stock and duplicate approval.
3. Implement isolated role contexts and structured provider actions. Worker leases jobs, records a turn exactly once, bounds calls/rounds/retries, and survives restart. Both providers use identical validators.
4. Build buyer requests / review / eligibility / comparison / room / orders and seller catalogue / private rules / inbox / approvals. Use a quiet navy, mist grey, white, blue and teal procurement workspace with readable sans typography, a fixed navigation rail, and a comparison table as the primary work surface. No marketing homepage.
5. Run typecheck, tests, production build, local API and browser flow. Add README, demo script and limitations; leave local preview running.

Shared contracts: src/lib/types.ts for DTOs and schemas; src/lib/db.ts for persistence; src/lib/service.ts for authorization and transactions; src/lib/engine.ts for durable turns; src/lib/provider.ts for agent actions; src/app/api/[...path]/route.ts for REST. UI only consumes public DTOs. Engine never exposes private contexts as message text. Each supplier sees one room and only its own policies. Models cannot directly order or approve.

Review focus: prompt injection and secret leakage; changed policies after an offer; expired jobs and crashes; simultaneous approvals and inventory changes; ambiguous requirements and impossible deadlines.
