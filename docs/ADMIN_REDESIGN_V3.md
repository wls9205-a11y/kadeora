# 카더라 어드민 대시보드 전면 개편 설계안

> 기존 2개 시스템(AdminShell 6탭 + MissionControl 14섹션) 백지화
> → 단일 대시보드 1페이지로 통합
> 작성: 세션 78 | 2026-04-08

---

## 1. 현재 시스템 부검

### 1.1 구조적 문제

```
현재: 2개 시스템이 병행

AdminShell (메인 — page.tsx)
├── 🎯 집중탭 (FocusTab)      — 헬스점수 + 할일 + 최근활동
├── 📊 성장탭 (GrowthTab)     — CTA 통계 + 주간 트렌드
├── 👤 사용자탭 (UsersTab)    — 유저 목록 + 검색
├── 🗄️ 데이터탭 (DataTab)     — 데이터 커버리지
├── 🔧 운영탭 (OpsTab)        — 크론 상태
└── ⚡ 실행탭 (ExecuteTab)    — GOD MODE

MissionControl (구형 — 미연결)
├── 📊 대시보드 (1,207줄!)    — KPI + 차트 + 펄스 + 퍼널 + ...
├── 📈 방문자
├── 🔍 SEO·점수
├── 👤 유저 관리
├── 📝 콘텐츠
├── ✍️ 블로그
├── 🏢 부동산
├── ⚙️ 시스템
├── 🚨 신고/결제
├── 📢 공지·알림
├── 🛍️ 상점
├── 📢 팝업 관리
├── 🛰️ 위성 네트워크
└── ⚡ GOD MODE
```

### 1.2 핵심 문제

| # | 문제 | 상세 |
|---|------|------|
| 1 | **2개 시스템 병행** | AdminShell과 MissionControl이 같은 데이터를 다른 방식으로 표시 |
| 2 | **정보 분산** | 크론 상태를 보려면 OpsTab, CTA를 보려면 GrowthTab, 유저를 보려면 UsersTab |
| 3 | **대시보드 과대** | MissionControl dashboard.tsx 1,207줄 — 유지보수 불가 |
| 4 | **⚡ 최신화가 별도 탭** | 가장 자주 쓰는 기능이 ExecuteTab에 숨어있음 |
| 5 | **중복 API** | /api/admin/v2와 /api/admin/dashboard가 같은 데이터를 다른 형태로 반환 |
| 6 | **하드코딩** | 바운스율 97.5%, CTA 도달 5건 등 정적 값 존재 |

---

## 2. 새 설계 철학

### 5가지 원칙

```
1. ONE SCREEN
   → 모든 핵심 정보를 스크롤 없이 한 화면에서 파악
   → 탭 전환 없음, 섹션 접기/펼치기로 상세 확인

2. ONE BUTTON
   → ⚡ 최신화 버튼 하나로 71개 크론 5단계 실행
   → 실행 중 진행률 실시간 표시 (현재 페이지 벗어나지 않음)

3. DATA-DRIVEN
   → 하드코딩 데이터 0건
   → 모든 수치는 DB 실시간 쿼리
   → 60초 자동 폴링

4. ACTIONABLE
   → 숫자만 보여주는 게 아니라, 문제가 있으면 즉시 액션 가능
   → 크론 실패 → 재실행 버튼
   → CTA 성과 저조 → 설정 변경 링크

5. COMPACT DENSITY
   → 1,207줄 → 500줄 이내
   → 큰 카드 대신 미니 KPI 타일
   → 차트보다 숫자 위주 (한눈에 파악)
```

---

## 3. 새 대시보드 레이아웃

