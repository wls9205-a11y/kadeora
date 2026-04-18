-- [SAMIK-EXTEND] 삼익비치 5개 Spoke 본문 확장 (2026-04-19, 세션 137)
-- 이 마이그레이션 파일은 DB에 직접 적용된 UPDATE의 기록 목적입니다.
-- 실제 본문은 매우 길어서 여기에는 변경 메타만 기록. 본문은 blog_posts.content 참조.
--
-- 대상 5편 (각 1,700~2,800자 → 4,500자+ 확장):
--   86751 samik-beach-premium-by-size         (B2 입주권 프리미엄)
--   86752 samik-beach-member-eligibility-guide (C2 조합원 자격)
--   86754 samik-beach-busan-top3-compare      (E1 비교)
--   86755 samik-beach-area-15-complexes       (F1 영향권 15단지)
--   86756 samik-beach-public-sale-2028        (D1 일반분양)
--
-- 공통 반영 사항:
--   - big_event_registry.id=1 팩트 주입: 3,060 → 4,000+세대, 1979년 준공,
--     Stage 3, GS건설 그랑자이 수주 유력 (공식 확정 전)
--   - 카더라 부동산팀 manual 저자 유지
--   - FAQ 5개 → 10개로 확장
--   - 내부 링크 3개 → 5~6개로 확장 (Hub + 다른 Spoke + 허브 페이지)
--
-- 개별 반영:
--   B2: 평형별 수익 시나리오 3종(보수/중립/낙관) + 광안대교 조망 프리미엄 심층 분석
--   C2: 도시정비법 조문 4개 인용 + 실무 사례 3건 + 실무 타임라인 표
--   E1: 해운대 좌동·대연8 비교표 2개+ + 브랜드 프리미엄 추정 + 지역 경제 영향
--   F1: 15개 단지 각각 1~2줄 개별 분석 + 삼익비치 완공 시점별 3단계 영향 시나리오
--   D1: 청약 가점 시나리오 3종(신혼/4인/장기무주택) + 자금 계획 4단계 로드맵
--
-- 검증: 모든 5편 LENGTH(content) >= 4,423 (B2 4,739 · C2 4,733 · E1 4,549 · F1 4,714 · D1 4,939)

-- No-op marker for migration tracking. Actual content updates were applied via
-- MCP execute_sql UPDATE statements during session 137.
DO $$ BEGIN
  PERFORM 1 WHERE EXISTS (
    SELECT 1 FROM public.blog_posts
    WHERE id IN (86751, 86752, 86754, 86755, 86756)
      AND LENGTH(content) >= 4000
      AND source_type = 'manual'
  );
END $$;
