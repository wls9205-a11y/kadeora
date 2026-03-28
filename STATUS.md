# 카더라 프로젝트 STATUS — 세션 51 (2026-03-29 KST)
> SEO 포털 노출 극대화 + 어드민 대시보드 종합 + 이미지 캐러셀 + 전체 10/10 만점
> **다음 세션 시작:** "docs/STATUS.md 읽고 작업 이어가자"

## 프로덕션 현황 (실시간)

| 지표 | 수치 |
|------|------|
| **유저** | 120명 |
| **게시글/댓글** | 4,083 / 2,607 |
| **블로그** | 18,522편 (cover_image 전편 보유) |
| **주식 종목** | 728개 (KOSPI 212 / KOSDAQ 152 / NYSE 222 / NASDAQ 142) |
| **price_history** | 25,198행 (726종목) |
| **청약** | 2,692건 |
| **apt_sites (active)** | 5,522 |
| **실거래** | 5,408건 |
| **미분양** | 180건 (68,264세대) |
| **재개발** | 202건 |
| **DB 크기** | 227 MB |
| **프로덕션 에러** | 0건 ✅ |

## 코드베이스

| 지표 | 수치 |
|------|------|
| 파일 수 | 535개 |
| 페이지 | 57개 |
| API 라우트 | 180개 |
| 크론 | 78개 |
| DB 테이블 | 127개 |
| `as any` | **0건** ✅ |
| `ignoreBuildErrors` | **false** |
| 최신 커밋 | `559a2ce` (main) |

---

## 세션 51 완료 작업 (2026-03-29)

### 1. SEO 포털 노출 극대화 — 전체 10/10 만점 [COMPLETED]

#### 10점 체크리스트 (전 10개 상세 페이지 충족)
1. ✅ `<article>` 시맨틱 래퍼
2. ✅ `<img>` 히어로 이미지 (포털 썸네일 소스)
3. ✅ JSON-LD 구조화 데이터
4. ✅ `naver:author` 메타
5. ✅ `og:updated_time` 메타
6. ✅ 가시적 브레드크럼 (홈›카테고리›현재)
7. ✅ FAQPage 리치스니펫
8. ✅ `<time>` 시맨틱 타임스탬프
9. ✅ `<h1>` 페이지 제목
10. ✅ `<h2>` 섹션 제목

#### 페이지별 SEO 점수
```
💯 stock/[symbol]       10/10  JSON-LD 6개, img 3장
💯 apt/[id]             10/10  JSON-LD 9개, img 3장
💯 blog/[slug]          10/10  JSON-LD 4개, img 2장
💯 feed/[id]            10/10  JSON-LD 3개
💯 discuss/[id]         10/10  JSON-LD 3개
💯 stock/sector/[name]  10/10  JSON-LD 3개
💯 apt/region/[region]  10/10
💯 apt/complex/[name]   10/10
💯 hot                  10/10
💯 premium              10/10  JSON-LD 4개
```

#### 서버 렌더링 (크롤러용 텍스트)
- 주식: 뉴스 5건 + 수급 동향 + 공시 3건 서버 렌더링 (클라이언트 탭과 이중)
- 부동산: 주변 시설 칩 렌더링 + 실거래 텍스트 요약 (건수/범위/평균)
- 부동산: FAQ 자동 생성 (DB 비어있을 때 4개 → 전 현장 적용)

#### 이미지 캐러셀 (포털 이미지탭 활성화)
- 주식: 3장 이미지 그리드 (2:1 레이아웃) + ImageGallery JSON-LD
- 부동산: DB 실사 우선 3장, 없으면 OG 3장 + ImageGallery JSON-LD
- 블로그: cover_image + og-square(630×630) 이중 등록
- 이미지 사이트맵: 주식 728종목 OG 이미지 전체 등록

#### 구조화 데이터 강화
- 주식: +Dataset JSON-LD (Google Dataset Search 노출)
- 부동산: +Place JSON-LD + GeoCoordinates (지도 연동)
- 프리미엄: +FAQPage +BreadcrumbList (신규)

#### 목록 + 유틸 페이지 메타 완비 (9개)
- stock/apt/blog/feed/discuss 목록 + 홈 + search + guide + faq
- 전체 `naver:author` + `og:updated_time` 100% 커버리지

### 2. 어드민 대시보드 종합 컨트롤 센터 [COMPLETED]

