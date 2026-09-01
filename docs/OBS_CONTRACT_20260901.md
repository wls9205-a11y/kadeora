# 관측 계약 (OBS) — 2026-09-01 제정

> 목적: 「무엇을 보면 통과인지」를 문서에 고정한다. 기준이 세션 문맥에만 있으면 다음 사이클이 되물을 수 없고,
> 같은 자를 다시 세우다 서술과 실측이 섞인다. 측정할 때마다 이 표를 인용한다.
>
> 원칙: **자를 바꾸기 전에, 옛 자의 미제를 먼저 닫는다 — 바꾸고 나면 되물을 수 없다.** (2026-09-01 등재)

## 7항 — 대상·기간·통과 조건

| # | 항목 | 자 (테이블 · 조건) | 통과 조건 |
|---|---|---|---|
| ① | 이슈 attach 소생 | `cron_logs`, `issue-image-attach` 24h, Σ`metadata.images_attached` | **> 0** (finalized > 0 동반) |
| ② | 이슈 발 발행 | `cron_logs`, `issue-publish` 24h, Σ`records_created` (= auto_published) | **≥ 3 / 일** (BG-1 목표) |
| ③ | stale 수렴 | `issue_alerts`, `publish_decision = 'stale_hold'` 행 수 | **> 0** 이고 24h 발행분의 초안령 ≤ 3일 |
| ④ | 큐 투입분 발행 (v2) | 분모 := 해당일 `blog_image_backfill_queue` 투입 `post_id` 집합 · 통과 := 그중 `check_publish_gate(id).allowed` 수 · **「그중 발행 수」 병기** | 통과 = 집합 크기 |
| ⑤ | 광고 동시 노출 | 실기기 — 모바일 네이버 「일광더에스」 검색 | 두 캠페인 광고 동시 확인 스크린샷 |
| ⑥ | 신규 2편 발행 | `blog_posts` id 112007 · 112008 | `is_published` **2 / 2** |
| ⑦ | 롤업 자동 가동 | `apt_complex_profiles` — **`cron_logs`가 아니라 데이터로** (pg_cron 직행은 로그를 남기지 않는다) | 26h `updated` 행 > 0 ∧ `max(latest_sale_date)` ≥ 어제 − 2일 |

### 자 선택에 관한 주석

- **⑦은 로그가 아니라 데이터로 잰다.** pg_cron이 직행하는 작업은 `cron_logs`에 흔적을 남기지 않으므로, 로그 부재를
  미가동으로 읽으면 틀린다. 결과 테이블의 갱신 흔적이 정본이다.
- **부재 증거를 통과/실패의 근거로 쓰지 않는다.** 「0건」은 미구현과 적재 실패를 구분하지 못한다. 통과 판정은
  가능한 한 긍정형(행이 실제로 생겼다)으로 세운다.
- **관측 분모는 소비되지 않는 값으로 세운다.** ④ v1은 분모를 `auto_publish_eligible ≠ false`로 잡았는데,
  이 플래그는 `blog-auto-publish`가 공개 직후 false로 되돌리는 **1회용 티켓**이라 관측 시점의
  「true ∧ 미발행」은 항상 0이다(실측: 전체 6.4만 행 중 해당 0건). 소비되는 값은 분모가 될 수 없다.
- **가입 퍼널의 분자를 혼동하지 않는다.** `signup_attempts.success = true`는 **콜백 성공**이며
  기존 사용자 재로그인을 포함한다. 신규 가입 분자는 `profiles.provider='kakao' AND is_seed IS NOT TRUE`.
- **큐 상태는 `completed`만 보지 않는다.** `pending 0`은 소화의 증거가 아니다 — `failed`를 같이 세지 않으면
  실패가 완료로 읽힌다. (2026-09-01 ④⑥에서 실제로 발생: completed 15 · **failed 5**.)

## 2026-09-01 측정 결과 — 4 통과 · 2 미통과 · 1 대기

