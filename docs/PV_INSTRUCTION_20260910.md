# PV_INSTRUCTION 20260910 — 병합 승계 신설 · 블로그 감사 결측 시드

**게이트: Node `!` 1회 (합본 3종).** 셋 다 코드 신설 · 상호 독립 · **광고 계정 무접촉**.
광고 측 게이트(PLN CSV · sa.py 회전 · 9/11 D_기축 재논의)와는 성격이 달라 분리 유지.

집행 순서는 **무공백 체인**이다. ③은 반드시 마지막 — 두 후보의 스테이징 기록이
어느 시점에도 0이 되지 않아야 감사 연속성이 유지된다.

```
① 마이그레이션 apply  →  ② DocCard 커밋 → ?source=doc:BLOG_20260910 실행 → 결과 확인
                                                                              ↓
                                                        ③ presale_candidates 130·131 삭제
```

---

## ① `merge_succession()` — 병합 데이터 승계 신설

### 왜 — 승계 단계가 «없다». 불완전한 게 아니라 부재다

2026-09-10 실측 3면:

| 면 | 결과 |
|---|---|
| `apt_site_merges` 열 구성 | `dead_slug · dead_name · survivor_slug · survivor_id · reason · merged_at` — **필드 데이터가 담기는 열 자체가 없다** |
| 이 표를 참조하는 public 함수 | **0건** |
| `apt_sites` 트리거 8개 중 승계 관련 | **0건** (auto_variants · normalize_builder · sync_builder_normalized · stage_change · lifecycle/price alert · active/change log) |

병합 기계는 **순수 301 리다이렉트 원장**이다. 그래서 「승계 coalesce 열 목록이 불완전하다 →
목록을 고쳐 전 쌍 백필」 경로는 **성립하지 않는다** — 고칠 대상 코드가 없다.

감만1이 그 부재의 실증이다. dead `감만1-재개발` 에 `total_units 9,092` · `builder '대우건설, 동부건설'`
이 고립되고 survivor `부산-감만1-재개발` 은 둘 다 NULL.

### 두 결정을 «가른다»

- **(a) survivor 선택** = slug 품질 · 노출 · 착지 축적. **이미 구현돼 있다** —
  `src/lib/apt/merged-slugs.ts` 헤더가 그 기준이다(생존자 선정에 slug 품질이 빠져 23쌍이
  거꾸로 잡혔던 것을 뒤집은 수정본). 감만1의 0324 생존은 그 기준의 정상 판정이다.
- **(b) 데이터 승계** = 열 단위 coalesce. 이 함수가 그것이고, **여기서 처음 생긴다.**

⚠️ 레코드 단위로 「리치한 쪽」을 고르지 않는다. 감만1에서 0824 쪽 `address` 는 사업지가 아니라
조합사무실(`우암로 134, 3층`)이고 `dong` 은 NULL 이었다. **열마다 답이 다르다.**

### 파일 — `supabase/migrations/cvb_merge_succession_2026-09-10.sql`

