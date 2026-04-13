# 카더라 전환율 극대화 최종 설계안
> 2026-04-14 · 30+ 커밋 이력 + 7일 데이터 + 전수 코드 감사 기반

---

## 0. 이력 기반 현황 진단

### 지금까지 한 것 (30+회 반복)
| 시기 | 변경 | 결과 |
|------|------|------|
| 초기 | 무료 3글 → 전체 게이팅 | 전환 시작점 |
| v2 | 블러 게이트 → 불투명 게이트 | 시각적 개선 |
| v3 | 게이트 위치: 2번째 H2 직후 | CTA가 게이트 뒤에 숨기는 버그 발견 |
| v4 | CTA 12개 → 2개 통합 (StickyBar+InlineCTA) | 피로 감소 |
| 전면 개편 | 0% CTA 4개 삭제, ActionBar+ContentGate 체제 | 현재 구조 기반 |
| 카카오 통일 | KakaoHeroCTA, ActionBar v2, SmartSectionGate v5 | 노란색 통일 |
| 55%→68% | 컷포인트 올림 ("더 읽힌 후 게이트") | **CTR 개선 없음** |
| 서버주입 CTA | 첫 H2 앞에 파란색 알림 CTA 삽입 | **추적 없음** |
| source 통일 | SmartSectionGate source=apt_alert_cta로 | **분석 불가** |
| Zero-Step | CTA 가입→온보딩 스킵→바로 콘텐츠 | ✅ 마찰 제거 |
| 소셜프루프 동적화 | 21곳 하드코딩 → DB 기반 | ✅ 정확도 |
| 회원가입 플로우 3건 | 쿠키 보호, maybeSingle, 자동온보딩 강화 | ✅ 안정성 |

### 현재 비로그인 블로그 유저가 보는 CTA 스택 (발견 사항)
```
[1] 서버주입 인라인 CTA (파란색 #3b7bf6) ← 첫 H2 앞, 추적 없음
    "카카오로 3초 만에 시작하기"
    source=apt_alert_cta (apt/stock만)

[2] SmartSectionGate (노란색 #FEE500) ← 68% 컷포인트
    "카카오로 무료 가입"
    source=apt_alert_cta (BUG → 의도적이었으나 분석 불가)
    trackCTA: content_gate

[3] ActionBar (노란색 #FEE500) ← 하단 고정, 3초 후
    "카카오 시작"
    source=action_bar
    trackCTA: action_bar_kakao

[4] BlogAptAlertCTA (노란색 #FEE500) ← 게이트 아래 (비로그인 못 봄)
    "무료 가입 후 알림 받기"
    source=apt_alert_cta
    trackCTA: apt_alert_cta
```

**핵심 발견**:
1. **서버주입 CTA [1]은 추적이 전혀 없다** — 클릭해도 conversion_events에 안 찍힘. signup_attempts의 `apt_alert_cta` 13건 중 일부가 여기서 온 건지 알 수 없음
2. **source=apt_alert_cta가 3곳에서 사용** — [1] 서버주입, [2] SmartSectionGate, [4] BlogAptAlertCTA → 어떤 CTA가 실제 전환시키는지 구분 불가
3. **[4]는 비로그인 유저에게 불가시** — 게이트 아래에 위치하므로 비로그인 전환 기여 0
4. **[1]과 [2]의 색상이 다름** — 파란색 vs 노란색, 일관성 없음

### 현재 전환 퍼널 (30일)
```
CTA 클릭 → OAuth 화면 → 가입 완료
  apt_alert_cta:  50명 시도 → 13명 완료 (26%)  ← [1]+[2]+[4] 혼합
  action_bar:      9명 시도 →  6명 완료 (67%)  ← [3] 단독
  content_gate:    7명 시도 →  1명 완료 (14%)  ← 이메일 대안 경로
  content_lock:    1명 시도 →  1명 완료 (100%) ← apt 페이지
```

**action_bar의 OAuth 완료율이 67%로 가장 높다** — 하단 바를 클릭하는 유저는 의지가 강함. 문제는 CTR 0.28%.

---

## 1. 최종 설계 원칙

### 지켜야 할 것 (이미 검증됨)
- ✅ 2-CTA 체제 (SmartSectionGate + ActionBar)
- ✅ 카카오 원버튼 중심
- ✅ Zero-Step 온보딩
- ✅ 동적 소셜프루프
- ✅ BlogAptAlertCTA (로그인 유저용 알림 등록)