### 3.1 와이어프레임

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 카더라 미션 컨트롤    [⚡ 전체 최신화] [🔄] 12:35 업데이트   │  ← 스티키 헤더
│ ●92점 양호  크론97%  PV834  UV741  가입+15                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌── 핵심 KPI (8타일) ──────────────────────────────────────┐   │
│  │ 유저42 │ 가입+15 │ PV834 │ UV741 │ 게시95 │ 블로그5 │   │   │
│  │ 종목1.8K│ 현장2.7K│ 댓글225│ 크론97%│ CTA168│ 생산12만│   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌── ⚠️ 주의 사항 (문제 있을 때만 표시) ─────────────────────┐   │
│  │ 🔴 stock-analysis-gen 504 (4회/6h) [재실행]               │   │
│  │ 🟡 Anthropic 크레딧 부족 — AI 크론 50%+ 실패               │   │
│  │ 🟡 CTA CTR 0.6% — 목표 3% 미달                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ 📊 트래픽 ─┐ ┌─ 🔄 크론 ──┐ ┌─ 📈 CTA ──┐ ┌─ 👤 유저 ─┐   │
│  │ 14일 라인차트 │ │ 성공/실패 바│ │ 노출→클릭  │ │ 최근 가입  │   │
│  │ PV + 신규유저 │ │ 실패 크론  │ │ → 가입     │ │ 활성 유저  │   │
│  │ 오늘 vs 어제 │ │ [1건 재실행]│ │ CTR %     │ │ 등급 분포  │   │
│  └──────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ┌─ 📰 콘텐츠 ─┐ ┌─ 🏢 부동산 ─┐ ┌─ 📈 주식 ─┐ ┌─ 🔍 SEO ──┐   │
│  │ 블로그 오늘5 │ │ 청약 2,702  │ │ 종목 1,805│ │ 사이트맵%  │   │
│  │ 피드 오늘95  │ │ 미분양      │ │ 시세 건강  │ │ 인덱싱률   │   │
│  │ 댓글 225    │ │ 재개발      │ │ 섹터 커버  │ │ 커버리지   │   │
│  │ AI리라이트  │ │ 관심등록 1  │ │ PER/PBR %│ │ IndexNow  │   │
│  └──────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                 │
│  ┌─ ⚡ 실시간 활동 피드 ─────────────────────────────────────┐   │
│  │ 👤 홍길동 가입 (카카오) · 2분 전                           │   │
│  │ 📝 "삼성전자 분석" — 마켓워처 · 15분 전                    │   │
│  │ 💬 "공감합니다" — 주식고수 · 22분 전                       │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ 🔗 바로가기 ─────────────────────────────────────────────┐   │
│  │ 사이트 | 블로그 | 주식 | 피드 | Vercel | SearchConsole    │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 섹션별 상세 설계

#### A. 스티키 헤더 (항상 고정)

```tsx
// 항상 화면 상단에 고정
// 핵심 상태를 한 줄로 요약
// ⚡ 전체 최신화 버튼 = GOD MODE full 실행
// 실행 중이면 프로그레스 바 + 단계 표시
// 30초마다 자동 폴링

<header sticky>
  <h1>🎯 미션 컨트롤</h1>
  <button onClick={godMode}>⚡ 전체 최신화</button>  // GOD MODE full
  <button onClick={refresh}>🔄</button>              // 데이터 새로고침
  <StatusBar>
    ● 92점 양호 | 크론 97% | PV 834 | UV 741 | 가입 +15
  </StatusBar>
</header>
```

#### B. 핵심 KPI 타일 (12개, 6×2 그리드)

```
Row 1: 유저 | 가입(7d) | PV(오늘) | UV(오늘) | 게시글(오늘) | 블로그(오늘)
Row 2: 종목 | 현장 | 댓글(오늘) | 크론성공률 | CTA노출(7d) | 24h생산
```

- 각 타일: 40×60px, 값(14px bold) + 라벨(9px)
- 어제 대비 delta 화살표 (▲▼ + %)
- 클릭하면 해당 섹션으로 스크롤

#### C. ⚠️ 주의 사항 (조건부 표시)

```
표시 조건 (하나라도 해당하면 표시):
- 크론 실패 > 0건: 실패 크론명 + [재실행] 버튼
- Anthropic 크레딧 부족: 경고 메시지
- CTA CTR < 1%: 개선 제안
- 미처리 신고 > 0건: 신고 건수 + [확인] 링크
- DB 사용량 > 80%: 경고
- 블로그 오늘 0편: 크론 확인 제안

문제 없으면 ✅ "시스템 정상" 한 줄만 표시
```

#### D. 4패널 그리드 (핵심 데이터 영역)