```sql
-- CV-B 병합 승계 — merge_succession() (2026-09-10)
-- 근거·설계: docs/PV_INSTRUCTION_20260910.md ①
--
-- ⛔ 이 함수는 «승계 전용» 이다. dead 비활성화(is_active=false)와 apt_site_merges 등재는
--    기존 병합 절차가 그대로 한다. 순서는 [승계 → 병합 등재 → gen-merged-slugs.mjs 재생성].
-- ⚠️ apt_site_merges 를 바꾸면 scripts/gen-merged-slugs.mjs 를 반드시 다시 돌린다.
--    301 맵(src/lib/apt/merged-slugs.ts)은 자동 생성물이고 middleware 가 그걸 읽는다
--    (src/middleware.ts:159). 이 짝을 빠뜨리면 구 slug 가 404 가 된다.

create or replace function public.merge_succession(
  p_dead_slug     text,
  p_survivor_slug text,
  p_dry           boolean default true,
  p_run_id        text    default null
)
returns table (field text, action text, dead_value text, survivor_value text)
language plpgsql
security definer
set search_path = public
as $$
declare
  d        public.apt_sites%rowtype;
  s        public.apt_sites%rowtype;
  v_entry  jsonb;   -- 함수 «진입 직후» 별칭. 원장의 before 는 언제나 이것이다.
  v_before jsonb;   -- 스칼라 UPDATE «직후» 별칭. 차집합 계산에만 쓴다.
  v_after  jsonb;
  v_add    jsonb;
  v_run    text := coalesce(p_run_id,
                            'merge_succession:' || to_char(now(), 'YYYYMMDDHH24MISS'));
begin
  select * into d from apt_sites where slug = p_dead_slug;
  if not found then raise exception 'dead slug 없음: %', p_dead_slug; end if;
  select * into s from apt_sites where slug = p_survivor_slug;
  if not found then raise exception 'survivor slug 없음: %', p_survivor_slug; end if;
  if d.id = s.id then raise exception 'dead 와 survivor 가 같은 행이다: %', p_dead_slug; end if;

  -- ⚠️ 진입 시점 별칭을 «먼저» 붙든다. 아래 스칼라 UPDATE 가 builder 를 SET 목록에
  --    넣는 순간 trg_apt_sites_auto_variants 가 발화하고, 그 시점 별칭이 3 미만이면
  --    name_variants 를 통째로 «교체» 한다. 원장의 before 가 교체«후» 값이면 그 행은
  --    복원 근거가 되지 못한다 — 덮인 사실만 남고 덮이기 전 값이 사라진다.
  --    (감만1은 vn=13 이라 무관하나, 미래 쌍에는 vn<3 이 실재한다. 활성 6,285 중 467건.)
  v_entry := coalesce(s.name_variants, '[]'::jsonb);

  drop table if exists _rep;
  create temp table _rep (field text, action text, dead_value text, survivor_value text)
    on commit drop;

  -- ⑴ 화이트리스트 6열 — coalesce 로 «빈 칸만» 채운다.
  --    ⚠️ builder 는 '' 로 들어온 행이 많다. nullif 로 빈 문자열을 NULL 과 같이 본다.
  insert into _rep
  select w.f,
         case
           when w.dv is null                   then 'skip · dead 값 없음'
           when w.sv is null                   then case when p_dry then 'would_fill' else 'filled' end
           when w.dv is not distinct from w.sv then 'same'
           else '⚠ CONFLICT · 자동 갱신 안 함 — 검수'
         end,
         w.dv, w.sv
  from (values
    ('total_units',   nullif(d.total_units::text, ''),   nullif(s.total_units::text, '')),
    ('complex_units', nullif(d.complex_units::text, ''), nullif(s.complex_units::text, '')),
    ('builder',       nullif(d.builder, ''),             nullif(s.builder, '')),
    ('dong',          nullif(d.dong, ''),                nullif(s.dong, '')),
    ('region',        nullif(d.region, ''),              nullif(s.region, '')),
    ('sigungu',       nullif(d.sigungu, ''),             nullif(s.sigungu, ''))
  ) as w(f, dv, sv);

  -- ⑵ 제외 2열 — 「사업지 vs 조합사무실」은 값 «유무» 가 아니라 «의미» 검사다.
  --    자동화 밖. 값이 갈리면 언제나 사람이 본다.
  insert into _rep
  select w.f, '⛔ 자동 승계 제외 · 검수 큐', w.dv, w.sv
  from (values
    ('address',         d.address,         s.address),
    ('lifecycle_stage', d.lifecycle_stage, s.lifecycle_stage)
  ) as w(f, dv, sv)
  where w.dv is distinct from w.sv and w.dv is not null;

  if p_dry then
    -- 별칭은 집행 경로에서 «다시» 계산한다(트리거가 갈아엎을 수 있어서). 여기선 예고만.
    select coalesce(jsonb_agg(distinct e.value), '[]'::jsonb) into v_add
      from jsonb_array_elements(coalesce(d.name_variants, '[]'::jsonb)) e
     where not (coalesce(s.name_variants, '[]'::jsonb) @> jsonb_build_array(e.value));
    insert into _rep values ('name_variants',
      'would_append ' || jsonb_array_length(v_add), v_add::text,
      coalesce(s.name_variants, '[]'::jsonb)::text);
    return query select * from _rep order by field;
    return;
  end if;

  -- ── 집행 ────────────────────────────────────────────────────────────────────
  -- ⚠️ RULES#146. 트리거 컬럼을 «먼저» 한 문장으로 쓴다. builder 하나가
  --    trg_normalize_builder · trg_sync_builder_normalized · trg_apt_sites_auto_variants
  --    셋을 동시에 깨우고, 그 시점 별칭이 3 미만이면 auto_variants 가 name_variants 를
  --    통째로 «교체» 한다. 그래서 별칭은 언제나 마지막이다.
  -- ⑶ coalesce 라 survivor 의 non-null 값은 구조적으로 덮이지 않는다 —
  --    CONFLICT 행은 보고서에만 남고 DB 는 손대지 않는다.
  update apt_sites set
      total_units   = coalesce(total_units,             d.total_units),
      complex_units = coalesce(complex_units,           d.complex_units),
      builder       = coalesce(nullif(builder, ''),     nullif(d.builder, '')),
      dong          = coalesce(nullif(dong, ''),        nullif(d.dong, '')),
      region        = coalesce(nullif(region, ''),      nullif(d.region, '')),
      sigungu       = coalesce(nullif(sigungu, ''),     nullif(d.sigungu, '')),
      updated_at    = now()
   where id = s.id;

  -- ⚠️ 위 UPDATE 가 별칭을 갈아엎었을 수 있다. «다시 읽고» 나서 차집합을 구한다.
  select name_variants into v_before from apt_sites where id = s.id;

  -- 교체가 실제로 일어났으면 «그 사실» 을 보고서에 세운다. 조용히 지나가지 않는다.
  if v_entry is distinct from coalesce(v_before, '[]'::jsonb) then
    insert into _rep values ('name_variants ⚠ auto_variants 발화',
      'RULES#146 — 스칼라 쓰기가 별칭을 교체했다. 아래 append 에서 같은 트랜잭션 자가 복원',
      v_entry::text, coalesce(v_before, '[]'::jsonb)::text);
  end if;

  -- 붙일 것 = [dead 의 별칭] ∪ [진입 시점 별칭 중 사라진 것] — 현재 상태에 없는 것만.
  -- ⚠️ 두 번째 항이 «자가 복원» 이다. auto_variants 가 교체해 날아간 진입 시점 별칭을
  --    같은 트랜잭션에서 되돌린다. 야간 heal 에 맡기지 않는 이유:
  --    heal_realias 는 「site_name_candidates.resolution='applied' ↔ 별칭 실재」를 대조하는데,
  --    승계 별칭은 dead 레코드에서 오지 후보 행에서 오지 않는다 — 대조할 짝이 «없다».
  --    원장은 복원의 «근거» 일 뿐이고, 근거만으로는 사람이 손을 대야 한다.
  select coalesce(jsonb_agg(distinct e.value), '[]'::jsonb) into v_add
    from (
      select value from jsonb_array_elements(coalesce(d.name_variants, '[]'::jsonb))
      union
      select value from jsonb_array_elements(v_entry)
    ) e
   where not (coalesce(v_before, '[]'::jsonb) @> jsonb_build_array(e.value));

  -- ⑷ 별칭 마지막. name_variants «만» 쓰는 UPDATE 는 감시 컬럼이 아니라 트리거를 안 깨운다.
  if jsonb_array_length(v_add) > 0 then
    update apt_sites
       set name_variants = coalesce(name_variants, '[]'::jsonb) || v_add,
           updated_at    = now()
     where id = s.id
    returning name_variants into v_after;
  else
    v_after := v_before;
  end if;

  insert into _rep values ('name_variants',
    'appended ' || jsonb_array_length(v_add), v_add::text, v_after::text);

  -- ⑸ 원장. 스칼라 변경은 trg_apt_change_log 가 이미 전부 잡으므로 여기엔 «별칭만» 적는다 —
  --    before/after 를 별칭 배열로 두어 alias_add 와 모양을 같게 유지해야
  --    heal_realias 야간 대사가 같은 규칙으로 읽는다.
  -- ⚠️ before 는 v_before(스칼라 UPDATE 후)가 아니라 v_entry(함수 진입 직후)다.
  --    auto_variants 가 중간에 교체했더라도 이 한 행이면 원상 복원이 선다.
  insert into site_name_applies (site_id, op, before_value, after_value, run_id, applied_at)
  values (s.id, 'merge_succeed', v_entry, v_after, v_run, now());

  return query select * from _rep order by field;
end;
$$;

comment on function public.merge_succession(text, text, boolean, text) is
  '병합 데이터 승계 — 열 단위 coalesce. p_dry=true 가 기본(보고서만). '
  'address·lifecycle_stage 는 의미 검사라 자동 승계 제외. 근거: docs/PV_INSTRUCTION_20260910.md';
```

