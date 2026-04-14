## 세션 — 이슈 선점 시스템 v3: 5단 파이프라인 전면 재설계

### 커밋: a612e416 → (현재)

### 문제 진단 (5겹 구조적 문제)
1. **감지 사각지대** — 뉴스 RSS만 모니터링, 청약홈 API/시공사 사이트/네이버 검색량 미감지
2. **전환율 5.8%** — 86건 감지 중 5건만 발행 완료
3. **발행 병목** — daily_publish_limit=3, 51,824건 큐 적체
4. **커버리지 구멍** — apt_sites 3,054건 중 1,075건 블로그 미존재
5. **엔티티 인식 한계** — 12개 브랜드만 하드코딩 (위브/트리니뷰/포레나 등 누락)

### 완료 — 신규 크론: issue-preempt (2시간 주기)
- Phase 1: apt_subscriptions 신규 분양 감지 → 블로그 미존재 시 issue_alerts 자동 생성
- Phase 2: apt_sites active 중 블로그 미커버 단지 → 선점 기회 감지 (5건/회)
- Phase 3: 네이버 DataLab 검색량 스파이크 모니터링 (200%+ 급증)
- Phase 4: 시공사 홈페이지 분양예정 크롤 (두산위브, 현대건설, GS건설)
- 새 이슈 발견 시 issue-draft 즉시 트리거

### 완료 — issue-detect 엔티티 인식 확장
- 아파트 브랜드 정규식: 12개 → 50+ (위브, 트리니뷰, 꿈에그린, 제일풍경채, 포레나, 에피트 등)
- specialNames: 6개 → 20+ (부산 핫 단지 포함)
- apt_sites DB 기반 동적 엔티티 매칭 (6,000건 캐시)
- 지역+브랜드 복합 패턴 추가

### 완료 — issue-draft 처리율 개선
- 최소 점수 40→25 (25~39점도 draft로 생성)
- 크론 주기 20분→10분 (시간당 3→6건 처리)
- 선점형 콘텐츠 전용 프롬프트 (pre_announcement, preempt_coverage)
- "카더라" 스타일: 팩트 vs 소문 구분, 주변 시세 비교, 청약 전략

### 완료 — 인프라 개선
- crawl-apt-subscription 스케줄: 연1회(!) → 매일 06시 + issue-preempt 트리거
- daily_publish_limit: 3 → 15 (DB 직접 변경)
- issue-scoring: 신규 타입 4종 (new_subscription, pre_announcement, preempt_coverage, search_spike)
- admin IssueTab: 파이프라인에 issue-preempt 추가, issue-draft 10분 표시
- god-mode CRON_GROUPS에 issue-preempt 등록
- 크론 총 89개

### 파이프라인 구조 (현재)
```
[2시간] issue-preempt → 시공사/청약홈/미커버/검색량
           ↓
[15분]  issue-detect  → 뉴스RSS 26곳 + GoogleTrends + DART + DB 매칭
           ↓
[10분]  issue-draft   → AI 기사생성 (25점+) + 즉시발행 (40점+)
           ↓
        자동발행 + IndexNow + 피드 + 뻘글
```

### PENDING
- APT_DATA_API_KEY 미등록 → crawl-apt-subscription 실질적 미작동
- NAVER_CLIENT_ID 미등록 의심 → issue-trend/issue-preempt Phase 3 미작동
- HUG 분양보증 API 연동
- 세움터 건축허가 API (6개월~1년 사전 감지)
- 콘텐츠 라이프사이클 (한 단지 블로그가 단계별 자동 업데이트)
- 시공사 크롤 패턴 튜닝 (현재 정규식 기반, 정확도 제한적)

## 세션 102b — 재개발·재건축 섹션 전면 강화

### 커밋: a84d14ed → 6dbd5e73

