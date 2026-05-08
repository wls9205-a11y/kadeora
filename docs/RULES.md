# 카더라 Architecture Rules (#1~#64)

`docs/STATUS.md`는 세션별 작업 기록, 이 파일은 최종 규칙 모음.

## OG / ImageResponse (next/og satori)
- **#43** ImageResponse 내 CSS variable (`var(--xxx)`) 금지 — satori 미지원
- **#44** ImageResponse `emoji: 'twemoji'` 옵션 금지 — fetch 차단
- **#46** ImageResponse string aspectRatio 금지 — 정수 width/height 사용
- **#47** ImageResponse JSX 내 emoji 직접 사용 금지
- **#48** OG_CAT/OG token 정의에 emoji 사용 금지 (한국어 1글자 또는 Unicode 도형)
- **#52** og 라우트 input string은 sanitize 통과 필수 (`sanitizeForOG`)
- **#53** og 라우트 sanitize 적용 위치는 fetch 결과 + safeStr 내부
- **#54** sanitize 정규식: 한자/일본어/CJK 호환/도형/전각/General Punctuation 모두 cover
- **#57** JS regex literal에 U+2028/U+2029 literal 금지 (반드시 `\u` escape)
- **#58** OG self-closing 장식 div에 음수% position + borderRadius:50% on absolute 금지
- **#59** satori `repeating-(linear|radial)-gradient` / `conic-gradient` 미지원
- **#60** OG ImageResponse React Fragment `<>...</>` 주의 (satori 일부 미지원, div wrap 권장)
- **#61** OG ImageResponse sub-pixel border (0.5px) 금지 — 1px 이상 사용
- **#62** `sanitizeRowForOG`는 string field 외 array element도 sanitize 필수

## Performance / Timeout
- **#16** 외부 fetch 라우트는 `export const maxDuration = 10`
- **#18** vercel.json catch-all maxDuration이 per-route export를 silently override
- **#49** dynamic page에서 `Promise.allSettled` 8개+ 동시 fetch 금지 (504 위험)
- **#51** ilike `%X%` 패턴 시 입력 string 길이 ≥ 3 검증 필수

## Schema / Data
- **#13** Supabase types에 없는 테이블은 `(sb as any).from()` 패턴
- **#15** `count: 'exact'`는 1,000행 미만 테이블만 (`count: 'estimated'` 기본)
- **#50** `apt_sites.region` vs `apt_subscriptions/transactions.region_nm` 컬럼명 일관성

## Cron
- **#19** cron 삭제 전 3종 검증: cron_logs 30d + pg_cron 등록 + src/ grep
- **#45** AdSense Tier 1 (`/blog/[slug]`) 외 페이지에는 광고 슬롯 금지

## Supabase Security
- **#17** 36 RLS 정책 + 50+ service_role 전용 RPC + `is_current_user_admin()` 헬퍼
- **#20** Kakao Marketing 5중 send guard
- **#55** Supabase view에 `WITH (security_invoker = on)` 필수
- **#56** Supabase function에 `SET search_path = public, pg_temp` 필수
- **#63** Supabase function REVOKE는 anon/authenticated만으로는 부족 — `PUBLIC`도 함께 (default privilege)
- **#64** trigger function 식별은 `pg_trigger.tgfoid` join이 100% 안전

## Schema (s259 추가)
- **#68** 일괄 UPSERT 테이블의 `created_at` 정확성 — 외부 공공 API 를 매일 전수 UPSERT 하는 테이블 (apt_subscriptions 등) 은 `updated_at` 만으로 신규 검출 불가. `created_at` 컬럼 + DEFAULT now() + BEFORE UPDATE 트리거로 OLD.created_at 보존 패턴 필수.
  ```sql
  CREATE OR REPLACE FUNCTION fn_<table>_preserve_created_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN
    IF TG_OP = 'UPDATE' AND OLD.created_at IS NOT NULL THEN
      NEW.created_at := OLD.created_at;
    END IF;
    RETURN NEW;
  END $$;
  ```
- **#69** 카드 view 표준 컬럼 시그니처 — 정보 과다 테이블 (50+ 컬럼) 은 카드용 view 별도 정의. 표준 16 컬럼: `id / slug_id / name / region / builder / date_start / date_end / dday_end / status / price_per_pyeong / supply_min,max / households / area_lineup / cover_image_url / tags / created_at`. 모든 카테고리 view 동일 시그니처 → 단일 `AptCardCompact` 컴포넌트 재사용.

## 워크플로
- **#11** `docs/STATUS.md`는 매 세션 prepend + commit/push 필수
- 두 PC 동시 작업: `git stash && git pull --rebase origin main && git stash pop` 의무
- DB 마이그레이션은 한 PC만, `IF NOT EXISTS` 강제

## 추가 (이전 #1~#10, #12, #21~#42 등 예전 규칙)
세부 항목은 git log + docs/STATUS.md 이력 참조.
