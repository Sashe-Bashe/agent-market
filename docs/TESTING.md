# Testing Agent Market

Run the automated checks from the repository root:

```sh
npm test
npm run typecheck
npm run build
```

The test suite uses Node's test runner through `tsx`. Database-backed tests assign a unique SQLite path inside `work/` before dynamically importing application modules, restore edited catalogue settings between cases, and remove their temporary databases afterward. They do not open or reset the normal demo database.

| Suite                      | Meaningful checks                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/policy.test.ts`     | Integer-cent totals, seller floor and discount conditions, quantity, delivery, deposit, and private buyer limits.                                                                                                                                            |
| `tests/integrity.test.ts`  | Workspace permissions, forged actors, private DTOs, immutable offer versions, expiry, exact approvals, cancellation, one winning supplier, stock changes, independent-process duplicate approvals and inventory contention, independent-process persistence. |
| `tests/worker.test.ts`     | Separate role contexts, real deterministic negotiation, changed seller rules, impossible requests, bounded calls and rounds, cancellation, restart, expired lease recovery, concurrent runners, and adversarial counterparty messages.                       |
| `tests/auth.test.ts`       | Opaque hashed sessions, expiry, workspace binding, browser-facing same-origin enforcement, and production rejecting demo sign-in and previously valid demo sessions.                                                                                         |
| `tests/provider.test.ts`   | Deterministic behavior and live-adapter contract checks: scoped JSON, schema validation, sender-policy checks, sanitized public reasons, bounded retries, call accounting, token limits, and timeout.                                                        |
| `tests/extraction.test.ts` | Explicit field extraction, missing-field reporting, and warnings for unsupported characteristics.                                                                                                                                                            |

The live-adapter tests replace HTTP responses locally and use a dummy key. They verify request construction and failure handling; they do **not** verify a real model response or make paid API calls. Actual provider access requires valid server-side credentials and is a separate verification step.

## Repeatable HTTP smoke test

The smoke script exercises the running Next.js API and durable worker using independent sessions for the buyer and all three suppliers. It sends browser-style `Origin` headers on writes and checks that a foreign origin is rejected. It also checks extraction and field confirmation, request creation, matching, two-agent negotiation, the feasible/unacceptable comparison, privacy and unauthorized access responses, both human approvals, duplicate approval, order visibility, and persistence after a fresh sign-in.

Start the web app and worker with a fresh disposable database and no live provider credentials. The following command creates a new database directory on every run:

```sh
mkdir -p work
smoke_dir=$(mktemp -d "$PWD/work/api-smoke.XXXXXX")
DATABASE_PATH="$smoke_dir/market.sqlite" OPENAI_API_KEY="" DEMO_MODE=true npm run dev
```

Then, in another terminal:

```sh
npx tsx scripts/api-smoke.ts
```

For a different local port or a slower machine:

```sh
BASE_URL=http://127.0.0.1:3001 API_SMOKE_TIMEOUT_MS=90000 npx tsx scripts/api-smoke.ts
```

The default URL is `http://127.0.0.1:3000`. Startup readiness is retried for up to 90 seconds; completed negotiations are awaited for 45 seconds by default. The script refuses to proceed when demo mode is disabled or a live provider is configured. Both the web process and worker must use the same `DATABASE_PATH`.

**A successful HTTP smoke creates one persistent internal demo order and allocates 80 Forma chairs.** It does not reset or delete existing data. Requests have unique titles; a failed unfinished request is cancelled and retained for inspection. To rerun reliably, use a new disposable database or deliberately reset a database that contains only demo data. The default Forma stock supports three successful runs before replenishment.

The script prints the request ID, order ID, negotiated total, and number of successful HTTP checks. These orders do not take payment or create real fulfillment.

## Production demo-mode boundary

`npm run build` checks the production bundle. `tests/auth.test.ts` separately launches a real Node subprocess with `NODE_ENV=production` and `DEMO_MODE=true` to verify that production still hides demo accounts, denies new demo sign-ins, and rejects a valid development session. The MVP intentionally has no production authentication replacement, so the interactive demonstration runs through `npm run dev`.

## Browser demonstration

With a development preview running, perform this flow:

1. Explicitly select the buyer demo account, create and review the 80-chair request, and launch it.
2. Verify the eligibility reasons and watch both supplier rooms. Compare the valid Forma offer with Nord's no-agreement outcome.
3. Approve Forma's current offer as the buyer. Confirm there is still no order.
4. Explicitly switch to Forma Supply, open its inbox, review that exact offer, and approve it.
5. Confirm the internal demo order, refresh, and switch back to the buyer to verify the same persisted order.

Browser execution is separate from the HTTP script. Automated service persistence tests additionally reload the data through a new application process; merely refreshing a browser is not treated as evidence of worker restart recovery.

## Verified in this implementation session

On 10 October 2026:

- `npm test`: 60 tests passed, including six concurrent fresh-database processes.
- `npm run typecheck`: passed.
- `npm run build`: passed, Next.js 16.4.0.
- HTTP API smoke: 49 checks passed through the real web server and worker. After this run, the script was strengthened to send browser Origin headers and gained a foreign-origin sign-in check. That origin boundary also passed four isolated auth tests and the complete browser flow.
- Personal Chrome browser: new request → extract → review → match → inspect eligibility/activity → compare → buyer approval → switch account → supplier approval → order history → full refresh → buyer confirmed order. Browser order total €6,880, 30% deposit, delivery 12 days from the run. A mobile 390 × 844 order-history view was checked, then viewport restored.
- Obscura was used first. Its installed build lacks screenshot rendering and the fetched Next.js page remained at the hydration loading state, so interactive testing used the configured personal Chrome controls.
- No real OpenAI request was made. Provider transport tests use controlled responses. No payment or real fulfilment was triggered.

The confirmed demo order and original HTTP smoke order remain in the preview database; 80 Forma chairs remain. Reset is deliberate through Demo tools or `npm run db:reset`.
