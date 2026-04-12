# 카더라 SEO 최종 작업 설계안 — 압도적 1위 + 노출면적 극대화

> **작성일:** 2026-04-12
> **감사 범위:** 전체 28개 주식/부동산 페이지 + 인프라 44항목
> **목표:** 네이버/구글 검색 1위 + 검색결과 면적 3배 확장 + 스팸리스크 0

---

## I. 현재 상태 요약

### ✅ 이미 완료된 것 (상위 1% 수준)
- JSON-LD 22종 스키마 타입 사용 (BlogPosting, FAQPage, HowTo, Dataset, Event, FinancialProduct 등)
- robots.txt: Google/Naver/Bing/Daum/Zum/AI봇 개별 지시 (104행)
- 사이트맵: 21개 분할 + news-sitemap + image-sitemap
- RSS: 4개 (blog, stock, apt, feed.xml)
- OG 이미지: 6종 디자인 × 8카테고리 컬러 (1200×630 + 630×630)
- 보안: CSP, HSTS, X-Frame, Referrer-Policy, Permissions-Policy
- 접근성: skip-to-content, lang="ko", viewport 설정
- llms.txt, opensearch.xml, service worker, IndexNow
- Google/Naver/Bing/Daum 웹마스터 인증 완료
- isAccessibleForFree 구조화데이터 (게이팅 가이드라인 준수)

### ❌ 이번에 발견된 개선 항목: 총 25건

---

## II. 작업 목록 — 우선순위별

### 🔴 TIER 1: 코드 수정 (buildMeta + 공통 인프라) — 영향 범위 최대

| # | 작업 | 영향 범위 | 파일 |
|---|------|-----------|------|
| T1-1 | **buildMeta에 og-square 이미지 추가** | buildMeta 사용하는 모든 페이지 | `src/lib/seo.ts` |
| T1-2 | **buildMeta에 max-image-preview:large, max-snippet:-1 추가** | 동일 | `src/lib/seo.ts` |
| T1-3 | **buildMeta naver:written_time 고정** (publishedAt 없으면 빌드일 사용) | 동일 | `src/lib/seo.ts` |
| T1-4 | **buildMeta에 article:tag 지원 추가** | 동일 | `src/lib/seo.ts` |

**buildMeta 수정안:**
```typescript
// 추가할 내용:
// 1. images 배열에 og-square 추가
images: [
  { url: ogUrl, width: 1200, height: 630, alt: title },
  { url: `${SITE_URL}/api/og-square?title=${encodeURIComponent(title)}&category=${ogCategory || 'blog'}`, width: 630, height: 630, alt: title },
],

// 2. robots 추가
robots: noindex ? { index: false, follow: false } : {
  index: true, follow: true,
  'max-image-preview': 'large',
  'max-snippet': -1,
  'max-video-preview': -1,
},

// 3. naver:written_time 고정
'naver:written_time': publishedAt || '2026-04-01T00:00:00Z',
```

### 🔴 TIER 2: 개별 페이지 SEO 수정 — 직접적 순위 영향

| # | 작업 | 페이지 | 내용 |
|---|------|--------|------|
| T2-1 | **stock/compare SSR 전환** | stock/compare/page.tsx | `'use client'` → SSR wrapper + 클라이언트 인터랙션 분리. 네이버 Yeti JS 미실행 → 현재 빈 페이지 |
| T2-2 | **19개 페이지 og-square 추가** | 아래 목록 | openGraph.images에 630×630 이미지 추가 |
| T2-3 | **16개 페이지 max-image-preview 추가** | 아래 목록 | robots 메타에 max-image-preview:large 추가 |
| T2-4 | **stock/search 중복 metadata 통합** | stock/search/page.tsx | layout.tsx buildMeta와 page.tsx 직접 metadata 충돌 해소 |
| T2-5 | **6개 페이지 naver:description 추가** | dividend, movers, themes, market, map, search | other 객체에 추가 |
| T2-6 | **stock/compare, search에 JSON-LD 추가** | layout.tsx | WebPage + BreadcrumbList |
| T2-7 | **apt/unsold/[id] 불필요 DB쿼리 제거** | apt/unsold/[id]/page.tsx | redirect 전 generateMetadata 제거 |

**og-square 누락 페이지 (19개):**
stock/search, stock/data, stock/movers, stock/dividend, stock/themes, stock/[symbol]/vs/[target], stock/market/[code], apt/unsold/[id], apt/data, calc, calc/[category], guide, about, about/team, press, faq, home(root), login, (main)/layout.tsx

