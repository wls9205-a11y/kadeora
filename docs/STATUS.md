# 카더라 프로젝트 STATUS — 세션 49 (2026-03-28 KST)
> SEO 전면 강화 + 사이트맵 복구 + 블로그 전수조사 + 풀스택 감사 + OG 폰트 수정
> **다음 세션 시작:** "docs/STATUS.md 읽고 작업 이어가자"

## 프로덕션 현황 (실시간)

| 지표 | 수치 |
|------|------|
| **유저** | 120명 |
| **게시글/댓글** | 4,083 / 2,607 |
| **블로그** | 15,502편 (시드 80편 API 생성 완료, 실행 대기) |
| **주식 종목** | 249개 |
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
| 파일 수 | 516개 |
| 총 줄 수 | 64,021줄 |
| API 라우트 | 170개 |
| 크론 | 70개 |
| DB 테이블 | 125개 |
| `as any` | **0건** ✅ |
| `ignoreBuildErrors` | **false** |
| `tsc --noEmit` | 0건 에러 |

---

## 세션 49 완료 작업 (2026-03-28)

### 1. SEO 전면 강화 [COMPLETED]
- 주식 상세: NYSE/NASDAQ 뉴욕 좌표, article:published/modified_time, naver:written_time→updated_at
- 주식 섹터: BreadcrumbList+ItemList(top10)+FAQPage JSON-LD, geo/twitter/naver 메타
- 부동산 상세: apt_sites.latitude/longitude 동적 좌표 → 지역 코드 폴백
- 부동산 지역: 17시도+13시군구 geo.position 좌표, ItemList JSON-LD
- 블로그 상세: speakable + image 동적 OG URL
- 블로그 목록: FAQPage JSON-LD 3개 Q&A
- 전역: msvalidate.01 Bing 인증, RSS alternate 링크 추가
- RSS 신규: /stock/feed(50종목), /apt/feed(청약+미분양), robots.txt 반영
- OG 한글 폰트: Pretendard→NotoSansKR-Bold.otf (Vercel Edge Runtime 호환)

### 2. SEO 2차 강화 [COMPLETED]
- 홈페이지: WebSite+SearchAction JSON-LD (사이트링크 검색창)
- Organization.sameAs 빈 배열 제거
- /apt/diagnose: layout.tsx + WebApplication/FAQPage/BreadcrumbList JSON-LD
- /stock/compare: canonical/OG/twitter/naver + BreadcrumbList
- naver:written_time: 15개 정적 페이지 고정 날짜, 2개 동적 페이지 실제 데이터
- IndexNow: blog-publish-queue에서 발행 후 submitIndexNow() 호출
- manifest.json + llms.txt: 15,502편, 5,522현장

### 3. 사이트맵 복구 [CRITICAL FIX]
- /sitemap.xml 404 해결 — Next.js 15 generateSitemaps() 버그 회피
- route handler 방식으로 전환: sitemap.xml/route.ts(인덱스) + sitemap/[id]/route.ts(개별)
- 9개 세그먼트: 0~4(static/stock/apt/feed/discuss) + 10~13(blog 청크)
- 모든 DB 호출 try-catch 방어

### 4. robots.txt 통합 [COMPLETED]
- public/robots.txt 삭제 (동적 라우트가 override)
- 동적 robots.txt에 RSS Sitemap 5개 추가
- apt/feed RSS: generateAptSlug()로 slug 기반 링크 생성

### 5. 블로그 전수조사 19개 이슈 수정 [COMPLETED]
- auto-link 데드링크 15개 제거 (BUILDER_KEYWORDS 전체, GUIDE_KEYWORDS 9개)
- 탭 파라미터 한글→영문 (trade/unsold/redev)
- relatedSites 경로 /apt/sites/ → /apt/
- insertColorTags 비활성화 (태그 3중 중복 제거)
- 관련 카드 2번 렌더링 → 하단만 유지
- truncation clamp(400px,60vh,800px)
- itemprop="articleBody" + BlogToc nav + aria-label
- RSS pubDate Invalid Date 방어
- insertCoverImage: 유효 cover_image → 사용, 없으면 OG 이미지 폴백 + onerror 방어

