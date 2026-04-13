# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-13 (세션 98 최종 — 전수 검토 완료)

## 세션 99 — 이메일 전체 발송 시스템 전면 개선

### 배포: 1 커밋, 7파일 (DB migration 포함)

### 🔴 Critical 수정
- **수신거부 URL HMAC 토큰 보안**: `/api/unsubscribe?email=xxx&token=yyy` — HMAC-SHA256 서명 검증 추가, 타인 이메일 강제 수신거부 불가
- **unsubscribe listUsers perPage 버그**: `perPage:1`로 첫 유저만 가져오던 버그 → `filter: email.eq.${email}` 정확히 조회
- **churn-prevention D+7 marketing_agreed 미체크**: 마케팅 동의 없는 유저에게 이메일 발송 → `marketing_agreed = true` 필터 추가

### 🟠 High 수정
- **Resend 100통/일 한도 3경로 공유 문제**: email-digest/churn/어드민 모두 `email_send_logs` 기반 오늘 잔여량 체크 → 초과 시 차단
- **N+1 auth API 제거 (send-email)**: 수신자마다 개별 auth.admin.listUsers → 페이지네이션으로 배치 Map 구성 후 profiles IN 쿼리 1번
- **churn D+7 중복방지 로직 강화**: notifications content ilike 의존 → `email_send_logs.campaign='churn-d7'` 기반으로 교체
- **DB migration**: `email_send_logs`에 `user_id uuid` 컬럼 추가 + 인덱스 3개 (user_id, campaign+status, created_at)

### 🟡 Medium 수정
- **UTM campaign 하드코딩 제거**: `april_2026` → `new Date().toISOString().slice(0,7)` 동적 처리 (예: `2026_04`)
- **campaign 로그 target 포함**: `re-engagement` → `re-engagement_all` / `re-engagement_dormant` 구분 기록
- **휴면 기준 3일 → 30일**: dormant 판별 threshold 3 * 86400000 → 30 * 86400000
- **email-digest 잔여 한도 체크 + 이번 주 중복 발송 방지**: weekly-digest sent 로그로 중복 스킵

### 어드민 EmailSender UI 개선 (FocusTab)
- Resend 잔여 한도 실시간 표시 (색상: 초록→노랑→빨강)
- 테스트 이메일 입력 필드 추가
- 발송 전 수신자 수 미리보기 (클릭: 카운트, 더블클릭: 발송)
- 실패 이메일 목록 토글 노출 (어떤 이메일이 왜 실패했는지)
- 한도 스킵 건수 별도 표시

### 변경 파일
- `src/app/api/admin/send-email/route.ts` — 전면 재작성
- `src/app/api/unsubscribe/route.ts` — HMAC 토큰 보안
- `src/lib/email-templates.ts` — generateUnsubToken/buildUnsubUrl 헬퍼, UTM 동적
- `src/lib/email-sender.ts` — buildUnsubUrl 적용
- `src/app/api/cron/email-digest/route.ts` — 한도 체크, 중복 방지, user_id 로그
- `src/app/api/cron/churn-prevention/route.ts` — marketing_agreed 체크, 중복방지 강화
- `src/app/admin/tabs/FocusTab.tsx` — EmailSender UI 전면 개선

### Architecture Rules
- UNSUBSCRIBE_SECRET env var 필요 (없으면 NEXTAUTH_SECRET fallback)
- email_send_logs.user_id: 모든 발송 경로에서 기록 (어드민/digest/churn)
- dormant 기준: 30일 (churn-prevention D+7은 별도 로직)


## 세션 98 최종 — 전수 검토 버그 수정

### 다른 컴퓨터와의 작업 충돌 수정

**[버그 1] OnboardingClient 지역 필수화 역행**
- 84c81819 커밋이 세션 98의 "지역 선택사항" 작업을 `disabled={saving || !region}`으로 덮어씀
- 버튼 텍스트 `'📍 지역을 선택해주세요'`로 변경되어 지역 필수화 상태였음
- `disabled={saving}`으로 복원 → 지역 없이도 시작 가능

**[버그 2] issue-draft publish_decision 로직**
- `canAutoPublish=true`이지만 safeBlogInsert 실패 시 'auto'로 표시되어 실패 식별 불가
- `'auto_failed'`로 구분 → CRON_TYPE_DAILY_LIMIT 등 실패 이슈 어드민에서 식별 가능

### 어드민 IssueTab 대시보드 업데이트
- 파이프라인 카드: 일간 한도 게이지 (cronLimitUsed/30)
- 파이프라인 카드: 발행실패(autoFailed) 카운터
- 통계 바: 40점+ 대기, 오늘 발행, 발행실패 표시
- 이슈 배지: auto_failed(발행실패), auto 대기중 상태
- admin/issues API: publishedToday, autoFailed, pending40plus, cronLimitUsed/Max 추가

