# 카더라 STATUS.md — 세션 75 (2026-04-06 KST)

## 인프라 총괄
| 항목 | 수량 |
|------|------|
| 블로그 | **59,401편** (발행 59,388, 전편 2,000자+) |
| DB 데이터 주입 블로그 | **41,283편** (70%) |
| 커뮤니티 게시글 | 5,044편 |
| 사용자 | 37명 (실유저, 시드 100명 제외) |
| 주식 종목 | 1,803 |
| 분양사이트 | 5,728 |
| 단지백과 | 34,500 |
| 청약 | 2,701 |
| 미분양 | 204 |
| 재개발 | 217 |
| 크론 | **83** (97→83, 월간 블로그 16→1 디스패처 + push-content-alert) |
| TS 에러 | 0 |
| 빌드 | READY |
| 이메일 구독자 | 0 (테이블 생성 완료) |
| 푸시 구독자 | 0 (AutoPushPrompt v2 배포) |
| RLS | 138/138 (email_subscribers + conversion_events 추가) |

## 세션 75: 전방위 개선 + 다크모드 수정 + 댓글 리디자인

### 전방위 개선 배치 (-1,106줄)
- **Dead code 정리**: 5 컴포넌트 + 4 API 삭제 + middleware 정리
- **계산기 142종 공유 버튼**: ShareButtons 추가
- **블로그 테이블 모바일 overflow**: globals.css 글로벌 적용
- **RSS 피드 404 수정**: 3곳 경로 수정
- **Disclaimer blog+calc 타입 추가**: 출처 표시 통합
- **push-content-alert 리팩토링**: 89→46줄 (sendPushBroadcast)

### 다크모드 컬러 전수 수정
- 블로그 인라인 색상 스트리핑 (AI 생성 `color:#333` 제거)
- SectorHeatmap #374151→#6B7280, ComplexClient #050A18→#fff

### 댓글 D안 컴팩트 리스트 (3개 컴포넌트 통일)
- CommentSection + BlogComment + AptCommentInline → 컴팩트 인라인 + 정렬 토글

### 기타
- 카카오스토리→카카오톡 교체 (KakaoDirectShare)
- 카드 빈칸 채우기 (렌더타임 계산 + 맥락형 대체텍스트)
- apt/[id] 중복 5건 제거 (-45줄)

## 세션 74: 전환율 2%+ 성장 루프 설계 + Layer 1 구현 + 크론 정리

### 추가 수정 (세션 후반)
- **apt/[id] 중복 5건 제거** (-45줄, 1646→1601): 납부일정 2곳→1곳 통합(payment_schedule 우선, down_payment_pct 폴백), 분양조건 체크리스트 제거(RegulationBadges 중복), 규제·청약자격 중복 4항목 제거(발코니확장/청약저축/우선공급만 유지), loan_rate 3곳→1곳(RegulationBadges만)
- **카드 빈칸 채우기** (5파일): 렌더타임 평당가 계산(house_type_info→area/price), 분양가 추출(null→실데이터), 맥락형 대체텍스트(미정→공고확인, 준비중→공고전, -→접수전/D-접수/미공개/집계중/미확정), 크론 불필요
- **blog-rewrite 504 수정**: 배치 9→3건 (6회/일 × 3건 = 18건/일, Vercel 런타임 로그 확인)
- **push-content-alert 크론** (신규): 매일 KST 20:00 푸시 구독자에게 인기 블로그 알림
- **전환 이벤트 추적**: conversion_events 테이블 + /api/track + beacon API 유틸 + 4개 CTA 추적 삽입
- **sync-complex-profiles NULL 수정**: RPC에 `AND t.sigungu IS NOT NULL` 필터 (13건/일 실패 해결)
- **admin/dashboard conversion 섹션**: CTA 이벤트 통계 + 이메일/푸시 구독자 수
- **blog-rewrite 504 완전 해결 확인**: 8회 연속 성공 (3건/회, ~250초, 300초 내 안전)
- **크론 성공률 98.4%** (95.4% → 98.4%, 245/249)
- **디바이스 분류 확인**: 모바일 58.6% / 데스크탑 30% / 봇 11.4% (UA 수집 정상)
- **오늘 리라이팅 9건** (3건/회 × 3회), 신규 가입 2명 (139명)
- **daily_stats PV 정상**: 4/5 1,456뷰 / 4/6 400뷰 (수정 전 0)
- **push-content-alert 피크 맞춤**: KST 20:00 → 22:00 (피크 23시 대응)
- **알림 시스템 전수 수정 (세션 75+)**:
  - push-daily-reminder v2: D+1 웰컴 알림(관심지역 기반) + 출석 리마인더(재방문 실유저만, 시드 제외)
  - push-utils v2: deliverPush 공통 함수 + sendPushBroadcast 비로그인 구독자 포함
  - quiet_hours 기본값 22:00→23:30 (피크 22~23시 알림 허용)
  - push_daily_digest 기본값 true (재방문 엔진)
  - 30일+ 미읽힘 system 알림 정리 (bloat 방지)
  - 크론 스케줄 최적화: check-price-alerts(32→4회/일), push-content-alert(22→22:30KST), invite-reward(48→4회/일), seed-posts(12→6회/일), seed-comments(6→3회/일)