### 진단 발견 (9가지 핵심 문제)
1. 서울 API 빈약 (upisRebuild만 사용, OA-2253 미사용)
2. Full Refresh가 AI요약/좌표 등 보강 데이터 매주 파괴
3. 도시환경정비 81건(40%)이 주택재개발과 혼합
4. 전국 크롤러에 경기 주요 시군구 대량 누락
5. STAGE_ORDER에 추진위/준공 누락
6. apt_sites ↔ redevelopment_projects 연결 불안정 (Full Refresh로 ID 변경)
7. RedevProject 타입에 area_sqm 누락 → (r as any) 캐스팅
8. 블로그 348편이 apt 카테고리로 혼재 (redev 0편)
9. 관심등록 interest_count 전부 0

### 완료 — DB 마이그레이션
- 8컬럼 추가: sub_type, existing_households, blog_count, avg_trade_price, recent_trade_count, last_stage_change, previous_stage, external_id
- 3인덱스: external_id(unique), region+stage, sub_type
- 도시환경정비 81건 자동 분류 (주택재개발 84 + 주택재건축 37 + 도시환경 81)
- 블로그 345편 카테고리 apt→redev 이동

### 완료 — 코드 변경 (6파일)
1. **RedevProject 타입** — 11필드 추가 (area_sqm, sub_type, external_id, blog_count, avg_trade_price 등)
2. **STAGE_ORDER** — 6→7단계 (추진위 추가), STAGE_COLORS 보강
3. **서울 크롤러** — Full Refresh→UPSERT 전환, 도시환경 분리, external_id 매핑, constructor 추출
4. **전국 크롤러** — 경기 17개 시군구 + 세종 + 기타 6개 추가 (54→71코드)
5. **RedevTab** — 카드 완전 리디자인 (OG이미지 제거, 인라인 진행바, 건축지표, 실거래/블로그 연동, 도시환경 토글)
6. **LoginClient** — redev_interest, redev_landing MSG 추가

### 설계 문서
- docs/REDEV_ENHANCEMENT_PLAN.md — 풀스택 최종 설계안 (585행)

### PENDING (Phase B-C-D)
- B-2: /apt/redev 전용 SEO 랜딩 페이지
- B-3: /apt/redev/[region] 지역별 페이지
- B-4: Navigation 재개발 메뉴 추가
- B-5: sitemap + JSON-LD
- C-1: redev-enrich 크론 (blog_count, avg_trade_price, stage 변경 감지)
- C-2: apt_sites 연결 안정화 (external_id 기반)
- D-1: GrowthTab 재개발 현황 섹션
- D-2: 단계 변경 알림

## 세션 — 두산위브 트리니뷰 구명역 콘텐츠 전략 실행

### 커밋: 9325dc40

### 완료 항목

#### DB 작업 (Supabase 직접)
1. **apt_sites 등록** — 두산위브 트리니뷰 구명역 (slug: 두산위브-트리니뷰-구명역)
   - key_features 7개, faq_items 6개 (구글 FAQ 리치스니펫), price_comparison 4개 단지
   - analysis_text 투자분석 리포트, seo_title/description, nearby_station, school_district
   - 구포동 실거래 데이터 기반 분양가 예측 (74㎡ 3.8~4.5억, 84㎡ 4.5~5.2억)
2. **블로그 2편 발행**
   - 분양 총정리 (id:86616) — 키워드: 두산위브 트리니뷰 구명역
   - 분양가 예측 (id:86617) — 키워드: 구포동 시세, 분양가 예측
   - 품질게이트 통과 (내부링크 + FAQ + 카카오맵)
3. **토론방 개설** (room_id:210, type:apt) + 시드 메시지 3개
4. **피드 시드 게시글 4개** — 청약 고민, 신축 소식, 지조 경험, 시세 분석

#### 코드 수정
5. **seed-posts 크론** — 두산위브 트리니뷰 구명역 전용 엔티티 템플릿 6개 추가

### 콘텐츠 전략 (docs/doosan-trinivue-strategy.md)
- 블로그 10편 시리즈 (시한성 4 + 에버그린 6)
- D-24 → D-DAY 타이밍 전략
- 호스팅어 109개 사이트 교차발행 계획
- Solapi 알림톡 4단계 시퀀스 설계
- BlogReadGate → 카카오 가입 전환 퍼널

