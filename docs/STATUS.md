# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-13 (세션 96 — DB 컬럼 전면 수정 + 이슈선점 자동발행 보장 + IssueTab v2)

## 세션 96 — DB 컬럼 버그 전면 수정 + 이슈선점 자동발행 + 어드민 IssueTab v2

### 배포: 1 커밋, 12파일

### 🔴 DB 컬럼 불일치 수정 (크론 실패 근본 원인)
- **admin/v2**: `attendance.select('id')` → `'user_id'` — 출석 카운트 정상화
- **blog-stock-v2**: `close` → `close_price` (select + 계산 3곳 + 테이블 출력)
- **stock/ai-analysis**: `p.close` → `p.close_price`
- **data/stock-history**: `open,high,low,close` → `open_price,high_price,low_price,close_price`
- **blog-apt-v2**: `unsold_count` → `tot_unsold_hshld_co`, `t.area` → `t.exclusive_area`
- **blog-monthly-market**: `u.unsold_count` → `u.total_unsold` (unsold_monthly_stats 테이블)
- **daily-report-data**: `post_polls.title/total_votes` → 실제 컬럼(id, post_id, expires_at)

### 🟠 polls/route.ts 전면 재설계
- `post_polls` 실제 스키마로 재작성 — question은 posts.title 조인, options는 poll_options 조인

### 🟡 이슈선점 자동발행 보장
- `issue.is_auto_publish` 조건 **완전 제거** (항상 null → 자동발행 차단 버그)
- score threshold `|| 60` → `?? 40` (DB 설정값 반영)

### 🟡 504 타임아웃 방지
- blog-tax-guide, blog-regional-analysis: maxDuration 300→60, MAX_AI_CALLS 3→1

### 📊 IssueTab v2
- 파이프라인 시각화, 지금실행 버튼, 조건 명시, 오늘 발행 카운트

> 마지막 업데이트: 2026-04-13 (세션 95 — CTA 통합 + SEO 전방위 감사 + 버그 수정)

## 세션 95 — CTA 추적 통합 + 다크모드 수정 + 어드민 피드 메트릭 + CTA 최적화

### 배포: 1 커밋, 10파일, 96줄 추가

### 🔴 Critical Fix
- **CTA 이중 추적 통합**: `trackCTA()` (analytics.ts) → `user_events`만 전송하던 것을 `conversion_events`에도 동시 전송. SmartSectionGate/ActionBar/KakaoHeroCTA의 어드민 CTA 데이터 단절 해결
- **로그인 BOM 제거**: `login/page.tsx` + `LoginClient.tsx`에 UTF-8 BOM(EF BB BF) 존재 → 500 에러 원인 가능성 제거

### 🟡 Bug Fix
- **BlogTossGate 다크모드**: 그라디언트 `#F5F6F8`(라이트) → `var(--bg-base, #050A18)` (다크 호환)
- **ActionBar 가짜 소셜프루프**: "2,847명이 매일 카더라로 시작합니다" → "스팸 없음 · 3초 가입 · 전체 분석 무료"
- **한마디(short) 빈 title**: `title: ''` → `title: text.slice(0, 30)` — 검색/목록 표시 정상화

### 📊 어드민 개선
- **GrowthTab**: 피드 커뮤니티 섹션 추가 (투표/VS/예측/한마디 콘텐츠 수 + 투표 수 + 활성/미결 현황)
- **FocusTab**: 피드 커뮤니티 4칸 요약 카드 추가 (접힌 상태 기본)
- **v2 API**: growth 탭에 `feedStats` 쿼리 추가 (9개 병렬 카운트)

### 🎯 CTA 최적화
- **BlogMidCTA 중복 제거**: 비로그인 블로그에서 SmartSectionGate(CTR 0.86%) 아래 BlogMidCTA(CTR 0.71%, 2클릭) 제거 → CTA 피로도 감소
- **RelatedContentCard**: `showSignup={false}` — 가입 CTA를 SmartSectionGate + ActionBar에 집중

### CTA 성과 분석 (7일 기준)
| CTA | 노출 | 클릭 | CTR |
|-----|------|------|-----|
| content_gate | 1,632 | 14 | 0.86% |
| action_bar_kakao | 608 | 10 | 1.64% |
| inline_cta | 536 | 3 | 0.56% |
| blog_mid_cta | 281 | 2 | 0.71% |
| login_gate_apt | 243 | 0 | 0% |

### DB 상태 확인
- `point_reason` 한글 enum 28개 ✅ 정상 (투표생성/투표참여/VS생성/VS참여/예측생성/예측참여/예측적중/한마디작성 포함)
- 피드 6개 신규 테이블 ✅ 존재 확인
- `conversion_events` + `user_events` 양쪽 CTA 데이터 확인