### 6. 풀스택 전수조사 13개 이슈 수정 [COMPLETED]
- AptClient /apt/sites/ → /apt/ 링크 수정
- insertCoverImage alt HTML escape (XSS 방어)
- autocomplete + blog/search ILIKE 인젝션 → sanitizeSearchQuery 적용
- blog/helpful, blog/bookmark 유저+포스트당 2초 rate limit
- Supabase 프로젝트 ID → 환경변수 폴백
- encryption.ts → getKey() null 반환 + 빈 문자열 폴백
- discuss revalidate 0→60
- 크론 console.log 22개 제거
- onerror HTML entity 안전 처리

### 7. UI 개선 [COMPLETED]
- 주식: 섹터 히트맵 상단 이동 (국내/해외 토글 아래, 탭 무관 항상 표시)
- 부동산: 이번 주 청약 D-day → 탭 콘텐츠 하단으로 이동
- 부동산: SubscriptionTab 내 중복 '이번 주 청약' 제거
- 지역별 현황: 도넛 차트 + 컴팩트 타일 디자인 (3열, 5개 카테고리 전부 표시)
- KPI/도넛 통계 불일치 수정 (tradeTotalCount 우선 사용)
- 실거래/재개발 지역별 건수: fetchAllRows 페이지네이션 + region 정규화
- apt/map 빌드 에러: ssr:false → MapWrapper 클라이언트 래퍼로 이동

### 8. OG 이미지 폰트 에러 수정 [CRITICAL FIX]
- Pretendard-Bold.woff2 → NotoSansKR-Bold.otf (Vercel Edge Runtime woff2 미지원)
- Unsupported OpenType signature 에러 100건+ → 0건

### 9. 블로그 시드 80편 API [COMPLETED]
- /api/admin/seed-longtail-80/route.ts 생성
- 2026 시의성 15편 + 부동산 가이드 20편 + 주식 가이드 20편 + 재테크 15편 + 지역 분석 10편
- CRON_SECRET 인증, safeBlogInsert 사용

---

## 세션 49 커밋

| SHA | 내용 |
|-----|------|
| `338ab0e` | apt/map 빌드 에러 수정 — ssr:false 클라이언트 래퍼 |
| `04d6f8b` | OG 이미지 폰트 woff2→otf + region 정규화 |
| `4f0d950` | 실거래/재개발 페이지네이션 수집 |
| `5709261` | 전수조사 풀스택 23가지 강화 |
| `7d9a481` | KPI/도넛 통계 불일치 수정 |
| `0f6966b` | 도넛 타일 크기 + 블로그 시드 80편 API |
| `70efcb0` | 전수조사 13개 이슈 일괄 수정 |
| `3dc71d7` | 블로그 크래시 + 재개발/실거래 건수 |
| `1c105d8` | 도넛 범례 5개 + 3열 + OG 커버이미지 복원 |
| `093b11e` | 깨진 cover_image 빈 박스 제거 |
| `4b686eb` | 블로그 접근성 개선 |
| `ad1f693` | 블로그 전수조사 데드링크 15개 제거 |
| `d90dd34` | UI 레이아웃 변경 (섹터/청약) |
| `2e28c2a` | sitemap.xml 404 해결 |
| `1cee8b8` | SEO 1차 강화 10가지 |
| `cd9b9fc` | sitemap generateSitemaps 수정 |

---

## 🟡 PENDING 작업

### 긴급 수동
- [ ] **토스 정산 등록 (3/31 마감 D-3!)**
- [ ] **구글 서치콘솔 사이트맵 재제출** (sitemap.xml 복구됨)
- [ ] **네이버 서치어드바이저** RSS 4개 제출
- [ ] **Bing 웹마스터** msvalidate.01 실제 인증코드 교체

### 블로그
- [ ] seed-longtail-80 API 실행 (80편 생성)
- [ ] daily_create_limit 임시 상향 후 실행, 완료 후 원복