### PENDING
- [ ] 블로그 나머지 8편 (구명역 역세권, 북구 청약 전략, 지조 장단점, 구포동 살기, 시세 비교, 입주 물량, 두산건설 분석, 동네 가이드)
- [ ] 호스팅어 교차발행 10~15개 사이트
- [ ] Solapi D-24 알림톡 발송
- [ ] 5/8 모집공고 후: 분양가 업데이트 + 속보 블로그 + 경쟁률 추적

---

## 세션 102 — 전환율 극대화 전면 개편 + 어드민 대시보드 개선

### 커밋: 709ede09 → (최종)

### 전수 감사 결과
- 버그 6건 발견 (source 오염, page_path null, MSG 미매핑, 하드코딩, 추적 누락)
- 유령 CTA 10건 (코드 삭제됐으나 캐시에서 이벤트 발생)
- 추적 사각지대 5건 (ContentLock, CalcSignupCTA, RightPanel, Sidebar, KakaoHeroCTA view)
- 이중 추적 시스템 (trackCTA vs trackConversion) → LoginGate 통합 완료
- 서버주입 CTA 미추적 발견

### 완료 — Phase 1: 전환 시스템 (13파일)
1. **SmartSectionGate v6** — 클리프행어 컷포인트 (68% → 두 번째 H2 직전) + Preview Hook (남은 분석 H2/H3 미리보기)
2. **ActionBar v3** — IntersectionObserver 게이트 겹침 방지 + 페이지별 컨텍스트 메시지
3. **서버주입 CTA source 분리** — apt_alert_cta → blog_inline_cta + onclick 추적 추가
4. **LoginClient MSG 확장** — 13→27개 (action_bar, content_lock, login_gate_* 등 14개 추가)
5. **analytics.ts** — page_path null 수정 + device_type/referrer_source 전송
6. **ContentLock** — view/click 추적 추가
7. **KakaoHeroCTA** — view 추적 추가
8. **auth/callback** — 신규 가입 시 ?welcome=1 파라미터
9. **WelcomeToast 신규** — 가입 후 축하 토스트 (4초)
10. **api/track** — device_type, referrer_source 컬럼 지원
11. **DB** — conversion_events 테이블 3컬럼 + 인덱스 추가

### 완료 — Phase 2: 어드민 대시보드 (4파일)
12. **Admin API v2 growth탭** — blog_inline_cta 메트릭, Source별 가입퍼널(30일), Device별 전환(7일), Ghost CTA 필터(11개 허용목록), activeCtaStats 분리
13. **GrowthTab** — 게이트 합산 CTR 카드, OAuth 완료율 카드, Source 퍼널 테이블, Device CTR 비교, Ghost CTA 경고 배너
14. **FocusTab** — 가입경로 라벨맵 5개 추가
15. **LoginGate** — trackConversion → trackCTA 통합 (device_type null 수정)

### 배포 후 데이터 검증 (확인됨)
- ✅ device_type: mobile 정상 수집
- ✅ referrer_source: m.cafe.naver.com 등 정상 수집
- ✅ page_path: null 0% (65% → 0% 수정 확인)
- ✅ content_lock: 처음으로 추적됨 (apt 페이지 16건/2시간)

### 설계 문서
- docs/CONVERSION_IMPROVEMENT_PLAN.md — 초기 분석 (전수 감사 결과)
- docs/CONVERSION_FINAL_PLAN.md — 최종 설계안 (30+ 커밋 이력 반영)

## 세션 101 — 전수 코드 검토 + 버그 11건 수정 + 타입 재생성

### 커밋: ef04c2c0 → 3dc9c9c2

### 검토 범위
- 최근 3일 50+ 커밋, 80+ 변경 파일 전수 검토
- TypeScript 빌드 ✅ (에러 0), ESLint 검사, 크론 87개 라우트 검증
- Supabase RPC 35개 존재 확인 (DB에 모두 존재, 타입 파일만 미갱신)

### 🔴 수정 — 런타임 버그
1. **UnsoldTab.tsx — React Rules of Hooks 위반**
   - `useEffect(() => { setUnsoldPage(1) })` 가 `if (!unsold.length) return` 뒤에 위치
   - early return 전으로 이동하여 Hook 호출 순서 보장

