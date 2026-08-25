# T2 2부 — `is_active` 이력 추적 · 착수 전 보고

2026-08-25 · **트리거를 만들지 않았다.** T2 §2.3.2 가 "스키마가 다르면 컬럼을 맞추지 말고
보고할 것" 이라 했고, 실제로 다르다. 그리고 더 큰 문제가 하나 더 있다.

---

## 1. 스키마가 다르다 — ALTER 하지 않았다

T2 §2.2 의 트리거는 `old_value` · `new_value` · `changed_by` · `reason` 에 넣는다.
**넷 다 없다.**

| T2 안 | 실제 `apt_site_events` |
|---|---|
| `old_value` | `from_value` |
| `new_value` | `to_value` |
| `changed_by` | `source` |
| `reason` | `note` |
| — | `site_slug` · `confidence` · `source_url` · `occurred_at`(NOT NULL) |

컬럼을 추가하지 않고 **기존 컬럼에 얹는 것**으로 충분하다. 스키마 변경 없이 이렇게 된다.

```sql
CREATE OR REPLACE FUNCTION log_apt_active_change() RETURNS trigger AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    INSERT INTO apt_site_events
      (site_id, site_slug, event_type, from_value, to_value, source, note, occurred_at)
    VALUES (NEW.id, NEW.slug, 'active_change',
            OLD.is_active::text, NEW.is_active::text,
            coalesce(current_setting('app.actor', true), 'unknown'),
            nullif(current_setting('app.reason', true), ''),
            now());
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

**승인해 주시면 이대로 만든다.** (T2 §2.3.3 대로 `AFTER UPDATE OF is_active`)

---

## 2. ⚠️ 더 큰 문제 — 파이프라인 품질 게이트가 오염된다

`get_apt_pipeline` RPC 의 4신호 게이트가 **`event_type` 필터 없이** 이벤트 수만 센다.
(`src/lib/apt/pipeline-gate.ts` 주석에 집행 조건이 기록돼 있다)

```sql
((select count(*) from apt_site_events e where e.site_id = s.id) > 0)::int   -- 진행 이력
  + (s.builder is not null)::int
  + (coalesce(s.supply_units, s.complex_units, s.total_units) is not null)::int
  + (s.sigungu is not null)::int >= 2
```

`active_change` 이벤트가 쌓이면 **끄거나 켠 적이 있다는 사실만으로 「진행 이력」 신호가 생긴다.**
사업이 한 발짝도 안 나간 현장이 게이트를 통과한다.

이 게이트는 전국 206곳 → 93곳으로 걸러 내는 장치다. 절반 이상을 쳐내는 필터라
오염되면 그 효과가 그대로 무너진다.

**그래서 트리거를 만들기 전에 RPC 가 먼저 고쳐져야 한다.**

```sql
-- 이 조건이 event_type 을 가려야 한다
(select count(*) from apt_site_events e
  where e.site_id = s.id and e.event_type <> 'active_change') > 0
```

RPC 는 DB 담당 몫이다. 순서를 지키지 않으면 게이트가 조용히 헐거워진다.

### 다른 소비처는 안전하다 (grep 결과)

| 소비처 | `event_type` 필터 | 판정 |
|---|---|---|
| `get_apt_recent_moves` RPC | `= 'stage_change'` | 안전 |
| `api/cron/blog-district-redev` | `= 'stage_change'` | 안전 |
| `api/admin/apt-stage` | `= 'stage_change'` | 안전 |
| `api/cron/blog-weekly-movers` | stage_change 기준 | 안전 |
| **`get_apt_pipeline` 게이트** | **없음** | **오염됨** |

---

## 3. 대량 배치 폭증 여부 (T2 §2.3.4)

`AFTER UPDATE OF is_active` 라 `is_active` 를 UPDATE 문에 담지 않는 배치는 트리거를
아예 타지 않는다. B-3 같은 작업은 수십 건이라 문제없다.
다만 **전량 `is_active` 재계산 크론이 있다면** 매 실행마다 수천 건이 쌓인다.
`IS DISTINCT FROM` 가드가 값이 실제로 바뀐 행만 남기므로 정상 상태에서는 0건이지만,
그런 크론이 있는지는 확인이 필요하다 — 현재 `cron_logs` 에서 찾지 못했다.

---

## 4. 소급 금지 (T2 §2.3.1) — 지켰다

기존 219건을 채우지 않았다. 추정을 사실로 굳히게 된다.
이력은 트리거가 붙은 시점부터만 신뢰한다.

---

# 덤 — B-2 결함 하나를 발견해 고쳤다

`apt_sites` 트리거를 훑다가 **이미 `trg_normalize_builder`(`normalize_builder_name`)가
있는 것**을 발견했다. 그 함수는 `NEW.builder` 를 «제자리에서 다시 쓴다».

PostgreSQL 은 BEFORE ROW 트리거를 **이름 알파벳순**으로 실행한다.

```
trg_apt_sites_builder_normalized   ← 내가 B-2 에서 만든 것 (a…)  먼저 돈다
trg_normalize_builder              ← 기존 (n…)                    나중에 builder 를 바꾼다
```

내 것이 «원본» builder 로 배열을 만든 뒤 기존 트리거가 builder 를 갈아 치우므로,
저장이 끝나면 둘이 어긋난다.

```
builder = '디엘건설'  입력
  고치기 전:  builder='DL이앤씨'  builder_normalized=['디엘건설']   ← 불일치
  고친 뒤:    builder='DL이앤씨'  builder_normalized=['DL이앤씨']   ← 일치 (실측 확인)
