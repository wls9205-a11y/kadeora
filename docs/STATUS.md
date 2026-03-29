# 카더라 STATUS.md — 세션 55 (2026-03-30)

## 최신 커밋
- `526d06a` — 가격 데이터 자동 싱크 크론 (apt-price-sync)
- `329ff10` — 청약/미분양 리스트 카드 가격 시각화 강화
- `64ee429` — 아파트 단지 월별 시세 추이 SVG 차트
- `d87e040` — 지역 시세 비교 + 미공개 참고 시세

## 이번 세션 주요 작업

### 가격 시각화 대폭 강화
1. **📍 지역 시세 비교 포지션 바** (apt/[id])
   - 이 현장이 지역 내 어디에 위치하는지 3색 바에 마커
   - 지역 평균 대비 +/-% 배지 (고가/저가/평균)
2. **💰 분양가 미공개 참고 시세** (apt/[id])
   - 가격 없는 현장에도 지역 참고 시세 점선 카드
3. **📈 월별 시세 추이 차트** (apt/complex/[name])
   - 서버 렌더링 SVG (JS 불필요)
   - 그라디언트 에리어 필 + 등락률 배지
4. **청약 카드 분양가 표시** (SubscriptionTab)
   - house_type_info에서 최저~최고 분양가 + 평당가
5. **미분양 카드 가격 범위 바** (UnsoldTab)
   - sale_price 그라디언트 바 + 중앙 마커

### 가격 데이터 자동화 크론 (2개 신규)
1. **apt-crawl-pricing** — 청약홈 API에서 평형별 분양가 자동 수집
   - 매 6시간, 50건/배치, APT_DATA_API_KEY 필요
2. **apt-price-sync** — 3개 소스에서 apt_sites 가격 자동 채움
   - 매일 03시, apt_subscriptions + apt_transactions + unsold_apts

### DB 백필
- 실거래 데이터 → apt_sites price: 46건 자동 채움
- 현재 가격 커버리지: 2,296/5,512 (42%)

## PENDING — 수동 작업 (Node님)
- [ ] APT_DATA_API_KEY 설정 → apt-crawl-pricing + apt-backfill-details 활성화
- [ ] Anthropic 크레딧 충전 (블로그 크론 0건 생성 중)
- [ ] STOCK_DATA_API_KEY 갱신

## 크론 현황 (79개 → 81개)
- 신규: apt-crawl-pricing (6시간), apt-price-sync (매일)
