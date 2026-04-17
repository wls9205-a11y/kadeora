# 카더라 STATUS.md — 세션 113 (2026-04-17)

## 최근 배포
- **커밋**: 주식 마스터플랜 Phase 1 배포 중
- **이전 배포**: `656d0e4a` (SEO 전수조사)
- **프로덕션**: 정상 가동

## 이번 세션 완료 (28건)

### 주식 마스터플랜
- STOCK_MASTER_PLAN.md 18개 섹션 설계 문서
- sanitizeAiContent 투자자문 필터 + InvestmentDisclaimer
- DB 22개 테이블 마이그레이션 완료
- 해외주식 야간 크론 5종 (us-premarket/opening/closing/aftermarket/recap)
- DART 공시 파이프라인 (dart-ingest + dart-classify)
- 수급 시그널 엔진 (stock-flow-signals, 10개 레시피)
- 공매도/대차잔고 수집 (krx-short-selling)
- 실적 감지 (earnings-krx-realtime)
- 매크로 이벤트 (macro-event-detect)
- IPO 업데이트 (ipo-daily-update)
- 히어로 캐러셀 (StockHeroCarousel + stock-hero-refresh)
- /stock/signals, /stock/short-selling 신규 페이지
- /api/chart-image 동적 차트 API
- vercel.json 크론 14개 추가

## API 키
- ANTHROPIC ✅, CRON_SECRET ✅, STOCK_DATA ✅ / KIS ❌, FINNHUB ❌, DART ❌

## PENDING
- DART_API_KEY, FINNHUB_API_KEY 환경변수 추가 필요
- Phase 2: SEC EDGAR / IR 유튜브 / 종목 Q&A / 프로그래매틱 SEO
