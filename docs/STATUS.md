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
> 마지막 업데이트: 2026-04-13 세션 98 (Claude)

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