### ⚠️ 모니터링 필요
- 로그인 500 에러: stale build 경로(`build-20260318`) 요청 — BOM 제거 후 해소 여부 확인
- safeBlogInsert: 크론 품질 게이트 차단 다수 (정상 동작, 에러 로그 noise)
- Vercel 크론 100개 한도 — 추가 불가

---

### SEO 전방위 감사 & 수정
- **사이트맵 세그먼트 정리**: 22개→14개 (빈 사이트맵 12~20 제거 → Google 크롤 예산 절약)
- **사이트맵 12 신규**: `/stock/[symbol]/vs/[target]` 인기 종목 비교 ~200 URL 추가
- **geo 태그 확장**: `/daily/[region]` 17개 지역 + `/apt/theme/[theme]?region=` 동적 geo
- **확인 완료**: robots.txt(6봇 분리), news-sitemap(48h), image-sitemap, feed.xml, llms.txt, JSON-LD(59페이지)
- **미분양 `/apt/unsold/[id]`**: 308 리다이렉트 확인 → 사이트맵 불필요

---

## 세션 94 — SEO 전 페이지 롱테일 키워드 최적화 + 이미지 캐러셀

### 완료된 작업
| 페이지 | 변경 내용 |
|--------|----------|
| 종목 `/stock/[symbol]` | 타이틀 롱테일(주가·배당금·실적·AI 분석), FAQ 4→8개(배당금/PER/52주/비교), ImageGallery JSON-LD, article:tag 17개 |
| 단지백과 `/apt/complex/[name]` | 타이틀(실거래가·시세·전세가율·평당가 2026), keywords 20개, ImageGallery 항상 노출+OG fallback |
| 청약 `/apt/[id]` | 타이틀에 지역+브랜드, article:tag 16개 확장 |
| 지역 허브 `/apt/region/[region]` | 타이틀에 연도+브랜드, 타임스탬프 동적화, 키워드 13개 |
| 블로그 `/blog/[slug]` | 카테고리별 키워드 자동 추가(주식/부동산) |
| 주식 메인 `/stock` | 롱테일 타이틀+description 확장 |

### 빌드 에러 수정 3건
1. complex `ogSubtitle` 스코프 에러 → `latestPrice` + `fmtAmount` 직접 호출
2. region `article:modified_time` 중복 프로퍼티 → 제거
3. stock ImageGallery `p` 변수 스코프 에러 → `fmtPrice` 직접 호출

### PENDING (다음 세션)
- 네이버 서치어드바이저 사이트맵 제출 + RSS 등록
- Google Search Console 사이트맵 제출
- IndexNow 전체 URL 대량 제출 (34,537 단지 + 1,846 종목)
- 109개 워드프레스 → 카더라 백링크 삽입
- 네이버 신디케이션 API 연동

## 세션 93 — 피드 리뉴얼 & 참여형 콘텐츠 + 디자인 개선

### 최종 배포: 6개 커밋, 에러 0건 (수정 2건 포함)

### 디자인 개선 (최종 커밋)
- `FeedStatusBar` 신규 — 날짜/시간(왼쪽) + 오늘 통계(중앙) + 실시간 활동중(오른쪽) 한 줄 바
- `HotTopicBar` 리디자인 — 2줄 카드 → 1줄 pill 가로 스크롤 (높이 절반)
- 카테고리 탭 → 세그먼트 컨트롤 (라운드 바 + 활성 도트)
- 정렬 버튼 → 밑줄 탭 스타일
- 헤더 LiveActivityIndicator → FeedStatusBar로 대체

### DB 마이그레이션 (`supabase/migrations/20260413_feed_renewal.sql`)
- `posts.post_type` 컬럼 추가 (post/short/poll/vs/predict)
- 6개 신규 테이블: post_polls, poll_options, poll_votes, vs_battles, vs_votes, predictions, prediction_votes
- `point_reason` enum 8개 확장 (poll_create/poll_vote/vs_create/vs_vote/predict_create/predict_vote/predict_hit/short_create)
- `notification_settings` 5개 컬럼 추가 (push_poll_result, push_predict_result, push_local_new, push_grade_up, push_point)
- RPC 4개: get_poll_results, get_vs_results, get_prediction_results, get_hot_topics
- RLS 정책 7개 (읽기 전체 허용, 쓰기 auth.uid() 체크)

### API 라우트 (7개)
- `/api/feed/short` — 한마디 작성 (+5P)
- `/api/feed/poll` — 투표 생성 (+10P)
- `/api/feed/poll/vote` — 투표 참여 (+5P, 1인 1투표, 만료 체크)
- `/api/feed/vs` — VS 대결 생성 (+10P)
- `/api/feed/vs/vote` — VS 투표 (+5P, 1인 1투표)
- `/api/feed/predict` — 예측 생성 (+10P)
- `/api/feed/predict/vote` — 예측 참여 (+5P)
- `/api/feed/hot-topics` — 핫토픽 (60s 캐시, get_hot_topics RPC)

