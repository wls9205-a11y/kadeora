# 🚀 KADEORA v2.1.0 — 배포 가이드

## 5개 팀 피드백 반영 완료 | 배포 준비 패키지

---

## 📋 이 패키지에 포함된 내용

### 보안팀 피드백 반영 (7건)
- ✅ `next.config.ts` — `ignoreBuildErrors: false` 복원, 보안 헤더 추가, CSP 설정
- ✅ `middleware.ts` — stock-debug 완전 차단, 인증 보호 라우트
- ✅ `src/lib/rate-limit.ts` — OTP/채팅/API rate limiting 구현
- ✅ `src/lib/sanitize.ts` — DOMPurify XSS 방어, URL 검증
- ✅ `vercel.json` — stock-debug 리다이렉트, 보안 헤더
- ✅ `.github/workflows/ci.yml` — TruffleHog Secret Scanning
- ✅ RLS 정책 강화 (마이그레이션 파일)

### 개발팀 피드백 반영 (7건)
- ✅ `src/app/(main)/write/` — 게시글 작성 페이지 **완전 복구**
- ✅ `src/app/payment/` — 토스 결제 페이지 **복구**
- ✅ `src/app/(main)/shop/megaphone/` — 상점 페이지 복구
- ✅ `src/app/(main)/profile/[id]/` — 프로필 페이지 복구
- ✅ `src/types/database.ts` — Supabase 타입 정의 (CLI 재생성 필요)
- ✅ `.github/workflows/ci.yml` — PR 기반 CI/CD, 타입 자동 생성
- ✅ `package.json` — Next.js 15.2.4 (CVE-2025-66478 패치)

### 전략기획팀 피드백 반영 (6건)
- ✅ 트렌딩 키워드 TOP 10 위젯 (피드 상단)
- ✅ `search_logs` / `view_logs` / `share_logs` 테이블 (마이그레이션)
- ✅ `trending_keywords` / `user_streaks` 테이블
- ✅ `supabase/functions/trend-aggregator/` — 열기 지수 Edge Function
- ✅ `src/app/api/trend/route.ts` — 트렌드 API
- ✅ `src/app/api/search/route.ts` — 검색어 로깅

### 마케팅팀 피드백 반영 (6건)
- ✅ `src/app/layout.tsx` — 전체 SEO 메타데이터, OG 태그, Schema.org
- ✅ `src/app/sitemap.ts` — 동적 사이트맵 생성
- ✅ `src/app/robots.ts` — robots.txt (관리자 페이지 제외)
- ✅ 각 페이지별 개별 metadata export
- ✅ `src/hooks/useKakaoShare.ts` — 카카오 공유 + 공유 로그
- ✅ 카카오 SDK 로드

### 법무팀 피드백 반영 (6건)
- ✅ `src/app/privacy/page.tsx` — 개인정보처리방침 (7개 수집항목, 위탁사 명시)
- ✅ `src/app/terms/page.tsx` — 서비스 이용약관 (8개 조항)
- ✅ `src/components/common/ConsentBanner.tsx` — 행태정보 수집 동의 배너
- ✅ `src/components/modals/ReportModal.tsx` — 콘텐츠 신고 프로세스
- ✅ `content_reports` 테이블 + RLS (마이그레이션)
- ✅ 결제 페이지 법적 안내 문구

---

## 🔧 배포 절차 (Step-by-Step)

### STEP 1: 기존 레포에 코드 병합

```bash
# 1. 기존 레포 클론
git clone https://github.com/wls9205-a11y/kadeora.git
cd kadeora

# 2. 새 브랜치 생성
git checkout -b feature/v2.1.0-team-feedback

# 3. 배포 패키지 압축 해제 (기존 파일 위에 덮어쓰기)
tar xzf kadeora-v2.1.0-deploy.tar.gz -C .

# 4. 의존성 설치
npm install

# 5. Supabase 타입 재생성 (⚠️ 중요!)
npx supabase gen types typescript \
  --project-id tezftxakuwhsclarprlz \
  --schema public \
  > src/types/database.ts

# 6. 타입 체크
npm run type-check

# 7. 빌드 확인
npm run build

# 8. 커밋 & 푸시
git add .
git commit -m "feat: v2.1.0 — 5개 팀 피드백 반영 통합 업데이트

- [CRITICAL] Next.js 15.2.4 업데이트 (CVE-2025-66478 패치)
- [CRITICAL] ignoreBuildErrors: false 복원
- [CRITICAL] stock-debug 차단, 보안 헤더 추가
- [HIGH] write/payment/megaphone/profile 페이지 복구
- [HIGH] 개인정보처리방침 + 이용약관 페이지 추가
- [HIGH] RLS 정책 강화 + rate limiting 구현
- [MEDIUM] 트렌딩 키워드 시스템 + 데이터 수집 인프라
- [MEDIUM] SEO 메타데이터 + sitemap + robots.txt
- [MEDIUM] 콘텐츠 신고 시스템 + 행태정보 동의 배너
- [LOW] CI/CD 파이프라인 + Secret Scanning"

git push origin feature/v2.1.0-team-feedback
```

### STEP 2: Supabase 마이그레이션 실행

```bash
# Supabase 대시보드 → SQL Editor에서 실행
# 파일: supabase/migrations/20260315_v2_1_team_feedback.sql

# 또는 CLI로:
npx supabase db push
```

### STEP 3: Edge Function 배포

```bash
# trend-aggregator 배포
npx supabase functions deploy trend-aggregator \
  --project-ref tezftxakuwhsclarprlz

# Cron Job 설정 (Supabase 대시보드 → Database → Cron Jobs)
# Schedule: */1 * * * * (매 1분)
# Command: SELECT net.http_post(
#   'https://tezftxakuwhsclarprlz.supabase.co/functions/v1/trend-aggregator',
#   '{}', 'application/json',
#   ARRAY[http_header('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'))]
# );
```

