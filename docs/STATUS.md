# 카더라 STATUS.md — 세션 56 (2026-03-30)

## 최신 커밋
- `a04540c2` — 어드민 대시보드: 데이터 커버리지 패널 추가 (분양가/좌표/종목설명)
- `d84e849` — 해외주식 인덱스 카드 수정 (SPY/QQQ/IWM)
- `9a35159` — 상세 페이지 디자인 V1 적용 + 하단 탭바 변경
- `904a790` — 블로그 콘텐츠 품질 대폭 업그레이드 (Sonnet 4)

## 이번 세션 주요 작업

### 1. 어드민 대시보드 데이터 커버리지 패널
- API: dataCoverage KPI 쿼리 (aptPrice/aptCoords/stockDesc + apt-crawl-pricing 크론 이력)
- UI: 3열 커버리지 카드 (진행률 바 + 퍼센트 + 크론 상태 도트)
- 헬스바: 분양가/좌표/종목설명 HealthBadge 추가

## 라이브 확인 (2026-03-30)
- ✅ 크론 6h: 802성공 / 1실패 (apt-crawl-pricing 타임아웃)
- ✅ 블로그 24h: 74편 발행 (Sonnet 4 정상)
- ⚠️ 분양가: price_per_pyeong_avg 175/2,692 (6.5%) — 수집 느림
- ❌ apt_sites 좌표: 0/5,512 미착수
- ⚠️ 종목 description: 150/728 (20.6%)

## 분양가 자동 수집 현황
- **175/2,692건 (6.5%)** 수집 완료 — apt-crawl-pricing 타임아웃 발생 중
- apt-crawl-pricing: maxDuration 300초, 매시간 크론
- apt-price-sync: 매일 03시, 3개 소스→apt_sites 싱크
- apt-backfill-details: 매일 04:30 (견본주택/주차/난방)
- **수집 완료 후** apt-crawl-pricing 스케줄 6시간으로 복원 필요

## PENDING
- [ ] apt-crawl-pricing 타임아웃 해결 (배치 크기 축소)
- [ ] apt_sites 좌표/SEO 5,512개 누락
- [ ] 종목 description 578개 누락 (728-150)
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] Google Search Console 사이트맵 제출
- [ ] blog Sonnet 품질 확인 (GOD MODE 실행)

## 아키텍처 규칙
1. 블로그 데이터 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