### 바꿔야 할 것 (데이터가 증명)
- ❌ 68% 컷포인트 → 데이터 기반 가변 컷포인트
- ❌ source 3곳 동일 → 개별 source로 분리 (분석 필수)
- ❌ 서버주입 CTA 추적 없음 → 추적 추가 또는 통합
- ❌ 게이트 카드 추상적 문구 → 구체적 미리보기

---

## 2. Phase 0: 데이터 정확도 복구 (즉시, ~30분)

### 0-1. Source 분리 — 3곳을 각각 구분
**의도를 이해하되 분석은 필수**. `apt_alert_cta`로 통일한 이유(1위 소스 패턴 복제)는 이해하지만, 어떤 CTA가 실제로 전환하는지 모르면 최적화 불가.

```
변경:
[1] 서버주입 CTA: source=blog_inline_cta (신규)
[2] SmartSectionGate: source=content_gate (원래대로)
[4] BlogAptAlertCTA: source=apt_alert_cta (유지)
```

**파일 수정**:
```
src/app/(main)/blog/[slug]/page.tsx:621
  source=apt_alert_cta → source=blog_inline_cta

src/components/SmartSectionGate.tsx:62
  source=apt_alert_cta → source=content_gate
```

### 0-2. 서버주입 CTA [1] 추적 추가
현재 서버 렌더링된 HTML이라 클라이언트 trackCTA 불가. 대안:

```tsx
// blog/[slug]/page.tsx의 alertCtaHtml 안에 onclick 추가
`<a href="${loginUrl}" 
   onclick="fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_type:'cta_click',cta_name:'blog_inline_cta',page_path:location.pathname,visitor_id:localStorage.getItem('kd_visitor_id')}),keepalive:true})"
   style="...">카카오로 3초 만에 시작하기</a>`
```

view 추적은 SmartSectionGate의 useEffect에서 함께 처리 (같은 페이지에 항상 공존):
```tsx
// SmartSectionGate.tsx
useEffect(() => { 
  if (shouldGate) {
    trackCTA('view', 'content_gate', { page_path: pathname });
    // 서버주입 CTA도 동시 노출이므로 함께 추적
    if (category === 'apt' || category === 'stock' || category === 'finance') {
      trackCTA('view', 'blog_inline_cta', { page_path: pathname });
    }
  }
}, [shouldGate, category, pathname]);
```

### 0-3. page_path null 수정
```tsx
// src/lib/analytics.ts trackCTA 함수
page_path: properties?.page_path || window.location.pathname,

// 호출부에서 pathname 명시 전달
trackCTA('view', 'content_gate', { page_path: pathname });
```

### 0-4. LoginClient MSG 확장 (14개 추가)
```tsx
const MSG = {
  // 기존 7개 유지
  content_gate: { icon: '📊', text: `가입하면 ${blogCount}+ 분석 전문을 무제한 열람할 수 있어요` },
  // ... 기존 유지 ...
  
  // 신규 14개
  blog_inline_cta: { icon: '🔔', text: '가입하면 청약·종목 알림을 무료로 받을 수 있어요' },
  apt_alert_cta: { icon: '🔔', text: '가입하면 이 단지의 실거래 알림을 받을 수 있어요' },
  action_bar: { icon: '📊', text: '가입하면 전체 분석과 알림을 무료로 이용할 수 있어요' },
  content_lock: { icon: '🏠', text: '가입하면 실입주 비용 계산을 무료로 이용할 수 있어요' },
  login_gate_ai_analysis: { icon: '🤖', text: '가입하면 AI 투자 분석을 무료로 볼 수 있어요' },
  login_gate_apt_analysis: { icon: '📊', text: '가입하면 이 단지의 종합 분석을 볼 수 있어요' },
  blog_comment: { icon: '💬', text: '가입하면 댓글을 달고 토론에 참여할 수 있어요' },
  apt_comment: { icon: '💬', text: '가입하면 한줄평을 남기고 볼 수 있어요' },
  stock_comment: { icon: '💬', text: '가입하면 종목 토론에 참여할 수 있어요' },
  blog_bookmark: { icon: '📌', text: '가입하면 이 분석을 저장하고 나중에 볼 수 있어요' },
  calc_gate: { icon: '🎯', text: '가입하면 맞춤 계산 결과를 확인할 수 있어요' },
  calc_cta: { icon: '🧮', text: '가입하면 계산기를 무료로 이용할 수 있어요' },
  kakao_hero: { icon: '📊', text: '카더라의 모든 분석과 알림을 무료로 이용하세요' },
  discuss: { icon: '💬', text: '가입하면 토론에 참여할 수 있어요' },
};
```