```

마이그레이션 `m3_fix_builder_normalized_trigger_order` 로 트리거 이름을
`trg_sync_builder_normalized` 로 바꿔 기존 트리거 «뒤»에 돌게 했다. 함수는 그대로다.
현재 데이터 불일치는 0건이다(백필이 나중이었다) — 앞으로의 쓰기만 문제였다.

## ⚠️ 사전이 서로 어긋난다 — 판단 필요

기존 `normalize_builder_name()` 은 **`디엘건설` → `DL이앤씨`** 로 합친다.
B-2 에서 나는 이 둘을 **일부러 합치지 않았다** — DL건설은 구 삼호·고려개발이 합병한
별개 상장법인이고, DL이앤씨(구 대림산업)와 다른 회사다.

지금은 기존 트리거가 `builder` 자체를 바꿔 버리므로 **기존 사전이 이긴다.**
둘 중 하나는 틀렸다. 기존 트리거는 내 작업보다 앞서 있어 의도가 있을 수 있으니
**건드리지 않고 보고만 한다.**

`두산에너빌리티 → 두산건설` 도 같은 성격이다(에너빌리티는 발전 설비, 건설은 별개 법인).

---

# 실행 결과 (2026-08-25 · 승인 후)

승인대로 **RPC 를 먼저 고치고 트리거를 나중에** 붙였다.

## 1단계 — 게이트 필터 (`m3_pipeline_gate_filter_stage_change`)

`get_apt_pipeline` 의 「진행 이력」 신호를 `event_type = 'stage_change'` 로 좁혔다.
그 한 줄 외에는 함수의 어떤 것도 바꾸지 않았다.

| | 전국 | 부울경 | 부산 |
|---|---|---|---|
| 변경 전 | 417 | 360 | 344 |
| 변경 후 | **417** | **360** | **344** |

**한 건도 바뀌지 않았다.** 현재 `apt_site_events` 429행이 전부 `stage_change` 라
이 필터는 오늘 시점에 순수한 무동작이다 — 넣기 가장 안전한 시점이었다.

> ⚠️ `src/lib/apt/pipeline-gate.ts` 주석의 기준값(전국 93 · 부울경 35 · 부산 21,
> 2026-08-24)은 **낡았다.** 지금은 417 / 360 / 344 다. 게이트가 헐거워진 게 아니라
> 모집단이 커졌다(정비사업 277건 승격). 그 주석의 숫자로 검증하면 틀린 결론이 난다.

## 2단계 — 트리거 (`m3_t2_2_log_apt_active_change`)

```
log_apt_active_change()          AFTER UPDATE OF is_active
trg_apt_active_change            FOR EACH ROW
```

스키마는 그대로 두고 실재 컬럼에 얹었다.

| 담을 것 | 컬럼 |
|---|---|
| 이전 / 이후 | `from_value` / `to_value` |
| 배치명 또는 manual | `source` ← `app.actor`, 미선언 시 `unknown` |
| 사유 | `note` ← `app.reason` |
| 시각 | `occurred_at` = `now()` |

## 검증 (T2 §2.4)

| 항목 | 결과 |
|---|---|
| `is_active` 토글 → 이벤트 1건 | ✓ |
| `is_active` 외 컬럼만 변경 → 0건 | ✓ |
| 같은 값으로 다시 써도 0건 (`IS DISTINCT FROM` 가드) | ✓ |
| `set_config('app.actor', …)` 가 `source` 에 반영 | ✓ |
| 시험 행 원복 | ✓ `is_active=false` |
| 기존 소비처 — `get_apt_recent_moves` | ✓ 4건 정상 |
| 게이트 수치 유지 | ✓ 417 / 360 |
| B-4 「병합표 미등재」 0 유지 | ✓ |

시험으로 생긴 `active_change` 2건은 **지우지 않았다.** 실제로 토글이 있었던 게 맞고,
이력 테이블에서 행을 지우는 선례를 만들지 않는 편이 낫다.
`source='test:t2-2-verification'` 으로 라벨이 붙어 있다.

## 알려진 한계

한 트랜잭션 안에서 `is_active` 를 여러 번 바꾸면 `occurred_at` 이 전부 같다
(`now()` 는 트랜잭션 시각이다). 순서는 `id` 로 가른다.

## 배치가 지켜야 할 것

```sql
SELECT set_config('app.actor',  'cron:apt-quality-prune', true);
SELECT set_config('app.reason', 'content_score < 25', true);
-- 같은 트랜잭션 안에서 UPDATE 해야 실린다 (is_local = true)
```

선언하지 않으면 `unknown` 이 남는다. 그것도 정보다 — 사람이 콘솔에서 껐다는 뜻이다.

## 별도 티켓으로 넘긴 것

시공사 사전 충돌(`디엘건설 → DL이앤씨`, `두산에너빌리티 → 두산건설`)은
지시대로 **기존 사전이 이기는 상태 그대로** 두었다.