- **어드민 v2 구현 (14탭→6탭)**: AdminShell + FocusTab(건강점수) + GrowthTab(퍼널+히트맵) + UsersTab(라이프사이클+관심단지) + DataTab(신선도+품질) + OpsTab(크론헬스) + ExecuteTab(🚀전체최신화) + v2 API
- **daily_stats 페이지뷰 카운터 수정**: capture_daily_stats RPC에 total_page_views 누락 → 추가 (0→1,388 즉시 반영)
- **blog-rewrite withCronLogging 추가**: cron_logs 추적 가능 (기존 console.log만 → 성공/실패 기록)
- **apt_rent_transactions 인덱스**: `idx_rent_created_at` 추가 + sync RPC 타임아웃 90→180초
- **naver-complex-sync stuck 수정**: 전역 100초 타임아웃 추가 (stuck in running 해결)
- **Anthropic API 크레딧 충전 확인**: 모든 AI 크론 정상 작동 (blog-stock-v2, blog-apt-v2, apt-ai-summary 등)

### 전환율 전방위 분석
| 지표 | 7일 | 30일 |
|------|-----|------|
| UV | 12,042 | 12,810 |
| 신규 가입 | 16 | 37 |
| **전환율** | **0.13%** | **0.29%** |
| 1페이지 바운스 | **97.9%** | - |
| 재방문자 | 21명 (0.17%) | - |

### Layer 1 전환 최적화 (13파일 + 5 신규)
1. **BlogReadGate v3**: 60% 잘림 완전 제거 → 100% 콘텐츠 공개 + SmartSectionGate로 위임
2. **SmartSectionGate** (신규 88줄): "향후 전망" 등 핵심 1섹션만 블러, SSR 전체 렌더 (SEO 보호)
3. **TwoStepCTA** (신규 114줄): 2단계 마이크로 커밋먼트 ("알림 받을래요?" → "카카오 연결")
4. **ReturnVisitorBanner** (신규 89줄): 재방문자 전용 하단 CTA, 첫 방문자 절대 미표시
5. **NewsletterSubscribe** (신규 117줄): 이메일 뉴스레터 구독 (가입 불필요, 개인정보보호법 준수)
6. **GuestNudge v4**: 첫 방문자 비활성 → 재방문자만 표시 (kd_visit_sessions)
7. **AutoPushPrompt v2**: 비로그인 지원 + 스크롤 75% 트리거 + 맥락별 메시지
8. **CTA 메시지 전면 교체**: "댓글·좋아요" → "가격 변동 알림" 등 구체적 가치 제안
9. **/api/newsletter/subscribe** (신규 34줄): 이메일 구독 API (rateLimit + RLS)
10. **email_subscribers 테이블**: DB 마이그레이션 완료

적용 위치: blog/[slug], apt/[id], layout.tsx
설계 원칙: 첫 방문자 최대 2 touchpoint (SmartSectionGate + TwoStepCTA)

### 크론 정리 (97→82, -15)
- **blog-monthly-topics 디스패처**: 월간 블로그 16개 크론 → 1개로 통합 (Day 1~14별 토픽 매핑)
- invite-reward: */15 → */30 (빈도 반감)
- seed-posts: */30 → */2h (빈도 1/4)
- collect-site-images: 8회/일 → 4회/일

### 설계 문서 4건
- `docs/GROWTH-LOOP-2026-04.md`: 7-Layer 성장 루프 아키텍처 (Month 9~10에 2%+ 돌파)
- `docs/RISK-ANALYSIS-2026-04.md`: 10개 리스크 항목 전방위 분석
- `docs/CONVERSION-DESIGN-2026-04.md`: 기본 전환율 설계안 8개 수정
- `docs/CONVERSION-TIGHT-2026-04.md`: 타이트 버전 7개 공격적 전술