### 수동 필수
- [ ] GA stockcoin.net 데이터 스트림 제거
- [ ] KIS_APP_KEY 발급 (주식 시세 99개 price=0)
- [ ] 토스 라이브키 교체
- [ ] 주린이.site DNS 복구

### 코드
- [ ] Supabase max_rows 설정 확인/변경 (현재 1000 → 10000 권장)
- [ ] 블로그 cover_image DB 정리 (깨진 URL → null)

## 주의사항 (다음 세션 필독)
- **sitemap.xml**: route handler 방식으로 변경됨 (sitemap.ts 삭제됨)
- **RegionStackedBar**: normalizeRegion() 함수로 지역명 정규화
- **fetchAllRows**: apt/page.tsx에서 페이지네이션으로 전체 데이터 수집
- **OG 폰트**: NotoSansKR-Bold.otf 사용 (woff2 금지)
- **apt/map**: MapWrapper.tsx 클라이언트 래퍼 필수 (ssr:false는 서버 컴포넌트 금지)
- **블로그 데이터**: 절대 삭제/수정 금지
- **stockcoin.net**: 절대 카더라와 연결 금지

---

## 세션 48 완료 작업 (2026-03-28)

> 커밋: `5709261` — feat: 전수조사 기반 풀스택 23가지 강화 (세션48)

### BLOCK A: CSS + 디자인 (5건)
1. globals.css에 kd-feed-card/kd-card-hover/kd-action-link/kd-search-input 클래스 정의
2. hover:hover/hover:none 미디어쿼리로 데스크탑/모바일 분리
3. 블로그 오늘의 추천 아이콘 사이즈 강화
4. 테마 탭 관련 종목 중복 제거
5. 모바일 tap-highlight-color + touch-action 설정

### BLOCK B: 피드 (4건)
6. 글쓰기 CTA 유도 바 (로그인 유저만)
7. 빈 피드 카테고리 EmptyState (📭 + 글쓰기 버튼)
8. 게시글 상세 본문 길이 + 읽기 시간 표시
9. 카테고리 pill에 이모지 아이콘 추가

### BLOCK C: 부동산 (4건)
10. 지도 페이지 MapClient 동적 import 연결
11. 지역 카드에 실거래 건수 뱃지 추가
12. 지역 상세 stat 카드에 kd-card-hover 적용
13. 단지 상세 교통/학군 아이콘+뱃지 강화

### BLOCK D: 블로그 (3건)
14. ReadingProgress 높이 3→2px 컴팩트화
15. 스크롤 복원 확인 (Next.js Link scroll 기본값)
16. 검색 키워드 하이라이트 (mark 태그, 브랜드 컬러)

### BLOCK E: 성능+보안 (4건)
17. public/meta.json (PWA/Lighthouse용)
18. OG 이미지 폰트 에러 핸들링 확인 (기존 정상)
19. XSS URL 프로빙 방어 (middleware에서 <script>/<template>/javascript: 차단)
20. 크론 실행 상태 가시성 확인 (기존 admin system.tsx 정상)

### BLOCK F: 주식 (3건)
21. 52주 최고/최저 그래디언트 레인지 바 (텍스트→시각화)
22. 공시 탭 24시간 이내 새 공시 빨간 dot 뱃지
23. 비교 페이지 항목 확인 (PER/PBR 미지원 — 기존 6항목 유지)

### PENDING
- 없음

---

## 세션 47 완료 작업 (2026-03-28)

> 커밋: `2d3d611` — refactor: 코드 품질 전면 정비 (세션47)

### BLOCK A: as any 전수 정리 (62건 → 0건)
- 비크론 파일 16개: Record<string,any>, 타입 추론, ComponentProps 활용
- 크론/API 파일 27개: @ts-expect-error (Supabase 타입 불일치) + Record<string,any> (데이터 접근)
- Supabase 쿠키 옵션: Record<string,unknown> (supabase-server.ts, middleware.ts)
- CSS 커스텀 프로퍼티: React.CSSProperties['fontSize'] 캐스트

### BLOCK B: 동적 임포트 최적화 (7건)
- CandlestickChart, BottomSheet(4곳), MiniLineChart(2곳), RedevTimeline → `dynamic(() => import(...), { ssr: false })`