### 첫 적용례 — 감만1

수동 UPDATE 를 두지 않는다. 신설된 함수의 첫 적용으로 흡수한다.

```sql
select * from merge_succession('감만1-재개발', '부산-감만1-재개발');            -- dry, 보고서 확인
select * from merge_succession('감만1-재개발', '부산-감만1-재개발', p_dry => false);
```

**기대 보고서** (실측 기반 예측 — 어긋나면 멈추고 판정):

| field | action |
|---|---|
| `builder` | `filled` — dead `'대우건설, 동부건설'` → survivor NULL |
| `total_units` | `filled` — 9,092 → NULL |
| `complex_units` | `same` — 양쪽 9,092 |
| `dong` | `skip · dead 값 없음` — survivor 의 `감만동` 이 지켜진다 |
| `region` · `sigungu` | `same` |
| `address` | `⛔ 자동 승계 제외` — dead 는 조합사무실, survivor 는 사업지. **survivor 가 옳다** |
| `lifecycle_stage` | 양쪽 `mgmt_approved` 라 미출력 |

survivor 별칭은 13개라 `auto_variants` 교체 사정권 밖이지만, 순서는 규칙대로 지킨다.

### §3 병합 큐 적용 순서

5쌍 + 검수 2쌍 + 삼보 6번째(`삼보아파트-가로주택정비사업`, vn 2 · 비활성) = 최대 8쌍.
**본병합은 이 함수 완성 후 별도 판정**이며, 쌍마다 `[dry 확인 → 집행 → 병합 등재 →
gen-merged-slugs.mjs 재생성]` 을 돈다.

