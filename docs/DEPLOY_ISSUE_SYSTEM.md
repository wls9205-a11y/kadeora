# 🚀 이슈 선점 자동화 — 배포 가이드

## 신규 파일 (11개, 1,831줄)

```
docs/migrations/issue_alerts.sql          ← DB 마이그레이션 + 레이카운티 기사
src/lib/issue-scoring.ts                   ← 점수 엔진 (부동산+주식 통합)
src/app/api/cron/issue-detect/route.ts     ← 이슈 탐지 크론 (15분)
src/app/api/cron/issue-draft/route.ts      ← AI 생성+발행 크론 (20분)
src/app/api/cron/issue-trend/route.ts      ← 네이버 트렌드 크론 (1시간)
src/app/api/cron/feed-buzz-publish/route.ts ← 뻘글 발행 크론 (5분)
src/app/api/admin/issues/route.ts          ← 어드민 이슈 목록 API
src/app/api/admin/issues/config/route.ts   ← 킬스위치 API
src/app/api/admin/issues/publish/route.ts  ← 1클릭 발행 API
src/app/api/admin/issues/skip/route.ts     ← 이슈 무시 API
src/app/admin/tabs/IssueTab.tsx            ← 어드민 이슈 탭 UI
```

## 기존 파일 수정 (2개)

### 1. src/app/admin/AdminShell.tsx — 이슈 탭 추가

```diff
- const tabs = ['focus','growth','users','data','ops','execute'] as const;
+ const tabs = ['focus','growth','users','data','ops','execute','issues'] as const;

  const C:Record<T,any> = {
    focus: dynamic(()=>import('./tabs/FocusTab'),{loading:Spin}),
    growth: dynamic(()=>import('./tabs/GrowthTab'),{loading:Spin}),
    users: dynamic(()=>import('./tabs/UsersTab'),{loading:Spin}),
    data: dynamic(()=>import('./tabs/DataTab'),{loading:Spin}),
    ops: dynamic(()=>import('./tabs/OpsTab'),{loading:Spin}),
    execute: dynamic(()=>import('./tabs/ExecuteTab'),{loading:Spin}),
+   issues: dynamic(()=>import('./tabs/IssueTab'),{loading:Spin}),
  };

  // icons 객체에 추가:
+ issues: '🔍',
```

### 2. vercel.json — 크론 4개 추가

crons 배열 마지막에 추가:
```json
    {
      "path": "/api/cron/issue-detect",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/issue-draft",
      "schedule": "2,22,42 * * * *"
    },
    {
      "path": "/api/cron/issue-trend",
      "schedule": "5 * * * *"
    },
    {
      "path": "/api/cron/feed-buzz-publish",
      "schedule": "*/5 * * * *"
    }
```

## 배포 순서

### Step 1: DB 마이그레이션
Supabase SQL Editor에서 `docs/migrations/issue_alerts.sql` 실행
- issue_alerts 테이블 생성
- scheduled_feed_posts 테이블 생성
- blog_publish_config 킬스위치 컬럼 추가
- 레이카운티 블로그 기사 2건 즉시 발행

### Step 2: 코드 배포
```bash
git add .
git commit -m "feat: 이슈 선점 자동화 시스템 + 레이카운티 기사

- issue-detect: 부동산+주식 뉴스 RSS 14곳 실시간 모니터링 (15분)
- issue-draft: AI 기사 자동 생성 + 자동 발행 (score 60+)
- issue-trend: 네이버 검색 트렌드 증폭계수 반영 (1시간)
- feed-buzz-publish: 페르소나 기반 뻘글 자동 발행 (5분)
- issue-scoring: 부동산+주식 통합 점수 엔진
- admin IssueTab: 이슈 모니터링 + 킬스위치 + 1클릭 발행
- 레이카운티 무순위 재분양 기사 2건 즉시 발행"
git push origin main
```

### Step 3: 발행 후 확인
- [ ] 레이카운티 기사 접속 확인: https://kadeora.app/blog/레이카운티-무순위-청약-재분양-총정리-2026
- [ ] OG 이미지 카카오톡 공유 테스트
- [ ] IndexNow 수동 트리거
- [ ] 네이버 서치어드바이저 URL 수집 요청
- [ ] 구글 서치콘솔 색인 요청
- [ ] 어드민 → 이슈 탭 접속 확인
- [ ] 킬스위치 ON/OFF 동작 확인

### Step 4: 크론 동작 확인 (배포 후 30분)
- [ ] issue-detect 실행 로그 확인 (Vercel Functions 탭)
- [ ] issue_alerts 테이블에 데이터 쌓이는지 확인
- [ ] 60점+ 이슈 자동 발행 테스트 (초기에는 킬스위치 OFF 권장)

## 추가 비용
- 크론 실행: Vercel Pro 포함
- AI 생성: ~$1.5~3/월 (Haiku)
- RSS/API: 0원

## 크론 총 수: 기존 95~97개 + 신규 4개 = 99~101개
