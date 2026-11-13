# StockLens design system

## Intent
A considered research workspace for an Indian equity portfolio. The central task is to move from a holding to the evidence behind a research view, then ask a grounded question. Portfolio management, source inspection, and the AI connection must all work.

## Art direction
Quiet financial editorial: warm mineral grey, ivory paper, graphite ink, muted pine green. Serif headlines lend character; compact sans-serif labels and tabular monospaced figures keep financial data legible. Prefer rules, whitespace, and aligned columns to floating dashboard cards. No purple gradients, glass effects, stock photography, decorative AI art, or oversized rounded containers.

## Tokens
- Canvas #f6f6f2; rail #eeefea; paper #ffffff; ink #242d28; secondary #6c746d; border #dce0d8.
- Accent pine #315c46; positive #28714c; negative #aa5546; amber #8f703a.
- Fonts: DM Sans for interface; Instrument Serif for page titles; IBM Plex Mono for numbers and small data labels. Bundled locally through fontsource.
- Spacing: 4/8/12/16/24/32/48px; radius 4–10px; border 1px. Shadows reserved for dialogs and drawers.
- Desktop rail 208px; content max width 1440px; standard main gutter 40px. Stack research column below the chart on narrow screens. Mobile uses a compact header and horizontally scrollable navigation.

## Composition
1. Persistent compact navigation: Overview, Nifty 50, Holdings, Research, Research assistant, Connection.
2. Header shows fixed demo as-of date, simulation status, and factual LLM connection state.
3. Overview combines a large portfolio value, compact performance metrics, historical repricing chart, editorial research brief, holdings table, and recent catalysts.
4. Stock drawer shows targets and divergent analyst views beside calculated fundamentals, technical indicators, and inspectable evidence records.
5. Research feed uses editorial rows and topic/symbol filters. Full records open in a dialog; never link fictional articles to real publishers.
6. Chat shows source chips that open the exact evidence. No fake typing response or implied model connection.
7. Nifty 50 uses an editorial company screener, sector filters, and a visible two-to-four company selection tray. Comparison aligns metrics by reporting period, with inspectable financial records and a CSV export. Generated figures and official membership have separate provenance labels. Use horizontal scrolling inside tables on mobile, never on the entire page. Present calculated observations before the optional model explanation; avoid arbitrary scores or a universal winner across sectors.

## Behavior and accessibility
Every visible action does something: navigation, date range, search, sorting, filters, evidence links, holding CRUD, brief generation, chat, connection refresh. Show pending/error/empty states. Native buttons and labels; keyboard focus always visible; Escape closes dialogs; focus is trapped in modal dialogs and restored to their opener. Respect reduced motion. Do not communicate sentiment using color alone.

## Truthfulness
Generated market data remains visibly labeled. Fictional analyst profiles say simulated; never claim SEBI registration. Analyst recommendations are aggregated, not invented by the LLM. Price history uses a fixed demo date. Portfolio history reprices the current quantities and is not a transaction-based equity curve. Model responses identify fallback mode. LLM transport is an SSH tunnel to the chirag host; connection settings explain this without exposing secrets.

## Acceptance
At 1440px the chart and research column feel balanced; all holdings remain scannable. At 390px all navigation and dialogs remain usable with no page overflow. Editing a holding updates all portfolio-derived views. Every generated explanation has valid source IDs and discloses missing evidence. UI can continue with prepared summaries if the LLM is disconnected.
