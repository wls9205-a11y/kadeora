# 카더라 STATUS.md — 세션 70 최종 (2026-04-04 KST)

## 세션 70 정보력 강화 요약

### DB RPC 신규 (10개)
1. `get_apt_rankings` — 단지 랭킹 5종 (상승/하락/거래량/전세가율/최고가)
2. `search_rent_transactions` — 전월세 209만건 검색
3. `get_rent_stats` — 지역별 전월세 통계
4. `get_stock_52w_range` — 52주 최고/최저
5. `get_unsold_trend` — 미분양 월별 추이
6. `get_exchange_rate_trend` — 환율 추이
7. `get_apt_price_trend` — 단지별 월별 매매 평균가
8. `get_apt_jeonse_trend` — 전세가율 추이
9. `get_nearby_apt_compare` — 주변 단지 비교
10. `get_stock_ma` — 이동평균선 (MA5/20/60)

### 데이터 계산
- `price_change_1y`: 2,291단지 1년 가격변동률 (상승1,247 / 하락1,029)
- `apt-price-change` 크론: 매일 04:30 자동 재계산

### Public API 엔드포인트 (10개)
apt-rankings · rent-search · unsold-trend · exchange-trend · stock-52w · landmark-apts · apt-price-trend · apt-jeonse-trend · apt-nearby · stock-ma

### 신규 컴포넌트 (7개)
| 컴포넌트 | 위치 | 기능 |
|----------|------|------|
| AptRankingCard | /apt | 5종 랭킹 TOP 10 |
| LandmarkAptCards | /apt | 대장 아파트 시세 |
| UnsoldTrendMini | /apt | 미분양 추이 바차트 |
| ExchangeRateMiniChart | /stock | 환율 스파크라인 |
| Stock52WeekBar | (기존) | 52주 가격범위 |
| AptNearbyCompare | /apt/complex/[name] | 주변 단지 비교 테이블 |
| StockMAOverlay | /stock/[symbol] | 이동평균선 토글 차트 |

### 블로그 가독성 개선
- 6가지 코드 노출 수정 (**, ~취소선, ## 목차, Q&A H2, H1 중복)
- CSS 전면 개선 (line-height, 테이블, 라이트모드, 모바일)
- blog-rewrite 프롬프트 강화

### SQL 즉시 재작성 (4,175편)
- 1,500자 미만 → 0편 달성

## 인프라 현황
- 블로그: 22,663편 / 크론: 97개 / API: 10개
- TS 에러: 0 / 빌드: READY / 런타임 에러: 0