### 0-5. 누락 트래킹 5건 추가
```
ContentLock.tsx: trackCTA('view'/'click', 'content_lock') 추가
KakaoHeroCTA.tsx: trackCTA('view', 'kakao_hero') 추가
CalcSignupCTA.tsx: trackCTA('view'/'click', 'calc_cta') 추가
RightPanel.tsx: trackCTA('view', 'right_panel') 추가
Sidebar.tsx: trackCTA('view', 'sidebar') 추가
```

---

## 3. Phase 1: CTA CTR 극대화 (핵심, ~2시간)

### 1-1. 컷포인트 전략: "클리프행어" 방식

**55%→68%로 올렸을 때 CTR이 개선되지 않은 이유**: 검색 유입 유저의 패턴은 "질문에 대한 답 확인 → 이탈"이다. 68%면 대부분의 답을 이미 읽은 후.

**새 전략**: 고정 % 대신 콘텐츠 구조 기반 가변 컷포인트

```tsx
// SmartSectionGate.tsx
function findCliffhangerPoint(html: string): number {
  // 1단계: 서버주입 CTA 이후의 콘텐츠에서 시작
  //   (서버주입 CTA는 첫 H2 앞에 있으므로, 첫 H2 뒤부터가 "본문 시작")
  
  // 2단계: 두 번째 H2 찾기
  const h2s = [...html.matchAll(/<h2[^>]*>/gi)];
  
  if (h2s.length >= 2) {
    // 두 번째 H2 직전에서 자르기
    // → 유저는 서버주입CTA + 첫 섹션 전체 + 두 번째 섹션 제목 직전까지 봄
    // → "다음 섹션에 뭐가 있지?" FOMO
    const cut = h2s[1].index!;
    // 최소 20%, 최대 50% 보장
    const min = Math.floor(html.length * 0.20);
    const max = Math.floor(html.length * 0.50);
    return Math.max(min, Math.min(cut, max));
  }
  
  // H2가 1개 이하면 30% 기본값
  return Math.floor(html.length * 0.30);
}
```

**왜 두 번째 H2 직전인가**:
- 서버주입 CTA [1]이 첫 H2 앞에 있으므로, 첫 H2 이후가 실질적 본문 시작
- 첫 섹션 전체를 보여줘서 "이 글에 가치가 있다" 확신 제공
- 두 번째 H2 제목은 보이되 내용은 안 보임 → "이것도 보고 싶다" FOMO
- 68%보다 훨씬 앞이라 핵심 답은 아직 안 나온 상태

### 1-2. 게이트 카드 "Preview Hook" — 구체적 FOMO 생성

```tsx
// 게이트 뒤 콘텐츠에서 H2/H3 heading 추출
const remainingHtml = htmlContent.slice(actualCut);
const headings = [...remainingHtml.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/gi)]
  .map(m => m[1].replace(/<[^>]+>/g, '').trim())
  .filter(h => h.length > 0 && h.length < 40) // 너무 긴 제목 제외
  .slice(0, 3);
```

게이트 카드 레이아웃:
```
┌─ 페이드 그라디언트 ─────────────────────────┐

  📊 이 글에 남은 분석

  ✦ 실제 당첨 가점 컷라인 분석          ← H2/H3 자동 추출
  ✦ 2026년 경쟁률 예측 및 전략
  ✦ AI 투자 의견: 매수/관망/매도

  ┌───────────────────────────────────┐
  │  🟡 카카오 3초 가입 → 전체 보기    │  ← 노란색 버튼
  └───────────────────────────────────┘

  88명이 무료로 이용 중 · 오늘 3명 가입

└─────────────────────────────────────────────┘
```

**headings가 비어있을 경우** (H2/H3가 없는 짧은 글): 기존 CATEGORY_BENEFITS 사용 (폴백)

### 1-3. 서버주입 CTA [1]과 SmartSectionGate [2] 통합

현재 문제: 두 CTA가 동시에 보이는데 색상도 다르고(파란/노란) 메시지도 다름.

**선택지 A: 서버주입 CTA 제거** → SmartSectionGate 하나로 통일
- 장점: CTA 중복 제거, 카카오 노란색 일관성
- 단점: 첫 H2 앞에 CTA가 없어짐, 초기 노출 기회 감소

**선택지 B: 서버주입 CTA를 SmartSectionGate의 "preview" 역할로 변환**
- 서버주입 CTA의 디자인을 "정보 카드" 스타일로 변경 (가입 버튼 없이)
- "이 글의 나머지 분석을 보려면 아래에서 가입하세요" 안내만
- SmartSectionGate가 유일한 전환 CTA

