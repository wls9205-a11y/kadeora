-- CV-B ① — 별칭 생성기 회귀 게이트 (읽기 전용 · 반복 실행 가능)
--
-- ⚠️ 별칭 생성기의 «정본» 은 generate_apt_name_variants_jsonb() 하나다 (이중 생산자 금지).
--    TS 사본 `src/lib/apt-name-variants.ts` 는 호출자 0 이어서 삭제했고, 그때 함께 사라진
--    단위 11케이스를 여기 옮겨 «DB에서 직접» 돌 수 있게 둔다. 규칙을 고치면 이 파일을 돌린다.

DO $$
DECLARE
  v jsonb;
  FAIL text := '';
  PROCEDURE_NOTE text := 'CV-B ① 회귀';
BEGIN
  -- ① 두 글자 동에서 「동」을 떼어 만든 조각을 내지 않는다 + 브랜드 결합은 자르지 않은 형태
  v := generate_apt_name_variants_jsonb('김해 외동 재건축사업','김해시','외동','태영건설');
  IF v ? '외 데시앙'                THEN FAIL := FAIL || '① 「외 데시앙」 재발; '; END IF;
  IF v ? '김해김해외동재건축사업'    THEN FAIL := FAIL || '① 시군구 중복 재발; '; END IF;
  IF NOT v ? '외동 데시앙'           THEN FAIL := FAIL || '① 「외동 데시앙」 누락; '; END IF;
  IF NOT v ? '김해 외동 데시앙'      THEN FAIL := FAIL || '① 「김해 외동 데시앙」 누락; '; END IF;

  -- ② 한 글자 «구» 이름 — 실측 최다 유형(중 134 · 동 43 · 남 42 · 북 37 · 서 36)
  v := generate_apt_name_variants_jsonb('대전 유천1구역 지역주택조합','중구','유천동','태영건설');
  IF v ? '중 데시앙'                             THEN FAIL := FAIL || '② 「중 데시앙」 재발; '; END IF;
  IF v ? '대전 중 유천1구역 지역주택조합'        THEN FAIL := FAIL || '② 중간 조각 재발; '; END IF;
  IF v ? '중대전유천1구역지역주택조합'           THEN FAIL := FAIL || '② 붙여쓴 조각 재발; '; END IF;
  IF NOT v ? '유천동 데시앙'                     THEN FAIL := FAIL || '② 「유천동 데시앙」 누락; '; END IF;

  -- ③ 되살려야 할 결합형 — s261 마산 자산 데시앙
  v := generate_apt_name_variants_jsonb('메트로시티 자산 데시앙','마산합포구','자산동','태영건설');
  IF NOT v ? '마산 메트로시티 자산 데시앙' THEN FAIL := FAIL || '③ 마산 결합형 소실; '; END IF;
  IF NOT v ? '메트로시티 마산 자산 데시앙' THEN FAIL := FAIL || '③ 끼워넣기 소실; '; END IF;

  -- ④ 「서면 롯데캐슬」 형 — 지역+브랜드 결합은 살린다
  v := generate_apt_name_variants_jsonb('양정3 재건축','부산진구','양정동','롯데건설');
  IF NOT v ? '서면 롯데캐슬' THEN FAIL := FAIL || '④ 「서면 롯데캐슬」 소실; '; END IF;

  -- ⑤ 이름에 원래 있는 한 글자 토큰은 죽이지 않는다 (「더」 189 · 「린」 27 · 「뜰」 · 「후」)
  v := generate_apt_name_variants_jsonb('가평 센트럴파크 더 스카이','가평군',NULL,NULL);
  IF NOT v ? '가평 센트럴파크 더 스카이' THEN FAIL := FAIL || '⑤ 「더」 결합형 오차단; '; END IF;
  v := generate_apt_name_variants_jsonb('강릉 우미 린 더 프리미어','강릉시',NULL,NULL);
  IF NOT v ? '강릉 우미 린 더 프리미어'  THEN FAIL := FAIL || '⑤ 「린」 결합형 오차단; '; END IF;

  IF FAIL <> '' THEN RAISE EXCEPTION '% 실패: %', PROCEDURE_NOTE, FAIL; END IF;
  RAISE NOTICE '% 11케이스 통과', PROCEDURE_NOTE;
END $$;