#### API 확장 (`src/app/api/admin/dashboard/route.ts`)
- `blogProduction`: 오늘 발행/미발행 큐/발행 가능/카테고리 분포
- `commentStats`: 오늘 댓글/전체 대댓글 수
- `cronByCategory`: blog/stock/apt/system 4개 카테고리별 성공/실패/생산건수

#### UI 신규 패널 (`src/app/admin/sections/dashboard.tsx`)
- ⚡ 전체실행 버튼 (GOD MODE full 즉시 트리거, 펄스 애니메이션, 경과시간, 인라인 결과)
- 카테고리별 빠른실행 5개 (데이터/가공/AI/콘텐츠/시스템)
- 📰 블로그 생산 현황 (3칸 KPI + 카테고리 분포 바 + 리라이팅 진행률)
- 💬 댓글 & 크론 현황 (2칸 KPI + 크론 카테고리별 프로그레스 바)
- 📊 어제 대비 증감 요약 바 (PV/글/댓글/신규유저 + 주간 PV/UV)
- 🔄 자동발행 파이프라인 시각화 (크론수집→AI생성→발행큐→발행완료 4단계)
- KPI 6→8카드 (블로그/주식/부동산 추가, 4열 그리드)
- Quick Actions 12개
- 헬스 배지: 블로그 오늘 발행, 댓글, AI 크레딧 부족

### 3. 기타 개선 (다른 PC 병렬 작업 포함) [COMPLETED]
- 검색바 UX: `/` 키보드 단축키 + 힌트 텍스트
- 출석체크 배너: 7일 프로그레스 바 + 보상 단계
- ReadingProgress: 3px 그라디언트 바 + 우상단 퍼센트
- ScrollToTop: SVG 진행률 링
- 본문 URL/해시태그 자동 링크 (content-renderer.tsx)
- 블로그 본문 타이포그래피 강화 (여백/색상/blockquote/marker)
- 랜딩 라이브카드 + 헤더 글래스모피즘 + CTA 글로우보더
- 피드 CTA 카드 리디자인 + 주식 펄스도트
- IndexNow 대량전송 크론 + SSG 정적생성 + preconnect
- 프리미엄 멤버십 랜딩 + 백엔드 인프라

---

## 크론 현황 (78개)

| 카테고리 | 수 | AI 사용 |
|---------|-----|---------|
| 📝 블로그 | 37개 | 15개 (크레딧 부족→생성 0건) |
| 📈 주식 | 7개 | - |
| 🏢 부동산 | 14개 | - |
| ⚙️ 시스템/기타 | 20개 | - |

**핵심 크론:**
- `blog-publish-queue` → DB `blog_publish_config.daily_publish_limit` 조절
- `indexnow-mass` → 미인덱싱 블로그 500개/6시간 순차 전송
- `stock-crawl` → basDt 파라미터 수정 완료 (수집 정상화)

---

## SEO 인프라 현황

| 항목 | 상태 |
|------|------|
| JSON-LD 스키마 | 13종 (WebPage, FinancialProduct, Article, FAQPage, BreadcrumbList, ImageGallery, ApartmentComplex, RealEstateListing, Event, Product, HowTo, Dataset, Place) |
| 사이트맵 | 분할 사이트맵 (stock/apt/blog/feed/discuss/static) |
| 이미지 사이트맵 | apt_sites + blog 18,522편 + stock 728종목 |
| RSS | 4개 (stock/feed, apt/feed, blog/feed, feed.xml) |
| IndexNow | 크론 정기 실행 (7일 범위, limit 100) + 대량 전송 (500/6h) |
| OG 이미지 | 디자인 6종 (?design=1~6) + og-square 630×630 |
| robots.txt | 동적 생성 (API/admin 차단, og/og-square 허용) |
| SSG | 블로그 200편 + 주식 728종목 정적 생성 |

---

## API 키 현황

| 키 | 상태 | 비고 |
|----|------|------|
| ANTHROPIC_API_KEY | ⚠️ 크레딧 부족 | console.anthropic.com 충전 필요 |
| CRON_SECRET | ✅ | |
| STOCK_DATA_API_KEY | ✅ | basDt 수정 완료 |
| KIS_APP_KEY | ❌ 미발급 | apiportal.koreainvestment.com |
| FINNHUB_API_KEY | ❌ 미발급 | finnhub.io |