**max-image-preview 누락 페이지 (16+):**
stock/page, stock/[symbol], stock/sector, stock/search, stock/data, stock/movers, stock/dividend, stock/themes, stock/vs, stock/market, hot, guide, daily/archive, faq, home(root), login

### 🟡 TIER 3: 노출면적 극대화 — 검색결과 크기 3배

| # | 작업 | 효과 |
|---|------|------|
| T3-1 | **stock/dividend, movers, themes, market에 ItemList JSON-LD** | 네이버 캐러셀/리스트 스니펫 트리거 |
| T3-2 | **apt/complex 목록에 ItemList 추가** | 단지 검색 시 목록형 리치결과 |
| T3-3 | **stock/dividend, movers, themes에 SpeakableSpecification** | 음성검색 + Google Discover |
| T3-4 | **stock/sector/[name]에 CollectionPage 스키마** | "관련주" 검색 시 모음형 표시 |
| T3-5 | **모든 서브페이지 FAQ 강제 추가** (movers, themes에 없음) | FAQ 아코디언으로 면적 2-3배 |
| T3-6 | **Event 스키마에 offers 추가** (청약 접수 중) | 분양가 카드 형태 표시 |

### 🔵 TIER 4: 경쟁자 압도 — 차별화 전략

| # | 작업 | 효과 |
|---|------|------|
| T4-1 | **4개 주식 서브페이지 SSR 서술형 텍스트 추가** | D.I.A. 체류시간 증가 + Helpful Content |
| T4-2 | **apt→stock 크로스 내부 링크 (시공사→종목)** | 현재 0건 → 권위 분산 |
| T4-3 | **stock/[symbol]에 og-chart 차트 이미지** | 이미지 검색 탭 점령 (경쟁사 없음) |
| T4-4 | **Last-Modified 헤더 추가** (middleware) | 크롤러 "신선도" 인식 |
| T4-5 | **네이버 카페/블로그 자동 크로스포스팅 강화** | 네이버 블로그+카페 탭 동시 점령 |

### ⚪ TIER 5: 어드민 대시보드 업데이트

| # | 작업 | 탭 |
|---|------|-----|
| T5-1 | **FocusTab에 SEO 건강 점수 위젯 추가** | FocusTab |
| T5-2 | **SEO 누락 항목 실시간 카운터** (og-square 없는 글, naver:desc 없는 글) | FocusTab |
| T5-3 | **cover_image 카테고리 불일치 자동 감지** | OpsTab |

---

## III. 스팸 리스크 체크리스트

| 항목 | 상태 | 비고 |
|------|------|------|
| 클로킹 (봇 vs 유저 콘텐츠 차이) | ✅ 해소 | isAccessibleForFree + hasPart 추가 완료 |
| published_at 조작 | ⚠️ 주의 | 21,766편이 2025년 이전 날짜 — 리라이트 시 rewritten_at 사용 |
| AI 콘텐츠 대량 감지 | ⚠️ 진행중 | SEO_REWRITE_PLAN 실행으로 59K→15K 감축 예정 |
| 동일 템플릿 반복 | ⚠️ 진행중 | blog-prompt-diversity.ts로 템플릿 다양화 |
| foundingDate 불일치 | ✅ 해소 | 2024→2026 수정 완료 |
| RSS 이미지 타입 | ✅ 해소 | jpeg→png 수정 완료 |
| Schema markup 과다 | ✅ 안전 | 페이지당 7-9개는 Google 가이드라인 범위 내 |
| naver:written_time 매 요청 변동 | ❌ 미수정 | buildMeta + 6개 직접 metadata 페이지 |
| Keyword stuffing | ✅ 안전 | meta_keywords는 tags 기반, 자연스러운 수준 |
| Hidden text/links | ✅ 없음 | 검사 결과 0건 |
| Doorway pages | ✅ 안전 | redirect 페이지는 308 permanent redirect |
| Link schemes | ✅ 안전 | 부자연스러운 외부 링크 없음 |

---

## IV. 작업 순서 (논스톱 병렬처리)

