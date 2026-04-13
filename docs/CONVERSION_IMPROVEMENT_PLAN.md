# 카더라 회원가입 전환 개선 설계안
> 작성: 2026-04-13 · 데이터 기준: 7일(04-07~04-13) · 전수 코드 감사 완료

---

## 1. 현황 요약

| 지표 | 값 | 비고 |
|------|-----|------|
| 총 유저 | 88명 | is_seed=false |
| 7일 CTA 노출 | 5,403회 | 1,576 유니크 |
| 7일 CTA 클릭 | 27회 | **CTR 0.5%** |
| 7일 가입 완료 | 22명 | 클릭→가입 81% |
| 일평균 가입 | 3~5명 | 4/10 스파이크 25명 제외 |
| 트래픽 집중 | 70% | 레이카운티 포스트 1개 |

**핵심 병목**: CTA 노출 → 클릭 전환율 0.5%. 클릭 이후 OAuth 플로우는 정상(81% 완료).

---

## 2. 발견된 버그 (6건)

### BUG-1: SmartSectionGate source 오염 🔴 CRITICAL
- **파일**: `src/components/SmartSectionGate.tsx:62`
- **현상**: `source=apt_alert_cta` 하드코딩 → `source=content_gate`여야 함
- **영향**: signup_attempts 테이블에서 content_gate 가입이 apt_alert_cta로 기록됨. 어드민 GrowthTab의 "apt_alert_cta CTR" 지표가 content_gate 데이터와 혼합되어 오염됨
- **수정**: `source=apt_alert_cta` → `source=content_gate`

### BUG-2: page_path 65% null 🟠 HIGH
- **파일**: `src/lib/analytics.ts:198` (trackCTA 함수)
- **현상**: content_gate CTA view 중 1,632/2,516(65%)가 page_path=null
- **원인 추정**: sendBeacon이 Next.js App Router 클라이언트 hydration 타이밍에 따라 window.location.pathname이 아직 업데이트되지 않은 상태에서 실행
- **수정**: SmartSectionGate에서 `usePathname()` 값을 trackCTA에 명시적 전달
```tsx
// 변경 전
trackCTA('view', 'content_gate');
// 변경 후
trackCTA('view', 'content_gate', { page_path: pathname });
```
- trackCTA 함수에서 `properties?.page_path || window.location.pathname` 사용하도록 수정

### BUG-3: LoginClient MSG 매핑 불일치 🟠 HIGH
- **파일**: `src/app/(auth)/login/LoginClient.tsx`
- **현상**: 30+ 개 source 값 중 MSG 맵에 매핑된 건 7개뿐. 나머지(apt_alert_cta, action_bar, blog_comment, content_lock 등)는 generic "소셜 계정으로 간편하게 시작하세요" 표시
- **특히 심각**: BUG-1로 인해 SmartSectionGate의 가장 많은 source `apt_alert_cta`가 MSG 맵에 없어 generic 메시지 표시
- **매핑 없는 주요 source 목록**:
  - `apt_alert_cta` (SmartSectionGate BUG) → 가장 많은 트래픽
  - `action_bar` → 2번째 트래픽
  - `content_lock` → apt 페이지
  - `login_gate_ai_analysis` / `login_gate_apt_analysis` → 주식/apt
  - `blog_comment` / `apt_comment` / `stock_comment` → 댓글
  - `blog_bookmark` / `apt_bookmark` → 북마크
  - `calc_gate` / `calc_cta` / `calc_engine` → 계산기

### BUG-4: LoginClient 하드코딩 "7,600+" 🟡 MEDIUM
- **파일**: `src/app/(auth)/login/LoginClient.tsx`
- **현상**: `content_gate` MSG에 "7,600+ 분석 전문" 하드코딩 → 블로그 수 증가해도 업데이트 안 됨
- **현재 실제값**: social-proof API 기준 blogCount ~7,623
- **수정**: social-proof API에서 동적 조회하거나 revalidate된 서버 컴포넌트에서 전달