### 피드 컴포넌트 (`src/components/feed/`)
- `QuickPostBar` — 인라인 글쓰기 (한마디/투표/예측 모드 전환, 500자 제한)
- `HotTopicBar` — 실시간 핫토픽 가로 스크롤 (24시간 내 인기글)
- `FeedPollCard` — 투표 카드 (실시간 결과 바, 퍼센트 표시)
- `FeedVSCard` — VS 대결 카드 (양자택일)
- `FeedPredictCard` — 예측 카드 (동의/반대, 적중 시 +50P)

### FeedClient 수정
- post_type별 카드 분기 렌더링 (poll→FeedPollCard, vs→FeedVSCard, predict→FeedPredictCard)
- short 타입 "한마디" 뱃지 표시
- QuickPostBar + HotTopicBar 피드 상단 삽입
- 모든 쿼리에 post_type 필드 추가 (서버/클라이언트)

### 설정 페이지
- `/settings/region` — 우리동네 설정 (시/도 → 구/군 2단계, 전국 250+ 지역)
- `/settings/interests` — 관심사 설정 (9개 카테고리 그리드)
- 더보기 메뉴에 📍우리동네 설정, 💡관심사 설정 링크 추가
- 알림 설정에 투표결과/예측적중/우리동네/등급승급/포인트 뱃지 추가

### 타입 확장
- `PostWithProfile.post_type` optional 필드 추가 (database.ts)

### ⚠️ 배포 전 필수
1. Supabase SQL Editor에서 마이그레이션 먼저 실행
2. `update_user_grade()` 트리거 충돌 확인
3. 상세 리스크: `docs/FEED_RENEWAL_RISK_REVIEW.md`

---

## 세션 92 — 부동산 SEO 대규모 확장 (전 작업 완료)

### 배포: 20건+ 커밋, 에러 0건

#### 신규 페이지 (5종, ~2,000+ URL)
- `/apt/area/[region]/[sigungu]` 시군구 허브 (~200)
- `/apt/area/[region]/[sigungu]/[dong]` 동 허브 (~1,500)
- `/apt/theme/[theme]?region=` 테마 6종 (108)
- `/apt/builder/[name]` 건설사 (~200+)
- `/apt/compare/[A]-vs-[B]` 단지 비교 (on-demand + ~200 사이트맵)

#### 크론 (4개 신규)
- `price-change-calc` 매주 월 06:30 — 가격변동률 자동 계산
- `monthly-market-report` 매월 2일 07:00 — 상위 20 시군구 시황 블로그
- `blog-complex-crosslink` 매주 수 05:00 — 블로그↔단지 연결
- `data-quality-fix` 매주 일 05:30 — 평당가/전세가율/최신가 보정

#### 인프라
- robots.txt 정적 전환
- 사이트맵 image 태그 + id=21 (시군구/동/건설사/비교)
- 테마 108 URL 사이트맵
- IndexNow 대량 확장 (시군구50+테마6+건설사20+단지백과100)
- llms.txt URL 패턴 + 데이터 갱신
- blog-auto-link 17개 패턴 추가

#### 내부 링크 (8개 페이지 강화)
- /apt 메인 → 지역17 + 테마6 + 도구5 + 건설사10
- /apt/region → SigunguLinks + 테마6 + FAQPage
- /apt/area/시군구 → 동허브 + 테마6 + 인기비교 + 단지TOP
- /apt/complex 목록 → 테마6 + 지역17
- /apt/complex/[name] → 시군구/동 허브 + 비교CTA + AggregateRating
- /apt/[id] → 시군구/동 허브 + 건설사 클릭링크

#### 어드민
- GOD MODE 크론 4개 추가 (118개 총)
- DataTab: SEO 허브 KPI + 데이터 품질 대시보드
- v2 API: seoHubs 통계 실시간 집계

#### DB 보강
| 데이터 | 시작 → 종료 | 커버리지 |
|--------|------------|---------|
| 좌표 | 30,982 → 34,527 | **100%** |
| price_change_1y | 2,291 → 13,460 | **39%** |
| avg_sale_price_pyeong | 26,813 → 27,573 | **80%** |
| blog_post_count | 0 → 2,003 | 25,952 링크 |
| total_households | 55 → 96 | 외부API 의존 |

#### 버그 수정
- price-change-calc RPC → JS 전면 재작성
- 테마 fallback regionLabel 미갱신 수정
- 어드민 CSS 누락 6클래스 추가

### 🔴 Node 수동 작업 필요
1. Google Search Console → sitemap.xml 재제출
2. 네이버 서치어드바이저 → sitemap.xml + feed.xml 재제출
3. Google Publisher Center → 뉴스 파트너 신청
4. Bing 웹마스터 → 사이트맵 확인
5. 109개 위성 사이트 → 각 사이트에 kadeora.app 백링크 1개씩 추가