### 보안 전수 수정 (Phase 1~2 완료)
- Admin API 2개 무인증 → requireAdmin 적용
- 하드코딩 토큰 `kd-reparse-2026` 5개 API에서 완전 제거
- RLS 5개 테이블 활성화 → 136/136 → 137/137 (email_subscribers 추가)
- Admin API 15개 requireAdmin 일괄 적용 (49/54 보호)
- sanitize 미적용 6개 API 수정
- 에러 메시지 노출 3건 제거

### 전환율 예상 수치 (바닥부터 역산)
| 시점 | 전환율 | 주간 가입 |
|------|--------|---------|
| 현재 | 0.13% | 16 |
| 적용 직후 | 0.54~0.75% | 65~91 |
| 1개월 | 0.77% | 93 |
| 3개월 | 0.96% | 196 |
| 6개월 | 1.53% | 573 |
| 9~10개월 | **2.0%+** | 1,300+ |

## 세션 73: UI 카드 리디자인 + 전환율 강화 + 상세 페이지 개선 — 커밋 11건

### 4탭 카드 청약 패턴 통일 리디자인
모든 부동산 탭 카드를 청약 탭 디자인 패턴으로 통일:
- **공통 패턴**: 배지 행 → 현장명 14px bold → 메타 10px → 4열×2행 KPI 그리드(border+rounded 8px) → 하단 시각(도트/바/차트) → ☆ 관심등록
- **CSS 변수 기반**: var(--bg-surface), var(--border) 등 → 다크/라이트 모드 자동 대응
- **총 -253줄** (1,312→1,059줄)

| 탭 | KPI 내용 | 하단 시각 |
|---|---------|---------|
| 분양중 | 분양가/평당가/취득세/입주 + 세대수/계약금/시공사/D-입주 | 5단계 도트 타임라인 (청약→당첨→계약→공사→입주) |
| 미분양 | 미분양호수/전월대비(surgeAlerts)/총공급 | 미분양률 그래디언트 바 + AI 인라인(34%) |
| 재개발 | 세대수/유형/면적/진행률 | 6단계 도트 타임라인 (구역→조합→인가→관리→착공→준공) + AI(81%) |
| 실거래 | 평당가/거래수/최저/최고 | 미니 추이 차트 (같은 단지 최근 9건) |

### 상세 페이지 개선 (apt/[id]/page.tsx)
- **미분양**: 2열→3열 KPI (미분양/공급/미분양률) + AI 요약 인라인
- **재개발**: 면적(50%) + notes(83%) 인라인 추가
- **실거래**: 층별 평균(저/중/고층) + 면적별 평균(소/중/대형) 2열 그리드 추가

### 회원가입 전환율 강화 — Tier 1+2+3 (10파일 291줄)
전환율 0.13% (11,938 방문자 → 16 가입) 개선:
- **Tier 1**: BlogReadGate v2 (비로그인 항상 55% 잘림), ExitIntentPopup (이탈감지), GuestNudge v3 (3PV 기반)
- **Tier 2**: ContentLock (SSR 전체+클라이언트 블러), ScrollDepthGate (65% 스크롤 배너)
- **Tier 3**: GuestGate 5회→3회, SignupNudge 쿨다운 24h→6h

### 지역별 현황 리디자인
- MiniDonut: 지역명+숫자 SVG 내부 text → 아래 2줄 제거, 모바일 4→5열
- 상세 패널 클릭→탭 전환, 높이 절반 축소
- 미분양 탭 상단 3섹션 삭제 → 컴팩트 5색 비율 바 (78% 축소)

### 데이터 정직화
- DB 컬럼별 전수 확인 후 0% 데이터 카드에서 제거 (용적률/건폐율/최고층/평당가/시공사/시행사 등)
- apt/page.tsx 쿼리에 acquisition_tax_est, down_payment_pct, transfer_limit_years 추가

### 보안 수정 (Phase 1~2, 42건 중 30건)
- Admin API 2개 무인증 → requireAdmin
- 하드코딩 토큰 kd-reparse-2026 완전 제거
- RLS 미적용 5개 테이블 활성화 (apt_complex_profiles 34,500행, apt_rent_transactions 2,109,092행 등)
- Admin API 15개 requireAdmin 일괄 적용