### BUG-5: KakaoHeroCTA view 미추적 🟡 MEDIUM
- **파일**: `src/components/KakaoHeroCTA.tsx`
- **현상**: `trackCTA('click', 'kakao_hero')` 만 있고 view 추적 없음
- **영향**: 홈페이지 CTA 노출 대비 클릭률 계산 불가
- **수정**: useEffect에 `trackCTA('view', 'kakao_hero')` 추가

### BUG-6: ContentLock 추적 전무 🟡 MEDIUM
- **파일**: `src/components/ContentLock.tsx`
- **현상**: trackCTA/trackConversion 임포트도 없음. apt 페이지에서 2곳 사용 중
  - `/apt/[id]`: 실입주 비용 시뮬레이터
  - `/apt/[id]`: 한줄평
- **영향**: apt 페이지 전환 퍼널 분석 불가

---

## 3. 데드코드 & 유령 트래킹 (10건)

conversion_events 테이블에 이벤트가 기록되지만 소스 코드에서 삭제된 CTA 컴포넌트:

| CTA name | 7일 view | 7일 click | 마지막 발생 | 상태 |
|----------|---------|----------|------------|------|
| inline_cta | 536 | 3 | 04-09 | 코드 삭제됨 |
| sticky_bar | 385 | 2 | 04-09 | 코드 삭제됨 |
| blog_mid_cta | 281 | 2 | 04-12 | import만 존재, 렌더링 안 됨 |
| guest_nudge_toast | 53 | 0 | 04-07 | 코드 삭제됨 |
| topbar_cta | 36 | 0 | 04-09 | 코드 삭제됨 |
| guest_nudge_banner | 8 | 0 | 04-07 | 코드 삭제됨 |
| return_banner | 5 | 0 | 04-07 | 코드 삭제됨 |
| scroll_toast | 2 | 0 | 04-09 | 코드 삭제됨 |
| guest_nudge_modal | 2 | 0 | 04-07 | 코드 삭제됨 |
| two_step_dismiss | 0 | 1 | 04-06 | 코드 삭제됨 |

**원인**: 이전 배포의 Vercel Edge 캐시 또는 브라우저 캐시가 이전 코드를 계속 실행
**조치**: 데이터는 자연 소멸. 어드민에서 ghost CTA 필터링 필요

---

## 4. 트래킹 누락 컴포넌트 (5건)

| 컴포넌트 | 파일 | 위치 | source 값 | view 추적 | click 추적 |
|---------|------|------|----------|----------|-----------|
| ContentLock | ContentLock.tsx | /apt/[id] | content_lock | ❌ | ❌ |
| SignupCTA (CalcSignupCTA) | calc/CalcSignupCTA.tsx | /calc/[cat]/[slug] | calc_cta | ❌ | ❌ |
| RelatedContentCard | RelatedContentCard.tsx | /blog/[slug] | related_card | ❌ | ❌ |
| RightPanel | RightPanel.tsx | 전 페이지 사이드바 | right_panel | ❌ | ❌ |
| Sidebar | Sidebar.tsx | 전 페이지 사이드바 | sidebar | ❌ | ❌ |

**영향**: apt 페이지, 계산기 페이지, 사이드바의 전환 퍼널이 완전히 블라인드 스팟

---

## 5. trackCTA vs trackConversion 이중 시스템

| 함수 | 사용 컴포넌트 | DB 대상 | 차이점 |
|------|-------------|---------|-------|
| trackCTA (analytics.ts) | SmartSectionGate, ActionBar, BlogAptAlertCTA, KakaoHeroCTA | conversion_events + GA4 | `getVisitorId()` 사용 |
| trackConversion (track-conversion.ts) | LoginGate, BlogMidCTA, NewsletterSubscribe | conversion_events + GA4 | `localStorage.getItem('kd_visitor_id')` 직접 |

