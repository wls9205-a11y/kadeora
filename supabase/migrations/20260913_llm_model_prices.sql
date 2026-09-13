-- FINAL_HC_20260913 B — LLM 쿼터 분모를 콜 수 → 크레딧(가중 비용)으로 옮길 «정본 단가표».
--
-- ⛔ 단가를 코드에 두지 않는다. gateway.ts 는 이 행만 읽는다 — 모델이 늘면 여기만 고친다.
--    단위: USD / 1M 토큰. cache_write·cache_read 는 생략 시 in 의 1.25배·0.1배로 계산.
--    출처: Anthropic 1st-party 공시 단가(claude-api 레퍼런스, 2026-06-24 캐시).
--
-- ⚠️ 이 마이그레이션은 «단가표만» 넣는다. 비용축 판정 스위치(stock_share_basis='cost')는
--    넣지 않는다 — 9/12 원장 재생에서 주식계열 12콜 중 1콜만 통과하는 결과가 나와
--    (부동산 일 지출 $0.21 의 1/9) 켜는 것은 판정 사항으로 남겼다. 켤 때:
--      INSERT INTO app_config(namespace,key,value) VALUES ('llm','stock_share_basis','"cost"'::jsonb)
--      ON CONFLICT (namespace,key) DO UPDATE SET value = EXCLUDED.value;
--    끌 때는 그 행을 지우거나 '"calls"' 로. 코드 배포 불필요(60s 캐시).

INSERT INTO app_config (namespace, key, value)
VALUES ('llm', 'model_prices', jsonb_build_object(
  'claude-haiku-4-5-20251001', jsonb_build_object('in', 1,  'out', 5),
  'claude-haiku-4-5',          jsonb_build_object('in', 1,  'out', 5),
  'claude-sonnet-5',           jsonb_build_object('in', 2,  'out', 10),
  'claude-sonnet-4-6',         jsonb_build_object('in', 3,  'out', 15),
  'claude-opus-5',             jsonb_build_object('in', 5,  'out', 25),
  'claude-opus-4-8',           jsonb_build_object('in', 5,  'out', 25),
  'claude-fable-5-1',          jsonb_build_object('in', 10, 'out', 50)
))
ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value;
