-- CV-N ① 브랜드 토큰 표 — «읽기» 단일 정본 (2026-09-08)
--
-- ── 왜 표인가 ───────────────────────────────────────────────────────────────
-- 지금 브랜드 목록은 «두 벌» 이다: 생성기 generate_apt_name_variants_jsonb 안의
-- 시공사→브랜드 CASE 13행과, 그것을 손으로 베낀 tools/naver-sa/sa.py 의 BRANDS.
-- 두 벌이면 반드시 갈라진다. 시군구 표를 DB 함수 한 곳에만 둔 것과 같은 원칙으로
-- 브랜드도 표 하나를 정본으로 둔다.
--
-- ⛔ 생성기를 고치지 않는다. CV-B 「이중 생산자 금지」 이자 sa.py 가 이미 적어 둔 규율이다
--    (「⛔ 그러니 생산자를 또 고치지 않는다」). 이 표는 «생산» 하지 않는다 —
--    sa.py 의 브랜드 판정과 N-1/N-2 의 질의 토큰이 «읽는» 자리다.
--    그래서 source='generator_parity' 13행은 생성기 CASE 와 «글자까지 같게» 둔다.
--    갈라지면 그것 자체가 결함이고, CV-4 야간 대사가 그 갈라짐을 본다.
--
-- ⚠️ 한 브랜드에 시공사가 둘일 수 있다(힐스테이트 = 현대건설·현대엔지니어링).
--    그래서 builders 는 배열이다. 반대로 한 시공사가 일반·고급 두 브랜드를 갖는다
--    (DL이앤씨 = e편한세상·아크로). 그래서 brand 가 PK 다.

CREATE TABLE IF NOT EXISTS public.brand_tokens (
  brand           text PRIMARY KEY,
  builders        text[]      NOT NULL DEFAULT '{}',
  tier            text        NOT NULL DEFAULT 'standard'
                              CHECK (tier IN ('standard','premium')),
  -- N-1 브랜드관 어댑터의 «레지스트리 행» 을 겸한다. 파서가 아니라 URL + 토큰이다.
  registry_url    text,
  registry_note   text,
  is_active       boolean     NOT NULL DEFAULT true,
  source          text        NOT NULL DEFAULT 'generator_parity'
                              CHECK (source IN ('generator_parity','n1_registry')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.brand_tokens IS
  'CV-N 브랜드 토큰 «읽기» 정본. 생산자(generate_apt_name_variants_jsonb)를 대체하지 않는다.';
COMMENT ON COLUMN public.brand_tokens.source IS
  'generator_parity = 생성기 CASE 와 글자까지 같아야 하는 13행 / n1_registry = N-1 브랜드관 확장';

CREATE INDEX IF NOT EXISTS brand_tokens_active_idx
  ON public.brand_tokens (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS brand_tokens_builders_idx
  ON public.brand_tokens USING gin (builders);

ALTER TABLE public.brand_tokens ENABLE ROW LEVEL SECURITY;
-- 내부 데이터다. 앱은 service_role(getSupabaseAdmin)로만 닿는다.
DROP POLICY IF EXISTS brand_tokens_service_all ON public.brand_tokens;
CREATE POLICY brand_tokens_service_all ON public.brand_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── ① 생성기 대응 13행 (글자 일치가 계약이다) ─────────────────────────────
INSERT INTO public.brand_tokens (brand, builders, tier, source) VALUES
  ('래미안',   ARRAY['삼성물산'],          'standard', 'generator_parity'),
  ('자이',     ARRAY['GS건설'],            'standard', 'generator_parity'),
  ('힐스테이트', ARRAY['현대건설'],         'standard', 'generator_parity'),
  ('푸르지오', ARRAY['대우건설'],          'standard', 'generator_parity'),
  ('아크로',   ARRAY['DL이앤씨'],          'premium',  'generator_parity'),
  ('더샵',     ARRAY['포스코이앤씨'],      'standard', 'generator_parity'),
  ('롯데캐슬', ARRAY['롯데건설'],          'standard', 'generator_parity'),
  ('포레나',   ARRAY['한화건설'],          'standard', 'generator_parity'),
  ('호반써밋', ARRAY['호반건설'],          'standard', 'generator_parity'),
  ('아이파크', ARRAY['HDC현대산업개발'],   'standard', 'generator_parity'),
  ('두산위브', ARRAY['두산건설'],          'standard', 'generator_parity'),
  ('데시앙',   ARRAY['태영건설'],          'standard', 'generator_parity'),
  ('비스타',   ARRAY['동원개발'],          'standard', 'generator_parity')
ON CONFLICT (brand) DO NOTHING;

-- ── ② N-1 브랜드관 레지스트리 확장 ────────────────────────────────────────
-- ⚠️ registry_url 은 «공식 브랜드관» 만 적는다. 호갱노노·아실·네이버부동산은
--    상속 원칙에서 크롤 금지다. 나무위키는 검증 참조일 뿐 소스가 아니다.
INSERT INTO public.brand_tokens (brand, builders, tier, registry_url, registry_note, source) VALUES
  ('디에이치',   ARRAY['현대건설','현대엔지니어링'], 'premium',
     'https://www.thehdc.co.kr', '현대건설 고급 브랜드관', 'n1_registry'),
  ('써밋',       ARRAY['대우건설'],        'premium',
     'https://www.daewooenc.com', '대우건설 고급 라인', 'n1_registry'),
  ('e편한세상',  ARRAY['DL이앤씨'],        'standard',
     'https://www.dlenc.co.kr',   'DL이앤씨 일반 라인', 'n1_registry'),
  ('오티에르',   ARRAY['포스코이앤씨'],    'premium',
     'https://www.poscoenc.com',  '포스코이앤씨 고급 라인', 'n1_registry'),
  ('르엘',       ARRAY['롯데건설'],        'premium',
     'https://www.lottecon.co.kr','롯데건설 고급 라인', 'n1_registry'),
  ('트리니빌',   ARRAY['두산건설'],        'premium',
     'https://www.doosanenc.com', '두산건설 고급 라인', 'n1_registry'),
  ('센트레빌',   ARRAY['동부건설'],        'standard', NULL, NULL, 'n1_registry'),
  ('한신더휴',   ARRAY['한신공영'],        'standard', NULL, NULL, 'n1_registry'),
  ('스위첸',     ARRAY['KCC건설'],         'standard', NULL, NULL, 'n1_registry'),
  ('해링턴',     ARRAY['효성중공업'],      'standard', NULL, NULL, 'n1_registry')
ON CONFLICT (brand) DO NOTHING;

-- 아크로관은 실증된 URL 이 있다(acro.co.kr 라로체 = 촉진3 · 3,545). 기존 행에 붙인다.
UPDATE public.brand_tokens
   SET registry_url = 'https://www.acro.co.kr',
       registry_note = 'DL이앤씨 아크로 브랜드관 — 단지명↔사업명↔주소↔세대수 공식 매핑 실증',
       updated_at = now()
 WHERE brand = '아크로' AND registry_url IS NULL;