**📊 트래픽 패널**
```
- Chart.js 라인 차트 (14일 PV + 신규유저)
- 높이 120px (컴팩트)
- 오늘 vs 어제 비교 (숫자)
- 주요 유입 소스
```

**🔄 크론 패널**
```
- 성공/실패 프로그레스 바
- 실패 크론 목록 (최대 3개)
- 각 실패 크론 옆에 [재실행] 버튼
- 24h 생산 레코드 수
```

**📈 CTA 퍼널 패널**
```
- 노출 → 클릭 → 가입 (3단계 수치)
- 노출률, CTR, 가입률 (%)
- 목표 대비 달성도 바
```

**👤 유저 패널**
```
- 최근 가입 3명 (닉네임 + 가입경로 + 시간)
- 등급 분포 미니 바 차트
- 신규(7d) / 활성(7d) / 재방문율
```

#### E. 4패널 그리드 (서비스 데이터)

**📰 콘텐츠 패널**
```
- 블로그: 오늘 발행 / 총 / 리라이트율
- 피드: 오늘 게시글 / 자동발행 비율
- 댓글: 오늘 / 7일 추이
- AI 크레딧 상태
```

**🏢 부동산 패널**
```
- 청약 현장: 2,702건
- 미분양: 건수
- 재개발: 건수
- 관심등록: 1건
- 데이터 커버리지 (분양가/좌표/이미지 %)
```

**📈 주식 패널**
```
- 종목: 1,805개 (KR/US 분리)
- 시세 건강도 (마지막 업데이트 시간)
- 섹터 커버리지 %
- PER/PBR 보유율 %
```

**🔍 SEO 패널**
```
- 사이트맵 등록률 %
- IndexNow 진행률 %
- 페이지 타입 분포 (미니 바)
- 구글/네이버 인덱싱 상태
```

#### F. 실시간 활동 피드

```
- 최근 15건 (가입/게시글/댓글/신고 통합)
- 자동 스크롤 없음, 높이 150px 고정
- 아이콘 + 내용 + 시간
```

#### G. 바로가기

```
- 2행 그리드, 각 타일 80px
- 사이트 | 블로그 | 주식 | 피드 | 토론 | HOT
- Vercel | SearchConsole | 서치어드바이저 | Anthropic | Supabase
```

---

## 4. API 통합

### 4.1 단일 API 엔드포인트

```
기존: /api/admin/v2?tab=focus (탭별 데이터)
    + /api/admin/dashboard?section=overview (섹션별 데이터)
    + /api/admin/god-mode (크론 실행)
    + /api/admin/cron-summary (크론 요약)
    + ... 46개 엔드포인트

신규: /api/admin/v2?tab=dashboard (단일 대시보드용)
    + /api/admin/god-mode (크론 실행 — 유지)
    + /api/admin/god-mode (단일 크론 재실행 — mode=single)
```

### 4.2 dashboard 탭 응답 구조

```typescript
interface DashboardData {
  // 헬스
  healthScore: number;        // 0~100
  healthLabel: string;        // '양호' | '주의' | '위험'
  
  // KPI (12개)
  kpi: {
    realUsers: number;
    newUsers7d: number;
    pvToday: number;
    uvToday: number;
    postsToday: number;
    blogsToday: number;
    stocks: number;
    aptSites: number;
    commentsToday: number;
    cronRate: number;         // 0~100
    ctaViews7d: number;
    recordsCreated24h: number;
  };
  
  // 어제 대비 delta
  yesterday: {
    pv: number;
    uv: number;
    posts: number;
    newUsers: number;
  };
  
  // 주의 사항
  alerts: Array<{
    level: 'red' | 'yellow' | 'green';
    title: string;
    desc: string;
    action?: { label: string; cron?: string; href?: string };
  }>;
  
  // 트래픽 (14일)
  dailyStats: Array<{ date: string; pv: number; uv: number; newUsers: number }>;
  
  // 크론
  cron: {
    total: number;
    success: number;
    fail: number;
    failedCrons: Array<{ name: string; error: string; lastRun: string }>;
    anthropicCreditWarning: boolean;
  };
  
  // CTA
  cta: {
    views: number;
    clicks: number;
    signups: number;
    ctr: number;              // views/clicks * 100
    convRate: number;         // signups/views * 100
  };
  
  // 유저
  users: {
    recentSignups: Array<{ nickname: string; provider: string; at: string }>;
    gradeDistribution: Record<number, number>;
    activeWeek: number;
    returnRate: number;
  };
  
  // 콘텐츠
  content: {
    totalBlogs: number;
    blogsToday: number;
    rewriteRate: number;
    feedToday: number;
    commentsToday: number;
    aiCredits: 'ok' | 'low' | 'exhausted';
  };
  
  // 부동산
  realestate: {
    subscriptions: number;
    unsold: number;
    redev: number;
    interests: number;
    coverage: { price: number; coords: number; images: number };
  };
  
  // 주식
  stock: {
    total: number;
    kr: number;
    us: number;
    lastRefresh: string;
    sectorCoverage: number;
    perPbrRate: number;
  };
  
  // SEO
  seo: {
    sitemapRate: number;
    indexNowRate: number;
    totalPages: number;
  };
  
  // 활동 피드
  recentActivity: Array<{
    type: 'signup' | 'post' | 'comment' | 'report';
    icon: string;
    text: string;
    at: string;
  }>;
}
```

