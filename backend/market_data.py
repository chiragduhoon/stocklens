"""Import real market data for the pinned Nifty 50 universe into the 'real' database.

    python -m backend.market_data                 # all 50 constituents
    python -m backend.market_data --symbols INFY TCS

Sources (Yahoo Finance, no API key; prices are end-of-day, not live):
  - prices:        1 year of daily OHLCV from the v8 chart endpoint
  - financials:    latest reported quarter (revenue, net income, diluted EPS) with
                   year-on-year growth vs the same quarter a year earlier; trailing P/E,
                   ROE, debt-to-equity and margin from the quote summary
  - analysts:      consensus counts (strong buy .. strong sell) and price-target range
  - news:          recent headlines with publisher and link

Companies that report in another currency (e.g. Infosys in USD) are converted to INR at the
current Yahoo FX rate, and the original currency is recorded next to the figure.
"""
import argparse
import json
import time
import urllib.request
from datetime import datetime, timezone

from sqlalchemy import select

from .database import DATA_MODE, Article, Holding, Report, SessionLocal, Stock, engine, migrate
from .universe import CONSTITUENTS

UA = {"User-Agent": "Mozilla/5.0 (StockLens research importer)"}
CRORE = 1e7
# Demo portfolio, reproduced with real prices: bought ~6 months (126 trading days) before the latest close.
EXAMPLE_HOLDINGS = {"INFY": 40, "TCS": 12, "HDFCBANK": 65, "RELIANCE": 50, "ITC": 80, "TMPV": 30}
STALE_AFTER_DAYS = 200  # older than ~two quarterly results: flag instead of presenting as current


def yahoo_symbol(nse_symbol):
    return nse_symbol + ".NS"


def fetch_history(sym, range_="1y"):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym.replace('&', '%26')}?interval=1d&range={range_}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        res = json.load(r)["chart"]["result"][0]
    q = res["indicators"]["quote"][0]
    rows = []
    for i, ts in enumerate(res.get("timestamp") or []):
        o, h, lo, c, v = (q[k][i] for k in ("open", "high", "low", "close", "volume"))
        if None in (o, h, lo, c):
            continue  # holidays / halted sessions come back as nulls
        rows.append({"date": datetime.fromtimestamp(ts, timezone.utc).date().isoformat(),
                     "open": round(o, 2), "high": round(h, 2), "low": round(lo, 2), "close": round(c, 2), "volume": int(v or 0)})
    return rows


_FX = {"INR": 1.0}


def fx_to_inr(currency):
    currency = (currency or "INR").upper()
    if currency not in _FX:
        _FX[currency] = fetch_history(f"{currency}INR=X", "5d")[-1]["close"]
    return _FX[currency]


def _row(frame, name, col):
    try:
        v = frame.loc[name].iloc[col]
        return None if v != v else float(v)  # NaN check
    except (KeyError, IndexError):
        return None


def pct(new, old):
    return round((new / old - 1) * 100, 2) if new is not None and old not in (None, 0) else None


