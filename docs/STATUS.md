# 카더라 STATUS.md — 세션 113 (2026-04-17)

## 최근 배포
- **커밋**: `3bd16422` (블로그 이미지 파이프라인 치명적 버그 수정 + 7장 구조 재설계)
- **빌드**: ✅ READY (`dpl_E5faXnGq4MXYJP8j3PmtMhs5Q1WP`)
- **프로덕션**: kadeora.app 정상 가동, 에러 0건

## 이번 세션 완료 (25건+)

### 치명적 버그 수정
1. **blog-generate-images LIKE 패턴 치명적 버그** — `'%/api/og?%'` vs 실제 `og-infographic` → **5,558건이 한 번도 처리 안 됐음** → 수정 후 04:00부터 100건/시간 자동 처리

### DB 정화 (프로덕션 실행 완료)
2. 경쟁사 도메인 이미지 삭제 (685→24장, 코드에서 자동 차단)
3. 단지간 3+ 중복 URL 제거 → **0개** (http/https 동일 취급)
4. NULL 336→0, blog_post_images infographic ~27,000행 삭제

### 크론 재작성 (3건)
5. `apt-image-crawl` 전면 재작성 — 블랙리스트 10패턴 + isRelevantToSite + RPC 중복방지 + BATCH 30 + 250초 타임아웃 가드
6. `blog-generate-images` 7장 구조 재설계 — pos 0~6 실사진 + pos 7 infographic + ignoreDuplicates false + BATCH 100
7. `batch-image-fix` LIKE 패턴 수정

### 프론트 버그 수정 (4건)
8. BlogHeroImage loadError/activeIdx 인덱스 혼동 → visibleWithOrigIdx + safeActiveIdx
9. AptImageGallery 데스크탑 onError 누락 + 전부-실패 폴백
10. next.config.ts 경쟁사 도메인(hogangnono) 제거
11. apt/builder/[name] 이미지 썸네일 추가

### null 렌더링 전수 점검 (8건)
12~19. compare, theme, ComplexClient, TransactionTab, DailyReportClient, daily-report-data (guPrices/hotDeals/unsoldLocal)

### 블랙리스트 강화
20. dcinside.(com|co.kr) 전체 + ppomppu + 네이버쇼핑 (양쪽 크론)

### DB 인프라
21. get_overused_apt_image_urls RPC 생성

## 현재 상태
| 지표 | 값 |
|---|---|
| 부동산 총 | 5,776 |
| 빈배열 (크론 대상) | 135 |
| 6~7장 달성 | 598 (10.4%) |
| 경쟁사 잔존 | 24 (코드 차단됨) |
| 중복3+ URL | **0** |
| 블로그 OG커버 | 5,558 (04:00부터 처리) |
| 블로그 실사커버 | 2,213 |
| blog_post_images 실사 | 9,009 |
| 에러 | 0건 |
| API 키 | ANTHROPIC ✅ CRON ✅ STOCK ✅ NAVER ✅ / KIS ❌ FINNHUB ❌ APT ❌ |

## PENDING
- apt-image-crawl 04:15 실행 확인 (연속 504로 Vercel이 비활성화 했을 수 있음)
- blog-generate-images 04:00 실행 → 5,558건 최초 처리 확인
- Resend webhook secret 미등록
- Toss Payments 상용 MID 전환