---

## 5. GOD MODE 통합

### 5.1 ⚡ 전체 최신화 (헤더 버튼)

```
클릭 → confirm → GOD MODE full 실행
실행 중:
  ┌──────────────────────────────────────────────┐
  │ ⚡ 실행 중... Phase 2/5 (가공) 38/71 크론    │
  │ ████████████░░░░░░░░░░░░░░░░░░░░  53%  42s  │
  └──────────────────────────────────────────────┘
완료 후:
  ┌──────────────────────────────────────────────┐
  │ ✅ 완료 — 68성공 / 3실패 (2분 12초)           │
  │ 실패: stock-analysis-gen, apt-ai-summary [재] │
  └──────────────────────────────────────────────┘
```

### 5.2 단일 크론 재실행

```
실패 크론 옆 [재실행] 버튼 → /api/admin/god-mode { mode: 'single', cron: '/api/cron/stock-analysis-gen' }
인라인 로딩 → 결과 표시
```

---

## 6. 기술 구현 계획

### 6.1 파일 구조

```
기존 (28개 파일, ~5,000줄):
  AdminShell.tsx (110줄)
  MissionControl.tsx (80줄)
  admin-shared.tsx (300줄)
  tabs/FocusTab.tsx (350줄)
  tabs/GrowthTab.tsx (197줄)
  tabs/UsersTab.tsx (163줄)
  tabs/DataTab.tsx (276줄)
  tabs/OpsTab.tsx (161줄)
  tabs/ExecuteTab.tsx (203줄)
  sections/dashboard.tsx (1,207줄)
  sections/analytics.tsx (301줄)
  ... 12개 더

신규 (3개 파일, ~800줄):
  AdminDashboard.tsx (~600줄) — 단일 대시보드 컴포넌트
  admin-shared.tsx (~150줄) — 공유 유틸/팔레트 (기존 축소)
  page.tsx (~10줄) — dynamic import
```

### 6.2 API 구조

```
기존:
  /api/admin/v2 (5개 탭 분기)
  /api/admin/dashboard (14개 섹션 분기)
  /api/admin/god-mode

신규:
  /api/admin/v2?tab=dashboard (단일 엔드포인트, 모든 데이터)
  /api/admin/god-mode (유지)
```

### 6.3 컴포넌트 구조

```tsx
// AdminDashboard.tsx 내부 구조
function AdminDashboard() {
  const [data, setData] = useState(null);
  const [godMode, setGodMode] = useState({ running: false, progress: 0 });
  
  // 30초 폴링
  useEffect(() => { ... }, []);
  
  return (
    <>
      <StickyHeader data={data} onGodMode={runGodMode} godMode={godMode} />
      <KPIGrid kpi={data.kpi} yesterday={data.yesterday} />
      <AlertBar alerts={data.alerts} onAction={handleAction} />
      <div className="grid-4col">
        <TrafficPanel stats={data.dailyStats} visitors={data.kpi} />
        <CronPanel cron={data.cron} onRerun={rerunCron} />
        <CTAPanel cta={data.cta} />
        <UserPanel users={data.users} />
      </div>
      <div className="grid-4col">
        <ContentPanel content={data.content} />
        <RealEstatePanel re={data.realestate} />
        <StockPanel stock={data.stock} />
        <SEOPanel seo={data.seo} />
      </div>
      <ActivityFeed items={data.recentActivity} />
      <QuickLinks />
    </>
  );
}
```

