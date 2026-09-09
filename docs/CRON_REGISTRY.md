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
| `gap_watch_daily` (pg_cron 171) | `40 21 * * *` (06:40 KST) | `/api/cron/gap-watch` | 커버리지 결측 **10지표**(2026-09-08 CV-N 3지표 추가). 월요일 또는 임계 초과 시 `admin_alerts` 로 다이제스트 |

⛔ **Vercel cron 에 넣지 않았다** — 한도 100 도달분이라 추가하면 배포가 ERROR 로 죽는다.
   이 문서의 규칙(신규는 pg_cron)을 그대로 따랐다.
⚠️ 이 크론은 «아무것도 고치지 않는다». 재고, 적고, 사람에게 넘긴다. 자동 수정을 붙이면
   지표가 스스로를 낮추는 길이 생긴다.

## CV-N 예정명 인리치 (2026-09-08 추가)

| 잡 | 스케줄 | 경로 | 비고 |
|---|---|---|---|
| `cvn_name_watch` | `10 21 * * *` (06:10 KST) | `/api/cron/cvn-name-watch` | 수주·명명 이벤트 워처 + 백필. 일 AI 상한은 `app_config('cvn','daily_ai_budget')` |
| `cvn_brand_registry` | `50 20 * * 0` (월 05:50 KST) | `/api/cron/cvn-brand-registry` | 브랜드관 어댑터. 주 1회 |
| `/api/cron/cvn-selftest` | (스케줄 없음) | `/api/cron/cvn-selftest` | **L2 게이트.** 배포 직후 1회 수동. green 이면 `cvn.autoapply_enabled` 를 켠다 |

⚠️ **`cvn_name_watch` 는 `gap_watch_daily`(06:40) 보다 «먼저» 돈다.** 그날 들어온 예정명이
   같은 날 갭워치 지표(`cvn_name_preempt`)에 실려야 하고, 갭워치가 야간 대사(별칭 자가치유)를
   겸하기 때문이다. 순서를 뒤집으면 지표가 하루씩 늦게 보인다.

⛔ **`cvn-selftest` 에 스케줄을 걸지 않는다.** 게이트는 «배포 직후 한 번» 이다. 매일 돌리면
   AI 호출을 매일 사고, 더 나쁘게는 어느 날의 일시적 실패가 자동 적용을 «꺼» 버린다.

### 킬스위치 (`app_config`, namespace `cvn`)

| 키 | 기본 | 뜻 |
|---|---|---|
| `watcher_enabled` | `true` | 끄면 크론 2본이 즉시 반환한다. **사람이 쓰는 유일한 스위치** |
| `autoapply_enabled` | `false` | `false` = 섀도(원장만 쌓고 적용 0). ⛔ 사람이 켜지 않는다 — L2 가 켠다 |
| `daily_ai_budget` | `40` | N-2 의 일 AI 콜 상한 |

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

---

## 퇴역 (retired)

| 잡 | 퇴역일 | 사유 | 대체 |
|---|---|---|---|
| `crawl-nationwide-redev` | 2026-09-05 | **엔드포인트 부재.** `apis.data.go.kr/1613000/MntncBizInfoSvc` 가 `400 NO_OPENAPI_SERVICE_ERROR`(returnReasonCode 12 · 「해당 오픈API 서비스가 없거나 폐기됨」). 태어나서 수신 0건(cron_logs 4회 · created 0) | A-2 공개 문서 소스 — 울산 `data.go.kr` 파일데이터 15055591 · 경남은 창원시 정비사업 통합누리집 |

**퇴역의 방식** — 파일을 지우지 않는다. 지우면 다음 사람이 「전국 정비사업 크롤러가
없네」 하고 **같은 엔드포인트로 다시 만든다**. 라우트는 자리에 남아 진입 즉시
`cron_logs` 에 `status='skipped'` 와 사유 한 줄을 남기고 돌아온다. 그 파일의 머리말이
판정 근거(보정 실험 포함)를 들고 있다.

**같이 끊은 것** — `vercel.json` 스케줄 엔트리 · `admin/refresh-all` · `admin/god-mode`
팬아웃 목록. ⚠️ 퇴역은 스케줄만 끊으면 끝나지 않는다. 「전체 실행」 버튼이 남아 있으면
사람이 손으로 다시 부른다.

