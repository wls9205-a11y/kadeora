-- CV-4 갭워치 관측 표 (2026-09-02, 프로덕션 적용 완료)
--
-- ⚠️ 이 표는 «값만» 든다. 지표 정의·임계·문구의 정본은 `src/lib/gap/metrics.ts` 다.
--    임계를 DB 에도 두면 두 판정이 갈린다 — 오늘 하루가 그 교훈이었다(생성기 이중화).
-- ⚠️ 델타 계산이 이 표의 존재 이유다. 절대값만 보면 「원래 큰 값」이 매주 울어서
--    사람이 알림을 끄고, 그 순간 결측 감시가 죽는다.

CREATE TABLE IF NOT EXISTS public.gap_watch_snapshots (
  id        bigserial primary key,
  taken_at  timestamptz not null default now(),
  metric    text not null,
  value     integer not null,
  severity  text,
  detail    jsonb
);

CREATE INDEX IF NOT EXISTS idx_gap_watch_metric_time
  ON public.gap_watch_snapshots (metric, taken_at DESC);

COMMENT ON TABLE public.gap_watch_snapshots IS
  'CV-4 갭워치 일일 관측. 지표 정의·임계는 src/lib/gap/metrics.ts 가 정본이고 이 표는 값만 든다.';

ALTER TABLE public.gap_watch_snapshots ENABLE ROW LEVEL SECURITY;
-- 서비스 롤(크론)만 쓰고 읽는다. 어드민 화면은 admin_alerts 로 본다.

-- ⛔ Vercel cron 에 넣지 «않는다». vercel.json 은 한도 100 에 도달해 있고, 추가하면
--    배포가 ERROR 로 죽는다(세션 145 교훈 · docs/CRON_REGISTRY.md). 신규는 pg_cron 이다.
-- 매일 06:40 KST(21:40 UTC). 하루 한 번 재고, 월요일이거나 임계를 넘으면 알림이 나간다.
SELECT cron.schedule('gap_watch_daily', '40 21 * * *',
  $$SELECT public._call_vercel_cron('/api/cron/gap-watch')$$);