---

## ② `doc:BLOG_20260910` — 블로그 전수감사 결측 2건

### 왜 — 정문은 이미 있었다

`presale_candidates` 는 앱 쪽에서 **쓰기 전용**이다. `from('presale_candidates')` 호출 전수 2곳
(`builder-presale-crawl/route.ts:351` · `cvn-brand-registry/route.ts:102`) **모두 `upsert`,
읽는 곳 0곳.** 크론은 그 실행에서 갓 크롤한 `cards` 만 처리하고 DB 의 기존 `queued` 행을
되읽지 않는다. 손 INSERT 로 넣은 행은 **큐에 영구히 남는다.**

`src/lib/presale/backfill.ts` 가 정확히 이 경우를 위한 문이다 —
*「apt_sites 에 손으로 INSERT 하지 않는다. 이 목록도 크롤 카드와 똑같이
presale_candidates → seedGate → seedSite 를 지난다」*.

⚠️ **`doc:PV_20260829` 를 재사용하지 않는다.** route.ts:134 경고대로 백필 32건 전체가
날마다 재판정되고 로그에서 진짜 신규가 묻힌다. 새 키를 두고 `?source=` 로 그것만 돌린다.

### `src/lib/presale/backfill.ts` — 말미에 추가

```ts
/* ══ 블로그 전수감사 20260910 ═══════════════════════════════════════════════
 * 부정공 블로그 130편 × apt_sites 6,596행 대조에서 나온 페이지 결측 8건 중,
 * 원문 근거가 선 2건. 나머지 6건은 근거 미확보라 카드로도 넣지 않는다.
 * 근거: docs/PV_INSTRUCTION_20260910.md ②
 */

/** 시드 후보 — 언론 원문에 지역·세대수가 명기된 것. */
const BLOG_20260910_SEEDABLE: DocCard[] = [
  // 부산일보 2026-01-08 — 부산시 건축전문위원회가 'SKY.V 센텀 복합시설 신축공사' 심의를
  // 확정 의결. 신세기건설이 우동 1522번지 일대에 최고 64층·오피스텔 666실 건립, 동원개발
  // 측이 이르면 연말 분양 가능성 언급. 예비 전재본(WBC 부지 이력·생숙→오피스텔 용도변경
  // 경위): https://v.daum.net/v/20260109183249908
  // ⚠️ 비주택(오피스텔) 판정은 여기가 아니라 judgeSupplyType·adBlockedFor 축이 한다.
  card({ rawName: 'SKY.V 센텀', region: '부산', sigungu: '해운대구',
    addrRaw: '부산광역시 해운대구 우동 1522번지 일대', totalUnits: 666,
    sourceUrl: 'https://mobile.busan.com/view/busan/view.php?code=2026010818232711045' }),
];

/** 보류 — 근거가 대행·집계 사이트 단독인 것. 게이트를 통과해도 앉히지 않는다. */
const BLOG_20260910_HELD: DocCard[] = [
  // 「더폴 금정」 전용 언론 기사는 검색 3회에서 미발견 — 아직 언론 축에 안 실린 현장이다.
  // 골격은 교차 확인됨: 부곡동 223-1 · 375세대 중 344세대 분양 · 2개동 최고 45층 ·
  // 지하5/지상45 · 시공 우성종합건설. 「더폴」은 우성종합건설이 시행·시공을 함께 맡는
  // 자체사업 브랜드로 더폴 우정(울산 중구, 45층) 등 시리즈가 실존한다.
  // ⚠️ expected_period 는 소스 표기 그대로 「2025년 12월」이며 이미 경과했다.
  card({ rawName: '더폴 금정', region: '부산', sigungu: '금정구',
    addrRaw: '부산광역시 금정구 부곡동 223-1', totalUnits: 375,
    sourceUrl: 'https://listup24.com/2025년-부산-청약-일정-주요-아파트-분양-계획-지역별-정/',
    holdReason: '애그리게이터 단독 근거 — 언론 기사 또는 입주자모집공고 원문 URL 확보 시 해제' }),
];

export const BLOG_20260910_SOURCE: PresaleSource = {
  key: 'doc:BLOG_20260910',
  builder: '', brand: '',
  label: '블로그 전수감사 20260910 — 부울경 페이지 결측',
  listUrl: 'https://github.com/wls9205-a11y/kadeora/blob/main/docs/PV_INSTRUCTION_20260910.md',
  kind: 'presale',
  robotsCheckedAt: '2026-09-10',
};

export const BLOG_20260910_CARDS: DocCard[] = [...BLOG_20260910_SEEDABLE, ...BLOG_20260910_HELD];

/**
 * 문서 소스 레지스트리 — 라우트가 key 로 알아본다.
 * ⛔ 「문이 하나여야 규칙이 하나다」를 지키는 자리. 문서 배치가 늘어도 뒤 문
 *    (matchSite·seedGate·seedSite·upsertCandidate)은 그대로 하나다.
 */
export const DOC_SOURCES: Array<{ source: PresaleSource; cards: DocCard[] }> = [
  { source: BACKFILL_SOURCE,      cards: BACKFILL_CARDS },
  { source: BLOG_20260910_SOURCE, cards: BLOG_20260910_CARDS },
];

export const docSourceFor = (key: string) =>
  DOC_SOURCES.find((d) => d.source.key === key) ?? null;
```