> ⚠️ 판정 전 3중 확인: ① cron_logs 4회·created 0 ② pg_cron 등록 없음 ③ 저장소 내 호출자.
> ③ 이 «비어 있지 않았다» — admin 팬아웃 둘이 부르고 있었다. 그래서 그 둘도 같이 끊었다.
> gap-watch 지표 참조는 0건(확인함).

---

## ⏰ pg_cron 시각대 정본 — UTC · KST 병기 (2026-09-09 · 1회 정리)

### 먼저, 「혼재」는 등록에 있지 않다

실측: `cron.timezone = GMT`, `TimeZone = UTC`.
**모든 pg_cron 스케줄은 예외 없이 UTC 로 해석된다.** 일부는 UTC 로, 일부는 KST 로
등록되어 있다는 말은 성립하지 않는다 — pg_cron 은 잡마다 시각대를 갖지 않는다.

혼재는 «등록» 이 아니라 «의도» 에 있다. 어떤 잡은 저자가 원하는 KST 시각을 그대로
숫자로 썼고(그래서 9시간 어긋났고), 어떤 잡은 KST→UTC 환산을 해서 썼다.
표만 보면 둘이 똑같이 생겨서 구분되지 않는다 — 그래서 이 표가 필요하다.

⚠️ 2026-09-08 의 오독이 정확히 이 지점이었다. `cvn_name_watch` 의 `10 21 * * *` 를
   「밤 21:10 KST」로 읽었지만 실제는 **새벽 06:10 KST** 다.
   ⛔ 다만 `docs/CRON_REGISTRY.md` 자체는 틀리지 않았다 — 위 CV-N 절이 처음부터
      「06:10 KST」로 적고 있었다. 문서가 없어서가 아니라 안 봐서 틀렸다.

### ⛔ 날짜가 하루 밀리는 자리 (요일 지정 잡의 함정)

**UTC 시각이 15시 이상이면 KST 로는 «다음 날» 이다.** 매일 도는 잡은 상관없지만
요일을 지정한 잡은 요일 자체가 밀린다. 지금 해당되는 5본:

| 잡 | 등록(UTC 요일) | 실제 실행(KST 요일) |
|---|---|---|
| `cvn_brand_registry` | 일 20:50 | **월** 05:50 |
| `region-infer-backfill` | 일 19:00 | **월** 04:00 |
| `apt-interests-cleanup-weekly` | 일 19:00 | **월** 04:00 |
| `weekly_vacuum_analyze_blog` | 일 19:23 | **월** 04:23 |
| `blog-taxonomy-drift` | 월 21:50 | **화** 06:50 |

⚠️ `blog-taxonomy-drift` 는 이름·성격상 「주초」를 의도한 것으로 보이는데 실제로는
   화요일에 돈다. **판단이 필요한 자리라 여기 적어만 둔다 — 이번 정리에서 시각은
   하나도 바꾸지 않았다(변경은 별도 승인).**

### 고정 시각 잡 전수 (KST 이른 시각 → 늦은 시각 순)

분 단위·매시 잡(`* * * * *`, `*/5`, `*/15`, `45 * * * *` 등)은 시각대와 무관하므로
이 표에서 뺐다. 헷갈리는 것은 «하루 한 번 정해진 시각에 도는» 잡들뿐이다.

