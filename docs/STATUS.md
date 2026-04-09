# 카더라 STATUS — 세션 82 최종 (2026-04-10)

## 최종 배포
- Vercel: `prj_2nDcTjEcgAEew1wYdvVF57VljxJQ`
- Supabase: `tezftxakuwhsclarprlz`

## 세션 82 완료 작업

### 🎯 전환율 개선 전면 개편
- **삭제 (0% CTR 컴포넌트 4개, 375줄 제거)**:
  - TopBarCTA (35뷰/0클릭), ScrollToastCTA (2뷰/0클릭)
  - StickyBar (0.52% CTR "3초 가입"), InlineCTA (0.56% CTR "가입하세요")
- **ActionBar (신규)**: 페이지별 맞춤 행동 유도 — 블로그=📌저장, 부동산=🔔알림, 주식=⭐관심종목, 피드=💬댓글 + 바텀시트
- **SmartSectionGate v2 (전면 리라이트)**: 글자수 기반 70% 끊기 fallback (stock=65%, apt=70%, unsold=75%, finance=80%), 헤딩 매칭 1순위 유지
- **RelatedContentCard (신규)**: InlineCTA 대체, 관련 콘텐츠 3개 추천으로 2페이지 유도
- **계산기 결과 잠금**: 총점 무료, 전략/커트라인/가점올리기 팁은 가입 필수 (sunk cost 전환)
- **로그인 페이지 context 강화**: source 파라미터 기반 맞춤 메시지 7종 (content_gate, action_bar_bookmark/alert/watchlist/comment, calc_gate, smart_gate)

### 📊 통합 행동 분석 시스템 (신규)
- **user_events 테이블**: 모든 유저 행동을 단일 테이블에 기록 (visitor_id, session_id, event_type, properties, duration_ms)
- **user_daily_summary 테이블**: 일별 집계 + engagement_score (0~100)
- **analytics.ts**: 클라이언트 배치 전송 유틸 (sendBeacon, 3개 모이거나 2초 후 일괄)
- **BehaviorTracker 컴포넌트**: 자동 추적 — 페이지뷰/이탈+체류시간/스크롤(25/50/75/100%)
- **주요 기능 계측**: 관심단지(watchlist_add/remove), 블로그 북마크, 공유, 청약 가점 계산기, 부동산 탭전환
- **aggregate-user-events 크론 (매일 02:00 KST)**: user_events → user_daily_summary 집계 + 14일 이상 raw 정리
- **/api/analytics/events**: 이벤트 수집 API (배치 INSERT, 관리자 제외)

### 🔍 유입경로 세분화
- **referrer-classify.ts (신규)**: 40+ 소스 분류기
  - Naver 검색/블로그/카페/뉴스, Daum 검색/카페
  - 한국 커뮤니티: DCinside, Clien, FMKorea, Blind, Theqoo 등 13개
  - SNS: Instagram, Facebook, X(Twitter), YouTube, TikTok, Threads
  - AI: ChatGPT, Perplexity, Claude
  - 메신저: Telegram, Line, Band
- FocusTab/GrowthTab 유입경로 표시 8개소스 + 개별 컬러 매핑

### 🏠 부동산 페이지 강화
- 탭 전환 시 URL 동기화 (`?tab=unsold` 등) — 공유/북마크 가능
- RegionStackedBar KPI 탭바 `position: sticky` 처리
- 활성 탭 `aria-current="page"` 접근성 추가
- 6개 하위페이지 `robots` 메타 추가 (search, complex, complex/[name], map, data, diagnose)

### 📱 어드민 대시보드 개선
- 오늘 가입자 + 오늘 방문자(UV) 히어로 카드 최상단 32px 배치
- 헤더바에 오늘 가입자(+N명) 상시 표시
- 행동분석 카드: 이벤트 수 / 평균 스크롤 깊이 / 평균 체류 시간
- 전환 현황 카드: CTA별 노출/클릭/CTR 실시간 표시
- GrowthTab: CTA 하드코딩 → 동적 표시 + 중복 섹션 삭제 + 유입경로 컬러 매핑