2. **middleware.ts — X-Frame-Options DENY ↔ CSP frame-ancestors 충돌**
   - CSP: `frame-ancestors 'self' https://*.tossmini.com` vs `X-Frame-Options: DENY`
   - Toss 앱인토스 iframe 임베딩 차단됨 → `SAMEORIGIN`으로 변경

### 🟠 수정 — 전환율 버그
3. **SmartSectionGate.tsx — CTA source 불일치**
   - `source=apt_alert_cta` → LoginClient MSG 맵에 키 없음 → 컨텍스트 전환 메시지 미표시
   - `source=content_gate`로 변경

4. **LoginClient.tsx — CTA source MSG 맵 7종 추가**
   - apt_alert_cta, stock_alert_cta, kakao_hero, blog_mid_cta, right_panel, content_gate_email
   - 모든 CTA 경로에서 맞춤 전환 메시지 표시

### 🟡 수정 — 코드 품질
5. **stock/financials/page.tsx — 미사용 fmtCap import 제거**

### 검토 결과 — 이상 없음 확인
- 크론 87개 라우트 파일 전수 매칭 ✅
- 이메일 스케줄러 월요일 판정 로직 정상 (UTC Sunday 22:00 = KST Monday 07:00)
- auth callback Zero-Step 온보딩 로직 정상
- blog safeBlogInsert 품질 게이트 + 팩트체크 정상
- sanitizeHtml 단일 적용 확인 (bot 경로 이중 적용은 무해)
- unsubscribe HMAC 토큰 생성/검증 일치 확인
- CSP/CSRF/Rate Limiting 정상 적용 확인

### PENDING (코드 외)
- Resend Dashboard에서 RESEND_WEBHOOK_SECRET 웹훅 시크릿 발급 → Vercel 환경변수 등록

### 🔵 2차 수정 — 타입 재생성 + 보안 강화 (3dc9c9c2)
1. **database.ts — Supabase 타입 전면 재생성**
   - 35개 RPC 타입 누락 → 전부 포함 (increment_stock_view, increment_email_open 등)
   - 커스텀 타입 (PostWithProfile, CommentWithProfile) 재추가

2. **타입 갱신으로 드러난 기존 버그 4건 수정**
   - admin/dashboard: `post_id: number|null` null 체크 추가
   - issues/publish + feed-buzz-publish: posts INSERT에 `region_id: 'all'` 추가
   - sync-apt-sites: 불필요한 `@ts-expect-error` 제거

3. **trigger-cron 이중 admin auth 제거**
   - `requireAdmin()` 후 수동 `getUser()+is_admin` 체크 중복 → 단일화

4. **webhook/resend svix 서명 검증 추가**
   - RESEND_WEBHOOK_SECRET 설정 시 svix-signature 헤더 HMAC-SHA256 검증
   - 타임스탬프 5분 윈도우 검증
   - 미설정 시 개발 환경 호환 (스킵)

### TypeScript 빌드: 0 에러 ✅

## 세션 100 — 주식 페이지 디자인 + SEO + 네이버 1위 전략

### 커밋: ce9285e9 → 최종

### 🔴 SEO 버그 수정
- naver:written_time 하드코딩 → 동적(new Date()) — 섹터/배당/모버스/테마 4개 페이지
- AI 분석 텍스트 LoginGate 밖 SEO용 숨김 section 분리 (네이버 봇 접근 보장)
- description 200자 절삭 제거 → 크롤러에 전체 텍스트 노출

### 🟠 FAQ 리치스니펫 최대화
- /stock/[symbol]: FAQ DOM 3개 → 6개 (주가/52주/배당/PER/기업/전망), 답변 품질 강화
- /stock/movers: FAQPage 4개 신규 추가
- /stock/dividend: FAQ 2개 → 5개 (배당수익률 계산법 포함)
- /stock/sector/[name]: FAQPage 3개 신규 추가
- /stock/themes: ItemList + FAQPage JSON-LD 신규 추가

### 🟠 사이트링크 서브페이지 (네이버 사이트링크 4개 확보)
- /stock/[symbol]/chart — 차트 전용 메타데이터 + redirect
- /stock/[symbol]/financials — 재무제표 전용 메타데이터 + redirect