## 세션 72: PDF 전수 파싱 + 현장 상세 리디자인 — 커밋 10건

### PDF 모집공고 전수 파싱
- `apt-parse-pdf-pricing` 크론 신규: 5전략 정규식 + API 교차검증
- DB 마이그레이션: apt_subscriptions 30컬럼 추가 (가격/규제/시설/설계/비용)
- 배치 200건/동시 10건/250초 안전장치/GOD MODE 290s
- 자동 파이프라인: 수집→웹파싱→API가격→PDF파싱(6h크론)→프론트 자동표시

### PDF 파싱 데이터 최종
| 데이터 | 건수 | 비율 |
|--------|------|------|
| PDF 실측 가격 | 1,946 | 72.0% |
| 통계 추정 가격 | 653 | 24.2% |
| **가격 커버리지** | **2,599** | **96.2%** |
| 미공개 (API NULL) | 102 | 3.8% |
| 전매제한 | 789 | 29.3% |
| 커뮤니티 시설 | 647 | 24.0% |
| 취득세 추정 | 2,235 | 82.7% |
| 납부일정 | 2,156 | 79.8% |
| 단지 스펙 | 253 | 9.4% |

### 현장 상세 페이지 (1,614줄) — 신규 9섹션
| # | 섹션 | 상태 |
|---|------|------|
| 1 | 카카오톡 공유 버튼 | ✅ 신규 |
| 2 | ❤️ 관심등록 → #interest-section 스크롤 | ✅ 신규 |
| 3 | 가격 범위 바 (min~max + 추정 뱃지) | ✅ 개선 |
| 4 | 규제 신호등 뱃지 (전매/거주/재당첨) | ✅ 신규 |
| 5 | 총비용 시뮬레이터 (추정치 기반 라벨) | ✅ 신규 |
| 6 | 납부 일정 타임라인 (계약금/중도금/잔금) | ✅ 신규 |
| 7 | 입지 분석 카드 (학군/교통 2칼럼) | ✅ 신규 |
| 8 | 커뮤니티 뱃지 그리드 (카테고리별 아이콘) | ✅ 개선 |
| 9 | 단지 스펙 인포그래픽 (설계/에너지/천장고) | ✅ 신규 |

### 신규 컴포넌트 5개
- `lib/interest-utils.ts` — 허수 카운트(×0.5), 취득세 계산, 평당가 계산
- `components/ImageLightbox.tsx` — 풀스크린 이미지 뷰어 (스와이프/ESC/도트네비)
- `components/RegulationBadges.tsx` — 규제 신호등 뱃지 (빨강/노랑/초록)
- `components/CostSimulator.tsx` — 실입주 총비용 시뮬레이터
- `cron/apt-parse-pdf-pricing/route.ts` — PDF 가격+규제+시설 통합 파싱

### UX 개선
- 관심 허수 카운트: 공급세대 × 0.5 기본 표시 (KPI + InterestRegistration + JSON-LD)
- 모바일 바텀네비: 좌2(피드/주식) [글쓰기] 우2(부동산/더보기) 대칭
- 대시보드: 실유저만 카운트 (is_seed/is_ghost/is_deleted/is_banned 제외)
- 평당가 기준 표기: 평균/최고가/실거래 구분 (5곳)
- 추정치 '추정' 노란 뱃지 (분양가바/타입표/비교/시뮬레이터)
- 이미지 Lightbox → AptImageGallery 교체 (스와이프+키보드)

### 핫픽스
- onClick 서버컴포넌트 크래시 수정 (카카오 공유 → 앵커 링크)
- PDF 파싱 GOD MODE 인증 (runSpecial→runCronSingle)
- PDF 파싱 타임아웃 방지 (배치 200/250초 안전장치)
- PDF 파싱 중복 return 제거

### 블로그 업데이트
- 가격 범위 반영 (blog-apt-new/v2 크론 수정)
- 496편 가격 범위 SQL 업데이트

## 이전 세션 (70~71) 요약
- 블로그 36,724편 대량 생성 + DB 데이터 주입 41,283편
- SEO 전수 감사 + 사이트맵 수정
- 광고판 + 인기검색어 + 피드 자동발행
- 부실 블로그 16,018편 보강 → 전편 2,000자+