### `src/app/api/cron/builder-presale-crawl/route.ts` — 3자리

```ts
// line 31 — import 교체
import { BACKFILL_SOURCE, docSourceFor, type DocCard } from '@/lib/presale/backfill';
//   ⚠️ BACKFILL_CARDS 직접 import 는 뺀다. 카드는 이제 레지스트리가 준다.
//      BACKFILL_SOURCE 를 남기는 건 다른 참조가 있을 때만 — 없으면 같이 뺀다.

// line 135 — 문서 소스 선택
const doc = only ? docSourceFor(only) : null;
const sources = doc
  ? [doc.source]
  : PRESALE_SOURCES.filter((s) => !only || s.key === only);

// line 154 — 문서 소스 분기
const docSrc = docSourceFor(src.key);
if (docSrc) {
  cards = docSrc.cards;
  outcome = 'doc';
} else {
  // …기존 fetch·extract 경로 그대로…
}
```

### 실행과 기대 분기

```
GET /api/cron/builder-presale-crawl?source=doc:BLOG_20260910          (먼저 &dry=1)
```

| 카드 | 기대 |
|---|---|
| **SKY.V 센텀** | `seedGate` 통과(kind presale · 식별자 3자↑ · region 부산 · https sourceUrl · slug 생성 가능) → **시드 직전 유사명 검색**. 우동에 SKY 계열이 걸리면 자동 착석 대신 **병합 검토 큐**. **어느 분기든 정상** — 후자는 대연3↔디아이엘 재발 방지 장치가 의도대로 작동한 것이다 |
| **더폴 금정** | 게이트는 통과하나 `holdReason` 으로 **앉히지 않고 queued 잔류**. 「없다」가 아니라 「아직 앉히지 않는다」가 표에 남는다 |