| 잡 | jobid | 스케줄(UTC) | UTC | **KST** | 요일 |
|---|---|---|---|---|---|
| `blog-stale-unpublish` | 136 | `0 17 * * *` | 17:00 | **02:00 (+1일)** | 매일 |
| `kadeora-naver-sc-sync` | 141 | `30 17 * * *` | 17:30 | **02:30 (+1일)** | 매일 |
| `apt-subscription-archive-daily` | 151 | `0 18 * * *` | 18:00 | **03:00 (+1일)** | 매일 |
| `kakao-channel-sync` | 132 | `0 18 * * *` | 18:00 | **03:00 (+1일)** | 매일 |
| `kadeora-refresh-search-trends` | 144 | `0 18 * * *` | 18:00 | **03:00 (+1일)** | 매일 |
| `aggregate-user-daily-summary` | 93 | `8 18 * * *` | 18:08 | **03:08 (+1일)** | 매일 |
| `ci-kpi-daily-snapshot` | 67 | `9 18 * * *` | 18:09 | **03:09 (+1일)** | 매일 |
| `sync-complex-profiles-daily` | 170 | `12 18 * * *` | 18:12 | **03:12 (+1일)** | 매일 |
| `view-logs-backfill-daily` | 38 | `25 18 * * *` | 18:25 | **03:25 (+1일)** | 매일 |
| `cover-image-backfill` | 138 | `30 18 * * *` | 18:30 | **03:30 (+1일)** | 매일 |
| `apt-marketing-leads-cleanup-daily` | 152 | `30 18 * * *` | 18:30 | **03:30 (+1일)** | 매일 |
| `admin_alerts_auto_archive` | 112 | `36 18 * * *` | 18:36 | **03:36 (+1일)** | 매일 |
| `og-cards-refresh` | 137 | `0 19 * * *` | 19:00 | **04:00 (+1일)** | 매일 |
| `region-infer-backfill` | 135 | `0 19 * * 0` | 19:00 | **04:00 (+1일)** | 일(UTC)→**월** |
| `enrich_apt_images_safe` | 128 | `0 19 * * *` | 19:00 | **04:00 (+1일)** | 매일 · **비활성** |
| `apt-interests-cleanup-weekly` | 153 | `0 19 * * 0` | 19:00 | **04:00 (+1일)** | 일(UTC)→**월** |
| `refresh_cron_health` | 117 | `0 19 * * *` | 19:00 | **04:00 (+1일)** | 매일 |
| `gsc-sync-daily` | 107 | `17 19 * * *` | 19:17 | **04:17 (+1일)** | 매일 |
| `auto_fill_related_slugs_daily` | 124 | `17 19 * * *` | 19:17 | **04:17 (+1일)** | 매일 |
| `weekly_vacuum_analyze_blog` | 127 | `23 19 * * 0` | 19:23 | **04:23 (+1일)** | 일(UTC)→**월** |
| `faq_extract` | 86 | `27 19 * * *` | 19:27 | **04:27 (+1일)** | 매일 |
| `search-engine-ping` | 139 | `0 20 * * *` | 20:00 | **05:00 (+1일)** | 매일 |
| `curate-refresh` | 166 | `40 20 * * *` | 20:40 | **05:40 (+1일)** | 매일 |
| `cvn_brand_registry` | 176 | `50 20 * * 0` | 20:50 | **05:50 (+1일)** | 일(UTC)→**월** |
| `check-seo-automation-health` | 158 | `0 21 * * *` | 21:00 | **06:00 (+1일)** | 매일 |
| `builder-watch-hanwoong` | 174 | `0 21 * * *` | 21:00 | **06:00 (+1일)** | 매일 |
| `cvn_name_watch` | 175 | `10 21 * * *` | 21:10 | **06:10 (+1일)** | 매일 |
| `blog-restore-pace` | 167 | `15 21 * * *` | 21:15 | **06:15 (+1일)** | 매일 |
| `lifecycle-stage-refresh` | 164 | `23 21 * * *` | 21:23 | **06:23 (+1일)** | 매일 · **비활성** |
| `gap_watch_daily` | 171 | `40 21 * * *` | 21:40 | **06:40 (+1일)** | 매일 |
| `blog-taxonomy-drift` | 169 | `50 21 * * 1` | 21:50 | **06:50 (+1일)** | 월(UTC)→**화** |
| `kadeora-series-autopublish` | 160 | `0 22 * * *` | 22:00 | **07:00 (+1일)** | 매일 |
| `apt-deadline-alert-daily` | 36 | `7 22 * * *` | 22:07 | **07:07 (+1일)** | 매일 |
| `naver_blog_content` | 178 | `30 22 * * *` | 22:30 | **07:30 (+1일)** | 매일 |
| `nv5_rank_target_lifecycle` | 179 | `50 22 * * *` | 22:50 | **07:50 (+1일)** | 매일 |
| `series-queue-watchdog` | 161 | `0 23 * * *` | 23:00 | **08:00 (+1일)** | 매일 |
| `in-app-digest-daily` | 35 | `15 23 * * *` | 23:15 | **08:15 (+1일)** | 매일 |
| `exchange-rate-morning` | 4 | `29 23 * * *` | 23:29 | **08:29 (+1일)** | 매일 |
| `consent-renewal-check` | 133 | `0 0 * * *` | 00:00 | **09:00** | 매일 |
| `consent-expiry-revoke` | 134 | `30 0 * * *` | 00:30 | **09:30** | 매일 |
| `signup-health-daily` | 92 | `35 0 * * *` | 00:35 | **09:35** | 매일 |
| `blog_meta_rewrite_submit` | 89 | `10 2 * * *` | 02:10 | **11:10** | 매일 |
| `kakao_place_fetch` | 102 | `0 3 * * *` | 03:00 | **12:00** | 매일 |
| `kadeora-blog-image-validate` | 56 | `9 3 * * 1` | 03:09 | **12:09** | 월 |
| `big_event_fact_refresh` | 62 | `47 3 * * *` | 03:47 | **12:47** | 매일 |
| `admin_alerts_archive_daily` | 122 | `13 4 * * *` | 04:13 | **13:13** | 매일 |
| `purge_cron_logs_daily` | 140 | `15 4 * * *` | 04:15 | **13:15** | 매일 |
| `backlink-sync-weekly` | 109 | `24 4 * * 1` | 04:24 | **13:24** | 월 |
| `apt_satellite_crawl` | 84 | `0 5 * * 1` | 05:00 | **14:00** | 월 |
| `subscription_big_event_bridge` | 63 | `24 5 * * 1` | 05:24 | **14:24** | 월 |
| `exchange-rate-afternoon` | 5 | `30 6 * * 1-5` | 06:30 | **15:30** | 평일 |
| `reactivate-dormant-weekly` | 39 | `4 10 * * 0` | 10:04 | **19:04** | 일 |
| `streak-alert-daily` | 37 | `5 12 * * *` | 12:05 | **21:05** | 매일 |