def fundamentals(ticker, sector):
    info = ticker.info or {}
    q = ticker.quarterly_income_stmt
    cur = info.get("financialCurrency") or "INR"
    rate = fx_to_inr(cur)
    period = q.columns[0].date() if q is not None and len(q.columns) else None
    rev0, rev4 = _row(q, "Total Revenue", 0), _row(q, "Total Revenue", 4)
    ni0, ni4 = _row(q, "Net Income", 0), _row(q, "Net Income", 4)
    if ni0 is None:
        ni0, ni4 = _row(q, "Net Income Common Stockholders", 0), _row(q, "Net Income Common Stockholders", 4)
    de = info.get("debtToEquity")
    roe = info.get("returnOnEquity")
    rev_growth, profit_growth = pct(rev0, rev4), pct(ni0, ni4)
    growth_basis = "Year-on-year: latest quarter vs the same quarter a year earlier"
    age_days = (datetime.now(timezone.utc).date() - period).days if period else None
    stale = age_days is None or age_days > STALE_AFTER_DAYS
    if rev_growth is None and not stale and info.get("revenueGrowth") is not None:
        # Statement history too short (common for banks on Yahoo): use Yahoo's own quarterly YoY figures.
        rev_growth = round(info["revenueGrowth"] * 100, 2)
        profit_growth = round(info["earningsGrowth"] * 100, 2) if info.get("earningsGrowth") is not None else None
        growth_basis = "Year-on-year quarterly growth as reported by Yahoo Finance"
    return {
        "source": "Yahoo Finance",
        "simulated": False,
        "financial_period": f"Quarter ended {period:%d %b %Y}" if period else "Latest reported quarter",
        "period": f"Quarter ended {period:%d %b %Y}" if period else "Latest reported quarter",
        "revenue_crore": round(rev0 * rate / CRORE, 2) if rev0 is not None else None,
        "net_profit_crore": round(ni0 * rate / CRORE, 2) if ni0 is not None else None,
        "revenue_growth_pct": rev_growth,
        "profit_growth_pct": profit_growth,
        "growth_basis": growth_basis,
        "statement_age_days": age_days,
        "stale": stale,
        "net_margin_pct": round(ni0 / rev0 * 100, 2) if rev0 and ni0 is not None else None,
        "roe_pct": round(roe * 100, 2) if roe is not None else None,
        "roe_method": "Trailing twelve months, as reported by Yahoo Finance",
        "pe_ratio": round(info["trailingPE"], 2) if info.get("trailingPE") else None,
        "eps": round(info["trailingEps"], 2) if info.get("trailingEps") is not None else None,
        "debt_to_equity": round(de / 100, 2) if de is not None else None,
        "debt_comparable": sector != "Financial Services",
        "market_cap_crore": round(info["marketCap"] / CRORE, 0) if info.get("marketCap") else None,
        "basis": f"Reported, {cur}" + (f" converted to INR at {rate:.2f}" if cur != "INR" else ""),
        "financial_currency": cur,
        "fx_rate_to_inr": rate,
    }, info


def analyst_consensus(ticker, info):
    counts = {"Buy": 0, "Hold": 0, "Sell": 0}
    try:
        rec = ticker.recommendations
        latest = rec[rec["period"] == "0m"].iloc[0] if rec is not None and len(rec) else None
    except Exception:  # noqa: BLE001 - optional data
        latest = None
    if latest is not None:
        counts = {"Buy": int(latest["strongBuy"] + latest["buy"]), "Hold": int(latest["hold"]),
                  "Sell": int(latest["sell"] + latest["strongSell"])}
    total = sum(counts.values())
    return {"counts": counts, "total": total,
            "mean_target": info.get("targetMeanPrice"), "median_target": info.get("targetMedianPrice") or info.get("targetMeanPrice"),
            "low_target": info.get("targetLowPrice"), "high_target": info.get("targetHighPrice"),
            "recommendation_key": info.get("recommendationKey"), "analysts": info.get("numberOfAnalystOpinions") or total}


def mentions_company(text, name, symbol):
    """True if the text names the company: its symbol or the distinctive words of its name."""
    t = (text or "").lower()
    generic = {"ltd", "ltd.", "limited", "india", "of", "and", "the", "&", "company", "corporation", "industries", "bank", "services"}
    words = [w.strip(".,()").lower() for w in name.split()]
    key = [w for w in words if w not in generic and len(w) > 2][:2]
    return symbol.lower() in t or bool(key) and key[0] in t


def news_items(ticker, symbol, name="", limit=5):
    items = []
    for n in (ticker.news or []):
        if len(items) >= limit:
            break
        c = n.get("content") or n
        title = c.get("title")
        if not title or (name and not mentions_company(f"{title} {c.get('summary') or ''}", name, symbol)):
            continue
        url = ((c.get("canonicalUrl") or {}).get("url") or (c.get("clickThroughUrl") or {}).get("url") or c.get("link"))
        when = c.get("pubDate") or c.get("displayTime")
        if not when and n.get("providerPublishTime"):
            when = datetime.fromtimestamp(n["providerPublishTime"], timezone.utc).isoformat()
        items.append({"id": f"N-{symbol}-{len(items) + 1}", "headline": title, "body": c.get("summary") or c.get("description") or title,
                      "publisher": (c.get("provider") or {}).get("displayName") or n.get("publisher") or "Unknown publisher",
                      "url": url, "published_at": (when or "")[:19]})
    return items


