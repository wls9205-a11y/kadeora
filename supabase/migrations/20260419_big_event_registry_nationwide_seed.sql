-- [TOP30-SEED] big_event_registry 전국 초기 시드
-- 원칙:
--   1. 명확하지 않은 건 넣지 않는다 (허위 정보 금지)
--   2. new_brand_name = NULL (수주 미확정 상태)
--   3. constructor_status = 'unconfirmed'
--   4. notes에 '수동시드/팩트검증필요' 명시
--   5. apt_complex_profile_id는 DB에서 확인된 경우만 기재
--
-- 2026-04-19 Claude Code — 세션 137
-- 삼익비치(id=1) 이후 전국 확장 seed

INSERT INTO public.big_event_registry (
  slug, name, full_name,
  region_sido, region_sigungu, region_dong,
  event_type, stage, scale_before, scale_after,
  build_year_before, build_year_after_est,
  key_constructors, new_brand_name, constructor_status,
  apt_complex_profile_id,
  priority_score, is_active,
  notes, fact_sources
) VALUES
-- ── 서울 ──
(
  'eunma-gangnam-redev', '은마', '대치 은마아파트 재건축',
  '서울특별시', '강남구', '대치동',
  '재건축', 3, 4424, NULL,
  1979, NULL,
  NULL, NULL, 'unconfirmed',
  '176175fa-1743-4ec7-affa-b760fd4facdf'::uuid,
  90, true,
  '수동시드/팩트검증필요. 4,424세대, 1979년 준공. 49층 정비계획 변경안 논의. 시공사·브랜드 미확정.',
  ARRAY['강남구청 정비계획 고시', '카더라 내부 노트']
),
(
  'mokdong-1-redev', '목동신시가지1', '목동신시가지 1단지 재건축',
  '서울특별시', '양천구', '목동',
  '재건축', 2, 1882, NULL,
  1985, NULL,
  NULL, NULL, 'unconfirmed',
  '69f3affc-1e3e-4119-ad82-15d43d018708'::uuid,
  85, true,
  '수동시드/팩트검증필요. 1,882세대 규모로 알려짐. 목동 14개 단지 중 1단지. 시공사·브랜드 미확정.',
  ARRAY['양천구청 정비계획 고시', '카더라 내부 노트']
),
(
  'yeouido-sibeom-redev', '시범', '여의도 시범아파트 재건축',
  '서울특별시', '영등포구', '여의도동',
  '재건축', 3, 1578, NULL,
  1971, NULL,
  NULL, NULL, 'unconfirmed',
  'cb3eef5c-b4dc-4041-a86a-7307e9e80a9d'::uuid,
  85, true,
  '수동시드/팩트검증필요. 여의도 최고(最古) 아파트 중 하나, 1971년 준공. 여의도 8개 재건축 단지 중 속도 상위. 시공사·브랜드 미확정.',
  ARRAY['영등포구청 정비계획 고시', '카더라 내부 노트']
),
(
  'yeouido-sambu-redev', '삼부', '여의도 삼부아파트 재건축',
  '서울특별시', '영등포구', '여의도동',
  '재건축', 2, 866, NULL,
  1975, NULL,
  NULL, NULL, 'unconfirmed',
  '20bba672-1618-4e73-ba74-687281a6b7dc'::uuid,
  75, true,
  '수동시드/팩트검증필요. 866세대 내외, 1975년 준공 여의도 삼부아파트. 시공사·브랜드 미확정.',
  ARRAY['영등포구청 정비계획 고시', '카더라 내부 노트']
),

-- ── 부산 ──
(
  'haeundae-jwadong-redev', '해운대 좌동', '해운대 좌동 일대 재건축 (통합 추정)',
  '부산광역시', '해운대구', '좌동',
  '재건축', 2, NULL, NULL,
  NULL, NULL,
  NULL, NULL, 'unconfirmed',
  NULL,
  72, true,
  '수동시드/팩트검증필요. 좌동 일대 다수 아파트 재건축 논의. 단지별 세대수/준공연도는 개별 확인 필요.',
  ARRAY['해운대구청 정비계획', '카더라 내부 노트']
),
(
  'daeyeon-8-redev', '대연8', '부산 남구 대연8구역 재개발',
  '부산광역시', '남구', '대연동',
  '재개발', 3, NULL, NULL,
  NULL, NULL,
  NULL, NULL, 'unconfirmed',
  NULL,
  70, true,
  '수동시드/팩트검증필요. 대연8구역 재개발 정비구역 지정. 총 세대수/시공사 공식 확정 전.',
  ARRAY['남구청 정비계획 고시', '카더라 내부 노트']
),
(
  'udong-1-redev', '우동1', '부산 해운대구 우동1구역 재건축',
  '부산광역시', '해운대구', '우동',
  '재건축', 3, NULL, NULL,
  NULL, NULL,
  NULL, NULL, 'unconfirmed',
  NULL,
  70, true,
  '수동시드/팩트검증필요. 해운대 우동1구역 재건축 논의. 정확한 세대수/시공사 공식 확정 전.',
  ARRAY['해운대구청 정비계획', '카더라 내부 노트']
)
ON CONFLICT (slug) DO NOTHING;
