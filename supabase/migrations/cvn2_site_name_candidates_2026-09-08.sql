-- CV-N ② 예정명 후보 큐 + 쓰기 대장 (2026-09-08)
--
-- ── 무엇을 담는가 ───────────────────────────────────────────────────────────
-- 「아크로 라로체」 같은 «예정명» 이 태어나는 순간을 잡아 두는 자리다.
-- 사람은 「촉진3구역 재개발」을 검색하지 않는다 — 예정명이 검색 수요의 실체다.
--
-- ⛔ 미매칭을 폐기하지 않는다(상속 원칙). 매칭에 실패한 후보도 여기 남고,
--    N-1 은 그것을 presale_candidates 로 시드해 커버리지를 겸한다.
--
-- ── 티어 (N-3) ──────────────────────────────────────────────────────────────
--   T-A  공식 브랜드관 + 주소/사업명 매칭 → alias + display 즉시
--   T-B  win/name_confirm + 교차 1건       → alias + display 즉시
--   T-C  bid(수주전 «제안명»)              → 적용 금지·보류. win 도착 시 T-B 승격
--   T-역 rename/cancel                     → 삭제 금지. display 강등 + 별칭 유지
--
-- ⚠️ 제안명 ≠ 확정명이다. 수주전에서 진 컨소시엄의 제안명을 단지명으로 앉히면
--    그 현장을 영영 잘못 부른다. T-C 가 그 문이다.

CREATE TABLE IF NOT EXISTS public.site_name_candidates (
  id            bigserial PRIMARY KEY,
  site_id       uuid        REFERENCES public.apt_sites(id) ON DELETE SET NULL,
  proposed_name text        NOT NULL,
  event_type    text        NOT NULL
                            CHECK (event_type IN ('bid','win','name_confirm','rename','cancel')),
  tier          text        CHECK (tier IN ('T-A','T-B','T-C','T-역')),
  source        text        NOT NULL,          -- 'brand_registry:아크로' | 'news:naver' ...
  source_url    text,
  builder_raw   text,
  total_units   integer,
  region        text,
  confidence    numeric(4,3) CHECK (confidence >= 0 AND confidence <= 1),
  resolution    text        NOT NULL DEFAULT 'pending'
                            CHECK (resolution IN ('pending','applied','held','rejected','merge_queue','shadow')),
  note          text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  applied_at    timestamptz
);

COMMENT ON TABLE public.site_name_candidates IS
  'CV-N 예정명 후보 큐. resolution=applied 인 행은 «별칭이 실재해야» 한다 — CV-4 야간 대사가 대조한다.';

-- URL 중복 인입 봉쇄. issue 계열과 교차 dedup 하는 축이기도 하다.
CREATE UNIQUE INDEX IF NOT EXISTS site_name_candidates_url_name_uniq
  ON public.site_name_candidates (source_url, proposed_name)
  WHERE source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_name_candidates_site_idx
  ON public.site_name_candidates (site_id);
CREATE INDEX IF NOT EXISTS site_name_candidates_open_idx
  ON public.site_name_candidates (resolution, first_seen_at DESC)
  WHERE resolution IN ('pending','held','merge_queue','shadow');

ALTER TABLE public.site_name_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_name_candidates_service_all ON public.site_name_candidates;
CREATE POLICY site_name_candidates_service_all ON public.site_name_candidates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 쓰기 대장 (CV-B 거버넌스) ──────────────────────────────────────────────
-- 적용기가 «무엇을 언제 어떻게» 썼는지의 원장. 두 가지를 가능하게 한다:
--   ① revert 1회 뒤의 replay — 되돌림 규약을 승계한다
--   ② v1.2-B 자가치유 — 「applied ↔ 별칭 실재」 대사가 어긋나면 여기 값으로 재주입한다
--
-- ⚠️ 별칭이 소리 없이 사라질 수 있는 통로가 실재한다(DB 실측):
--    trg_apt_sites_auto_variants 는 BEFORE INSERT OR UPDATE OF name, sigungu, dong, builder
--    이고, 본문은 COALESCE(jsonb_array_length(NEW.name_variants),0) < 3 이면 «통째 교체» 다.
--    → 별칭«만» 쓰는 UPDATE 는 트리거를 아예 깨우지 않으므로 안전하고,
--      builder·dong 을 쓰는 UPDATE 는 그 시점 별칭이 3 미만이면 주입분을 지운다.
--    그래서 적용기의 규칙은 «트리거 컬럼 먼저, 별칭 마지막» 이다. 이 표가 그 증인이다.
--    실측(2026-09-08): 활성 6,285 중 별칭 3 미만 467건이 사정권이다.
CREATE TABLE IF NOT EXISTS public.site_name_applies (
  id            bigserial PRIMARY KEY,
  candidate_id  bigint      REFERENCES public.site_name_candidates(id) ON DELETE SET NULL,
  site_id       uuid        NOT NULL,
  op            text        NOT NULL
                            CHECK (op IN ('alias_add','display_set','display_demote',
                                          'builder_set','units_set','merge_deactivate','heal_realias')),
  before_value  jsonb,
  after_value   jsonb,
  run_id        text,
  applied_at    timestamptz NOT NULL DEFAULT now(),
  reverted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS site_name_applies_site_idx
  ON public.site_name_applies (site_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS site_name_applies_live_idx
  ON public.site_name_applies (op, applied_at DESC) WHERE reverted_at IS NULL;

ALTER TABLE public.site_name_applies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_name_applies_service_all ON public.site_name_applies;
CREATE POLICY site_name_applies_service_all ON public.site_name_applies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 킬스위치 2 ────────────────────────────────────────────────────────────
-- ⚠️ «끄기 위한» 스위치다. autoapply 는 사람이 켜지 않는다 — L2 셀프테스트가 켠다.
--    배포 직후 기본값은 OFF 이고, 그 상태가 곧 「섀도」다: 크론은 돌되 원장만 남고 적용 0.
INSERT INTO public.app_config (namespace, key, value, description) VALUES
  ('cvn', 'watcher_enabled',   'true'::jsonb,  'CV-N 워처·브랜드관 크론 가동 여부 (끄기용)'),
  ('cvn', 'autoapply_enabled', 'false'::jsonb, 'CV-N 자동 적용 여부. L2 셀프테스트 green 이 켠다. false = 섀도'),
  ('cvn', 'daily_ai_budget',   '40'::jsonb,    'CV-N N-2 워처의 일 AI 호출 상한')
ON CONFLICT (namespace, key) DO NOTHING;
