import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  ArrowRight,
  Check,
  Columns3,
  Download,
  Info,
  Search,
  X,
} from "lucide-react";
import { api, money, pct } from "./api";
import { AnswerBlock, Empty, SourceChips, Spinner } from "./components";
import type {
  Answer,
  Comparison,
  FinancialCompany,
  NiftyUniverse,
} from "./types";

import { isSimulated, asOfLabel } from "./dataMode";
type MetricKey =
  | "revenue_crore"
  | "net_profit_crore"
  | "revenue_growth_pct"
  | "profit_growth_pct"
  | "net_margin_pct"
  | "roe_pct"
  | "pe_ratio"
  | "debt_to_equity"
  | "eps";
const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "revenue_crore", label: "Revenue", unit: "₹ crore / quarter" },
  { key: "net_profit_crore", label: "Net profit", unit: "₹ crore / quarter" },
  {
    key: "revenue_growth_pct",
    label: "Revenue growth",
    unit: "% year-on-year",
  },
  { key: "profit_growth_pct", label: "Profit growth", unit: "% year-on-year" },
  { key: "net_margin_pct", label: "Net margin", unit: "%" },
  { key: "roe_pct", label: "Return on equity", unit: "% annualized" },
  { key: "pe_ratio", label: "Price / earnings", unit: "times" },
  {
    key: "debt_to_equity",
    label: "Debt / equity",
    unit: "times · non-financials",
  },
  { key: "eps", label: "Earnings per share", unit: "₹" },
];
const num = (v: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(v);
function value(c: FinancialCompany, k: MetricKey) {
  const v = c[k];
  if (v === null) return "—";
  if (k.endsWith("_pct"))
    return (k.includes("growth") && v > 0 ? "+" : "") + v.toFixed(2) + "%";
  if (k === "eps") return money(v, 2);
  if (k === "pe_ratio" || k === "debt_to_equity") return v.toFixed(2) + "×";
  return num(v);
}

export function NiftyPage({
  onStock,
  onSource,
}: {
  onStock: (symbol: string) => void;
  onSource: (id: string) => void;
}) {
  const [universe, setUniverse] = useState<NiftyUniverse | null>(null),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [sector, setSector] = useState("all"),
    [tab, setTab] = useState<"explore" | "compare">("explore");
  const [selected, setSelected] = useState<string[]>([
    "INFY",
    "TCS",
    "HCLTECH",
  ]);
  const [sort, setSort] = useState("name"),
    [direction, setDirection] = useState(1);
  const [comparison, setComparison] = useState<Comparison | null>(null),
    [busy, setBusy] = useState(false),
    [thinking, setThinking] = useState(false),
    [answer, setAnswer] = useState<Answer | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    api<NiftyUniverse>("/nifty50", { signal: abort.signal })
      .then(setUniverse)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => abort.abort();
  }, []);
  const selectionKey = selected.join(",");
  useEffect(() => {
    setAnswer(null);
    setComparison(null);
    setError("");
    if (tab !== "compare" || selected.length < 2) return;
    const abort = new AbortController();
    setBusy(true);
    api<Comparison>("/compare", {
      method: "POST",
      signal: abort.signal,
      body: JSON.stringify({ symbols: selected }),
    })
      .then(setComparison)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [selectionKey, tab]);
  const rows = useMemo(() => {
    if (!universe) return [];
    return universe.companies
      .filter(
        (c) =>
          (sector === "all" || sector === c.sector) &&
          (c.name + " " + c.symbol).toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => {
        if (sort === "name") return direction * a.name.localeCompare(b.name);
        return (
          direction *
          ((a[sort as MetricKey] ?? -Infinity) -
            (b[sort as MetricKey] ?? -Infinity))
        );
      });
  }, [universe, query, sector, sort, direction]);
  function toggle(symbol: string) {
    if (thinking) return;
    setSelected((old) =>
      old.includes(symbol)
        ? old.filter((s) => s !== symbol)
        : old.length < 4
          ? [...old, symbol]
          : old,
    );
  }
  function order(key: string) {
    if (sort === key) setDirection((d) => -d);
    else {
      setSort(key);
      setDirection(key === "name" ? 1 : -1);
    }
  }
  async function explain() {
    setThinking(true);
    setError("");
    try {
      setAnswer(
        await api<Answer>("/compare/explain", {
          method: "POST",
          body: JSON.stringify({ symbols: selected }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setThinking(false);
    }
  }
  function download() {
    if (!comparison) return;
    const csv = [
      ["Metric", "Unit", ...comparison.companies.map((c) => c.symbol)],
      ["Period", "", ...comparison.companies.map((c) => c.period)],
      ...METRICS.map((m) => [
        m.label,
        m.unit,
        ...comparison.companies.map((c) => c[m.key] ?? "Not comparable"),
      ]),
      ["Source ID", "", ...comparison.companies.map((c) => c.source_id)],
      [
        "Data",
        "",
        ...comparison.companies.map((c) =>
          isSimulated() ? "Simulated financial data" : `${c.basis}${c.stale ? " (stale)" : ""}`,
        ),
      ],
    ]
      .map((row) =>
        row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "stocklens-nifty50-financial-comparison.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">THE NIFTY 50 RESEARCH UNIVERSE</span>
          <h1>Fifty companies. A clearer comparison.</h1>
          <p>
            Explore the index, compare financials, and understand the trade-offs
            behind the numbers.
          </p>
        </div>
        <span className="universe-count">
          <strong>{universe?.metadata.count || 50}</strong>
          <span>
            companies
            <br />
            one research view
          </span>
        </span>
      </div>
      <div className="nifty-provenance">
        <span>
          <span className="status-dot" />
          Constituents checked 30 Oct 2026
        </span>
        <span>
          {isSimulated()
            ? "Financials: Q2 FY27 · generated demo data"
            : "Financials: latest reported quarter · Yahoo Finance"}
        </span>
        <a
          href={
            universe?.metadata.source_url ||
            "https://www.niftyindices.com/indices/equity/broad-based-indices/nifty--50"
          }
          target="_blank"
          rel="noreferrer"
        >
          NSE constituent source <ArrowUpRight size={13} />
        </a>
      </div>
      <div className="nifty-tabs" role="tablist" aria-label="Nifty 50 views">
        <button
          role="tab"
          aria-selected={tab === "explore"}
          className={tab === "explore" ? "active" : ""}
          onClick={() => setTab("explore")}
        >
          Explore companies <span>50</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "compare"}
          className={tab === "compare" ? "active" : ""}
          onClick={() => setTab("compare")}
        >
          Compare financials <span>{selected.length}</span>
        </button>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {!universe && !error ? (
        <Spinner label="Opening the Nifty 50 universe…" />
      ) : tab === "explore" && universe ? (
        <>
          <div className="nifty-toolbar">
            <div className="input-search">
              <Search size={16} />
              <input
                aria-label="Search Nifty 50 companies"
                placeholder="Search company name or symbol"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <label className="sector-filter">
              <span>Sector</span>
              <select
                aria-label="Filter Nifty 50 by sector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
              >
                <option value="all">All sectors</option>
                {universe.sectors.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <span className="small muted">{rows.length} of 50 companies</span>
          </div>
          <div
            className="nifty-table-scroll"
            role="region"
            aria-label="Nifty 50 financial screener"
            tabIndex={0}
          >
            <table className="nifty-table">
              <thead>
                <tr>
                  <th>
                    <span className="sr-only">Select for comparison</span>
                  </th>
                  <th>
                    <button onClick={() => order("name")}>
                      COMPANY <ArrowDown size={11} />
                    </button>
                  </th>
                  <th>SECTOR</th>
                  {[
                    { k: "revenue_growth_pct", t: "REVENUE GROWTH" },
                    { k: "net_margin_pct", t: "NET MARGIN" },
                    { k: "roe_pct", t: "ROE" },
                    { k: "pe_ratio", t: "P/E" },
                  ].map((m) => (
                    <th key={m.k}>
                      <button onClick={() => order(m.k)}>
                        {m.t}
                        <ArrowDown size={11} />
                      </button>
                    </th>
                  ))}
                  <th>
                    <span className="sr-only">Open research</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.symbol}
                    className={selected.includes(c.symbol) ? "is-selected" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={"Compare " + c.symbol}
                        checked={selected.includes(c.symbol)}
                        disabled={
                          thinking ||
                          (!selected.includes(c.symbol) && selected.length >= 4)
                        }
                        onChange={() => toggle(c.symbol)}
                      />
                    </td>
                    <td>
                      <button
                        className="company-cell"
                        onClick={() => onStock(c.symbol)}
                      >
                        <span className="company-mark">
                          {c.symbol.slice(0, 2)}
                        </span>
                        <span>
                          <strong>{c.symbol}</strong>
                          <small>{c.name}</small>
                        </span>
                      </button>
                    </td>
                    <td className="nifty-sector">{c.sector}</td>
                    <td
                      className={
                        "number " + ((c.revenue_growth_pct ?? 0) < 0 ? "negative" : "")
                      }
                    >
                      {value(c, "revenue_growth_pct")}
                    </td>
                    <td className="number">{value(c, "net_margin_pct")}</td>
                    <td className="number">{value(c, "roe_pct")}</td>
                    <td className="number">{value(c, "pe_ratio")}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"Research " + c.symbol}
                        onClick={() => onStock(c.symbol)}
                      >
                        <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <Empty title="No companies match">
                Try another company or sector.
              </Empty>
            )}
          </div>
          <div className="selection-tray">
            <div>
              <span className="eyebrow">SELECT TWO TO FOUR COMPANIES</span>
              <div className="selected-companies">
                {selected.length ? (
                  selected.map((s) => (
                    <button
                      disabled={thinking}
                      key={s}
                      onClick={() => toggle(s)}
                      aria-label={"Remove " + s + " from comparison"}
                    >
                      {s}
                      <X size={12} />
                    </button>
                  ))
                ) : (
                  <span className="small muted">
                    Select companies using the checkboxes above.
                  </span>
                )}
              </div>
            </div>
            <button
              className="button primary"
              disabled={selected.length < 2}
              onClick={() => setTab("compare")}
            >
              Compare {selected.length} companies <ArrowRight size={15} />
            </button>
          </div>
        </>
      ) : tab === "compare" ? (
        <>
          <div className="comparison-toolbar">
            <div className="selected-companies">
              {selected.map((s) => (
                <button
                  disabled={thinking}
                  key={s}
                  onClick={() => toggle(s)}
                  aria-label={"Remove " + s + " from comparison"}
                >
                  {s}
                  <X size={12} />
                </button>
              ))}
            </div>
            <button className="text-button" onClick={() => setTab("explore")}>
              <Columns3 size={14} />
              Change selection
            </button>
            {comparison && (
              <button className="button secondary" onClick={download}>
                <Download size={14} />
                Export CSV
              </button>
            )}
          </div>
          {selected.length < 2 ? (
            <Empty
              title="Choose at least two companies"
              action={
                <button
                  className="button primary"
                  onClick={() => setTab("explore")}
                >
                  Explore Nifty 50 <ArrowRight size={14} />
                </button>
              }
            >
              Select up to four companies to compare their financials on the
              same reporting basis.
            </Empty>
          ) : busy ? (
            <Spinner label="Comparing financial statements…" />
          ) : comparison ? (
            <>
              <div
                className={
                  "comparison-context " +
                  (comparison.mixed_sectors ? "mixed" : "")
                }
              >
                <Info size={16} />
                <p>
                  {comparison.mixed_sectors
                    ? "Different sectors, different business models. Read the figures in context; they do not establish an overall winner."
                    : "A peer comparison within " +
                      comparison.companies[0].sector +
                      (isSimulated()
                        ? ". All figures use the same simulated quarter."
                        : ". Check each column's reporting period before comparing.")}
                </p>
              </div>
              <div
                className="comparison-table-scroll"
                role="region"
                aria-label="Selected company financial comparison"
                tabIndex={0}
              >
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>
                        <span className="eyebrow">CONSOLIDATED FINANCIALS</span>
                        <strong>{isSimulated() ? "Q2 FY27" : "Latest quarter"}</strong>
                        <small>
                          {isSimulated() ? "Generated demonstration data" : "Reported, via Yahoo Finance"}
                        </small>
                      </th>
                      {comparison.companies.map((c) => (
                        <th key={c.symbol}>
                          <button onClick={() => onStock(c.symbol)}>
                            {c.symbol}
                            <ArrowUpRight size={13} />
                          </button>
                          <small>{c.name}</small>
                          <span>{c.sector}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {METRICS.map((m) => (
                      <tr key={m.key}>
                        <th scope="row">
                          <strong>{m.label}</strong>
                          <span>{m.unit}</span>
                        </th>
                        {comparison.companies.map((c) => (
                          <td
                            key={c.symbol}
                            className={
                              c[m.key] !== null && c[m.key]! < 0
                                ? "negative"
                                : ""
                            }
                          >
                            {value(c, m.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="source-row">
                      <th scope="row">Evidence</th>
                      {comparison.companies.map((c) => (
                        <td key={c.symbol}>
                          <button
                            className="text-button"
                            onClick={() => onSource(c.source_id)}
                          >
                            Financial record <ArrowUpRight size={12} />
                          </button>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <section className="comparison-observations">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">WHAT THE NUMBERS SAY</span>
                    <h2>A few useful distinctions.</h2>
                  </div>
                  <button
                    className="button primary"
                    disabled={thinking}
                    onClick={explain}
                  >
                    {thinking ? (
                      <Spinner label="Reading the financials…" />
                    ) : (
                      <>
                        {answer
                          ? "Refresh explanation"
                          : "Explain this comparison"}
                        <ArrowUpRight size={14} />
                      </>
                    )}
                  </button>
                </div>
                <div className="observation-grid">
                  {comparison.observations.map((o, i) => (
                    <div key={o.metric}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <p>{o.text}</p>
                    </div>
                  ))}
                </div>
                {answer && (
                  <div className="comparison-answer">
                    <AnswerBlock answer={answer} onSource={onSource} />
                  </div>
                )}
              </section>
              <div className="comparison-notes">
                <span className="eyebrow">READ THE COMPARISON CORRECTLY</span>
                {comparison.notes.map((n) => (
                  <p key={n}>
                    <span>—</span>
                    {n}
                  </p>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