### issue-draft 발행 차단 원인 해결
- DB 트리거 `validate_blog_post`: `CRON_TYPE_DAILY_LIMIT` 10→30으로 상향
- 차단됐던 40점+ 이슈 8건 재처리 리셋
- 다음 크론 사이클에서 순차 발행 예정



## 세션 98 추가 — DB statement timeout 폭발 해결

### 원인 분석 (pg_stat_statements)
- `apt_transactions` 전체컬럼 조회: 2,500ms × 24,604번 = **누적 60,497초**
- `get_seo_portal_stats()` 전스캔: 1,800ms × 24,495번 = **누적 45,105초**
- `check_blog_similarity` GIN 미활용: 1,700ms × 13,822번 = **누적 23,852초**
- `get_apt_pulse()` 집계: 500ms × 19,106번 = **누적 9,381초**
- `apt_transactions` OR+ILIKE (dong/sigungu): **500 에러**

### 수정 완료

**함수 개선 (MV 캐싱 교체):**
- `check_blog_similarity` — `similarity()` → `set_limit() + %` 연산자 (GIN 인덱스 활용)
- `get_seo_portal_stats()` → `mv_seo_portal_stats` MV 읽도록 교체
- `get_apt_pulse()` → `mv_apt_pulse` MV 읽도록 교체
- `get_trade_region_stats()` → `mv_trade_region_stats` MV 읽도록 교체

**MV 3개 생성 (pg_cron 자동 refresh):**
- `mv_seo_portal_stats` — 매시 정각 (job 20)
- `mv_apt_pulse` — 매시 15분 (job 21)
- `mv_trade_region_stats` — 매시 30분 (job 22)

**인덱스 7개 추가 (apt_transactions):**
- `idx_apt_tx_name_date_cover` — covering index (heap fetch 제거)
- `idx_apt_tx_sigungu_date` — sigungu + deal_date 복합
- `idx_apt_tx_created_at` — created_at DESC
- `idx_apt_tx_dong_trgm` — dong GIN trgm (OR ILIKE 500 에러 해결)
- `idx_apt_tx_sigungu_trgm` — sigungu GIN trgm
- `idx_conversion_events_created_cta` — growth API 최적화
- `idx_page_views_created_visitor` — growth API 최적화

### 결과
- pg_stat_statements 리셋 후: 500-900ms 수준으로 개선 (65%↓)
- statement timeout 에러: 초당 0.26건 → **0건** (로그 완전 클리어)
> 마지막 업데이트: 2026-04-13 (세션 98 — 트래픽→가입 전환 집중 개선)

## 세션 98 — 트래픽→가입 전환 3종 개선

### 배포: 1 커밋, 5파일 (412줄 추가)

### 🔴 SmartSectionGate v2
- cut point 55% → 68% (더 읽힌 후 게이트, engagement 높은 상태에서 가입 결정)
- 문구 전면 재설계: "잠금 해제" → "무료 알림 + 전체 읽기" 혜택 중심
- 카테고리별 혜택 bullets (apt: 가격 변동 알림·청약 마감, stock: 목표가 알림, finance: 절세 알림)
- 소셜프루프 강화: "오늘 N명 가입 · 총 N명 이용 중"
- source 파라미터: `apt_alert_cta` 통일 (가입 1위 소스 패턴 전체 복제)
- 목표: content_gate CTR 0.68% → 2%+

### 🟢 BlogAptAlertCTA 신규 컴포넌트
- apt/unsold 카테고리 블로그 본문 하단 인라인 알림 CTA
- 비로그인: 가입 유도 (source=apt_alert_cta, 기존 1위 소스 패턴 그대로)
- 로그인: /api/apt/interest POST → apt_site_interests 직접 등록 + 50P
- 등록 완료 시 ✅ 상태 전환
- 삽입 조건: apt/unsold 카테고리 + post.tags[0] 단지명 있을 때 (봇 제외)

### 🟢 POST /api/apt/interest 신규
- apt_name 또는 site_slug로 apt_sites 조회
- apt_site_interests INSERT (notification_enabled: true)
- apt_sites 미등록 단지: price_alerts fallback (apt_name 기반)
- award_points 50P (관심단지등록)

### 🟡 OnboardingClient v2
- 지역 선택 "선택사항" 배지 추가 (강제 느낌 제거)
- 기본 옵션 "선택 안 함 (나중에 설정 가능)" 명확화
- 시작하기 버튼 하단 선택한 관심사 기반 혜택 텍스트 동적 표시
- 건너뛰기 → "건너뛰기 (나중에 설정)" 레이블 개선