```
Phase 1: 공통 인프라 (5분)
├── T1-1~4: buildMeta 수정 (seo.ts)
├── T2-7: apt/unsold redirect 정리
└── T4-4: middleware Last-Modified

Phase 2: 개별 페이지 SEO (15분)
├── T2-1: stock/compare SSR 전환
├── T2-2: 19개 페이지 og-square 추가
├── T2-3: 16개 페이지 max-image-preview 추가
├── T2-4: stock/search metadata 통합
├── T2-5: 6개 naver:description 추가
└── T2-6: JSON-LD 추가 (compare, search)

Phase 3: 노출면적 극대화 (10분)
├── T3-1~2: ItemList JSON-LD (dividend, movers, themes, market, complex)
├── T3-3: SpeakableSpecification 추가
├── T3-4: CollectionPage 추가
├── T3-5: FAQ 강제 추가
└── T3-6: Event offers 추가

Phase 4: 경쟁자 압도 (10분)
├── T4-1: SSR 서술형 텍스트 추가
├── T4-2: apt→stock 크로스 링크
└── T4-3: stock og-chart 이미지

Phase 5: 어드민 + 배포 (5분)
├── T5-1~3: 어드민 위젯 업데이트
├── git commit + push
├── Vercel 배포 확인
└── STATUS.md 업데이트
```

**예상 총 소요:** 45-60분 (병렬 처리)
**수정 파일 수:** ~40개
**리스크:** LOW (기능 변경 없음, SEO 메타데이터 추가만)

---

## V. 배포 후 검증

1. RSS 피드 검증 (blog/feed, stock/feed, apt/feed)
2. 구조화데이터 테스트 (Google Rich Results Test)
3. Vercel 런타임 에러 0건 확인
4. 네이버 서치어드바이저 크롤링 요청
5. IndexNow 수동 제출 (주요 페이지 20개)
6. Lighthouse SEO 점수 확인

---

## VI. 이 작업 이후 남는 것 (코드가 아닌 전략)

1. **SEO_REWRITE_PLAN 실행** — 59K→15K 콘텐츠 감축 (2-3주)
2. **도메인 나이** — 시간이 해결 (6-12개월)
3. **백링크 확보** — 부동산/금융 커뮤니티 인용 유도
4. **E-E-A-T 경험 증거** — 직접 촬영 이미지, 현장 방문기
5. **네이버 C-Rank 축적** — 지속적 크롤링 이력 축적
6. **사용자 반응 시그널** — 댓글, 공유, 체류시간 증가

---

## VII. 피드 페이지 개선안

### 현재 상태
- 570줄 FeedClient.tsx (클라이언트 컴포넌트)
- 카테고리 6개 (전체/주식/부동산/우리동네/자유/팔로잉)
- 정렬 3종 (최신/인기/댓글), 지역 필터, 해시태그 필터
- PullToRefresh, IntersectionObserver 무한스크롤, 30초 새 글 폴링
- BestCommentPreview, PostReactions, 이미지 갤러리

### 🔴 기능 문제 (사용성 직접 영향)

| # | 문제 | 영향 | 수정 방안 |
|---|------|------|-----------|
| F1 | **BestCommentPreview N+1 쿼리** | 댓글 3개 이상인 카드마다 개별 RPC 호출 → 30개 카드 = 30개 API 콜 | SSR에서 인기 댓글 미리 조인 or 한 번에 배치 fetch |
| F2 | **stock_tags → /stock 일반 링크** | `📈 삼성전자` 눌러도 /stock 메인으로만 이동 | `/stock/${symbol}` 직접 링크로 변경 (symbol 매칭) |
| F3 | **apt_tags → /apt 일반 링크** | `🏢 래미안` 눌러도 /apt 메인으로만 이동 | `/apt/${slug}` 직접 링크로 변경 |
| F4 | **readingTime 한국어 부정확** | `char count / 500` 사용 — 한국어는 문자수/350이 적절 | 500 → 350 변경 |
| F5 | **이미지 alt="게시글 이미지" 반복** | 모든 이미지에 동일 alt → 접근성+이미지 SEO 약화 | `alt={post.title || '게시글 이미지'}` |

### 🟡 디자인 문제 (사용 경험 저하)

| # | 문제 | 수정 방안 |
|---|------|-----------|
| F6 | **프로필 아바타 28px — 너무 작음** | 32-36px로 확대 (모바일 터치 타겟 44px 기준) |
| F7 | **폰트 사이즈 전체적으로 작음** (10-12px 다수) | 제목 14→15px, 본문 12→13px, 메타 10→11px |
| F8 | **카드 간 시각적 구분 약함** | gap 추가 or 카드 배경 미세 변화 (hover 시) |
| F9 | **글쓰기 버튼 피드에서 접근 어려움** | FAB(Floating Action Button) 추가 — 우하단 고정 |
| F10 | **카테고리 탭 스크롤 시 사라짐** | sticky 헤더로 카테고리+정렬 고정 |
| F11 | **트렌딩 키워드/실시간 인기글 없음** | 피드 상단에 `🔥 실시간` 카드 추가 (hot 페이지 연결) |
| F12 | **DailyReportCard 위치** | 첫 카드 전에 고정 — 매일 업데이트 콘텐츠가 보여야 체류시간 증가 |