### 시간대 창을 갖는 잡

| 잡 | 스케줄(UTC) | KST 창 | 의도 |
|---|---|---|---|
| `dart-ingest-daily` | `*/15 0-9 * * 1-5` | **09:00~18:45 평일** | KST 업무시간에 맞춘 «환산 등록» 이다 |
| `kadeora-refresh-stock-issue-scores-weekday` | `3-58/15 0-15 * * 1-5` | **09:03~익일 00:58 평일** | 국내장+미국장 |
| `stock-fundamentals-kr` | `0 */2 * * 1-5` | 홀수시(01,03,…,23) | |
| `admin-issue-alerts-backfill` | `2 */3 * * *` | 00,03,06,…,21시 | |
| `blog_backfill_submit` · `cron-failure-watch` · `cron-health-monitor-6h` · `refresh-mv-seo-portal-stats` | `*/6` 계열 | 03,09,15,21시 | |

## ⛔ 신규 등록 규율 (2026-09-09 신설)

1. **스케줄은 UTC 로 쓴다.** 선택지가 없다 — `cron.timezone` 이 GMT 다.
2. **원하는 KST 시각에서 9를 «빼서» UTC 를 만든다.** 음수가 되면 24를 더하고
   요일 지정이 있으면 요일도 하루 «당긴다»(KST 월요일 = UTC 일요일 15시 이후).
3. **잡 이름 옆이나 이 문서에 KST 를 반드시 병기한다.**
   `SELECT cron.schedule('foo', '10 21 * * *', ...)  -- 06:10 KST` 처럼.
   ⚠️ pg_cron 의 `command` 는 주석을 보존하므로 커맨드 안에 KST 를 적어 두면
      `cron.job` 조회만으로도 의도가 보인다. 이 표를 다시 만들 필요가 없어진다.
4. ⛔ **「밤 9시에 돌린다」 같은 말로 합의하지 않는다.** 어느 시각대인지 말하지 않은
   시각은 절반의 확률로 9시간 틀린다 — 그게 어제 일어난 일이다.

### 이 표를 다시 만드는 법

```sql
-- 고정 시각 잡의 UTC·KST 병기
SELECT jobname, jobid, schedule,
       lpad(split_part(schedule,' ',2),2,'0')||':'||lpad(split_part(schedule,' ',1),2,'0') AS utc,
       lpad((((split_part(schedule,' ',2))::int + 9) % 24)::text,2,'0')
         ||':'||lpad(split_part(schedule,' ',1),2,'0')
         || CASE WHEN (split_part(schedule,' ',2))::int >= 15 THEN ' (+1d)' ELSE '' END AS kst,
       split_part(schedule,' ',5) AS dow_utc, active
  FROM cron.job
 WHERE split_part(schedule,' ',2) ~ '^\d+$'
 ORDER BY (((split_part(schedule,' ',2))::int + 9) % 24), (split_part(schedule,' ',1))::int;
```
