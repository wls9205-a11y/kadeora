-- PV-3b — confidence 어휘 «5값 통일» (2026-08-29 · D6 갱신 반영)
--
-- ── 무엇이 갈라져 있었나 ────────────────────────────────────────────────────
-- PV-1 은 apt_permits.match_confidence 에 「apt_sites.confidence 와 «같은 4단계» 를
-- 쓴다. 두 어휘를 만들지 않는다」고 주석까지 달아 4값으로 잠갔다.
-- ⚠️ 그런데 apt_sites 에는 «제약이 아예 없었고», 실제로 conflicting 이 쓰이고 있었다
--    (P0-4 구서3). 즉 「두 어휘를 만들지 않는다」는 선언은 지켜지지 «않았고»,
--    한쪽만 잠긴 채 다른 쪽이 자유롭게 늘어났다.
--
-- 실측(2026-08-29) apt_sites.confidence:
--   null 5,910 · confirmed 380 · estimated 27 · verified 5 · conflicting 1 · rumor 1
--   → 어긋난 값은 없다. 5값으로 «양쪽 다» 잠근다.
--
-- ⚠️ 적용 주의 — DDL 을 스모크와 «같은 트랜잭션에 두지 말 것».
--    스모크를 RAISE EXCEPTION 으로 되돌리는 관례가 ALTER TABLE 까지 함께 되돌린다.
--    2026-08-29 에 실제로 그렇게 조용히 롤백됐고, 제약을 다시 조회해서야 알았다.
alter table apt_permits drop constraint if exists apt_permits_match_confidence_chk;
alter table apt_permits add constraint apt_permits_match_confidence_chk
  check (match_confidence is null or match_confidence in
         ('rumor','estimated','confirmed','verified','conflicting'));

alter table apt_sites drop constraint if exists apt_sites_confidence_chk;
alter table apt_sites add constraint apt_sites_confidence_chk
  check (confidence is null or confidence in
         ('rumor','estimated','confirmed','verified','conflicting'));

comment on constraint apt_permits_match_confidence_chk on apt_permits is
  'D6 5값 통일(2026-08-29). PV-1 주석은 「apt_sites 와 같은 4단계」라 했지만 apt_sites 에는 conflicting 이 실제로 쓰이고 있었다 - 어휘가 갈라져 있었다.';

-- 스모크(별도 트랜잭션 · 예외 롤백): permits conflicting 허용 · permits 어휘밖 차단 ·
--   sites conflicting 허용 · sites 어휘밖 차단 — 4항 통과(2026-08-29).
--
-- ── 화면 쪽 참고 (세션 B 몫) ────────────────────────────────────────────────
-- expected_sale_source 어휘는 «이미» 5값으로 잠겨 있고 라벨 매핑과 1:1 이다:
--   permit → 건축HUB · news → 언론 보도 · builder → 시공사 ·
--   announcement → 모집공고 · admin → 자체 확인
-- ⛔ 출처 라벨을 「국토교통부 건축HUB」로 «고정» 하지 않는다 —
--    현 시드 2건(그랑라크·문수로)은 news 라 고정 라벨이면 첫 화면부터 거짓이 된다.