### 😤 UX 피로 개선
- 하단 3단 겹침 해소: InstallBanner 비로그인 시 미표시 (ActionBar와 분리)
- SmartPushPrompt z-index 9999 → 90 정상화
- AdBanner 자동 슬라이드 4.5초 → 8초
- ActionBar 페이지 이동 시 리셋 (세션 영구 숨김 제거)
- SmartSectionGate trackCTA 매 렌더 중복 호출 → useEffect 1회로 수정

### 🐛 버그 수정
- daily-seed-activity: post_likes INSERT → UPSERT (중복 좋아요 에러 방지)
- blog-loan-guide: 크론 스케줄 충돌 해소 (0 6 → 5 6)
- newUsersToday 쿼리: 시드/고스트 제외 정확한 오늘 가입자 수

## 현재 KPI
- 블로그: ~18,500편 발행
- 리라이트: 진행중 (54%)
- 크론: 91종
- PV: ~1,300/일
- 유저: 48명 실유저 (시드 100명 별도)
- 가입 전환율: 0.26% → 목표 1.5%
- DB: ~2.0GB / 8.4GB

## 전환 시스템 현황 (v2)
| 장치 | 역할 | 적용 범위 |
|---|---|---|
| ActionBar | 페이지별 행동 유도 (저장/알림/관심종목/댓글) | 비로그인 상세 전페이지 |
| SmartSectionGate v2 | 글자수 70% 끊기 + 헤딩 매칭 | 블로그 전체 |
| RelatedContentCard | 관련 콘텐츠 3개 추천 | blog/apt/stock/feed 상세 |
| LoginGate | AI 분석 블러 | 주식/부동산 상세 |
| ContentLock | 비용 시뮬레이터/한줄평 잠금 | 부동산 상세 |
| 계산기 결과 잠금 | 전략/커트라인/팁 잠금 | /apt/diagnose |

## API 키 상태
- ANTHROPIC_API_KEY ✅
- CRON_SECRET ✅
- STOCK_DATA_API_KEY ✅
- KIS_APP_KEY ❌
- FINNHUB_API_KEY ❌
- APT_DATA_API_KEY ❌

## 다음 작업
- [ ] 전환율 모니터링 (1주일 데이터 수집 후 A/B 최적화)
- [ ] 행동 분석 대시보드 확인 (BehaviorTracker 데이터 확인)
- [ ] SEO Phase 2: 리라이트 가속 (제목/메타 53%→95%)
- [ ] alert/confirm → Toast/모달 교체 (4곳)
- [ ] 유료 상점 설계 (행동 데이터 기반)
- [ ] Toss 앱인토스 제출

## 세션 82b 추가 작업 (2026-04-10)

### SEO 자동화 크론 4개 추가
- **seo-indexnow-submit** (매일 06:00 KST): 최근 24h 발행/수정 URL + 활성 부동산 페이지 → IndexNow 일괄 제출 (최대 200건/일)
- **seo-content-boost** (매주 일 02:00): 60일+ 경과 + 조회 0~2 thin content → unpublish + 성장 가능 콘텐츠 리라이트 큐
- **blog-subscription-alert** (매일 08:00): 신규 청약 공고 감지 → AI(Haiku) 분석글 자동 생성 + 즉시 발행
- **seo-internal-links** (매주 수 03:00): 인기 글(조회 50+)에 관련 분석 내부 링크 자동 삽입

### 발견 사항
- "청약 가점 계산기 2026" 키워드 → **카더라 Google 1위** (청약홈보다 위)
- 기존 14개 계산기 페이지는 이미 SEO 최적화 완료 (JSON-LD + FAQ + 구조화 메타)
- 0조회 글은 15편뿐 (예상보다 적음)
- 크론 수: 91 → 95개
