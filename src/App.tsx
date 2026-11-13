import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Command,
  Download,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Wallet,
  X,
  RefreshCw,
  Check,
  Send,
  ExternalLink,
  Pencil,
  Trash2,
  PanelLeftClose,
  Columns3,
} from "lucide-react";
import { api, money, compact, pct, dateLabel } from "./api";
import type {
  Answer,
  Article,
  Bootstrap,
  Detail,
  Health,
  Holding,
  Portfolio,
  Source,
  Stock,
} from "./types";
import {
  AnswerBlock,
  Change,
  Dialog,
  Empty,
  Logo,
  NewsRow,
  PriceChart,
  SectionTitle,
  Signal,
  SourceChips,
  Sparkline,
  Spinner,
} from "./components";
import { StockDrawer } from "./StockDrawer";
import { NiftyPage } from "./NiftyPage";

import { isSimulated, asOfLabel, setDataMode } from "./dataMode";
type Page =
  "overview" | "holdings" | "nifty50" | "research" | "assistant" | "connection";
const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "nifty50", label: "Nifty 50", icon: Columns3 },
  { id: "holdings", label: "Holdings", icon: Wallet },
  { id: "research", label: "Research", icon: BookOpen },
  { id: "assistant", label: "Research assistant", icon: MessageSquare },
] as const;
const SECTOR_COLORS = [
  "#446b50",
  "#819579",
  "#acb6a3",
  "#c4cabc",
  "#ddd8c5",
  "#a9b4b0",
];

