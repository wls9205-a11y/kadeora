#!/usr/bin/env bash
# LB-1 게이트 — Anthropic 호출은 «관문 하나» 로만 나간다 (2026-09-08 신설).
#
# ⛔ 왜 게이트가 필요한가 — 실측: 2026-09-08 기준 직접 호출부 55파일 중 원장을 거치는 것은
#    4개뿐이었다. 그래서 크레딧이 마른 48시간 동안 「성공 0건」이 그 4곳에서만 보였고
#    나머지 51곳의 침묵은 «아무 데도 남지 않았다».
#    한 번 모아 두어도 다음 사람이 무심코 fetch 를 쓰면 그 순간 다시 새기 시작한다.
#    그래서 사람의 규율이 아니라 CI 가 지킨다.
#
# ⚠️ 규칙은 «한 줄» 이다: src/lib/llm/gateway.ts 밖에서 api.anthropic.com 을 직접 부르지 않는다.
#    예외를 패턴으로 표현하려 들면 그 패턴이 곧 구멍이 된다 — batch poll 조차
#    anthropicPollFetch 라는 문을 지나가게 해서 예외를 없앴다.
set -euo pipefail
cd "$(dirname "$0")/.."

GATEWAY='src/lib/llm/gateway.ts'

# 관문 밖에서 anthropic 엔드포인트를 직접 호출하는 곳을 찾는다.
# (URL 상수 선언은 허용 — 실제 호출자가 관문이면 된다.)
hits=$(grep -rn --include='*.ts' --include='*.tsx' \
        -E "(fetch|fetchJson)[[:space:]]*\([[:space:]]*(['\"\`]https://api\.anthropic\.com|ANTHROPIC_API|ANTHROPIC_BATCH_URL)" \
        src 2>/dev/null | grep -v "^${GATEWAY}:" || true)

if [ -n "$hits" ]; then
  echo "❌ LB-1 게이트 실패 — 관문(${GATEWAY}) 밖에서 Anthropic 을 직접 호출합니다:"
  echo "$hits" | sed 's/^/   /'
  echo
  echo "   고치는 법: fetch(...) → anthropicFetch(..., { caller, category })"
  echo "              fetchJson(...) → anthropicJson(..., { caller, category })"
  echo "              배치 조회(GET .../batches/{id}) → anthropicPollFetch(...)"
  echo "   ⚠️ category 는 «호출부가 명시» 합니다. 경로로 추정하면 1:9 집계가 조용히 틀립니다."
  exit 1
fi

# ⚠️ SDK 경로는 URL 문자열이 없어 위 grep 에 «보이지 않는다». 2026-09-08 실측에서
#    apt-summary-gen 이 정확히 그렇게 빠져 있었다 — 56번째 호출부였고 원장에도
#    쿼터에도 안 잡혔다. 그래서 import 자체를 센다.
sdk=$(grep -rln --include='*.ts' --include='*.tsx' "@anthropic-ai/sdk" src 2>/dev/null       | grep -v -e "^${GATEWAY}$" -e '^src/lib/llm/usage-tracker.ts$' || true)
for f in $sdk; do
  if ! grep -q "anthropicCreate" "$f"; then
    echo "❌ LB-1 게이트 실패 — SDK 를 관문 없이 씁니다: $f"
    echo "   고치는 법: anthropic.messages.create(p)"
    echo "              → anthropicCreate((p) => anthropic.messages.create(p), p, { caller, category })"
    exit 1
  fi
done

echo "✅ LB-1 게이트 통과 — Anthropic 직접 호출 0건 · SDK 경로도 관문 경유"