def import_symbol(db, row):
    import yfinance as yf
    symbol, sector = row["Symbol"], row["Industry"]
    ysym = yahoo_symbol(symbol)
    history = fetch_history(ysym)
    if len(history) < 60:
        raise RuntimeError(f"only {len(history)} daily prices")
    t = yf.Ticker(ysym)
    fin, info = fundamentals(t, sector)
    fin["source_id"] = f"F-{symbol}"
    fin["as_of"] = history[-1]["date"]
    fin["analyst"] = analyst_consensus(t, info)
    s = db.get(Stock, symbol) or Stock(symbol=symbol)
    s.name, s.sector, s.price, s.history, s.financials = row["Company Name"], sector, history[-1]["close"], history, fin
    db.merge(s)
    a = fin["analyst"]
    for r in db.scalars(select(Report).where(Report.symbol == symbol)).all():
        db.delete(r)
    if a["total"]:
        view = max(a["counts"], key=a["counts"].get)
        rng = (f"; price targets INR {a['low_target']:,.0f}–{a['high_target']:,.0f}, mean INR {a['mean_target']:,.0f}"
               if a.get("low_target") and a.get("high_target") and a.get("mean_target") else "")
        db.add(Report(id=f"R-{symbol}-consensus", symbol=symbol, analyst=f"{a['total']} analysts (Yahoo Finance consensus)",
                      recommendation=view, target=a["median_target"] or 0, horizon_months=12,
                      thesis=f"{a['counts']['Buy']} Buy/Strong Buy, {a['counts']['Hold']} Hold, {a['counts']['Sell']} Sell/Strong Sell{rng}.",
                      risks=["Consensus targets are analysts' 12-month estimates, not predictions or advice."],
                      published_at=fin["as_of"]))
    for old in db.scalars(select(Article)).all():
        if old.symbols == [symbol]:
            db.delete(old)
    for n in news_items(t, symbol, row["Company Name"]):
        db.add(Article(id=n["id"], symbols=[symbol], headline=n["headline"], body=n["body"], sentiment="unscored",
                       category="News", published_at=n["published_at"], takeaway="", publisher=n["publisher"], url=n["url"]))
    return s


def ensure_example_portfolio(db):
    if db.scalars(select(Holding)).first():
        return
    for symbol, qty in EXAMPLE_HOLDINGS.items():
        s = db.get(Stock, symbol)
        if s and len(s.history) > 126:
            db.add(Holding(symbol=symbol, quantity=qty, purchase_price=s.history[-127]["close"]))


def main():
    if DATA_MODE != "real":
        raise SystemExit("Set STOCKLENS_DATA=real (the default) to import market data.")
    ap = argparse.ArgumentParser()
    ap.add_argument("--symbols", nargs="*")
    args = ap.parse_args()
    migrate(engine)
    rows = [r for r in CONSTITUENTS if not args.symbols or r["Symbol"] in args.symbols]
    ok, failed = [], {}
    with SessionLocal() as db:
        for i, row in enumerate(rows, 1):
            try:
                import_symbol(db, row)
                db.commit()
                ok.append(row["Symbol"])
                print(f"[{i}/{len(rows)}] {row['Symbol']} ok", flush=True)
            except Exception as e:  # noqa: BLE001 - keep importing the rest
                db.rollback()
                failed[row["Symbol"]] = str(e)[:150]
                print(f"[{i}/{len(rows)}] {row['Symbol']} FAILED: {failed[row['Symbol']]}", flush=True)
            time.sleep(0.4)  # be polite to Yahoo
        if not args.symbols:  # only a full import has every example holding available
            ensure_example_portfolio(db)
        db.commit()
    print(json.dumps({"imported": len(ok), "failed": failed}, indent=2))


if __name__ == "__main__":
    main()
