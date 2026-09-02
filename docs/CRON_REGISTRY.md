# 크론 레지스트리 (세션 147)

## ⛔ 관측 계약 (BG-0 · 2026-08-31)

산출형 크론은 `cron_logs.metadata` 에 다음을 남긴다. **동작이 아니라 관측만** 더한다.

| 키 | 뜻 |
|---|---|
| `scanned` | 큐에서 «본» 건수 |
| `eligible` | 조건을 통과해 «집은» 건수 |
| `created` | 실제로 만든 건수 |
| `reasons` | `{사유: 수}` 롤업 — 탈락·실패가 «왜» 인지 |

⛔ **`records_created` 를 성공·발행 판단에 쓰지 않는다.** 크론마다 그 수의 «뜻이 다르다»
   (`issue-draft` 는 초안이 아니라 auto_published 를 센다). 판정은 `metadata.reasons` 와
   해당 표면의 정본 테이블로 한다 — `docs/telemetry-map.md` §3.

⛔ **외부 API 실패는 «본문» 을 남긴다.** 상태코드만 남기면 「400 이 3,001건」까지는 알아도
   «왜» 는 영영 모른다(issue-draft 14일 실측이 그랬다). 런타임 로그는 보존·조회 예산에
   걸려 판정 근거가 못 된다 — 판정에 쓸 사실은 DB 에 둔다.

---

## CV-4 갭워치 (2026-09-02 추가)

| 잡 | 스케줄 | 경로 | 비고 |
|---|---|---|---|
| `gap_watch_daily` (pg_cron 171) | `40 21 * * *` (06:40 KST) | `/api/cron/gap-watch` | 커버리지 결측 7지표. 월요일 또는 임계 초과 시 `admin_alerts` 로 다이제스트 |

⛔ **Vercel cron 에 넣지 않았다** — 한도 100 도달분이라 추가하면 배포가 ERROR 로 죽는다.
   이 문서의 규칙(신규는 pg_cron)을 그대로 따랐다.
⚠️ 이 크론은 «아무것도 고치지 않는다». 재고, 적고, 사람에게 넘긴다. 자동 수정을 붙이면
   지표가 스스로를 낮추는 길이 생긴다.

## 현황 (2026-04-23)
- **Vercel Pro 크론 한도**: 100 개
- **현재 vercel.json 등록**: 100 개 (한도 정확히 도달)
- **Supabase pg_cron 등록**: 다수 (한도 없음)

신규 크론은 **반드시 pg_cron** 에 등록. Vercel cron 추가 시 배포 ERROR 발생 (세션 145 교훈).

## pg_cron 신규 등록 (세션 147)

| jobname | schedule | endpoint |
|---|---|---|
| `gsc-sync-daily` | `0 19 * * *` | `/api/cron/gsc-sync` |
| `blog-inject-images-hourly` | `25 * * * *` | `/api/cron/blog-inject-images` |
| `backlink-sync-weekly` | `0 4 * * 1` | `/api/cron/backlink-sync` |
| `programmatic-seo-consume-hourly` | `40 * * * *` | `/api/cron/programmatic-seo-consume` |
| `batch-poll-10min` | `*/10 * * * *` | `/api/cron/batch-poll` |

## pg_cron 기존 (발췌)
- `apt_satellite_crawl` — `*/30 * * * *` (세션 145 등록, `/api/cron/apt-satellite-crawl`)
- `kadeora-blog-image-supplement` — `0 */4 * * *`
- `kadeora-stock-image-crawl` — `30 */2 * * *`
- `kadeora-blog-image-validate` — `0 3 * * 1`
- `subscription_big_event_bridge` — `0 5 * * 1`
- `subscription_prebrief_generator` — `0 8 * * *`
- 기타 수십 개 (DB 쿼리: `SELECT jobname, schedule FROM cron.job`)

## 조회 쿼리
```sql
-- 전체 pg_cron 목록
SELECT jobname, schedule, active
FROM cron.job
ORDER BY jobname;

-- 최근 실행 결과
SELECT jobname, start_time, status, return_message
FROM cron.job_run_details
WHERE start_time > now() - interval '24 hours'
ORDER BY start_time DESC
LIMIT 50;

-- 실패 건
SELECT jobname, COUNT(*) AS fails
FROM cron.job_run_details
WHERE status != 'succeeded' AND start_time > now() - interval '24 hours'
GROUP BY jobname
ORDER BY fails DESC;
```

## Vercel vs pg_cron 분기 원칙

| 조건 | 도구 |
|---|---|
| 실시간 UI 관련 (sub-second) | Edge middleware (cron 아님) |
| 1분 이하 짧은 작업 | Vercel cron (단 한도 100 이내) |
| 1분~10분 | pg_cron (HTTP) |
| 10분 이상 장시간 | pg_cron + maxDuration 300 |
| Supabase DB 직접 조작 | pg_cron + SQL 함수 (HTTP 불필요) |
| 외부 API 호출만 | pg_cron + `_call_vercel_cron()` 헬퍼 |

## 인증
- Vercel cron: `Authorization: Bearer $CRON_SECRET`
- pg_cron: `_call_vercel_cron()` 헬퍼가 `x-pg-cron-secret` 헤더 자동 주입
- 라우트의 `verifyCronAuth()` 가 두 가지 모두 허용

## 장애 대응
- 특정 잡 반복 실패: `cron.unschedule('<jobname>')` 로 일시 중단
- 스케줄 변경: `cron.alter_job(<id>, schedule => '...')` 또는 unschedule 후 schedule 재등록
- 실행 로그: `cron_logs` 테이블 (애플리케이션 레벨) + `cron.job_run_details` (DB 레벨)
