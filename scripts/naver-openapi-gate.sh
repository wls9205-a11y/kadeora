#!/usr/bin/env bash
# B4 게이트 — 네이버 오픈API(openapi.naver.com) 호출은 «관문 하나» 로만 나간다 (2026-09-17 신설).
#
# ⛔ 왜 — NAVER_CLIENT_ID 하나를 18곳이 나눠 쓰는데 원장이 없어 일일 쿼터 사용률을 아무도 몰랐다.
#    관문(src/lib/naver/openapi.ts)이 naver_openapi_usage_daily 에 적재한다. 관문 밖 호출은
#    원장에서 «조용히» 빠지고, 순위 배치 캡 자동 상향(naver_rank_cap_evaluate)이 과소 집계로 판정한다.
#
# 규칙: src 안에서 https://openapi.naver.com 문자열을 가진 파일은 관문을 import 해야 한다.
#       그리고 fetch(/fetchJson( 에 그 URL 을 직접 넘기지 않는다.
# 대상 아님: api.searchad.naver.com(검색광고) · searchadvisor · *.bak · scripts/ 의 블로그 글쓰기(OAuth Bearer).
set -euo pipefail
cd "$(dirname "$0")/.."

GATEWAY='src/lib/naver/openapi.ts'
fail=0

direct=$(grep -rn --include='*.ts' --include='*.tsx' \
  -E "(fetch|fetchJson)[[:space:]]*\([[:space:]]*['\"\`]https://openapi\.naver\.com" src 2>/dev/null \
  | grep -v "^${GATEWAY}:" || true)
if [ -n "$direct" ]; then
  echo "❌ B4 게이트 실패 — 관문 밖에서 openapi.naver.com 을 직접 fetch 합니다:"
  echo "$direct" | sed 's/^/   /'
  fail=1
fi

for f in $(grep -rl --include='*.ts' --include='*.tsx' "https://openapi\.naver\.com" src 2>/dev/null | grep -v "^${GATEWAY}$" || true); do
  if ! grep -q "@/lib/naver/openapi" "$f"; then
    echo "❌ B4 게이트 실패 — openapi.naver.com 을 쓰는데 관문을 import 하지 않습니다: $f"
    fail=1
  fi
done

if [ "$fail" -ne 0 ]; then
  echo
  echo "   고치는 법: fetch(url, init) → naverOpenApiFetch('<cron|admin>/<route>', url, init)"
  echo "              fetchJson(url, init, opts) → opts.fetcher = (u, i) => naverOpenApiFetch('<route>', u, i)"
  echo "   ⚠️ route 는 «호출부가 명시» 합니다. 공용 lib 는 호출 라우트를 인자로 받습니다."
  exit 1
fi
echo "✅ B4 게이트 통과 — 네이버 오픈API 직접 호출 0건"