export default function App() {
  const [page, setPage] = useState<Page>(
    () => (location.hash.slice(1) || "overview") as Page,
  );
  const [data, setData] = useState<Bootstrap | null>(null),
    [health, setHealth] = useState<Health | null>(null),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [stock, setStock] = useState<string | null>(null),
    [holding, setHolding] = useState<Holding | "new" | null>(null);
  const [source, setSource] = useState<Source | null>(null),
    [sourceBusy, setSourceBusy] = useState(false),
    [toast, setToast] = useState("");
  const [chatSeed, setChatSeed] = useState("");
  const load = useCallback(async () => {
    try {
      const boot = await api<Bootstrap>("/bootstrap");
      setDataMode(boot.simulated, boot.as_of);
      setData(boot);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  const checkHealth = useCallback(async () => {
    try {
      setHealth(await api<Health>("/health"));
    } catch {
      setHealth(null);
    }
  }, []);
  useEffect(() => {
    load();
    checkHealth();
    const timer = setInterval(checkHealth, 30000);
    return () => clearInterval(timer);
  }, [load, checkHealth]);
  useEffect(() => {
    const fn = () =>
      setPage(
        ([
          "overview",
          "holdings",
          "nifty50",
          "research",
          "assistant",
          "connection",
        ].includes(location.hash.slice(1))
          ? location.hash.slice(1)
          : "overview") as Page,
      );
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  const navigate = (p: Page) => {
    location.hash = p;
    setPage(p);
    setQuery("");
  };
  const openSource = async (id: string) => {
    setSourceBusy(true);
    try {
      setSource(await api<Source>("/sources/" + id));
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSourceBusy(false);
    }
  };
  const ask = (q: string) => {
    setStock(null);
    setChatSeed(q);
    navigate("assistant");
  };
  const matches =
    data?.stocks.filter((s) =>
      (s.symbol + " " + s.name).toLowerCase().includes(query.toLowerCase()),
    ) || [];
  const changed = (p: Portfolio) => {
    setData((old) => (old ? { ...old, portfolio: p } : old));
    setHolding(null);
    setToast("Portfolio updated");
  };
  const connected = health?.llm.connected;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#overview"
          className="brand-link"
          onClick={() => navigate("overview")}
          aria-label="StockLens overview"
        >
          <Logo />
        </a>
        <span className="workspace-label">YOUR RESEARCH WORKSPACE</span>
        <nav aria-label="Main navigation">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "nav-item active" : "nav-item"}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={17} />
              <span>{n.label}</span>
              {page === n.id && <span className="nav-current" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <BookOpen size={17} />
          </div>
          <h4>Know what you own.</h4>
          <p>Research, context, and a clearer view of your portfolio.</p>
          <span className="small-rule" />
        </div>
        <div className="sidebar-bottom">
          <button
            className={"nav-item " + (page === "connection" ? "active" : "")}
            onClick={() => navigate("connection")}
          >
            <Settings2 size={17} />
            Connection & data
          </button>
          <div className="profile">
            <span className="avatar">SL</span>
            <div>
              <strong>Personal portfolio</strong>
              <span>Local workspace</span>
            </div>
            <span className="profile-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>
              {page === "connection"
                ? "Connection & data"
                : NAV.find((n) => n.id === page)?.label || "Overview"}
            </strong>
            <span className="demo-badge">{isSimulated() ? "DEMO DATA" : "MARKET DATA"}</span>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a company"
                aria-label="Find a company"
              />
              {query ? (
                <button
                  className="icon-button tiny"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              ) : (
                <span className="search-hint">
                  {data?.stocks.length || "…"} stocks
                </span>
              )}
              {query && (
                <div className="search-results">
                  {matches.length ? (
                    matches.map((s) => (
                      <button
                        key={s.symbol}
                        onClick={() => {
                          setStock(s.symbol);
                          setQuery("");
                        }}
                      >
                        <span className="company-mark">
                          {s.symbol.slice(0, 2)}
                        </span>
                        <span>
                          <strong>{s.symbol}</strong>
                          <small>{s.name}</small>
                        </span>
                        <ArrowUpRight size={14} />
                      </button>
                    ))
                  ) : (
                    <p>No company in the Nifty 50 universe matches.</p>
                  )}
                </div>
              )}
            </div>
            <button
              className="connection-pill"
              onClick={() => navigate("connection")}
            >
              <span className={connected ? "status-dot" : "status-dot amber"} />
              {connected ? "Model connected" : "Prepared mode"}
            </button>
          </div>
        </header>
        <main className="main-content">
          <div className="mobile-brand">
            <Logo small />
            <span className="demo-badge">{isSimulated() ? "DEMO DATA" : "MARKET DATA"}</span>
          </div>
          <div className="mobile-nav">
            {NAV.map((n) => (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                {n.label}
              </button>
            ))}
            <button onClick={() => navigate("connection")}>Connection</button>
          </div>
          {!data ? (
            error ? (
              <Empty
                title="The workspace couldn’t load"
                action={
                  <button className="button primary" onClick={load}>
                    Try again
                  </button>
                }
              >
                {error}. Make sure the StockLens backend is running.
              </Empty>
            ) : (
              <div className="initial-loading">
                <Logo />
                <Spinner label="Preparing your research workspace…" />
              </div>
            )
          ) : (
            <>
              {page === "overview" && (
                <Overview
                  data={data}
                  onStock={setStock}
                  onSource={openSource}
                  onAdd={() => setHolding("new")}
                  navigate={navigate}
                  onAsk={ask}
                />
              )}
              {page === "holdings" && (
                <HoldingsPage
                  data={data}
                  onStock={setStock}
                  onEdit={setHolding}
                  onSource={openSource}
                />
              )}
              {page === "nifty50" && (
                <NiftyPage onStock={setStock} onSource={openSource} />
              )}
              {page === "research" && (
                <ResearchPage data={data} onSource={openSource} />
              )}
              {page === "assistant" && (
                <AssistantPage
                  data={data}
                  seed={chatSeed}
                  clearSeed={() => setChatSeed("")}
                  onSource={openSource}
                  connected={!!connected}
                />
              )}
              {page === "connection" && (
                <ConnectionPage
                  health={health}
                  onRefresh={checkHealth}
                  stocks={data.stocks}
                  counts={data.counts}
                />
              )}
              <footer className="app-footer">
                <span>
                  <span className="outline-dot" />{" "}
                  {isSimulated()
                    ? "Simulated market data · 29 Oct 2026"
                    : `Market data via Yahoo Finance · close ${asOfLabel()}`}
                </span>
                <span>Built for understanding. Every view has a source.</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {stock && (
        <StockDrawer
          symbol={stock}
          onClose={() => setStock(null)}
          onSource={openSource}
          onAsk={ask}
        />
      )}
      {holding && data && (
        <HoldingDialog
          holding={holding}
          stocks={data.stocks}
          existing={data.portfolio.holdings}
          onClose={() => setHolding(null)}
          onChange={changed}
        />
      )}
      {source && (
        <Dialog title="Evidence record" onClose={() => setSource(null)}>
          <div className="source-document">
            <div className="document-meta">
              <span className="eyebrow">{source.kind}</span>
              <span className="simulation-tag">
                {source.simulated ? "SIMULATED" : "SOURCE: YAHOO FINANCE"}
              </span>
            </div>
            <h2>{source.title}</h2>
            <p className="document-date">
              {source.id} <span>/</span> {dateLabel(source.date)} <span>/</span>{" "}
              {source.symbol}
            </p>
            <div className="document-body">{source.body}</div>
            {source.url && (
              <p className="document-date">
                <a href={source.url} target="_blank" rel="noreferrer">
                  Read the original{source.publisher ? ` at ${source.publisher}` : ""} ↗
                </a>
              </p>
            )}
            <div className="document-note">
              <FileSource />{" "}
              {source.simulated
                ? "This record belongs to the generated demo dataset. Analyst identities and reports are simulated; no SEBI registration is claimed."
                : "Reported figures, end-of-day prices and published news retrieved from Yahoo Finance. Analyst data is aggregated consensus, not individual reports. Not investment advice."}
            </div>
          </div>
        </Dialog>
      )}
      {sourceBusy && (
        <div className="floating-loading">
          <Spinner label="Opening evidence…" />
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={16} />
          {toast}
          <button
            className="icon-button tiny"
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
function FileSource() {
  return <BookOpen size={17} />;
}
function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}

function Overview({
  data,
  onStock,
  onSource,
  onAdd,
  navigate,
  onAsk,
}: {
  data: Bootstrap;
  onStock: (s: string) => void;
  onSource: (id: string) => void;
  onAdd: () => void;
  navigate: (p: Page) => void;
  onAsk: (q: string) => void;
}) {
  const p = data.portfolio;
  const [range, setRange] = useState("3M"),
    [brief, setBrief] = useState<Answer | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setBrief(null);
  }, [p]);
  const history = p.history.slice(
    -({ "1M": 22, "3M": 66, "6M": 120 }[range] || 66),
  );
  const counts = {
    Buy: p.holdings.filter((h) => h.consensus === "Buy").length,
    Hold: p.holdings.filter((h) => h.consensus === "Hold").length,
    Sell: p.holdings.filter((h) => h.consensus === "Sell").length,
  };
  const relevant = data.news.filter((n) =>
    n.symbols.some((s) => p.holdings.some((h) => h.symbol === s)),
  );
  async function generate() {
    setBusy(true);
    setError("");
    try {
      setBrief(await api<Answer>("/portfolio/briefing", { method: "POST" }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="THE BIG PICTURE"
        title="Your portfolio, in perspective."
        subtitle="A little less noise. A clearer view of what matters to your holdings."
      >
        <button className="button primary" onClick={onAdd}>
          <Plus size={16} />
          Add holding
        </button>
      </PageHeader>
      <div className="overview-grid">
        <section className="portfolio-panel">
          <div className="portfolio-value-heading">
            <span className="eyebrow">PORTFOLIO VALUE</span>
            <span className="subtle-tag">NSE · INR</span>
          </div>
          <div className="large-value">
            {money(p.value, 2).split(".")[0]}
            <span className="value-decimals">
              .{money(p.value, 2).split(".")[1]}
            </span>
          </div>
          <div className="daily-change">
            <Change value={p.day_pct} />
            <span className={p.day_pnl >= 0 ? "positive" : "negative"}>
              {p.day_pnl >= 0 ? "+" : ""}
              {money(p.day_pnl, 2)}
            </span>
            <span className="muted">{isSimulated() ? "simulated day" : "last session"}</span>
          </div>
          <div className="portfolio-metrics">
            <div>
              <span>Invested capital</span>
              <strong>{money(p.invested)}</strong>
            </div>
            <div>
              <span>Unrealized return</span>
              <strong className={p.pnl >= 0 ? "positive" : "negative"}>
                {p.pnl >= 0 ? "+" : ""}
                {money(p.pnl)} <small>{pct(p.pnl_pct)}</small>
              </strong>
            </div>
            <div>
              <span>Holdings</span>
              <strong>
                {String(p.holdings.length).padStart(2, "0")}{" "}
                <small>companies</small>
              </strong>
            </div>
          </div>
          <div className="chart-toolbar">
            <span>Portfolio movement</span>
            <div className="segmented" aria-label="Chart time range">
              {["1M", "3M", "6M"].map((r) => (
                <button
                  key={r}
                  className={r === range ? "selected" : ""}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {history.length ? (
            <PriceChart data={history} />
          ) : (
            <Empty
              title="Your first holding starts the story"
              action={
                <button className="text-button" onClick={onAdd}>
                  Add a holding <ArrowRight size={14} />
                </button>
              }
            >
              Add a company to see your portfolio’s movement.
            </Empty>
          )}
          <p className="chart-caption">
            Current quantities repriced through {isSimulated() ? "demo" : "actual"} history.
            Not transaction-based returns.
          </p>
        </section>
        <aside className="research-desk">
          <div className="desk-header">
            <span className="eyebrow">FROM THE RESEARCH DESK</span>
            <span className="edition">VOL. 01</span>
          </div>
          <h2>
            The story behind
            <br /> <em>your numbers.</em>
          </h2>
          <p className="desk-intro">
            A balanced read of your portfolio’s research signals.
          </p>
          <div className="consensus-line">
            {(["Buy", "Hold", "Sell"] as const).map((v) => (
              <div key={v}>
                <strong>{String(counts[v]).padStart(2, "0")}</strong>
                <Signal view={v} />
              </div>
            ))}
          </div>
          {brief ? (
            <AnswerBlock answer={brief} onSource={onSource} />
          ) : (
            <div className="desk-summary">
              <span className="desk-kicker">IN FOCUS</span>
              <p>
                {p.holdings.length
                  ? `${counts.Buy} holdings have a positive analyst majority. ${counts.Hold} carry mixed views${counts.Sell ? `, while ${counts.Sell} lean cautious` : ""}.`
                  : "Your research briefing will take shape as you add holdings."}
              </p>
              <span>
                {isSimulated()
                  ? "Consensus reflects fictional analyst reports, with disagreement kept visible."
                  : "Consensus reflects published analyst ratings, with disagreement kept visible."}
              </span>
            </div>
          )}
          {error && <p className="error-message">{error}</p>}
          <button
            className="button desk-button"
            onClick={generate}
            disabled={busy || !p.holdings.length}
          >
            {busy ? (
              <Spinner label="Reading the evidence…" />
            ) : (
              <>
                <span>
                  {brief ? "Refresh AI briefing" : "Generate AI briefing"}
                </span>
                <ArrowUpRight size={17} />
              </>
            )}
          </button>
          <div className="desk-bottom">
            <span className="outline-dot" />
            Grounded in your portfolio’s evidence
          </div>
        </aside>
      </div>
      <section className="holdings-section">
        <SectionTitle
          title="Your holdings"
          eyebrow="THE COMPANIES YOU OWN"
          action={
            <button
              className="text-button"
              onClick={() => navigate("holdings")}
            >
              Manage holdings <ArrowRight size={15} />
            </button>
          }
        />
        <HoldingsTable holdings={p.holdings} onStock={onStock} />
      </section>
      <div className="bottom-grid">
        <section>
          <SectionTitle
            title="On your radar"
            eyebrow="RELEVANT DEVELOPMENTS"
            action={
              <button
                className="text-button"
                onClick={() => navigate("research")}
              >
                All research <ArrowRight size={15} />
              </button>
            }
          />
          <div className="radar-feed">
            {relevant.slice(0, 3).map((n) => (
              <NewsRow key={n.id} article={n} onOpen={() => onSource(n.id)} />
            ))}
          </div>
          {!relevant.length && (
            <p className="muted">Add holdings to get relevant research.</p>
          )}
        </section>
        <section className="allocation-panel">
          <SectionTitle
            title="Where you’re invested"
            eyebrow="SECTOR EXPOSURE"
          />
          <div className="allocation-bar">
            {p.sectors.map((s, i) => (
              <span
                key={s.name}
                style={{
                  width: s.weight + "%",
                  background: SECTOR_COLORS[i % 6],
                }}
                title={`${s.name}: ${s.weight}%`}
              />
            ))}
          </div>
          <div className="allocation-list">
            {p.sectors.map((s, i) => (
              <div key={s.name}>
                <span>
                  <i style={{ background: SECTOR_COLORS[i % 6] }} />
                  {s.name}
                </span>
                <strong>{s.weight.toFixed(1)}%</strong>
              </div>
            ))}
          </div>
          <button
            className="allocation-ask"
            onClick={() =>
              onAsk(
                "Which risks and sector exposures deserve attention in my portfolio?",
              )
            }
          >
            <MessageSquare size={16} />
            <span>Ask about portfolio risk</span>
            <ArrowUpRight size={16} />
          </button>
        </section>
      </div>
    </>
  );
}

function HoldingsTable({
  holdings,
  onStock,
  onEdit,
}: {
  holdings: Holding[];
  onStock: (s: string) => void;
  onEdit?: (h: Holding) => void;
}) {
  const [sort, setSort] = useState<"value" | "symbol" | "pnl">("value");
  const rows = [...holdings].sort((a, b) =>
    sort === "symbol" ? a.symbol.localeCompare(b.symbol) : b[sort] - a[sort],
  );
  return holdings.length ? (
    <div className="table-scroll">
      <table className="holdings-table">
        <thead>
          <tr>
            <th>
              <button onClick={() => setSort("symbol")}>
                COMPANY <ChevronDown size={11} />
              </button>
            </th>
            <th>{isSimulated() ? "DEMO PRICE" : "LAST CLOSE"}</th>
            <th>20-DAY TREND</th>
            <th>
              <button onClick={() => setSort("value")}>
                VALUE <ChevronDown size={11} />
              </button>
            </th>
            <th>
              <button onClick={() => setSort("pnl")}>
                RETURN <ChevronDown size={11} />
              </button>
            </th>
            <th>RESEARCH VIEW</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id}>
              <td>
                <button
                  className="company-cell"
                  onClick={() => onStock(h.symbol)}
                >
                  <span className={"company-mark mark-" + h.symbol}>
                    {h.symbol.slice(0, 2)}
                  </span>
                  <span>
                    <strong>{h.symbol}</strong>
                    <small>{h.name}</small>
                  </span>
                </button>
              </td>
              <td>
                <strong className="number">{money(h.price, 2)}</strong>
                <small>
                  <Change value={h.change_pct} />
                </small>
              </td>
              <td>
                <Sparkline
                  values={h.sparkline}
                  positive={h.sparkline.at(-1)! >= h.sparkline[0]}
                />
              </td>
              <td>
                <strong className="number">{money(h.value)}</strong>
                <small>
                  {h.quantity} shares <span className="separator">·</span>{" "}
                  {h.weight_pct.toFixed(1)}%
                </small>
              </td>
              <td>
                <strong
                  className={"number " + (h.pnl >= 0 ? "positive" : "negative")}
                >
                  {h.pnl >= 0 ? "+" : ""}
                  {money(h.pnl)}
                </strong>
                <small className={h.pnl >= 0 ? "positive" : "negative"}>
                  {pct(h.pnl_pct)}
                </small>
              </td>
              <td>
                <Signal view={h.consensus} />
              </td>
              <td>
                {onEdit ? (
                  <button
                    className="icon-button"
                    onClick={() => onEdit(h)}
                    aria-label={"Edit " + h.symbol}
                  >
                    <Pencil size={15} />
                  </button>
                ) : (
                  <button
                    className="icon-button"
                    onClick={() => onStock(h.symbol)}
                    aria-label={"Analyze " + h.symbol}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="No holdings yet">
      Add your first stock to build a portfolio.
    </Empty>
  );
}

function HoldingsPage({
  data,
  onStock,
  onEdit,
}: {
  data: Bootstrap;
  onStock: (s: string) => void;
  onEdit: (h: Holding | "new") => void;
  onSource: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const p = data.portfolio;
  const rows = p.holdings.filter((h) =>
    (h.name + h.symbol + h.sector).toLowerCase().includes(query.toLowerCase()),
  );
  function exportCSV() {
    const values = [
      [
        "Symbol",
        "Quantity",
        "Purchase price",
        isSimulated() ? "Demo price" : "Last close",
        "Value",
        "P/L",
        "Analyst consensus",
      ],
      ...p.holdings.map((h) => [
        h.symbol,
        h.quantity,
        h.purchase_price,
        h.price,
        h.value,
        h.pnl,
        h.consensus,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([values.map((v) => v.join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = isSimulated() ? "stocklens-demo-portfolio.csv" : "stocklens-portfolio.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeader
        eyebrow="YOUR EQUITY BOOK"
        title="A closer look at what you own."
        subtitle="Manage quantities, cost basis, and the research attached to every holding."
      >
        <button className="button secondary" onClick={exportCSV}>
          <Download size={15} />
          Export CSV
        </button>
        <button className="button primary" onClick={() => onEdit("new")}>
          <Plus size={16} />
          Add holding
        </button>
      </PageHeader>
      <div className="summary-strip">
        <div>
          <span>Portfolio value</span>
          <strong>{money(p.value)}</strong>
        </div>
        <div>
          <span>Invested capital</span>
          <strong>{money(p.invested)}</strong>
        </div>
        <div>
          <span>Unrealized return</span>
          <strong className={p.pnl >= 0 ? "positive" : "negative"}>
            {pct(p.pnl_pct)}
          </strong>
        </div>
        <div>
          <span>Companies</span>
          <strong>{p.holdings.length}</strong>
        </div>
      </div>
      <div className="list-toolbar">
        <div className="input-search">
          <Search size={16} />
          <input
            placeholder="Filter holdings or sectors"
            aria-label="Filter holdings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="small muted">{rows.length} holdings · INR</span>
      </div>
      <HoldingsTable holdings={rows} onStock={onStock} onEdit={onEdit} />
      <p className="muted small table-note">
        {isSimulated()
          ? "Prices and research are simulated."
          : "End-of-day prices and analyst consensus via Yahoo Finance; the starter portfolio is an example."}{" "}
        Editing purchase price changes cost basis; history uses current quantities.
      </p>
    </>
  );
}

function ResearchPage({
  data,
  onSource,
}: {
  data: Bootstrap;
  onSource: (id: string) => void;
}) {
  const [sentiment, setSentiment] = useState("all"),
    [symbol, setSymbol] = useState("all"),
    [mine, setMine] = useState(true),
    [query, setQuery] = useState("");
  const articles = data.news.filter(
    (n) =>
      (sentiment === "all" || n.sentiment === sentiment) &&
      (symbol === "all" || n.symbols.includes(symbol)) &&
      (!mine ||
        n.symbols.some((sym) =>
          data.portfolio.holdings.some((h) => h.symbol === sym),
        )) &&
      (n.headline + " " + n.body).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="THE RESEARCH ROOM"
        title="Read the signal. Keep the context."
        subtitle="A curated view of the developments, disagreements, and risks around your holdings."
      />
      <div className="research-controls">
        <div className="filter-tabs">
          {["all", "positive", "neutral", "negative"].map((t) => (
            <button
              key={t}
              className={t === sentiment ? "active" : ""}
              onClick={() => setSentiment(t)}
            >
              {t === "all"
                ? "All perspectives"
                : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <select
          aria-label="Filter research by stock"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        >
          <option value="all">All companies</option>
          {data.stocks.map((s) => (
            <option key={s.symbol}>{s.symbol}</option>
          ))}
        </select>
      </div>
      <div className="list-toolbar">
        <div className="input-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the research"
            aria-label="Search research"
          />
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
          />
          My holdings only
        </label>
      </div>
      <div className="research-edition">
        <span>{isSimulated() ? "DEMO EDITION / 29 OCTOBER 2026" : `MARKET NEWS / ${asOfLabel().toUpperCase()}`}</span>
        <span>{articles.length} evidence records</span>
      </div>
      {articles.length ? (
        <>
          <div className="featured-news-grid">
            {articles.slice(0, 2).map((a) => (
              <NewsRow
                featured
                key={a.id}
                article={a}
                onOpen={() => onSource(a.id)}
              />
            ))}
          </div>
          <div className="research-list">
            {articles.slice(2).map((a) => (
              <NewsRow key={a.id} article={a} onOpen={() => onSource(a.id)} />
            ))}
          </div>
        </>
      ) : (
        <Empty title="Nothing matches this view">
          Try a different company, perspective, or search.
        </Empty>
      )}
      <p className="research-disclosure">
        {isSimulated()
          ? "All articles are generated for this demonstration. “Demo newsroom” is not a real publisher."
          : "Headlines come from Yahoo Finance's news feed and link to the original publisher. Tone is scored automatically by FinBERT, a finance-trained language model."}
      </p>
    </>
  );
}

function AssistantPage({
  data,
  seed,
  clearSeed,
  onSource,
  connected,
}: {
  data: Bootstrap;
  seed: string;
  clearSeed: () => void;
  onSource: (id: string) => void;
  connected: boolean;
}) {
  const [input, setInput] = useState(seed),
    [messages, setMessages] = useState<
      { q: string; a?: Answer; error?: string }[]
    >([]),
    [busy, setBusy] = useState(false),
    [scope, setScope] = useState("");
  useEffect(() => {
    if (seed) {
      setInput(seed);
      clearSeed();
    }
  }, [seed, clearSeed]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !input.trim()) return;
    const q = input.trim();
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { q }]);
    try {
      const answer = await api<Answer>("/chat", {
        method: "POST",
        body: JSON.stringify({ question: q, symbol: scope || undefined }),
      });
      setMessages((m) =>
        m.map((v, i) => (i === m.length - 1 ? { q, a: answer } : v)),
      );
    } catch (e) {
      setMessages((m) =>
        m.map((v, i) =>
          i === m.length - 1 ? { q, error: (e as Error).message } : v,
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const prompts = [
    "Why does INFY have a Buy consensus?",
    "Where do the analyst reports disagree?",
    "Which holdings have negative news?",
  ];
  return (
    <>
      <PageHeader
        eyebrow="YOUR RESEARCH COMPANION"
        title="Good questions lead to clearer decisions."
        subtitle={`Ask about the evidence behind your holdings. Every answer stays within the ${isSimulated() ? "demo dataset" : "imported evidence"}.`}
      />
      <div className="assistant-layout">
        <section className="conversation">
          <div className="conversation-top">
            <span>
              <span className={connected ? "status-dot" : "status-dot amber"} />
              {connected
                ? "Qwen 2.5 · connected through chirag"
                : "Model unavailable · research remains accessible"}
            </span>
            <button
              className="text-button"
              disabled={busy || !messages.length}
              onClick={() => setMessages([])}
            >
              Clear conversation
            </button>
          </div>
          {!messages.length ? (
            <div className="assistant-welcome">
              <div className="assistant-glyph">
                <MessageSquare size={27} />
              </div>
              <h2>Let’s connect the dots.</h2>
              <p>
                Start with a holding, a research disagreement,
                <br />
                or a risk you want to understand.
              </p>
              <div className="prompt-list">
                {prompts.map((q) => (
                  <button key={q} onClick={() => setInput(q)}>
                    {q}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages" aria-live="polite">
              {messages.map((m, i) => (
                <div className="message-pair" key={i}>
                  <div className="user-message">
                    <span className="small-avatar">YOU</span>
                    <p>{m.q}</p>
                  </div>
                  {m.a ? (
                    <AnswerBlock answer={m.a} onSource={onSource} />
                  ) : m.error ? (
                    <p className="error-message">{m.error}</p>
                  ) : (
                    <Spinner label="Reviewing the source records…" />
                  )}
                </div>
              ))}
            </div>
          )}
          <form className="chat-form" onSubmit={submit}>
            <label className="sr-only" htmlFor="chat-question">
              Your research question
            </label>
            <textarea
              id="chat-question"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your portfolio…"
              maxLength={2000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="chat-form-bottom">
              <select
                aria-label="Question scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="">Portfolio context</option>
                {data.stocks.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol}
                  </option>
                ))}
              </select>
              <span>Enter to send</span>
              <button
                type="submit"
                className="send-button"
                disabled={busy || !input.trim()}
                aria-label="Send research question"
              >
                <Send size={17} />
              </button>
            </div>
          </form>
          <p className="assistant-footnote">
            Each question is answered independently from stored evidence.{" "}
            {isSimulated() ? "All research is simulated." : "Not investment advice."}
          </p>
        </section>
        <aside className="assistant-context">
          <span className="eyebrow">THE EVIDENCE BOUNDARY</span>
          <h3>Research you can trace.</h3>
          <div>
            <span>01</span>
            <p>
              Calculations come from Python, using the{" "}
              {isSimulated() ? "generated dataset" : "imported market data"}.
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              {isSimulated()
                ? "Recommendations and targets belong to simulated analyst reports."
                : "Recommendations and targets are published analyst consensus figures."}
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              The model explains those records and points you to its sources.
            </p>
          </div>
          <div className="context-note">
            No live market access. No verified analyst registrations. No
            invented forecasts.
          </div>
        </aside>
      </div>
    </>
  );
}

function ConnectionPage({
  health,
  onRefresh,
  stocks,
  counts,
}: {
  health: Health | null;
  onRefresh: () => Promise<void>;
  stocks: Stock[];
  counts: Bootstrap["counts"];
}) {
  const [checking, setChecking] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="UNDER THE HOOD"
        title="A local workspace. A connected model."
        subtitle="Your portfolio stays in SQLite. Model requests travel through an SSH tunnel to chirag."
      >
        <button
          className="button secondary"
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            await onRefresh();
            setChecking(false);
          }}
        >
          <RefreshCw size={15} className={checking ? "spin" : ""} />
          Check connection
        </button>
      </PageHeader>
      <div className="connection-grid">
        <section className="connection-section">
          <span className="eyebrow">RESEARCH MODEL</span>
          <h2>{health?.llm.model || "qwen2.5:7b"}</h2>
          <div className="connection-state">
            <span
              className={
                health?.llm.connected ? "status-dot" : "status-dot amber"
              }
            />
            {health?.llm.connected
              ? "Connected and ready"
              : "Not connected — prepared summaries available"}
          </div>
          <dl>
            <div>
              <dt>Transport</dt>
              <dd>SSH tunnel → chirag</dd>
            </div>
            <div>
              <dt>Local endpoint</dt>
              <dd>127.0.0.1:11435</dd>
            </div>
            <div>
              <dt>Runtime</dt>
              <dd>Ollama · remote GPU</dd>
            </div>
            <div>
              <dt>Response format</dt>
              <dd>Validated JSON + source IDs</dd>
            </div>
          </dl>
          <p>
            Run <code>scripts\start.ps1</code> to start the backend and SSH
            tunnel. If the remote service was stopped, run{" "}
            <code>scripts\connect-llm.ps1</code>.
          </p>
        </section>
        <section className="connection-section">
          <span className="eyebrow">{isSimulated() ? "DEMO DATASET" : "MARKET DATA"}</span>
          <h2>Built to be reproducible.</h2>
          <dl>
            <div>
              <dt>Market universe</dt>
              <dd>
                {stocks.filter((s) => s.nifty50_member).length} Nifty 50
                constituents
                {stocks.some((s) => !s.nifty50_member) &&
                  ` + ${stocks.filter((s) => !s.nifty50_member).length} legacy demo holding`}
              </dd>
            </div>
            <div>
              <dt>As-of date</dt>
              <dd>{isSimulated() ? "29 October 2026" : asOfLabel()}</dd>
            </div>
            <div>
              <dt>Price history</dt>
              <dd>{isSimulated() ? "120 simulated trading days" : "1 year of daily closes"}</dd>
            </div>
            <div>
              <dt>Research</dt>
              <dd>
                {counts.reports} reports · {counts.articles} articles
              </dd>
            </div>
            <div>
              <dt>Persistence</dt>
              <dd>Local SQLite database</dd>
            </div>
          </dl>
          <p>
            {isSimulated()
              ? "All prices, news, financials, and analyst reports are fictional. Real company names make the demonstration familiar; they do not make the research authentic."
              : "Prices, reported financials, analyst consensus and news come from Yahoo Finance and can be delayed, incomplete or out of date. StockLens explains evidence; it does not give investment advice."}
          </p>
        </section>
      </div>
      <div className="methodology">
        <span className="eyebrow">HOW A VIEW IS FORMED</span>
        <div>
          <h3>Python calculates.</h3>
          <p>
            Value, returns, moving averages, RSI, and target upside are
            deterministic.
          </p>
        </div>
        <div>
          <h3>Research supplies opinions.</h3>
          <p>
            Buy or Sell requires more than half of reports. Otherwise the
            consensus is Hold.
          </p>
        </div>
        <div>
          <h3>The model explains.</h3>
          <p>
            It receives relevant evidence, acknowledges uncertainty, and cites
            its sources.
          </p>
        </div>
      </div>
      <a
        className="text-button api-link"
        href="/api/docs"
        target="_blank"
        rel="noreferrer"
      >
        Open API documentation <ExternalLink size={14} />
      </a>
    </>
  );
}

function HoldingDialog({
  holding,
  stocks,
  existing,
  onClose,
  onChange,
}: {
  holding: Holding | "new";
  stocks: Stock[];
  existing: Holding[];
  onClose: () => void;
  onChange: (p: Portfolio) => void;
}) {
  const edit = holding !== "new";
  const available = stocks.filter(
    (s) => !existing.some((h) => h.symbol === s.symbol),
  );
  const [symbol, setSymbol] = useState(
    edit ? holding.symbol : available[0]?.symbol || "",
  );
  const [quantity, setQuantity] = useState(
    edit ? String(holding.quantity) : "",
  );
  const [price, setPrice] = useState(
    edit ? String(holding.purchase_price) : "",
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const p = await api<Portfolio>(
        edit ? "/portfolio/holdings/" + holding.id : "/portfolio/holdings",
        {
          method: edit ? "PATCH" : "POST",
          body: JSON.stringify(
            edit
              ? { quantity: Number(quantity), purchase_price: Number(price) }
              : {
                  symbol,
                  quantity: Number(quantity),
                  purchase_price: Number(price),
                },
          ),
        },
      );
      onChange(p);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      onChange(
        await api<Portfolio>("/portfolio/holdings/" + (holding as Holding).id, {
          method: "DELETE",
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={edit ? "Edit holding" : "Add a holding"} onClose={onClose}>
      <div className="holding-form-heading">
        <span className="eyebrow">YOUR PORTFOLIO</span>
        <h2>{edit ? holding.name : "Make room for a new company."}</h2>
        <p>Record your quantity and average purchase price.</p>
      </div>
      {!edit && !available.length ? (
        <Empty title="Your Nifty 50 universe is fully covered">
          All available companies are in your portfolio. Edit an existing
          holding to change its quantity.
        </Empty>
      ) : (
        <form className="holding-form" onSubmit={submit}>
          <label>
            Company
            <select
              aria-label="Company"
              disabled={edit || busy}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              required
            >
              {(edit ? stocks : available).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} · {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Number of shares
              <input
                type="number"
                step="any"
                min="0.000001"
                max="100000000"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 10"
              />
            </label>
            <label>
              Average purchase price (₹)
              <input
                type="number"
                step="any"
                min="0.000001"
                max="1000000000"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 1,400"
              />
            </label>
          </div>
          {quantity && price && (
            <div className="cost-preview">
              <span>Total cost basis</span>
              <strong>{money(Number(quantity) * Number(price), 2)}</strong>
            </div>
          )}
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button primary" disabled={busy} type="submit">
              {busy ? "Saving…" : edit ? "Save changes" : "Add holding"}
              <ArrowRight size={15} />
            </button>
          </div>
          {edit && (
            <div className="remove-holding">
              {confirmDelete ? (
                <>
                  <p>Remove {holding.symbol} from your portfolio?</p>
                  <button
                    className="button danger"
                    type="button"
                    disabled={busy}
                    onClick={remove}
                  >
                    Confirm removal
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep holding
                  </button>
                </>
              ) : (
                <button
                  className="text-button negative"
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={14} />
                  Remove holding
                </button>
              )}
            </div>
          )}
        </form>
      )}
    </Dialog>
  );
}