### 🟡 디자인/UX 개선
- 스파크라인 높이 20px → 36px
- 관심종목 ★ 터치 영역 44px (모바일 접근성)
- 탭 끝 fade gradient (overflow 힌트)
- 섹터 이름 min-width:52→80px + ellipsis
- Compact 모드 토글 ☰/▦ (한 화면 20개+ 종목)
- 수급 탭: 날짜별 스택 → 누적 라인 SVG 차트 + 최근 5일 요약

### 🟡 기능 추가
- /api/stock/view POST + increment_stock_view RPC (page_views 집계)
- StockDetailTabs ViewTracker
- 관심종목 비로그인 로그인 유도 안내
- 가격 플래시 애니메이션 CSS keyframe
- stock-fundamentals-kr 크론 2시간마다 (PER 전체 채우기 가속)
- stock-fundamentals-us 크론 3시간마다

# 카더라 STATUS.md
> 마지막 업데이트: 2026-04-13 세션 101 (Claude)

## 최근 배포
- `dpl_Grsf5KNYLFruTnCcVyw5Km1Q6cNv` — **READY** ✅ (2026-04-13)

## 세션 98 작업 내역 (Claude)

### 완료
1. **이메일 시스템 전면 개선** — 수신거부 URL 버그 수정, 라이트 테마 전환, email_send_logs 캠페인 기록
2. **크론 정리 100→87** — 7일 0건 처리 크론 13개 제거, vercel.json에서만 제거 (코드 유지)
3. **소셜프루프 동적화** — `/api/stats/social-proof` API 신규, `get_blog_stats` RPC, 20파일 하드코딩 교체
4. **통합 이메일 스케줄러** — `/api/cron/email-scheduler` 신규 (매일 KST 07:00), P1~P9 우선순위 큐, 일 95통 자동 배분
5. **블로그 품질 강화** — issue-draft 프롬프트 5000~7000자+인포그래픽 2개 필수, OUTPUT_RULES 업데이트, maxDuration 120
6. **사업자 정보 중앙화** — constants.ts에 BIZ_NAME/OWNER/NUMBER/ADDRESS 추가, 5파일 교체
7. **notification-hub 이메일 한도 체크** — email_send_logs 기준 100통 한도 + 발송 로그 기록
8. **빌드 에러 3건 수정** — page.tsx import 누락, about JSX 문법, admin/issues 타입 에러

### 커밋 (10개)
```
f2781754 fix: admin/issues blog_publish_config 타입 에러
61b2af77 fix: page.tsx BIZ_INFO_LINE import 누락 + JSX 문법
8524a138 fix: 사업자 정보 중앙화 + notification-hub 한도 체크
e4dfaa9b feat: 블로그 품질 강화 — 인포그래픽 필수화
af5a2089 feat: 통합 이메일 스케줄러 — 매일 100통 풀가동
613de468 fix: social-proof blogCount 1000행 limit 버그
36c706c8 feat: 소셜프루프 동적화 — 20파일 교체
722a765e chore: 크론 정리 100→87
4db89c01 fix: 이메일 라이트 테마 + 수신거부 버그
```

### 변경 파일 (~35파일)
```
[신규]
src/app/api/stats/social-proof/route.ts
src/app/api/cron/email-scheduler/route.ts
src/lib/social-proof.ts

[수정]
src/lib/constants.ts, src/lib/email-sender.ts, src/lib/email-templates.ts
src/lib/notification-hub.ts, src/lib/blog-prompt-templates.ts
src/app/api/cron/issue-draft/route.ts, src/app/api/cron/email-digest/route.ts
src/app/api/cron/churn-prevention/route.ts, src/app/api/admin/issues/route.ts
src/app/api/unsubscribe/route.ts, src/app/api/og/route.tsx, src/app/api/og-square/route.tsx
src/app/page.tsx, src/app/layout.tsx
src/app/(main)/layout.tsx, src/app/(main)/about/page.tsx
src/app/(main)/blog/page.tsx, src/app/(main)/press/page.tsx
src/app/(main)/shop/page.tsx, src/app/(main)/stock/data/page.tsx
src/app/(main)/stock/search/layout.tsx, src/app/(main)/apt/AptClient.tsx
src/app/(auth)/login/LoginClient.tsx
src/components/KakaoHeroCTA.tsx, src/components/SmartSectionGate.tsx
src/components/BlogMidCTA.tsx, src/components/Navigation.tsx
src/components/RightPanel.tsx
vercel.json
```

