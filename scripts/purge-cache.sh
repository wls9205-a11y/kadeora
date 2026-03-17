#!/usr/bin/env bash
# 캐시 퍼지 스크립트 — 전체 캐시를 오늘 날짜로 무효화 후 배포
set -euo pipefail

VERSION=$(date +%Y%m%d)
echo "🔄 캐시 버전 갱신: $VERSION"

# 1) .env.local 업데이트
ENV_FILE=".env.local"
if grep -q "NEXT_PUBLIC_CACHE_VERSION" "$ENV_FILE" 2>/dev/null; then
  sed -i "s/NEXT_PUBLIC_CACHE_VERSION=.*/NEXT_PUBLIC_CACHE_VERSION=$VERSION/" "$ENV_FILE"
else
  echo "NEXT_PUBLIC_CACHE_VERSION=$VERSION" >> "$ENV_FILE"
fi

# 2) public/sw.js CACHE_VERSION 업데이트
sed -i "s/const CACHE_VERSION = '[0-9]*';/const CACHE_VERSION = '$VERSION';/" public/sw.js

# 3) public/manifest.json version 업데이트
if command -v jq &>/dev/null; then
  jq --arg v "$VERSION" '.version = $v' public/manifest.json > tmp.json && mv tmp.json public/manifest.json
else
  sed -i "s/\"version\": \"[0-9]*\"/\"version\": \"$VERSION\"/" public/manifest.json
fi

# 4) Vercel 환경변수 업데이트
echo "📡 Vercel 환경변수 업데이트..."
npx vercel env rm NEXT_PUBLIC_CACHE_VERSION production --yes 2>/dev/null || true
echo "$VERSION" | npx vercel env add NEXT_PUBLIC_CACHE_VERSION production --yes

# 5) 빌드 확인
echo "🔨 빌드 중..."
npm run build

# 6) Git commit & push
git add -A
git commit -m "chore: cache bust $VERSION"
git push

# 7) 강제 배포
echo "🚀 Vercel 프로덕션 배포 (캐시 스킵)..."
npx vercel --prod --force --yes

echo "✅ 캐시 퍼지 완료: v$VERSION"
