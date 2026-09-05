# 계측 테이블 정본 지도 (2026-08-31 · V4D 증분3 판정 등재)

> **이 문서가 존재하는 이유는 사고 하나다.**
> P0-C 「리드 제출 역사상 0건」은 `conversion_events` 에서 잰 값이었다. 정본은 `user_events`
> 였고, `lead-track.ts` 주석은 «분리 이유까지» 적어 두고 있었다. 코드가 이미 답을 갖고
> 있었는데 세지 않은 쪽을 세고 「0건」이라 판정했다.
>
> ⛔ **DB 실측도 «적재처 정본을 코드에서 확인하기 전» 에는 후보다.**
>    비슷한 역할의 테이블이 여럿이면 **양쪽을 다 세고**, 세기 전에 **코드의 적재 지점을
>    먼저 grep 한다.** (`execute_sql` 다중문 함정 · grep 후보 원칙과 같은 계열.)

---

## 1. 정본 지도

| 테이블 | 정본 범위 | 대표 이벤트 | 적재 지점 | 비고 |
|---|---|---|---|---|
| `user_events` | **리드 퍼널 전체** — 슬롯별 노출·클릭·제출 | `lead_form_view` / `lead_form_click` / `lead_form_submit` | `lib/analytics.ts` → `track()` | 슬롯별 전환을 **한 쿼리로**. ⛔ `conversion_events` 와 섞지 말 것 (원 주석 승계) |
| `conversion_events` | CTA·게이트 계열 | `cta_view` / `cta_click` | `lib/analytics.ts` → `trackCTA()` 의 병행 전송 | S7-0 게이트 실측의 출처 |
| `blog_posts` | **발행의 정본** | — (`published_at` 시계열) | 블로그 파이프라인 | ⛔ 크론 `records_created` 로 발행을 판단하지 않는다 (§3) |
| `leads` | 제출 «결과» (고객 DB) | — | Apps Script 시트 경로 | 퍼널의 **종착**. 계측이 아니다 |

⚠️ `trackCTA()` 는 **두 테이블에 동시에** 쓴다(`user_events` + `conversion_events`).
   그래서 CTA 계열은 양쪽에서 세어지고, 리드폼 계열은 `user_events` 에만 있다.
   「한쪽에 0건」이 곧 「일어나지 않았다」가 아닌 이유가 이 비대칭이다.

---

## 2. 리드 퍼널 — 슬롯 × 이벤트 실장 지도

`user_events` 에서 `event_name = 'apt_lead_form'`, 슬롯은 `properties->>'slot'`.

| 슬롯 | 노출 | 클릭 | 제출 | 소유 컴포넌트 |
|---|---|---|---|---|
| `jumpbar` | ✅ (8/31~) | ✅ (8/31~) | — | `LeadAnchorTracker` (섬) → `SiteJumpBar` 의 앵커 |
| `bottom_bar` | ✅ | ✅ | — | `SiteActionBar` |
| `rail` | ✅ (8/31~) | ✅ | — | `SiteDetailRail` |
| `body` | ✅ | — | ✅ | `LeadForm` |

### ⛔ 제출은 «항상» `slot='body'` 다 — 슬롯별 제출은 존재하지 않는다

`trackLeadSubmit` 은 저장소 전체에서 **호출 지점이 한 곳**이고 슬롯이 `'body'` 로 박혀 있다.
폼 인스턴스는 페이지당 한 벌이므로(`SiteDetailRail` 주석 — id 두 벌 금지) 제출은 언제나
본문 폼에서 일어난다. 따라서 **`bottom_bar`·`rail` 의 제출은 구조적으로 0**이다.

> 「하단 바 클릭 17 · 제출 0」은 **퍼널이 죽은 기록이 아니라 자가 없던 기록**이었다.

**그래서 축을 하나 더 달았다** (P0-A′ · 2026-08-31):

| 열 | 뜻 |
|---|---|
| `slot` | 폼이 **어디에 있나** — 제출은 앞으로도 `'body'` |
| `entry` | 그 사람을 폼으로 **보낸 자리** — 슬롯별 최종 전환은 **이 열로** 낸다 |

`entry` 는 `jumpbar` / `bottom_bar` / `rail` / `direct` 중 하나다.
`direct` 는 진입점을 거치지 않고 스크롤로 폼에 닿은 사람이다 —
⛔ 「측정되지 않음」과 뭉치지 않는다. 뭉치면 나중에 둘을 다시 못 가른다.

⛔ `slot` 을 진입점으로 **갈아타지 않는다.** 갈아탔다면 8/25~8/31 의 제출 4건이 소급해서
「본문에서 제출된 4건」이라는 **틀린 뜻**을 갖는다 — 그때는 진입점을 몰랐다.
**모르는 구간을 아는 척 만들지 않는다.**

### 슬롯별 전환 — 표준 쿼리

