"use client";
import { brand } from "@/lib/brand";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  FlaskConical,
  FolderOpen,
  LayoutGrid,
  ListFilter,
  LockKeyhole,
  Menu,
  Network,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Workflow,
  X,
} from "lucide-react";
import type {
  Bootstrap,
  PurchaseRequest,
  RequestDetail,
  SellerRoomDetail,
  Order,
  Account,
} from "@/lib/types";
import { fmtMoney } from "@/lib/types";
import {
  api,
  Button,
  date,
  Empty,
  ErrorBox,
  Loading,
  Modal,
  SectionTitle,
  shortId,
  Status,
} from "./ui";
import RequestForm from "./request-form";
import { OrderCard, RequestView, RoomDetail } from "./deals";
import Catalogue, { type CatalogueEntry } from "./catalogue";
type View = "requests" | "inbox" | "catalogue" | "orders";
const scenarios = [
  {
    id: "primary",
    title: "The 80-chair purchase",
    description: "A realistic request with three distinct supplier outcomes.",
    icon: ShoppingBag,
  },
  {
    id: "low_budget",
    title: "Budget too low",
    description: "See agents handle a deal with no commercial overlap.",
    icon: ArrowDownLeft,
  },
  {
    id: "impossible_delivery",
    title: "Impossible deadline",
    description: "Hard delivery requirements exclude unavailable suppliers.",
    icon: Package,
  },
  {
    id: "stock_change",
    title: "Stock changes before approval",
    description:
      "Start a draft, negotiate, then test an inventory change in the room.",
    icon: RefreshCw,
  },
  {
    id: "injection",
    title: "Untrusted counterparty message",
    description: "Exercise private boundaries with an adversarial message.",
    icon: ShieldCheck,
  },
];
function AccountChoices({
  bootstrap,
  onSelect,
  busy,
}: {
  bootstrap: Bootstrap;
  onSelect: (id: string) => void;
  busy: string;
}) {
  return (
    <div className="account-choices">
      {bootstrap.accounts.map((a, i) => (
        <button
          disabled={!!busy}
          key={a.id}
          onClick={() => onSelect(a.id)}
          className="account-choice"
        >
          <div className={`workspace-avatar avatar-${i}`}>
            {a.role === "buyer" ? <Building2 size={23} /> : <Store size={23} />}
          </div>
          <div>
            <span>
              {a.role === "buyer" ? "BUYER WORKSPACE" : "SUPPLIER WORKSPACE"}
            </span>
            <h3>{a.workspaceName}</h3>
            <p>{a.name} · Demo account</p>
          </div>
          {busy === a.id ? (
            <RefreshCw size={19} className="spin" />
          ) : (
            <ArrowRight size={19} />
          )}
        </button>
      ))}
    </div>
  );
}
export default function MarketApp() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [view, setView] = useState<View>("requests");
  const [selected, setSelected] = useState<string | null>(null);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [inbox, setInbox] = useState<SellerRoomDetail[]>([]);
  const [entries, setEntries] = useState<CatalogueEntry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [roomDetail, setRoomDetail] = useState<SellerRoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [composer, setComposer] = useState<PurchaseRequest | true | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const generation = useRef(0);
  const account = bootstrap?.account;
  useEffect(() => {
    api<Bootstrap>("/api/bootstrap")
      .then((b) => {
        setBootstrap(b);
        const params = new URLSearchParams(window.location.search);
        const validViews: View[] =
          b.account?.role === "seller"
            ? ["inbox", "catalogue", "orders"]
            : ["requests", "orders"];
        const v = params.get("view") as View;
        setView(
          validViews.includes(v)
            ? v
            : b.account?.role === "seller"
              ? "inbox"
              : "requests",
        );
        setSelected(params.get("request") || params.get("room"));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);
  const refresh = useCallback(async () => {
    if (!account) return;
    const token = generation.current;
    try {
      if (account.role === "buyer") {
        const [rs, os, dt] = await Promise.all([
          api<PurchaseRequest[]>("/api/requests"),
          api<Order[]>("/api/orders"),
          selected && view === "requests"
            ? api<RequestDetail>(`/api/requests/${selected}`)
            : Promise.resolve(null),
        ]);
        if (token !== generation.current) return;
        setRequests(rs);
        setOrders(os);
        setDetail(dt);
      } else {
        const [ins, os, cat, dt] = await Promise.all([
          api<SellerRoomDetail[]>("/api/inbox"),
          api<Order[]>("/api/orders"),
          view === "catalogue"
            ? api<CatalogueEntry[]>("/api/catalogue")
            : Promise.resolve([]),
          selected && view === "inbox"
            ? api<SellerRoomDetail>(`/api/rooms/${selected}`)
            : Promise.resolve(null),
        ]);
        if (token !== generation.current) return;
        setInbox(ins);
        setOrders(os);
        setEntries(cat);
        setRoomDetail(dt);
      }
    } catch (e) {
      if (token === generation.current) setError((e as Error).message);
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }, [account, selected, view]);
  useEffect(() => {
    if (!account) return;
    setLoading(true);
    void refresh();
    const interval = setInterval(() => void refresh(), 1500);
    return () => clearInterval(interval);
  }, [refresh, account]);
  function navigate(next: View, id: string | null = null) {
    generation.current++;
    setView(next);
    setSelected(id);
    setDetail(null);
    setRoomDetail(null);
    setSearch("");
    setFilter("all");
    setError(null);
    setMobileOpen(false);
    window.history.replaceState(
      {},
      "",
      `?view=${next}${id ? `&${next === "requests" ? "request" : "room"}=${encodeURIComponent(id)}` : ""}`,
    );
  }
  async function switchAccount(id: string) {
    generation.current++;
    setBusy(id);
    setError(null);
    try {
      await api("/api/session", "POST", { accountId: id });
      const b = await api<Bootstrap>("/api/bootstrap");
      setBootstrap(b);
      setSwitchOpen(false);
      setRequests([]);
      setInbox([]);
      setOrders([]);
      setEntries([]);
      navigate(b.account?.role === "seller" ? "inbox" : "requests");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function scenario(id: string) {
    setBusy(id);
    setError(null);
    try {
      const r = await api<PurchaseRequest>("/api/demo/scenario", "POST", {
        scenario: id,
      });
      setDemoOpen(false);
      navigate("requests", r.id);
      setComposer(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function saved(request: PurchaseRequest, launch: boolean) {
    setComposer(null);
    let launchError: string | null = null;
    if (launch) {
      try {
        await api(`/api/requests/${request.id}/launch`, "POST", {});
      } catch (e) {
        launchError = (e as Error).message;
      }
    }
    navigate("requests", request.id);
    if (launchError) setError(launchError);
  }
  async function reset() {
    generation.current++;
    setBusy("reset");
    setError(null);
    try {
      await api("/api/demo/reset", "POST", { confirmation: resetText });
      setResetOpen(false);
      setDemoOpen(false);
      setResetText("");
      setBootstrap(await api<Bootstrap>("/api/bootstrap"));
      setSelected(null);
      setDetail(null);
      setRoomDetail(null);
      setRequests([]);
      setOrders([]);
      setInbox([]);
      setEntries([]);
      window.history.replaceState({}, "", "/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  if (!bootstrap)
    return (
      <main className="boot-screen">
        <div className="brand">
          <span className="brand-mark">
            <Network size={23} />
          </span>
          {brand.wordmark[0]}
          <span>{brand.wordmark[1]}</span>
        </div>
        {loading ? (
          <Loading />
        ) : (
          <>
            <ErrorBox error={error} />
            <Button onClick={() => window.location.reload()}>
              <RefreshCw size={16} />
              Retry loading
            </Button>
          </>
        )}
      </main>
    );
  if (!account)
    return (
      <main className="account-screen">
        <header className="welcome-header">
          <div className="brand">
            <span className="brand-mark">
              <Network size={23} />
            </span>
            {brand.wordmark[0]}
            <span>{brand.wordmark[1]}</span>
          </div>
          <span className="local-demo">
            <span />
            LOCAL DEMO
          </span>
        </header>
        <div className="welcome-content">
          <div className="welcome-copy">
            <div className="welcome-icon">
              <Workflow size={30} />
            </div>
            <div className="eyebrow">YOUR AGENTS. YOUR TERMS.</div>
            <h1>
              A new way to
              <br />
              do business.
            </h1>
            <p>
              Discover suppliers, negotiate with their agents, and approve the
              deal that works for you.
            </p>
            <div className="welcome-flow">
              <span>
                <Search size={17} />
                Discover
              </span>
              <ChevronRight size={15} />
              <span>
                <Bot size={17} />
                Negotiate
              </span>
              <ChevronRight size={15} />
              <span>
                <CheckCircle2 size={17} />
                Approve
              </span>
            </div>
            <div className="welcome-note">
              <LockKeyhole size={17} />
              <p>
                Separate workspaces. Private commercial rules.
                <br />
                Human approval on every order.
              </p>
            </div>
          </div>
          <section className="workspace-selection">
            <div className="selection-heading">
              <h2>Choose your workspace</h2>
              <p>Fictional businesses, real negotiation workflows.</p>
            </div>
            <ErrorBox error={error} />
            {bootstrap.demoMode ? (
              <AccountChoices
                bootstrap={bootstrap}
                onSelect={switchAccount}
                busy={busy}
              />
            ) : (
              <div className="notice">
                <ShieldCheck size={21} />
                <p>
                  Local demo account switching is disabled. Configure a
                  supported authentication provider or run the application in
                  local demo mode.
                </p>
              </div>
            )}
            <div className="selection-footer">
              <FlaskConical size={15} />
              <span>
                {bootstrap.provider === "deterministic"
                  ? "Deterministic demo provider · No live AI"
                  : "Live OpenAI provider configured"}
                <br />
                No payments or real fulfilment.
              </span>
            </div>
          </section>
        </div>
        <footer className="welcome-footer">
          B2B procurement, with people in control.
          <span>Chairs & office furniture · EUR</span>
        </footer>
      </main>
    );
  const nav =
    account.role === "buyer"
      ? [
          {
            id: "requests" as View,
            label: "Purchase requests",
            icon: FolderOpen,
          },
          { id: "orders" as View, label: "Orders", icon: FileCheck2 },
        ]
      : [
          {
            id: "inbox" as View,
            label: "Negotiation inbox",
            icon: MessageIcon,
          },
          {
            id: "catalogue" as View,
            label: "Catalogue & rules",
            icon: Package,
          },
          { id: "orders" as View, label: "Orders", icon: FileCheck2 },
        ];
  const currentTitle = nav.find((n) => n.id === view)?.label || "Workspace";
  const filteredRequests = requests.filter(
    (r) =>
      (filter === "all" || r.state === filter) &&
      `${r.title} ${r.destination}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const filteredInbox = inbox.filter(
    (i) =>
      (filter === "all" || i.room.state === filter) &&
      `${i.request.title} ${i.request.destination}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const active =
    account.role === "buyer"
      ? requests.filter((r) => ["negotiating", "matching"].includes(r.state))
          .length
      : inbox.filter((r) => r.room.state === "negotiating").length;
  const waiting =
    account.role === "buyer"
      ? requests.filter((r) => r.state === "awaiting_approval").length
      : inbox.filter((r) => r.room.state === "awaiting_approval").length;
  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <a href="/" className="brand">
          <span className="brand-mark">
            <Network size={22} />
          </span>
          {brand.wordmark[0]}
          <span>{brand.wordmark[1]}</span>
        </a>
        <div className="sidebar-workspace">
          <div className="workspace-mini-avatar">
            {account.role === "buyer" ? (
              <Building2 size={20} />
            ) : (
              <Store size={20} />
            )}
          </div>
          <div>
            <b>{account.workspaceName}</b>
            <span>
              {account.role === "buyer"
                ? "Buyer workspace"
                : "Seller workspace"}
            </span>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.id === "orders" && orders.length > 0 && (
                <small>{orders.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="agent-mode">
            <div>
              <span className="provider-dot" />
              <b>
                {bootstrap.provider === "deterministic"
                  ? "Demo agent engine"
                  : "Live AI engine"}
              </b>
            </div>
            <p>
              {bootstrap.provider === "deterministic"
                ? "Deterministic provider. Real rules, separate agents, persistent data."
                : `OpenAI · ${bootstrap.model || "configured model"}`}
            </p>
            <span>
              <ShieldCheck size={13} />
              Human approval required
            </span>
          </div>
          {bootstrap.demoMode && (
            <button
              className="demo-tools-button"
              onClick={() => setDemoOpen(true)}
            >
              <FlaskConical size={17} />
              Demo tools
              <ChevronRight size={15} />
            </button>
          )}
          <div className="sidebar-footnote">
            All businesses and transactions
            <br />
            are fictional demo data.
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{currentTitle}</b>
          </div>
          <div className="topbar-actions">
            <span className="local-demo">
              <span />
              LOCAL DEMO
            </span>
            <button
              className="profile-button"
              disabled={!bootstrap.demoMode}
              onClick={() => setSwitchOpen(true)}
            >
              <span className="user-avatar">
                {account.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span>
                {account.name}
                <small>
                  {account.role === "buyer" ? "Procurement" : "Sales"}
                </small>
              </span>
              {bootstrap.demoMode && <ChevronDown size={15} />}
            </button>
          </div>
        </header>
        <main className="workspace-main">
          <ErrorBox error={error} onDismiss={() => setError(null)} />
          {loading && !detail && !roomDetail ? (
            <Loading />
          ) : view === "requests" && selected && detail ? (
            <RequestView
              key={detail.request.id}
              detail={detail}
              account={account}
              onBack={() => navigate("requests")}
              onEdit={setComposer}
              onUpdate={refresh}
              demoMode={bootstrap.demoMode}
            />
          ) : view === "inbox" && selected && roomDetail ? (
            <>
              <button className="back-link" onClick={() => navigate("inbox")}>
                <ArrowDownLeft size={15} />
                Negotiation inbox
              </button>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    BUYER REQUEST · {shortId(roomDetail.request.id)}
                  </div>
                  <h1>{roomDetail.request.title}</h1>
                  <p>
                    {roomDetail.request.quantity} units ·{" "}
                    {roomDetail.request.destination} · Delivery by{" "}
                    {date(roomDetail.request.latestDelivery)}
                  </p>
                </div>
              </div>
              <div className="notice">
                <LockKeyhole size={18} />
                <p>
                  This room contains only your negotiation. The buyer’s private
                  limits and competing supplier conversations are never shared.
                </p>
              </div>
              <RoomDetail
                room={roomDetail.room}
                request={roomDetail.request}
                account={account}
                onUpdate={refresh}
              />
            </>
          ) : view === "catalogue" ? (
            <Catalogue entries={entries} onUpdate={refresh} />
          ) : view === "orders" ? (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {account.role === "buyer" ? "BUYER" : "SELLER"} WORKSPACE
                  </div>
                  <h1>Orders</h1>
                  <p>Approved terms, preserved as a single source of truth.</p>
                </div>
                <span className="count-label">{orders.length} confirmed</span>
              </div>
              <div className="notice">
                <FileCheck2 size={19} />
                <p>
                  Internal demo records only. No payment, shipping purchase, or
                  actual fulfilment has occurred.
                </p>
              </div>
              <section className="panel orders-panel">
                {orders.length ? (
                  orders.map((o) => <OrderCard key={o.id} order={o} />)
                ) : (
                  <Empty
                    icon={<FileCheck2 size={29} />}
                    title="Your first order starts with an agreement"
                    description="An order appears after the buyer and supplier approve the same valid offer."
                    action={
                      <Button
                        kind="secondary"
                        onClick={() =>
                          navigate(
                            account.role === "buyer" ? "requests" : "inbox",
                          )
                        }
                      >
                        View{" "}
                        {account.role === "buyer" ? "requests" : "negotiations"}
                        <ArrowRight size={16} />
                      </Button>
                    }
                  />
                )}
              </section>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {account.role === "buyer"
                      ? "PROCUREMENT, IN MOTION"
                      : "YOUR SALES WORKSPACE"}
                  </div>
                  <h1>
                    {account.role === "buyer"
                      ? "Purchase requests"
                      : "Negotiation inbox"}
                  </h1>
                  <p>
                    {account.role === "buyer"
                      ? "Tell your agents what you need. Take the final decision."
                      : "Your sales agent handles the conversation. You approve the terms."}
                  </p>
                </div>
                {account.role === "buyer" && (
                  <Button onClick={() => setComposer(true)}>
                    <Plus size={17} />
                    New request
                  </Button>
                )}
              </div>
              <div className="stats-grid">
                <div className="stat-block">
                  <div>
                    <span>
                      {account.role === "buyer"
                        ? "Total requests"
                        : "Negotiations"}
                    </span>
                    <FolderOpen size={18} />
                  </div>
                  <strong>
                    {account.role === "buyer" ? requests.length : inbox.length}
                  </strong>
                  <small>
                    {account.role === "buyer"
                      ? "Across your workspace"
                      : "Private supplier rooms"}
                  </small>
                </div>
                <div className="stat-block">
                  <div>
                    <span>Agents negotiating</span>
                    <Bot size={19} />
                  </div>
                  <strong>
                    {active}
                    <span
                      className={
                        active ? "active-indicator" : "inactive-indicator"
                      }
                    />
                  </strong>
                  <small>
                    {active
                      ? "Work in progress"
                      : "Ready for your next request"}
                  </small>
                </div>
                <div className="stat-block">
                  <div>
                    <span>Needs your approval</span>
                    <FileCheck2 size={18} />
                  </div>
                  <strong>{waiting}</strong>
                  <small>Review the exact offer terms</small>
                </div>
                <div className="stat-block">
                  <div>
                    <span>Confirmed orders</span>
                    <CheckCircle2 size={18} />
                  </div>
                  <strong>{orders.length}</strong>
                  <small>
                    {fmtMoney(
                      orders.reduce((s, o) => s + o.offer.grandTotal, 0),
                    )}{" "}
                    total value
                  </small>
                </div>
              </div>
              {account.role === "buyer" && requests.length === 0 && (
                <div className="getting-started">
                  <div className="getting-started-icon">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <span>YOUR FIRST AGENT-TO-AGENT DEAL</span>
                    <h2>80 chairs. Three suppliers. Your terms.</h2>
                    <p>
                      Start with the demo request and watch separate buying and
                      selling agents negotiate.
                    </p>
                  </div>
                  <Button
                    kind="secondary"
                    busy={busy === "primary"}
                    onClick={() => scenario("primary")}
                  >
                    Try the demo request
                    <ArrowRight size={16} />
                  </Button>
                </div>
              )}
              <section className="panel request-list">
                <div className="list-toolbar">
                  <div className="list-tabs">
                    <span className="list-active-label">
                      {account.role === "buyer"
                        ? "All requests"
                        : "All negotiations"}
                      <span>
                        {account.role === "buyer"
                          ? requests.length
                          : inbox.length}
                      </span>
                    </span>
                  </div>
                  <div className="list-controls">
                    <label className="search-control">
                      <Search size={16} />
                      <input
                        aria-label="Search requests"
                        placeholder="Search requests…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <label className="filter-control">
                      <ListFilter size={15} />
                      <select
                        aria-label="Filter by status"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All statuses</option>
                        {[
                          "draft",
                          "negotiating",
                          "awaiting_approval",
                          "ordered",
                          "no_match",
                          "declined",
                          "failed",
                          "cancelled",
                          "expired",
                        ]
                          .filter(
                            (s) =>
                              account.role === "buyer" ||
                              !["draft", "no_match"].includes(s),
                          )
                          .map((s) => (
                            <option key={s} value={s}>
                              {s.replaceAll("_", " ")}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                </div>
                {account.role === "buyer" ? (
                  filteredRequests.length ? (
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Purchase request</th>
                            <th>Status</th>
                            <th>Delivery by</th>
                            <th>Private budget</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRequests.map((r) => (
                            <tr
                              key={r.id}
                              onClick={() => navigate("requests", r.id)}
                            >
                              <td>
                                <button
                                  className="request-title-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate("requests", r.id);
                                  }}
                                >
                                  <span className="request-icon">
                                    <ShoppingBag size={18} />
                                  </span>
                                  <span>
                                    <b>{r.title}</b>
                                    <small>
                                      {r.quantity} units · {r.destination} ·{" "}
                                      {shortId(r.id)}
                                    </small>
                                  </span>
                                </button>
                              </td>
                              <td>
                                <Status state={r.state} />
                              </td>
                              <td>{date(r.latestDelivery)}</td>
                              <td className="money-cell">
                                {fmtMoney(r.maxBudget)}
                              </td>
                              <td>
                                <ChevronRight size={16} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      icon={<FolderOpen size={31} />}
                      title={
                        search || filter !== "all"
                          ? "No matching requests"
                          : "A clear desk. A world of suppliers."
                      }
                      description={
                        search || filter !== "all"
                          ? "Try another search or status filter."
                          : "Create your first request to discover suppliers and put your buying agent to work."
                      }
                      action={
                        !search && filter === "all" ? (
                          <Button
                            kind="secondary"
                            onClick={() => setComposer(true)}
                          >
                            <Plus size={16} />
                            Create a request
                          </Button>
                        ) : undefined
                      }
                    />
                  )
                ) : filteredInbox.length ? (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Buyer request</th>
                          <th>Status</th>
                          <th>Current offer</th>
                          <th>Activity</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInbox.map(({ room: r, request: q }) => (
                          <tr
                            key={r.id}
                            onClick={() => navigate("inbox", r.id)}
                          >
                            <td>
                              <button
                                className="request-title-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("inbox", r.id);
                                }}
                              >
                                <span className="request-icon">
                                  <ShoppingBag size={18} />
                                </span>
                                <span>
                                  <b>{q.title}</b>
                                  <small>
                                    {q.quantity} units · {q.destination}
                                  </small>
                                </span>
                              </button>
                            </td>
                            <td>
                              <Status state={r.state} />
                            </td>
                            <td className="money-cell">
                              {r.currentOffer
                                ? fmtMoney(r.currentOffer.grandTotal)
                                : "Awaiting proposal"}
                            </td>
                            <td>{r.messages.length} events</td>
                            <td>
                              <ChevronRight size={16} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    icon={<Bot size={30} />}
                    title={
                      search || filter !== "all"
                        ? "No matching negotiations"
                        : "Your agent is ready for business"
                    }
                    description={
                      search || filter !== "all"
                        ? "Try another search or status filter."
                        : "Eligible buyer requests appear here when a buyer starts supplier matching. Check your catalogue and private rules to prepare."
                    }
                    action={
                      <Button
                        kind="secondary"
                        onClick={() => navigate("catalogue")}
                      >
                        Review catalogue
                        <ArrowRight size={16} />
                      </Button>
                    }
                  />
                )}
              </section>
              <div className="workspace-note">
                <ShieldCheck size={16} />
                <span>
                  Agents negotiate within your rules. Every order needs approval
                  from both workspaces.
                </span>
              </div>
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>{brand.name} · Local demonstration</span>
          <span>
            <LockKeyhole size={12} />
            Workspace data is permission scoped
          </span>
        </footer>
      </div>
      {composer && (
        <RequestForm
          key={composer === true ? "new" : composer.id}
          draft={composer === true ? undefined : composer}
          onClose={() => setComposer(null)}
          onSaved={saved}
        />
      )}
      <Modal
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        title="Switch demo workspace"
        description="Explicitly sign in as a seeded demo account. Each workspace has separate permissions."
      >
        <div className="form-body">
          <AccountChoices
            bootstrap={bootstrap}
            busy={busy}
            onSelect={switchAccount}
          />
        </div>
      </Modal>
      <Modal
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        title="Demo tools"
        description="Explore complete scenarios using fictional businesses and inventory."
      >
        <div className="form-body">
          <div className="provider-notice">
            <Bot size={21} />
            <div>
              <b>
                {bootstrap.provider === "deterministic"
                  ? "Deterministic demo provider"
                  : "Live OpenAI provider"}
              </b>
              <p>
                {bootstrap.provider === "deterministic"
                  ? "Separate buyer and seller policies run through the same workflow and validators. No live model is used."
                  : "Separate model contexts use the configured server-side provider."}
              </p>
            </div>
          </div>
          {account.role === "buyer" ? (
            <div className="scenario-list">
              {scenarios.map((s) => (
                <button
                  key={s.id}
                  disabled={!!busy}
                  onClick={() => scenario(s.id)}
                >
                  <s.icon size={20} />
                  <div>
                    <b>{s.title}</b>
                    <p>{s.description}</p>
                  </div>
                  {busy === s.id ? (
                    <RefreshCw size={16} className="spin" />
                  ) : (
                    <ChevronRight size={17} />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">
              Switch to the buyer workspace to create a scenario. Seller
              catalogue rules can be edited at any time.
            </p>
          )}
          <div className="demo-reset">
            <div>
              <b>Start fresh</b>
              <p>
                Delete demo requests, offers, and orders, then restore seed
                stock.
              </p>
            </div>
            <Button
              kind="danger"
              onClick={() => {
                setDemoOpen(false);
                setResetOpen(true);
              }}
            >
              <RefreshCw size={15} />
              Reset demo
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset all demo data?"
        description="This deletes local demo requests, negotiations, approvals, and orders, restores seeded stock, and clears the selected session. Your catalogue and commercial-rule edits are preserved."
      >
        <div className="form-body">
          <ErrorBox error={error} />
          <label className="field">
            <span>Type RESET DEMO DATA to confirm</span>
            <input
              autoComplete="off"
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              placeholder="RESET DEMO DATA"
            />
          </label>
        </div>
        <div className="modal-footer">
          <Button kind="secondary" onClick={() => setResetOpen(false)}>
            Cancel
          </Button>
          <Button
            kind="danger"
            disabled={resetText !== "RESET DEMO DATA"}
            busy={busy === "reset"}
            onClick={reset}
          >
            Reset demo data
          </Button>
        </div>
      </Modal>
    </div>
  );
}
function MessageIcon({ size = 18 }: { size?: number }) {
  return <Workflow size={size} />;
}