**hold 는 종착이 아니라 대기다.** 분양 공고가 나는 순간 원문이 자연 발생하고
big-event-news 워처 축이 포착할 개연이 있다. 해제 조건을 `holdReason` 에 적어 둔 이유다.

**더폴 금정 hold 가 길어져도 카더라 캠페인 출혈은 0이다.** 카더라엔 「더폴금정」 키워드가
없고(페이지가 생기면 sa-sync 가 등록하는 순방향), 현재 가동 중인 「더폴금정」 키워드는
**일광 큐샵 캠페인 소속 = Node 별도 운영 · 불가침 영역**이라 그 착지 문제는 우리 쓰기 경계
밖이다. 전수조사 §1 이 부여한 시급성은 이 구분으로 한 단계 내린다.

---

## ③ `presale_candidates` 130 · 131 삭제

**②의 실행·확인이 끝난 «뒤에» 돈다.** 그래야 두 후보의 스테이징 기록이 어느 시점에도
0 이 되지 않는다.

### 왜 지우나

2026-09-10 세션에서 손 INSERT 로 넣은 행이다. 게이트 미경유 · 소비자 부재라 **페이지로 가는
경로가 없고**, 큐 체류일수(CV-4 지표 1)를 영구 오염시킨다 — 「빨강의 상시화」 계열의
다음 표본이 되는 길이다. 소스 리콜 가치는 DocCard 경유 행이 `source_url` 을 보존하므로
그대로 대체된다.

```sql
delete from presale_candidates
 where id in (130, 131)
   and source in ('news:busan-ilbo', 'web:listup24')   -- 오삭제 방어
   and resolution = 'queued'
   and seeded_site_id is null
   and matched_site_id is null
returning id, source, raw_name, norm_name, resolution,
          '게이트 미경유 손 INSERT — doc:BLOG_20260910 경유 행으로 대체됨' as 사유;
```

⚠️ 삭제 전 `select` 로 두 행이 여전히 `queued` · 미시드 상태인지 확인한다. ② 실행이
어떤 이유로 이 행들을 건드렸다면 멈추고 판정한다.

---

## 집행 보고 명기 4건 (사전 확인 완료)

| # | 요구 | 상태 |
|---|---|---|
| ⑴ | `nullif` 가 텍스트 화이트리스트 **4열 공통**인가 (`builder` 한 열이 아니라 `dong`·`region`·`sigungu` 까지) | ✅ 보고 VALUES · 집행 UPDATE 양쪽 모두 4열 전부 적용. `dong ''` 동형 함정 닫힘 |
| ⑵ | 함수 정의에 `search_path` 고정 | ✅ `security definer` + `set search_path = public` |
| ⑶ | 레거시 키 `doc:PV_20260829` 동작 불변 | ✅ 아래 증명 |
| ⑷ | 원장 `before` 가 **함수 진입 직후** 시점인가 | ⚠️ **초안은 아니었다 — 고쳤다.** 아래 |

### ⑷ — 결함이었고 수정했다

초안은 `v_before` 를 **스칼라 UPDATE 이후**에 읽어 그대로 원장에 적었다. survivor 의 별칭이
3 미만이면 그 UPDATE 가 `auto_variants` 를 발화시켜 별칭을 통째로 교체하는데, 그 경우 원장에는
**교체 후 값이 before 로 남아 복원 근거가 되지 못한다** — 덮인 사실만 남고 덮이기 전 값이 사라진다.

수정: `v_entry`(진입 직후)와 `v_before`(스칼라 UPDATE 직후)를 **가른다**.

- `v_entry` → 원장 `before_value`. 복원 기준선은 함수가 손대기 전이다.
- `v_before` → 차집합 계산 전용(교체된 «현재 상태» 대비로 무엇을 더 붙일지 판단).
- 둘이 갈리면 보고서에 `name_variants ⚠ auto_variants 발화` 행을 세워 **조용히 지나가지 않게** 한다.
- **자가 복원**: append 집합을 `[dead 별칭] ∪ [v_entry ∖ v_before]` 로 둔다. 교체로 날아간
  진입 시점 별칭이 **같은 트랜잭션에서 되돌아온다**.

  야간 `heal_realias` 에 맡기지 않는 이유가 있다 — 그 대사는
  「`site_name_candidates.resolution='applied'` ↔ 별칭 실재」를 대조하는데, **승계 별칭은
  dead 레코드에서 오지 후보 행에서 오지 않는다.** 대조할 짝이 없어 heal 축이 이 별칭들을
  덮지 못한다. 원장은 복원의 «근거» 일 뿐이고, 근거만 있으면 사람이 손을 대야 한다.

