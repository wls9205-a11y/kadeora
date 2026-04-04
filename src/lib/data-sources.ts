/**
 * 데이터 출처 단일 진실 공급원
 * 
 * 이용약관, Disclaimer, 블로그 면책문 등에서 참조
 * 사용자에게 공개되는 텍스트는 PUBLIC_SOURCES 사용
 */

export const DATA_SOURCES = {
  /** 주식 종목 목록/시총 — 금융위원회 공공데이터 */
  stock_listing: { provider: '금융위원회', url: 'data.go.kr', label: '금융위원회 공공데이터 API' },
  /** 주식 시세 (국내) — 공공 금융 데이터 */
  stock_price_kr: { provider: '공공 금융 데이터', label: '공공 금융 데이터 API' },
  /** 주식 시세 (해외) — Yahoo Finance */
  stock_price_us: { provider: 'Yahoo Finance', label: 'Yahoo Finance API' },
  /** 청약 정보 */
  apt_subscription: { provider: '공공데이터포털', url: 'data.go.kr', label: '공공데이터포털 (data.go.kr)' },
  /** 실거래가 */
  apt_trade: { provider: '국토교통부', label: '국토교통부 실거래가 공개시스템' },
  /** 미분양 */
  apt_unsold: { provider: '국토교통부', label: '국토교통부 미분양주택현황' },
  /** 재개발 */
  redev: { provider: '서울시·경기도·부산시', label: '서울시·경기도·부산시 공공데이터' },
  /** 단지백과 */
  complex: { provider: '국토교통부·KAPT', label: '국토교통부·한국부동산원' },
} as const;

/** 사용자 공개용 요약 텍스트 */
export const PUBLIC_SOURCE_TEXT = {
  stock: `${DATA_SOURCES.stock_listing.label} · ${DATA_SOURCES.stock_price_us.label}`,
  apt: `${DATA_SOURCES.apt_subscription.label} · ${DATA_SOURCES.apt_trade.label}`,
  unsold: `${DATA_SOURCES.apt_unsold.label} · 매월 말 발표 기준`,
  redev: `${DATA_SOURCES.redev.label} · 매주 월요일 갱신`,
  trade: `${DATA_SOURCES.apt_trade.label} 기준`,
  general: `청약: ${DATA_SOURCES.apt_subscription.label} · 미분양: ${DATA_SOURCES.apt_unsold.provider} · 실거래: ${DATA_SOURCES.apt_trade.provider} · 주식: ${DATA_SOURCES.stock_listing.provider} · 재개발: ${DATA_SOURCES.redev.provider}`,
} as const;

/** 이용약관/블로그 면책문용 */
export const TERMS_SOURCE_TEXT = `주식: ${DATA_SOURCES.stock_listing.label} · 해외시세: ${DATA_SOURCES.stock_price_us.label} · 청약: ${DATA_SOURCES.apt_subscription.label} · 실거래: ${DATA_SOURCES.apt_trade.label}`;
