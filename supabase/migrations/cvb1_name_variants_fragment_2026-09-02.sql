-- CV-B ① — 별칭 «조각» 원천 차단 (2026-09-02)
--
-- ⚠️ 이 함수가 name_variants 의 «진짜 생산자» 다. `src/lib/apt-name-variants.ts` 는
--    같은 규칙의 TS 포팅본이지만 «호출자가 하나도 없다»(CV-B ① 실측). 규칙을 고칠 때는
--    반드시 이 함수를 고치고, TS 는 문서용으로 같이 맞춘다.
--    경로: apt_sites INSERT/UPDATE(name·sigungu·dong·builder)
--          → trg_apt_sites_auto_variants → apt_sites_auto_variants()
--          → generate_apt_name_variants_jsonb()   ← 여기
--
-- 실측(활성 6,258현장 · 별칭 38,378개)이 잡아낸 조각 363개의 원인 셋:
--   ① 시군구 접미어 제거가 한 글자를 남긴다 — `중구`→「중」. 「대전 중 유천1구역
--      지역주택조합」류 134건. 동 43 · 남 42 · 북 37 · 서 36 도 같은 원인이다.
--   ② 동 접미어 제거가 한 글자를 남긴다 — `외동`→「외」. 「외 데시앙」.
--      sa.py name_pool() 이 별칭을 «짧은 순» 으로 채택하므로 이 조각이 그 현장의
--      1순위 파워링크 키워드가 된다 — 실제 오염 경로다.
--   ③ 단지명이 이미 시군구를 달고 있어도 또 붙인다 — 「김해김해외동재건축사업」.
--
-- ⚠️ 소비자(sa.py alias_is_fragment)를 조여서 막지 «않는다». 그 구조 규칙은 한때
--    「창원자이」·「경남아너스빌」 같은 살려야 할 결합형까지 죽여서 되돌린 이력이 있다.
--    생산자인 여기서 막는다.
-- ⚠️ 「한 글자 토큰이면 조각」으로 걸어도 안 된다 — 「더」 189 · 「린」 27 · 「뜰」 ·
--    「후」 는 이름에 원래 있는 글자다(『DS 더 웰가』·『우미 린』). 대표명이 붙여쓰기인
--    현장이 많아 «토큰» 비교도 안 된다(『가평센트럴파크더스카이』 ↔ 「가평 센트럴파크 더
--    스카이」). 그래서 기준은 «공백 지운 대표명이 그 글자를 품고 있느냐» 다.