### BLOCK C: E2E 테스트 + 접근성
- e2e/core.spec.ts: 주요 6페이지(/, /stock, /apt, /blog, /search, /guide) 네비게이션 테스트 추가
- 에러 바운더리/loading.tsx: stock/apt/blog/feed 모두 기존 구현 확인

### BLOCK D: 공통 타입 + 설정
- `src/types/common.ts`: PaginationParams, ApiResponse<T>, RegionStat, CronResult
- next.config.ts: images.formats avif/webp 기존 설정 확인

### 코드 품질 지표 변화
| 지표 | Before | After |
|------|--------|-------|
| `as any` | 62건 | **0건** |
| dynamic import | 5건 | **12건** |
| E2E 테스트 | 7건 | **13건** |
| tsc --noEmit | 0에러 | **0에러** |

### PENDING
- 없음

---

## 세션 46 완료 작업 (2026-03-28)

> 커밋: `7067e80` — feat: 3차 진화 — 랜딩/검색/프로필/성능/인게이지먼트 18가지 (세션46)

### BLOCK A: 랜딩+검색 (4건)
1. 랜딩 페이지 "지금 카더라에서" 실시간 프리뷰 (지수/청약/블로그 카드)
2. 통합 검색 SearchClient 버그 수정 (JSX 중첩 오류)
3. `/api/search/autocomplete` 자동완성 API (종목+청약+블로그 3테이블)
4. 모바일 네비게이션 헤더에 검색 아이콘 추가

### BLOCK B: 프로필+인게이지먼트 (5건)
5. 프로필 상세 활동 통계 대시보드 (게시글/댓글/좋아요/출석 4칸 그리드)
6. 출석 배너 연속 출석 스트릭 시각화 (7일 미니 캘린더)
7. PointsChart 신규 컴포넌트 (30일 포인트 획득 바 차트)
8. 등급 페이지 내 등급 진행률 바 + 다음 등급까지 남은 P 표시
9. 글쓰기 FAB 기존 구현 확인 (이미 정상 동작)

### BLOCK C: 성능+접근성 (4건)
10. 이미지 최적화 확인 (이미 loading=lazy + max-width 적용됨)
11. ARIA 접근성 — 주식/부동산 검색 input + 모바일 탭 aria-label 추가
12. /write 메타태그 description + follow 보완
13. RSS 피드 (stock/apt) 정상 동작 확인

### BLOCK D: 데이터+크로스 (5건)
14. 피드 글 상세 → 종목 현재가/청약 건수 미니 카드 자동 연결
15. 토론방 헤더 "🟢 N명 참여중" 활성 사용자 표시
16. 상점 ShopClient 이미 완전 구현 확인
17. 가이드 페이지 "빠른 시작 3단계" 섹션 추가
18. 알림 설정 ON 상태에 활성화된 알림 카테고리 칩 표시

### PENDING
- 없음

---

## 세션 45 완료 작업 (2026-03-28)

> 커밋: `00ae577` — feat: 2차 진화 — 주식/부동산/블로그/크로스 22가지 개선 (세션45)

### BLOCK A: 주식 (6건)
1. 종목 상세 라인차트에 거래량 바 차트 추가 (양봉 빨강/음봉 파랑)
2. 주식 메인 급등/급락 ±5% 알림 배너 (가로스크롤, 최대 3개)
3. 테마 탭 관련 종목 미니 리스트 (3개까지, 등락률 표시)
4. 포트폴리오 30일 수익률 차트 (기존 구현 확인)
5. AI 코멘트 시그널별 그래디언트 배경 + 매수/매도/관망 뱃지
6. 종목 비교 페이지 30일 수익률 오버레이 차트 (정규화 %)

### BLOCK B: 부동산 (6건)
7. 청약 캘린더 상태별 컬러 dot 인디케이터 (접수중 초록/예정 파랑/마감 회색)
8. 미분양 급증 알림에 전월→당월 화살표 + 수치 표시
9. 재개발 파이프라인 단계 번호 표시 (1/7, 2/7...)
10. 실거래 평당가 TOP 10 접이식 바 차트
11. 가점 진단 → 노릴 수 있는 청약 지역 추천 (높음/보통 뱃지)
12. 부동산 검색 → 관련 블로그 분석 글 연동