감만1은 vn=13 이라 무관하지만, 활성 6,285건 중 별칭 3 미만이 **467건**이라 미래 쌍에는 실재한다.
규약 일반성 차원에서 RULES#146 엣지가 이로써 닫힌다.

### ⑶ 증명 — 레거시 경로 회귀 없음

`PRESALE_SOURCES`(`src/lib/builder-sites/presale-registry.ts:74`)는 **크롤 어댑터만** 담고 있고
(`desian:presale` 등), `BACKFILL_SOURCE` 는 그 배열에 **없다**(grep 0건). 따라서 세 경로 모두 불변:

| 호출 | 기존 | 패치 후 |
|---|---|---|
| `?source=doc:PV_20260829` | `[BACKFILL_SOURCE]` | `docSourceFor` → **동일 객체** `BACKFILL_SOURCE`, 카드도 동일 `BACKFILL_CARDS` |
| `?source=desian:presale` | `PRESALE_SOURCES.filter` 1건 | `doc` = null → **같은 filter** |
| 인자 없음(일 크론) | `PRESALE_SOURCES` 전량 | `doc` = null → **같은 전량**. 문서 소스는 레지스트리에만 있어 일 크론에 안 낀다 |

루프 안 분기도 동형이다 — 크롤 소스는 `docSourceFor(src.key)` 가 null 이라 기존 `else`(fetch·extract)로 간다.
**집행 시 `?source=doc:PV_20260829&dry=1` 을 패치 전후로 한 번씩 돌려 decisions 배열을 대조한다.**

## 사후 판독 예약 — 감만1 승계값 잔존 확인

**감만1 적용 후 다음 새벽 스윕(04시대) 경과 시점에 `builder`·`total_units` 잔존을 재확인한다.**

04:02Z 대량 스윕 1,469행의 정체는 이번에 규명하지 않고 **남겼다**. 그 스윕이 무엇을 쓰는지
모르는 채로 승계값을 앉히는 것이니, 살아남는지 한 번 재본다 — 「지표는 만들고 한 번 재본다」의
데이터판이다.

```sql
select slug, builder, total_units, complex_units, updated_at
  from apt_sites where slug = '부산-감만1-재개발';
```

덮임이 관측되면 **스윕 규명이 별건으로 승격**된다. 별칭은 heal 축이 지키므로 **스칼라만** 보면 된다.

## 게이트 밖 — 이번 건과 묶지 않는 것

| 항목 | 왜 분리 |
|---|---|
| PLN CSV `!` · sa.py build+apply 회전 · 9/11 D_기축 재논의 | **광고 계정 접촉**. 성격이 다른 게이트 |
| §3 본병합 5쌍 + 검수 2쌍 + 삼보 6번째 | ① 함수 완성·감만1 검증 후 **별도 판정** |
| 구 카더라 그룹 무착지 28건 착지 부여/OFF | 광고 축 |
| 반여3-1 `total_units` 513 → 2026.4 관리처분 811 개연 | 공식 고시 확보 후 별건(문현1 2,568 vs 3,813 과 동형) |
| 「한양수자인」 단독 별칭 활성 10건 공유 | 전국 브랜드 토큰 분산 — 관찰 안건, 지금 손대지 않음 |

---

## 이미 집행된 것 (참고 · 게이트 밖)

레인 1 별칭 주입 3건 — `run_id='cc-20260910-lane1'`, `site_name_applies` 3행.

| 착지 | 주입 별칭 | vn |
|---|---|---|
| `사직2-재개발` | 래미안 사직 엘라티오 | 6→7 |
| `반여3-1-재건축` | 힐스테이트 루센츠 | 7→8 |
| `삼보아파트-가로주택정비` | 한양수자인 연산 | 6→7 |

별칭만 쓰는 UPDATE 라 트리거 무발화, 세 행 모두 vn≥3 으로 교체 사정권 밖.
「한양수자인」 단독 토큰은 주입하지 않았다(활성 10건이 이미 공유 중).
