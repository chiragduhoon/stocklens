import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  MessageSquare,
  Info,
} from "lucide-react";
import { api, money, pct } from "./api";
import type { Detail, Answer } from "./types";
import {
  AnswerBlock,
  Change,
  Dialog,
  NewsRow,
  PriceChart,
  Signal,
  SourceChips,
  Spinner,
  Empty,
} from "./components";

import { isSimulated, asOfLabel } from "./dataMode";
export function StockDrawer({
  symbol,
  onClose,
  onSource,
  onAsk,
}: {
  symbol: string;
  onClose: () => void;
  onSource: (id: string) => void;
  onAsk: (q: string) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Overview");
  const [answer, setAnswer] = useState<Answer | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api<Detail>(`/stocks/${symbol}/analysis`)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [symbol]);
  async function explain() {
    setBusy(true);
    setError("");
    try {
      setAnswer(
        await api<Answer>(`/stocks/${symbol}/explain`, { method: "POST" }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Company research" onClose={onClose} drawer>
      {!detail ? (
        error ? (
          <Empty title="Research unavailable">{error}</Empty>
        ) : (
          <Spinner label="Opening the research file…" />
        )
      ) : (
        <>
          <div className="stock-heading">
            <span className={"company-mark large mark-" + symbol}>
              {symbol.slice(0, 2)}
            </span>
            <div>
              <span className="eyebrow">NSE / {detail.sector}</span>
              <h2>{detail.name}</h2>
              <span className="stock-symbol">{symbol}</span>
            </div>
          </div>
          <div className="stock-quote">
            <strong>{money(detail.price, 2)}</strong>
            <Change value={detail.change_pct} />
            <span>{isSimulated() ? "Simulated close · 29 Oct" : `Close · ${asOfLabel()}`}</span>
          </div>
          <div className="stock-tabs">
            {["Overview", "Analyst research", "News"].map((t) => (
              <button
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t}
                {t === "News" && <span>{detail.news.length}</span>}
              </button>
            ))}
          </div>
          {tab === "Overview" && (
            <>
              <PriceChart
                data={detail.history.slice(-66)}
                kind="close"
                height={220}
              />
              <div className="stock-research-summary">
                <div>
                  <span className="eyebrow">ANALYST CONSENSUS</span>
                  <Signal view={detail.consensus} />
                  <small>
                    {detail.research.total} {isSimulated() ? "simulated reports" : "analysts"} ·
                    12-month horizon
                  </small>
                </div>
                <div>
                  <span className="eyebrow">MEDIAN TARGET</span>
                  <strong>{money(detail.research.median_target)}</strong>
                  <small
                    className={
                      detail.target_upside_pct! >= 0 ? "positive" : "negative"
                    }
                  >
                    {pct(detail.target_upside_pct!)} {isSimulated() ? "scenario upside" : "to median target"}
                  </small>
                </div>
              </div>
              <div className="mini-section-heading">
                <h3>Fundamentals, at a glance</h3>
                <button
                  className="text-button"
                  onClick={() => onSource(detail.financials.source_id)}
                >
                  Source <ArrowUpRight size={13} />
                </button>
              </div>
              <div className="fundamentals-grid">
                <div>
                  <span>Revenue growth</span>
                  <strong
                    className={
                      detail.financials.revenue_growth_pct == null
                        ? ""
                        : detail.financials.revenue_growth_pct >= 0
                          ? "positive"
                          : "negative"
                    }
                  >
                    {detail.financials.revenue_growth_pct == null
                      ? "—"
                      : pct(detail.financials.revenue_growth_pct)}
                  </strong>
                </div>
                <div>
                  <span>P/E ratio</span>
                  <strong>
                    {detail.financials.pe_ratio == null ? "—" : `${detail.financials.pe_ratio}×`}
                  </strong>
                </div>
                <div>
                  <span>Debt / equity</span>
                  <strong>
                    {detail.financials.debt_to_equity == null
                      ? "—"
                      : detail.financials.debt_to_equity.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span>Earnings per share</span>
                  <strong>
                    {detail.financials.eps == null ? "—" : money(detail.financials.eps, 2)}
                  </strong>
                </div>
              </div>
              {detail.financials.stale && (
                <p className="muted small">
                  The latest statement on the data source ({detail.financials.period}) is more than six
                  months old; growth is not shown.
                </p>
              )}
              <div className="mini-section-heading">
                <h3>Technical context</h3>
                <button
                  className="text-button"
                  onClick={() => onSource(detail.metrics_source_id)}
                >
                  Calculation <ArrowUpRight size={13} />
                </button>
              </div>
              <div className="technical-grid">
                <div>
                  <span>20-day average</span>
                  <strong>
                    {detail.technicals.sma20 === null
                      ? "Insufficient data"
                      : money(detail.technicals.sma20, 2)}
                  </strong>
                </div>
                <div>
                  <span>50-day average</span>
                  <strong>
                    {detail.technicals.sma50 === null
                      ? "Insufficient data"
                      : money(detail.technicals.sma50, 2)}
                  </strong>
                </div>
                <div>
                  <span>RSI · 14 days</span>
                  <strong>
                    {detail.technicals.rsi14 ?? "Insufficient data"}
                  </strong>
                </div>
              </div>
              <div className="stock-explanation">
                <div className="mini-section-heading">
                  <h3>Connect the evidence</h3>
                  <BookOpen size={17} />
                </div>
                {answer ? (
                  <AnswerBlock answer={answer} onSource={onSource} />
                ) : (
                  <p>
                    Get a clear explanation of the financials, analyst
                    disagreements, and risks behind this stock’s research view.
                  </p>
                )}
                {error && <p className="error-message">{error}</p>}
                <button
                  className="button primary"
                  onClick={explain}
                  disabled={busy}
                >
                  {busy ? (
                    <Spinner label="Reading the research…" />
                  ) : (
                    <>
                      {answer ? "Refresh explanation" : "Explain this stock"}
                      <ArrowUpRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
          {tab === "Analyst research" && (
            <div className="analyst-research">
              <div className="research-intro">
                <span className="eyebrow">
                  DIFFERENT VIEWS. VISIBLE ASSUMPTIONS.
                </span>
                <h3>A consensus is a starting point.</h3>
                <p>
                  {isSimulated()
                    ? "Each report presents a fictional scenario. Compare the reasoning, time horizon, and risks."
                    : "Counts and price targets are published analyst ratings. Individual reasoning is not included; read the linked news for context."}
                </p>
              </div>
              <div className="consensus-distribution">
                {(["Buy", "Hold", "Sell"] as const).map((v) => (
                  <div key={v}>
                    <Signal view={v} />
                    <strong>{detail.research.counts[v]}</strong>
                    <span>of {detail.research.total}</span>
                  </div>
                ))}
              </div>
              <div className="target-range">
                <span>12-month target range</span>
                <div>
                  <strong>{money(detail.research.low_target)}</strong>
                  <div className="range-line">
                    <i
                      style={{
                        left: `${((detail.research.median_target - detail.research.low_target) / (detail.research.high_target - detail.research.low_target || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <strong>{money(detail.research.high_target)}</strong>
                </div>
                <p>
                  Median: {money(detail.research.median_target)} · {isSimulated() ? "Current demo price" : "Last close"}:{" "}
                  {money(detail.price)}
                </p>
              </div>
              {detail.reports.map((r) => (
                <article className="analyst-card" key={r.id}>
                  <div className="analyst-card-top">
                    <div>
                      <h4>{r.analyst}</h4>
                      <span>
                        {r.simulated ? "Simulated analyst" : "Consensus"} ·{" "}
                        {r.horizon_months}-month horizon
                      </span>
                    </div>
                    <Signal view={r.recommendation} />
                  </div>
                  <div className="analyst-target">
                    <span>Target</span>
                    <strong>{money(r.target)}</strong>
                  </div>
                  <p>{r.thesis}</p>
                  <div className="analyst-risk">
                    <span>KEY RISK</span>
                    {r.risks[0]}
                  </div>
                  <button
                    className="text-button"
                    onClick={() => onSource(r.id)}
                  >
                    Read evidence record <ArrowUpRight size={14} />
                  </button>
                </article>
              ))}
            </div>
          )}
          {tab === "News" && (
            <div className="stock-news">
              {detail.news.map((n) => (
                <NewsRow
                  featured
                  key={n.id}
                  article={n}
                  onOpen={() => onSource(n.id)}
                />
              ))}
            </div>
          )}
          <div className="stock-bottom">
            <button
              className="button secondary"
              onClick={() =>
                onAsk(
                  `Explain the analyst disagreements and main risks for ${symbol}.`,
                )
              }
            >
              <MessageSquare size={16} />
              Ask about {symbol}
              <ArrowRight size={15} />
            </button>
            <p>
              <Info size={13} />
              {isSimulated()
                ? "All prices and research are simulated. Targets are scenarios, not guarantees."
                : "End-of-day data via Yahoo Finance. Analyst targets are estimates, not guarantees or advice."}
            </p>
          </div>
        </>
      )}
    </Dialog>
  );
}