---

## 7. 디자인 시스템

### 7.1 컬러

```
기존 C 팔레트 유지:
  bg: #050A18, surface: #0B1425, card: #0F1A2E
  brand: #3B82F6, green: #10B981, red: #EF4444
  yellow: #F59E0B, purple: #8B5CF6, cyan: #06B6D4
  text: #E2E8F0, textSec: #94A3B8, textDim: #64748B
```

### 7.2 타이포그래피

```
KPI 값: 14px, weight 800 (컬러별)
KPI 라벨: 9px, weight 600, textDim
섹션 제목: 11px, weight 700, text
본문: 10px, weight 400, textSec
배지/태그: 9px, weight 600
```

### 7.3 스페이싱

```
섹션 간: 6px
카드 padding: 8px 10px
KPI 타일 gap: 4px
그리드 gap: 6px
```

### 7.4 차트

```
Chart.js Line (트래픽): 높이 120px
프로그레스 바 (크론/SEO): 높이 5px, radius 3px
등급 분포 바: 높이 20px, stacked horizontal
```

---

## 8. 구현 순서

### Phase 1: API 통합 (30분)
```
/api/admin/v2에 tab=dashboard 케이스 추가
기존 overview + focus + growth 데이터를 하나로 병합
alerts 자동 생성 로직 추가
```

### Phase 2: AdminDashboard 컴포넌트 (2시간)
```
1. StickyHeader — GOD MODE 버튼 + 상태바
2. KPIGrid — 12개 타일 (6×2)
3. AlertBar — 조건부 경고
4. TrafficPanel — Chart.js 라인
5. CronPanel — 성공/실패 + 재실행
6. CTAPanel — 퍼널 수치
7. UserPanel — 최근 가입 + 등급
8. ContentPanel — 블로그/피드/댓글
9. RealEstatePanel — 현장/미분양/재개발
10. StockPanel — 종목/시세/커버리지
11. SEOPanel — 사이트맵/인덱싱
12. ActivityFeed — 실시간 활동
13. QuickLinks — 바로가기
```

### Phase 3: page.tsx 교체 (15분)
```
AdminShell → AdminDashboard로 교체
기존 파일 삭제하지 않음 (롤백 안전)
```

### Phase 4: 테스트 + 배포 (15분)
```
빌드 확인
배포
실제 데이터로 렌더링 확인
```

**총 소요: ~3시간**

---

## 9. 기존 시스템 대비 개선점

| 항목 | 기존 | 신규 |
|------|------|------|
| 파일 수 | 28개 (~5,000줄) | 3개 (~800줄) |
| API 호출 | 2개 (v2 + dashboard) | 1개 (v2?tab=dashboard) |
| 탭 전환 | 6번 클릭 필요 | 스크롤 1회 |
| GOD MODE | ExecuteTab 진입 필요 | 헤더 버튼 1클릭 |
| 크론 재실행 | GOD MODE 섹션 진입 | 실패 옆 [재실행] 버튼 |
| 정보 밀도 | 탭별 분산 | 한 화면에 모든 정보 |
| 폴링 주기 | 30~60초 (탭별 다름) | 30초 통일 |
| 하드코딩 | 바운스율, CTA 도달 등 | 0건 |
| 응답성 | 탭 전환마다 로딩 | 전체 데이터 1회 로드 |

---

## 10. 제거 대상

### 즉시 제거 (렌더링만 — 파일 유지)

```
- MissionControl.tsx (사용 안 됨)
- sections/dashboard.tsx (1,207줄 → AdminDashboard로 대체)
- tabs/FocusTab.tsx → AdminDashboard에 통합
- tabs/GrowthTab.tsx → AdminDashboard에 통합
- tabs/OpsTab.tsx → AdminDashboard에 통합
- tabs/ExecuteTab.tsx → AdminDashboard에 통합
```