### STEP 4: Vercel 환경변수 설정

Vercel 대시보드 → Settings → Environment Variables:

| 변수명 | 값 | 환경 |
|--------|-----|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tezftxakuwhsclarprlz.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (Supabase에서 복사) | All |
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase에서 복사) | Production만 |
| `NEXT_PUBLIC_SITE_URL` | `https://kadeora.vercel.app` | All |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | (카카오 개발자에서 복사) | All |
| `TOSS_SECRET_KEY` | (토스페이먼츠에서 복사) | Production만 |
| `CRON_SECRET` | (32자 이상 랜덤 문자열) | Production만 |

### STEP 5: PR 머지 & 배포

```bash
# GitHub에서 PR 생성 후 CI 통과 확인
# feature/v2.1.0-team-feedback → main

# CI 체크 항목:
# ✅ TypeScript Type Check
# ✅ ESLint
# ✅ Build Success
# ✅ TruffleHog Secret Scan
# ✅ npm audit

# 모든 체크 통과 후 머지 → Vercel 자동 배포
```

### STEP 6: 배포 후 검증

```bash
# 1. 전체 페이지 스모크 테스트
# - /feed (피드 + 트렌딩 키워드)
# - /write (글쓰기)
# - /stock (주식 시세)
# - /apt (청약)
# - /discuss (토론방)
# - /shop/megaphone (상점)
# - /payment (결제)
# - /privacy (개인정보처리방침)
# - /terms (이용약관)
# - /login (로그인)

# 2. 보안 검증
# - stock-debug 접근 시 리다이렉트 확인
# - 비로그인 시 /write 접근 → /login 리다이렉트 확인
# - CSP 헤더 확인: curl -I https://kadeora.vercel.app

# 3. SEO 검증
# - https://kadeora.vercel.app/sitemap.xml 접근 확인
# - https://kadeora.vercel.app/robots.txt 접근 확인
# - Google Search Console에 sitemap 제출

# 4. Lighthouse 테스트
# - Chrome DevTools → Lighthouse → Mobile 90+ 목표
```

---

## 📁 프로젝트 파일 구조 (46개 파일)

```
kadeora/
├── .env.example                          # 환경변수 템플릿
├── .github/workflows/ci.yml             # CI/CD 파이프라인
├── .gitignore
├── eslint.config.mjs
├── next.config.ts                        # 보안 헤더 + CSP
├── package.json                          # Next.js 15.2.4
├── postcss.config.mjs
├── tsconfig.json
├── vercel.json                           # 보안 리다이렉트
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # SEO + Schema.org
│   │   ├── page.tsx                      # → /feed 리다이렉트
│   │   ├── sitemap.ts                    # 동적 사이트맵
│   │   ├── robots.ts                     # robots.txt
│   │   ├── (auth)/login/page.tsx         # 로그인
│   │   ├── (main)/
│   │   │   ├── layout.tsx                # 네비게이션
│   │   │   ├── feed/                     # 피드 + 트렌딩
│   │   │   ├── write/                    # 글쓰기 [복구]
│   │   │   ├── stock/                    # 주식 시세
│   │   │   ├── apt/                      # 청약 정보
│   │   │   ├── discuss/                  # 토론방
│   │   │   ├── shop/megaphone/           # 상점 [복구]
│   │   │   └── profile/[id]/            # 프로필 [복구]
│   │   ├── payment/                      # 결제 [복구]
│   │   ├── privacy/                      # 개인정보처리방침
│   │   ├── terms/                        # 이용약관
│   │   └── api/                          # API Routes
│   ├── components/
│   │   ├── common/ConsentBanner.tsx      # 동의 배너
│   │   └── modals/ReportModal.tsx        # 신고 모달
│   ├── hooks/useKakaoShare.ts            # 카카오 공유
│   ├── lib/
│   │   ├── rate-limit.ts                 # Rate Limiting
│   │   ├── sanitize.ts                   # XSS 방어
│   │   ├── supabase-browser.ts           # 클라이언트
│   │   └── supabase-server.ts            # 서버
│   ├── middleware.ts                      # 인증 + 보안
│   ├── styles/globals.css                # Tailwind v4
│   └── types/database.ts                # DB 타입
└── supabase/
    ├── migrations/                       # DB 마이그레이션
    └── functions/trend-aggregator/       # Edge Function
```

---

## ⚠️ 배포 전 필수 확인사항

| # | 항목 | 담당 |
|---|------|------|
| 1 | Supabase CLI로 `database.ts` 타입 재생성 | 개발팀 |
| 2 | Supabase 대시보드에서 `stock-debug` Edge Function 삭제 | 보안팀 |
| 3 | Supabase Auth → OAuth Redirect URI를 `kadeora.vercel.app`만 허용 | 보안팀 |
| 4 | Vercel 환경변수 6개 모두 설정 확인 | 개발팀 |
| 5 | 마이그레이션 SQL 실행 확인 | 개발팀 |
| 6 | `trend-aggregator` Edge Function 배포 + Cron 설정 | 개발팀 |
| 7 | GitHub Branch Protection: main 직접 push 금지 설정 | 개발팀 |
| 8 | 법무팀: 개인정보처리방침 내용 최종 검토 | 법무팀 |
| 9 | 마케팅팀: Google Search Console + Naver Webmaster 등록 | 마케팅팀 |
| 10 | 보안팀: 배포 후 전체 보안 스캔 실시 | 보안팀 |

---

**카더라 KADEORA v2.1.0 — 2026년 3월 15일**
**작성: Head (AI 지원) | 검토 필요: 전 팀**
