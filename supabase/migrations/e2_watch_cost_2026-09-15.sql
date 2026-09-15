-- E-2 — 감시 3종 손보기 (최종통합지시서_PQAB_20260915 §2 E-2)
--
-- 기준선(pg_stat_statements 누적, 2026-09-15 01:15Z):
--   cron_health_v2()            calls 59,287 · total 29,086,220ms · mean 491ms
--   ci_alert_monitor_tick()     calls  7,909 · total  7,669,509ms · mean 970ms
--   cron_replace_blog_body_og_batch() calls 4,493 · total 20,907,323ms   ← 부검 별건, 손대지 않음
--
-- 491ms 의 원인(1줄): «쿼리가 무거운 게 아니라 꼬리가 길다» — 24h 실측 p50 0.13s · p95 3.42s · max 53s.
--   각 단계는 단독 실행 0.1ms(EXPLAIN: idx_cron_logs_status 6 buffers). 평균을 끌어올리는 것은
--   cron_logs UPDATE / cron_locks DELETE 가 동시 기록자들과 부딪혀 기다리는 시간이다.
-- 처방: ① 주기 2분 → 10분  ② 함수 lock_timeout 3s — 기다리는 대신 그 단계만 건너뛰고(단계별 EXCEPTION 이 이미 있다) 다음 회전에 한다.
--
-- ⚠️ 「2분」은 s226(2026-05-04)에 30분 주기 때문에 duration_ms 가 가짜로 부풀던 버그를 «주기로» 덮으려던 값이다.
--    그 버그는 같은 날 check_pg_cron_responses 가 resp.created 기준으로 고쳐져 주기와 무관해졌다(Architecture Rule #19).
-- ⚠️ 10분이어도 밀리지 않는다: pg_cron_* 응답 24h 최대 12건/10분 < 회전당 LIMIT 50, 매핑 창 30분, pg_net 응답 보존 ≈6h.
-- ⚠️ 영향: 좀비 timeout 판정이 최대 +8분 늦어진다(15분 → 최대 25분). 만료 락 정리도 최대 10분 늦는다.
--
-- ci_alert_monitor_tick: 15분 → 1시간. KPI 4종이 7일·24h 집계라 15분 해상도가 의미가 없다. 조건(임계값)은 불변.

select cron.alter_job(job_id := 131, schedule := '*/10 * * * *');   -- cron_health_v2_2min (이름은 이력이라 유지)
select cron.alter_job(job_id := 68,  schedule := '4 * * * *');      -- ci-alert-monitor-15m (매시 04분 UTC = KST 매시 04분)

alter function public.cron_health_v2() set lock_timeout = '3s';
alter function public.ci_alert_monitor_tick() set lock_timeout = '3s';