**문제**: 두 함수가 동일 테이블에 기록하지만 visitor_id 생성 방식이 다름. trackConversion은 `getVisitorId()` 미사용 → 초기 방문에서 visitor_id null 가능
**조치**: trackConversion을 trackCTA로 통합하거나, 동일한 `getVisitorId()` 사용

---

## 6. 하드코딩 전수 조사

### 소셜프루프 숫자
| 위치 | 현재값 | 동적 여부 | 수정 필요 |
|------|-------|----------|---------|
| SmartSectionGate default | userCount=80 | 블로그 페이지에서 동적 전달 ✅ | ✅ 기본값 업데이트 (현재 88) |
| BlogMidCTA default | userCount=80 | 렌더링 안 됨 | ⚪ 불필요 (데드코드) |
| LoginClient MSG | "7,600+" | ❌ 하드코딩 | ✅ 동적 전환 필요 |
| social-proof API fallback | userCount: 80 | ❌ 하드코딩 | ✅ 88+ 업데이트 |

### 문자열 하드코딩
| 위치 | 내용 | 문제 |
|------|------|------|
| SmartSectionGate CATEGORY_BENEFITS | 카테고리별 혜택 텍스트 4세트 | 변경 시 배포 필요 |
| ActionBar | "청약·주식 알림 무료로 받기" | 모든 페이지 동일 메시지 |
| BlogAptAlertCTA | "실거래 등록 시 바로 알려드려요 · 무료" | 단지명만 동적, 나머지 고정 |

---

## 7. CTA별 상세 성과 분석

### 현재 활성 CTA (코드 존재 + 렌더링 중)
| CTA | 위치 | 7일 view | 7일 click | CTR | source 정확성 |
|-----|------|---------|----------|-----|-------------|
| content_gate | 블로그 본문 68% | 2,516 | 16 | 0.64% | ❌ BUG-1 |
| action_bar_kakao | 전 페이지 하단 | 1,057 | 3 | 0.28% | ✅ |
| apt_alert_cta | 블로그 apt 본문 하단 | 164 | 0 | 0% | ✅ |
| login_gate_apt_analysis | apt 상세 | 332 | 0 | 0% | ✅ |
| login_gate_ai_analysis | 주식 상세 | 14 | 0 | 0% | ✅ |

### 잠재 CTA (코드 존재 + 렌더링 중 + 트래킹 없음)
| CTA | 위치 | 추정 노출 | 트래킹 |
|-----|------|----------|-------|
| ContentLock | apt 상세 2곳 | 높음 (apt PV 기준) | ❌ |
| RightPanel 가입 | 전 페이지 | 높음 | ❌ |
| Sidebar 가입 | 전 페이지 | 중간 | ❌ |
| CalcSignupCTA | 계산기 | 낮음 | ❌ |

---

## 8. 개선 설계안

### Phase 0: 버그 수정 & 데이터 정확도 복구 (Day 1)

#### 0-1. SmartSectionGate source 수정
```
파일: src/components/SmartSectionGate.tsx:62
변경: source=apt_alert_cta → source=content_gate
```

#### 0-2. page_path null 수정
```
파일: src/lib/analytics.ts (trackCTA 함수)
변경: page_path를 properties에서 우선 사용
  page_path: properties?.page_path || window.location.pathname,

파일: src/components/SmartSectionGate.tsx:52
변경: trackCTA('view', 'content_gate', { page_path: pathname });
```

#### 0-3. LoginClient MSG 매핑 확장
```
파일: src/app/(auth)/login/LoginClient.tsx
추가 매핑:
  apt_alert_cta → "가입하면 이 단지의 분양·가격 정보를 무료로 볼 수 있어요"
  action_bar → "가입하면 청약·주식 알림을 무료로 받을 수 있어요"
  content_lock → "가입하면 실입주 비용 계산을 무료로 이용할 수 있어요"
  login_gate_ai_analysis → "가입하면 AI 투자 분석을 무료로 볼 수 있어요"
  login_gate_apt_analysis → "가입하면 이 단지의 종합 분석을 무료로 볼 수 있어요"
  blog_comment / apt_comment / stock_comment → "가입하면 댓글을 달 수 있어요"
  blog_bookmark / apt_bookmark → "가입하면 북마크 저장을 할 수 있어요"
  calc_gate / calc_cta / calc_engine → "가입하면 계산기를 무료로 이용할 수 있어요"
  related_card → "가입하면 관련 분석을 더 볼 수 있어요"
```