CREATE OR REPLACE FUNCTION public.generate_apt_name_variants_jsonb(
  p_name text, p_sigungu text DEFAULT NULL::text,
  p_dong text DEFAULT NULL::text, p_builder text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  v_variants text[] := ARRAY[]::text[];
  v_short text;
  v_dong_clean text;
  v_brand text;
  v_tokens text[];
  v_bare text;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RETURN '[]'::jsonb; END IF;
  v_bare := regexp_replace(p_name, '\s+', '', 'g');

  v_variants := array_append(v_variants, p_name);
  v_variants := array_append(v_variants, v_bare);

  -- ① 시군구 짧은 형태. 목록에 없으면 접미어를 떼되 «한 글자면 떼지 않는다».
  v_short := CASE p_sigungu
    WHEN '마산합포구' THEN '마산' WHEN '마산회원구' THEN '마산'
    WHEN '진해구' THEN '진해' WHEN '의창구' THEN '의창'
    WHEN '성산구' THEN '성산' WHEN '해운대구' THEN '해운대'
    WHEN '수영구' THEN '수영' WHEN '연제구' THEN '연제'
    WHEN '부산진구' THEN '서면' WHEN '강서구' THEN '강서'
    WHEN '강동구' THEN '강동' WHEN '일산동구' THEN '일산'
    WHEN '일산서구' THEN '일산' WHEN '분당구' THEN '분당'
    ELSE (
      SELECT CASE WHEN length(c) >= 2 THEN c ELSE NULLIF(p_sigungu, '') END
      FROM (SELECT regexp_replace(COALESCE(p_sigungu, ''), '(시|군|구)$', '') AS c) s
    )
  END;

  -- ③ 이미 시군구를 달고 있으면 붙이지 않는다.
  IF v_short IS NOT NULL AND position(v_short IN p_name) = 0
     AND position(COALESCE(p_sigungu, '') IN p_name) = 0 THEN
    v_variants := array_append(v_variants, v_short || ' ' || p_name);
    v_variants := array_append(v_variants, p_sigungu || ' ' || p_name);
    v_variants := array_append(v_variants, v_short || v_bare);
  END IF;

  -- ② 동 + 단지명. 「동」을 뗀 형태는 두 글자 이상일 때만.
  IF p_dong IS NOT NULL AND length(p_dong) >= 2 THEN
    v_dong_clean := NULLIF(regexp_replace(p_dong, '동$', ''), '');
    IF length(COALESCE(v_dong_clean, '')) < 2 THEN v_dong_clean := NULL; END IF;
    IF position(p_dong IN p_name) = 0
       AND (v_dong_clean IS NULL OR position(v_dong_clean IN p_name) = 0) THEN
      v_variants := array_append(v_variants, p_dong || ' ' || p_name);
      IF v_dong_clean IS NOT NULL THEN
        v_variants := array_append(v_variants, v_dong_clean || ' ' || p_name);
      END IF;
    END IF;
  END IF;

  v_tokens := regexp_split_to_array(p_name, '\s+');
  IF array_length(v_tokens, 1) >= 3 THEN
    v_variants := array_append(v_variants,
      array_to_string(v_tokens[2:array_length(v_tokens,1)] || ARRAY[v_tokens[1]], ' '));
    v_variants := array_append(v_variants,
      v_tokens[2] || ' ' || v_tokens[1] || ' ' || array_to_string(v_tokens[3:array_length(v_tokens,1)], ' '));
  END IF;

  IF v_short IS NOT NULL AND array_length(v_tokens, 1) >= 3
     AND position(v_short IN v_tokens[1]) = 0 AND position(v_short IN p_name) = 0 THEN
    v_variants := array_append(v_variants,
      v_tokens[1] || ' ' || v_short || ' ' || array_to_string(v_tokens[2:array_length(v_tokens,1)], ' '));
  END IF;

  v_brand := CASE p_builder
    WHEN '삼성물산' THEN '래미안' WHEN 'GS건설' THEN '자이'
    WHEN '현대건설' THEN '힐스테이트' WHEN '대우건설' THEN '푸르지오'
    WHEN 'DL이앤씨' THEN '아크로' WHEN '포스코이앤씨' THEN '더샵'
    WHEN '롯데건설' THEN '롯데캐슬' WHEN '한화건설' THEN '포레나'
    WHEN '호반건설' THEN '호반써밋' WHEN 'HDC현대산업개발' THEN '아이파크'
    WHEN '두산건설' THEN '두산위브' WHEN '태영건설' THEN '데시앙'
    WHEN '동원개발' THEN '비스타' ELSE NULL
  END;

  -- ② 브랜드 결합형. 「동」을 «자르지 않은» 형태가 먼저다 — 「외동 데시앙」·「김해 외동 데시앙」.
  IF v_brand IS NOT NULL AND position(v_brand IN p_name) = 0 THEN
    IF v_short IS NOT NULL THEN
      v_variants := array_append(v_variants, v_short || ' ' || v_brand);
    END IF;
    IF p_dong IS NOT NULL AND length(p_dong) >= 2 THEN
      v_variants := array_append(v_variants, p_dong || ' ' || v_brand);
      IF v_short IS NOT NULL THEN
        v_variants := array_append(v_variants, v_short || ' ' || p_dong || ' ' || v_brand);
      END IF;
      v_dong_clean := NULLIF(regexp_replace(p_dong, '동$', ''), '');
      IF length(COALESCE(v_dong_clean, '')) >= 2 THEN
        v_variants := array_append(v_variants, v_dong_clean || ' ' || v_brand);
      END IF;
    END IF;
  END IF;

  -- 마지막 문 — 우리가 «잘라서 만든» 한 글자 조각이 든 변형은 내보내지 않는다.
  RETURN to_jsonb(ARRAY(
    SELECT DISTINCT v FROM unnest(v_variants) v
    WHERE v IS NOT NULL AND length(v) >= 3
      AND NOT EXISTS (
        SELECT 1 FROM unnest(regexp_split_to_array(v, '\s+')) t
        WHERE char_length(t) = 1 AND t ~ '[가-힣]' AND position(t IN v_bare) = 0
      )
  ));
END;
$function$;

COMMENT ON FUNCTION public.generate_apt_name_variants_jsonb(text, text, text, text) IS
  'apt_sites.name_variants 자동 생성기 (trg_apt_sites_auto_variants 경유). CV-B ① 조각 차단 반영. TS 사본: src/lib/apt-name-variants.ts';
