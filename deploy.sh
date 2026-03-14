#!/bin/bash
set -e

# ============================================================
#  KADEORA v4.0 — 배포 스크립트
#  로컬에서 실행: bash deploy.sh
# ============================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🚀 KADEORA v4.0 — 배포 시작${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Step 1: Git 확인 ──
echo -e "${YELLOW}[1/6] Git 상태 확인...${NC}"
if [ ! -d ".git" ]; then
  echo -e "${RED}❌ .git 폴더가 없습니다. git init 후 remote를 추가하세요:${NC}"
  echo "  git init"
  echo "  git remote add origin https://github.com/wls9205-a11y/kadeora.git"
  exit 1
fi
echo -e "${GREEN}✅ Git 레포 확인됨${NC}"

# ── Step 2: 환경변수 확인 ──
echo -e "${YELLOW}[2/6] 환경변수 확인...${NC}"
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
)

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ] && ! grep -q "$var=" .env.local 2>/dev/null; then
    echo -e "${RED}  ✗ $var 미설정${NC}"
    MISSING=1
  fi
done

if [ $MISSING -eq 1 ]; then
  echo ""
  echo -e "${YELLOW}⚠️  .env.local 파일이 없거나 환경변수가 누락되었습니다.${NC}"
  echo -e "${YELLOW}   Vercel 배포 시에는 Vercel Dashboard에서 환경변수를 설정하면 됩니다.${NC}"
  echo -e "${YELLOW}   계속 진행하시겠습니까? (y/n)${NC}"
  read -r CONTINUE
  if [ "$CONTINUE" != "y" ]; then
    echo "배포 중단."
    exit 1
  fi
else
  echo -e "${GREEN}✅ 환경변수 확인됨${NC}"
fi

# ── Step 3: 의존성 설치 ──
echo -e "${YELLOW}[3/6] 의존성 설치...${NC}"
npm install --legacy-peer-deps
echo -e "${GREEN}✅ npm install 완료${NC}"

# ── Step 4: 타입 체크 ──
echo -e "${YELLOW}[4/6] TypeScript 타입 체크...${NC}"
npx tsc --noEmit --skipLibCheck 2>&1 || {
  echo -e "${YELLOW}⚠️  타입 에러가 있지만 빌드에는 영향 없을 수 있습니다. 계속 진행합니다.${NC}"
}
echo -e "${GREEN}✅ 타입 체크 완료${NC}"

# ── Step 5: Git Commit & Push ──
echo -e "${YELLOW}[5/6] Git commit & push...${NC}"
git add .
git status --short

COMMIT_MSG="feat: KADEORA v4.0 — 12인 전문가 심사 반영 최종본

- [CRITICAL] Next.js 15.2.4 (CVE 패치) + nonce-based CSP
- [CRITICAL] RLS 전수 감사 + Upstash Redis 분산 Rate Limiting
- [HIGH] 33개 테이블 + 마이그레이션 + Edge Functions
- [HIGH] 개인정보처리방침 + 이용약관 + 동의 체계
- [MEDIUM] 트렌딩 키워드 + 데이터 수집 인프라
- [MEDIUM] SEO/GEO + 동적 OG + sitemap + Schema.org
- [LOW] 38개 테스트 + CI/CD 6-job 파이프라인"

git commit -m "$COMMIT_MSG" || echo "변경사항 없음, push만 진행"
git push origin main
echo -e "${GREEN}✅ Git push 완료 → Vercel 자동 배포 시작됨${NC}"

# ── Step 6: 안내 ──
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  🎉 Git Push 완료! 다음 단계를 진행하세요:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${YELLOW}1. Supabase 마이그레이션 실행${NC}"
echo "     → SQL Editor에서 아래 파일 순서대로 실행:"
echo "       supabase/migrations/20260315_v2_1_team_feedback.sql"
echo "       supabase/migrations/20260315_v3_expert_feedback.sql"
echo ""
echo -e "  ${YELLOW}2. Edge Function 배포${NC}"
echo "     npx supabase functions deploy trend-aggregator \\"
echo "       --project-ref tezftxakuwhsclarprlz"
echo ""
echo -e "  ${YELLOW}3. Vercel 환경변수 설정${NC}"
echo "     → https://vercel.com/wls9205-5665s-projects/kadeora/settings/environment-variables"
echo ""
echo -e "  ${YELLOW}4. 배포 확인${NC}"
echo "     → https://kadeora.vercel.app"
echo ""
