# 카더라 KADEORA v4.0

주식·부동산·청약 금융 특화 커뮤니티 웹앱

## 기술 스택

- **Frontend**: Next.js 15.2.4 (App Router) + React 19 + TypeScript 5.7+ + Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL 17 + Auth + Realtime + Storage + Edge Functions)
- **Infra**: Vercel (Edge Network) + Upstash Redis (Rate Limiting)
- **Payment**: 토스페이먼츠
- **Security**: Nonce-based CSP, DOMPurify XSS 방어, Zod 입력 검증

## 배포 가이드

### 사전 준비

1. **GitHub 레포**: `https://github.com/wls9205-a11y/kadeora`
2. **Supabase 프로젝트**: `tezftxakuwhsclarprlz` (서울 리전)
3. **Vercel 프로젝트**: `kadeora`
4. **Upstash Redis** 인스턴스

### Step 1: Git Push

```bash
git add .
git commit -m "feat: KADEORA v4.0 — 전문가 심사 반영 최종본"
git push origin main
```

### Step 2: Supabase 마이그레이션

Supabase 대시보드 → SQL Editor에서 순서대로 실행:

```
1. supabase/migrations/20260315_v2_1_team_feedback.sql
2. supabase/migrations/20260315_v3_expert_feedback.sql
```

### Step 3: Edge Function 배포

```bash
npx supabase functions deploy trend-aggregator --project-ref tezftxakuwhsclarprlz
```

### Step 4: Vercel 환경변수

| 변수명 | 환경 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Production |
| `NEXT_PUBLIC_SITE_URL` | All |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | All |
| `TOSS_SECRET_KEY` | Production |
| `CRON_SECRET` | Production |
| `UPSTASH_REDIS_REST_URL` | All |
| `UPSTASH_REDIS_REST_TOKEN` | All |

### Step 5: 배포 확인

Vercel이 main 브랜치 push를 감지하면 자동 배포됩니다.

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run test       # 단위/통합 테스트
npm run test:e2e   # E2E 테스트
npm run type-check # 타입 체크
npm run gen-types  # Supabase 타입 재생성
```

## 라이선스

Private — Team KADEORA
