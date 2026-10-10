# Core test contract

Exports from src/lib/service.ts (sync unless engine):
accountFor(userId:string): Actor
createRequest(actor:Actor,input:RequestInput): PurchaseRequest
getRequest(actor,id): RequestDetail
listRequests(actor): PurchaseRequest[]
launchRequest(actor,id): void
getRoom(actor,id): SellerRoomDetail
getCatalogue(actor): {product:Product,policy:Policy}[]
updateCatalogue(actor,productId,{product:productSchema fields,policy:Policy}): void
approve(actor,roomId,offerId): {order:Order|null}
reviseOffer(actor,roomId,terms:Terms):void
listOrders(actor):Order[]
cancelRequest(actor,id):void
createOffer(roomId,sender:'buyer'|'seller',terms:Terms):Offer (internal trusted engine interface; server sender validated via separate human revise endpoint)
markAgreement(roomId,offerId): void
getProduct(id):Product
getPolicy(productId):Policy
getStoredRequest(id):PurchaseRequest
publicRequest(request):PublicRequest (reconstruct disclosed title/description from fields; no raw text budget)
readOffers(roomId):Offer[]
readMessages(roomId):Message[]
Exports db.ts: db better-sqlite3 instance; seed(); resetDemo(); addDays(n), now(), id().
Engine exports async runOneJob():Promise<boolean> processes exactly one turn; drainJobs(max=100):Promise<number> for tests. Set DATABASE_PATH to dedicated test file BEFORE dynamic import; NODE_ENV=test; OPENAI_API_KEY='' for deterministic. Seeded actors IDs buyer, forma, nord, atelier, workspaces ws-buyer ws-forma ws-nord ws-atelier; products prod-forma/nord/atelier. Reset deletes request/offer/order data + restores stock; preserves edited policies/catalogue, so restore config in tests if edited. Default request qty80 material polypropylene stackable true Sofia deadline addDays(14), maxBudget700000 maxDeposit100 pref lower_deposit. launch creates 2 rooms and jobs, excludes atelier. read request rooms. Fixed offer path: launch then createOffer eligible room seller terms8300 qty80 addDays(12) deposit30; markAgreement; approve both actors. Negotiations must be awaiting_approval to approve. SQLite trigger blocks offer UPDATE; to test expiry create offer with old timestamp via direct INSERT or use mock Date before creating.
