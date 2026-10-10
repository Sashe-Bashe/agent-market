"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LockKeyhole,
  MessageSquare,
  Package,
  Pencil,
  Play,
  RefreshCw,
  ShieldCheck,
  StopCircle,
  Truck,
  X,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import type {
  Account,
  Offer,
  Order,
  PurchaseRequest,
  RequestDetail,
  Room,
  PublicRequest,
  Terms,
} from "@/lib/types";
import { fmtMoney } from "@/lib/types";
import {
  api,
  Button,
  date,
  Empty,
  ErrorBox,
  Field,
  Modal,
  SectionTitle,
  shortId,
  Status,
  Tick,
  time,
} from "./ui";
export const preferenceNames = {
  lower_deposit: "Lower deposit",
  lowest_total: "Lowest total",
  earliest_delivery: "Earliest delivery",
};
export function OfferTerms({
  offer,
  compact = false,
}: {
  offer: Offer;
  compact?: boolean;
}) {
  return (
    <div className={`offer-terms ${compact ? "compact" : ""}`}>
      <div className="terms-product">
        <Package size={18} />
        <div>
          <b>{offer.productName}</b>
          <span>
            {offer.sku} · {offer.specifications.material} ·{" "}
            {offer.specifications.color}
            {offer.specifications.stackable ? " · Stackable" : ""}
          </span>
        </div>
      </div>
      <dl>
        <div>
          <dt>Quantity</dt>
          <dd>{offer.quantity} units</dd>
        </div>
        <div>
          <dt>Unit price</dt>
          <dd>{fmtMoney(offer.unitPrice)}</dd>
        </div>
        <div>
          <dt>Product subtotal</dt>
          <dd>{fmtMoney(offer.lineTotal)}</dd>
        </div>
        <div>
          <dt>Delivery charge</dt>
          <dd>{fmtMoney(offer.deliveryCharge)}</dd>
        </div>
        <div className="total-row">
          <dt>Total incl. delivery</dt>
          <dd>{fmtMoney(offer.grandTotal)}</dd>
        </div>
        <div>
          <dt>Delivery by</dt>
          <dd>{date(offer.deliveryDate)}</dd>
        </div>
        <div>
          <dt>Deposit</dt>
          <dd>
            {offer.depositPercent}%{" "}
            <span>
              (
              {fmtMoney(
                Math.round((offer.grandTotal * offer.depositPercent) / 100),
              )}
              )
            </span>
          </dd>
        </div>
        <div>
          <dt>Offer expires</dt>
          <dd>
            {date(offer.expiresAt)}, {time(offer.expiresAt)}
          </dd>
        </div>
      </dl>
      <p className="tax-note">{offer.taxTreatment}</p>
      <p className="offer-reference">
        Offer v{offer.version} · {shortId(offer.id)} · Proposed by{" "}
        {offer.sender} agent
      </p>
    </div>
  );
}
export function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="order-row" onClick={() => setOpen(true)}>
        <div className="order-icon">
          <FileCheck2 size={22} />
        </div>
        <div>
          <b>
            {order.offer.quantity} × {order.offer.productName}
          </b>
          <span>
            {order.supplierName} · {shortId(order.id)} · {date(order.createdAt)}
          </span>
        </div>
        <Status state={order.status} />
        <strong>{fmtMoney(order.offer.grandTotal)}</strong>
        <ChevronRight size={18} />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Order ${shortId(order.id)}`}
        description="An internal demo order. No payment or actual fulfilment has occurred."
      >
        <div className="form-body">
          <div className="notice success">
            <CheckCircle2 size={20} />
            <div>
              <b>Both parties approved this exact offer</b>
              <p>
                {order.buyerName} → {order.supplierName}
              </p>
            </div>
          </div>
          <OfferTerms offer={order.offer} />
          <div className="info-note">
            <ShieldCheck size={17} />
            <p>
              Stock allocated once. This immutable order records offer v
              {order.offer.version}.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
export function ApprovalDialog({
  room,
  offer,
  account,
  onClose,
  onUpdate,
}: {
  room: Room;
  offer: Offer;
  account: Account;
  onClose: () => void;
  onUpdate: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = room.currentOffer?.id !== offer.id;
  const approved = room.approvals.some(
    (a) => a.role === account.role && a.offerId === offer.id,
  );
  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/rooms/${room.id}/approve`, "POST", { offerId: offer.id });
      await onUpdate();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      await onUpdate();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Approve offer v${offer.version}`}
      description={`${room.supplierName} · Your explicit ${account.role} approval is required.`}
    >
      <div className="form-body">
        <ErrorBox error={error} />
        {changed && (
          <ErrorBox error="Terms have changed. Close this dialog and review the latest offer." />
        )}
        {!room.valid && (
          <ErrorBox
            error={
              room.invalidReasons.join(" · ") ||
              "This offer is no longer valid."
            }
          />
        )}
        <OfferTerms offer={offer} />
        <div className="approval-strip">
          <Tick
            done={room.approvals.some(
              (a) => a.role === "buyer" && a.offerId === offer.id,
            )}
            label="Buyer approval"
          />
          <Tick
            done={room.approvals.some(
              (a) => a.role === "seller" && a.offerId === offer.id,
            )}
            label="Seller approval"
          />
        </div>
        <div className="info-note">
          <ShieldCheck size={18} />
          <p>
            Your approval applies only to these terms. An internal order is
            created after both parties approve and availability is rechecked.
          </p>
        </div>
      </div>
      <div className="modal-footer">
        <Button kind="secondary" onClick={onClose}>
          Go back
        </Button>
        <Button
          busy={busy}
          disabled={
            changed ||
            approved ||
            !room.valid ||
            room.state !== "awaiting_approval"
          }
          onClick={approve}
        >
          <Check size={17} />
          {approved ? "Already approved" : "Approve this exact offer"}
        </Button>
      </div>
    </Modal>
  );
}
function RevisionDialog({
  room,
  onClose,
  onUpdate,
}: {
  room: Room;
  onClose: () => void;
  onUpdate: () => Promise<void>;
}) {
  const offer = room.currentOffer!;
  const [terms, setTerms] = useState({
    unitPrice: offer.unitPrice / 100,
    quantity: offer.quantity,
    deliveryDate: offer.deliveryDate,
    depositPercent: offer.depositPercent,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/rooms/${room.id}/revise`, "POST", {
        terms: {
          ...terms,
          unitPrice: Math.round(terms.unitPrice * 100),
        } satisfies Terms,
      });
      await onUpdate();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Revise offer terms"
      description="A new immutable offer version clears both parties’ previous approvals."
    >
      <form onSubmit={submit}>
        <div className="form-body">
          <ErrorBox error={error} />
          <div className="form-grid">
            <Field label="Unit price (€)">
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={terms.unitPrice}
                onChange={(e) =>
                  setTerms((t) => ({ ...t, unitPrice: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="Quantity">
              <input
                required
                type="number"
                min={1}
                max={10000}
                value={terms.quantity}
                onChange={(e) =>
                  setTerms((t) => ({ ...t, quantity: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="Delivery date">
              <input
                required
                type="date"
                value={terms.deliveryDate}
                onChange={(e) =>
                  setTerms((t) => ({ ...t, deliveryDate: e.target.value }))
                }
              />
            </Field>
            <Field label="Deposit (%)">
              <input
                required
                type="number"
                min={0}
                max={100}
                value={terms.depositPercent}
                onChange={(e) =>
                  setTerms((t) => ({
                    ...t,
                    depositPercent: Number(e.target.value),
                  }))
                }
              />
            </Field>
          </div>
        </div>
        <div className="modal-footer">
          <Button type="button" kind="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            Publish revised offer
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function RoomDetail({
  room,
  request,
  account,
  onUpdate,
  demoMode = false,
}: {
  room: Room;
  request: PublicRequest | PurchaseRequest;
  account: Account;
  onUpdate: () => Promise<void>;
  demoMode?: boolean;
}) {
  const [review, setReview] = useState<Offer | null>(null);
  const [revise, setRevise] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<"stock-change" | "injection" | null>(null);
  async function act(action: string) {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/rooms/${room.id}/${action}`, "POST", {});
      await onUpdate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function runTest() {
    setBusy("test");
    try {
      await api(`/api/demo/${test}`, "POST", { roomId: room.id });
      await onUpdate();
      setTest(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const current = room.currentOffer;
  const ownApproved =
    current &&
    room.approvals.some(
      (a) => a.role === account.role && a.offerId === current.id,
    );
  return (
    <>
      <ErrorBox error={error} onDismiss={() => setError(null)} />
      <div className="room-heading">
        <div className="supplier-avatar">
          {room.supplierName
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <h3>{room.supplierName}</h3>
          <p>
            Private negotiation · {shortId(room.id)} · {room.turn} agent turns
          </p>
        </div>
        <Status state={room.state} />
      </div>
      {room.reason && (
        <div className="notice">
          <AlertTriangle size={18} />
          <p>{room.reason}</p>
        </div>
      )}
      <div className="room-layout">
        <section className="panel activity-panel">
          <SectionTitle
            title="Agent activity"
            description="Recorded actions and public reasons from this negotiation."
          />
          <div className="agent-key">
            <span>
              <i className="buyer-dot" />
              Buyer agent
            </span>
            <span>
              <i className="seller-dot" />
              Supplier agent
            </span>
            <span>
              <i className="system-dot" />
              Marketplace
            </span>
          </div>
          <div className="activity-feed">
            {room.messages.length === 0 ? (
              <Empty
                icon={<MessageSquare size={25} />}
                title="Agents are getting ready"
                description="Validated messages will appear here as the negotiation progresses."
              />
            ) : (
              room.messages.map((m) => (
                <div className={`activity-item activity-${m.role}`} key={m.id}>
                  <div className="activity-avatar">
                    {m.role === "system" ? (
                      <ShieldCheck size={15} />
                    ) : (
                      <Bot size={16} />
                    )}
                  </div>
                  <div className="activity-content">
                    <div className="activity-meta">
                      <b>
                        {m.role === "buyer"
                          ? "Buyer agent"
                          : m.role === "seller"
                            ? "Supplier agent"
                            : "Marketplace"}
                      </b>
                      <span>{m.action.replaceAll("_", " ")}</span>
                      <time>{time(m.createdAt)}</time>
                    </div>
                    <p>{m.text}</p>
                    {m.offerId && (
                      <small>
                        Offer v
                        {room.offers.find((o) => o.id === m.offerId)?.version ??
                          "–"}{" "}
                        · {shortId(m.offerId)}
                      </small>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          {room.state === "negotiating" && (
            <div className="live-note">
              <span className="pulse-dot" />
              Negotiation in progress. Updates arrive automatically.
            </div>
          )}
        </section>
        <aside className="panel current-offer">
          <SectionTitle
            title="Current offer"
            action={
              current ? (
                <span className="version-label">v{current.version}</span>
              ) : undefined
            }
          />
          {current ? (
            <>
              <OfferTerms offer={current} compact />
              <div className={`validity ${room.valid ? "valid" : "invalid"}`}>
                {room.valid ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <AlertTriangle size={17} />
                )}
                <div>
                  <b>
                    {room.state === "ordered"
                      ? "Confirmed offer"
                      : room.valid
                        ? "Passes your workspace rules"
                        : "Not currently approvable"}
                  </b>
                  {room.invalidReasons.map((r, i) => (
                    <p key={i}>{r}</p>
                  ))}
                </div>
              </div>
              <div className="approval-strip">
                <Tick
                  done={room.approvals.some(
                    (a) => a.role === "buyer" && a.offerId === current.id,
                  )}
                  label="Buyer"
                />
                <Tick
                  done={room.approvals.some(
                    (a) => a.role === "seller" && a.offerId === current.id,
                  )}
                  label="Seller"
                />
              </div>
              {["awaiting_approval", "expired"].includes(room.state) && (
                <div className="offer-actions">
                  <Button
                    onClick={() => setReview(current)}
                    disabled={
                      !room.valid ||
                      !!ownApproved ||
                      room.state !== "awaiting_approval"
                    }
                    className="full-width"
                  >
                    {ownApproved ? (
                      <>
                        <Check size={16} />
                        Your approval recorded
                      </>
                    ) : (
                      <>
                        Review & approve
                        <ArrowRight size={16} />
                      </>
                    )}
                  </Button>
                  {ownApproved && (
                    <p className="fine-print">
                      Waiting for the other workspace’s explicit approval.
                    </p>
                  )}
                  {account.role === "seller" && (
                    <Button
                      kind="secondary"
                      onClick={() => setRevise(true)}
                      className="full-width"
                    >
                      <Pencil size={15} />
                      Revise offer
                    </Button>
                  )}
                  <Button
                    kind="ghost"
                    busy={busy === "decline"}
                    onClick={() => act("decline")}
                    className="full-width"
                  >
                    Decline this negotiation
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Empty
              icon={<Package size={23} />}
              title="No offer yet"
              description="A structured proposal appears after the first valid agent offer."
            />
          )}
          {room.state === "failed" && (
            <Button
              kind="secondary"
              busy={busy === "retry"}
              onClick={() => act("retry")}
            >
              <RefreshCw size={15} />
              Retry negotiation
            </Button>
          )}
        </aside>
      </div>
      {room.offers.length > 0 && (
        <section className="panel history-panel">
          <SectionTitle
            title="Immutable offer history"
            description="Every proposal is preserved. Approvals apply to one exact version."
          />
          <div className="offer-history">
            {[...room.offers].reverse().map((o) => (
              <details key={o.id}>
                <summary>
                  <span className="version-label">v{o.version}</span>
                  <b>{fmtMoney(o.grandTotal)}</b>
                  <span>{o.depositPercent}% deposit</span>
                  <span>{o.sender} agent</span>
                  <span>{date(o.deliveryDate)}</span>
                  <ChevronRight size={16} />
                </summary>
                <OfferTerms offer={o} />
              </details>
            ))}
          </div>
        </section>
      )}
      {demoMode && account.role === "buyer" && (
        <details className="demo-tests">
          <summary>Demo integrity tests</summary>
          <p>
            Deliberate test actions on this negotiation. These changes are
            persisted.
          </p>
          <div className="button-group">
            <Button
              kind="secondary"
              disabled={!current || room.state !== "awaiting_approval"}
              onClick={() => setTest("stock-change")}
            >
              Reduce stock before approval
            </Button>
            <Button
              kind="secondary"
              disabled={room.state !== "negotiating"}
              onClick={() => setTest("injection")}
            >
              Add adversarial message
            </Button>
          </div>
        </details>
      )}
      {review && (
        <ApprovalDialog
          room={room}
          offer={review}
          account={account}
          onClose={() => setReview(null)}
          onUpdate={onUpdate}
        />
      )}{" "}
      {revise && (
        <RevisionDialog
          room={room}
          onClose={() => setRevise(false)}
          onUpdate={onUpdate}
        />
      )}
      <Modal
        open={!!test}
        onClose={() => setTest(null)}
        title={
          test === "stock-change"
            ? "Simulate an inventory change"
            : "Test counterparty message handling"
        }
        description={
          test === "stock-change"
            ? "This deliberately reduces this supplier’s stock below the requested quantity. Approval must fail until availability is resolved."
            : "Adds an untrusted counterparty message asking the agent to reveal private limits or ignore its rules."
        }
      >
        <div className="modal-footer">
          <Button kind="secondary" onClick={() => setTest(null)}>
            Cancel
          </Button>
          <Button busy={busy === "test"} onClick={runTest}>
            Run demo test
          </Button>
        </div>
      </Modal>
    </>
  );
}
export function RequestView({
  detail,
  account,
  onBack,
  onEdit,
  onUpdate,
  demoMode,
}: {
  detail: RequestDetail;
  account: Account;
  onBack: () => void;
  onEdit: (r: PurchaseRequest) => void;
  onUpdate: () => Promise<void>;
  demoMode: boolean;
}) {
  const { request, rooms, order } = detail;
  const [tab, setTab] = useState("offers");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [review, setReview] = useState<{ roomId: string; offer: Offer } | null>(
    null,
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  async function act(action: string) {
    if (
      action === "launch" &&
      /\b(?:armrests|ergonomic|warranty|certified|recycled|fireproof|leather|adjustable|steel|metal|upholstered|black|white|grey|gray|blue|red|green|beige|color|colour|desks|tables)\b/i.test(
        request.description,
      )
    ) {
      onEdit(request);
      return;
    }
    setBusy(action);
    setError(null);
    try {
      await api(`/api/requests/${request.id}/${action}`, "POST", {});
      await onUpdate();
      setCancelOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  const editable = [
    "draft",
    "no_match",
    "declined",
    "failed",
    "cancelled",
    "expired",
  ].includes(request.state);
  const valid = rooms.filter(
    (r) => r.valid && r.currentOffer && r.state === "awaiting_approval",
  );
  const lowest = [...valid].sort(
    (a, b) =>
      a.currentOffer!.grandTotal - b.currentOffer!.grandTotal ||
      a.id.localeCompare(b.id),
  )[0];
  const ranked = [...valid].sort((a, b) => {
    const x = a.currentOffer!,
      y = b.currentOffer!;
    return (
      (request.preference === "lower_deposit"
        ? x.depositPercent - y.depositPercent
        : request.preference === "earliest_delivery"
          ? x.deliveryDate.localeCompare(y.deliveryDate)
          : x.grandTotal - y.grandTotal) ||
      x.grandTotal - y.grandTotal ||
      a.id.localeCompare(b.id)
    );
  });
  const best = ranked[0];
  const activeRoom = rooms.find((r) => r.id === selectedRoom) || rooms[0];
  const stages = [
    "Request created",
    "Supplier matching",
    "Agent negotiation",
    "Human approval",
    "Order confirmed",
  ];
  const stage =
    request.state === "draft"
      ? 0
      : request.state === "matching"
        ? 1
        : request.state === "negotiating"
          ? 2
          : request.state === "ordered"
            ? 4
            : 3;
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} />
        All requests
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            PURCHASE REQUEST · {shortId(request.id)}
          </div>
          <h1>{request.title}</h1>
          <p>
            {request.quantity} {request.stackable ? "stackable " : ""}
            {request.material !== "any" ? request.material + " " : ""}chairs for{" "}
            {request.destination}
          </p>
        </div>
        <div className="button-group">
          {editable && (
            <Button kind="secondary" onClick={() => onEdit(request)}>
              <Pencil size={16} />
              Edit request
            </Button>
          )}
          {request.state === "draft" && (
            <Button busy={busy === "launch"} onClick={() => act("launch")}>
              <Play size={16} />
              Find suppliers
            </Button>
          )}
          {["matching", "negotiating", "awaiting_approval"].includes(
            request.state,
          ) && (
            <Button kind="secondary" onClick={() => setCancelOpen(true)}>
              <StopCircle size={16} />
              Cancel request
            </Button>
          )}
        </div>
      </div>
      <ErrorBox error={error} onDismiss={() => setError(null)} />
      <div className="request-overview panel">
        <div>
          <span>Request status</span>
          <Status state={request.state} />
        </div>
        <div>
          <span>
            <Truck size={14} />
            Delivery deadline
          </span>
          <b>{date(request.latestDelivery)}</b>
        </div>
        <div>
          <span>
            <LockKeyhole size={13} />
            Private total budget
          </span>
          <b>{fmtMoney(request.maxBudget)}</b>
        </div>
        <div>
          <span>Your preference</span>
          <b>{preferenceNames[request.preference]}</b>
          <small>Max. deposit {request.maxDeposit}%</small>
        </div>
      </div>
      <div className="workflow">
        {stages.map((s, i) => (
          <div
            key={s}
            className={i < stage ? "done" : i === stage ? "active" : ""}
          >
            <span>{i < stage ? <Check size={13} /> : i + 1}</span>
            <b>{s}</b>
            {i < stages.length - 1 && <ChevronRight size={14} />}
          </div>
        ))}
      </div>
      {order && (
        <div className="order-success">
          <div>
            <CheckCircle2 size={24} />
            <div>
              <h3>Your demo order is confirmed</h3>
              <p>
                Both workspaces approved. Inventory has been allocated. No
                payment or actual fulfilment occurred.
              </p>
            </div>
          </div>
          <OrderCard order={order} />
        </div>
      )}
      {request.state === "no_match" && (
        <div className="notice warning">
          <AlertTriangle size={21} />
          <div>
            <b>No suppliers meet these requirements</b>
            <p>
              Review the eligibility reasons below, then edit your request to
              try again. Requirements have not been relaxed.
            </p>
          </div>
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="Request views">
        {[
          {
            id: "offers",
            label: "Offers & comparison",
            count: rooms.filter((r) => r.currentOffer).length,
          },
          { id: "activity", label: "Agent activity", count: rooms.length },
          {
            id: "eligibility",
            label: "Supplier eligibility",
            count: request.eligibility.length,
          },
        ].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "active" : ""}
            key={t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span>{t.count}</span>
          </button>
        ))}
      </div>
      {tab === "offers" && (
        <>
          <SectionTitle
            title={
              rooms.length
                ? "Compare your supplier offers"
                : "Ready when you are"
            }
            description={
              rooms.length
                ? `Best fit prioritizes ${preferenceNames[request.preference].toLowerCase()}. Only valid, actionable offers are ranked.`
                : "Your agent will check supplier stock, specifications, destination, and delivery before negotiating."
            }
          />
          {rooms.length === 0 ? (
            <div className="panel">
              <Empty
                icon={<Bot size={29} />}
                title={
                  request.state === "draft"
                    ? "Let your agents do the groundwork"
                    : "No negotiation rooms"
                }
                description={
                  request.state === "draft"
                    ? "Review your requirements, then find suppliers to start separate buyer and seller negotiations."
                    : "Open Supplier eligibility to see which requirements prevented a match."
                }
                action={
                  request.state === "draft" ? (
                    <Button
                      busy={busy === "launch"}
                      onClick={() => act("launch")}
                    >
                      Find suppliers
                      <ArrowRight size={16} />
                    </Button>
                  ) : (
                    <Button
                      kind="secondary"
                      onClick={() => setTab("eligibility")}
                    >
                      View eligibility
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="comparison-grid">
              {rooms.map((room) => {
                const o = room.currentOffer;
                const isBest = best?.id === room.id;
                const approved =
                  o &&
                  room.approvals.some(
                    (a) => a.role === "buyer" && a.offerId === o.id,
                  );
                return (
                  <article
                    className={`offer-card ${isBest ? "best-offer" : ""}`}
                    key={room.id}
                  >
                    <div className="offer-card-top">
                      <div className="supplier-avatar">
                        {room.supplierName
                          .split(" ")
                          .map((s) => s[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <h3>{room.supplierName}</h3>
                        <small>
                          {isBest ? (
                            <span className="fit-tag">
                              <ShieldCheck size={12} />
                              Best fit
                            </span>
                          ) : room.id === lowest?.id ? (
                            <span className="low-tag">Lowest price</span>
                          ) : (
                            <span>Supplier agent</span>
                          )}
                        </small>
                      </div>
                    </div>
                    <Status state={room.state} />
                    {o ? (
                      <>
                        <div className="offer-price">
                          {fmtMoney(o.grandTotal)}
                          <span>Total including delivery</span>
                        </div>
                        <dl className="compare-facts">
                          <div>
                            <dt>Unit price</dt>
                            <dd>{fmtMoney(o.unitPrice)}</dd>
                          </div>
                          <div>
                            <dt>Delivery by</dt>
                            <dd>{date(o.deliveryDate)}</dd>
                          </div>
                          <div>
                            <dt>Deposit</dt>
                            <dd>{o.depositPercent}%</dd>
                          </div>
                          <div>
                            <dt>Offer expires</dt>
                            <dd>
                              {date(o.expiresAt)}, {time(o.expiresAt)}
                            </dd>
                          </div>
                        </dl>
                        {isBest && lowest?.id === room.id && (
                          <span className="low-tag">
                            Also the lowest valid price
                          </span>
                        )}
                        <div
                          className={`validity ${room.valid ? "valid" : "invalid"}`}
                        >
                          {room.valid ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <AlertTriangle size={16} />
                          )}
                          <div>
                            {room.valid
                              ? "Meets your requirements"
                              : room.invalidReasons.join(" · ") ||
                                "Not actionable in this state"}
                          </div>
                        </div>
                        <div className="approval-strip">
                          <Tick done={!!approved} label="Buyer" />
                          <Tick
                            done={room.approvals.some(
                              (a) => a.role === "seller" && a.offerId === o.id,
                            )}
                            label="Seller"
                          />
                        </div>
                        {room.state === "awaiting_approval" && (
                          <Button
                            className="full-width"
                            kind={isBest ? "primary" : "secondary"}
                            disabled={!room.valid || !!approved}
                            onClick={() =>
                              setReview({ roomId: room.id, offer: o })
                            }
                          >
                            {approved
                              ? "Your approval recorded"
                              : "Review & approve"}
                            {!approved && <ArrowRight size={15} />}
                          </Button>
                        )}
                      </>
                    ) : (
                      <div className="pending-offer">
                        <Bot size={24} />
                        <p>
                          {room.state === "negotiating"
                            ? "Agents are discussing terms…"
                            : "No valid offer was produced."}
                        </p>
                        {room.reason && <small>{room.reason}</small>}
                      </div>
                    )}
                    <button
                      className="text-link"
                      onClick={() => {
                        setSelectedRoom(room.id);
                        setTab("activity");
                      }}
                    >
                      View negotiation
                      <ArrowRight size={14} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      {tab === "activity" &&
        (activeRoom ? (
          <>
            <div className="room-picker">
              {rooms.map((r) => (
                <button
                  key={r.id}
                  className={activeRoom.id === r.id ? "active" : ""}
                  onClick={() => setSelectedRoom(r.id)}
                >
                  {r.supplierName}
                  <span>{r.messages.length}</span>
                </button>
              ))}
            </div>
            <RoomDetail
              key={activeRoom.id}
              room={activeRoom}
              request={request}
              account={account}
              onUpdate={onUpdate}
              demoMode={demoMode}
            />
          </>
        ) : (
          <div className="panel">
            <Empty
              icon={<MessageSquare size={27} />}
              title="No activity yet"
              description="Start supplier matching to create your private negotiation rooms."
            />
          </div>
        ))}
      {tab === "eligibility" && (
        <section className="panel">
          <SectionTitle
            title="Supplier eligibility"
            description="Hard requirements are checked before a negotiation is opened."
          />
          {request.eligibility.length === 0 ? (
            <Empty
              icon={<ShieldCheck size={26} />}
              title="Matching has not started"
              description="Find suppliers to check live catalogue specifications, stock, and delivery capabilities."
            />
          ) : (
            <div className="eligibility-list">
              {request.eligibility.map((e, i) => (
                <div className="eligibility-row" key={`${e.productId}-${i}`}>
                  <div
                    className={
                      e.eligible
                        ? "eligibility-icon eligible"
                        : "eligibility-icon"
                    }
                  >
                    {e.eligible ? <Check size={19} /> : <X size={19} />}
                  </div>
                  <div>
                    <b>{e.supplierName}</b>
                    <p>
                      {e.eligible
                        ? "All hard requirements met"
                        : e.reasons.join(" · ")}
                    </p>
                  </div>
                  <span
                    className={`eligibility-label ${e.eligible ? "eligible" : ""}`}
                  >
                    {e.eligible ? "Eligible" : "Excluded"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {review && rooms.find((r) => r.id === review.roomId) && (
        <ApprovalDialog
          room={rooms.find((r) => r.id === review.roomId)!}
          offer={review.offer}
          account={account}
          onClose={() => setReview(null)}
          onUpdate={onUpdate}
        />
      )}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this purchase request?"
        description="Active negotiations will stop. You can edit the cancelled request and launch a fresh negotiation later."
      >
        <div className="modal-footer">
          <Button kind="secondary" onClick={() => setCancelOpen(false)}>
            Keep negotiating
          </Button>
          <Button
            kind="danger"
            busy={busy === "cancel"}
            onClick={() => act("cancel")}
          >
            Cancel request
          </Button>
        </div>
      </Modal>
    </>
  );
}