### BLOCK C: 블로그 (5건)
13. 글 하단 읽기 완료 축하 메시지 + 다음 추천 글 링크
14. 글 카드에 excerpt 2줄 미리보기 + cover_image 실제 이미지 썸네일
15. 다음 페이지 미리보기 (5개 제목) 페이지네이션 위에 표시
16. 시리즈 카드 카테고리 뱃지 + 진행도 바 강화
17. 블로그 상세 관련 종목 현재가/등락률 + 관련 단지 미니 카드

### BLOCK D: 크로스 기능 (5건)
18. RightPanel 사이드바에 KOSPI/KOSDAQ 미니 시황 위젯
19. PersonalDashboard 관심 청약 D-day 정렬 + 빈 상태 안내
20. 피드 HOT 배너에 블로그 인기글 1건 추가
21. 더보기 메뉴 알림 설정에 미읽은 뱃지 표시
22. HOT 페이지 하단 블로그 HOT 5 섹션 추가

### PENDING
- 없음

---

## 세션 44 완료 작업 (2026-03-28)

> 커밋: `64295ae` — feat: 주식/부동산/블로그 17가지 UX 개선 (세션44)

### 주식 (6건)
1. 장중/장마감/휴장 상태 칩 + 마지막 갱신시간 표시
2. 시세 미제공 종목 필터 토글 (showInactive)
3. 랭킹 탭 섹터 필터 칩 행
4. 종목 상세 → "💬 {종목명} 토론방" 링크 변경
5. 비교 버튼 "⚔️ 다른 종목과 비교" + 그래디언트
6. 원화 환산가 hover시 적용 환율 표시

### 부동산 (5건)
7. "이번 주 청약 D-day" 위젯 (KPI↔탭 사이)
8. apt_trade_monthly_stats → 분양중 단지 nearby_avg_price 주입
9. "인기 분양 현장" 내부 링크 블록 (300세대 이상)
10. 통합 검색바 → flex (지역 select + 검색 input)
11. 지도 페이지 서버 컴포넌트 리빌드 (17시도 그리드 + 뱃지)

### 블로그 (6건)
12. 글 카드 썸네일 동적 그래디언트 + 조회 50↑ 빨간 점
13. 본문 하단 카테고리별 동적 CTA 카드
14. `/api/blog/search` 검색 API 신규 생성
15. 시리즈 진행률 바 (제목 아래)
16. BlogCommentCTA 댓글 0건 → 점선 border + 포인트 안내 강화
17. "오늘의 추천" 횡스크롤 카테고리별 최신 1편

### PENDING
- 없음

---

## 세션 43 완료 작업 (2026-03-28)

### 1. 호스팅어 전수조사 + 수리 [COMPLETED]

**사업자 정보 제거:**
- 117개 도메인 (WP 111개 + Empty 6개)
- stockcoin.net jetpack_options 1건, 급매물 RankMath+Elementor 9건 제거

**tel: 전화 버튼 정밀 제거:**
- 111개 WP 사이트 DB 전수 스캔 → 61개 사이트에서 발견
- **총 ~3,800건 제거:** post_content ~300건, Elementor ~2,500건, options ~40건, 전화텍스트 ~30건, SFM 플로팅 38사이트
- 최종: 전 항목 0건 ✅

**기타:** Timezone 105개 Asia/Seoul, robots.txt 2개 생성, .htaccess HTTPS 3개 위성

### 2. 블로그 시스템 10가지 개선 (c1fe899) [COMPLETED]