| # | 실측 | 판정 |
|---|---|---|
| ① | `images_attached` 83 · finalized 38 | ✅ BG-2 이후 첫 양수 |
| ② | 24h 발행 5 | ✅ 목표(3) 초과 |
| ③ | `stale_hold` 2,421 | ✅ 낡은 초안이 보류로 흘러듦 |
| ④ (v2) | 8/31 큐 투입 20 · **게이트 통과 15** · **그중 발행 0** | ❌ 게이트 이후 병목 (아래 B계) |
| ⑤ | — | ⏳ Node 스크린샷 대기 |
| ⑥ | 112007 · 112008 발행 **0 / 2** | ❌ → 사유: `image_count_lt_3 (0)` |
| ⑦ | 26h 갱신 12,846행 · max sale 08-29 | ✅ 03:12 자동 가동 실증 |

### ④⑥ 사유 (2026-09-01 CC 실측)

`check_publish_gate(112007)` · `(112008)` 둘 다 `allowed = false`, `reasons = ['image_count_lt_3 (0)']`.
`checks`: `has_cover true` · `has_excerpt true` · `internal_links 3` · **`real_image_count 0`**.
`blog_post_images`에 두 글의 행 **0건**.

거슬러 올라가면 `blog_image_backfill_queue`에서 두 글 모두
**`status = 'failed'` · `last_error = 'no_candidates'` · `current 0 / target 8` · `attempt_count 1`** (queued 08-31 04:05).
26h 큐 전체는 completed 15 · **failed 5** — 실패 5건 안에 이 두 글이 있다.

**④는 별개 결함이 아니다.** 26h 창의 일광 후보가 곧 이 2편이고(30일 내 일광 매칭 3건 중 1건은 8/5 기발행분),
분모가 2인 상태에서 임계 7을 걸어 미통과가 났다. ④의 임계 7은 근거 재확인 대상.

**요약: 이미지 후보 풀에 해당 주제 자산이 없어 backfill이 `no_candidates`로 실패 → 본문 이미지 0장 →
게이트의 3장 요건 미달 → 발행 차단.** 발행 파이프라인 자체의 고장이 아니라 이미지 공급의 결손이다.

### B계 — 게이트 통과 15편이 발행되지 않는 이유 (2026-09-01 CC 실측)

게이트는 15/15 열렸는데 발행 0. 원인은 이미지가 아니라 **발행 티켓 공급**이다.

1. **재채점이 안 걸린다.** 15편 전부 `quality_checked_at`이 이미지 부착(8/31 03:32)보다 앞선다.
   `blog-quality-score`는 「미평가 OR 30일 경과」만 보므로 8월에 채점된 글은 대상 밖.
   → **s268(i) 트리거로 해소**: `blog_post_images` INSERT 시 해당 글의 `quality_checked_at`을 NULL로.
2. **재채점해도 자격에 못 미친다.** `eligible = quality_score ≥ 65 ∧ seo_tier ∈ {S,A,restore_candidate} ∧ len ≥ 2500`.
   15편 전부 `seo_tier = 'B'`이고, **산식을 현재 값으로 다시 계산해도 전부 B로 남는다**
   (new_score 33~47, A 문턱 50, 최고 47).

**핵심: `seo_score` 산식에 이미지 항목이 없다.** 배점은 본문 길이·조회수·sub_category·source_ref·
반응·rewritten·제목뿐이다. 따라서 「tier B는 이미지 0장 시절의 채점」이라는 가설은 성립하지 않는다 —
이미지를 붙여도 티어는 1점도 움직이지 않는다.

**구조적 잠금:** 배점 25점이 걸린 `view_count`는 미발행 글에서 구조적으로 0~한 자릿수다.
발행돼야 조회가 생기고 → 조회가 있어야 A가 되고 → A여야 발행된다. 이 순환이 15편을 가둔 실체다.