```sql
-- 진입점별 최종 전환. 분자는 entry, 분모는 slot 이다 (축이 다르다).
select
  s.slot,
  s.views, s.clicks,
  coalesce(c.submits, 0) as submits
from (
  select properties->>'slot' as slot,
         count(*) filter (where event_type = 'lead_form_view')  as views,
         count(*) filter (where event_type = 'lead_form_click') as clicks
  from user_events where event_name = 'apt_lead_form' group by 1
) s
left join (
  select properties->>'entry' as slot, count(*) as submits
  from user_events
  where event_name = 'apt_lead_form' and event_type = 'lead_form_submit'
  group by 1
) c using (slot)
order by s.views desc;
```

⚠️ `entry` 는 **2026-08-31 배포 이후에만** 존재한다. 그 이전 제출 4건은 `entry` 가 없다 —
   0 이 아니라 **미측정**이다. 창을 그 이전으로 넓혀 비교하지 말 것.

---

## 3. 「성공」과 「산출」은 다른 사실이다

크론의 `records_created` 는 **발행 실효 판단에 쓸 수 없다.**
실측(2026-08-31): `blog-auto-publish` 3일 `records_created` **135** vs `blog_posts` 실발행
**~16** — 8배 괴리. 상태판 초록(성공률 99%)과 산출 0 이 같이 서 있는 군집이 있다.

⛔ 크론 성공률·`records_created` 로 파이프가 살아 있다고 판정하지 않는다.
✅ 발행의 정본은 **`blog_posts.published_at` 시계열**뿐이다.

---

## 4. 방문자 식별자 정본 — `kd_vid` 쿠키 (SU B-1 · 2026-09-05)

**정본은 1st-party 쿠키 `kd_vid`(SameSite=Lax · Max-Age 1년 · Path=/)이고,
발급·승격은 `src/lib/visitor-id.ts` 한 곳에서만 한다.**

### 왜 이 조항이 생겼나

식별자 저장이 **두 벌**이었다.

| 갈래 | 저장 | 형식 | 적재 표 |
|---|---|---|---|
| `lib/analytics.ts` | localStorage `kd_visitor_id` | `crypto.randomUUID()` | `user_events` |
| `lib/cta-track.ts` | cookie `kd_vid` | `base36-rand` | `conversion_events` |
| `lib/track-conversion.ts` | localStorage `kd_visitor_id` 직접 읽기 | — | `conversion_events` |

같은 사람이 표마다 다른 id 를 가졌고, 무엇보다 **서버가 둘 다 읽을 수 없었다**.
그 막다른 골목에서 `auth/callback` 은 손에 있던 유일한 식별자 — `user.id` — 를
`conversion_events.visitor_id` 자리에 넣었다. 최근 14일 `cta_complete` **11/11 건이
UUID**. 방문자 기준으로 낸 가입 전환은 전부 오보였다.

> 이원화는 「지저분함」이 아니라 **오염의 구조적 원인**이었다. 서버가 읽을 수 있는
> 자리에 식별자가 없으면, 서버는 반드시 다른 것을 그 자리에 넣는다.

### 규칙

1. **읽기는 `getVisitorId()` 로만.** `document.cookie` · `localStorage` 를 직접 뒤지지 않는다.
2. **승격 순서** — 기존 값 보존이 목적이다:
   쿠키 → localStorage `kd_vid` → localStorage `kd_visitor_id` → (최후) 새로 발급.
3. **localStorage 두 키에 계속 미러링**한다. 구버전 탭이 아직 그 키를 읽는다.
4. ⛔ **새 id 를 UUID 로 만들지 않는다.** `user.id` 도 UUID 라서, 오염 재발을 «형태로»
   가려낼 수 있는 성질을 잃는다. `base36-rand` 는 그 자체가 판별자다.
5. ⛔ **서버가 `visitor_id` 자리를 `user.id` 로 메우지 않는다.** 쿠키가 없으면 `null`.
   **결측이 오염보다 낫다** — 결측은 세지 않으면 그만이고, 오염은 틀린 답을 낸다.

### 서버측 소비처

| 위치 | 읽는 쿠키 | 쓰는 곳 |
|---|---|---|
| `app/auth/callback/route.ts` | `kd_vid` | `conversion_events.visitor_id`(cta_complete) · `signup_attempts.visitor_id` |
| `app/api/auth/track-attempt/route.ts` | — | `kd_att` 쿠키 **발급**(상관관계 id · 900초, SU A-2) |

⚠️ `kd_att` 는 방문자 식별자가 **아니다**. OAuth 왕복 1회짜리 상관관계 키이고
콜백이 사용 즉시 소멸시킨다. 두 쿠키의 역할을 섞지 않는다.

### 한 번 일어나는 불연속 (기록)

승격에서 **쿠키가 이긴다**. 쿠키(`kd_vid`)와 localStorage(`kd_visitor_id`)를 둘 다
갖고 있던 기존 방문자는 9/5 이후 `user_events.visitor_id` 가 쿠키 값으로 바뀐다.
⛔ 9/5 를 걸치는 방문자 수 비교는 하지 않는다. 소급 수정도 하지 않는다.

---

## 5. 이 지도를 고칠 때

새 계측을 붙이거나 슬롯을 더하면 **§2 표를 같은 커밋에서** 고친다.
새 식별자·쿠키를 더하면 **§4 표**도 같은 커밋에서 고친다.
지도와 코드가 갈라지면 이 문서는 다음 사람을 P0-C 와 같은 자리로 다시 보낸다.
