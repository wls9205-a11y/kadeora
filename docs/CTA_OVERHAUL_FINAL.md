# CTA 전면 개편 최종 설계안

> Session 108 | 2026-04-15 | 배포 전까지 `cta/feature-gate-overhaul` 브랜치에서 작업

---

## 1. 현재 상태 (데이터 기반)

| 지표 | 7일 값 | 판정 |
|------|--------|------|
| UV | 11,450 | 트래픽 O |
| CTA view 이벤트 | **0** | 트래킹 사실상 미작동 |
| Gate view 이벤트 | **0** | 동일 |
| 가입 시도 | 122 | |
| 가입 성공 | 27 | CVR 0.24% |

### 가입 소스 30일 분석
| 소스 | 가입 수 | 비고 |
|------|---------|------|
| NULL (출처 불명) | 60 (64%) | 스스로 /login 찾음 |
| apt_alert_cta | 13 | **1위 — 기능 게이팅 패턴** |
| action_bar | 9 | 2위 — 하단 플로팅 바 |
| content_gate (SmartSectionGate) | **1** | 메인 전환 장치인데 1건 |
| content_lock | 1 | |

### 핵심 인사이트
- SmartSectionGate(콘텐츠 60% 차단)는 30일 1건 전환 → **역효과**
- apt_alert_cta(기능 잠금 패턴)가 13건 → **이 패턴을 전체로 확장**
- ActionBar가 SmartSectionGate 보일 때 숨겨짐 → 가장 필요한 순간에 부재

---

## 2. 전략: 콘텐츠 게이팅 → 기능 게이팅

**한 줄**: 콘텐츠 100% 공개 + "써보고 싶은 기능" 앞에서 카카오 가입 유도

---

## 3. 핵심 발견: LoginGate 이미 존재

`src/components/LoginGate.tsx` — 블러 처리 + 카카오 버튼 + trackCTA + source 귀속까지 완비.
현재 `/apt/[id]` (apt_analysis)와 `/stock/[symbol]` (ai_analysis)에서 사용 중.

**새 FeatureGate 컴포넌트를 만들지 않고 LoginGate를 확장한다.**

### LoginGate 확장 내용
1. 디자인 업데이트: "회원 전용" 뱃지 + 카카오 48px 네이티브 버튼 + "다른 방법으로 가입하기" 링크
2. DEFAULTS 맵에 새 feature 추가 (blog_compare, apt_trade_alert, redev_stage, calc_save 등)
3. 카카오 버튼 텍스트: "카카오톡으로 3초 만에 가입하기"
4. 블러 오버레이 텍스트: "가입하면 바로 확인할 수 있어요" (친근한 톤)

---

## 4. OAuth 소스 귀속 검증 결과 ✅

전체 플로우 확인 완료:
1. LoginGate 클릭 → `/login?redirect=...&source=login_gate_xxx`
2. LoginClient.tsx:31 → `redirectTo: .../auth/callback?redirect=...&source=${source}`
3. callback/route.ts:30 → `source = searchParams.get('source')`
4. callback/route.ts:40 → `profiles.signup_source = source`
5. signup_attempts에도 source 기록

**Gap 1 (OAuth 귀속 끊김) → 해당 없음. 정상 작동.**

---

## 5. 제거 대상 (5개 컴포넌트)

| Component | 사용처 수 | 30d 전환 | 제거 방법 |
|-----------|----------|---------|----------|
| SmartSectionGate | 9 | 1 | import/사용만 제거, 파일 보존 |
| BlogMidCTA | 4 | 0 | 동일 |
| ContentLock | 4 | 1 | 동일 |
| SignupCTA | 2 | 0 | 동일 |
| CalcSignupCTA | 2 | 0 | LoginGate로 교체 |

---

## 6. 수정 대상 (2개 컴포넌트)

### 6.1 LoginGate.tsx — 확장
- "회원 전용" 뱃지 추가
- 카카오 버튼 → 48px / #FEE500 / 아이콘 왼쪽 고정 / 텍스트 중앙
- "다른 방법으로 가입하기" 링크 추가
- DEFAULTS 맵 확장:

```typescript
const DEFAULTS: Record<string, { title: string; desc: string }> = {
  // 기존
  ai_analysis: { title: 'AI 투자 분석 보기', desc: '...' },
  apt_analysis: { title: '단지 종합 분석 보기', desc: '...' },
  // 추가
  blog_compare: { title: '주변 단지 시세 비교', desc: '이 단지와 주변 단지 실거래가를 한눈에' },
  blog_calc: { title: '내 가점 당첨 확률 계산', desc: '무주택 기간, 부양가족, 통장 기간 입력하면 예측' },
  apt_trade_alert: { title: '실거래 변동 알림', desc: '이 단지에 새 거래가 등록되면 바로 알려드려요' },
  apt_sub_alert: { title: '청약 마감 알림', desc: '관심 단지 접수일 전에 미리 알려드려요' },
  apt_ongoing_alert: { title: '분양 조건 변동 알림', desc: '분양가 변경, 할인 소식을 바로 받아요' },
  apt_unsold_alert: { title: '미분양 할인 알림', desc: '관심 지역 미분양 할인·재분양 시 알림' },
  redev_stage: { title: '사업 단계 변경 알림', desc: '관심 구역 단계가 바뀌면 즉시 알려드려요' },
  apt_complex_track: { title: '관심 단지 시세 추적', desc: '여러 단지를 비교하고 시세 변동을 추적' },
  apt_compare_save: { title: '비교 결과 저장', desc: '전세가율, 평당가, 학군까지 비교 후 저장' },
  apt_search_track: { title: '관심 단지 시세 추적', desc: '검색한 단지의 새 거래를 자동 추적' },
  apt_map_alert: { title: '관심 지역 알림', desc: '내 지역에 새 분양·청약·재개발 소식 알림' },
  calc_save: { title: '계산 결과 저장 + 비교', desc: '여러 조건으로 시뮬레이션 후 비교' },
  feed_write: { title: '글쓰기 · 댓글 · 투표', desc: '가입하면 커뮤니티에 참여할 수 있어요' },
};
```

### 6.2 ActionBar.tsx — 수정
- `gateVisible` state 및 IntersectionObserver 로직 제거
- 조건 `if (!visible || dismissed || loading || userId || gateVisible)` → `if (!visible || dismissed || loading || userId)`
- 항상 표시

---

## 7. 신규 컴포넌트 (1개)

### KakaoBottomSheet.tsx
- ☆/관심등록 버튼 클릭 시 페이지 이탈 없이 미니 가입창
- 카카오 네이티브 버튼 + "다른 방법으로 가입하기"
- 이벤트: `trackCTA('view', 'kakao_sheet_${feature}')` / `trackCTA('click', 'kakao_sheet_${feature}')`

---

## 8. 페이지별 적용 맵

### 8.1 블로그 `/blog/[slug]`
**Before**: isBot → full / isLoggedIn → BlogTossGate / else → SmartSectionGate
**After**: isBot → full / isLoggedIn → BlogTossGate / else → full + LoginGate widgets

변경:
- SmartSectionGate → 제거, `dangerouslySetInnerHTML={{ __html: htmlFull }}` 로 교체
- BlogMidCTA → 제거
- 본문 중간(H2 2~3개 이후)에 `<LoginGate feature="blog_compare">` 삽입
- 본문 끝에 3버튼(알림/관심/PDF) + LoginGate 추가
- BlogAptAlertCTA → **유지** (1위 전환소스)
- BlogTossGate → **유지** (로그인 유저 전용)
- BlogFloatingBar → **유지** (공유)
- BlogCommentCTA → **유지** (참여 유도)

### 8.2 부동산 메인 탭 `/apt`
각 탭(sub/ongoing/unsold/redev/trade) 카드 리스트 아래에 LoginGate 1개씩:

| 탭 | feature | 위젯 내용 |
|---|---|---|
| 청약 | apt_sub_alert | 마감 D-day 알림 |
| 분양중 | apt_ongoing_alert | 분양 조건 변동 알림 |
| 미분양 | apt_unsold_alert | 할인 · 재분양 알림 |
| 재개발 | redev_stage | 사업 단계 변경 알림 |
| 실거래 | apt_trade_alert | 관심 단지 새 거래 알림 |

### 8.3 단지백과 `/apt/complex`
카드 리스트 하단에 `<LoginGate feature="apt_complex_track">` 삽입

### 8.4 부동산 상세 페이지들
| 페이지 | feature | 비고 |
|--------|---------|------|
| /apt/[id] | apt_analysis | **이미 적용됨 (유지)** |
| /apt/complex/[name] | apt_trade_alert | 시세 추적 |
| /apt/sites/[slug] | apt_sub_alert | 청약 알림 |
| /apt/diagnose | calc_save | 가점 저장 + 매칭 |
| /apt/compare/[slugs] | apt_compare_save | 비교 저장 |
| /apt/search | apt_search_track | 시세 추적 |
| /apt/redev | redev_stage | 단계 알림 |
| /apt/map | apt_map_alert | 지역 알림 |

### 8.5 주식 `/stock/[symbol]`
- AI 분석 → **이미 적용됨 (유지, LoginGate feature="ai_analysis")**

### 8.6 계산기 `/calc/[category]/[slug]`
- CalcSignupCTA → LoginGate feature="calc_save" 로 교체

### 8.7 피드 `/feed`
- 글쓰기/댓글/투표 영역에 `<LoginGate feature="feed_write">` 삽입

### 8.8 홈 `/`
- KakaoHeroCTA → **유지** (홈페이지 전용 CTA, 별도 디자인)

---

## 9. ☆ 버튼 + KakaoBottomSheet 연동

기존 각 탭의 ☆(관심등록) 버튼 → 현재는 `/apt/[id]#interest-section`으로 이동.
변경: 비로그인 시 `KakaoBottomSheet` 표시. 로그인 시 기존 동작 유지.

적용 대상: SubscriptionTab, OngoingTab, UnsoldTab, RedevTab의 ☆ 버튼

---

## 10. 어드민 대시보드 변경

### 10.1 Admin v2 API — 새 쿼리 6개
1. **FG 소스별 성과**: `conversion_events` WHERE `cta_name LIKE 'login_gate_%'` GROUP BY cta_name
2. **페이지별 전환 맵**: `signup_attempts` GROUP BY redirect_path prefix
3. **카카오 vs 기타 비율**: `profiles` WHERE recent, GROUP BY provider
4. **ActionBar 성과**: `conversion_events` WHERE cta_name = 'action_bar'
5. **KakaoSheet 퍼널**: `conversion_events` WHERE cta_name LIKE 'kakao_sheet_%'
6. **Before/After 비교**: 배포일 기준 전후 7일 CVR 비교

### 10.2 FocusTab 변경
- 벤치마크 `ctr`(CTA CTR) → `fgCtr`(FG CTR): LoginGate 전체 클릭/뷰 비율
- 벤치마크 `gate`(게이트) → `kakaoRatio`(카카오 비율): 카카오/전체 가입 비율
- 가입경로 라벨 추가: `login_gate_*`, `kakao_sheet_*`, `action_bar_*`
- 새 섹션: FeatureGate 소스별 성과 바 차트
- 새 섹션: 카카오 vs 기타 비율 카드

