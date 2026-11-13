"""Real-data importer and real-mode analytics, tested offline with fake Yahoo responses."""
from datetime import date, timedelta
from types import SimpleNamespace

import pandas as pd

from backend import market_data as md
from backend.analytics import consensus
from backend.comparison import compare_rows


def quarterly(revenue, income, latest):
    cols = [pd.Timestamp(latest - timedelta(days=91 * i)) for i in range(len(revenue))]
    return pd.DataFrame([revenue, income], index=["Total Revenue", "Net Income"], columns=cols)


def ticker(info, q=None, recs=None, news=None):
    return SimpleNamespace(info=info, quarterly_income_stmt=q, recommendations=recs, news=news or [])


def test_usd_reporter_is_converted_to_inr_crore(monkeypatch):
    monkeypatch.setitem(md._FX, "USD", 90.0)
    q = quarterly([5e9, 4.9e9, 4.8e9, 4.7e9, 4.6e9], [8e8, 7e8, 7e8, 7e8, 8e8], date.today() - timedelta(days=40))
    f, _ = md.fundamentals(ticker({"financialCurrency": "USD", "trailingPE": 20.0, "debtToEquity": 10.0, "returnOnEquity": 0.3}, q), "Information Technology")
    assert f["revenue_crore"] == round(5e9 * 90 / 1e7, 2)              # 45,000 crore, not 500
    assert f["revenue_growth_pct"] == round((5e9 / 4.6e9 - 1) * 100, 2)  # same quarter a year earlier
    assert f["profit_growth_pct"] == 0.0 and f["net_margin_pct"] == 16.0
    assert f["debt_to_equity"] == 0.1 and f["roe_pct"] == 30.0
    assert "USD converted to INR" in f["basis"] and f["stale"] is False


def test_stale_statement_is_flagged_and_growth_not_guessed():
    q = quarterly([1e11, 9e10], [2e10, 1.8e10], date.today() - timedelta(days=500))  # no year-ago column either
    f, _ = md.fundamentals(ticker({"financialCurrency": "INR", "revenueGrowth": 0.808}, q), "Financial Services")
    assert f["stale"] is True
    assert f["revenue_growth_pct"] is None   # an implausible fallback is not shown for an out-of-date statement
    assert f["debt_comparable"] is False


def test_recent_short_history_uses_yahoo_growth():
    q = quarterly([1e11, 9e10], [2e10, 1.8e10], date.today() - timedelta(days=30))
    f, _ = md.fundamentals(ticker({"financialCurrency": "INR", "revenueGrowth": 0.12, "earningsGrowth": -0.05}, q), "Energy")
    assert f["revenue_growth_pct"] == 12.0 and f["profit_growth_pct"] == -5.0
    assert "as reported by Yahoo" in f["growth_basis"]


def test_analyst_counts_merge_strong_ratings():
    recs = pd.DataFrame([{"period": "0m", "strongBuy": 10, "buy": 11, "hold": 17, "sell": 1, "strongSell": 3}])
    a = md.analyst_consensus(ticker({}, recs=recs), {"targetMeanPrice": 1200, "targetLowPrice": 990, "targetHighPrice": 1627})
    assert a["counts"] == {"Buy": 21, "Hold": 17, "Sell": 4} and a["total"] == 42
    assert a["median_target"] == 1200  # falls back to the mean when no median is published


def test_consensus_uses_real_aggregate_when_present():
    agg = {"counts": {"Buy": 40, "Hold": 2, "Sell": 0}, "total": 42, "median_target": 947, "low_target": 830, "high_target": 1270}
    c = consensus([], agg)
    assert c["view"] == "Buy" and c["total"] == 42 and c["low_target"] == 830
    split = consensus([], {**agg, "counts": {"Buy": 20, "Hold": 12, "Sell": 10}})
    assert split["view"] == "Hold"  # no majority -> Hold


def test_news_keeps_only_items_about_the_company():
    news = [{"content": {"title": "Asian equities rise in US trading", "summary": "ADRs moved higher.", "provider": {"displayName": "MT"}}},
            {"content": {"title": "Infosys shares dip as outlook softens", "summary": "", "provider": {"displayName": "Investing.com"},
                         "canonicalUrl": {"url": "https://example.com/a"}, "pubDate": "2026-11-10T08:00:00Z"}}]
    items = md.news_items(ticker({}, news=news), "INFY", "Infosys Ltd.")
    assert [i["publisher"] for i in items] == ["Investing.com"]
    assert items[0]["url"] == "https://example.com/a" and items[0]["id"] == "N-INFY-1"
    assert md.mentions_company("Tata Motors Q1 profit falls", "Tata Motors Passenger Vehicles Ltd.", "TMPV")


def test_comparison_skips_metrics_missing_for_some_companies():
    base = dict(sector="Banks", source_id="F-X", debt_to_equity=None, simulated=False, stale=False, as_of="2026-11-12",
                period="Quarter ended 30 Sep 2026", net_margin_pct=10.0, roe_pct=12.0, pe_ratio=15.0)
    rows = [{**base, "symbol": "AAA", "revenue_growth_pct": None}, {**base, "symbol": "BBB", "revenue_growth_pct": 8.0}]
    out = compare_rows(rows)   # used to raise TypeError on None
    growth = [o for o in out["observations"] if o["metric"] == "revenue_growth_pct"][0]
    assert "BBB" in growth["text"] and out["simulated"] is False
    all_missing = compare_rows([{**r, "revenue_growth_pct": None} for r in rows])
    assert not any(o["metric"] == "revenue_growth_pct" for o in all_missing["observations"])