### 🔵 SEO 문제

| # | 문제 | 수정 방안 |
|---|------|-----------|
| F13 | **naver:written_time = new Date()** | 고정값 사용 |
| F14 | **max-image-preview 없음** | robots 메타 추가 |
| F15 | **피드 게시글이 SSR로 렌더되나 SEO 가치 낮음** | 개별 포스트 페이지(/feed/[id])에 JSON-LD 추가 고려 |

---

## VIII. 더보기 (More) 메뉴 개선안

### 현재 상태
- 바텀시트 형태 (모바일), 드롭다운 (데스크탑)
- 4그룹: 투자 정보(5), 주식(2), 부동산(5), 설정(3) = 총 15개 아이템
- 4×N 그리드, 이모지 22px + 라벨 11px
- 하단: 테마 토글 + 프로필 + 알림 버튼

### 🔴 사용성 문제

| # | 문제 | 영향 | 수정 방안 |
|---|------|------|-----------|
| M1 | **터치 타겟 너무 작음** | 12px padding + 11px 라벨 = 약 38px 높이. iOS 가이드라인 44px 미달 | padding 16px + fontSize 12px으로 확대 |
| M2 | **주식 그룹에 2개만** (종목비교, 통계자료) | 배당주, 급등락, 테마주, 종목검색 등 누락 → 핵심 기능 접근 불가 | 주요 기능 추가: 배당주, 급등락, 테마주, 시장별 |
| M3 | **설명 텍스트 없음** | 이모지+2글자만으로는 기능 파악 어려움 (예: "📥 통계 자료"가 뭔지 모름) | 서브텍스트 1줄 추가 (회색, 작은 폰트) |
| M4 | **계산기가 투자 정보에 섞임** | 별도 그룹 "도구" or "계산기" 분리 | 그룹 재편: 투자정보 / 주식 / 부동산 / 도구 / 설정 |
| M5 | **검색 기능 없음** | 15개 아이템 중 원하는 것 찾기 어려움 | 상단에 검색 입력 or 최근 사용 표시 |

### 🟡 누락 항목

| # | 누락 기능 | 현재 접근 경로 | 추가 위치 |
|---|-----------|---------------|-----------|
| M6 | 배당주 TOP | /stock/dividend → URL 직접입력만 | 주식 그룹 |
| M7 | 급등락 종목 | /stock/movers → URL 직접입력만 | 주식 그룹 |
| M8 | 테마주 분석 | /stock/themes → URL 직접입력만 | 주식 그룹 |
| M9 | 종목 검색 | /stock/search → URL 직접입력만 | 주식 그룹 |
| M10 | 시리즈 블로그 | /blog/series → URL 직접입력만 | 투자 정보 그룹 |
| M11 | 서비스 소개 | /about → URL 직접입력만 | 설정 그룹 |
| M12 | FAQ | /faq → URL 직접입력만 | 설정 그룹 |
| M13 | 프레스/언론 | /press → URL 직접입력만 | 설정 그룹 |

### 🔵 디자인 개선

| # | 개선 방안 |
|---|-----------|
| M14 | 그룹별 아이콘 색상 통일 (투자=시안, 주식=파랑, 부동산=초록, 도구=보라, 설정=회색) |
| M15 | 최근 사용 기능 3개를 상단에 표시 (localStorage 기반) |
| M16 | 검색 바 추가 (아이템 필터) |
| M17 | 그리드 3열→4열 유지하되 아이템 높이 확대 (56→68px) |

---

## IX. 최종 작업 규모 (피드+더보기 포함)

| 영역 | 건수 |
|------|------|
| 공통 인프라 (buildMeta) | 4건 |
| 개별 페이지 SEO | 7건 |
| 노출면적 극대화 | 6건 |
| 경쟁자 압도 | 5건 |
| **피드 페이지** | **15건** |
| **더보기 메뉴** | **17건** |
| 어드민 업데이트 | 3건 |
| **총합** | **57건** |

### 작업 Phase 추가

```
Phase 6: 피드 페이지 (15분)
├── F1: BestComment 배치 fetch
├── F2-3: stock/apt 태그 직접 링크
├── F4-5: readingTime + alt 수정
├── F6-8: 아바타/폰트/카드 디자인
├── F9: FAB 글쓰기 버튼
├── F10: sticky 카테고리 헤더
├── F11: 트렌딩 카드
└── F13-14: SEO 수정

Phase 7: 더보기 메뉴 (10분)
├── M1-3: 터치타겟/항목추가/설명텍스트
├── M4: 그룹 재편 (5그룹)
├── M6-13: 누락 기능 8개 추가
├── M14-15: 색상통일/최근사용
└── M16-17: 검색바/높이조정
```

