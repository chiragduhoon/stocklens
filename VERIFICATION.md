# Verification — 30 October 2026

- Production frontend build: passed.
- Backend integration/analytics tests: 13 passed. Includes the 50-company universe, financial comparison validation and calculations, selected-company LLM scope, repeated seeding preserving edited/deleted holdings, and previous portfolio/research checks.
- Playwright browser tests: 6 passed. Includes Nifty 50 filtering, four-company selection limit, comparison, CSV download, financial evidence, mobile overflow, and previous portfolio/research checks.
- New Nifty 50 Explore and Compare screens: zero automated Axe WCAG violations; desktop and mobile screenshots inspected. Screenshots are in `test-results/previews/nifty-explore.png`, `nifty-compare.png`, and `nifty-mobile.png`.
- Live comparison explanation verified with INFY, TCS, and HCLTECH: `qwen2.5:7b`, `fallback=false`, and valid selected financial source IDs. The Chirag SSH tunnel is connected.
- Expanded database verified: 50 official constituents plus one preserved legacy stock, 153 news articles, and 153 reports. Existing six holdings remain; value INR 333,000 and invested amount INR 322,290 are unchanged. A pre-expansion SQLite backup is stored in `data/stocklens-before-nifty50-20261030-100605.db`.
- Axe WCAG 2 A/AA and 2.1 AA scan: no violations detected on Overview, Holdings, Research, Research assistant, or Connection. This is an automated scan, not a comprehensive accessibility certification.
- Real model: `qwen2.5:7b` through the chirag SSH tunnel, Ollama reports 100% GPU usage and an 8192-token context.
- Real model cases checked: INFY explanation, analyst disagreement, unsupported weather question, portfolio briefing, and negative-news lookup. Valid source IDs resolved to evidence records. Unrelated weather was acknowledged as unsupported.
- The portfolio briefing reports exact counts (2 Buy, 3 Hold, 1 Sell in the initial six-holding portfolio) and a focused TATAMOTORS note. Negative-news lookup identifies all five matching holdings and six articles in the initial portfolio.
- Screenshots: `test-results/previews/overview-desktop.png`, `stock-research.png`, and `overview-mobile.png`.
- Startup and shutdown scripts tested; only recorded local processes are stopped. The isolated remote model service remains running.

## Boundaries

All market data and analyst identities are generated. Citations and structured output are checked, but claim-to-evidence semantics are not fully proven by those checks. The smaller local model can still phrase conclusions imprecisely. Portfolio history is a repricing of current quantities, not a transaction-based performance record. No authentication or public deployment is included; the app listens on loopback for local use.

Product Design and Figma were offered but not connected. Design decisions are captured in `design.md` and implemented with custom React/CSS, local fonts, Lucide, and Recharts.