### 유지

```
- tabs/UsersTab.tsx → 유저 관리 (별도 뷰 필요 시)
- tabs/DataTab.tsx → 데이터 상세 (별도 뷰 필요 시)
- sections/godmode.tsx → GOD MODE 상세 (필요 시)
- /api/admin/god-mode → 크론 실행 API
```

---

## 11. 성공 기준

```
배포 후 체크:
  ✅ 한 화면에서 모든 핵심 KPI 확인 가능
  ✅ ⚡ 버튼 1클릭으로 GOD MODE 실행
  ✅ 실패 크론 [재실행] 버튼 작동
  ✅ 하드코딩 데이터 0건
  ✅ 30초 자동 폴링 정상
  ✅ 모바일에서도 사용 가능
  ✅ 로딩 시간 < 2초

1주 후 체크:
  ✅ 탭 전환 없이 일일 모니터링 가능
  ✅ 문제 발견 → 조치까지 3클릭 이내
```

---

## 12. 강화: 성장 분석 대시보드 (추가 설계)

> 데이터 분석 결과 발견된 핵심 문제점 반영

### 12.1 발견된 핵심 문제점

```
🔴 가입 후 활동률 0%
   42명 가입 → 게시글 0, 댓글 0, 좋아요 0 (전원)
   → 가입하고 아무것도 안 함

🔴 알림 열람률 0%
   7일간 4,383건 알림 발송 → 열람 0건
   → 알림이 전혀 읽히지 않음

🔴 프로필 완성률 0%
   42명 중 프로필 완성 0명
   → 온보딩 후 추가 정보 입력 안 함

🔴 푸시/이메일 구독 0명
   → 리텐션 채널이 전무

🔴 북마크 0건
   → 콘텐츠 저장 기능 미사용

🟡 주간 가입 변화 없음
   W-1: 15명 / W-2: 16명 (성장률 -6%)

🟡 트래픽 편중
   블로그 3,152 ≈ 부동산 3,257 >> 주식 296
   주식 트래픽이 부동산의 1/11
```

### 12.2 강화된 대시보드 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ 스티키 헤더 + ⚡ 전체 최신화                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌── 🚨 위험 신호 (빨간색, 문제 있을 때만) ──────────────────┐ │
│ │ 가입 후 활동률 0% | 알림 열람률 0% | 푸시 구독 0명        │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌── 📊 핵심 KPI (12타일) ──────────────────────────────────┐ │
│ │ 유저42 │ 가입+15 │ PV834 │ UV741 │ 게시95 │ 블로그5     │ │
│ │ 종목1.8K│현장2.7K │댓글225│크론97% │CTA168│ 생산12만    │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌── 📈 성장 추이 (4주 비교) ──────────────────────────────┐  │
│ │                                                          │ │
│ │  가입    W-2:16 → W-1:15 → 이번주:? (▼6%)               │ │
│ │  PV      W-2:_  → W-1:_  → 이번주:_ (▲?%)               │ │
│ │  게시글   W-2:624→ W-1:819→ 이번주:_ (▲?%)               │ │
│ │  댓글    W-2:_  → W-1:_  → 이번주:_ (▲?%)               │ │
│ │                                                          │ │
│ │  ████ 성장 ████ 정체 ████ 하락                            │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─ 👤 유저 건강도 ─┐ ┌─ 🔔 리텐션 ────┐ ┌─ 📊 콘텐츠 성과 ┐ │
│ │                  │ │                │ │                  │ │
│ │ 가입 후 활동률    │ │ 알림 열람률     │ │ 블로그 카테고리  │ │
│ │ ██ 0/42 (0%)    │ │ ██ 0% (0/4383)│ │ ██ apt 83%      │ │
│ │                  │ │                │ │ ██ stock 14%    │ │
│ │ 프로필 완성률     │ │ 푸시 구독       │ │ ██ unsold 2%    │ │
│ │ ██ 0/42 (0%)    │ │ ██ 0명         │ │ ██ finance 1%   │ │
│ │                  │ │                │ │                  │ │
│ │ 온보딩 완료율     │ │ 이메일 구독     │ │ 트래픽 분포      │ │
│ │ ██ 38/42 (90%) │ │ ██ 0명         │ │ ██ blog 43%     │ │
│ │                  │ │                │ │ ██ apt 45%      │ │
│ │ 지역 분포       │ │ 북마크          │ │ ██ stock 4%     │ │
│ │ 서울6 부산4      │ │ ██ 0건         │ │ ██ feed 8%      │ │
│ │ 경남2 경기2 ...  │ │                │ │                  │ │
│ │                  │ │ CTA 퍼널       │ │ 가입 유입 경로   │ │
│ │ 연령 분포       │ │ 노출168→클릭1  │ │ apt 29명 (22%)  │ │
│ │ 30대8 40대5      │ │ →가입15        │ │ feed 28명 (21%) │ │
│ │ 50대2 60+1      │ │ CTR 0.6%      │ │ blog 26명 (20%) │ │
│ │                  │ │                │ │ stock 13명(10%) │ │
│ └──────────────────┘ └────────────────┘ └──────────────────┘ │
│                                                             │
│ ┌─ 📊 트래픽 ─┐ ┌─ 🔄 크론 ─┐ ┌─ 🏢 부동산 ┐ ┌─ 📈 주식 ─┐  │
│ │ 14일 차트    │ │ 97% 성공  │ │ 청약 2,702  │ │ 종목 1,805│ │
│ │ PV+신규유저  │ │ 실패33건  │ │ 분양가 94%  │ │ 시세 정상 │ │
│ │ 오늘 vs 어제│ │ [재실행]  │ │ 좌표 98%   │ │ 섹터 62% │ │
│ └──────────────┘ └──────────┘ └────────────┘ └────────────┘ │
│                                                             │
│ ┌── ⚡ 실시간 활동 ──┐ ┌── 🔗 바로가기 ──────────────────┐   │
│ │ 최근 활동 5건       │ │ 사이트|블로그|주식|Vercel|GSC    │   │
│ └────────────────────┘ └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 12.3 새 패널 상세