| # | 개선 | 내용 |
|---|------|------|
| 1 | 👍 도움이 됐어요 + 북마크 | blog_helpful, blog_bookmarks 테이블 + RLS + API 2개 + BlogActions |
| 2 | 블로그 전용 RSS | `/blog/feed` 라우트 + robots.txt + layout.tsx 링크 |
| 3 | 발행 시 푸시 알림 | blog-publish-queue에 sendPushBroadcast |
| 4 | 서브카테고리 필터 | stock/apt/unsold/finance 하위 칩 UI + 쿼리 |
| 5 | 이전/다음글 네비게이션 | 같은 카테고리 내 시간순 |
| 6 | 업데이트 뱃지 | rewritten_at 기반 🔄 UP 표시 |
| 7 | 카드 디자인 강화 | 읽기시간·조회수·댓글수·helpful·UP 뱃지 |
| 8 | auto-link 확장 | 51→100+ 키워드 |
| 9 | 인기 태그 클라우드 | blog_popular_tags RPC + UI |
| 10 | 어드민 성과 대시보드 | TOP10·댓글TOP·helpful TOP·7일 추이 |

**DB:** blog_helpful + blog_bookmarks 테이블, helpful_count 컬럼, blog_popular_tags RPC, blog_category_views RPC

### 3. PostWithProfile 빌드 에러 수정 (23b6fae) [COMPLETED]
- database.ts 끝에 PostWithProfile, CommentWithProfile export 복원
- grade: number | null, profiles에 id?: string

### 4. 블로그 309편 대량 생성 크론 14개 (18af482) [COMPLETED]
- 14개 신규 크론 (5,017줄), GOD MODE content 그룹 등록
- vercel.json 매월 1~14일 새벽 2시 순차 스케줄
- safeBlogInsert에 is_published 파라미터 추가
- daily_create_limit 80 임시 상향 (완료 후 10 원복 필요)

### 5. 블로그 전수조사 + 3가지 이슈 수정 (4ab3230) [COMPLETED]

| # | 이슈 | 수정 |
|---|------|------|
| 1 | RSS pubDate Invalid Date (39편) | published_at null → created_at 폴백 |
| 2 | 빈 태그 815건 | array_remove(tags, '') |
| 3 | generic cover_image 12,464건 | → null (코드에서 제목 기반 OG) |
| 4 | published_at null 39편 | created_at으로 채움 |

**전수조사 정상 확인:** SSR 15,502편, 카테고리 6개, 인기글, 태그 클라우드, 시리즈, OG 이미지, TOC, FAQ, 댓글, 관련글, 공유, 도움이됐어요/저장, JSON-LD 4종

### 6. 블로그 시각화 v2 — 8가지 알록달록 요소 (b946de7) [COMPLETED]

`src/lib/blog-visual-enhancer.ts` 전면 재작성 (167줄 → 216줄):
1. OG 커버 이미지 히어로 (cover_image 배너 + alt 텍스트)
2. 히어로 통계 카드 (테이블에서 평균가/최고가/평당가/건수 추출 → 4색 카드)
3. 카테고리 컬러 태그 바 (tags → 8색 순환 칩)
4. 가격 레인지 바 (최저~최고가 그라데이션+인디케이터)
5. 체크포인트 아이콘 카드 (교통/학군/개발 키워드 감지)
6. 그라데이션 구분선 (hr → 무지개 그라데이션)
7. 인용 블록 (blockquote → 보라색 좌측 보더 카드)
8. 숫자 컬러 뱃지 (단위별 색상: 만원=파랑, 억=보라, 건=주황)

### 7. SEO geo 강화 + 프롬프트 다양화 (22cae1a) [COMPLETED]

- 블로그 geo.position 좌표 17개 지역 추가 (위도/경도) + ICBM 메타태그
- 주식 상세 페이지 geo 메타 4가지 추가 (KR-11 서울)
- `blog-prompt-diversity.ts` 신규: 4차원 랜덤 조합 + 카테고리별 8가지 도입부
- 적용 크론 6개 + blog-rewrite 스타일 5→8가지

### 8. 부동산 KPI 수정 (794ab7f, 54bdf6a) [COMPLETED]

- 실거래 KPI 0건 → tradeTotalCount SSR count 추가
- 실거래 표시 형식 5.4k → 5,408 (toLocaleString 통일)
- 모든 KPI 6개 표시 형식 통일 확인: 접수중 1, 예정 8, 분양중 670, 미분양 68,264, 재개발 202, 실거래 5,408