#### 0-4. 소셜프루프 하드코딩 업데이트
```
SmartSectionGate default: 80 → 현재 실제값 사용 (이미 동적 전달 중이므로 default만 업데이트)
social-proof API fallback: 80 → 90
LoginClient "7,600+": blog_posts count 동적 조회 또는 revalidate
```

#### 0-5. 누락 트래킹 추가
```
ContentLock.tsx: trackCTA('view'/'click', 'content_lock') 추가
KakaoHeroCTA.tsx: trackCTA('view', 'kakao_hero') 추가
CalcSignupCTA.tsx: trackCTA('view'/'click', 'calc_cta') 추가
RightPanel.tsx: trackCTA('view', 'right_panel') 추가 (로그인 링크 노출 시)
```

#### 0-6. trackConversion → trackCTA 통합
```
LoginGate.tsx: trackConversion → trackCTA 교체
BlogMidCTA.tsx: 데드코드이므로 삭제 또는 방치
```

### Phase 1: CTA CTR 개선 (0.5% → 3~5% 목표)

#### 1-1. SmartSectionGate 컷포인트 전략 변경
**현재**: 콘텐츠 68%에서 게이팅
**변경**: 첫 H2 직후 (약 20~35%)
```tsx
// 변경 전
const cutPoint = Math.floor(htmlContent.length * 0.68);

// 변경 후 — 첫 H2 직후, 최소 300자, 최대 50%
const firstH2 = htmlContent.match(/<h2[^>]*>/i);
let cutPoint: number;
if (firstH2?.index && firstH2.index > 300) {
  cutPoint = Math.min(firstH2.index, Math.floor(htmlContent.length * 0.5));
} else {
  cutPoint = Math.floor(htmlContent.length * 0.30);
}
```
**근거**: 검색 유입 유저는 제목과 도입부를 읽고 핵심 정보를 확인한 뒤 이탈. 68%면 이미 답을 얻은 후. 첫 H2 직후로 당기면 "핵심 분석이 더 있다"는 FOMO 생성

#### 1-2. 게이트 카드 "Preview Hook" 리디자인
**현재**: "전체 분석 + 맞춤 알림을 무료로 받을 수 있어요" (추상적)
**변경**: 게이트 뒤 H2/H3 heading을 자동 추출해서 "남은 내용" 미리보기 표시
```tsx
// 게이트 뒤 콘텐츠에서 heading 추출
const remainingHtml = htmlContent.slice(actualCut);
const headings = [...remainingHtml.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gi)]
  .map(m => m[1].replace(/<[^>]+>/g, '').trim())
  .filter(h => h.length > 0)
  .slice(0, 3);

// 게이트 카드에 표시
{headings.length > 0 && (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>
      📊 이 글의 남은 분석 내용
    </div>
    {headings.map((h, i) => (
      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#e2e8f0', padding: '3px 0' }}>
        <span style={{ color: '#FEE500' }}>✦</span> {h}
      </div>
    ))}
  </div>
)}
```
**근거**: "알림 받기"보다 "컷라인 분석, 경쟁률 예측이 남았어요"가 구체적 FOMO 생성

#### 1-3. ActionBar 컨텍스트 매칭
**현재**: 모든 페이지 동일 "청약·주식 알림 무료로 받기"
**변경**: 페이지 카테고리 + 콘텐츠에 맞는 동적 메시지
```tsx
// ActionBar에 category prop 추가 (layout에서 전달)
// 또는 pathname에서 자동 감지
const getMessage = (path: string) => {
  if (path.startsWith('/blog/')) {
    // blog post 제목을 가져올 수 없으므로 카테고리 기반
    return '이 분석 전체 보기 · 무료 가입';
  }
  if (path.startsWith('/apt/')) return '이 단지 가격 변동 알림 받기';
  if (path.startsWith('/stock/')) return '이 종목 급등락 알림 받기';
  if (path.startsWith('/calc/')) return '계산 결과 저장하기';
  return '청약·주식 알림 무료로 받기';
};
```