**추천: 선택지 A (제거)**. 이유:
- 서버주입 CTA는 추적도 없고, 컷포인트를 두 번째 H2로 당기면 SmartSectionGate가 충분히 일찍 노출
- CTA가 2개(서버주입 + 게이트) 연속으로 보이면 "광고 투성이" 인상
- 제거 후 SmartSectionGate의 CTR 변화를 측정하면 서버주입 CTA의 실제 기여도 확인 가능

### 1-4. ActionBar 스마트 노출

**현재**: 3초 후 무조건 표시
**변경**: SmartSectionGate와 겹치지 않게

```tsx
// ActionBar.tsx
const [gateVisible, setGateVisible] = useState(false);

useEffect(() => {
  // SmartSectionGate의 게이트 카드가 viewport에 있으면 ActionBar 숨김
  const gate = document.querySelector('[data-cta="content-gate"]');
  if (!gate) { setVisible(true); return; }
  
  const obs = new IntersectionObserver(([e]) => {
    setGateVisible(e.isIntersecting);
  }, { threshold: 0.1 });
  obs.observe(gate);
  return () => obs.disconnect();
}, []);

// 게이트가 보이면 ActionBar 숨김
if (gateVisible) return null;
```

**ActionBar 메시지 컨텍스트화**:
```tsx
const getMessage = (path: string): string => {
  if (path.startsWith('/blog/')) return '분석 전체 보기 · 무료';
  if (path.startsWith('/apt/')) return '이 단지 가격 알림 · 무료';
  if (path.startsWith('/stock/')) return '이 종목 알림 · 무료';
  return '청약·주식 알림 · 무료';
};
```

---

## 4. Phase 2: OAuth 전환율 극대화 (~1시간)

### 2-1. 로그인 페이지에 원래 콘텐츠 제목 표시

```tsx
// 간단한 API: /api/blog/title?slug=xxx
// blog_posts에서 title만 반환
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ title: null });
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('blog_posts')
    .select('title').eq('slug', slug).maybeSingle();
  return NextResponse.json({ title: data?.title || null });
}
```

```
로그인 페이지 표시:
┌───────────────────────────────┐
│  레이카운티 무순위 청약 총정리  │ ← 콘텐츠 제목
│  남은 분석을 이어서 보세요      │
│                               │
│  🟡 카카오로 계속하기           │
│  ⬜ Google로 계속하기           │
└───────────────────────────────┘
```

### 2-2. 가입 직후 Welcome 토스트
```tsx
// auth/callback/route.ts — 리다이렉트 시 파라미터 추가
if (isNewUser) {
  return NextResponse.redirect(`${origin}${safeRedirect}?welcome=1`);
}
```

블로그 페이지에서 `?welcome=1` 감지:
```tsx
// 간단한 토스트 (3초 후 사라짐)
"🎉 가입 완료! 전체 분석이 해제됐어요 ↓ 스크롤해서 확인하세요"
```

### 2-3. 카카오 버튼 클릭 → 로딩 UX 개선
```tsx
// LoginClient.tsx — 버튼 클릭 후
"카카오톡으로 이동 중... 완료되면 자동으로 돌아옵니다"
// 로딩 스피너 + 안내 텍스트 (모바일에서 앱 전환 불안 해소)
```

---

## 5. Phase 3: 어드민 대시보드 전환 모니터링 (~ 1.5시간)

### 3-1. GrowthTab 전환 퍼널 대시보드

**현재 있는 것**: content_gate CTR, apt_alert_cta CTR, 온보딩 완료율
**추가**:

```
[전환 퍼널 7일]
UV → CTA View → CTA Click → OAuth시도 → 가입완료
1,576  5,403     27          83          22

[CTA별 성과표]
| CTA              | View  | Click | CTR   | OAuth완료 | 비고 |
|content_gate      | 2,516 |    16 | 0.64% | ?         |      |
|blog_inline_cta   |     - |     - |     - | ?         | 신규 |
|action_bar_kakao  | 1,057 |     3 | 0.28% | 67%       |      |
|login_gate_*      |   346 |     0 | 0.00% |           |      |
|apt_alert_cta     |   164 |     0 | 0.00% |           |      |
|kakao_hero        |     ? |     ? |     ? |           | 추적추가 |

[Source별 가입 귀속 (30일)]
| Source          | 가입 | OAuth완료율 |
|blog_inline_cta |    ? |          ? | 신규 분리
|content_gate    |    ? |          ? | 신규 분리
|action_bar      |    6 |      66.7% |
|apt_alert_cta   |    ? |          ? | BlogAptAlertCTA 단독

[일별 추이 차트]
가입수 + CTA CTR 이중 Y축 라인 차트
```

