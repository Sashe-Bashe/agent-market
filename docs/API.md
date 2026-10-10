# UI contract

All data uses types from src/lib/types.ts. Money is integer cents. REST returns JSON; errors {error:string}. Fetch credentials same-origin. POST/PATCH JSON content-type. Responses never wrap unless documented. Local demo requires explicit selection; GET bootstrap is initially account:null.

GET /api/bootstrap -> Bootstrap
POST /api/session {accountId:string} -> {ok:true}; refresh bootstrap after.
GET /api/requests -> PurchaseRequest[] (buyer own)
POST /api/requests RequestInput -> PurchaseRequest (draft, private to buyer)
PATCH /api/requests/:id RequestInput -> PurchaseRequest (only draft/no_match/declined/failed/cancelled, room deletion on edit)
POST /api/extract {text:string} -> {fields:Partial<RequestInput>,missing:string[],notes:string[]} (no fabricated destination; default primary sample specify Sofia in UI)
GET /api/requests/:id -> RequestDetail
POST /api/requests/:id/launch {} -> {ok:true} (matching synchronous, job async)
POST /api/requests/:id/cancel {} -> {ok:true}
GET /api/catalogue -> {product:Product,policy:Policy}[] (seller own; seeded one each)
PATCH /api/catalogue/:productId {product: productSchema fields,policy:Policy} -> {ok:true}
GET /api/inbox -> {request:PublicRequest,room:Room}[] (seller own)
GET /api/rooms/:roomId -> SellerRoomDetail (also authorized buyer; public request only)
POST /api/rooms/:roomId/approve {offerId:string} -> {order:Order|null} (exact current offer; explicit human click)
POST /api/rooms/:roomId/decline {} -> {ok:true}
POST /api/rooms/:roomId/retry {} -> {ok:true} (failed only; new run retains previous history but invalidates approvals)
POST /api/rooms/:roomId/revise {terms:Terms} -> {ok:true} (seller only, awaiting approval; new immutable version, approval reset)
GET /api/orders -> Order[] (actor's workspace)
POST /api/demo/scenario {scenario:'primary'|'low_budget'|'impossible_delivery'|'stock_change'|'injection'} -> PurchaseRequest (creates a NEW draft; buyer only; scenario label explicit)
POST /api/demo/stock-change {roomId:string} -> {ok:true} (buyer only, stock becomes quantity-1 in selected room; deliberate test button)
POST /api/demo/injection {roomId:string} -> {ok:true} (buyer only, injects public adversarial message in own room for safety test)
POST /api/demo/reset {confirmation:'RESET DEMO DATA'} -> {ok:true} (only demo data, sessions reselected after)

UI polls detail/inbox every 1500ms while negotiating. Worker independent of HTTP, so refresh does not restart. Both explicit role approvals needed. When offers exist, comparison shows current offer, buyer validity reasons, approval status. Lowest price and best fit computed only among valid current offers; sort by preference with total tie break. UI has request form review step, clearly labelled private budget/max deposit. Scenario buttons can create form draft loaded for review/edit. Primary scenario title: 80 stackable chairs; description: Buy 80 stackable polypropylene chairs, delivered to Sofia within 14 days, maximum €7,000 including delivery. quantity80, material polypropylene, stackable true, destination Sofia, maxBudget700000, maxDeposit100, preference lower_deposit. Date relative now. Reset requires Dialog explicit confirmation. No business writes auto-run on page load.