#### 1-4. CTA 중복 제거 — 단계적 노출
**현재**: 비로그인 유저가 블로그에서 동시에 보는 CTA 4개
  1. SmartSectionGate (본문 30-68%)
  2. ActionBar (하단 고정, 3초 후)
  3. BlogAptAlertCTA (본문 하단)
  4. 댓글 로그인 유도

**변경**:
```
1. SmartSectionGate가 보이면 ActionBar 숨김
   → SmartSectionGate가 viewport에 있는 동안 ActionBar display:none
   → IntersectionObserver로 게이트가 화면에서 벗어나면 ActionBar 표시

2. BlogAptAlertCTA를 SmartSectionGate 안으로 통합
   → 게이트 카드의 혜택 bullet에 "🔔 {단지명} 가격 변동 알림" 추가
   → 별도 컴포넌트 제거 (게이트 뒤에 있어서 비로그인 유저는 어차피 안 보임)

3. 댓글 로그인 유도는 자연스러운 위치이므로 유지
```

### Phase 2: 가입 퍼널 마찰 제거

#### 2-1. 로그인 페이지에 redirect 콘텐츠 제목 표시
```tsx
// LoginClient에서 redirect path의 slug로 제목 조회
useEffect(() => {
  if (redirect.startsWith('/blog/')) {
    const slug = redirect.replace('/blog/', '');
    fetch(`/api/blog/title?slug=${slug}`)
      .then(r => r.json())
      .then(d => setContentTitle(d.title));
  }
}, [redirect]);

// 표시: "레이카운티 무순위 청약 총정리 — 남은 분석을 이어서 보세요"
```
**필요 API**: `/api/blog/title?slug=xxx` → blog_posts에서 title만 반환 (간단)

#### 2-2. 가입 직후 확인 토스트
```tsx
// auth/callback/route.ts에서 리다이렉트 시 파라미터 추가
if (isNewUser && isCTA) {
  return NextResponse.redirect(`${origin}${safeRedirect}?welcome=1`);
}

// 블로그 페이지에서 welcome=1 감지 시 토스트 표시
{searchParams.welcome === '1' && (
  <div style={{...}}>🎉 가입 완료! 전체 분석이 해제됐어요</div>
)}
```

#### 2-3. OAuth 이탈 방어
```tsx
// LoginClient 카카오 버튼 클릭 시 로딩 오버레이
const login = async (provider) => {
  setLoading(provider);
  // 안내 텍스트 변경
  // "카카오톡 앱으로 이동합니다. 완료되면 자동으로 돌아옵니다"
};
```

### Phase 3: 어드민 대시보드 개선

#### 3-1. GrowthTab 전환 퍼널 시각화 추가
현재 GrowthTab에 있는 것: content_gate CTR, apt_alert_cta CTR, 온보딩 완료율
**추가 필요**:

```
┌─────────────────────────────────────────────────┐
│ 🎯 전환 퍼널 (7일)                                │
│                                                   │
│ UV 1,576 → CTA View 5,403 → Click 27 → 가입 22  │
│         (3.4x)     (0.5%)        (81%)            │
│                                                   │
│ CTA별 CTR                                         │
│ content_gate  ████████░░ 0.64%  2,516뷰 16클릭    │
│ action_bar    ████░░░░░░ 0.28%  1,057뷰  3클릭    │
│ login_gate    ░░░░░░░░░░ 0.00%    346뷰  0클릭    │
│ apt_alert     ░░░░░░░░░░ 0.00%    164뷰  0클릭    │
│                                                   │
│ Source별 가입 귀속 (14일)                           │
│ apt_alert_cta  ████████ 13건 (실제 content_gate)   │
│ action_bar     █████ 6건                           │
│ content_gate   █ 1건 (과소계상, BUG-1)              │
│ content_lock   █ 1건                               │
│ direct         █ 1건                               │
└─────────────────────────────────────────────────┘
```