### 3-2. FocusTab 실시간 전환 위젯

벤치마크 그리드에 추가:
```
기존: CTA CTR | 가입전환 | 크론 | DB | 게이트 | 프로필 | 알림 | 재방문
추가: gate CTR을 content_gate + blog_inline_cta 합산으로 계산
```

실시간 피드에 추가:
```
최근 가입자: 손두일 (카카오, action_bar, 3시간 전)
              봉다리 (카카오, apt_alert_cta, 5시간 전)
오늘 CTA 클릭: 3건 (content_gate 2, action_bar 1)
```

### 3-3. 컷포인트 A/B 테스트 인프라

feature_flags 테이블에 전환 관련 설정 추가:
```json
{
  "gate_strategy": "second_h2",    // "second_h2" | "percentage" | "first_h2"
  "gate_percentage": 0.30,          // percentage 모드일 때 값
  "gate_show_preview": true,        // Preview Hook 표시 여부
  "gate_inline_cta_enabled": true,  // 서버주입 CTA 활성화 여부
  "actionbar_smart_hide": true,     // 게이트와 겹칠 때 숨기기
  "actionbar_contextual": true      // 컨텍스트 매칭
}
```

어드민 OpsTab에서 설정 변경 가능 → 배포 없이 전환 전략 실험

### 3-4. conversion_events 스키마 확장

```sql
ALTER TABLE conversion_events 
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS referrer_source text,
  ADD COLUMN IF NOT EXISTS gate_position smallint;
```

trackCTA에서 자동 수집:
```tsx
device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
referrer_source: document.referrer ? new URL(document.referrer).hostname : 'direct',
```

### 3-5. Ghost CTA 필터링

```tsx
// admin/v2 API에서 ctaStats 필터링
const ACTIVE_CTAS = new Set([
  'content_gate', 'blog_inline_cta', 'action_bar_kakao', 
  'apt_alert_cta', 'login_gate_apt_analysis', 'login_gate_ai_analysis',
  'content_lock', 'kakao_hero', 'calc_cta', 'right_panel', 'sidebar'
]);

// ghost CTA 별도 카운트 (어드민에서 "⚠ 삭제된 CTA N건 감지" 표시)
const ghostCount = Object.keys(ctaStats)
  .filter(k => !ACTIVE_CTAS.has(k))
  .reduce((s, k) => s + (ctaStats[k].cta_view || 0), 0);
```

---

## 6. 실행 순서 & 의존성

```
Day 1 — Phase 0 (데이터 정확도)
├── 0-1. Source 분리 (SmartSectionGate, blog/page.tsx)
├── 0-2. 서버주입 CTA 추적 추가
├── 0-3. page_path null 수정
├── 0-4. LoginClient MSG 확장
└── 0-5. 누락 트래킹 5건

Day 1~2 — Phase 1 (CTR 극대화)
├── 1-1. 컷포인트 "클리프행어" 전략
├── 1-2. Preview Hook 게이트 카드
├── 1-3. 서버주입 CTA 제거 (or 통합)
└── 1-4. ActionBar 스마트 노출

Day 2 — Phase 2 (OAuth 전환)
├── 2-1. 로그인 페이지 콘텐츠 제목
├── 2-2. Welcome 토스트
└── 2-3. 카카오 로딩 UX

Day 3 — Phase 3 (어드민)
├── 3-1. GrowthTab 퍼널 대시보드
├── 3-2. FocusTab 실시간 위젯
├── 3-3. feature_flag A/B 인프라
├── 3-4. conversion_events 확장
└── 3-5. Ghost CTA 필터링
```

---

## 7. 예상 결과

| 지표 | 현재 | Phase 0+1 후 | Phase 전체 후 |
|------|------|-------------|-------------|
| CTA CTR | 0.5% | 3~5% | 3~5% |
| OAuth 완료율 | 26% | 26% | 35~40% |
| 일 가입 | 3~5명 | 10~20명 | 15~25명 |
| 전체 전환율 | 1.4% | 3~5% | 5~8% |
| 분석 가시성 | 30% | 100% | 100% |

**가장 큰 레버**: Phase 1-1 컷포인트 변경 + 1-2 Preview Hook. 이 두 가지가 CTR 개선의 80%를 차지할 것.

바로 시작할까?