**예상 총 소요 (전체): 70-90분 논스톱 병렬처리**
**수정 파일 수: ~50개**

---

## X. 추가 발견 항목 (나머지 전체 페이지 + 인프라)

### 🔴 모바일 내비게이션

| # | 문제 | 영향 | 수정 |
|---|------|------|------|
| N1 | **모바일 하단탭에 블로그 없음** | 데스크탑: 피드/주식/부동산/블로그 4탭. 모바일: 피드/주식/부동산 3탭 + 글쓰기 + 더보기. 18K+ 블로그 콘텐츠가 모바일에서 2탭 거리 (더보기→블로그) | MOBILE_TABS에 블로그 추가 (글쓰기는 FAB로 이동) |
| N2 | **Link prefetch 0개** | Navigation에서 다른 탭으로 이동 시 prefetch 없어서 로딩 지연 | 주요 탭에 `prefetch={true}` 추가 |
| N3 | **알림 뱃지가 더보기 안에 숨겨짐** | 모바일에서 알림 확인하려면 더보기→알림. 실시간성 떨어짐 | 네비게이션 바에 알림 아이콘 직접 노출 |

### 🟡 페이지별 추가 SEO 결함

| # | 페이지 | 문제 | 수정 |
|---|--------|------|------|
| P1 | **/daily** | `'use client'` redirect — metadata 없음, noindex도 없음 | metadata + noindex 추가 (redirect 페이지) |
| P2 | **/daily/[region]** | H1 없음 (JSON-LD에만 제목 있고 HTML에 <h1> 없음) | SSR H1 추가 |
| P3 | **/discuss** | H1 없음 (DiscussClient가 클라이언트에서 렌더) | page.tsx에 SSR H1 추가 |
| P4 | **/search** | H1 없음 (SearchClient가 클라이언트에서 렌더) | page.tsx에 SSR H1 추가 |
| P5 | **/press** | JSON-LD 없음 | BreadcrumbList + WebPage 추가 |
| P6 | **/notifications** | `'use client'` — metadata 없음 | layout.tsx에 noindex metadata 추가 |
| P7 | **/hot** | og-square 1개만 (max-image-preview 없음) | max-image-preview 추가 |

### 🔵 성능/UX 개선

| # | 항목 | 현황 | 수정 |
|---|------|------|------|
| X1 | **next/image vs raw <img>** | 10개 파일 next/image, 13개 파일 raw <img>. 일부 페이지에서 CLS 발생 가능 | 외부 이미지가 아닌 경우 next/image 사용 통일 |
| X2 | **하드코딩 색상 50개 파일** | 다크모드에서 텍스트/배경 깨질 수 있음 | 점진적으로 CSS 변수 전환 |
| X3 | **loading="eager" 2개만** | LCP 후보 이미지에 eager 없으면 LCP 지연 | 각 페이지 히어로 이미지에 loading="eager" + fetchpriority="high" |
| X4 | **discuss 목록에 H1 없음** | 크롤러가 페이지 주제 파악 어려움 | SSR H1 추가 |

### 최종 총 작업 건수

| 영역 | 기존 | 추가 | 합계 |
|------|------|------|------|
| 공통 인프라 | 4 | 0 | 4 |
| 개별 페이지 SEO | 7 | 7 (P1~P7) | 14 |
| 노출면적 극대화 | 6 | 0 | 6 |
| 경쟁자 압도 | 5 | 0 | 5 |
| 피드 페이지 | 15 | 0 | 15 |
| 더보기 메뉴 | 17 | 0 | 17 |
| **내비게이션** | 0 | **3** (N1~N3) | **3** |
| **성능/UX** | 0 | **4** (X1~X4) | **4** |
| 어드민 업데이트 | 3 | 0 | 3 |
| **총합** | 57 | **14** | **71** |

### 업데이트된 작업 Phase

```
Phase 8: 나머지 페이지 SEO (5분)
├── P1: daily noindex
├── P2-4: daily/discuss/search H1 추가
├── P5: press JSON-LD
├── P6: notifications noindex
└── P7: hot max-image-preview

Phase 9: 내비게이션 개선 (10분)
├── N1: 모바일 탭에 블로그 추가 (글쓰기→FAB)
├── N2: Link prefetch
└── N3: 알림 뱃지 직접 노출
```

**최종 예상:** 90-120분, ~55개 파일, 한 번에 배포