#### 3-2. 실시간 전환 모니터 (FocusTab 확장)
```
현재 FocusTab: HealthScore + KPI + 크론 + 데이터 신선도
추가:
- 오늘 CTA 클릭 수 (실시간)
- 오늘 가입 시도 vs 완료 (실시간)
- 마지막 가입자 정보 (이름, 소스, 시간)
- 페이지별 게이트 도달률 (스크롤 depth 기반 — 추후)
```

#### 3-3. 전환 A/B 테스트 인프라 (어드민에서 설정)
```tsx
// feature_flags 테이블 활용
// 어드민에서 설정 가능한 항목:
{
  gate_cutpoint: 0.30,         // 게이트 컷포인트 (0.20 ~ 0.68)
  gate_show_preview: true,     // Preview Hook 표시 여부
  actionbar_delay_ms: 3000,    // ActionBar 등장 딜레이
  actionbar_contextual: true,  // 컨텍스트 매칭 ON/OFF
  cta_dedup: true,             // CTA 중복 제거 ON/OFF
}
```

#### 3-4. Ghost CTA 필터링
```
GrowthTab ctaStats에서 현재 활성 CTA만 표시:
const ACTIVE_CTAS = ['content_gate', 'action_bar_kakao', 'apt_alert_cta', 
  'login_gate_apt_analysis', 'login_gate_ai_analysis', 'content_lock',
  'kakao_hero', 'right_panel', 'sidebar', 'calc_cta'];

// 삭제된 CTA 이벤트는 "유령" 라벨로 별도 표시
```

---

## 9. conversion_events 테이블 스키마 확장

현재 컬럼: id, event_type, cta_name, category, page_path, visitor_id, created_at

### 추가 필요 컬럼:
```sql
ALTER TABLE conversion_events ADD COLUMN IF NOT EXISTS
  scroll_depth smallint,       -- 게이트 도달 시 스크롤 % (0-100)
  time_on_page integer,        -- 페이지 진입~CTA view 까지 초
  gate_position smallint,      -- 게이트가 콘텐츠의 몇 %에 위치
  device_type text,            -- 'mobile' | 'desktop' | 'tablet'
  referrer_source text;        -- 'google' | 'naver' | 'direct' 등
```

### 용도:
- scroll_depth: "어떤 유저가 게이트까지 스크롤하는가" 분석
- time_on_page: "빠르게 이탈하는 유저 vs 읽고 이탈하는 유저" 구분
- gate_position: 컷포인트 A/B 테스트 결과 비교
- device_type: 모바일 vs 데스크탑 전환율 비교
- referrer_source: 검색 유입 vs 직접 유입 전환율 비교

---

## 10. 리스크 분석

### 컷포인트 변경 리스크
| 리스크 | 확률 | 영향 | 대응 |
|-------|------|------|------|
| 너무 일찍 끊으면 콘텐츠 가치 전달 실패 → CTR 오히려 감소 | 중 | 중 | 최소 300자 + 첫 H2 이후 보장. feature_flag로 즉시 롤백 |
| SEO 영향: 봇은 전체 콘텐츠를 보지만, 유저 행동 시그널(체류시간) 감소 | 낮 | 중 | 봇은 이미 isBot 분기로 전체 노출 중. Schema.org `isAccessibleForFree` 이미 설정 |
| 기존 유저 중 비로그인으로 읽던 유저 불만 | 낮 | 낮 | 이미 68%에서 게이팅 중. 변화폭 크지 않음 |