#### A. 🚨 위험 신호 (최상단)

```
자동 감지 조건:
1. 가입 후 7일 활동률 < 10% → 🔴 "가입 후 활동률 X%"
2. 알림 열람률 < 10% → 🔴 "알림 열람률 X%"
3. 푸시 구독 0명 → 🔴 "푸시 구독 0명"
4. 주간 가입 감소 → 🟡 "가입 ▼X% (W-1 vs W-2)"
5. 크론 실패 > 5% → 🔴 "크론 성공률 X%"
6. AI 크레딧 소진 → 🔴 "Anthropic 크레딧 부족"
7. CTA CTR < 1% → 🟡 "CTA CTR X%"

모든 문제 없으면: ✅ "시스템 정상 — 이상 없음"
```

#### B. 📈 성장 추이 (주간 비교 스파크라인)

```
4주간 핵심 지표 추이를 미니 바 차트로 표시:

지표        W-4    W-3    W-2    W-1    추세
가입        —      —      16     15     ▼6%  🔴
PV          —      —      8,490  ?      —    
게시글      190    624    594    819    ▲38% 🟢
댓글        —      —      —      1,569  —
블로그      —      —      —      5/일   —

각 행: 라벨 | 4주 미니 바 | 최신 값 | 증감률 | 상태 아이콘
```

#### C. 👤 유저 건강도 패널

```
■ 가입 후 활동률
  활동한 유저 / 전체 유저 = 0/42 (0%)
  → 프로그레스 바 (빨간색)
  → "가입 후 7일 내 첫 게시글/댓글 작성한 유저 비율"

■ 프로필 완성률
  프로필 완성 / 전체 = 0/42 (0%)
  → 프로그레스 바

■ 온보딩 완료율
  온보딩 완료 / 전체 = 38/42 (90%)
  → 프로그레스 바 (초록)

■ 지역 분포 (미니 히트맵)
  서울 6 | 부산 4 | 경남 2 | 경기 2 | 울산 2 | 대구 1 | 광주 1 | 전북 1

■ 연령 분포
  30대 8 | 40대 5 | 50대 2 | 20대 1 | 60+ 1

■ 최근 가입자 (3명)
  킴세 · 카카오 · 2시간 전
  박정아 · 카카오 · 1일 전
  eloquence · 카카오 · 1일 전
```