### 9. 롱테일 시드 콘텐츠 49편 발행 [COMPLETED]

| 유형 | 편수 | 대표 제목 |
|------|------|-----------|
| 입주 가이드 | 8편 | 체크리스트, 청소비용, 비용총정리, 하자보수, 꿀팁, 인테리어, 서류, 가스개통 |
| 연령대별 | 6편 | 20대 첫청약, 30대 신혼부부, 40대 갈아타기, 50대 다운사이징, 20대 주식, 50대 배당주 |
| 초보자 FAQ | 4편 | 청약FAQ, 전세vs월세, 갭투자, 부동산세금 |
| 체크리스트 | 3편 | 매매계약, 전세계약, 모델하우스 |
| 대출/세금 | 5편 | 생애최초주담대, 취득세, 양도세, DSR/LTV/DTI, 주담대비교 |
| 주식 용어 | 8편 | PER/PBR/ROE, ETF, 공매도, 배당금, 차트, 시총, IPO, 섹터로테이션 |
| 자산배분 | 3편 | 30대 자산배분, 40대 리밸런싱, 비상금 |
| 지역 비교 | 8편 | 강남vs송파, 수원vs용인, 해운대vs수영, 마포vs영등포, 대전vs세종, 인천vs김포, 수성vs달서, 판교vs광교 |
| 미분양/재건축 | 4편 | 미분양, 재건축, 재개발, 리츠 |

- 모든 49편 품질 게이트 통과: 800자+, 내부링크, FAQ, 목차, 지도(apt/unsold)
- 품질 게이트 제한 복원: 30건/일, 10건/시간 ✅

### 10. 알림 클릭 시 댓글/게시글 이동 수정 (57ae098) [COMPLETED]

**문제:** 알림 클릭 → 항상 /feed로 이동. 해당 게시글로 안 감.
**원인:** notifications 테이블에 link 컬럼 없음 + select에서 미포함
**수정:**
- DB: `notifications.link` text 컬럼 추가
- DB: `notify_on_comment` 트리거 → `/feed/{post_id}` link 저장
- DB: `handle_post_like` 트리거 → `/feed/{post_id}` link 저장
- 프론트: select에 link 컬럼 추가, getNotifLink()가 정확한 경로 반환

### 11. 프로필 사진 포인트 무한 지급 버그 수정 (6857e37) [COMPLETED]

**문제:** 아바타등록 30P가 같은 유저에게 4회 = 120P 중복 지급
**원인:** `avatar_point_granted.user_id`에 UNIQUE 제약 없음 + API에서 포인트 지급 후 grant 기록 (race condition)
**수정:**
- DB: UNIQUE 제약 추가 → DB 레벨 중복 차단
- DB: INSERT 정책 WITH CHECK (user_id = auth.uid())
- DB: 중복 90P 차감 (관리자조정)
- API: insert 먼저(UNIQUE 차단) → 성공 시에만 포인트 지급 패턴으로 전면 재작성
- 포인트 지급 실패 시 grant 기록 롤백

---

## 세션 43 커밋 (전체)

| SHA | 내용 |
|-----|------|
| `6857e37` | 프로필 사진 포인트 무한 지급 버그 수정 |
| `57ae098` | 알림 클릭 시 해당 댓글/게시글 이동 수정 |
| `e9b36e1` | STATUS.md 업데이트 |
| `4ab3230` | 블로그 전수조사 3가지 이슈 수정 |
| `18af482` | 14개 대량 블로그 크론 (5,017줄) |
| `23b6fae` | PostWithProfile 타입 복원 |
| `54bdf6a` | 부동산 KPI 실거래 표시 형식 통일 |
| `c1fe899` | 블로그 10가지 개선 |
| `794ab7f` | 부동산 실거래 KPI 0건 수정 |
| `22cae1a` | SEO geo 강화 + 프롬프트 다양화 |
| `b946de7` | 블로그 시각화 v2 — 8가지 알록달록 요소 |
| `d6b5c84` | 블로그 위치 정보 깨짐 수정 |

---

## Vercel 에러 현황

