import { db, id } from "./db";
import { actionSchema, type AgentContext } from "./types";
import { getAgentAction } from "./provider";
import {
  rawRoom,
  getStoredRequest,
  publicRequest,
  getProduct,
  getPolicy,
  readOffers,
  readMessages,
  createOffer,
  markAgreement,
  finishRoom,
  addMessage,
  refreshRequestState,
  expireRooms,
} from "./service";
const limit = (name: string, fallback: number, min: number, max: number) =>
  Math.min(
    max,
    Math.max(min, Number.parseInt(process.env[name] || "", 10) || fallback),
  );
export function makeContext(roomId: string): AgentContext {
  const room = rawRoom(roomId),
    request = getStoredRequest(room.request_id),
    role = room.turn % 2 === 0 ? "seller" : "buyer";
  // Resume a run with only its own history. No competing rooms are ever fetched.
  const messages = readMessages(roomId),
    restart = messages.findLastIndex((m) => m.action === "retry"),
    activeMessages = restart >= 0 ? messages.slice(restart + 1) : messages;
  const ids = new Set(activeMessages.map((m) => m.offerId));
  const offers = readOffers(roomId).filter((o) => ids.has(o.id));
  return {
    role,
    request: publicRequest(request),
    product: getProduct(room.product_id),
    messages: activeMessages,
    offers,
    round: Math.floor(room.turn / 2),
    maxRounds: limit("AGENT_MAX_ROUNDS", 3, 1, 3),
    ...(role === "buyer"
      ? {
          privateBuyer: {
            maxBudget: request.maxBudget,
            maxDeposit: request.maxDeposit,
            preference: request.preference,
          },
        }
      : { privateSeller: getPolicy(room.product_id) }),
  };
}
export async function runOneJob(): Promise<boolean> {
  expireRooms();
  const job = db
    .transaction(() => {
      const row = db
        .prepare(
          "SELECT j.* FROM jobs j JOIN negotiations n ON n.id=j.negotiation_id WHERE n.state='negotiating' AND ((j.state='pending' AND j.available_at<=?) OR (j.state='running' AND j.lease_until<?)) ORDER BY j.available_at,j.rowid LIMIT 1",
        )
        .get(Date.now(), Date.now()) as any;
      if (!row) return null;
      const token = id();
      db.prepare(
        "UPDATE jobs SET state='running',lease_token=?,lease_until=? WHERE id=?",
      ).run(token, Date.now() + 150000, row.id);
      return { ...row, lease_token: token };
    })
    .immediate();
  if (!job) return false;
  const room = rawRoom(job.negotiation_id),
    turn = room.turn,
    run = room.run,
    ctx = makeContext(room.id),
    maxCalls = Math.min(
      limit("AGENT_MAX_CALLS", 10, 1, 20),
      ctx.maxRounds * 2 + 2,
    );
  const owned = () => {
    const current = db
      .prepare("SELECT * FROM jobs WHERE id=?")
      .get(job.id) as any;
    return (
      current?.lease_token === job.lease_token &&
      current.state === "running" &&
      rawRoom(room.id).state === "negotiating" &&
      rawRoom(room.id).turn === turn &&
      rawRoom(room.id).run === run
    );
  };
  if (turn >= maxCalls) {
    db.transaction(() => {
      if (owned())
        finishRoom(
          room.id,
          "declined",
          "Negotiation reached its configured call limit without agreement.",
        );
    }).immediate();
    return true;
  }
  try {
    const action = actionSchema.parse(
      await getAgentAction(ctx, {
        beforeModelCall: () => {
          db.transaction(() => {
            if (!owned()) throw new Error("Job lease lost");
            const result = db
              .prepare(
                "UPDATE jobs SET model_calls=model_calls+1 WHERE id=? AND model_calls<?",
              )
              .run(job.id, limit("AGENT_MAX_CALLS", 10, 1, 20));
            if (result.changes !== 1)
              throw new Error("Model call budget exhausted");
          }).immediate();
        },
      }),
    );
    db.transaction(() => {
      if (!owned()) return;
      const turnKey = `${room.id}:${run}:${turn}`;
      if (db.prepare("SELECT 1 FROM messages WHERE turn_key=?").get(turnKey)) {
        db.prepare(
          "UPDATE jobs SET state='pending',lease_token=NULL WHERE id=?",
        ).run(job.id);
        return;
      }
      let offerId: string | null = null;
      if (action.type === "propose" || action.type === "counter") {
        if (ctx.role === "buyer" && turn >= ctx.maxRounds * 2 + 1) {
          addMessage(
            room.id,
            ctx.role,
            "decline",
            "The permitted counteroffer rounds are exhausted.",
            null,
            turnKey,
          );
          finishRoom(
            room.id,
            "declined",
            "No agreement within the configured counteroffer limit.",
          );
          return;
        }
        if (!action.terms) throw new Error("Missing structured terms");
        offerId = createOffer(room.id, ctx.role, action.terms).id;
      } else if (action.type === "agree") {
        if (!action.offerId)
          throw new Error("Agreement is missing its offer reference");
        const latest = readOffers(room.id).at(-1);
        if (!latest || latest.sender === ctx.role)
          throw new Error("An agent may only accept a counterparty offer");
        markAgreement(room.id, action.offerId);
        offerId = action.offerId;
      } else if (action.type === "decline" || action.type === "human_help") {
        finishRoom(
          room.id,
          "declined",
          action.type === "human_help"
            ? "Human help is needed. Review requirements and create a revised request."
            : "The parties could not agree within their requirements.",
        );
      }
      addMessage(
        room.id,
        ctx.role,
        action.type,
        action.reason,
        offerId,
        turnKey,
      );
      db.prepare("UPDATE negotiations SET turn=turn+1 WHERE id=?").run(room.id);
      if (rawRoom(room.id).state === "negotiating")
        db.prepare(
          "UPDATE jobs SET state='pending',lease_token=NULL,lease_until=0,attempts=0,available_at=? WHERE id=?",
        ).run(Date.now() + 300, job.id);
      refreshRequestState(room.request_id);
    }).immediate();
  } catch {
    // Never persist provider request bodies, model text, budgets, floors, or raw exception diagnostics.
    db.transaction(() => {
      if (!owned()) return;
      const attempts = job.attempts + 1;
      if (attempts >= 2) {
        finishRoom(
          room.id,
          "failed",
          "The agent could not produce a valid action after two attempts. Review the rules and retry.",
        );
      } else
        db.prepare(
          "UPDATE jobs SET state='pending',lease_token=NULL,lease_until=0,attempts=?,available_at=?,last_error='Agent action rejected or provider unavailable' WHERE id=?",
        ).run(attempts, Date.now() + 1000, job.id);
    }).immediate();
  }
  return true;
}
export async function drainJobs(max = 100) {
  let count = 0;
  while (count < max) {
    db.prepare("UPDATE jobs SET available_at=0 WHERE state='pending'").run();
    if (!(await runOneJob())) break;
    count++;
  }
  return count;
}