#### D. 🔔 리텐션 패널

```
■ 알림 열람률
  열람 / 발송 = 0/4,383 (0%)
  → 프로그레스 바 (빨간색)
  → 원인 분석: "알림이 앱 내에서만 표시 — 재방문 없으면 미열람"

■ 푸시 구독
  0명 (구독자 없음)
  → 원인: "AutoPushPrompt가 로그인 유저에게만 표시"

■ 이메일 구독
  0명 (구독자 없음)

■ 북마크
  7일간 0건

■ CTA 퍼널
  노출 168 → 클릭 1 → 가입 15
  노출률 2.0% | CTR 0.6% | 가입률 0.18%
  → 목표 CTR 3.0% 대비 프로그레스 바
```

#### E. 📊 콘텐츠 성과 패널

```
■ 블로그 카테고리 분포 (수평 스택 바)
  apt 32,920 (83%) | stock 5,319 (14%) | unsold 817 (2%) | finance 309 (1%)
  → "주식 콘텐츠 비중 낮음 — 주식 블로그 크론 강화 필요"

■ 트래픽 분포 (7일, 수평 스택 바)
  apt 3,257 (45%) | blog 3,152 (43%) | feed 592 (8%) | stock 296 (4%)
  → "주식 페이지 트래픽 부족 — SEO/콘텐츠 강화"

■ 가입 유입 경로 (7일)
  apt 29명 (22%) | feed 28명 (21%) | blog 26명 (20%) | stock 13명 (10%) | other 39명 (30%)
  → "부동산 + 피드가 가입 전환의 핵심 채널"

■ 콘텐츠 격차 분석
  🟢 강점: 부동산 콘텐츠 (블로그 83%, 트래픽 45%)
  🟡 기회: 피드 (트래픽 8%인데 가입 21%)
  🔴 약점: 주식 (블로그 14%인데 트래픽 4%)
```

### 12.4 API 응답 추가 필드

```typescript
// 기존 DashboardData에 추가
interface DashboardData {
  // ... 기존 필드 ...
  
  // 성장 추이 (4주)
  weeklyGrowth: {
    signups: number[];     // [W-4, W-3, W-2, W-1]
    posts: number[];
    pv: number[];
    comments: number[];
  };
  
  // 유저 건강도
  userHealth: {
    totalReal: number;
    activeAfterSignup: number;   // 가입 후 1건이라도 활동한 유저
    profileCompleted: number;
    onboarded: number;
    regionDist: Record<string, number>;  // { '서울': 6, '부산': 4 }
    ageDist: Record<string, number>;     // { '30s': 8, '40s': 5 }
    providerDist: Record<string, number>; // { 'kakao': 38, 'google': 4 }
  };
  
  // 리텐션
  retention: {
    notifSent7d: number;
    notifRead7d: number;
    notifReadRate: number;
    pushSubs: number;
    emailSubs: number;
    bookmarks7d: number;
  };
  
  // 콘텐츠 성과
  contentPerformance: {
    blogCategoryDist: Record<string, number>;   // { apt: 32920, stock: 5319 }
    trafficDist: Record<string, number>;        // { blog: 3152, apt: 3257 }
    signupSource: Record<string, number>;       // { apt: 29, feed: 28 }
    strengths: string[];
    weaknesses: string[];
  };
}
```

---

## 13. 최종 구현 순서 (갱신)

| 순서 | 작업 | 시간 |
|------|------|------|
| 1 | API: /api/admin/v2?tab=dashboard 응답 구조 구현 | 1시간 |
| 2 | AdminDashboard: 스티키헤더 + KPI 12타일 + GOD MODE | 30분 |
| 3 | AdminDashboard: 위험 신호 + 성장 추이 | 30분 |
| 4 | AdminDashboard: 유저건강도 + 리텐션 + 콘텐츠성과 | 1시간 |
| 5 | AdminDashboard: 트래픽/크론/부동산/주식/SEO + 활동피드 | 1시간 |
| 6 | page.tsx 교체 + 빌드 + 배포 | 15분 |

**총 소요: ~4.5시간**
