# Architecture Rules — kadeora

본 문서는 코드 변경 시 반드시 지켜야 할 architecture-level 규칙 모음. 새 규칙은 추가만 하고 삭제/번호 재할당 금지 (PR/세션 노트와 cross-reference 됨).

## Rule #11 — STATUS.md 갱신 (existing)

코드 변경 commit 마다 `STATUS.md` head 에 세션/변경 요약을 추가한다. 변경 이유와 검증 방법까지 포함. (DB 측 변경은 supabase mcp 마이그레이션으로 별도 관리.)

## Rule #17 — Anthropic Batch API polling 워커는 결과를 한 번에 적용한다 (s205 신설)

**Rule**: Batch API polling 워커는 `batch.processing_status === 'ended'` 분기에서 다음 세 단계를 한 번에 (또는 graceful fallback 가능한 형태로) 처리한다:

1. `client.messages.batches.results(batch.id)` 또는 results URL fetch 로 JSONL 스트림 수신
2. `custom_id` 매핑 으로 도메인 테이블 (예: `blog_posts.meta_description`) UPDATE
3. 큐 entry 의 `status='completed'`, `completed_at=now()` 마킹 + batch row 의 `results_processed=true` 마킹

**Why**: 한 번 ended 된 batch 의 results URL 은 Anthropic 쪽에서 ~29일 내에 만료된다. ended 시점에 결과를 안 적용하면 이미 지불된 비용 (succeeded 5,504건/$수십) 이 회수 불가능해질 수 있다. s205 사례: 11개 batch ended, 큐 4,780 건이 13일째 in_progress 로 stuck.

**How to apply**:
- 워커 SELECT 시 `status IN ('submitted','in_progress','completed')` + `results_processed=false` 둘 다 조건. status 마킹은 됐는데 결과 적용 안 된 케이스를 다시 잡기 위함.
- results URL 또는 status fetch 가 404/410 반환 시 (=만료) `batch.status='expired'` + `results_processed=true` 만 마킹. 큐 entry 는 `pending` 으로 유지 → 다음 submit 워커가 재제출.
- 중간 단계 실패 (DB UPDATE) 시 batch 마킹은 보류 → 다음 polling tick 에 재시도. `batch_id` 는 큐 entry 에 보존되어야 한다.
- 비슷한 구조의 다른 큐 (예: `blog_image_batch` purpose=image, `apt_ai_batch`) 도 동일 패턴 적용.

**참고**: 직접 영향 워커 — `app/api/cron/blog-meta-rewrite-poll/route.ts`. 동일 패턴 워커 — `app/api/cron/blog-image-batch-poll/*`, `app/api/cron/apt-ai-batch-poll/*`.

## Rule #18 — vercel.json catch-all maxDuration 은 per-route export 를 override 한다 (s223 신설)

**Symptom**: route 안 `export const maxDuration = 60` 을 분명히 적었는데도 실제 배포된 함수는 30s 에서 timeout. cron 이 504 로 죽는데 코드만 보면 원인 안 보임.

**Cause**: vercel.json `functions` 의 catch-all glob (예: `src/app/api/**/*.ts`) 에 `maxDuration` 이 박혀 있으면 해당 glob 에 매치되는 모든 route 의 per-route export 를 silently override 한다. Vercel 빌드 단계에서 경고도 뜨지 않음.

**Rule**:
- vercel.json catch-all 은 짧은 외부 fetch 라우트 한정으로만 사용.
- cron / 무거운 SSR / OG image 처럼 긴 함수는 vercel.json 에 경로별 명시 override 또는 per-route export 단독 사용. 둘이 충돌하면 vercel.json 이 이긴다.
- 새 cron 추가 시 vercel.json 의 functions glob 매치 여부 우선 확인.

**Discovered**: s223 (2026-05-04) — stock-fundamentals-kr / data-quality-fix 504 timeout 추적 중 발견. 둘 다 route export 60 적었으나 catch-all 30 이 이김.
