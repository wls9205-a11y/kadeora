-- PV2-B2 — 정비사업 현장의 «법정동» 을 채운 근거를 남긴다 (2026-09-05)
--
-- ── 왜 필요한가 ─────────────────────────────────────────────────────────────
-- 인허가 매칭의 후보는 «법정동 색인» 하나로 뽑는다. 그런데 부울경 공고 전 활성 현장
-- 489 중 402(82%)가 `dong` 결측이다 — 부산시 정비사업 API 가 위치 필드를 안 주고,
-- 그 현장들의 address 는 「가마실로 19, 2층」 같은 조합 사무실 주소라
-- extractDong 도 실패한다. 그래서 「대연8 재개발」은 색인에 «실리지도» 않았다.
--
-- ⛔ 조합 사무실 주소를 지오코딩해서 채우지 않는다. 2026-08-26 실측에서 그렇게 찍으면
--    엉뚱한 곳이 나왔다 — 좌표 없는 것보다 나쁘다.
-- ⚠️ 그래서 «어디서 왔는지» 를 같이 적는다. 자동 추정으로 채운 값과 원천이 준 값을
--    구분하지 못하면, 다음 사람이 추정을 사실로 읽는다.
alter table apt_sites
  add column if not exists dong_source text;

comment on column apt_sites.dong_source is
  'dong 을 채운 근거. redev_address=정비사업 원천 주소에서 추출 · zone_token=구역명 앞 글자를 그 시군구 법정동과 대조(유일 매치만) · null=원천이 준 값 또는 미상. PV2-B2(2026-09-05).';

create index if not exists idx_apt_sites_sigungu_dong
  on apt_sites (sigungu, dong) where is_active;

-- ── 배포 후 판독 (세션 A 교차) ──────────────────────────────────────────────
-- select region, dong_source, count(*) from apt_sites
--  where is_active and region in ('부산','울산','경남') group by 1,2 order by 1,3 desc;
--
-- ⚠️ 목표치를 두지 않는다. 「다의」와 「불일치」는 실패가 아니라 «모른다» 의 정직한 표기다.
--    비워 둔 것을 억지로 채우면 매칭이 틀린 현장에 인허가를 붙인다.
