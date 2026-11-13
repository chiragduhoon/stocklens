export type View = "Buy" | "Hold" | "Sell" | "Unavailable";
export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  change_pct: number;
  consensus: View;
  median_target: number | null;
  target_upside_pct: number | null;
  sparkline: number[];
  simulated: boolean;
  nifty50_member: boolean;
}
export interface Holding extends Stock {
  id: number;
  quantity: number;
  purchase_price: number;
  value: number;
  cost: number;
  pnl: number;
  pnl_pct: number;
  day_pnl: number;
  weight_pct: number;
}
export interface Portfolio {
  holdings: Holding[];
  value: number;
  invested: number;
  pnl: number;
  pnl_pct: number;
  day_pnl: number;
  day_pct: number;
  history: { date: string; value: number }[];
  sectors: { name: string; value: number; weight: number }[];
  as_of: string;
  history_method: string;
}
export interface Article {
  id: string;
  symbols: string[];
  headline: string;
  body: string;
  sentiment: string;
  category: string;
  published_at: string;
  takeaway: string;
  publisher: string;
  url?: string | null;
  simulated: boolean;
}
export interface Report {
  id: string;
  symbol: string;
  analyst: string;
  recommendation: View;
  target: number;
  horizon_months: number;
  thesis: string;
  risks: string[];
  published_at: string;
  simulated: boolean;
}
export interface Detail extends Stock {
  history: { date: string; close: number; volume: number }[];
  financials: {
    source_id: string;
    period: string;
    revenue_growth_pct: number | null;
    pe_ratio: number | null;
    debt_to_equity: number | null;
    eps: number | null;
    net_margin_pct: number | null;
    stale?: boolean;
    basis?: string;
  };
  technicals: {
    sma20: number | null;
    sma50: number | null;
    rsi14: number | null;
  };
  research: {
    view: View;
    counts: Record<View, number>;
    total: number;
    median_target: number;
    low_target: number;
    high_target: number;
  };
  reports: Report[];
  news: Article[];
  as_of: string;
  metrics_source_id: string;
}
export interface Source {
  id: string;
  kind: string;
  title: string;
  body: string;
  symbol: string;
  date: string;
  simulated: boolean;
  publisher?: string | null;
  url?: string | null;
}
export interface Answer {
  answer: string;
  source_ids: string[];
  sources: Source[];
  fallback: boolean;
  model?: string;
  simulated: boolean;
  insufficient_evidence: boolean;
  notice?: string;
  mode: string;
}
export interface Health {
  status: string;
  as_of: string;
  llm: {
    connected: boolean;
    model: string;
    models: string[];
    transport: string;
    status: string;
  };
}
export interface Bootstrap {
  portfolio: Portfolio;
  stocks: Stock[];
  news: Article[];
  as_of: string;
  universe: UniverseMetadata;
  counts: { stocks: number; reports: number; articles: number };
  data_mode?: "real" | "demo";
  simulated?: boolean;
}

export interface UniverseMetadata {
  name: string;
  count: number;
  constituents_checked_on: string;
  source_url: string;
  financial_data: string;
  period: string;
}
export interface FinancialCompany {
  symbol: string;
  name: string;
  sector: string;
  source_id: string;
  nifty50_member: boolean;
  period: string;
  basis: string;
  revenue_crore: number | null;
  net_profit_crore: number | null;
  revenue_growth_pct: number | null;
  profit_growth_pct: number | null;
  net_margin_pct: number | null;
  roe_pct: number | null;
  pe_ratio: number | null;
  eps: number | null;
  debt_to_equity: number | null;
  roe_method: string;
  simulated: boolean;
  stale?: boolean;
  as_of?: string | null;
}
export interface NiftyUniverse {
  companies: FinancialCompany[];
  sectors: string[];
  metadata: UniverseMetadata;
  as_of: string;
}
export interface Comparison {
  companies: FinancialCompany[];
  observations: { metric: string; text: string; source_ids: string[] }[];
  notes: string[];
  mixed_sectors: boolean;
  metadata: UniverseMetadata;
  as_of: string;
  simulated: boolean;
}