### 10.3 GrowthTab 변경
- 전환 핵심 지표: content_gate/blog_inline → FG CTR / ActionBar CTR
- 전환 퍼널: PV → UV → **FG 노출** → **FG 클릭** → 가입 (2단계 추가)
- 새 섹션: 페이지별 전환 맵 (/blog/*, /apt/*, /stock/*, /calc/*, /feed)
- 새 섹션: FeatureGate 유형별 CTR 비교 (시세비교 vs 당첨확률 vs 알림 등)

---

## 11. 리스크 분석

| 리스크 | 영향도 | 대응 |
|--------|--------|------|
| SEO 영향 | **긍정적** | 전체 콘텐츠 공개 → 이탈↓ 체류↑ |
| BlogTossGate | 없음 | 별도 코드 경로, 건드리지 않음 |
| ActionBar 겹침 | 낮음 | BlogFloatingBar(상단) vs ActionBar(하단) 위치 다름 |
| 전환 하락 | 극저 | 현재 Gate 1명/월 → 하락 불가 |
| 잠금 기능 실제 동작 여부 | **중간** | 가입 후 블러 해제 시 기능이 작동해야 함 → 각 feature 별 검증 필요 |
| 트래킹 연속성 | 중간 | 기존 이벤트 0이므로 데이터 단절 영향 없음, 새 이벤트로 깨끗하게 시작 |
| 봇 노출 증가 | 없음 | isBot 분기에서 이미 전체 노출 중 |

---

## 12. 구현 순서

### Phase 1: Core (블로그 critical path)
1. LoginGate.tsx 디자인 확장
2. KakaoBottomSheet.tsx 신규 생성
3. ActionBar.tsx gateVisible 제거
4. blog/[slug]/page.tsx — SmartSectionGate/BlogMidCTA 제거 + LoginGate 삽입
5. admin/v2/route.ts — FG 쿼리 추가
6. FocusTab.tsx — 벤치마크 교체 + 새 섹션

### Phase 2: Apt (부동산 전체)
7. AptClient.tsx / 6개 탭 파일 — LoginGate 삽입
8. apt 상세 페이지 8개 — LoginGate 삽입
9. ☆ 버튼 → KakaoBottomSheet 연동

### Phase 3: 나머지 + 어드민 완성
10. calc/[category]/[slug] — CalcSignupCTA → LoginGate 교체
11. feed 페이지 — LoginGate 삽입
12. GrowthTab.tsx — 전환지표 교체 + 새 섹션 2개
13. 배포 후 before/after CVR 비교 검증

---

## 13. 예상 성과

| 지표 | 현재 | 목표 | 근거 |
|------|------|------|------|
| CVR | 0.24% | 0.5~1% | apt_alert_cta 패턴 13x 확장 |
| 이탈률 | ~97.5% | -30% | 콘텐츠 전체 공개 |
| 체류시간 | 낮음 | +40% | 게이트 제거 → 끝까지 읽음 |

---

## 14. 파일 변경 전체 목록

| 작업 | 파일 | 변경 내용 |
|------|------|----------|
| 확장 | LoginGate.tsx | 디자인 + DEFAULTS + 카카오 버튼 |
| 신규 | KakaoBottomSheet.tsx | ☆ 버튼 미니 가입창 |
| 수정 | ActionBar.tsx | gateVisible 제거 |
| 수정 | blog/[slug]/page.tsx | SSG→LoginGate 전환 |
| 수정 | AptClient.tsx | 탭 하단 LoginGate |
| 수정 | SubscriptionTab.tsx | LoginGate + ☆→sheet |
| 수정 | OngoingTab.tsx | 동일 |
| 수정 | UnsoldTab.tsx | 동일 |
| 수정 | RedevTab.tsx | 동일 |
| 수정 | TransactionTab.tsx | 동일 |
| 수정 | ComplexClient.tsx | LoginGate 삽입 |
| 수정 | apt/complex/[name]/page.tsx | LoginGate 삽입 |
| 수정 | apt/sites/[slug] 등 6개 | LoginGate 삽입 |
| 교체 | calc/[category]/[slug]/page.tsx | CalcSignupCTA → LoginGate |
| 수정 | feed 관련 | LoginGate 삽입 |
| 수정 | admin/v2/route.ts | 쿼리 6개 추가 |
| 수정 | FocusTab.tsx | 벤치마크 + 새 섹션 |
| 수정 | GrowthTab.tsx | 전환지표 + 새 섹션 2개 |
| 검증 | auth/callback/route.ts | source 귀속 동작 확인 (변경 없음) |

총: 신규 1 + 확장 1 + 수정 ~18 = **약 20개 파일**
