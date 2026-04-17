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

## 세션 114 (진행중) — 사이트맵/RSS SEO 전면 감사 + 수정

### 배경
GSC에서 `/blog/feed`, `/rss.xml`, `/feed.xml` 3개 사이트맵이 "오류 1개" + "알 수 없음" 유형으로 실패 (각 발견 페이지 0).

### 루트 원인 규명
1. **XML 속성 내 raw `&` 문자** — `cover_image` URL 5,613개 포스트가 `/api/og?title=...&design=2&category=...` 형태 (raw `&`). 이게 `<media:content url="...">`, `<enclosure url="...">` 속성 값으로 들어가면서 **XML 파싱 오류**. `xmllint`로 실증 확인 완료 (BEFORE fix → `EntityRef: expecting ';'`).
2. **tags 이스케이프 누락** — 태그 72개에 `&` 포함 (예: "R&D"). `<category>${t}</category>` 로 raw 출력.
3. **`/rss.xml`** — 코드 자체는 정상. GSC 캐시가 오래됨 (마지막 읽음 4/15). **GSC 재제출만으로 해결** 가능.

### 코드 수정 (브랜치: `fix/sitemap-seo-comprehensive`, 5 files +144/-17)

**1. `src/app/(main)/blog/feed/route.ts`**
- `escapeXml` import
- `cover_image`, `<link>`, `<guid>`, 태그 전부 이스케이프
- `author_name` 이스케이프

**2. `src/app/feed.xml/route.ts`**
- `<enclosure url="...">`, `<link>`, `<guid>` 이스케이프

**3. `src/app/sitemap.xml/route.ts`** (재작성)
- 블로그 청크 수 **동적 계산** (count 쿼리 → Math.ceil / 5000). 빈 청크 방지.
- FIXED_IDS_POST_BLOG = [12, 13, 14, 15, 16, 21] — 신규 4개 ID
- `news-sitemap.xml`을 index에 추가 (robots.txt엔 있었지만 index엔 없었음)

**4. `src/app/sitemap/[id]/route.ts`** (+86 lines)
- id=0 정적경로에 `/glossary`, `/stock/short-selling`, `/stock/signals`, `/premium` 추가
- id=1 쿼리에 `eq('is_active', true).gt('price', 0)` 필터 → 상장폐지/비활성 종목 제외
- **id=13** stock_glossary — 41 URL (용어사전)
- **id=14** daily_reports — 204 URL (지역별 히스토리)
- **id=15** stock chart pages — 1,805 URL
- **id=16** stock financials pages — 1,805 URL

**5. `src/middleware.ts`**
- matcher에 `sitemap/`, `rss.xml`, `feed.xml`, `image-sitemap.xml`, `news-sitemap.xml`, `blog/feed`, `stock/feed`, `apt/feed` 추가 → Googlebot 크롤 시 auth/CSP 불필요 (크롤 예산 절약)

### 검증
- TypeScript: 수정 파일 에러 0건 (stash 비교로 회귀 없음 확인)
- Next.js 빌드: `✓ Compiled successfully in 64s` + 타입 validity 통과
- **xmllint 실증**: BEFORE → invalid, AFTER → valid ✅

### 사이트맵 커버리지 증가분
| 신규 ID | URL 수 | 성격 |
|---------|--------|------|
| 13 glossary | 41 | 용어사전 |
| 14 daily 히스토리 | 204 | 지역×날짜 |
| 15 stock chart | 1,805 | 종목 차트 |
| 16 stock financials | 1,805 | 종목 재무 |
| 0 신규 정적 | 4 | short-selling/signals/glossary/premium |
| **합계** | **3,859 신규 URL** | |

### 배포 보류 상태 (유저 승인 대기)
- 5개 파일 커밋 완료, 푸시 안 함
- GSC 조치는 배포 후 실행: (a) `/rss.xml` 삭제 후 재제출, (b) `news-sitemap.xml`을 GSC에 신규 제출

