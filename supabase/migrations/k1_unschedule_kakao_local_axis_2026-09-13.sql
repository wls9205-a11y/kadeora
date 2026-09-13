-- HC_CLOSE_20260913 K-1 — 카카오 로컬 축 스케줄 비활성 (pg_cron 2본)
--
-- ① kakao_place_fetch (jobid 102, '0 3 * * *')
--    카카오 로컬 키워드 검색 소비. 로컬 API 403 SERVICE_DISABLED(2026-08-26~) 이고
--    2026-09-13 Node 판정으로 콘솔 복구 «영구 skip» — 산출 영구 0.
--    ⛔ kakao_place_queue 의 failed 2,000건은 리셋하지 않는다(데이터 보존).
--       403 이 영구라 리셋 = 재403 과금뿐이다. 라우트는 존치(수동 전용).
--
-- ② collect-complex-images-backup (jobid 119, '*/10 * * * *' → /api/cron/collect-complex-images)
--    ⚠️ 근거는 403 이 «아니다». 이 축은 카카오 «이미지» 검색(v2/search/image)으로 로컬 403 과 별개.
--    비활성 근거는 대상 0/39,556 완주 — 10분마다 빈 회차만 돈다. 본체 라우트 존치.
--
-- 이름 기준으로 지운다(jobid 하드코딩 금지). 없으면 조용히 넘어간다.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kakao_place_fetch') then
    perform cron.unschedule('kakao_place_fetch');
  end if;
  if exists (select 1 from cron.job where jobname = 'collect-complex-images-backup') then
    perform cron.unschedule('collect-complex-images-backup');
  end if;
end $$;