### DB 마이그레이션 (1건)
- `add_blog_stats_rpc`: get_blog_stats() — blog_posts count + SUM(view_count)

## 현재 아키텍처

### 이메일 시스템
```
email-scheduler (매일 KST 07:00) — 통합 관리
├── P1: 청약 마감 D-3 (관심단지 유저)
├── P2: 가입 환영 D+1
├── P3: 기능 안내 D+3
├── P4: 주간 리포트 (월요일)
├── P5: 이탈 방지 D+7
├── P6: 이탈 방지 D+30
├── P9: 콘텐츠 추천 (잔여 한도)
└── 일 한도: 95통 (5통 notification-hub 예비)

notification-hub — 이벤트 기반 (한도 체크 ✅)
churn-prevention — 푸시+인앱만 (이메일 제거)
email-digest — vercel.json에서 제거 (P4로 통합)
```

### 소셜프루프
```
/api/stats/social-proof (ISR 1시간 캐시)
├── blogCount: 7,625 (RPC)
├── totalViews: 524,418
├── stockCount: 1,846
├── complexCount: 34,537
├── tradeDataCount: 2,619,875
└── dailyVisitors: 1,373 (DAU 7일 평균)

동적 사용: KakaoHeroCTA, about/page.tsx
수동 교체: 나머지 18파일 (정확한 숫자로)
```

### 크론 현황: 87/100 (13슬롯 여유)

## PENDING
- email-scheduler 첫 실행 대기 (내일 KST 07:00)
- Resend 웹훅 등록: https://resend.com/webhooks → https://kadeora.app/api/webhook/resend
- 기존 7,625개 블로그 인포그래픽 일괄 추가 (batch rewrite)
- 이중 수신자 시스템 통합 (email_subscribers vs marketing_agreed)

---

## 세션 102 — 블로그 이미지 시스템 전면 개편 (2026-04-14)

### 완료

**1. 블로그 캐러셀 이미지 정리**
- og_card 텍스트 배너 23,102건 DB 삭제 (본문 캐러셀에 어두운 배너 노출 문제)
- blog/[slug]/page.tsx: og_card 타입 이미지 렌더링 필터링 추가
- Unsplash 중복 이미지 10,114건 삭제 (87개 고유 URL이 116회 반복)

**2. DB 이미지 즉시 적용 (크롤링 불필요)**
- apt_sites.images → blog_post_images site_photo 일괄 매칭 삽입 (2,167건)
- 인포그래픽 변형 4종(comparison, timeline, summary, ranking) 일괄 생성
- 최종 커버리지: 7,606개(99.8%) 5-6장, 17개(0.2%) 3-4장

**3. 블로그 썸네일(cover_image) 전면 교체**
- Before: 7,623개 전부 OG 텍스트 배너
- After: 현장사진 1,589 + 인포그래픽 5,564 + 기타 실제 이미지 470 + OG 배너 0
- landmark_apts, apt_sites 매칭으로 실제 사진 최대한 활용
- blog-generate-images 크론: Unsplash 이미지 생성 시 cover_image 자동 교체 로직 추가

**4. 이미지 생성 크론 개선**
- blog-generate-images: 제목 키워드 기반 Unsplash 검색 (카테고리 고정 → 주제 맞춤)
- 3장→6장 구성: Unsplash 4 + infographic 2
- BATCH 50→80, maxDuration 60→120, 주기 6h→3h
- extractKeywords(): 제목에서 한글 명사 추출 + 카테고리 영어 보충

### DB 변경
- blog_post_images: og_card 23,102건 삭제, stock_photo 10,114건 삭제
- blog_post_images: site_photo 2,167건 추가, infographic 변형 ~12,000건 추가
- blog_posts.cover_image: 7,623개 OG배너 → 실제 이미지로 교체