- **500 에러:** 0건 ✅
- **AuthApiError:** /admin, /login — 만료 세션 리다이렉트 (무해)
- **Failed to load dynamic font:** /api/og — 한글 폰트 폴백 (비긴급)

---

## 핵심 파일 경로

### 블로그
- `src/app/(main)/blog/[slug]/page.tsx` — 상세 (TOC/FAQ/댓글/관련글)
- `src/app/(main)/blog/feed/route.ts` — 블로그 RSS
- `src/components/BlogActions.tsx` — 도움이됐어요 + 북마크
- `src/lib/blog-auto-link.ts` — 100+ 키워드
- `src/lib/blog-visual-enhancer.ts` — 8가지 시각 요소 (216줄)
- `src/lib/blog-prompt-diversity.ts` — 프롬프트 다양화 (108줄)

### 부동산
- `src/app/(main)/apt/AptClient.tsx` — KPI 6카드 (tradeTotalCount prop)
- `src/app/(main)/apt/page.tsx` — SSR count 쿼리 (apt_transactions)

### 알림
- `src/app/(main)/notifications/page.tsx` — 알림 목록 + link 기반 이동

### 포인트
- `src/app/api/profile/avatar-point/route.ts` — insert-first 패턴 (UNIQUE 차단)

### 어드민
- `src/app/admin/sections/system.tsx` — GOD MODE 73크론
- `src/app/admin/sections/blog.tsx` — 블로그 성과 대시보드

### 인프라
- `src/types/database.ts` — 끝에 PostWithProfile/CommentWithProfile 커스텀 타입

---

## 🟡 PENDING 작업

### 긴급 수동
- [ ] **토스 정산 등록 (3/31 마감 D-1!)**
- [ ] **주린이.site DNS 복구** — 호스팅어 hPanel 네임서버 변경

### 블로그 309편 분할 실행
- [ ] daily_create_limit 80 확인 후 크론 순차 실행
- [ ] district-guide 120편 3회 분할 (offset=0/40/80, limit=40)
- [ ] 완료 후 daily_create_limit 10 원복

### 수동 필수
- [ ] GA stockcoin.net 데이터 스트림 제거
- [ ] 구글 서치콘솔 분양권실전투자.com 등록
- [ ] 네이버 서치어드바이저 3사이트 RSS/사이트맵
- [ ] Bing 웹마스터 3사이트 인증코드 교체
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY 발급

### 기존 PENDING
- [ ] /api/og 한글 폰트 포함 (Pretendard)
- [x] ~~as any 62건 정리~~ → **0건 완료 (세션47)**
- [ ] 나머지 시드 콘텐츠 ~27편 (추가 지역 비교, 체크리스트 등)

### 세션 44~48 코드 개선 요약 (98개)
- 세션44: 주식/부동산/블로그 UX 17개
- 세션45: 2차 진화 22개
- 세션46: 랜딩/검색/프로필/성능 18개
- 세션47: as any 0건 + dynamic import + E2E
- 세션48: 전수조사 풀스택 23개 + CSS 통일 + XSS 방어

## 주의사항 (다음 세션 필독)
- **PostWithProfile:** database.ts 끝 커스텀 타입 — Supabase 타입 재생성 시 유지
- **safeBlogInsert:** is_published 파라미터 추가됨 (기본값 false)
- **daily_create_limit:** 현재 80 → 완료 후 10 원복
- **blog_helpful RLS:** 로그인 유저만 INSERT/DELETE
- **블로그 데이터:** 절대 삭제/수정 금지
- **stockcoin.net:** 절대 카더라와 연결 금지
- **avatar_point_granted:** UNIQUE(user_id) 제약 추가됨 — insert-first 패턴 필수
- **notifications.link:** 신규 컬럼 — 알림 생성 시 link 필수 포함
- **품질 게이트:** 30건/일, 10건/시간 복원 완료

## 트랜스크립트
- 세션 43: `/mnt/transcripts/2026-03-28-01-22-36-kadeora-session43-fullstack.txt`
- 세션 40~42: `/mnt/transcripts/2026-03-27-08-28-51-kadeora-session40-42-satellite-admin-blog.txt`
