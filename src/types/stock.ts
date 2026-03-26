/** 주식 상세 페이지 타입 */

export interface StockPriceHistory {
  date: string;
  close_price: number;
  open_price: number | null;
  high_price: number | null;
  low_price: number | null;
  volume: number | null;
}

export interface StockNews {
  id: number;
  title: string;
  source: string | null;
  url: string | null;
  published_at: string | null;
  sentiment_label: string | null;
  sentiment: string | null;
  sentiment_score: number | null;
  ai_summary: string | null;
}

export interface InvestorFlow {
  id: number;
  date: string;
  foreign_buy: number | null;
  foreign_sell: number | null;
  inst_buy: number | null;
  inst_sell: number | null;
  individual_buy?: number | null;
  individual_sell?: number | null;
}

export interface Disclosure {
  id: number;
  title: string;
  report_nm: string | null;
  rcept_no: string | null;
  rcept_dt: string | null;
  corp_cls: string | null;
  url: string | null;
  published_at: string | null;
  disclosure_type: string | null;
  source: string | null;
  created_at: string | null;
}

export interface AIComment {
  summary?: string | null;
  recommendation?: string | null;
  target_price?: number | null;
  risk_factors?: string[] | null;
  key_metrics?: Record<string, string | number> | null;
  signal?: string | null;
  comment?: string | null;
  content?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}