---

## 포털 노출 현황

| 포털 | 상태 | 비고 |
|------|------|------|
| Google | ⏳ 대기 | 도메인 연령 부족, 코드/메타 이상 없음 |
| Naver | ⏳ 대기 | 서치어드바이저 등록 완료 |
| Daum | ⏳ 대기 | daum:site_name 메타 적용 |
| Bing | ⏳ 대기 | msvalidate.01 인증코드 적용 |

---

## 수동 작업 (PENDING)

- [ ] **토스 정산 등록 (3/31 마감!)**
- [ ] Anthropic 크레딧 충전 (console.anthropic.com)
- [ ] KIS_APP_KEY 발급 (주식 실시간 시세)
- [ ] 구글 서치콘솔 사이트맵 재제출 + URL 색인 요청
- [ ] 네이버 서치어드바이저 RSS 4개 제출
- [ ] Bing 웹마스터 msvalidate.01 인증코드 교체

---

## 주요 파일 경로

### 상세 페이지 (전체 10/10)
- `src/app/(main)/stock/[symbol]/page.tsx` (450줄)
- `src/app/(main)/apt/[id]/page.tsx` (625줄)
- `src/app/(main)/blog/[slug]/page.tsx` (730줄)
- `src/app/(main)/feed/[id]/page.tsx` (540줄)
- `src/app/(main)/discuss/[id]/page.tsx`
- `src/app/(main)/stock/sector/[name]/page.tsx`
- `src/app/(main)/apt/region/[region]/page.tsx`
- `src/app/(main)/apt/complex/[name]/page.tsx`
- `src/app/(main)/hot/page.tsx`
- `src/app/(main)/premium/page.tsx`

### 핵심 인프라
- 어드민 대시보드 API: `src/app/api/admin/dashboard/route.ts`
- 어드민 대시보드 UI: `src/app/admin/sections/dashboard.tsx`
- GOD MODE: `src/app/api/admin/god-mode/route.ts`
- OG 이미지: `src/app/api/og/route.tsx` (Node.js 런타임, Edge 전환 금지)
- OG 정사각: `src/app/api/og-square/route.tsx`
- IndexNow: `src/lib/indexnow.ts`, `src/app/api/cron/indexnow-mass/route.ts`
- 이미지 사이트맵: `src/app/image-sitemap.xml/route.ts`
- 콘텐츠 렌더러: `src/lib/content-renderer.tsx`

### 사이트맵/RSS
- `src/app/sitemap.xml/route.ts`, `src/app/sitemap/[id]/route.ts`
- `src/app/(main)/stock/feed/route.ts`
- `src/app/(main)/apt/feed/route.ts`
- `src/app/(main)/blog/feed/route.ts`
- `src/app/feed.xml/route.ts`

---

## 아키텍처 규칙 (불변)

1. **블로그 데이터**: 절대 삭제/수정 금지 (명시적 지시 없이)
2. **stockcoin.net**: 절대 카더라와 연결 금지
3. **포인트**: RPC로만 수정 (직접 UPDATE 금지)
4. **CSP**: middleware.ts에서만 관리
5. **크론 에러 핸들러**: 항상 200 반환
6. **OG 폰트**: Node.js fs.readFileSync (Edge 전환 금지)

---

## 세션 51 커밋 히스토리

| SHA | 상태 | 내용 |
|-----|------|------|
| `b99f7f8` | ✅ | 주식·부동산 가시적 요약+FAQ 자동생성+메타 |
| `43ec696` | ✅ | 서버렌더링+브레드크럼+FAQ본문+태그링크 |
| `aa1270a` | ✅ | 블로그·피드·토론 브레드크럼+메타+태그 |
| `6c3b673` | ✅ | 히어로 이미지 3페이지 |
| `b5f1edd` | ✅ | IndexNow 대량전송+SSG+preconnect (다른PC) |
| `c6534fb` | ✅ | 이미지 캐러셀+ImageGallery+사이트맵 |
| `d4643d1` | ✅ | 주변시설+실거래 텍스트 요약 |
| `1d348f9` | ✅ | 전체 9페이지 💯 10/10 만점 (핫픽스 포함) |
| `a330d4a` | ✅ | 목록+홈 메타 완비+Dataset+Place JSON-LD |
| `559a2ce` | ✅ | 프리미엄 10/10 만점 |
