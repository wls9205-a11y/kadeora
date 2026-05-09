// s262 Phase B — Issue Engine 타입. Phase A 마이그레이션 컬럼과 1:1.

export type IssueWarning =
  | 'volatility_high'
  | 'new_listing'
  | 'managed_stock'
  | 'unsold_repeat';

export type IssueReasonTag =
  // stock_issue_scores 가 emit
  | 'vol' | 'chg' | 'new'
  // apt_issue_scores 가 emit
  | 'dday' | 'reg' | 'sub' | 'pol'
  // forward-compat (V2 enable 후 추가될 reason)
  | 'news' | 'frgn' | 'disc' | 'thm';

export type IssueReason = {
  tag: IssueReasonTag;
  value: number; // 0..1 normalized
};

// stock_issue_scores 매트뷰 row
export type StockIssueScore = {
  symbol: string;
  name: string;
  market: string | null;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  market_cap: number | null;
  sector: string | null;
  sparkline_5d?: number[] | null; // s262-E: 5거래일 close_price array
  score: number; // numeric(5,4) 0..1
  reasons: IssueReason[];
  warning: IssueWarning | null;
  computed_at?: string;
};

// apt_issue_scores 매트뷰 row
export type AptIssueScore = {
  id: number; // bigint
  house_nm: string;
  region_nm: string | null;
  mdatrgbn_nm: string | null;
  rcept_bgnde: string | null; // date
  rcept_endde: string | null; // date
  created_at: string | null;
  status: string | null;
  competition_rate_1st: number | null;
  price_per_pyeong: number | null;
  sale_price_min?: number | null; // s262-E: 만원 단위 최저 분양가
  house_ty?: string | null;        // s262-E: 평형 (e.g. '84A')
  thumbnail_url?: string | null;   // s262-E: 썸네일
  dday: number | null;
  score: number;
  reasons: IssueReason[];
  warning: IssueWarning | null;
  computed_at?: string;
};

// weights 테이블 row
export type IssueWeight = {
  factor: string;
  weight: number;
  version: string;
  description: string | null;
  updated_at: string;
};