## PENDING
- [ ] Anthropic API 크레딧 충전
- [ ] KIS_APP_KEY / FINNHUB_API_KEY 등록
- [ ] 통신판매업 신고
- [ ] Toss 앱인토스 리뷰
- [ ] /author/[name] 프로필 페이지 (E-E-A-T)
- [ ] 전월세 탭 UI
- [ ] 블로그 댓글 수정 기능
- [ ] 프로필 비공개 설정
- [ ] 전환율 설계안 구현 (BlogReadGate 100% 공개 + 완독 CTA + ConversionOrchestrator)

## 세션 72 후반: 계산기 142종 SEO 만점 + 회원가입 유도

### 계산기 SEO 만점 강화
| 항목 | Before | After |
|------|--------|-------|
| 이모지 | 0종 | **141종** (계산기별 고유 이모지) |
| FAQ 첫질문 "무료인가요?" | 131종 | **0종** (전부 카테고리별 맞춤) |
| seoContent | 범용 3문단 | **카테고리별 완벽 가이드** |
| JSON-LD | 3종 | **4종** (+HowTo 3단계) |
| AggregateRating | 없음 | **4.8/5 (127건)** |
| Meta desc | 설명만 | **"2026년 최신. 무료·회원가입 불필요"** |
| Keywords | 5개 | **8+개** |
| OG 이미지 | 텍스트만 | **이모지 포함** |

### FAQ 9개 카테고리별 맞춤 교체 (131종)
- 부동산세: 실제 세금과 같나요? / 조정대상지역 반영? / 절세 방법
- 소득세: 적용 세율? / 소득공제vs세액공제? / 신고 기한
- 급여: 4대보험 적용? / 비과세 급여? / 실제와 다른 이유
- 투자: 세금 반영? / 과세 기준?
- 대출: 유리한 상환방식? / 변동vs고정금리?
- 생활/건강: 의학적 정확도? / 남녀 기준?
- 연말정산: 최대 환급? / 시기?
- 상속/증여: 면제한도? / 증여vs상속 유리?
- 부동산: 실제와 같나요? / 거래 시 확인사항

### 회원가입 유도 CTA 2종 추가
- CalcEngine 결과 하단: "📊 계산 결과를 저장하고 비교해보세요" + [3초 가입]
- 페이지 하단 CalcSignupCTA: "카더라에서 더 많은 기능을" + [카카오 3초 가입] + [전체보기]
- data-nudge="context-cta"로 GuestNudge와 중복 방지
- 총 7개 접점: 헤더, GuestNudge(일차), SignupNudge(탐색), 결과CTA, 하단CTA, PromoSheet, PopupAd

### 인프라 최종 현황
| 항목 | 수량 |
|------|------|
| 블로그 | 59,388편 |
| 계산기 | 142종 (SEO 만점) |
| 커뮤니티 게시글 | 5,055 |
| 댓글 | 3,689 |
| 실유저 | 37 |
| 주식 종목 | 1,844 |
| 분양현장 | 2,701 |
| 분양사이트 | 5,738 |
| 단지백과 | 34,500 |


## 세션 72 보안 전수 수정 — 34파일 102줄 변경

### Phase 1: Critical 보안 (완료)
| # | 항목 | Before | After |
|---|------|--------|-------|
| 1-1 | 무인증 Admin API | 2개 (blog-enrich, verify-households) | **requireAdmin 적용** |
| 1-2 | 하드코딩 토큰 | kd-reparse-2026 (5개 API) | **완전 제거 (0건)** |
| 1-3 | RLS 미적용 | 5개 테이블 | **136/136 (100%)** |
| 1-4 | is_admin 미확인 | 14개 admin API | **49/54 보호 (나머지 5 CRON_SECRET)** |
| 1-5 | sanitizeHtml | regex 기반 | **img/svg/주석 패턴 추가 강화** |

### Phase 2: High 우선순위 (완료)
| # | 항목 | Before | After |
|---|------|--------|-------|
| 2-1 | sanitize 미적용 | 10개 API | **타입강제+sanitizeText+sanitizeId** |
| 2-2 | rate limit 없음 | blog/bookmark, blog/helpful | **rateLimit 적용** |
| 2-3 | maxDuration 없음 | naver-complex-sync 504 | **120초 설정** |
| 2-5 | 중복 크론 | 99개 (2개 중복) | **97개 (중복 제거)** |
| 2-7 | error.message 노출 | 3개 API | **일반 메시지로 교체** |

### 추가 개선 (선조치)
- 프로필 페이지: is_admin, is_banned, is_seed 필드 노출 제거
- popup-ads: 복잡한 인증 로직 → requireAdmin 단일화