### CTA 중복 제거 리스크
| 리스크 | 확률 | 영향 | 대응 |
|-------|------|------|------|
| ActionBar 숨김으로 2차 기회 상실 | 중 | 중 | SmartSectionGate가 viewport 밖일 때만 ActionBar 표시 |
| BlogAptAlertCTA 통합으로 알림 등록 감소 | 낮 | 낮 | 비로그인 유저는 어차피 게이트 뒤라 못 봄. 로그인 유저용은 유지 |

### 트래킹 변경 리스크
| 리스크 | 확률 | 영향 | 대응 |
|-------|------|------|------|
| source 변경으로 기존 데이터와 연속성 끊김 | 확정 | 낮 | signup_attempts에 change_date 기록. 어드민에서 기준일 이전/이후 분리 표시 |
| 테이블 스키마 변경으로 기존 쿼리 깨짐 | 낮 | 낮 | ADD COLUMN만 사용, 기존 컬럼 불변 |

### 트래픽 의존도 리스크
| 리스크 | 확률 | 영향 | 대응 |
|-------|------|------|------|
| 레이카운티 포스트 트래픽 급감 → 가입 급감 | 높 | 높 | 유사 키워드 포스트 추가 제작, 내부 링크 강화 |
| 특정 키워드 검색량 계절 변동 | 중 | 중 | 다양한 카테고리의 SEO 포스트 균형 |

---

## 11. 실행 우선순위

| 순서 | 작업 | 파일 수 | 난이도 | 예상 영향 | 소요 |
|------|------|--------|--------|----------|------|
| **0-1** | BUG: source 오염 수정 | 1 | 1줄 | 데이터 정확도 | 1분 |
| **0-2** | BUG: page_path null 수정 | 2 | 소 | 트래킹 정확도 | 10분 |
| **0-3** | LoginClient MSG 확장 | 1 | 소 | 로그인 전환 +10~15% | 15분 |
| **0-4** | 소셜프루프 하드코딩 | 3 | 소 | 신뢰도 | 5분 |
| **0-5** | 누락 트래킹 추가 | 4 | 소 | 분석 커버리지 | 20분 |
| **0-6** | trackConversion 통합 | 1 | 소 | 코드 일관성 | 10분 |
| **1-1** | 컷포인트 30%로 변경 | 1 | 소 | **CTR 2~3x** | 10분 |
| **1-2** | Preview Hook 게이트 | 1 | 중 | **CTR 2~4x** | 30분 |
| **1-3** | ActionBar 컨텍스트 매칭 | 1 | 소 | CTR 2x | 15분 |
| **1-4** | CTA 중복 제거 | 3 | 중 | 배너 블라인드 해소 | 30분 |
| **2-1** | 로그인 컨텍스트 강화 | 2 | 소 | OAuth 완료 +10% | 20분 |
| **2-2** | 가입 후 토스트 | 2 | 소 | 체감 가치 + 리텐션 | 15분 |
| **3-1** | GrowthTab 퍼널 시각화 | 2 | 중 | 운영 인사이트 | 40분 |
| **3-2** | FocusTab 전환 모니터 | 2 | 중 | 실시간 모니터링 | 30분 |
| **3-3** | feature_flag A/B 인프라 | 3 | 대 | 향후 최적화 기반 | 60분 |
| **3-4** | conversion_events 확장 | 2 | 중 | 심층 분석 기반 | 30분 |

---

## 12. 예상 결과

### 단기 (Phase 0+1 완료 후, ~1주)
- CTA CTR: 0.5% → 2~5%
- 일 가입: 3~5명 → 10~20명
- 전체 전환율: 1.4% → 3~5%

### 중기 (Phase 2+3 완료 후, ~2주)
- OAuth 완료율: 26% → 35~40%
- 가입 후 이탈률 감소
- 어드민에서 전환 퍼널 실시간 모니터링 가능
- A/B 테스트로 지속 최적화

### 필수 전제
- 레이카운티 외 트래픽 소스 다변화 (현재 70% 의존)
- SEO 포스트 지속 생산 (현재 blog-rewrite 크론으로 진행 중)