### 배경 (성장성 분석 기반)
- 7일 UV ~11,000 → 가입 20명 = 전환율 0.18%
- apt_alert_cta = 가입 1위 소스 (14/19명)
- content_gate 노출 2,358회 → 클릭 16회 (0.68%)
- 온보딩 86명 중 62명만 완료 (72%)

> 마지막 업데이트: 2026-04-13 (세션 97 — 이슈선점 중복 방지 3중 방어)

## 세션 97 — 이슈선점 중복 방지 + 프로필 완성 + PDF 파싱 복구

### 배포: 1 커밋, 10+ 파일

### 🔴 이슈선점 중복 발행 3중 방어
- **issue-detect isDuplicate v2**: pg_trgm 유사도 + 키워드 2개+ 겹침 차단 + 카테고리+issueType 6시간 제한
- **issue-draft 사전 대조**: CAS 락(race condition 방지) + blog_posts 키워드/제목 사전 대조
- **issue-detect 즉시 트리거**: score 50+ 이슈 → issue-draft fire-and-forget 호출 (35분→5분)
- **issue-draft blog_post_id 추적 수정**: slug fallback 조회로 추적 누락 해결
- DB: `title_similarity_threshold` 0.4→0.2, `check_issue_similarity` RPC, 인덱스 2개
- 중복 글 6개 unpublish (SMR 5 + 이란 1)

### 🔴 프로필 완성 시스템
- **/daily 리다이렉트 개선**: 로그인 유저 → DB residence_city 우선 → localStorage 동기화
- **인라인 지역 선택기**: 지역 미설정 유저가 /daily 방문 시 "어디에 사세요?" 원탭 선택 → DB 저장 + 리포트 즉시 이동
- **온보딩 지역 필수화**: 지역 선택 없이 "카더라 시작하기" 버튼 비활성 (건너뛰기는 유지)
- **마케팅 동의 프레이밍 개선**: "마케팅 수신 동의" → "내 지역 청약 마감 알림 받기"
- **settings/region**: 저장 시 localStorage('daily_region') 자동 동기화
- **profile_completed 자동 트리거**: DB BEFORE UPDATE 트리거 (nickname_set + residence_city + interests)
- DB: `marketing_agreed_at` 컬럼 추가, 기존 유저 profile_completed 백필

### 🔴 PDF 파싱 복구
- **apt-parse-announcement v4**: `withCronLogging` 추가 (7일간 로그 0건 → 추적 가능)
- **실패 재시도 로직**: fetch 실패 시 `announcement_parsed_at` 세팅 안 함 → 다음 사이클 재시도
- **3회 실패 포기**: `parse_fail_count` 컬럼으로 영구 실패 URL 자동 스킵
- DB: `apt_subscriptions.parse_fail_count` 컬럼 추가

### 📊 어드민 업데이트
- **GrowthTab**: 프로필 완성 퍼널 섹션 추가 (온보딩→관심사→지역→마케팅→프로필 완성)
- **admin/v2 API**: funnel에 onboarded/profileCompleted, dataCollection에 interests 수집률 추가

---

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

---

## 세션 77: 전수 진단 + 일괄 수정 (2026-04-13)

### 발견된 이슈 25건+ → 수정 완료

#### CRITICAL (2건)
1. ✅ `/login` 500 에러 — 쿠키 파싱 try/catch 추가 (safeCookies 패턴)
2. ✅ `/api/og-chart` 500 (48건+/일) — 에러 시 1x1 투명 PNG 폴백 반환

#### HIGH (3건)
3. ✅ 조회수 ISR 언더카운팅 — 서버사이드 RPC → 클라이언트 API 전환
   - `/api/apt/view` + `/api/blog/view` POST 엔드포인트 생성
   - `ViewTracker` 클라이언트 컴포넌트 (AptViewTracker, BlogViewTracker)
   - apt/[id] + blog/[slug] 페이지 적용
4. ✅ AI 블로그 크론 504 — blog-tax-guide, blog-regional-analysis maxDuration 60→300
5. ✅ Dead API Key 크론 정리 — stock-price 5분→1일1회, crawl-competition-rate/crawl-apt-subscription 비활성화

#### MEDIUM (3건)
6. ✅ safeBlogInsert 로그 노이즈 — console.error → console.warn 다운그레이드
7. ✅ `.single()` → `.maybeSingle()` 7곳 수정 (feed, settings, daily, blog, grades, write)
8. ✅ 미사용 DB 인덱스 59MB 정리 (20개 DROP)

#### DB 마이그레이션
- 누락된 RPC 3개 생성 (get_trade_sites_for_sync, refresh_all_site_scores, refresh_seo_stats)
- 미사용 인덱스 20개 DROP (59MB 절약)
