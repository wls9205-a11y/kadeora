# 카더라 STATUS.md — 세션 56 (2026-03-30)

## 최신 커밋
- `d84e849` — 해외주식 인덱스 카드 수정 (SPY/QQQ/IWM)
- `9a35159` — 상세 페이지 디자인 V1 적용 + 하단 탭바 변경
- `904a790` — 블로그 콘텐츠 품질 대폭 업그레이드 (Sonnet 4)
- `45a97ca` — apt-price-sync TS 타입 에러 수정
- `09cff20` — 주식 시세 시스템 전면 안정화

## 이번 세션 주요 작업

### 1. 전체 사이트 진단 + 주식 시세 안정화
- stock-price 50% 실패 수정: DB open/high/low_price bigint → numeric
- 결과: **726/726 성공, 0 실패** (라이브 확인)
- stock-refresh USD limit(100→400) + 100개씩 배치 분할
- stock-crawl 디버그 정리, stock-news/flow 크레딧 에러 핸들링

### 2. 블로그 콘텐츠 품질 대폭 업그레이드
- 6개 크론 Haiku → **Sonnet 4**, max_tokens 5000
- blog-stock-deep: 2500자+, h2 5~6개, FAQ 자동 3개, PER/PBR/ROE
- safeBlogInsert 자동 커버 이미지 + image_alt
- SEO 유틸: meta_description h2 후 첫 문단, keywords 2026 연도

### 3. 상세 페이지 디자인 V1
- 주식: OG 3장 제거 → 시세 36px + 차트 90px 히어로
- 부동산: OG 4장 제거 → 그라디언트 히어로 140px (images 자동 교체)
- 피드: 인라인 OG 이미지 제거

### 4. 하단 탭바: 블로그 → 더보기(MoreHorizontal)
### 5. 해외주식: isIdx 심볼 기반 (SPY/QQQ/DIA/IWM/VOO/VTI)
### 6. 블로그 \\n 수정 (4,606편), GOD MODE 20개 병렬

## 라이브 확인 (2026-03-30 04:00 KST)
- ✅ stock-price 726/726, Anthropic 크레딧 OK
- ✅ 상세 디자인 V1, 탭바 더보기 적용
- ✅ 전 배포 READY

## 분양가 자동 수집 현황 (세션 55에서 설정)
- **347/2,692건 (12.9%)** 수집 완료 — 매시간 250건 자동 수집 중
- apt-crawl-pricing: maxDuration 300초, 매시간 크론
- apt-price-sync: 매일 03시, 3개 소스→apt_sites 싱크
- apt-backfill-details: 매일 04:30 (견본주택/주차/난방)
- **수집 완료 후** apt-crawl-pricing 스케줄 6시간으로 복원 필요

## PENDING
- [ ] blog Sonnet 품질 확인 (GOD MODE 실행)
- [ ] 종목 description 513개 (77% 누락)
- [ ] apt_sites 좌표/SEO 5,512개 누락
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] Google Search Console 사이트맵 제출

## 아키텍처 규칙
1. 블로그 데이터 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
