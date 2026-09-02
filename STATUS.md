## CV 커버리지 폐루프 (2026-09-02) — CV-2 스키마 · CV-1 태영 소스 · [CV-A] 리허설

광고 계정 무접촉. PL-B′(9/3~9/6) 록아웃과 무관하다 — 사이트·DB 작업뿐이다.

### 1. CV-2 스키마 — `cv2_presale_candidates_2026-09-02.sql` (프로덕션 적용 완료)

`presale_candidates`(24열) · `presale_source_health`(8열) 신설,
`apt_sites` 에 `supply_type` · `ad_blocked` · `ad_blocked_reason` 추가.

**`ad_blocked` 기본값을 false 로 둔 이유** — R2 는 「민영만 광고 적격, 미상은 광고 X」인데
기존 활성 6,256행의 `supply_type` 은 전부 null 이다. 「미상 = 광고 X」를 소급하면
**기존 커버리지가 통째로 꺼진다**. R2 가 막으려는 것은 «새로 들어오는» 공공 블록이다.
적용 직후 실측 `ad_blocked=true` **0건** — 기존 행 무영향 확인.
⛔ 기존 행 공공·임대 소급 스윕은 별건이고 Node `!` 없이 돌리지 않는다.

멱등 키는 `(source, norm_name)` «만» 이다. region·sigungu 를 키에 넣으면 첫 크롤에서
주소가 비고 다음 크롤에서 채워질 때 같은 카드가 두 행이 된다.

### 2. CV-1 — `builder-presale-crawl` 신설 (vercel cron 20:20 UTC)

`src/lib/builder-sites/presale-registry.ts`(URL·fetch 힌트만) ·
`src/lib/presale/extract.ts`(AI 추출) · `src/lib/presale/candidate.ts`(판정) ·
`src/app/api/cron/builder-presale-crawl/route.ts`. 단위검증 31케이스 통과.

**손파서를 두지 않은 근거는 실측이다.** 같은 태영 페이지 «한 장 안에서» 세대수 표기가 셋이다:

| 카드 | 원문 |
|---|---|
| 김해 외동 | `세대수 : 1,135세대` |
| 대전 유천1구역 | `세대 : 994세대(공동주택 930세대, 오피스텔 64실, 총 5개동)` |
| 서면 어반센트 | `세대수 : 아파트 762세대, 오피스텔 69실` |

정규식으로 셋을 맞춰도 다음 시공사에서 깨진다. 경로는
`fetch → AI 추출 → 스키마 검증 → 스테이징` 하나뿐이고, 환각 방어는
스키마 검증 + `parseUnits`(세대·가구 결합 없는 수치 폐기) + source_url 보존 + 검수 큐다.

**builder-site-sync 를 건드리지 않았다.** 그쪽이 `name_variants` · `builder` 의 유일한
기록자다 — 같은 컬럼에 규칙이 둘이면 매일 뒤에 도는 쪽이 이긴다(H7-2). 그래서
matched 행에는 «아무것도 쓰지 않고» 기록만 한다.
`expected_sale_period` 보강도 뺐다: 이 소스가 주는 것은 «공사기간»
(`2025년 09월 ~ 2030년 1월`)이고 그 컬럼 제약은 `YYYY(-MM|H1|Q1)` 이다.
형식에 맞추면 없는 분양시기를 지어내는 것이 된다.

### 3. [CV-A] 리허설 — 실측이 설계서 §0-2 를 **세 군데 뒤집었다**

로컬에 `ANTHROPIC_API_KEY` 가 없어 AI 추출은 배포 후에만 돈다. 결정적 절반
(목록 실측 · 매칭 · 게이트)은 실 DB 로 돌렸다.

#### ① 「부암동 데시앙(가칭) 831세대 · DB 없음」은 **결측이 아니다**

태영 공식 전 페이지(preSale·sale·building·schedule·complete)를 받아 확인했다.
부암동 데시앙은 **하나뿐**이고 「(부산) 서면 어반센트 데시앙」이다.

| | 설계서 §0-2 | 실측 (2026-09-02) |
|---|---|---|
| 지번 | 부암동 705-1 | **690-8** — ⚠️ 아래 정정 |
| 세대수 | 831 | `831세대 (공동주택 4개동 762세대, 오피스텔 1개동 69실)` — 831은 오피스텔 포함 합계 |
| DB | 없음 | **있다** — `서면-어반센트-데시앙` · 태영건설 · cs 100 · construction |
| 목록 | 분양예정 | **분양중·공사중** |
| 가칭 | 가칭 | 펫네임 확정 |

**⚠️ 지번 건은 CC 추정이 틀렸다 (Node 교차검증 2026-09-02).** 「김해 외동 705 와의
혼선」이 아니라 **실재하는 복수 지번**이다 — 공식 모델하우스 사업개요가 `705-1`,
언론·분양자료가 `690-8` 을 쓴다. 매칭 로직의 «알려진 한계» 로 코드에 남겼다:
지번 정확일치는 이 쌍을 못 붙인다. 그래도 느슨하게 풀지 않는다 — 지번을 느슨히 보면
서로 다른 필지가 같은 현장으로 붙는다(택지지구가 특히 그렇다). 이름축이 잡거나
큐에서 사람이 본다.

**진짜 결함은 결측이 아니라 세대수 오배치다** — DB `total_units=211` 은 오타가 아니라
**일반분양 수치가 총세대 자리에 앉은 것**이다(Node 분양자료 실측). 처리 방침:

| 값 | 정체 | 들어갈 자리 |
|---|---|---|
| 762 | 아파트 총세대 | `total_units` |
| 211 | 일반분양 | `general_units` (⛔ 총↔일반 혼입 금지) |
| 69 | 오피스텔 | 별도. 세대수에 더하지 않는다 |

수치 산포(청약 시점 기사 169 ↔ 분양자료 211)는 출처·기준일을 병기한다.
같은 행이 선착순 진행 중인데 단계가 `construction`·closed 인 것도 동봉 검수.
⛔ D4 밖이라 이 트랙이 자동 반영하지 않는다. 검수 안건으로만 남긴다.

#### ② 태영 분양예정에서 **설계서에 없던 2건**이 나왔다

`고창 덕산지구 공동주택(공공분양)` 888세대(전북) · `청주 사창 재건축 정비사업`(충북).

#### ③ 주소축이 오생성 4건을 막았다 — 이름축만으로는 못 막는다

기존 데시앙 8카드 전수 매칭 **8/8 성공 · 오생성 0**. 그중 **4건이 주소축으로만** 붙었다:

| 카드 | 매칭축 | 붙은 현장 |
|---|---|---|
| 광주 더 퍼스트 데시앙 | 주소 | `더퍼스트-데시앙` (「광주」 접두가 DB 에 없다) |
| 더파크 비스타 데시앙 | 주소 | `광주-더파크-비스타-데시앙` (반대로 DB 에만 있다) |
| 동탄 꿈의숲 자연& 데시앙 | 주소 | `동탄-꿈의숲-자연앤-데시앙78` (`&`→`앤`) |
| 부산 서면 어반센트 데시앙 | 주소 | `서면-어반센트-데시앙` (「부산」 접두) |

이름 정확일치만 썼으면 이 4건이 «중복 페이지» 로 새로 생겼다.

#### ④ 게이트가 **region 오염 1건**을 잡았다 (코드 보강함)

`parseAddress` 는 시·도를 못 알아보면 첫 토막을 그대로 준다:
`청주시 서원구 사창동 270-1번지 일원` → `region='청주시'`.
그대로 앉으면 **18번째 region 값**이 생기고, 그 순간 CV-4 「미등록 잔량」과 sa.py 존
필터가 **둘 다** 그 행을 못 본다 — 페이지는 있는데 지표에는 없는 상태다.
실측: 활성 6,256행이 정확히 17개 시·도만 쓰고 오염 0. `REGIONS` 화이트리스트를
`seedGate` 에 넣었다. 못 알아본 것은 «버리지 않고» queued 로 남는다.

#### 배포 후 첫 실행의 예상 판정

| 카드 | 예상 | 근거 |
|---|---|---|
| 김해 외동 재건축사업 (경남·1,135) | **seeded** · 민영 | §0-2 ① 그대로 해소 |
| 대전 유천1구역 지역주택조합 (대전·930) | **seeded** · 민영 | 전국분. 지주택은 민영 |
| 고창 덕산지구 공동주택(공공분양) (전북·888) | **seeded** · 공공 · `ad_blocked` | R2 실증 |
| 청주 사창 재건축 정비사업 | **queued** | region 미확정(`청주시`) |
| 화성동탄2A78BL공공주택사업 | **queued** | 공사중 목록 = 시드 대상 아님 |
| 기존 데시앙 8카드 | **matched** | 오생성 0 |

### 4. Node 판정 4건 (2026-09-02) — 전부 승인, 코드에 반영

| # | 판정 | 반영 |
|---|---|---|
| ① | 부암동 철회 승인. 705-1 은 «실재 이표기» | 위 정정 + `matchSite` 주석에 복수 지번 사례 |
| ② | `claude-opus-5` 유지 승인 — 단 «감으로 유지하지 않는다» | 아래 3종 |
| ③ | `ad_blocked` 소급 없음 승인 | 변경 없음 |
| ④ | pull·push·배포 후 CV-A 완결 보고 승인 | 진행 |

**②의 3종을 코드에 심었다** — 비용 논쟁을 실측으로 대체하기 위한 것이다:

1. **입력 상한** — `htmlToText` 로 태그를 걷어낸 뒤 `MAX_INPUT_CHARS=40,000` 로 자른다.
   근거: 태영 목록 3장이 태그 포함 17.5~22KB, 텍스트로는 그 1/5 수준이다. 훨씬 큰
   목록도 통째로 들어가면서 한 소스가 폭주해도 콜 하나의 비용이 예측 가능한 선이다.
2. **실사용량 실측** — 콜마다 `llm_usage_logs` 에 토큰을 남긴다(`logAnthropicUsage`,
   metadata 에 `source_key·kind·input_chars·truncated`). ⚠️ 이걸 위해 응답에서
   text 만 뽑지 않고 «전체» 를 받는다 — text 만 뽑으면 `usage` 가 같이 버려지고
   첫 주 비용을 «추정» 으로만 말하게 된다.
3. **섀도 평가** — `?dry=1&model=claude-sonnet-5`. 같은 입력을 다른 모델에 태워
   판정 일치율을 잰다(CV-B). 허용 목록은 opus-5 · sonnet-5 · haiku-4-5 뿐이고,
   목록 밖 값은 «조용히 기본 모델로 접는다» — 오타 하나로 400 이 나면 그날 그 소스의
   신규 현장이 사라진다.

---

## §11-A 네이버 색인 손실 차단 (2026-08-25) — CC 몫 3건 완료

기준선은 2026-08-25 실측(`naver_index_check.mjs` / `naver_urlmix.mjs`, 표본 60).
개별 글 정확 URL 색인 **5.0%** · 파셋·허브 잠식 **31.5%**.

### 1. 파셋 noindex (§6) — `ce2289d9`

`src/lib/seo/facet.ts` 신설. 판정은 **허용목록이 아니라 차단 기본값**이다.
`?tag=` 는 `/blog` searchParams 타입에 있지도 않아서 아무 조건에도 안 걸리고
그대로 색인됐다 — 알려진 키만 막으면 새 파라미터가 생길 때 같은 사고가 반복된다.

| 대상 | 조치 |
|---|---|
| `/blog?*` | 기본값 아닌 파라미터 1개라도 있으면 `noindex, follow` |
| `/blog/series/[slug]` | `noindex, follow`. 목록 `/blog/series` 는 사이트맵 자산이라 색인 유지 |
| `/apt?region=·sgg=·st=` | `noindex` + canonical 을 경로형 허브로 (R11 선반영) |
| `robots.txt` Yeti | `/search?` · `/*?q=` · `/*?sort=` 제거 (S8-② 철회) |

판정 로직 16케이스 단위검증 통과 (`/blog`·`?page=1`·`?category=all`·`?sort=latest` 는 색인 유지).

**`/blog/series/[slug]` 를 뺀 근거** — 네이버 노출 200건 중 32건(16.0%)을 먹는데
30일 실유입은 13히트/8페이지, 그중 네이버 유입 **1건**. 개별 글 자리만 뺏고 있었다.

**robots.txt 에서 남긴 것** — `/*?utm_` · `/*?ref=` 는 고유 콘텐츠가 없는 추적
파라미터라 차단이 맞다. `/apt/redev/*?` 는 해당 페이지가 아직 `index,follow` 라
유지했다 (searchParams 를 읽지도 않는 순수 중복 URL인데, `generateMetadata` 로
바꾸면 `revalidate=3600` ISR 이 깨진다 — **후속 과제**).

### 2. 사이트맵 샤드3 캡 버그 (§8) — `264e4c33`

`fetchBatched(..., 10000)` 이 최신 1만 건을 가져온 **뒤에** 시드를 걸러서,
오래된 2,825건이 시드 판정 전에 잘려나갔다. 실유저 글 300건 중 **188건 누락**.
검증 — 최신 1만 건 중 실유저 글 112건 = 라이브 사이트맵 113건과 일치.

한도만 올리면 또 터지므로 `profiles!inner` 조인 필터로 **거른 뒤 페이징** 하도록
순서를 뒤집었다. `is_seed` 에 null 없음 확인(true 505명/12,524글, false 170명/300글).

### 3. 신디케이션 카페 결합 해제 + 일 상한 (§7) — `56470193`

**§2-4 확인 결과 — `naver-cafe-publish` 는 라우트 파일 자체가 없다.**
`src/app/api/cron` 아래에도, `src/lib` 에도 카페 발행 모듈이 없다. 삭제된 것은
워커 전체다. 그런데 큐는 계속 `target='both'` + `cafe_status='pending'` 으로
쌓여서 카페 단계가 블로그 발행까지 같이 묶어 4/17 이후 전량 정지했다.

- 신규 행을 `target='blog'` · `cafe_status='skipped'` 로 생성
- `mark_blog_published` 에 **일 3건 상한을 서버에서 강제**(429). UI 배지만으로는
  연타하면 그대로 넘어간다
- `retry_cafe` 제거 — `cafe_status` 를 pending 으로 되살려 큐를 다시 묶는다

> **네이버 블로그에는 공개 발행 API 가 없다.** 자동 발행 워커는 존재한 적이 없고
> 만들 수도 없다. 크론이 `naver_html` 을 만들고 사람이 어드민에서 복사해 붙여넣는
> 구조다. 그래서 "워커 재가동" 이 아니라 **사람이 한 번에 밀지 못하게 막는 것**이
> 여기서의 일 상한이다.

### 선행 확인 결과 (§14)

| 항목 | 결과 |
|---|---|
| 카페 삭제 범위 | **워커 전체** (라우트·모듈 모두 없음) |
| `hero_image_source` | 156/156 `developer` — 다만 애드덤 E로 **라이선스 근거 미기록, Node 확인 대기** |
| `/blog/series/*` 유입 | 30일 13히트/8페이지, 네이버 1건 → noindex 확정 |
| `/apt` 필터 파라미터 | **`?region=` · `?sgg=` · `?st=`** (지시서의 `?sigungu=`·`?status=` 아님) |
| 백링크 (§7-4) | 이미 구현돼 있음 — `?utm_source=naver_blog&utm_medium=syndication` |

### 다음

- **[DB · Node] §11-A 4번 큐 해제** — 애드덤 D 순서대로 CC 3번이 끝났으므로 진행 가능.
  일 상한이 배포된 뒤에 풀 것
- **[Node] R13** — `hero_image_license` 확인 전까지 `og:image` 체인 변경 배포 금지
- §11-B 리뉴얼 착수 (5번은 애드덤 A로 완료 — 컬럼·뷰는 만들지 말고 읽어 쓸 것)

---

## ONESHOT §C0 · §C-1 (2026-08-24) — 리드폼 306건 + 단계별 문구

### 실측이 지시서보다 크다

§A 승격(277건)이 반영되면서 폼 없는 현장이 늘었다.

| 단계 | 지시서 | **실측** |
|---|---|---|
| `union_established` 조합설립 | 26 | **138** |
| `plan_approved` 사업시행인가 | 22 | **91** |
| `mgmt_approved` 관리처분인가 | 15 | **36** |
| `construction` 착공 | 11 | **34** |
| `contract_signing` 계약 | 5 | 5 |
| `constructor_selected` 시공사선정 | 1 | 1 |
| **소계** | 80 | **306** |

`lifecycle_stage` NULL 도 1건이 아니라 **39건**이다 (§A 승격분 중 단계 미확정).

### 조치

`LEAD_ELIGIBLE_STAGES` 에 정비사업 6단계 추가. **기축은 넣지 않았다** —
`post_move_in`(4,367) · `landmark_active`(116) · `active_trade`. 파일 주석의 판단 근거 그대로다.

**검증 (§C0-6 SQL)**
```
still_missing_form: 0      ← 목표
울산-남구-달동-재개발: union_established (폼 대상)
```

### §C-1 문구 — 세 화면이 흩어져 있었다

`LeadForm` · `SiteActionBar` · `SiteDetailRail` 이 각자 `분양 정보 안내 신청` 을 하드코딩하고 있었다.
한 곳에서만 고치면 화면마다 다른 말을 한다 → `lib/apt/lead-copy.ts` 한 벌로 모았다.

| 단계 | CTA |
|---|---|
| 공고 전 (정비사업 5단계 + 부지계획·분양 예고) | **이 구역 진행 상황 알림 받기** |
| 분양 진행 | 분양 정보 안내 신청 |
| 기축 | 이 지역 분양 정보 안내 신청 |

블로그 하단 폼(`blog/[slug]`)도 같은 문구를 쓰도록 `lifecycle_stage` 를 함께 조회한다.

> **판단해서 넣은 것**: 공고 전 문의의 `inquiry_type` 을 **`진행상황알림`** 으로 분리했다.
> `check_lead_unhandled_alert()` 가 **`분양상담` 으로 대상을 좁혀** 30분 경보를 낸다.
> 공고 전 알림 신청까지 그 집계에 섞이면 **응대 우선순위가 흐려진다** —
> 분양 상담은 30분 안에 전화해야 하지만 진행 상황 알림은 성격이 다르다.
> ⚠️ 다만 그러면 공고 전 리드는 지금 **미처리 경보를 받지 못한다.**
> 별도 임계값으로 볼지는 리드가 쌓인 뒤 판단하는 게 맞다.

테스트 11건 — 정비사업 6단계 포함 · 기축 3단계 제외 · 공고 전 문구에 `분양` 이 없는지 · `inquiry_type` 분리.

---

## 마스터 §4 후속 (2026-08-24) — 344건 전부 실패의 진짜 원인

### 거부된 값은 API 원문이 아니라 **내 코드가 만든 값**이었다

실행 로그가 그대로 말해 준다.

```
records_processed 344 · records_created 0 · records_failed 344
unmapped_stages: [건축심의 및 통합심의, 관리처분계획, 해제, 사업시행계획인가,
                  조합해산, 예정구역지정, 정비계획 수립 및 정비구역 지정]
errors: violates check constraint "redevelopment_projects_stage_check" ×3
with_view_img: 190
```

`unmapped_stages` 7종은 **전부 확장된 CHECK 안에 있다.** 즉 그것들은 문제가 아니었다.
문제는 `STAGE_MAP` 이 **매핑한** 쪽이다.

```
'추진위원회 구성' → '추진위원회'   ← CHECK 에 없다. 이게 344건을 막았다
'조합설립인가'    → '조합설립'     ← CHECK 에 있어서 통과
```

CHECK 17종에 `추진위원회 구성` 은 있지만 **`추진위원회` 는 없다.**
DB 담당이 API 원문을 허용하도록 CHECK 를 넓혔는데, 내 코드는 그 원문을 **짧은 형태로
정규화해서** 허용 목록 밖으로 나가고 있었다. 한 행이 어기면 배치 전체가 죽는다.

### 고친 것

**① 정규화를 걷어냈다.** API 원문이 이미 허용 목록에 있으므로 그대로 넣는다.
`src/lib/redev/busan-stage.ts` 로 분리했다 — route 파일은 임의 심볼을 export 하면
라우트 타입 검사가 깨져 테스트에서 진짜 모듈을 import 할 수 없다.

**② 허용 목록 밖 값은 절대 내보내지 않는다.** 모르는 단계명은 `기타`(허용값)로 떨어뜨리고
원문을 로그에 남긴다. **새 단계명 하나가 등장했다고 수집 전체가 막히는 구조를 없앴다.**

**③ 실패한 행의 값을 오류에 싣는다.** 배치가 실패하면 한 건씩 다시 넣어 **실패한 행만** 세고
`stage=… type=… name=…` 을 오류 문자열에 붙인다. 이전에는 어떤 문자열이 거부됐는지 알 수 없었다.
`stage_values`·`project_type_values` 분포도 매 실행 metadata 에 남긴다.

**④ 테스트 10건.** `ALLOWED_STAGES` 가 DB CHECK 17종과 **정확히 일치**하는지 대조하는
케이스를 넣었다 — 한쪽만 고치는 걸 막는 자물쇠다.
`"이전 판이 만들던 '추진위원회' 는 CHECK 에 없다"` 도 케이스로 박았다.

### `project_type` — 확인했다

`CHECK (project_type = ANY (ARRAY['재개발','재건축']))`.
`projectTypeOf()` 가 삼항이라 그 둘 밖의 값이 나올 수 없다. 테스트로 고정했다.

### 전 344행 기준 `generationJoo` 재확인

3개 표본으로 내린 판정이 **전수에서도 맞았다.**

| | |
|---|---|
| `gen_with_zero_guild` | **24** — 조합원 0인데 세대수는 있는 행 |
| `gen_below_threshold` | 16 — 30세대 미만(미기입)이라 넣지 않는 행 |
| `with_view_img` | **190** — 조감도 파싱 정상 |

조합원 수라면 24건이 나올 수 없다. 세대수가 맞다.

### 확인한 것 두 가지

- **`origin/main` 은 `d75a6be7`** — §4 커밋은 원격에 있었다
- **배포본도 `d75a6be7`** (`sw.js` CACHE_VERSION 실측) — 세 번의 실행은 새 코드가 맞았고,
  위 정규화 버그로 실패한 것이다

---

## 마스터 §4 (2026-08-24) — 부산 정비사업 API 필드 매핑

344건을 받아 0건을 저장하던 원인은 **필드 매핑 하나**였다. 크론 등록·API 키 모두 정상이었다.

### `generationJoo` 판정 — **세대수다** (조합원 수 아님)

크론 로그의 `sampleRow` 를 5회분 뒤져 **서로 다른 3개 구역**을 확보해 대조했다.

| areaName | `generationJoo` | `guildMemNum` | step |
|---|---|---|---|
| 명서1 재개발 | 785 | 785 | 조합설립인가 |
| **금사1 재개발** | **2,635** | **0** | 추진위원회 구성 |
| 괘법1 재개발 | 1 | 1 | 추진위원회 구성 |

**금사1 이 결정적이다.** 조합이 아직 없어 `guildMemNum` 이 0 인데 `generationJoo` 는 2,635 다.
조합원 수라면 0 이어야 한다. 필드명(generation = 세대)과도 맞는다.

⚠️ **다만 괘법1 의 `1` 처럼 채워지지 않은 값이 섞인다.** 정비구역 세대수가 1일 수는 없다.
→ 하한 **30세대** 를 두고, 그 아래는 **넣지 않는다.** 지어내지 않는 것과 같은 원칙이다.
판정 근거(`gen_eq_guild`·`gen_with_zero_guild`·`gen_below_threshold`)를 **매 실행 metadata 에
기록**한다 — 다음 사람이 다시 추측하지 않도록 전 344행 기준 분포가 남는다.

### 매핑

| API | → | 비고 |
|---|---|---|
| `areaName` | `district_name` | **폴백 제거.** 없으면 행을 건너뛴다 |
| `step` | `stage` | 모르는 값은 `기타` 로 뭉개지 않고 **원문 유지** + 미매핑 목록을 로그에 |
| `contractor`·`engineer`·`architect` | 동명 컬럼 | `미정`·`없음`·`-` → null |
| `generationJoo` | `total_households` | 위 판정 + 하한 30 |
| `guildMemNum` | `guild_member_num` | |
| `areaUnit` | `area_sqm` | |
| `location` | `address` | |
| `viewImgPath` | `view_img_url` | **조감도** |
| `panoImgPath`·`loctImgPath`·`placeImgPath` | `pano_img_url`·`loct_img_url`·`place_img_url` | 지시서는 `_path` 라 했으나 실제 컬럼은 `_url` |
| `aCode` | `external_code` | upsert 기준 |

### ⚠️ 이미지 URL 은 http 로 오는데 그 호스트는 http 를 거부한다

```
https://dynamice.busan.go.kr/…/BARA_….jpg   200 · image/jpeg · 400KB
http://dynamice.busan.go.kr/…/BARA_….jpg    401
```
API 가 주는 값은 `http://` 다. 그대로 저장하면 **전부 401** 이고, 우리 CSP 가
`img-src … https:` 라 어차피 차단된다. → **https 로 올려 저장한다.**

또 `panoImgPath` 가 `http://…/busi_ara/` 처럼 **디렉터리만** 오는 경우가 있다.
확장자가 없으면 이미지가 아니므로 버린다.

### full refresh → upsert

`delete` 후 `insert` 라 insert 가 실패하면 데이터가 사라지는데 `created:0` 으로만 보여 조용했다.
`external_code` 기준 upsert 로 바꾸고 **실패를 `failed` 로 세어 올린다.**
`external_code` 가 없는 행은 유일성 기준이 없어 넣지 않는다 — 매 실행 중복이 쌓이는 것보다 낫다.
`sigungu` 는 API 가 주지 않아 **null 로 둔다.** 지어내지 않는다.

### ⚠️ `crawl-nationwide-redev` 는 원인이 다르다

지시서는 "같은 원인일 가능성 높음" 이라 했지만 로그를 보면 다르다.

```
{"광주_남구":{"status":400,"statusText":"Bad Request"}, "대구_동구":{"status":400}, … 전 시군구 400}
```

매핑 이전에 **요청 자체가 400** 이다. 엔드포인트가 국토부 `1613000/MntncBizInfoSvc` 인데
키는 `BUSAN_DATA_API_KEY`(부산 서비스 키)를 쓰고 있다 — 그 서비스에 **활용 신청이 안 돼 있거나
파라미터가 틀린 것**이지 필드 매핑 문제가 아니다. data.go.kr 에서 해당 서비스 신청 상태를
확인해야 고칠 수 있어 이번엔 손대지 않았다.

---

## 마스터 §1 · §2 · §3 (2026-08-24)

### §1 리드 알림 — 최악 48시간 → 최악 15분

실측으로 지시서 진단을 전부 확인했다: 임계값 `interval '24 hours'` · 크론 168 `35 0 * * *`(하루 1회).

| | 전 | 후 |
|---|---|---|
| 임계값 | 24시간 | **30분** |
| 크론 168 | 하루 1회 | **`*/15 * * * *`** |
| 미처리 severity | `warning` | **`critical`** |
| 신규 리드 즉시 알림 | 없음 | **트리거 `trg_lead_new_alert`** |

- 임계값을 상수(`c_threshold`/`c_label`) 하나로 뽑았다. 기존엔 `24 hours` 가 조건문과 문구
  4곳에 흩어져 있어 한쪽만 고치면 "24시간 넘게…" 라 말하면서 30분 기준으로 도는 상태가 된다
- `warning` 은 `CriticalAlertBar` 에 안 뜬다 — 알림이 있어도 안 보이면 없는 것과 같다
- 신규는 폴링이 아니라 트리거다. `status<>'new'`(테스트)는 건너뛴다
- 적용 직후 실행 검증: `[critical] 미처리 분양상담 1건 … 772분 경과 · 두산위브더제니스 대연`

범위는 `admin_alerts` + `CriticalAlertBar` 까지다. 외부 발송(알림톡·SMS)은 하지 않는다.
§1-2 어드민 리드 화면은 건너뛴다(리드 1건, 경보로 보인다).

### §2 광고 랜딩 분기

⚠️ **`resolveChannel()` 은 저장소에 없다.** 리드 엔드포인트(Apps Script) 쪽이라
서버 렌더 시점에 쓸 수 없다 — 즉 **앱 안에 광고 유입 판정이 없었다.**

그래서 유입 파라미터에만 걸지 않았다. 파라미터로만 가르면 **심사자가 랜딩 URL 을 직접
열었을 때 미확인 정보가 그대로 보인다.** 지시서의 근거("리드폼이 붙어 광고 성격이 명확")를
그대로 기준으로 삼아 **리드폼이 뜨는 페이지는 전부** 광고 문맥으로 본다.
유입 파라미터(`n_query`·`NaPm`·`utm_source=naver`)는 OR 조건으로 더한다.

`lib/apt/ad-safety.ts` — `isAdTrafficContext` · `shouldHideUnconfirmed` · `isConfirmed`.

가리는 것
- **진행 이력** — `confirmedOnly()` 로 확정만
- **세대수** — 현장 행 등급이 미확정이면 `resolveUnits(null, sub)` 로 공고 값만 남긴다
- **시공사** — 여섯 곳에 흩어져 있던 `site?.builder || sub?.constructor_nm` 를
  `builderName` 한 벌로 모으고 같은 게이트를 걸었다 (11곳 치환)

모집공고(`sub`)에서 온 값은 **공고 원문이라 등급과 무관하게 남긴다.**

> ⚠️ **`confidence = null` 을 확정으로 치던 버그를 같이 고쳤다.**
> 실측 `apt_site_events` 99건 중 **13건이 등급 없음**인데, 코드가 `?? 'confirmed'` 로
> 확정 처리하고 있었다 — 근거 없는 정보에 확정 딱지를 붙이는 셈이다.
> `confirmedOnly` 는 명시적 `'confirmed'` 만 통과시키고, 타임라인에는 `미확인` 등급을 새로 뒀다.

실측 미확정: `apt_site_events` 26/99 · `apt_sites` 27/5,687. 잃는 건 작고 심사 리스크는 0이 된다.

### §3 폰트 자체 호스팅

`layout.tsx:96` 의 jsdelivr `<link rel="stylesheet">` 가 **크로스 도메인 렌더링 차단**이었다.

⚠️ **`next/font/local` 을 쓸 수 없다.** Pretendard 다이내믹 서브셋은 `unicode-range` 로 갈린
@font-face 가 **92개**인데 `next/font/local` 은 src 별 unicode-range 를 받지 않는다.
서브셋을 버리고 단일 variable(1.2MB)로 가면 자체 호스팅해도 첫 화면이 더 느려진다.

→ `scripts/fetch-pretendard.mjs` 로 92개 woff2(2.82MB)를 `public/fonts/pretendard/` 에 받고,
@font-face 는 `src/app/styles/pretendard.css` 로 **번들 CSS 에 넣었다.**
**스타일시트 요청 자체가 사라진다.** 브라우저는 실제로 쓰는 유니코드 구간만 받는다.

- 중복 `preconnect`(95·103행) 둘 다 제거 — 받을 게 없는데 연결을 미리 여는 낭비다
- `font-display: swap` 은 원본 그대로
- 빌드 산출물 확인: 번들 CSS 에 `Pretendard Variable` 포함 · `/fonts/pretendard/…woff2` 참조 ·
  jsdelivr 폰트 참조는 webpack 캐시에만 잔존

> CSP 의 `font-src`/`style-src` jsdelivr 항목은 **건드리지 않았다.** 허용 목록이라 남아도
> 무해하고, `script-src` 쪽 사용처를 확인하지 않은 채 조이면 다른 게 깨질 수 있다.

⚠️ **CLS 0.213 은 아직 판단하지 않았다.** 지시서대로 "폰트 고친 뒤 재측정" 이다.
`size-adjust` 값을 추정으로 넣으면 오히려 어긋난다 — 재측정 결과를 보고 정한다.

---

## V19 A (2026-08-24) — 301 맵 재생성 · strict 규칙 전면 전환

### 301 맵 256 → 416건

DB 담당이 깨진 slug 160행을 정리하면서 `apt_site_merges` 를 재사용했다. 맵을 다시 구웠다.

**전사하지 않았다.** 생성기에 anon 키 폴백을 넣어 **DB 에서 직접 읽었다** —
`apt_site_merges`·`apt_sites` 는 읽기가 열려 있어 이 스크립트에 필요한 두 조회가 다 된다.
로컬 `.env.local` 의 `SERVICE_ROLE` 이 placeholder 라 이 폴백이 없으면 416쌍을 손으로 옮겨
적게 되고, **한 글자만 틀려도 301 이 404 가 된다** (V15 때 256쌍을 md5 로 대조해야 했던 이유다).

검증: 생성 결과와 DB 를 md5 대조 — `85b3e67ec7a55e0320bead3a41f29115`, 416건 일치.
`survivor_missing 0` · `dead_active 0` · `chained 0` · **활성 깨진 slug 0**.

### `generateAptSlugStrict` 를 `sync-apt-sites` 로 확대

지시대로 **먼저 실측했다.** `sync-apt-sites` 는 이 값으로 기존 행을 **조회도** 하므로
규칙을 바꾸면 매칭이 어긋날 수 있다.

느슨한 규칙을 SQL 로 재현해 활성 5,660행과 대조:

| | 건수 |
|---|---|
| 저장된 slug ≠ 느슨한 규칙 결과 | 651 (strict 여부와 무관하게 원래 불일치) |
| **느슨한 규칙이 깨진 결과를 내는 이름** | **2** |

그 2건은 둘 다 로마숫자(`Ⅰ`·`Ⅱ`)가 지워져 후행 하이픈이 남는 경우였다.

| 이름 | 저장 slug | loose | strict | 판정 |
|---|---|---|---|---|
| `테넌바움294 Ⅰ` | `테넌바움294` | `테넌바움294-` | `테넌바움294` | **strict 가 일치** |
| `오산 … 그랜빌 Ⅱ` | 옛 규칙 형태 | 불일치 | 불일치 | 변화 없음 |

**좋아지는 게 1건, 나빠지는 게 0건**이라 전환했다.
`generateAptSlug` 는 `aptHref` 폴백처럼 기존 값과 맞춰야 하는 자리에만 남는다.

---

## V18 A · B (2026-08-24) — slug 규칙 통일 · 피드 실데이터 전환

### A · slug 생성 규칙 통일

**전수 조사 결과 현장 slug 생성기는 두 곳이었다.**
`lib/apt-slug.ts` 의 `generateAptSlug` 와 `cron/sync-apt-sites` 의 `makeSlug` —
**로직이 완전히 같았다.** 사본을 걷어내고 원본을 import 한다 (동작 불변).

`apt/[id]/page.tsx` 의 영문 제거(`[a-z]+/g → ''`)는 전부 **조회 폴백**이고 생성 경로가 아니다.

> **실측: 깨진 slug 는 5개월째 새로 안 생긴다.**
> 최신 깨진 slug 생성 `2026-03-24` · 최신 행 `2026-08-23`.
> `---아이파크포레` 를 만든 영문 제거 규칙은 이미 코드에서 사라졌다.

**다만 현행 규칙도 깨진 slug 를 만들 수 있다.**
```
'e편한세상 - 가평' → 'e편한세상---가평'
```
하이픈 주변 공백이 연속 하이픈이 된다. 그런데 **`sync-apt-sites` 는 이 값으로
기존 행을 조회도 한다**(62·211행). 규칙을 바꾸면 느슨한 값으로 저장된 **활성 160행**을
못 찾아 같은 현장이 매 실행마다 새로 생긴다.

그래서 규칙을 둘로 나눴다.

| 함수 | 쓰는 곳 | 규칙 |
|---|---|---|
| `generateAptSlug` | 조회·링크 폴백 · `sync-apt-sites` | 기존 그대로 (연속 하이픈 남음) |
| `generateAptSlugStrict` | **새 레코드 생성만** (어드민 한 줄 입력) | 연속 하이픈 하나로 · 앞뒤 하이픈 제거 |

`isDegradedSlug()` 도 함께 뒀다(점검용). 테스트 11건.

⚠️ **기존 slug 는 하나도 바꾸지 않았다.** 색인이 걸려 있고 `apt_site_merges` 301 맵도
기존 값 기준이다. 활성 160행의 깨진 slug 를 정리하려면 **DB 마이그레이션이 먼저**다 —
코드만으로 바꾸면 중복이 난다.

### B · 피드 실데이터 전환

`supabase/functions/daily-content/index.ts` 를 다시 썼다.
⚠️ **Next.js 밖이라 `npm run build` 로 나가지 않는다.** `supabase functions deploy daily-content` 별도.

| 슬롯 | 소재 | 실측 대상 건수 |
|---|---|---|
| A | 부울경 이번 주 청약 일정 | 1 |
| B | 부울경 단계 변경 현장 (7일) | 34 |
| C | 부울경 최근 2주 고가 실거래 | 653 |
| 주식 | 상승률 상위 (3일에 한 번) | 1,846 |
| 잡담 | (3일에 한 번, 주식과 어긋난 날) | — |

- **대상 없는 날은 올리지 않는다.** `skipped_no_data` 로 응답에 남긴다
- `view_count` 랜덤 주입 **제거** — 0에서 시작한다
- 지역 판정은 **`apt_sites.region`** (슬롯 B는 `apt_sites!inner` 조인 + `.in('region', …)`)
- **`apt_tags` 를 채운다** — 슬롯 A는 `apt_subscriptions.slug`, B는 `apt_sites.slug`.
  피드 → 현장 → 리드폼 동선이 여기서 생긴다
- 중복 방지를 **카테고리 단위 → 제목 단위**로 바꿨다.
  카테고리로 막으면 부동산 3슬롯 중 하나만 올라간다
- 슬롯 B는 등급(`확정`/`추정`/`카더라`)을 본문에 그대로 표기한다

**비율**: 부동산 3슬롯 매일 + 주식·잡담 각 3일에 한 번(서로 어긋난 날) =
3일 기준 **9 : 1 : 1 = 82 / 9 / 9**. 주식·잡담을 0으로 만들지 않는다.

### B-4 · `local` — 이미 처리돼 있었다

`FeedClient.tsx:268` — **r4-P4 에서 이미 탭을 뺐다.**
`categories` 배열은 `전체 · 주식 · 부동산 · 자유` 뿐이고, 주석에 이유가 적혀 있다
("4개월째 새 글 0건"). 카테고리 자체는 DB 에 보존되고 `?category=local` 직접 진입도 동작한다.
**지시서가 요구한 상태 그대로라 손대지 않았다.**

---

## V17 G — 크론 + 조감도 (제약 5가지)

`api/cron/builder-site-sync/route.ts` · `lib/builder-sites/hero.ts` · 테스트 11건 (전체 169건 통과)

### 저장 규칙 (G-5)

| 항목 | 규칙 |
|---|---|
| `name_variants` | **추가만.** 기존 값과 대조해 중복만 거른다 |
| `builder`·`supply_units`·`complex_units` | **비어 있을 때만** |
| `confidence` | `confirmed` (시공사가 자기 사이트에 적은 숫자) |
| `lifecycle_stage` | **건드리지 않는다.** DART·어드민만 |

매칭은 **이름 정확 일치 + 지역 일치**. 시군구를 양쪽 다 알면 그것도 맞아야 한다.
후보가 여럿이면 **고르지 않는다.**

상한: 별칭·세대수 **30건** / 이미지 **10건** — 서로 독립적으로 센다.

### 조감도 — 이미지에만 붙는 제약 5가지

| | 규칙 | 구현 |
|---|---|---|
| ① | 목록 썸네일이 아니라 상세의 큰 이미지, 1200px 미만 건너뜀 | `detailNo` → `/sale/view/{no}` · `measureFirstUsable` 이 sharp 로 실측 |
| ② | credit 은 **시공사명만** | `credit: site.builder`. URL·수집일·경로를 넣지 않는다 |
| ③ | `hero_image_url` 이 있으면 덮어쓰지 않음 | 매칭 직후 확인하고 건너뛴다 |
| ④ | A등급 소스만 | 시공사 공식 도메인은 무조건 통과. 전용 홈페이지는 **robots 확인 + 푸터에 시공사명 AND 사업자등록번호** |
| ⑤ | 하루 10건 + 롤백 대상 특정 | `IMAGE_CAP`, 응답의 `hero_image_url` 을 로그·메타데이터에 남긴다 |

### ⚠️ 실측이 전제와 달랐다 — "목록 카드는 축소본" 이 아니다

ihanulche.co.kr 실측:

| | 크기 |
|---|---|
| 목록 카드 | **4016×4016** · 1.6MB |
| 상세 페이지 | **13465×8976** · 8.6MB |
| `og:image` | 800×400 **브랜드 로고** |

목록 카드도 원본이고 CSS 로 줄여 쓴다. 그래서 ①의 실효 규칙은 "상세를 쓴다" 가 아니라
**"1200px 미만이면 건너뛴다"** 쪽이다. 상세를 우선하되 그 판정은 실측으로 한다.

다만 상세 이미지가 **120메가픽셀**이라 서버리스에서 그냥 열면 위험하다.
`MAX_HERO_BYTES 20MB` · `MAX_HERO_PIXELS 80MP` 가드를 두고, 넘으면 그 후보를 건너뛴다.

**`og:image` 를 후보로 쓰지 않는다.** 실측에서 브랜드 로고가 나왔다 —
사이트가 거기에 조감도를 넣어 준다는 보장이 없다. 업로드 경로(`/upload/`)의 사진만 본다.

### 두산

`doosanenc.com` 은 `Disallow: /kr/` 이라 **`weveapt.co.kr` 만** 쓴다.
레지스트리 후보 목록에서 `doosanenc.com` 을 뺐다.

### 남은 것

- 크론 등록(pg_cron)은 아직 안 했다. 첫 실행은 **수동으로 한 번 돌려 로그를 보고** 붙이는 게 맞다 —
  이미지가 실제로 올라가는 경로라 무인 반복 전에 눈으로 확인할 것이 있다
- `weveapt.co.kr`·`hauterre.co.kr`·`thesharp.co.kr`·`poscoenc.com` 은 목록 구조 실측 후 레지스트리로 옮긴다

---

## V17 G — 시공사 브랜드 사이트 목록 크롤 (파서까지)

설계 변경: 현장마다 웹 검색(206회) → **시공사 브랜드 사이트의 「분양단지 목록」 한 장**.
한 번 조회로 여러 현장의 별칭·세대수·조감도·전용 홈페이지를 동시에 얻는다.

| 파일 | 역할 |
|---|---|
| `lib/builder-sites/registry.ts` | A등급 소스 레지스트리 — 추가는 이 파일 한 곳 |
| `lib/builder-sites/parse.ts` | 목록 HTML → 카드. 라벨(`<th>`) 기반 |
| `__tests__/fixtures/hanulche-sale-list.html` | **실제로 받아온 HTML** |
| `__tests__/builder-site-parse.test.ts` | 12건 |

### robots 실측 (2026-08-24, 직접 확인)

| 도메인 | robots |
|---|---|
| `www.ihanulche.co.kr` | `Allow: /` (`/mypage`·`/download` 만 차단) ✓ |
| `hauterre.co.kr` | `Allow: /` — `anthropic-ai`·`Claude-Web` 을 명시적으로 허용 ✓ |
| `www.thesharp.co.kr` | `Allow: /` (`/admin_sharp`·`/upload` 차단) ✓ |
| `weveapt.co.kr` | `Allow: /` ✓ |
| `poscoenc.com` | `Allow: /` ✓ |
| `doosanenc.com` | `Allow: /` **but `Disallow: /kr/`** ⚠️ 한국어 경로는 쓸 수 없다 |

레지스트리에는 **구조를 실측한 하늘채 3개 목록(분양·공사·입주)만** 넣었다.
나머지는 `BUILDER_SITE_CANDIDATES` 에 두고 구조 확인 후 옮긴다 —
구조를 모르는 채 파서를 돌리면 빈 결과를 "수집했다" 고 기록하게 된다.

### 총 세대수 셀 — 실측 3형식

```
466세대                        → 단지 전체 466
1,670세대 중 일반분양 1,061세대  → 단지 전체 1,670 · 분양 공급 1,061   ← G-2 실증 사례
아파트 총 1,242세대             → 단지 전체 1,242
```
**앞 숫자가 단지 전체다.** 뒤 숫자를 잡으면 화면이 1,061세대 단지라고 말한다 —
실제로 그렇게 나가고 있던 값이다. 테스트로 고정했다.

### 실측에서 드러난 함정 3개

**① 카드 경계를 `<li>` 분할로 잡으면 안 된다.**
카드 안 `util-list` 의 중첩 `<li>` 때문에 표 뒤의 **전용 홈페이지 링크가 잘려 나간다.**
`<li>` 를 앞에서부터 훑는 방식도 안 된다 — 실측 카드 6장인데 시작점 27개, 첫 블록 101자였다.
**제목을 닻으로** 잡는다. 제목은 카드당 하나뿐이라 중첩에 흔들리지 않는다.

**② 브랜드 사이트는 지역 풀네임을 쓴다.** 실측 `부산광역시` — `apt_sites.region` 은 `부산` 이다.
축약 규칙은 이미 `formatRegionShortSafe` 에 있어 **재구현하지 않고 가져다 썼다**
(`경상남도`→`경남` 은 접미사 제거로 안 나온다).

**③ 같은 단지가 두 번 실린다.** 실측 `금정산 하늘채 루미엘` ×2. 이름 기준으로 접는다.

### 페이징

`?currentPage=N` 이 **누적**이다 (2쪽 = 1쪽 3건 + 3건 = 6건). 증분이 멈출 때까지 올리면 된다.

### ⚠️ 내가 밟은 함정 — 검증을 사본에 대고 했다

임시 스크립트에서 백슬래시가 하나 빠져(`\s`→`s`) "0건 파싱" 을 한참 쫓았다.
**진짜 모듈이 아니라 로직 사본을 돌리고 있었다.** 실제 `parse.ts` 는 멀쩡했다.
그래서 고정 자료를 저장소에 넣고 **모듈을 직접 import 하는 테스트**로 바꿨다.
셸 heredoc 에 정규식을 넣지 말 것 — 편집은 Edit 로 한다.

### 남은 것

크론(G-3)과 저장 규칙(G-5) 적용은 다음 커밋. 파서가 실측으로 검증된 뒤에 붙인다.
목록 카드의 **조감도 URL** 도 같이 나온다 — `[NODE]` 3번(조감도 A등급 소스 부족)의
일부는 이 경로로 풀릴 수 있다. `/api/admin/apt-cover` 가 JSON `{slug,url,credit}` 을
머신 토큰으로 받으므로 연결만 하면 된다.

---

## V17 — 기존 실패 테스트 2건 수정 (2026-08-24)

두 건 다 테스트가 아니라 **구현이 틀렸다.** 146건 전부 통과.

### ① `getStatusDday` — 기본 인자가 뒤 인자를 못 본다

```ts
// 전
status: SubscriptionStatus = getSubscriptionStatus(row),
today: string = todayKST(),
```
기본값이 평가될 때 뒤에 오는 `today` 는 아직 초기화 전이라 참조할 수 없다.
그래서 호출부가 `today` 를 넘겨도 **상태 판정만 실제 오늘로** 되고,
D-day 와 상태가 서로 다른 날을 말한다. 날짜를 고정한 테스트·시뮬레이션에서 드러난다.

```ts
// 후
status?: SubscriptionStatus,
today: string = todayKST(),
...
const resolved = status ?? getSubscriptionStatus(row, today);
```
`getSubscriptionStatus` 는 원래 `today` 를 받는다 — 연결만 안 돼 있었다.

> **지금 화면에는 영향이 없다.** `getStatusDday`·`compareBySubscriptionStatus` 는
> 외부 호출부가 0건이고, 내부 호출 2곳은 `status` 를 명시로 넘긴다.
> 그래도 export 된 함수라 다음 사용자가 같은 함정을 밟는다.

### ② `PostCreateSchema.title` — 1자 제목을 받고 있었다

`min(1)` → `min(2, '제목을 2자 이상 입력해주세요')`.
테스트가 1자 거부를 기대하는 게 맞다 — 제목 한 글자를 허용할 이유가 없다.

> ⚠️ `PostCreateSchema` 가 **`lib/validations.ts` 와 `lib/schemas.ts` 두 곳에 있다.**
> 실제로 쓰이는 건 `validations.ts`(`api/posts/route.ts` 가 그걸 import)이고
> `schemas.ts` 쪽은 **import 하는 곳이 0건**이다(`title.min(1)`·`max(100)`·category 목록도 다르다).
> 이번엔 쓰이는 쪽만 고쳤다. 죽은 사본 정리는 별건으로 둔다 —
> V15 에서 지운 `AptThumbnailCard` 와 같은 유형이다.

---

## V17 F-1 후속 (2026-08-24) — 게이트를 RPC 로 이관

DB 담당이 목록 노출 조건을 `get_apt_pipeline` 안으로 옮겼다. 프론트 게이트를 걷어냈다.

**실측이 프론트 계산과 일치한다** — 전국 93(4쪽·마지막 3건) · 부울경 35(2쪽) · 부산 21.
응답에 `gated: true` 가 붙어 구버전과 구분된다.

| 이전 | 이후 |
|---|---|
| `/apt` 섹션이 24건 받아 8건으로 거름 | 8건 받아 그대로 냄 |
| 총계 표기 제거 | `부울경 35곳 · 진행 단계순` 복원 |
| `/apt/pipeline` 이 쪽별 통과 건수만 말함 | `93곳 · 1/4쪽` 정상 총계 |
| 쪽마다 건수가 들쭉날쭉, 빈 쪽 가능 | 마지막 쪽까지 정상으로 참 |

`AptPipelinePayload.gated` 를 타입에 넣었다 — `false` 면 게이트 이전 total 이라는 뜻이라
로그(`gated=…`)로도 확인된다.

### 테스트는 남긴다 — RPC 조건의 회귀 기준

`lib/apt/pipeline-gate.ts` 에서 **DB 를 만지던 헬퍼(`siteIdsWithHistory`·`filterByComposition`)만
걷어내고 순수 판정 함수는 남겼다.** 목록 필터로 다시 쓰지 말 것 — 규칙이 두 벌이 된다.

남긴 이유는 하나다. **규칙이 DB 로 갔다고 검증까지 사라지면 나중에 RPC 를 고칠 때
조건이 조용히 바뀐다.** 파일 상단에 집행 중인 SQL 을 그대로 적어 두고,
테스트가 "무엇이 통과해야 하는가" 를 실행 가능한 형태로 고정한다.

실측값도 `RPC_MEASURED_2026_08_24` 로 박았다. 데이터가 늘어 숫자가 변하는 건 정상이니
어긋나면 **지우지 말고 RPC 조건이 그대로인지 먼저 확인한 뒤 갱신**한다.
테스트 12건 → **15건**(게이트 이전 206 대비 절반 이하인지 · 마지막 쪽 건수 · 쪽수 계산).

### 목록 행에 두 축을 낸다

RPC 가 `supply_units`·`complex_units` 를 따로 실어 주면서 목록 행도 V15 C 규칙을 따른다 —
`분양 공급 1,061` + 작은 글씨 `총 1,670세대`. 어느 쪽 숫자인지 밝히지 않으면
경쟁률의 분모와 단지 규모가 섞인다. 값이 없으면 `미정`(공고 전이라 아직 정해지지 않았다).

### 기존 테스트 실패 2건 — 제 변경과 무관

`unit/subscription-status.test.ts > getStatusDday > status 를 생략하면 스스로 판정해서 센다`
`unit/validations.test.ts > PostCreateSchema > rejects short title`

`git stash` 후에도 똑같이 실패한다. 이번 작업 이전부터 깨져 있던 것이라 손대지 않았다.
전체 146건 중 144건 통과.

---

## V17 H-1 · F (2026-08-24) — 주식 크론 축소 · 공고 전 페이지 최소 구성

### H-1 · 주식 크론 (DB 조작, 코드 변경 없음)

**끄기 전 사용처를 전수 확인했다.**

| 크론 | 조치 | 사용처 확인 결과 |
|---|---|---|
| `stock_logo_fetch`(103) | **중지** | `RelatedStocks.tsx` 가 `logo_url` 을 **select 만 하고 렌더하지 않는다.** V4-C7-3 확인 |
| `kadeora-stock-image-crawl`(55) | **중지** | ⚠️ `stock_images` 12,639행은 **살아 있는 사용처가 있다** — 이미지 사이트맵 · `/stock/[symbol]` 갤러리. 크론을 꺼도 **기존 행은 그대로**다. 멈추는 건 신규 수집뿐 |
| `stock-fundamentals-us`(114) | **중지** | 해외 종목 |
| `refresh-mv-stock-sector-leaders`(46) | **중지** | `mv_stock_sector_leaders` 참조 **0건** — src·DB 함수·뷰 전부. MV 는 마지막 값을 유지한다 |
| `stock-issue-scores-weekday`(145) | 5분 → **15분** | `3-58/15 0-15 * * 1-5` |
| `stock-issue-scores-weekend`(146) | 매시 → **6시간** | `0 */6 * * 0,6` |

**건드리지 않은 것**: `dart-ingest`(115) · `exchange-rate` ×2(4·5) · `stock-fundamentals-kr`(113).

> 55번의 대가는 분명히 해 둔다 — **새로 편입되는 종목은 이미지가 안 쌓인다.**
> 화면이 깨지지는 않지만 이미지 사이트맵이 주식 쪽에서 더 자라지 않는다.

### F-1 · 목록 노출 조건

진행 이력 · 시공사 · 세대수 · 위치(시군구까지) 중 **2개 이상**.

**실측: 파이프라인 206곳 중 93곳만 통과(113곳 탈락).** 부울경 40 → 35.
절반 넘게 떨어지는 조건이라 붙이고 안 붙이고가 목록의 성격을 바꾼다.

`lib/apt/pipeline-gate.ts` 한 곳에 규칙을 둔다 — `/apt` 섹션과 `/apt/pipeline` 이
다른 기준을 쓰면 같은 현장이 한쪽에만 나온다. 테스트 12건.

- 위치는 **시군구까지** 본다. RPC 의 `supply_addr` 은 `concat_ws(region, sigungu, dong)` 이라
  시·도만 있어도 비지 않는다 — "지역명 뒤에 뭐가 더 있는가" 로 판정한다
- 이력 조회가 실패하면 **빈 집합**을 쓴다. "있다" 고 가정하면 조건이 느슨해진다
- `/apt` 섹션은 8칸을 채우려 24건을 받아 거른다

### ⚠️ 게이트가 RPC 밖에 있다 — DB 담당 판단 필요

`get_apt_pipeline` 이 게이트 없이 세므로 `total`·`total_pages` 가 목록보다 크다.

- `/apt` 섹션: 총계 표기를 뺐다(`부울경 · 진행 단계순`)
- `/apt/pipeline`: **이 페이지의 통과 건수**만 말한다(`12곳 · 2/7쪽`).
  페이지 이동은 게이트 이전 `total_pages` 를 그대로 쓴다 — 통과분은 전부 도달 가능하지만
  **쪽마다 건수가 들쭉날쭉하고, 한 쪽이 통째로 빌 수 있다**(그때는 "다음 쪽을 보세요" 로 안내)

RPC 에 아래 조건이 들어가면 프론트 게이트를 걷어내고 총계를 정상화할 수 있다.
```sql
AND ( (select count(*) from apt_site_events e where e.site_id = s.id) > 0 )::int
  + (s.builder is not null)::int
  + (coalesce(s.supply_units, s.complex_units, s.total_units) is not null)::int
  + (s.sigungu is not null)::int >= 2
```

### F-2 · `미정` 과 `미공개` 를 가른다

공고 전 현장은 값이 **없는** 게 아니라 **아직 정해지지 않은** 것이다.
`미공개` 로 쓰면 누군가 알고 감추는 것처럼 읽힌다.

- KPI 분양가 칸: 공고 전이면 `미정` + 보조 `공고 후 확정`
- 공급 정보 표: 빈 칸이 공고 전이면 `미정`
- 표 아래 안내문도 갈린다 — `분양가와 일정은 모집공고가 나와야 확정됩니다.`
- ⚠️ **추정치를 채우지 않는다** (표시·광고법)

판정: 모집공고가 없고 `lifecycle_stage` 가 공고 전 7단계일 때.

---

## V16 E-1·E-2 (2026-08-24) — DART 정비사업 필터

지시서의 「제목에서 판별」은 성립하지 않는다(전제 정정 확인됨). `report_nm` 은
`단일판매ㆍ공급계약체결` 고정 서식명이고 구역명·계약금액은 **본문**에 있다.
그래서 본문을 받아 판정한다.

| 파일 | 역할 |
|---|---|
| `lib/dart/filing-body.ts` | `document.xml`(ZIP) 수신 · 압축 해제 · EUC-KR 디코딩 · 태그 제거 |
| `lib/dart/redev-match.ts` | 건설사 판별 · 구역명 추출 · 매칭 규칙 (순수 함수) |
| `lib/dart/redev-pipeline.ts` | 공시 한 건 처리 — 자동 반영 / 큐 / 폐기 |
| `api/cron/dart-ingest/route.ts` | 후보 수집 + 처리 호출 |
| `__tests__/dart-redev-match.test.ts` | 회귀 18건 |

### 판정 규칙

```
1차 필터   corp_name 이 건설사 AND 본문에 '구역' 또는 '정비사업'
           → 둘 다 아니면 큐에도 넣지 않고 버린다
자동 반영   구역명이 apt_sites.name 또는 name_variants 와 정확 일치
           AND corp_name 이 그 현장 builder 와 일치     ← 이 둘이 2개 조건
           → confidence='confirmed', stage_source='dart', source_url=공시 링크, 즉시 IndexNow
그 외       검수 큐
```

**본문 조건이 조선·전자를 떨어뜨리는 유일한 방어선이다.** 실측 오탐원 —
HJ중공업 14 · 삼성중공업 9 · 한화오션 7 · 현대오토에버 6. 이름만 보면 걸린다.
`isConstructionCorp` 에 부정 목록(`중공업|오션|조선|해양|오토에버|전자|…`)을 따로 둔 것도
같은 이유지만, 그게 새더라도 본문 조건에서 걸러진다.

### 지킨 것

- **부분 일치 금지.** 구역명은 정확 일치만. 표기 흔들림(공백·괄호·대소문자)만 흡수한다
- 같은 구역명 현장이 둘이면 **고르지 않는다** — 모르면서 하나를 고르는 게 못 찾는 것보다 나쁘다
- **`stage_locked` 현장은 건드리지 않는다.** 사람이 손으로 정한 단계를 공시가 덮으면 안 된다
- 본문 수신 실패는 **자동 반영으로 넘어가지 않는다.** 큐로 보낸다
- 트리거가 만든 `stage_change` 행에 `source_url`·`note` 를 얹는다(행을 더 만들지 않는다)

### 왜 `dart-ingest` 안에서 하나

별도 크론으로 빼면 15분이 한 번 더 붙어 30분 목표를 넘긴다. 대신 본문 왕복을
**메인 루프 밖**에서 처리하고 한 번에 8건으로 상한을 둔다 — 정정 공시가 몰린 날
본문 왕복이 `maxDuration` 을 잡아먹어 수집 자체가 끊기면 안 된다.
실측 빈도는 하루 1~2건이다(건설사 공급계약 90일 100건).

### ZIP 을 직접 푼 이유

`opendart` 의 `document.xml` 은 ZIP 을 주는데 저장소에 zip 라이브러리가 없다.
의존성을 하나 늘리는 것보다 `node:zlib` 의 `inflateRawSync` 로 local file header 를
훑는 40줄을 소유하는 쪽을 골랐다. DART 가 쓰는 압축은 stored(0)/deflate(8) 둘뿐이다.
edge case 를 만나면 `fflate` 로 갈아타는 건 `filing-body.ts` 안에서 끝나는 교체다.

### ⚠️ DB 담당 — 검수 큐 테이블이 아직 없다

없으면 **경고만 남기고 크론은 계속 돈다**(자동 반영 경로는 지금도 동작한다).
다만 애매한 건이 어디에도 안 남는다. 아래 DDL 이 들어오면 바로 쌓인다.

```sql
create table if not exists public.apt_stage_review_queue (
  id           bigserial primary key,
  rcept_no     text not null,
  corp_name    text,
  report_nm    text,
  source_url   text,
  zone_candidates jsonb not null default '[]'::jsonb,
  reason       text,
  proposed_stage text,
  status       text not null default 'pending'
               check (status in ('pending','approved','rejected')),
  resolved_site_id uuid references public.apt_sites(id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create unique index if not exists apt_stage_review_queue_rcept_pending
  on public.apt_stage_review_queue (rcept_no) where status = 'pending';
```

⚠️ `DART_API_KEY` 는 Vercel 환경에만 있어 **본문 응답을 로컬에서 못 찍었다.**
ZIP 파싱과 EUC-KR 디코딩은 배포 후 `dart-ingest` 로그의
`redev_candidates` / `redev_auto` / `redev_queued` / `redev_discarded` 로 확인해야 한다.

### 곁다리

vitest 는 `src/__tests__/**` 만 수집한다(`vitest.config.ts`). 테스트를 lib 옆에 두면
조용히 실행되지 않는다 — 저장소 관례대로 `src/__tests__/` 에 뒀다.

---

## V16 E-3 (2026-08-24) — 이번 주 움직인 현장 · ⚠️ DART 필터는 전제가 성립하지 않는다

### E-3 · 이번 주 움직인 현장

| 파일 | 역할 |
|---|---|
| `lib/apt/recent-moves.ts` | `apt_site_events` 최근 7일 `stage_change` + `apt_sites` 임베드 |
| `components/apt/RecentMovesStrip.tsx` | `/apt` 상단 가로 스트립 |

- 실측 7일 **71건 · 부울경 31건** — 렌더할 데이터가 있다
- 히어로(청약 타임라인) 바로 다음 = 콘텐츠 스택 맨 위. **0건이면 아무것도 그리지 않는다**
- 같은 현장이 한 주에 두 번 움직이면 최신만 남긴다
- 지역 규칙은 파이프라인 섹션과 **같은 값**을 쓴다 — 두 섹션이 다른 지역을 말하면 안 된다
- 등급을 감추지 않는다. **확정만 초록**, 추정 주황, 카더라 회색

목록 행(.kd-lrow)이 아니라 가로 스트립인 이유: 상단에서 세로를 많이 먹으면 청약 목록이
첫 화면에서 밀려난다. 훑고 지나가는 정보라 가로가 맞다.

---

### ⚠️ E-1·E-2 (DART 정비사업 필터) — 지시서 전제가 데이터와 다르다

지시서: *"제목에서 `구역`·`정비사업`·`재개발`·`재건축`… 판별"*, *"필터만 붙인다"*.

**실측 — `dart_filings` 44,441건 기준**

| | |
|---|---|
| `report_nm` 에 `구역\|정비사업\|재개발\|재건축\|지역주택조합\|가로주택` 포함 | **0건** |
| `report_nm` 에 `공급계약` 포함 | 927건 |
| 그중 건설사 추정 법인 | 100건 |

`report_nm` 실제 값은 이렇다.
```
단일판매ㆍ공급계약체결
[기재정정]단일판매ㆍ공급계약체결
[기재정정]단일판매ㆍ공급계약체결(자회사의 주요경영사항)
```
**고정 서식명뿐이다.** 지시서가 든 예시 `「단일판매·공급계약 체결」 ○○구역 주택재개발정비사업 —
계약금액 8,420억` 의 구역명·금액은 전부 **공시 본문**에 있고, 제목에는 없다.

**왜 막히나**

`dart-ingest` 는 `list.json` 만 부른다. 거기서 얻는 건 `corp_name`·`report_nm`·`rcept_no` 뿐이다.
E-1 의 자동 반영 조건은 *"세대수·주소·시공사 중 2개 이상 DB 일치"* 인데,
`list.json` 으로는 **시공사 하나밖에 못 얻는다.** 2개를 영원히 못 채우므로
전부 검수 큐로 가고, 그건 E-1 이 명시적으로 금지한 상태다("전부 큐로 보내면 속도가 죽는다").

**본문을 받으려면**

- 저장소에 DART **본문을 받는 코드가 0건**이다 (`document.xml`·`dsaf001` 호출 없음).
  `dart-classify` 도 `report_nm`+`corp_name` 만 Haiku 에 넘긴다
- `opendart` 의 `document.xml` 은 **ZIP** 을 준다. 저장소에 zip 라이브러리가 없다
  (`fflate`/`jszip`/`adm-zip` 전부 미설치)
- 단일판매·공급계약은 거래소 수시공시라 opendart 의 구조화 엔드포인트가 덮지 않는다

**필요한 결정** (셋 중 하나)
1. zip 의존성 1개 추가(`fflate` 권장 — 경량, 순수 JS) 후 `document.xml` 파싱
2. 의존성 없이 `zlib.inflateRawSync` 로 ZIP local header 를 직접 파싱 (약 40줄, 우리가 소유)
3. 본문 없이 가는 대안 — 건설사 `단일판매ㆍ공급계약체결` 을 **전량 검수 큐**로 보내고
   사람이 3초에 한 건 판정 (하루 1~3건 수준). 속도 목표 30분은 사람이 볼 때까지로 늘어난다

⚠️ `DART_API_KEY` 는 Vercel 환경에만 있어 로컬에서 본문 응답 형태를 실측할 수 없다.
어느 쪽으로 가든 **첫 호출 한 번은 배포된 환경에서 찍어봐야 한다.**

E-3 의 검수 큐는 DART 가 채우기 전까지 빈 화면이라 위 결정과 함께 묶어 둔다.

---

## V16 (2026-08-24) — llms.txt RPC · 부분 일치 축소 · 어드민 한 줄 입력

롤백 지점 `pre-v16-20260823`.

### A · `/llms.txt` 시간 예산 → RPC (`9752a462`, 배포 확인)

앞 커밋의 20초 예산은 **배포를 살렸을 뿐 숫자를 버리고 있었다.** 원인(34k행 34~100 왕복)이
그대로라 데이터가 커질수록 항상 예산을 넘겨 영원히 `FALLBACK` 상수만 나가게 된다.

`get_llms_hub_counts()` 한 번(실측 500ms)으로 교체. RPC 가 값을 못 주면 **0 으로 덮지 않는다** —
0 은 "허브가 없다" 는 거짓말이 된다. `try/catch`·`FALLBACK`·`revalidate=86400` 유지.

`sitemap/[id]/route.ts` 의 같은 `range(off)` 8곳은 `force-dynamic` 이라 빌드타임 프리렌더
대상이 아니다. 손대지 않았다.

> **검증이 한 번 헛돌았다.** llms.txt 본문에서 `191` 을 찾는 폴링을 걸었는데
> `FALLBACK` 상수가 정확히 `191`/`1440` 이라 RPC 값과 구분되지 않는다.
> `sw.js` 의 `CACHE_VERSION` 이 커밋 sha(`inject-sw-version.mjs`)라는 걸 이용해 다시 확인했다.
> **배포 확인은 앞으로 이 마커를 쓴다.**

### B · 확인 4건 (전부 통과)

`/apt/센트럴자이` → `/apt/dmc센트럴자이` 301 · `/apt/-마곡지구-9단지` → `/apt/sh-마곡지구-9단지` 301 ·
부울경 파이프라인 `total 40` / 관리처분인가 6 · 검색 `광안A구역`·`망미2구역` → `부산 망미 재건축`.
IndexNow 256건은 **301 라이브 확인 뒤** 큐잉했다.

### C · 부분 일치 축소 (`59b06446`)

`fetchUnifiedData` Stage 4·5 가 한글 2자만 있으면 `%검색어%` 로 `content_score` 1등을 그냥 집었다.
`/apt/자이` → 아무 자이 단지. 오타·크롤러 URL 이 거의 무한히 200 이 되고 사용자는 엉뚱한 현장을 봤다.

- `soleMatch()` — `limit(2)` 로 받아 **정확히 1건일 때만** 채택. 2건 이상이면 포기 + `warn`
- 최소 길이 2자 → **4자**
- 못 찾으면 `notFound()` 대신 `/apt/search?q=` 로. 그 페이지는 `noindex, follow` 라
  무한 색인 경로가 생기지 않는 걸 확인하고 골랐다

### D · 어드민 한 줄 입력

| 파일 | 역할 |
|---|---|
| `api/admin/apt-stage/route.ts` | GET 검색 · POST 생성/갱신 |
| `admin/apt-stage/page.tsx` · `StageInputClient.tsx` | 모바일 한 화면 |

인증은 `/api/admin/apt-cover` 패턴 그대로 — 세션 **또는** 머신 토큰.
머신 토큰 판정은 `verifyCronAuth` 하나만 쓴다(재구현 금지).

**머신 토큰 경로 제약 3가지**

| | 규칙 |
|---|---|
| `stage_locked` | **강제 false.** 세션 생성만 true. 크론이 교정할 여지를 남긴다 |
| `confidence` | 기본 `estimated`. **`confirmed` 는 세션 전용** — 보내면 403 (조용히 낮추지 않는다) |
| 하루 생성 | `admin:machine` 으로 오늘(KST) 만든 현장 50건 초과 시 **429** |

`stage_source` 를 `admin`(세션) / `admin:machine`(머신)으로 나눴다.
지시서는 `'admin'` 이라고만 적었지만 **하루 상한을 정확히 세려면 구분이 필요하다** —
합쳐 두면 사람이 만든 것까지 세어 사람을 막는다. 기존 값이 `migration:redevelopment_projects`
라 콜론 접두 규약은 이미 있다. 타임라인 출처 라벨에 `카더라 확인(자동)` 을 추가했다.

### ⚠️ 트리거에 대해 지시서가 반만 맞았다

"트리거가 이력을 자동 기록하므로 별도 insert 불필요" — **갱신에만 맞는다.**
실측: `apt_sites_stage_change` 는 **BEFORE UPDATE 전용**이고 INSERT 에는 걸리지 않는다.
그대로 뒀으면 D-2 시험대 6건(전부 신규 생성)이 **진행 이력 0건**으로 남고,
그러면 V16 F 의 목록 노출 조건(이력·시공사·세대수·위치 중 2개)에도 못 든다.

또 트리거는 `confidence`·`source` 만 옮기고 **`note`·`source_url` 은 옮기지 않는다.**

라우트가 셋으로 나눠 처리한다.
- **생성** → 이벤트를 직접 하나 남긴다 (트리거가 안 걸리는 구간)
- **갱신 + 단계 변경** → 트리거가 만든 행에 메모·출처를 **얹는다** (행을 더 만들지 않는다)
- **갱신 + 단계 동일** → 메모가 있을 때만 `note` 이벤트 1건 (안 그러면 메모가 화면 어디에도 안 나온다)

트리거를 INSERT 까지 확장하고 `note`·`source_url` 을 옮기게 하면 이 우회는 걷어낼 수 있다 — DB 담당 판단.

### 제약 검증 (실측 완료)

| 대상 | 결과 |
|---|---|
| `lifecycle_stage` CHECK | 19값. 어드민 7단계 **전부 포함** |
| `stage_source` CHECK | **없음** — 자유 텍스트. `admin:machine` 안전 |
| `confidence` CHECK | **없음** — 자유 텍스트 |
| `site_type` CHECK | `redevelopment` 포함 |
| `status` CHECK | `upcoming/open/closed/active/completed`. insert 가 값을 안 줘 DEFAULT `active` 로 들어간다 |
| `apt_site_events` | PK·FK 뿐. `event_type`·`confidence` 에 CHECK 없음 |

> 조회 중 MCP 가 여러 번 `Connection terminated` 를 냈다. **DB 부하가 아니라 관리 API 통로의
> 간헐적 끊김이고 재시도하면 통과한다** (2026-08-24 확인: 잠금 0 · 대기 0 ·
> idle in transaction 0 · 연결 40개 전부 정상 풀). 쿼리를 단순화하거나 조회를 포기하고
> 우회하지 말 것 — 그대로 조회하고 재시도한다.

> 어드민 화면이 다루는 단계를 **공고 전 7단계로 제한한 것은 제품 판단**이다(DB 우회가 아니다).
> 청약·입주 단계는 모집공고와 크론이 정한다 — 사람이 손으로 되돌리면 다음 크론이 덮고
> 그 사이 화면이 두 번 바뀐다.

---

## V15 2단계-c (2026-08-23) — B 시각 마감 · 죽은 롤백 참조 제거

### 아코디언 안 카드 안 카드 — 범위 지정 override

```css
.kd-acc-body .apt-card{
  border:0; background:transparent; box-shadow:none;
  border-radius:0; padding-left:0; padding-right:0;
}
```
클래스를 벗기지 않는다. **인라인 스타일이 CSS 를 이기므로** 색 있는 카드
(경쟁률 보라 · 분양가 대비 빨강/초록)는 자기 배경과 패딩을 그대로 지킨다.
클래스를 제거하면 패딩까지 잃지만 이 방식은 잃지 않는다.
좌우 패딩은 아코디언 본문이 갖고 내부 카드는 0.

### 섹션 헤더

| | |
|---|---|
| 높이 | 40px · 전체가 클릭 영역 |
| 좌측 `▶` | 11px `--text-tertiary` · 열리면 90도 `.18s` |
| `h2` | 13px / 800 / `letter-spacing -.03em` |
| 우측 카운트 | 10px `--text-tertiary` |
| 하단 | 1px `--border` |

닫힌 상태에서는 하단 선을 투명으로 둔다 — 헤더가 카드의 전부인데 선을 그리면
허공에 밑줄이 남는다.

### 세대수 근거 블록 — 표 **위**로

`--accent-blue-bg` · 1px 테두리 · radius 9px · padding 10px.
2행 (`분양 공급` / `단지 전체`), 행 사이 1px dashed, 하단 점선 위 안내문 9.5px.
라벨 11px/700 `--accent-blue` + 보조설명 9px, 숫자 우측 16px/800 `-.04em`.

**`complex_units` 가 null 이면 숫자 자리에 `미확인` 12px `--text-tertiary`.**
추정하지 않는다 — `apt_complex_profiles` 는 34,544건 중 96건만 값이 있다.

이전에는 두 축이 모두 있고 값이 다를 때만 냈는데, 이제 한쪽만 있어도 낸다.
"한쪽만 확인된 현장입니다" 를 말하는 게 아무 말도 안 하는 것보다 낫다.

### 진행 이력 타임라인

- 좌측 세로선 1.5px `--border` · 점 7px + 표면색 테두리 2px + 링 1.5px
- **확정만 `--brand` 점**, 추정·카더라는 `--text-tertiary` — 눈금만 훑고 확정으로 읽으면 안 된다
- 날짜 9.5px/700 · 제목 12px/800 · 출처 10px
- 등급 배지 9px/800 — 확정 `green-bg` / 추정 `orange-bg` / 카더라 `sunken`

> 명세의 "흰 테두리 2px" 는 `var(--bg-surface)` 로 넣었다. 흰색을 직접 쓰면
> 다크 모드에서 점 주위가 흰 구멍이 된다. 선을 끊어 점을 앞으로 내는 목적은 같다.

### 죽은 롤백 참조 삭제

`src/components/cards/v2/AptThumbnailCard.tsx` · `src/_legacy/s269/apt_page_v0.tsx`.

그 legacy 는 s269 시절 롤백 참조인데 그 뒤로 스키마가 바뀌었다 —
`supply_units`/`complex_units` 분리 · `lifecycle_stage` 5단계 추가 · `apt_site_merges`.
지금 되살려도 동작하지 않는다. **되돌릴 수 없는 롤백 참조는 참조가 아니라 함정이다.**
죽은 `/apt/subscription/` 링크를 들고 있던 마지막 파일이기도 하다 —
삭제 후 그 경로는 middleware 의 308 규칙과 무관한 API 라우트에만 남는다.

`_legacy/s262/apt_page_v0.tsx` 는 손대지 않았다. `lib/seo/per-tab-meta.ts:63` 의
`AptThumbnailCard` 언급은 주석이고 같은 유형의 버그를 설명하는 문장이라 남긴다.

---

## V15 2단계-b (2026-08-23) — 현장 상세 접이식 재설계 (B)

### 무엇이 문제였나

`<details id="stats-section">` **하나가 827줄을 삼키고 있었다.** 모집공고·경쟁률·재개발·
실거래·커뮤니티·관련 블로그가 전부 그 안이었다. 점프바의 `모집공고` 칩은
**닫힌 `details` 안을 가리켜, 눌러도 아무 일이 없었다** (레이아웃이 없어 스크롤이 먹지 않는다).

### 구조

```
히어로 / 점프바 / 지표 4칸 / 요약 / 리드폼      ← 항상 펼침
──────────────────────────────
▼ 공급 정보                                    ← 항상 기본 열림
▶ 위치 · ▶ 분양 일정 · ▶ 진행 이력             ← 데스크탑 기본 열림
▶ 핵심 포인트 · ▶ 자주 묻는 질문
▶ 시세·분양가 · ▶ 상세 데이터 · ▶ 모집공고
▶ 경쟁률·시세·실거래 · ▶ 커뮤니티·관련 분석
```

| 파일 | 역할 |
|---|---|
| `components/apt/detail/DetailSection.tsx` | 네이티브 `<details>` 아코디언 (서버 컴포넌트) |
| `components/apt/detail/AccordionEnhancer.tsx` | 점진 향상 — 데스크탑 기본 열림 + 해시 열기 |
| `styles/components.css` | `.kd-acc*` |

- **네이티브 `<details>`.** 닫혀 있어도 자식이 DOM 에 남는다 — 색인 대상 텍스트가 사라지지 않는다.
  조건부 언마운트로 바꾸지 말 것
- **JS 없이도 동작한다.** `AccordionEnhancer` 는 `open` 속성만 건드리고 콘텐츠는 손대지 않는다.
  히어로가 LCP 라 그 근처가 아니라 본문 끝에서 마운트한다
- 점프 칩 → 해당 섹션이 **열리며 스크롤**. 브라우저의 fragment 자동 확장은 지원이 갈려 직접 처리
- **데이터가 없는 섹션은 아예 렌더하지 않는다.** `hasMarketBlocks` 판정이 없으면
  공고 전 현장에서 빈 아코디언이 남는다
- 기존 섹션 `id` 를 전부 유지했다 (`supply/location/movein/points/faq/history/price/stats/notice`).
  색인·내부 링크·KPI 타일의 `scrollTo` 목적지가 걸려 있다. `market`·`related` 만 새 id
- `<summary>` 안의 `<h2>` 는 유효하다 — 아코디언 헤더가 h2 계층을 유지해야
  사이트링크·앵커 후보가 살아 있다 (D-3)

### 접이식 안 접이식을 없앴다

- `상세 데이터` 827줄 → **형제 아코디언 4벌** (상세 데이터 / 모집공고 / 경쟁률·시세·실거래 / 커뮤니티·관련 분석)
- FAQ 항목별 `<details>` 도 걷어냈다. 섹션이 이미 접이식이라 답 하나 보는 데
  두 번 눌러야 했다. `<h3>` + `<p>` 평문으로 편다 — FAQ JSON-LD 는 `faq` 배열로만
  만들어지므로 본문 접힘과 무관하다

### B-2 · SEO 안전장치

구글은 접힌 콘텐츠를 인덱싱하지만 **네이버는 접힘 처리 문서화가 약하다.**

- 첫 섹션(공급 정보)은 **항상 기본 열림**
- 접이식 **밖** 요약을 강화했다. 기존 `AI 분석` 3문장 아래에 **사실 한 줄**을 덧댔다 —
  `지역 · 시공 · 세대수 · 입주 · 단계`. `analysis_text` 가 없는 현장에서도 이 줄은 남는다
- FAQ 리치 결과는 JSON-LD 로 별도 제공되므로 본문 접힘과 무관

### 곁다리로 고친 것

`AptPriceTrendCard`·`AptCompareTable` 이 아직 `total_units` 를 받고 있었다 →
`units.complex ?? units.supply` / `units.supply ?? units.complex` 로 축을 밝혀 넘긴다.

### 남은 시각 작업

아코디언 본문 안의 `.apt-card` 가 **카드 안 카드**로 보인다. 색 있는 카드(경쟁률 보라 ·
분양가 대비 빨강/초록)는 인라인 스타일이라 일괄 규칙으로 벗기면 패딩까지 잃는다.
별도 시각 패스에서 다룬다.

---

## V15 2단계-a (2026-08-23) — 세대수 두 축 · 구조화 데이터 정정 · og:image

`B` 접이식 재설계는 별도 커밋. 이 커밋은 **숫자와 메타데이터**만 다룬다.

### C · 세대수 — `total_units` 는 이름이 거짓말이었다

`apt_sites` × 청약 2,800쌍 중 **2,698(96.4%)이 공고의 공급 세대수와 같은 값**이었다.
`total_units` 라는 이름을 달고 단지 규모가 아니라 **이번 분양 공급**을 담고 있었다.

| 현장 | 분양 공급 | 단지 전체 |
|---|---|---|
| 올림픽파크 포레온 | 4,786 | 12,032 |
| 둔산 자이 아이파크 | 12 | 2,400 |

`src/lib/apt/units.ts` 신설 — 페이지 전체가 이 한 벌을 쓴다.
```
supply_units   이번 분양 공급(일반분양+특별공급)   2,747건
complex_units  단지 전체(조합원분 포함)             465건
total_units    @deprecated — 폴백으로도 쓰지 않는다
```
실측상 `total_units` 가 있는 3,130건은 전부 둘 중 하나를 갖고 있어 **폴백이 필요 없다.**
모르면 `미확인`. `apt_complex_profiles` 는 34,544건 중 96건만 값이 있어 못 쓴다.

**화면**
- KPI 4칸 세대수 칸 → `분양 공급 4,786` + 작은 글씨 `총 12,032세대`
- 공급 정보 표: `규모` 한 행 → **`단지 전체` · `분양 공급` 두 행** (`일반분양` 행은 유지)
- 두 축이 모두 있고 값이 다를 때만 **근거 블록**:
  > 경쟁률·분양가는 이번 분양 공급 기준, 단지 규모·관리비는 단지 전체 기준. 차이는 조합원 분양분입니다.
- 히어로 보조줄도 `176세대` → `총 12,032세대` / `분양 4,786세대` 로 축을 밝힌다

> **지시서와 다르게 한 것**: KPI 라벨을 `일반분양` 이 아니라 **`분양 공급`** 으로 썼다.
> `supply_units` 는 정의상 **일반분양 + 특별공급**이라 `일반분양` 은 사실과 다르다.
> `move_in_ready` 를 `입주 준비` 로 쓰던 것과 같은 종류의 실수가 된다.
> 공급 정보 표에는 `일반분양` 행이 따로 있고, 그건 특별공급을 뺀 진짜 일반공급이다.

### D-1 · 구조화 데이터에 틀린 세대수가 나가고 있었다

| 위치 | 전 | 후 |
|---|---|---|
| `RealEstateListing.numberOfRooms` | `total_units` | **제거** — 방 개수 프로퍼티다 |
| `RealEstateListing.offers.offerCount` | `total_units \|\| 1` | `supply_units` (없으면 키 생략) |
| `Residence.numberOfRooms` | `total_units` | **제거** — Residence 에 유효한 세대수 키가 없다 |
| `AptSiteSchema` `@type` | `Apartment` | `ApartmentComplex` + `numberOfAccommodationUnits` |
| `AptSubscriptionStructuredData` | 같은 문제 | **손대지 않음** — 미사용 컴포넌트인데다 저장소 파일 자체가 CRLF/단독 CR 혼용이라 한 줄만 고쳐도 356줄 diff 가 난다 |
| `ItemList` 세대수 항목 | `세대수 N세대` | `분양 공급` · `단지 전체` 두 항목 |

`Apartment` 는 개별 세대다. 단지 전체를 가리키는 엔티티라 `ApartmentComplex` 가 맞고,
그래야 `numberOfAccommodationUnits` 를 쓸 수 있다. 페이지 루트도 이미
`itemType=ApartmentComplex` 로 선언하고 있었다 — 그래프만 어긋나 있었다.
`offerCount` 의 `|| 1` 도 걷어냈다. 값이 없으면 1이라고 지어내지 않는다.

### D-2 · og:image 가 정사각이라 공유 면적을 잃고 있었다

원인은 두 갈래였다.
1. `aptSiteThumb()` 의 최종 폴백이 **`/api/og-square`(정사각)** 인데 코드가 그 URL 에
   `width:1200 height:630` 을 붙여 내보냈다. 카카오톡·네이버는 선언값이 아니라 **실제 비율**을 본다
2. `og_cards` 6장 분기에서 실사가 없으면 **630×630 카드가 0번**이었다

→ `OG_WIDE` 를 따로 만든다. `조감도(hero) > cover > satellite > og_image_url > /api/og(1200×630)`.
정사각은 절대 0번에 오지 않는다. **조감도 보유 현장은 조감도가 1순위** — 공유 카드가 완전히 달라진다.
`twitter:image` 도 같은 값으로 통일했다 (`summary_large_image` 는 가로를 전제한다).
쓰지 않게 된 `aptSiteThumb` 호출과 `hasRealPhoto` 는 걷어냈다.

---

## V15 1단계 (2026-08-23) — 301 리다이렉트 · 페이지네이션 · 라벨 정정

롤백 지점 `pre-v15-20260823`.

### A-1 · 병합된 구 slug 301

중복 256쌍 병합으로 진 쪽 행이 `is_active=false` 가 되면서 그 slug 가 **404** 였다.
색인과 블로그 내부 링크가 거기 걸려 있다.

| 파일 | 역할 |
|---|---|
| `scripts/gen-merged-slugs.mjs` | `apt_site_merges` → 정적 맵 생성기 |
| `src/lib/apt/merged-slugs.ts` | 자동 생성 · 256건 |
| `src/middleware.ts` | `/apt/{dead}` → `/apt/{survivor}` **301** |

- **308 이 아니라 301.** Next 의 `permanentRedirect()` 는 308 만 낼 수 있어 middleware 가 맡는다
- 한 토막짜리 경로만 본다 (`/apt/{slug}`). 한글 slug 는 퍼센트 인코딩으로 오므로 **디코드 후** 조회
- 쿼리스트링은 `clone()` 이 보존한다 — 광고 유입 파라미터(`n_query`·`NaPm`)가 살아남는다
- 기존 `/apt/sites/*`·`/apt/subscription/*` 308 규칙은 건드리지 않았다
- 번들: middleware 92 kB → **98.4 kB**

**전사 검증**: 로컬 맵과 DB 를 md5 로 대조했다 — `498e72a6f2b064032d731281999d7bf8`, 256건 일치.
(로컬 `.env.local` 의 `SUPABASE_SERVICE_ROLE_KEY` 가 placeholder 라 스크립트가 DB 를 못 읽는다.
그래서 생성기에 `--tsv` 경로를 넣고 md5 로 입력을 검증했다. 서비스 키가 있는 환경에서는
`node scripts/gen-merged-slugs.mjs` 만으로 생존자 실존 검사까지 포함해 재생성된다.)

**생존자 방향**: DB 담당이 23쌍(`dmc-sk-view-아이파크포레` → `---아이파크포레` 류)을 뒤집은 뒤의
상태로 생성했다. 깨진 생존자 0 · 생존자 비활성 0 · 체인 0 · 자기참조 0 을 확인했다.

### A-2 · `/apt/pipeline` 페이지네이션

RPC 시그니처가 `get_apt_pipeline(text, int, int)` 로 바뀌고 **2인자가 DROP** 됐다.
기존 2인자 호출이 그대로 있었으면 파이프라인 섹션이 조용히 빈 목록이 된다 — 3인자로 교체했다.

- 페이지 크기 30 · `page`·`page_size`·`total_pages` 를 payload 에 실었다
- 지역을 바꾸면 1페이지로 돌아간다 (7페이지에서 부산을 고르면 빈 화면이 나온다)
- 2페이지부터 `robots: noindex, follow` · canonical 은 항상 1페이지
- `209곳 중 60곳` 표기 제거

### A-3 · `move_in_ready` 라벨

`입주 준비` → **`입주 예정`**.
`move_in_ready` 는 이름과 달리 "계약 체결 기간 종료" 이고 입주는 아직 미래다
(실측 720건 전부 입주예정 202609~203104, 과거 0건). 이 단계는 **리드폼 노출 대상**이라
파워링크 랜딩에도 뜬다 — `입주 준비` 로 쓰면 광고 랜딩에서 사실과 다른 말을 하게 된다.

### 파워링크 랜딩 영향 점검 (V14 판단 ② 후속)

라벨 맵 통합으로 히어로 배지가 새로 뜨는 단계 중 **리드폼 대상**은 4개였다.

| 단계 | 새 배지 | 판정 |
|---|---|---|
| `award_announced` | 당첨자 발표 | 사실 |
| `unsold_active` | 미분양 | 사실. 이 단계는 원래 미분양·선착순·잔여세대다 |
| `move_in_started` | 입주중 | 사실 (입주월이 이번 달) |
| `move_in_ready` | ~~입주 준비~~ → 입주 예정 | **정정함** |

---

## V13 1단계 (2026-08-23) — 보이게 만들기 (A-1 · A-2 · A-3)

롤백 지점 `pre-v13-20260823`.

### 왜

활성 현장 5,916곳 중 **2,975곳(50.3%)에 모집공고가 없다**. `/apt` 목록의 원본
`get_apt_subscription_hub` 는 `apt_subscriptions` 전용이라 이 절반이 한 건도 나오지 않았다.
상세 페이지는 있는데 **도달 경로가 없었다.** 어드민으로 넣어도 DART 로 잡아도 화면에 안 나온다 —
그래서 이게 1순위다.

### A-1 · 공고 전 현장 섹션

| 파일 | 역할 |
|---|---|
| `src/lib/apt/pipeline.ts` | `get_apt_pipeline` RPC 래퍼. `unstable_cache` 900초, 빈 응답은 캐시에 굳히지 않음(Rule #66) |
| `src/components/apt/PipelineCard.tsx` | 목록 행. `SubscriptionCard` 와 같은 `.kd-lrow--thumb` |
| `src/app/(main)/apt/pipeline/page.tsx` | 전체 보기 + 지역 전환(부울경 · 전국 · 17개 시·도) |
| `src/app/(main)/apt/page.tsx` | 청약 목록과 '이번 주 결과' 사이에 섹션 삽입 |

- 섹션 8건 · 전체 보기는 60건. 허브와 **중복 없음**(RPC 가 공고 없는 현장만 낸다)
- 좌측 배지가 청약 상태가 아니라 **단계명**(착공·관리처분인가·사업시행인가…)
- `stage_updated_at` 30일 이내면 `NEW` 배지. 기준 시각은 페이지에서 한 번 찍어 내려보낸다
- 데이터 0건이면 **섹션을 통째로 렌더하지 않는다**
- 지역 규칙: 부산·울산·경남 중 하나를 고르면 벨트 전체(부울경). `전국`(자동 선택 포함)도 부울경으로 좁힌다 —
  전국 209곳을 8칸에 담으면 수도권 대형 현장이 부울경을 전부 밀어낸다

### A-2 · 단계 라벨

라벨 맵이 **4곳에 복사**돼 있었고 값도 서로 달랐다(`분양 예고` vs `분양예정`).
`src/lib/apt/lifecycle-label.ts` 를 단일 원본으로 만들고 `AptHero` · `AptHeroLarge` ·
`apt/[id]` · `api/og-apt` 를 전부 여기로 물렸다.

공고 전 **5단계**: 조합설립 · 시공사 선정 · 사업시행인가 · **관리처분인가** · 착공.
`mgmt_approved` 는 V13 원안 4단계에 없었다 — 이주·철거 직전이자 조합원 분양이 확정되는 단계라
실무에서 가장 중요한 분기 중 하나다(2026-08-23 추가).

> **부수 효과**: 현장 상세 히어로 배지가 이제 `입주 후` · `입주 준비` · `미분양` 등도 표시한다.
> 이전에는 `apt/[id]` 의 로컬 맵에 그 키들이 없어 배지가 아예 안 떴다 (`AptHeroLarge` 는 떴다).
> 맵을 합치면서 정렬됐다. 사실 관계는 맞고, 같은 값이 목록·OG 와 이제 일치한다.

### A-3 · 현장 상세 진행 이력

| 파일 | 역할 |
|---|---|
| `src/lib/apt/site-events.ts` | `apt_site_events` 조회 + `confirmedOnly()`(G-1 광고 분기용) |
| `src/components/apt/SiteHistoryTimeline.tsx` | 세로 타임라인 |
| `src/app/(main)/apt/[id]/page.tsx` | §7 진행 단계 자리에 배치 + 점프바 항목 추가 |

- **0건이면 렌더하지 않는다.** 조회는 `analysis_text` 와 같은 왕복에 묶어 새 라운드트립 0회
- 등급 표기: `확정` 검정 · `추정` 회색 · `카더라 · 미확인` 연회색
- `source` 가 `migration:*` 이면 출처를 말하지 않는다 — 물으면 답이 없는 내부 이관 흔적이다
- `source_url` 이 있으면 원문 링크(`nofollow noopener`)

### ⚠️ DB 쪽에 남은 것

**`get_apt_pipeline` 이 `mgmt_approved` 를 안 낸다.** RPC 의 `lifecycle_stage IN (...)` 목록과
`weight` CASE 양쪽에 `mgmt_approved` 가 빠져 있다. 실측 2026-08-23:

| | 현재 | 있어야 할 값 |
|---|---|---|
| 부울경 | 34 | 40 |
| 관리처분인가 누락 | 6곳 | — |

`/apt/부산-감만1-재개발`(관리처분인가)이 목록에 나오지 않는다. 프론트는 값이 실려 오는 즉시
그리도록 이미 열려 있다 — RPC 두 줄만 고치면 된다.

```sql
-- IN 목록에 추가
AND s.lifecycle_stage IN ('site_planning','pre_announcement',
                          'union_established','constructor_selected',
                          'plan_approved','mgmt_approved','construction')
-- weight CASE: 착공 0 → 관리처분 1 → 사업시행인가 2 → 시공사선정 3 → 공고예정 4 → 조합설립 5
WHEN 'construction' THEN 0 WHEN 'mgmt_approved' THEN 1 WHEN 'plan_approved' THEN 2
WHEN 'constructor_selected' THEN 3 WHEN 'pre_announcement' THEN 4 WHEN 'union_established' THEN 5
```

**페이지네이션 없음.** RPC 가 `p_limit` 을 60 으로 클램프한다. 전국 총계 209건이라
전체 보기도 60건까지다. 감추지 않고 `209곳 중 60곳` 으로 밝힌다 — 오프셋이 붙으면 푼다.

### 지시서와 다르게 한 것

**`/apt` 섹션을 `부울경` 고정이 아니라 선택 지역을 따르게 했다.**
지시서는 `get_apt_pipeline('부울경')` 호출이라고만 적었지만, `/apt` 에는 지역 칩이 있다.
서울을 고른 사람에게 부울경 목록을 보여주면 칩이 거짓말이 된다.
부산·울산·경남·전국 → 부울경, 그 외 → 고른 지역. 섹션 헤더가 어느 지역인지 항상 밝힌다.

---

## V10 (2026-08-23) — 현장 상세 재정렬 (단일 커밋 `967a4c47`)

롤백 지점 `pre-v10-20260823`. 큰 재배치라 **한 커밋** — 부분 revert 가 의미 없다.

### 실측에서 나온 중복 (두산위브더제니스 대연 전체 스크롤)

단지명 4회 · 세대수 5회 · 분양가 5회 · 입주 3회 · 분양 일정 2벌 · 인근 단지 4벌 ·
카톡 진입 6+ · 관심 저장 3곳. 대형 이미지도 OG 카드 캐러셀 + 조감도 히어로 2종.

### 새 순서

히어로 → 점프바 → **핵심 지표 4칸** → 리드폼 → 공급·위치·일정 → 포인트·FAQ
→ 진행 단계·가점 매칭 → 시세·분양가 분포·인근 비교 → AI 분석 → 모집공고·최종 업데이트

읽는 흐름: 이 현장이 뭔가 → 얼마인가 → 신청 → 자세히 → 비교 → 판단.
이전에는 진행 단계·시세·비교 묶음이 **페이지 최상단**에 있어 현장을 알기 전에 그것부터 봤다.

### 지시서와 다르게 판단한 것 2건

**① `stats-section` 은 건드리지 않았다 (B-3).**
'조회수가 0이면 블록을 내라' 는 지시를 이 id 에 적용하려다 멈췄다. 이름과 달리
이 블록은 **'상세 데이터 더보기' 접이식이고 규제 배지·비용 시뮬레이터 등 827줄**을 담는다.
조회수로 가리면 실제 콘텐츠가 통째로 사라진다. 조회수·댓글 카운터는 `KpiCards` 안에만
있었고 그 블록을 지우면서 함께 사라졌다 — 목적은 달성됐다.

**② `AdBanner` 는 무료 재고만 제외했다 (B-1).**
'상단 큐레이션 캐러셀' 의 정체는 `AdBanner` 였다 (`/api/ads` — 유료 `popup_ads` +
무료 `apt_subscriptions` 카드). 현장 상세에서 통째로 끄면 유료 슬롯까지 닫힌다.
`popup_ads` 실측 **0건**이라 지금은 효과가 같지만, 유료 재고가 생겼을 때 최대 트래픽
페이지에서 조용히 사라지는 구조를 만들지 않았다. `isPaid` 만 통과시킨다.

### 삭제한 중복 렌더

| 대상 | 이유 |
|---|---|
| `CardCarousel` 호출 | OG 카드 6장이 조감도 히어로와 대형 이미지 2종. **파일은 남김** — blog/[slug] 사용 |
| `AptHero` | 검정 헤더가 단지명·세대수·시공사를 다시 그림. lifecycle 라벨만 히어로 배지로 이관 |
| `KpiCards` 5타일 · `ComplexScale` · `AptKpiGrid` · `AptDDayCard` | 같은 숫자를 다시 그리던 넷 → `AptKeyMetrics` 한 벌 |
| `AptScheduleTimeline` | 분양 일정 표와 같은 날짜. 표가 계약·상한제까지 담아 정보량이 많다 |
| `SimilarAptsSection` | 비교표와 겹치고 위성 썸네일 6장이 무겁다 |
| `AptCommentInline` | 댓글과 역할이 같고 둘 다 빈 입력창 |
| 본문 `SiteTalkCTA` | 카톡은 레일 1 + 하단 고정바 1, 두 곳뿐 |
| 표 안 `방에서 물어보기` 반복 | 행마다 반복돼 표를 어지럽힘 → 표 아래 한 줄로 (미공개 행이 있을 때만) |
| `AptSidebar` 알림 6단계·인근 단지 | 비로그인 토글 6줄 = 켤 수 없는 설정 화면 / 비교표와 중복 |

### 이미지 없는 현장 75곳

히어로 폴백을 그라데이션 → **이니셜 블록**으로. 목록 64×64 와 같은 규칙을 쓰려고
`ListThumb` 의 `initialsOf`·`toneOf` 를 export 해 재사용했다 — 판정을 두 벌로 만들지 않는다.
비율은 `.kd-hero` 가 잡으므로 4/3·21/9 어디서도 깨지지 않는다.

### 검증

`tsc --noEmit` · `npm run build` 통과. 점프바 칩 6개의 앵커 전부 생존 확인
(supply·location·movein·points·faq·notice 각 1건). `interest-section` 유지.
미사용 경고 작업 전 7건 → 후 5건 (신규 0).

### 배포 후 확인 (사람)

조감도 보유 2건(`/apt/엄궁역-트라비스-하늘채`, `/apt/두산위브더제니스-대연`)으로
1~4 를 보면 바로 판단된다: ①상단이 조감도 → 점프바 → 지표 4칸 → 리드폼 순인지
②단지명이 h1 한 번인지 ③세대수·분양가·입주가 각각 한 곳인지 ④분양 일정이 표 하나인지.
그 밖에 ⑤점프 칩 6개 ⑥하단 액션바 → 리드폼 ⑦이미지 없는 현장 1곳의 전폭 이니셜 블록.

---

## V8 (2026-08-23) — 잔여 청소 · 계산기 동선 · 관찰 기준선

롤백 지점 `pre-v8-20260823`.

| 커밋 | 내용 |
|---|---|
| `c2679f1e` | A-1 죽은 파일 3개 삭제 (사슬로 물려 한 커밋) |
| `a466dbc1` | A-2 `AptThumbnailCard` 죽은 라우트 기본값 → `aptHref` |
| `1283fd29` | B 계산기 내부 링크 정리 (이름 통일 + 현장 상세 3종) |

### ✅ 리드폼 라이브 검증 완료 — 대기 항목이 아니다

DB 담당이 직접 검증했다. **다시 '대기' 로 적지 말 것.**

**검증 1 — 폼 렌더** (`kadeora.app/apt/아르티엠-라-테라스` 실제 조회)
4필드 전부 렌더 · 이 현장은 `house_type_info` 0건이라 **표준 목록 폴백이 실제로 작동** ·
`59㎡㎡` 중복 없음 · 배치 정상(히어로 → h1 → 점프바 → AI 요약 → **리드폼** → 공급 정보) ·
하단 액션바 정상 · 위성 VWorld 출처 표기 정상.

**검증 2 — 제출 전 구간** (Apps Script 로 실제 POST, 응답 `{"ok":true,"repeat":false}`)

| 필드 | 값 | 판정 |
|---|---|---|
| `birth_date` | `1992-05-02` | `920502` → 정규화 ✓ |
| `desired_type` | `84㎡` | ✓ |
| `interest_region` | `전북 전주시` | ✓ |
| `inquiry_type` | `분양상담` | ✓ |
| `phone` | `010-0000-0001` | 정규화 ✓ |
| `entry_path` | `/apt/아르티엠-라-테라스` | 한글 무손상 ✓ |

시트 기록도 확정이다 — Apps Script 는 시트 → 메일 → Supabase 순서로 돌고 Supabase 가
마지막이라, 거기 도달했다는 건 시트 기록이 이미 끝났다는 뜻이다.
검증용 리드 2건은 `status='test'` 로 정리됨.

**남은 확인 1건 (사람 눈 5초)** — `house_type_info` 가 있는 현장에서 희망 타입에
그 현장 평형이 뜨는지. `정읍 푸르지오 더 퍼스트`(6개) 또는 `엄궁역 트라비스 하늘채`(10개)
페이지에서 드롭다운 출처만 보면 된다. 필드 배선은 이미 검증됐다.

### A-2 — 앞선 보고의 기전 정정

v7-D1b 커밋에서 '홈 이슈 단지 5건 전부 404' 라고 적었는데 **기전이 부정확했다.**
정확히는 `middleware.ts:78` 이 `/apt/subscription/{id}` 를 308 로 `/apt/{id}` 로 넘긴다.
다만 그 `{id}` 는 `apt_subscriptions` 의 **숫자 id** 라 `apt_sites.slug` 와 맞지 않고,
`[id]` 페이지의 slug 폴백 6단계(문자 제거·접미사 제거·한글 추출·complex 프로필)도
숫자 문자열에는 걸리지 않는다. **'즉시 404' 가 아니라 '리다이렉트 후 미해결' 이다.**
사용자가 겪는 결과는 같고, 수정(=`aptHref` 통일)도 그대로 유효하다.

살아 있는 `/apt/subscription/` 참조는 남긴다 — API 라우트, middleware 308 규칙,
그 규칙에 기대는 `lib/seo/per-tab-meta.ts` 의 JSON-LD URL.

### C — 관찰 항목 (코드 변경 없음, 2주 뒤 데이터로 정한다)

| 항목 | 판단 기준 | 기준선 |
|---|---|---|
| V6 3단계 `post_move_in` 4,594건 확대 | 2단계(기축 120건)의 리드 품질·응대 부하 | 지역DB 리드 0건 |
| 레일 실폼 (진입 카드 → 실제 폼) | 데스크탑 제출률이 모바일보다 뚜렷하게 낮은가 | 데스크탑 37.1% / 모바일 62.6% |
| 가입 유도 축소 효과 | 가입 + 리드를 **합산**해서 볼 것 | 30일 가입 7명 / 실제 리드 0건 |
| 카톡 배너 제거 효과 | 클릭 절대수. 노출 계측이 08-22 시작이라 CTR 산출 불가 | sticky 클릭 7건(07-18~08-07), 이후 0건 |
| 목록 이미지 도입 후 밀도 | `scroll_depth` 로 이탈 확인 | 행 72px 상한 |

### D — 이번 실측에서 나온 것 (기준선)

**AI 검색 유입이 실재한다.** 30일: `chatgpt.com` 29 · `perplexity` 5 · `copilot` 5 ·
`brave` 2. 작지만 0이 아니다 — `llms.txt` 와 JSON-LD 가 걸리고 있다는 신호.
이번엔 손댈 것 없고 기준선으로만 쓴다.

**영역별 유입 성격이 다르다.**

| 영역 | 주 유입원 |
|---|---|
| 계산기 | 네이버 검색 69% (1,249/30일) |
| 부동산 | 네이버 530 · `(none)` 582 |
| 블로그 | **분산** — direct 141 · google 107 · naver 109 · bing 64 · AI 22 |
| 주식 | 네이버 156 |

블로그만 유입원이 고르게 퍼져 있다. 데스크탑 비중이 블로그에서만 우세했던 것(64%)과
같은 맥락이다.

### [NODE] 남은 것 — 2건

1. **희망 타입 옵션 눈 확인** (위 '남은 확인 1건'). 5초.
2. **조감도 업로드** — 어드민 화면(V5-V4)은 준비됐고 `hero_image_url` 은 현재 **0건**이다.
   파일이 있어야 하고 업로드는 사람만 가능하다 (DB 담당은 SQL 만 되고 Storage 에
   바이트를 넣을 수 없다). **급하지 않다** — 위성 5,839건으로 목록·상세가 정상 동작한다.
   트라비스 하나만 넣어 우대 노출을 본 뒤 나머지를 판단해도 된다.

---

## V7 (2026-08-23) — 남은 트랙 (A 정정 · V8 · 주식 2축 · 홈 컴팩트)

롤백 지점 `pre-v7-20260823`.

| 커밋 | 내용 |
|---|---|
| `ace0e756` | A-1 [NODE] Apps Script 목록 철회 (STATUS 정정) |
| — | A-2 리드폼 정적 점검 — **8개 항목 전부 통과, 코드 변경 없음** |
| `5b6d47a9` | V8 NoticeBanner 광고주 색 대비 폴백 |
| `783b1a6e` | C-1 /stock 2축 필터 (시장 × 정렬 + 테마) |
| `5800c7b2` | C-2 /stock 지수 스트립 3칸 |
| `3eb28975` | C-3 /stock 페이지 소유 레일 |
| `b4479964` | D-1 홈 블록 순서 + 라운지 3줄 |
| `ef9842a3` | D-2 /blog 레일 (인기 글 · 시리즈 · 태그) |
| `f4749a4d` | D-3 빈 라운지 채팅 삭제 + 잔존 전수 확인 |

### A-2 리드폼 정적 점검 — 전부 통과 (변경 없음)

| 확인 | 결과 |
|---|---|
| 렌더 입력 4 + 동의 2 | `kd-lead-name` · `kd-lead-phone` · `kd-lead-birth` · `kd-lead-type` + checkbox 2 |
| 희망타입 폴백 | `typeOptions` 빈 배열/undefined → `미정/59㎡/74㎡/84㎡/101㎡/114㎡ 이상` |
| 단위 중복 | `59㎡㎡` 발생 없음 (표준 목록에 단위 포함, 렌더는 `{t}` 그대로) |
| payload | `birthDate` `desiredType` `region` `sigungu` `interestRegion` `inquiryType` `siteUrl` 전부 실림 |
| `variant='blog'` | 분기는 설명 문단 한 줄뿐 (`variant ===` 1곳) |
| Content-Type | `text/plain;charset=utf-8` 유지 |
| 입력창 폰트 | 개별 override 0건 — 전역 하한 `max(16px, --fs-sm)` 상속 |
| 폼 인스턴스 | 호출부 2곳, 서로 다른 페이지 (Rule #106 준수) |

### 데이터가 없어 지시서대로 못 한 것

**C-2 지수 스트립 — 코스피·코스닥 지수 레벨이 DB 에 없다.**
`information_schema` 전수 확인 — `%index%` · `%market_%` 어디에도 지수 적재 테이블이 없다.
저장된 것은 종목 시세뿐이다. 없는 값을 지어내지 않고, 같은 화면에서 실제로 답할 수 있는
**등락 종목 수(시장 폭) + 평균 등락률**을 낸다. 라벨도 '코스피' 가 아니라 '코스피 등락' 이다.
환율(USD/KRW)은 `exchange_rates` 에 실재해 그대로 쓴다 (실측 1,385.74 · 8-22 갱신).
→ 지수 레벨을 넣으려면 적재 크론이 선행돼야 한다.

### D-1 — 충돌 해소 (`d645ae15`)

처음에는 '각 블록 3~4건' 과 '텍스트 총량을 줄이지 말 것' 이 부딪혀 건수를 그대로 뒀다.
**정정 지시로 '3~4건 고정' 이 철회되고 진짜 답이 나왔다 — 건수가 아니라 행 모양을 바꾼다.**

건수 5/5/3/3 유지 + 큰 카드 → `.kd-lrow` 행(좌측 64×64 썸네일, 72px 상한).
큰 카드 3장 높이에 5건이 들어가고 DOM 텍스트 총량은 그대로라 색인 제약을 건드리지 않는다.
목록 3종과 행 규격이 같아져 리듬도 맞는다.
주식만 `StockListRow` 를 그대로 재사용해 좌측이 64×40 스파크라인이다
(종목 사진 0건 · 로고는 상표 문제 — V4-C7-3 규격).

**함께 잡은 버그: 홈 '이슈 단지' 5건이 전부 404 로 가고 있었다.**
`AptIssueCard` 의 기본 href 가 `/apt/subscription/{id}` 인데 그런 라우트가 없다
(`src/app/(main)/apt` 에 subscription 디렉터리 없음). 홈 행은 `/apt` 목록과 같은
`aptHref` 를 쓰고, `AptIssueCard` 의 기본값도 같이 고쳤다 — 그 카드는 현재 sandbox
에서만 쓰이지만 기본값이 함정으로 남으면 안 된다.

### 설계 판단 — 정렬 칩 4개로 급락을 잃지 않는 법

C-1 의 정렬 축은 화면 칩 4개지만 값은 5개다. '등락' 칩 하나가 급등↔급락을 오가고
라벨이 '등락 ↑/↓' 로 방향을 드러낸다. 칩을 4개로 유지하면서 급락을 잃지 않으려면
이 방법뿐이다 — 파라미터를 하나 더 만들면 `?market= ?sort= ?theme=` 3개 고정이 깨진다.
`mcap`·`foreign` 은 칩이 없지만 값으로는 계속 받아 옛 `?tab=` 링크가 산다.

### 배포 전 실측한 값 (리스크 #6 대응)

`stock_quotes.market` = KOSPI 310 · KOSDAQ 1,042 · NYSE 302 · NASDAQ 192.
4종뿐이라 해외 = NYSE + NASDAQ. `stock_issue_scores` 도 같은 4종이라 이슈 정렬에도
같은 방식으로 걸린다. 표기 차이로 0건이 되는 경우는 없다.

### V8 대비 계산 검증

계산식이 보고된 수치를 그대로 재현한다:
`#00ff88` on `#E8ECF0` → **1.13:1** (사고 당시 값) · `#065F46` → **6.47:1** (수정 후 값) ·
`rgba(0,255,136,.5)` → 1.13:1 · `#111827` → 14.94:1.
⚠️ CSS 변수 값을 코드에 복사하지 않는다 — `getComputedStyle` 로 런타임에 편다.
⚠️ 못 재는 값(그라디언트·named)은 통과시키지 않는다. 재지 못한 것을 안전하다고 부르면 방어가 아니다.
⚠️ 배경을 먼저 판정하고 **통과한 배경 기준으로** 글자를 잰다.
어드민 저장 시점 경고는 붙이지 않았다 — `site_notices` 편집 화면이 리포에 없다
(`grep -rln site_notices src/app/admin src/components/admin` = 0건). 생기면 `measureContrast()` 를 쓰면 된다.

### 남은 것

- **라이브 제출 검증 → 완료** (V8 섹션 참조). 대기 항목 아님.
- **사문 정리 → 완료** (`c2679f1e` — StockClient · TrendingKeywords · stock_page_v0 삭제)
- V6 트랙 2단계 — `landmark_active` 120건 기축 지역 폼 (별도 진행 중)
- 코스피·코스닥 지수 레벨 적재 크론 (C-2 스트립을 진짜 지수로 바꾸려면)

---

## V5 · V6 (2026-08-23) — 레이아웃 정리 · 아카이브 · 조감도 · 리드폼 통일

롤백 지점: `pre-v5-20260823` · `pre-v6-20260823` (둘 다 원격에 있음).

| 커밋 | 내용 |
|---|---|
| `747188a0` | V5-V1 좌측 Sidebar 삭제 + 부동산 분류를 `/apt` 상태 필터(`?st=`)로 흡수 |
| `7e767f24` | V5-V2 전역 RightPanel 삭제 → `AptHubRail` (페이지 소유 레일) |
| `af0acb9b` | V5-V3 `/apt/archive` 지난 공고 + `/apt` 하단 진입점 |
| `23f6a86a` | V5-V4 어드민 조감도 업로드 (`apt-covers` + sharp webp) |
| `f173086b` | V5-V5 3단 이미지 체인 + 조감도 우대 (동순위 내 가산) |
| `9f89eea1` | V6-1/2 리드폼 4필드 통일 + 희망 타입 옵션 정상화 |
| `8290402c` | V6-3 노출 대상에 `move_in_started` 추가 |
| `bc0488aa` | V6-4/5 리드 payload 지역 정보 + `inquiry_type` 분리 |

### ⚠️ 철회 — Apps Script 는 이미 완료됐다 (2026-08-23)

`bc0488aa` 커밋 메시지 말미와 그 직후 보고에 **[NODE] Apps Script 할 일 4개**
(시트 열 3개 추가 · `appendRow` 배열 끝에 3개 추가 · `fn_insert_lead` 파라미터 · 재배포)를
남겼다. **그 목록은 철회한다. 따라 하지 말 것.**

Apps Script 는 별도 담당이 **v3 로 통째로 교체해 배포까지 끝냈고** 라이브 검증도 통과했다
(2026-08-23 14:41 제출 건에서 `inquiry_type='분양상담'` 도달 확인 — v2 에는 없던
파라미터라 v3 가 실제로 도는 증거다).

**그 목록대로 따라 하면 시트에 열 3개가 또 생기고 기존 행이 어긋난다.**

현재 v3 가 하는 일:
- 시트 15열 자동 승격 (`insertColumnsAfter` 로 기존 행 보존)
- `region` / `sigungu` / `siteUrl` 기록
- `p_interest_region` · `p_inquiry_type` 로 Supabase 백업
- `siteUrl` 미수신 시 `siteSlug` 로 자체 생성 (한글 인코딩 포함)
  → 프론트가 `siteUrl` 을 안 보내도 된다. 보내면 그쪽이 우선.

**[NODE] 남은 것은 선택 사항 1건뿐이다** — `backupToSupabase` 의 `area` 조립을
`String(d.interestRegion || '').trim() || [region, sigungu].filter(Boolean).join(' ')` 로
바꾸면 지역 문자열의 주인이 프론트 하나가 된다 (현재는 양쪽에 조립 규칙이 있다).
**결과는 지금도 동일하므로 급하지 않다.**

### 수치 정정 (지시서 쪽이 틀렸던 것)

`move_in_started` 추가분: 지시서 1,182 → 1,208, 실측 **1,173 → 1,199**.
증가분 26건은 일치했고 기준선 9건 차이는 지시서에 `is_active` 필터가 빠진 값이었다
(비활성 9건 = `award_announced` 7 + `unsold_active` 2). 실측 쪽이 맞다.

### V5-V4 조감도 업로드 — 버킷 선택 근거

`apt-covers` 를 쓴다 (`images` 아님). `images` 는 RLS 가 `auth.uid()` 폴더를 강제해
어드민 대리 업로드에 맞지 않는다. `apt-covers` 는 service_role 전용 정책 4종이 완비돼
있고 4월 생성 후 비어 있었다. 실측: `public=true` · 한도 2,097,152B · webp/jpeg/png.

⚠️ sharp 변환은 `apt-satellite-crawl` 패턴을 따르되 **`fit` 이 다르다.**
위성은 `fit:'cover'` 로 자르지만 조감도는 `fit:'inside'` 로 축소만 한다 —
cover 로 자르면 건물이 잘린다. 1600px q85 → 2MB 초과 시 q72 재시도 → 그래도 넘으면 거절.
원본은 25MB 로 미리 거른다 (sharp 에 큰 버퍼를 넘기지 않는다).

⚠️ 파일명이 고정(`hero/{id}.webp`)이라 교체 시 CDN 이 옛 이미지를 준다 → URL 에 `?v=` 부착.
⚠️ 허락 출처는 화면과 API **양쪽**에서 막는다. 화면만 막으면 우회된다.

### V5-V5 조감도 우대 — 정렬을 뒤집지 않는다

`weight` 가 같은 **연속 구간 안에서만** 조감도를 앞으로 당긴다. 구간 경계를 넘어
이동하지 않고, 조감도 없는 항목들끼리의 dday 순서도 보존된다.
검증: `[A(w3,위성) B(w3,조감도) C(w6,위성) D(w6,없음) E(w6,조감도) F(w6,위성)]`
→ `B(w3) A(w3) E(w6) C(w6) D(w6) F(w6)`.

현재 조감도 0건이라 동작은 기존과 동일하다 — V5-V4 화면으로 조감도가 들어오는
순간부터 우대가 켜진다.

### V6-2 희망 타입 — 단위 중복 함정

페이지가 내려주는 `typeOptions` 가 이미 `${n}㎡` 형태다 (`apt/[id]:539`).
표준 목록에도 `㎡` 를 포함시켜야 렌더 시 `59㎡㎡` 가 되지 않는다.
옵션 값이 곧 시트·DB 에 남는 값이라 사람이 읽는 문자열 그대로 쓴다.
검증: 공고 있음 → `미정/59㎡/84㎡/101㎡` · 공고 없음 → `미정/59㎡/74㎡/84㎡/101㎡/114㎡ 이상`.

### 남은 것

- V5 트랙 V6(주식 2축 필터) · V7(홈 컴팩트) · V8(NoticeBanner 대비 폴백)
- V6 트랙 2단계 — `landmark_active` 120건 기축 지역 폼 (**1단계 라이브 확인 후**)
- 라이브 제출 검증 2건 (공고 있는 현장 / 공고 없는 현장)
- 큐레이션 카드가 `hero_image_credit` 원문을 표시하지 못한다 —
  `get_apt_subscription_hub` 가 `thumb_url` 만 주고 credit 은 안 준다.
  정확한 수령 출처는 상세 히어로(`SiteHero`)가 보여준다. RPC 에 `thumb_credit` 이
  추가되면 카드에서도 원문을 쓸 수 있다.

---

## V4 (2026-08-23) — 정리 + 지역/블로그 재구성 (커밋 11개)

지시서: `Claude Code 작업지시서 — V3 마무리 + V4`. 롤백 지점 태그 `pre-v4-20260823`.
PART 2 는 세션 도중 선행 완료 통보를 받아 같은 차수에서 이어 진행했다.

| 커밋 | 내용 |
|---|---|
| C1 | 죽은 컴포넌트 6개 삭제 + 이모지 3건 |
| C2 | 모바일 검색 진입점 통합 (페이지 이동 → 모달) |
| C3 | 지역 칩 가나다 고정 + 자동 지역 전환을 제안으로 강등 |
| C4 | 가입 유도 축소 (모달·게이트·문구) |
| C5 | 블로그 주제 탭 4분류 — redev 287편 복구 |
| C6 | 지역 폴백 제거 — region_empty + 조회 창 표기 |
| C7-1 | 부동산 목록 썸네일 64×64 + 시공사 메타 복구 |
| C7-2 | 블로그 목록 썸네일 64×64 (safe-image 재사용) |
| C7-3 | 주식 목록 스파크라인 64×40 |
| C8 | 지역 시군구 2단 |
| C9 | 블로그 서브칩 실측 값으로 교체 |

전 커밋 `npx tsc --noEmit` + `npm run build` 통과. 새 CSS 변수 0개.

### 이번 차수에 드러난 것 — 전부 무증상으로 돌던 고장

**① /blog 서브칩 14개가 전부 발행 0편 (C9)**
`SUB_CATS` 의 키(market·analysis·theme·weekly·subscription·trade·redev·competition·
guide·trend·region·saving·tax·invest)로 `.eq('sub_category', k)` 하면 매칭이 **전부 0**.
서브칩을 어느 것을 눌러도 빈 목록이 나오고 있었다. 실제 값은 `목표주가`·`종목분석`·
`실거래·시세` 같은 한글 문자열이다. 에러가 없어 아무도 몰랐다.

**② redev 287편이 어느 경로로도 도달 불가 (C5)**
카테고리 탭에 `redev` 가 없어 발행만 되고 링크가 없었다. 부동산 그룹에 넣어 복구.

**③ SignupNudgeModal 이 마운트돼 있지 않다 (C4)**
지시서 전제는 '두 모달이 동시에 돈다' 였으나 `grep -rn` 전수 확인 결과 실제로 돌던 것은
`SignupPopupModal` 한 벌뿐이다. 30일 실측 표에 nudge 지표가 없는 것과도 일치한다.
→ C4 이후 전역 가입 모달은 **0종**이다. '축소' 목적에는 부합하나 지시서의 '1종 유지' 와는
다르므로 임의로 마운트하지 않았다. 되살리려면 `ClientShell` 의 `AuthProvider` 트리 안에
`<SignupNudgeModal />` 한 줄이면 되고, 필요한 가드(쿨다운 14일·현장 상세 제외)는 넣어 뒀다.

**④ 지역 칩 순서가 매일 바뀌고 있었다 (C3)**
`live DESC → recent DESC → 이름` 정렬이라 접수 건수가 바뀔 때마다 배열이 재배치됐다.
2그룹(접수중 유/무) 구분은 유지하고 그룹 내부를 가나다로 고정. 위치 기억이 성립해야 한다.

**⑤ 자동 지역 전환이 URL 을 말없이 바꾸고 있었다 (C3)**
`RegionAutoSelect` 가 `router.replace('/apt?region=…')` 를 실행했다. 제안 배너로 강등.

### 지시서와 다르게 간 곳

| 항목 | 지시 | 실제 | 이유 |
|---|---|---|---|
| C7-3 이슈 탭 스파크라인 | 7일 | **5거래일** | `sparkline_5d` 가 5점 고정(min=max=5, 보유 1229/1805). 7일치 원본이 매트뷰에 없다. 그 외 탭만 7거래일 |
| C7-2 블로그 폴백 | 생성 카드 | **이니셜 블록** | C7-1 지시 정정("OG 카드는 텍스트 카드라 64px 에서 글씨가 안 보인다")을 블로그에도 동일 적용 |
| C9 데이터 소스 | 집계 뷰 | **실측 스냅샷 상수** | (category, sub_category, cnt) 뷰가 없다. blog 계열 뷰 10개 전수 확인 |
| C8 데이터 소스 | DB 선행 | **선행 불필요** | `supply_addr` 이 완전 주소라 payload 만으로 시군구 추출 가능. 새 쿼리 0건 |

### 데이터 확인 (RPC 배포 후 실측)

`get_apt_subscription_hub` 반환값 직접 조회 — `window_days` 사다리 정상 동작:

| 지역 | window_days | cards | thumb_url 보유 | site_slug | builder |
|---|---|---|---|---|---|
| 경기 | 60 | 30 | 10 (33%) | 29 | 30 |
| 부산 | 180 | 17 | 16 (94%) | 17 | 17 |
| 세종 | 365 | 3 | 2 | 3 | 3 |
| 전남 | 365 | 9 | 7 | 9 | 9 |
| 제주 | 365 | 7 | 5 | 6 | 7 |

`region_fallback` 은 전 지역 false. 썸네일 보유율 지역 편차가 커서 이니셜 블록이
같은 64×64 를 차지하도록 한 것이 맞다 — 빈 칸을 허용하면 행 정렬이 지역마다 달라진다.

### 후속 (같은 차수에 처리 — 커밋 2개)

**C9-2 `cfffd532` — 서브칩을 `v_blog_subcat_counts` 뷰로 교체.**
실측 스냅샷 상수를 지우고 뷰에서 직접 뽑는다. 뷰의 `group_key`(realestate/stock/life)가
탭 키와 그대로 맞는다. 임계값 30편 → 부동산 6종 · 주식 8종 · 재테크 1종.
`청약·분양` 891 → **1,131편** (영문 구형 231 + 파편 9 흡수).

목록 필터를 `.eq()` → `.in(subNormRaws(sub))` 로 바꿨다. 뷰는 정규화 이름으로 집계하지만
`blog_posts.sub_category` 에는 원본 값이 그대로 있어서, `.eq('sub_category','청약·분양')`
이면 구형 231편이 빠져 칩 건수와 목록이 어긋난다.
**15개 칩 전부 `.in(raws)` 결과가 뷰 집계와 정확히 일치함을 SQL 로 대조 확인했다.**

**C6-2 `17a7af24` — `region_fallback` 제거.** RPC payload 에서 사라진 것을 직접 확인하고
`hub.ts` 3곳(필드·EMPTY_HUB·normalize) 정리. `grep -rn` 0건.

**C9-3 `5480f726` — `SUB_NORM_ALIASES` 거울 제거 (해결).**
`v_blog_posts_listing`(blog_posts.* + sub_norm + group_key)가 생겨 사본을 통째로 지웠다.
`.in('sub_category', subNormRaws(sub))` → **`.eq('sub_norm', sub)` 한 줄**.
본문 목록과 다음 페이지 미리보기 두 쿼리 모두 뷰로 옮겼다.
이제 칩 건수(`v_blog_subcat_counts`)와 목록 건수(`v_blog_posts_listing`)가
**같은 함수 하나(`fn_blog_subcat_norm`)에서 나온다 — 구조적으로 어긋날 수 없다.**
표현식 인덱스 `idx_blog_posts_sub_norm` 으로 인덱스 스캔(실측 6.4ms).
생성 컬럼을 안 쓴 것은 의도 — 함수를 고쳐도 저장값이 재계산되지 않아 드리프트가 더 조용해진다.
권한 확인(Rule #17): anon·authenticated·service_role SELECT — 공개 콘텐츠 목록이라 의도대로.

**C9-4 `13b6380c` — 그룹 탭 필터도 `group_key` 로 (지시 범위 밖 추가 정리).**
같은 이유다. 묶는 규칙의 원본은 `fn_blog_group` 인데 목록 조회가 프론트 상수
`CAT_GROUPS` 를 타고 있었다. 그 함수에 카테고리가 추가되면 프론트만 모르고 그 글들이
다시 도달 불가가 된다 — **C5 의 redev 287편이 정확히 그 증상이었다.**
그룹 탭은 `.eq('group_key', category)`, 레거시 단일값은 그대로 `category`.
`fn_blog_group` 의 ELSE 가 `'life'` 라 새 카테고리는 자동으로 재테크·생활에 들어온다.
`CAT_GROUPS` 는 탭 건수·서브칩 합산에만 남는다 (증상이 남더라도 탭 건수만 어긋나고
목록은 어긋나지 않는다).

### 남은 것 (DB 담당 범위)

1. blog `sub_category` taxonomy 통합 — 뷰가 정규화로 덮고는 있으나 원본은 여전히
   두 세대(`청약·분양` / `cheongak`·`preempt_coverage`·`lotto_cheongak`)가 공존한다
2. 검색 결과 품질 — 청약 항목 404·끝난 공고 상위 (C2 는 진입점만 손댔다)
3. `CAT_GROUPS` 잔여 사본 — 탭 건수 합산용. `fn_blog_group` 기준 그룹별 발행 수를
   주는 집계가 있으면 이것도 없앨 수 있다 (우선순위 낮음 — 목록에는 영향 없다)

### 미검증 (브라우저 실측 필요)

1. 모바일 검색 아이콘 → 모달이 실제로 열리는지 (⌘K 리스너 단일 소유 확인 포함)
2. 목록 3종의 행 높이가 실제로 72px 이하인지, 이미지 유무로 흔들리지 않는지
3. `region_empty === true` 인 지역 (현재 17개 시·도 중 해당 없음) 의 안내 문구
4. C4 이후 가입 지표 — 기준선 30일 신규 가입 7명. 리드와 합산해 판단할 것

---

## V3 (2026-08-23) — 하위페이지 재설계 (커밋 6개)

지시서: `작업지시서 — V3 하위페이지 재설계`. 롤백 지점 태그 `pre-v3-20260823`.
롤백은 `reset` 이 아니라 `git revert <sha>`.

| 커밋 | sha | 내용 |
|---|---|---|
| 1 | `d42a6cf7` | 라우트 판별 헬퍼 + `.kd-lrow` 목록 행 프리미티브 |
| 2 | `5f8c9dc3` | 현장 상세 리드폼 배치 전환 — 폼 주 / 카톡 부 |
| 3 | `de4e4f70` | 현장 상세 히어로·헤더 + 섹션 점프 바 |
| 4 | `86c4a745` | 현장 상세 데스크탑 2단 (우측 300px 레일) |
| 5 | `9e3b6808` | 목록 3종 — 큐레이션 캐러셀 + 행 교체 + 2단 |
| 6 | `500a091b` | 카톡 배너 라우트 조정 + 상세 2종 정리 |

(병렬 세션의 `ed00557e` 위로 rebase 하면서 sha 가 한 번 바뀌었다 — 위가 최종값이다.)

전 커밋 `npx tsc --noEmit` + `npm run build` 통과. 새 CSS 변수 0개
(전부 `globals.css` 실재 토큰 — `--hair`/`--sec-gap` 은 리터럴로 전개).

### 지시서와 다르게 간 곳 (전부 지시서가 작성 시점에 몰랐던 값 때문)

**① 하단 고정 바 좌표 — `bottom: 56px / z-90` → `62px / z-98`**
지시서 작성 뒤 병렬 세션이 `AptTalkBottomBar` 를 올렸고, 거기에 하단 점유 요소
**실측 지도**가 남아 있었다. 탭바 실높이는 56이 아니라 62(`minHeight:56 +
paddingBottom max(6px,safe-area)`), z-90 자리는 InstallBanner 가 쓰고 글쓰기 FAB 가
z-99 라 z-90 이면 FAB 가 바 위로 올라온다. FAB·ScrollToTop 을 바 높이만큼 밀어
올리는 로직도 그쪽에서 승계했다.

**② `AptTalkBottomBar` 를 렌더에서 뺐다 (지시서에 없던 요소)**
카톡 주 / 폼 보조 배치라 v3 의 정반대다. 같은 자리를 쓰는 고정 바 두 개가
겹치므로 `SiteActionBar` 로 대체했다. 파일은 실측 주석 보존 목적으로만 남겼다.

**③ 레일 ①을 '리드폼' 이 아니라 '폼으로 가는 진입 카드' 로 (커밋 4·6)**
`LeadForm` 을 레일에서 한 번 더 렌더하면 한 페이지에 `<form>` 두 벌,
`id="lead-form"` 과 `id="kd-lead-name"` 도 두 벌이 된다. `getElementById` 는 첫 번째만
잡으므로 하단 액션바의 스크롤이 숨은 폼을 가리키고 label-input 연결도 깨진다.
**리드 도달이 이 작업의 최대 리스크**라 폼 인스턴스는 페이지당 한 벌로 유지했다.
→ 레일에 실제 폼을 넣으려면 `LeadForm` 에 **id 접두사 prop** 을 먼저 붙여야 한다.
   그 뒤 데스크탑 레일 폼 / 모바일 인라인 폼을 CSS 로 갈라 쓸 수 있다. (미착수)

### 데이터가 없어 못 넣은 것 (추측해서 채우지 않음)

| 지시서 항목 | 막힌 이유 | 선행 조건 |
|---|---|---|
| /apt 행의 `시공사` | `AptHubItem`(hub.ts:20)에 필드 자체가 없음 → 1순위 접수일로 대체 | `get_apt_subscription_hub` 컬럼 추가 |
| /apt 큐레이션의 `VWorld 출처` | 이미지도 `apt_sites` 조인 키도 없음 → 이미지 미표시 | 동일 RPC |
| /stock 큐레이션의 `뉴스 12건 · 거래량 3.1배` | `reasons` 가 `{tag, 0..1 정규화값}` 뿐이라 원시 건수·배수가 남아 있지 않음 → 기여도 비중(%)으로 표기 | `stock_issue_scores` 컬럼 추가 |
| 큐레이션 3건을 목록에서 제외 | 지시서대로 **하지 않았다.** 프론트만으로 불가능 | `get_apt_subscription_hub` 에 큐레이션 플래그 (채팅 담당) |

### 착수했으나 대상이 없어 건너뛴 것

**커밋 6-③ `/stock/[symbol]` 기간 선택 → 세그먼티드 컨트롤: 대상 없음.**
그 페이지에 기간 선택 UI 자체가 없다. 차트는 고정 30일 스파크라인 한 벌이고
(`priceHist`, 747행 파일 전체에 `period`/`기간` 컨트롤 0건) 라벨도 `30일 전 / 오늘`
고정이다. **없는 컨트롤의 모양을 바꿀 수 없어 손대지 않았다.**
기간 선택을 실제로 붙이려면 3M/6M/1Y 시세 조회 + 클라이언트 상태가 새로 필요하다
— '모양 변경' 이 아니라 신규 기능이라 판단해 지시서 범위 밖으로 뒀다.

**커밋 6-⑤ `/stock/[symbol]` 의 eyebrow 제거: 대상 없음.**
그 페이지는 `SectionHeader` 를 쓰지 않는다 (전부 raw `<h2>`). eyebrow 0건.
같은 커밋의 이모지 제거(②)는 정상 수행 — 지시서가 지목한 6행 중 487·584 는 이미
깨끗했고 실제 대상은 5곳이었다 (406·539·615·661·678).

### 부수로 잡은 것

- `id="supply-section"` 이 `/apt/[id]` 안에 **두 곳**에 있었다. `getElementById` 는
  첫 번째만 잡아 점프 앵커가 조용히 엉뚱한 곳을 가리키고 있었다 →
  두 번째를 `supply-detail-section` 으로 분리.
- `TalkSlot` 에 `'rail'` 추가. 데스크탑 레일은 새 자리라 기존 슬롯에 얹으면
  `site_cta` 지표가 데스크탑 분량만큼 부풀어 배포 전 기준선과 비교가 불가능해진다.
  `'bottom_bar'` 는 지시서대로 기존 값 그대로 썼다.

### Architecture Rule #106 (신설)

**한 페이지에 `<form>` 인스턴스는 한 벌.** 반응형으로 폼 위치를 바꿔야 하면
CSS 로 두 벌을 깔지 말고, 컴포넌트에 id 접두사 prop 을 먼저 붙여 id 충돌을
없앤 뒤에 한다. `getElementById` 로 스크롤·포커스를 잡는 코드(하단 액션바,
앵커 CTA)가 첫 번째 노드만 보기 때문에, `display:none` 인 쪽이 앞에 있으면
스크롤이 아무 일도 하지 않는 무증상 고장이 난다.
근거: v3 커밋 4·6 에서 레일 폼을 넣으려다 잡음. `LeadForm` 은 `id="lead-form"` 과
`input#kd-lead-name` 을 고정으로 쓴다.

### 배포 후 관찰 (14일) — 기준선

| 항목 | 기준선 | 보는 곳 |
|---|---|---|
| 리드 유입 | `leads_7d` 1건 / 미처리 1 | `v_seo_daily_snapshot` |
| 카톡 클릭 | 30일 7건 (sticky 6 · inline 1) | `user_events` (아래 SQL) |
| GSC 노출 | 0 — 2026-04-22 이후 공백 | `gsc_search_analytics` |
| LCP | 미측정 | 배포 전후 직접 측정 |

```sql
-- 배포 전 1회 + 배포 14일 뒤 1회. 채팅이 실행해 이 자리에 결과를 채운다.
select properties->>'slot' as slot, event_type, count(*)
from user_events
where event_name = 'bujeonggong_talk'
  and created_at >= now() - interval '30 days'
group by 1, 2 order by 1, 2;
```

> ⚠️ **배포 전 기준선 SQL 결과가 아직 이 자리에 없다.** 커밋 6 이 현장 상세에서
> sticky 배너를 끄므로, 이 값을 남기지 않고 배포하면 잃은 클릭 6건의 대조군이
> 사라진다. 배포 전에 채울 것.

> ⚠️ **리드는 건당 이메일 구조다.** 하루 10건을 넘으면 아침 요약으로 전환을 검토하고,
> 시트 상태 열에 '미처리' 가 쌓이면 24시간 초과분 알림을 붙일 것.
> **응대 실패가 이 작업의 최대 손실이다.**

### 미검증 (브라우저 실측 필요 — 이 세션에서 못 함)

1. 폼 1건 실제 제출 → 구글시트 · 알림메일(norich92@gmail.com) · Supabase `leads` 3개소 도달
2. `leads.site_slug` 가 `엄궁역-트라비스-하늘채` 로 정확히 들어가는지
3. 모바일 실기기에서 `SiteActionBar` 가 하단 탭바에 가리지 않는지 / 비로그인 시
   `StickySignupBar` 와 겹치지 않는지
4. `id="interest-section"` 생존 + KPI '관심' 타일 클릭 스크롤 (코드상으로는 무변경)
5. LCP — 위성 webp 1024px 가 전폭 최상단으로 올라왔다. `preload` + `fetchPriority=high`
   를 붙였으나 실측은 안 했다

---

## S9 (2026-08-22) — JSON-LD 외부 이미지 차단 + 크론 침묵 계측 (커밋 2개)

### 1. JSON-LD 외부 이미지 차단 (`b6b29e9a`)

S8 에서 `isSafeCover` 를 만들었지만 **`generateMetadata` 안의 지역 상수**로 둬서
`openGraph`·`twitter` 에만 적용됐다. JSON-LD 는 `post.cover_image` 와 본문 이미지를
그대로 내보내고 있었다. `BlogPosting.image[]` 는 "이게 이 글의 이미지다"라고 검색엔진에
명시 선언하는 자리라 OG 보다 강한 신호다 — **남의 언론사 사진을 우리 콘텐츠 대표
이미지로 적극 제출**하고 있었던 셈이다.

- `src/lib/blog/safe-image.ts` 신설. 지역 정의를 삭제하고 한 곳에서만 정의한다.
  두 벌이 남으면 다음에 또 한쪽만 고치게 된다 — **이번 건이 정확히 그 사고였다**
- `BlogPosting.image[]` · `HowTo.image` · `Event.image` 적용

**지시서에 없던 네 번째 JSON-LD 를 실측에서 발견했다.** `ImageGallery`(949행)의
`coverUrl` 이 `post.cover_image` 를 그대로 써서, 외부 이미지만으로 갤러리를 선언하고
있었다. 검증 1차에서 이것 때문에 지시서 지목 글이 FAIL 로 나와 잡혔다.

폴백 URL 은 S8 `heroOg` 와 바이트 동일하다 — `category`·`author_name` 이 발행 글
8,776편 전부 non-null 임을 실측해 `|| 기본값` 이 출력에 영향을 주지 않음을 확인했다.
캐시된 OG 이미지 재생성 없음 (리스크 #1).

`contentImages` 는 JSON-LD 한 곳에서만 쓰여 추출부는 건드리지 않았다 (리스크 #3).

**잃는 것**: 대부분의 글에서 JSON-LD `image[]` 가 생성 카드 1장만 남아 네이버 이미지
캐러셀 노출이 준다. 남의 사진으로 얻던 노출이므로 의도된 결과다. 자체 호스팅 이미지가
있는 395편은 유지되며, 회귀 검증으로 확인했다.

### 2. 크론 침묵 계측 (`<이 커밋>`)

S7-5 에서 목록화한 침묵 지점에 **로깅만** 넣는다. 동작은 바꾸지 않는다.

- 33개 파일 / 45곳. `[크론명] insert fail` 접두어를 디렉터리명으로 통일해
  Vercel 로그에서 `insert fail` 하나로 전수 집계할 수 있다
- 메시지 200자 절단 (과거 80자 chunk 분할로 클러스터가 오염된 전례)

**형태가 두 가지였다.** 처음에 일괄 뒤집기로 시도했다가 타입 에러가 났다 —
`if (!error) X else Y` 를 뒤집으면 `else` 가 두 번 붙는다.

| 형태 | 처리 | 건수 |
|---|---|---|
| `if (!error) X` | `if (error) log; else X` 로 뒤집기 | 35 |
| `if (!error) X else Y` | `if (error) log;` 만 앞에 추가, 원본 구조 보존 | 10 |

`} else {` 가 한 줄에 붙은 경우도 있어 중괄호 매칭 후 같은 줄의 `else` 까지 봐야 했다.
일괄 sed 였으면 조용히 깨졌을 지점들이다 (리스크 #5).

검증 6종: `if (!error)` 잔존 10건(=보존분) / 추가분이 로깅·else 외 0건 /
`return`·`throw`·재시도 추가 0건 / 삭제분이 `if (!error)` 외 0건 /
성공 경로 `console.error` 0건 / 접두어 46곳 일관(45 신규 + gsc-sync 기존 1).

**왜 고치지 않는가**: 46곳을 동시에 고치면 에러가 드러났을 때 원래 실패였는지 이번
변경 탓인지 구분이 안 된다. 지금은 무엇이 실패 중인지 알아내는 단계다.
배포 24시간 뒤 Vercel 로그에서 `insert fail` 을 검색해 실제 실패 크론 목록을 확보한 뒤,
2단계에서 그것만 수리한다.

### 범위 밖 (명시적으로 하지 않음)

**S9-2 블로그 본문 이미지 3,566편.** JSON-LD 만 막고 본문 렌더는 그대로 뒀다.
`content` 일괄 수정은 블로그 데이터 수정 금지 규칙 위반이고, 렌더 필터는 3,566편에서
이미지를 통째로 없애는 것이라 텍스트만 남아 빈약해지는 글이 얼마나 되는지 아직 모른다.
표본 20편 실렌더 확인이 선행돼야 한다.

---

## S8-2 (2026-08-22) — llms.txt 하드코딩 잔재 전수 제거

S8 에서 "핵심 데이터 규모" 블록만 동적화하고 **아래 섹션들을 놓쳤다.** 당시 검증이
`59,400` 만 grep 해서 다른 표기(`59,000+`)를 통과시킨 것이 원인이다.

### 남아 있던 하드코딩 9곳

| 위치 | 표기 | 실제 |
|---|---|---|
| 블로그 섹션 본문 | 59,000+ 편 | **8,775** |
| 부동산 핵심 데이터 | 497,413건 | **726,054** |
| 실거래가 보유 단지 | 26,813개 | **26,835** |
| 시군구 허브 (3곳) | 260개 | **191** |
| 동 허브 (3곳) | 2,800+ 개 | **1,440** |

시군구·동 허브는 지시서에 없던 항목인데 전수 grep 에서 나왔다. 특히 동 허브는
2,800+ 라고 홍보하는데 실제 생성되는 페이지가 1,440개로 **절반 수준**이었다.

### 허브 수는 사이트맵과 같은 기준으로 센다

`sitemap/[id]` 가 시군구 10개+ / 동 5개+ 단지일 때만 허브 URL 을 만든다.
llms.txt 도 같은 임계값으로 집계해야 실제 생성 페이지 수와 맞는다.
`apt_complex_profiles` 를 `range` 로 나눠 받아(PostgREST 1k cap 우회) JS 에서 집계한다 —
사이트맵이 쓰는 것과 동일한 방식이다. `revalidate 86400` 이라 하루 1회 페치다.

집계 실패 시 폴백 상수를 쓰고 llms.txt 자체는 계속 나간다.

### 검증

라이브 응답 전수 grep — 하드코딩 숫자 **0건**. 허브 집계값(191/1,440)이 SQL 실측과 일치.

---

## S8 (2026-08-22) — SEO · GEO · OG 개선 (커밋 4개)

### 1. 블로그 OG 이미지 (`b00940c9`)

발행 8,775편 **전부**가 `og_cards` 6장을 가져 `cards.length === 6` 분기가 항상 먼저
return 했고, 630×630 정사각만 나가면서 `twitter:card='summary_large_image'` 와 모순됐다.
`/apt/[id]` 에서 S7-2 로 고친 것과 동일한 구조 결함.

단순히 실사를 앞으로 올릴 수 없었다 — `cover_image` 8,775편 중 **2,154편이 외부 스크랩**이고
호스트가 250종을 넘는다(`imgnews.naver.net` 892편 최다). 화이트리스트로 분기했다.

- `isSafeCover`: `kadeora.supabase.co` · `/api/og` 두 패턴만 통과. **블랙리스트로 뒤집지 않는다**
- 안전 커버 6,604편(75%)은 1200×630 승격 / 외부 2,154편은 생성 카드로 대체
  (노출 면적 동일, 저작권 노출 없음)
- `og:image` 와 `twitter:images` 가 같은 배열을 쓴다 — 두 곳에 복제돼 있던 로직 통합
- 실측 3케이스(supabase·뉴스·생성) 전부 og:image 7장 · width 1200 · 뉴스 호스트 0건

### 2. 죽은 라우트 색인 처리 (`9d6e3ef4`)

초안의 "전용 그룹에 Disallow 복제" 권고를 폐기하고 반대로 갔다. 5개 라우트가 자기 메타에서
`index:true` 를 선언 중이라, 크롤을 막으면 구글이 그 `noindex` 를 **읽을 수 없다.**

- 5개 → `robots: { index: false, follow: true }`, robots.txt 의 Disallow 7줄 제거
- `/apt/feed` `/apt/tabs` 는 **라우트 자체가 없어** 줄만 삭제
- 파셋·비색인 12종을 Googlebot·Yeti·Bingbot·DaumCrawler·ZumBot **각 그룹에 복제**.
  robots.txt 는 가장 구체적인 그룹 하나만 적용하므로 `*` 의 규칙을 이 5종이 전원 무시하고 있었다
- `Crawl-delay: 0` 은 Googlebot·Bingbot 에서만 삭제. **Yeti 는 네이버가 실제로 존중하므로 유지**
  (지시서도 두 엔진만 지목했다)
- 실측: 5개 전부 HTTP 200 + noindex, `/apt`·`/blog` 대조군 영향 0, robots 문법 오류 0

### 3. llms.txt 동적 생성 (`83b6b81c`)

| | 표기 | 실제 |
|---|---|---|
| 블로그 | 59,400+ | **8,775** |
| 실거래 | 497,413 | **726,054** |
| 커뮤니티 | 5,198 | **12,909** |
| 청약 | 2,713 | **2,851** |
| 계산기 | 142/145 혼재 | **140** |

- DB 에서 직접 센다(`revalidate 86400`). DB 장애 시 하드코딩 폴백 (리스크 #4)
- 계산기 수·카테고리 수·**카테고리 목록**을 `CALC_REGISTRY` 에서 생성.
  하드코딩 목록은 연말정산이 두 번 나오고 **주식/투자·쇼핑/소비가 빠져** 있었으며,
  헤더는 "15개 카테고리"인데 실제 **16개**였다. `CATEGORIES.count` 합(150)도 어긋났다
- `public/llms.txt` 삭제 (라우트와 중복, 내용 낡음)

### 4. OG·메타 누락 (`7a205f79`)

**4-1 은 전건이 실재했다** — `/apt` `/stock` `/apt/busan` `/apt/region` 이 `openGraph` 는
있는데 `images` 가 없었다. 기존 `/api/og` 를 1200×630 으로 붙였다.

**4-2/4-3 은 5개 중 1개만 실제 대상이었다.**

| 라우트 | 판정 |
|---|---|
| `/apt/sites` | `permanentRedirect` 스텁 — 렌더되지 않아 metadata 무의미 |
| `/apt/sites/[slug]` | 같음. 미들웨어도 308 처리 중 |
| `/daily` | `layout.tsx` 에 이미 metadata 존재, `index:false` |
| `/apt/unsold/[id]` | 리다이렉트 페이지. "metadata is ignored by 308" 주석대로 의도된 제거 |
| `/apt/unsold` | **실제 누락** → title·description·canonical·openGraph 추가 |

지시서가 "llms.txt 가 5,783개라고 홍보하는 바로 그 페이지"라 한 `/apt/sites` 는 `/apt` 로
308 되는 스텁이었다. llms.txt 링크를 `/apt` 로 직접 연결했다.

### 남은 것 (범위 밖)

- **블로그 본문 외부 이미지 2,154편** — OG 는 막았지만 본문에는 남아 있다.
  `/apt/[id]` 처럼 위성으로 대체할 수단이 블로그엔 없어 별도 트랙 필요
- `Event` + `Offer` 스키마, description 93자 — 후순위

---

## S7-5 + 소품 (2026-08-22) — 네이버 채널 정정 · 순위 추적 확장 · 잔여 2건

작은 커밋 3개. 각각 독립적이라 분리했다.

### 1. 네이버 블로그 채널 정정 (`f6329d8b`)

- `layout.tsx` `sameAs`: `blog.naver.com/silreit` → `kadeoraapp`.
  틀린 계정을 선언하면 실제 운영 블로그가 브랜드 엔티티에 묶이지 않고, 남의 계정을
  우리 채널이라 주장하는 셈이 된다. 카페 URL 은 그대로 뒀다
- `naver-sc-sync`: `OUR_DOMAIN = "kadeora.app"` 단일 → `OUR_DOMAINS` 배열.
  `blog` 소스는 네이버 블로그 검색이라 `kadeora.app` 로는 **구조적으로 절대 매칭되지 않았다.**
  blog 순위가 전량 권외였던 것은 순위가 없어서가 아니라 찾을 대상이 없어서였다
- 계정명까지 포함해 좁게 매칭한다. `naver.com` 만으로 완화하면 남의 글이 잡힌다.
  `m.blog.naver.com` 응답 가능성은 배포 후 실제 응답을 보고 판단한다 — 추측으로 넓히지 않는다

**주의:** root `src/app/layout.tsx` 는 평소 수정 금지 대상(meta/font blast radius)이다.
이번 건은 지시서가 파일·행을 특정한 `sameAs` 문자열 1줄 교체라 진행했다.

### 2. `gsc-sync` 적재 실패 로깅 (`6ca15291`)

`if (!error) inserted += payload.length;` 형태라 적재가 전부 실패해도 응답은 `ok:true` 이고
런타임 로그에 아무것도 남지 않았다. 실패 시 `console.error` + 응답에 `failed_batches` 추가.
`inserted` 만 보면 0 인지 실패인지 구분이 안 된다.

#### 같은 패턴 전수 (범위 밖 — 목록만)

`if (!error)` 로 조용히 넘어가는 곳이 **크론 24개 46곳**에 더 있다.

```
apt-backfill-details(2) backlink-sync blog-cleanup-padding blog-inject-images
blog-internal-links crawl-apt-rent crawl-apt-resale crawl-apt-subscription
crawl-apt-trade crawl-busan-redev crawl-gyeonggi-redev(2) crawl-nationwide-redev
crawl-seoul-redev(2) data-quality-fix invest-calendar-refresh issue-detect
issue-preempt(4) krx-short-selling(2) programmatic-seo-consume redev-geocode(2)
redev-verify-households seo-content-boost seo-excerpt-fill seo-internal-links
stock-crawl(2) stock-desc-gen stock-discover stock-flow-crawl stock-flow-signals
stock-hero-refresh stock-news-crawl stock-price sync-apt-sites(4)
```

이 중 `error` 를 아예 참조조차 안 하는(로그·집계 흔적 0) 파일이 20개다. 적재 실패가
전부 조용히 사라지는 구조라 별도 정리가 필요하다.

### 3. 상태 배지 대비 (`<이 커밋>`)

현장 유형 배지 5종이 전부 다크 전제 하드코딩이었다. **알파를 흰 배경에 합성해 실측**(Rule #85):

| 배지 | 이전 | 이후 |
|---|---|---|
| subscription | #2EE8A5 → **1.38:1** | `--accent-green` 6.84:1 |
| redevelopment | #B794FF → 2.14:1 | `--accent-purple` 4.91:1 |
| unsold | #FF6B6B → 2.39:1 | `--accent-red` 7.11:1 |
| landmark/complex | #38BDF8 → 1.91:1 | `--accent-cyan` 6.31:1 |
| trade | #FBBF24 → 1.54:1 | `--accent-yellow` 6.21:1 |

지시서가 지목한 `분양` 배지가 최악(1.38:1)이었다 — 합성하면 배경과 사실상 구분되지 않는다.

- 새 토큰을 만들지 않고 `globals.css` 의 기존 accent 세트로 매핑했다
- `--accent-cyan` 은 `-bg` 짝이 없어 같은 계열인 `--accent-blue-bg` 를 썼다 (6.31:1)
- 상태 배지 `SB.open` 은 `color`/`border` 가 이미 토큰인데 `bg` 만 하드코딩으로 남아 있어
  함께 교체했다. `upcoming`/`closed` 는 이미 토큰이라 손대지 않았다

---

## S7-2 (2026-08-22) — 이미지 소스 교체: 뉴스 스크랩 제거, 자체 호스팅 전환

트라비스 상세 갤러리가 `t1.daumcdn.net`(다음 뉴스 썸네일)과 `consumernews.co.kr`(컨슈머뉴스)
사진을 첫 화면 대표 이미지로 띄우고 있었다. 그 URL 들이 언론사 `caption` 까지 붙어
`ImageGallery` JSON-LD 에 그대로 선언돼 있었다. 저작권 노출이자 품질 문제다.

### 리스크 #1 이 현실이었다 — `APT_COLS` 에 `hero_image_*` 3개가 없었다

DB 에는 `hero_image_url` `hero_image_source` `hero_image_credit` 가 존재하는데
`APT_COLS`(91행) 에 빠져 있었다. 그대로 뒀으면 항상 `undefined` 로 읽혀
**전 현장에서 갤러리가 사라졌을 것**이다 (S0 `data_quality_score` 누락과 같은 유형).
착수 첫 단계로 확인해 추가했다.

### 변경

- 갤러리 소스: `apt_sites.images` → `hero_image_url` > `satellite_image_url` > 없으면 미렌더.
  생성 카드로 채우지 않는다 — 갤러리 자리의 텍스트 카드는 "이미지가 있는 척"이 된다
- `ImageGallery` JSON-LD: 배열이 비면 블록 자체를 렌더하지 않는다. 뉴스 URL·언론사 caption 소멸
- `aptSiteThumb()`: `hero > cover > satellite > og > 생성 카드`. **`firstImageUrl(row.images)` 제거**
- OG·트위터: `og_cards.length === 6` 분기가 실사를 통째로 건너뛰고 있었다(97.9%).
  실사 보유 시 0번 자리에 넣고 카드 6장을 뒤에 붙인다. 실사가 없으면 기존 동작 그대로
- Article JSON-LD `image[]`: 실사 0번 + `og-square` 제거(같은 카드를 두 번 선언할 이유가 없다).
  `thumbnailUrl` 은 검색 썸네일이 작아 위성이 얼룩으로 보이므로 **시행사 실사가 있을 때만**
  쓰고 없으면 생성 카드 — 위성은 넣지 않는다
- 갤러리 하단 12px 출처: `항공 이미지 · 국토교통부 공간정보 오픈플랫폼(VWorld)`.
  `hero_image_source === 'developer'` 면 `hero_image_credit`. **`조감도` 라고 쓰지 않는다 — 위성이다**

### 지시서 밖에서 손댄 곳

`AptSiteThumbRow.images` 필드와 이를 넘기던 호출처 2곳(`AptImminentCarousel`,
`AptRealtimeRanking`)을 제거했다. 체인에서 뺀 뒤로는 무시되는 값이지만, 남겨두면
"아직 쓰이는 값"으로 읽혀 되살아난다. 타입 단계에서 막았다.
`aptComplexThumb` 은 지시서대로 손대지 않았다(`firstImageUrl` 정의도 그쪽 때문에 유지).

### 리스크 #5 — `content_score` 는 `images` 로 미디어 5점을 준다

`api/cron/sync-apt-sites/route.ts:313`

```ts
if (s.images && Array.isArray(s.images) && s.images.length >= 1) score += 5;
```

화면에서 `images` 를 뺐으므로 그대로 두면 **화면에 없는 이미지로 점수를 받는** 상태가 된다.
기준을 `hero_image_url`/`satellite_image_url` 로 옮겼다.

sitemap 편입 임계값(`content_score >= 25`) 교차를 먼저 실측했다 — **양방향 0건**.
현재 5,924개 전부 25 이상이고, ±5 로 임계값을 넘나드는 현장이 없어 색인 영향이 없다.
영향이 0인 것을 확인한 뒤 별도 커밋으로 분리했다.

| | 현장 수 | 점수 변화 |
|---|---|---|
| `images` + 위성 | 5,329 | 0 (계속 +5) |
| `images` 만 | 68 | −5 |
| 위성만 | 520 | +5 |
| 둘 다 없음 | 7 | 0 |

### 영향 규모 (DB 실측 — 지시서와 일치)

손실 68건(원래 타사 저작물), 개선 520건(이제 갤러리에 나타남). 순이득.
`hero_image_url` 보유는 현재 0건이라 실질 대표 이미지는 전부 위성이다.

### 검증

tsc 0 / build 0 / BOM 0. `aptSiteThumb` 내 `firstImageUrl` 0건,
apt 상세에서 `site.images` 참조 0건.

`/apt/[id]` 는 로컬에서 404(`.env.local` service-role placeholder)라 **HTML 실측은 배포 후**에
해야 한다. 트라비스 페이지에서 `t1.daumcdn.net`·`consumernews.co.kr` 0건,
갤러리 첫 이미지가 `supabase.co/storage/.../satellite/`, `og:image` 첫 값 동일,
`ImageGallery` JSON-LD 언론사 caption 0건을 확인할 것.

---

## S7-4 (2026-08-22) — 섹션 재배치 (B안: 회원 CTA 는 히어로 아래 유지)

### 지시서 전제 정정 — `AptHero` 는 조감도가 아니다

지시서는 "574 가 `AptHero`(585)보다 위에 있어 조감도·단지명보다 CTA 가 먼저 나온다"고 했다.
방향은 맞지만 **`AptHero` 는 이미지가 없는 요약 카드**다(`grep -c 'Image|img'` → 0).
실제 조감도는 `AptImageGallery`, 단지명 `<h1>` 은 그보다 한참 아래, `apt-phase6-grid > main`
안에 있었다. 그래서 회원 CTA 를 `AptHero` 뒤로만 옮기면 **여전히 조감도보다 위**에 남는다.

목표("조감도가 CTA 보다 위")를 실제로 만족시키려면 히어로 텍스트 블록이 닫히는 지점,
즉 조감도·단지명·위치 줄 바로 다음이 회원 CTA 자리다. 그 위치로 옮겼다.

### 최종 순서 (실측)

| 행 | 섹션 |
|---|---|
| 754 | 조감도 (AptImageGallery) |
| 782 | 단지명 h1 |
| 793 | 리드폼 앵커 |
| 803 | **회원 CTA (관심 단지 저장)** |
| 814 | 공급 정보 |
| 928 | 위치 정보 |
| 1130 | 분양 일정 |
| 1139 | **리드폼 (분양 정보 안내 신청)** |
| 1200 | 모집공고 핵심 요약 |
| 1922 | FAQ |

- 리드폼을 분양 일정 직후로 올렸다. 조감도·공급정보·일정을 본 직후가 관심 최고점이고,
  정보가 먼저 나오므로 리드팜 구조가 되지 않는다
- **두 CTA 사이 3개 섹션**(공급 정보 / 위치 정보 / 분양 일정) — 지시서 요구(최소 2개) 충족
- B안이므로 회원 CTA 를 최하단으로 내리지 않았다. 게이트 제거(S7-1)로 가입 경로가 하나
  사라진 직후이고 최근 30일 가입이 7명뿐이라, 가입 유입을 추가로 줄이지 않는 쪽을 택했다

### 앵커 무결성

KPI 타일의 `scrollTo` 목적지 5개(`price-section` `movein-section` `interest-section`
`supply-section` `stats-section`) 전부 정의가 살아 있다. `LeadFormAnchor` →
`id="lead-form"` → 이름 칸 포커스 경로도 유지된다 (목적지만 1139 로 당겨졌다).

S7-3 에서 삭제한 전체폼 자리에 남아 있던 고아 주석
`{/* 관심단지 등록 CTA — AI 분석 바로 아래 */}` 도 함께 정리했다.

### 검증

tsc 0 / build 0 / BOM 0. 정적 순서 검사 8항목 전부 통과.
`/apt/[id]` 는 로컬에서 여전히 404(`.env.local` service-role placeholder)라 실물 렌더는
배포 후 확인이 필요하다 — 순서는 JSX 정적 분석으로 검증했다.

---

## S7-3 (2026-08-22) — CTA 역할 분리

`/apt/[id]` 한 페이지에 성격이 다른 CTA 가 4개 있었고 그중 둘은 문구가 거의 같았다.
`InterestRegisterHero`(회원 기능)가 "{현장명} 청약·일정 알림 받기", `LeadForm`(리드폼)이
"관심 현장 알림 신청" — 사용자가 구분할 방법이 없었다.

### 이름이 아니라 약속으로 갈랐다

| | 회원 기능 | 리드폼 |
|---|---|---|
| 제목 | 관심 단지로 저장 | 분양 정보 안내 신청 |
| 설명 | 카더라 계정에 저장하고 청약 일정을 앱으로 받아보세요 | 담당자가 직접 연락드려 잔여 세대·일정을 안내합니다 |
| 버튼 | 관심 단지 저장 / 로그인하고 저장 | 신청하기 |
| 색 | 흰 카드 + 카카오 노랑 버튼 | 틴트 색면 + 2px 강조 테두리 (S4-2 유지) |

- 리드폼에서 "알림" 을 완전히 뺐다. **알림으로 받아놓고 사람이 전화하면 약속과 실제가 어긋난다.**
  정확한 문구가 구분 문제까지 같이 해결한다. 영업 표현(무료 상담·지금 문의)은 여전히 쓰지 않는다
- 지시서에 없던 2곳도 같은 이유로 맞췄다: 상단 밴드 `알림 신청 · 무료` → `분양 정보 안내 · 무료`,
  eyebrow `NOTIFY` → `CONTACT`. 제목만 바꾸고 두 곳을 두면 한 카드 안에서 약속이 갈린다
- 앵커: `분양 정보 안내 받기` / 버튼 `안내 신청 →`

### `InterestRegistration` 전체폼 제거

하단 `<details>` 안에 접혀 있던 회원 전체폼(알림 6단계 토글 · 가점 입력)을 지웠다.
574 의 간단 등록과 기능이 겹치고, 리드폼과는 입력 필드(이름·연락처·생년월일)가 겹쳤다.
다른 라우트 참조가 없어 컴포넌트 파일까지 삭제했다.

**`id="interest-section"` 은 KPI '관심' 타일의 `scrollTo` 목적지였다.** 블록을 통째로 지우면
그 클릭이 죽으므로 앵커를 `InterestRegisterHero` 로 옮겼다 — 전체폼이 사라진 뒤 남은 유일한
관심 등록 수단이 그것이다.

### 손대지 않은 것

`getDisplayInterestCount` / `formatInterestText` 는 이 페이지에서 import 만 되고 쓰이지 않는다.
**이번 변경 이전부터 그랬다**(`git show HEAD` 로 확인) — 범위 밖이라 두었다.

### 검증

tsc 0 / build 0 / BOM 0. `/apt/[id]` first-load 331 → 327 kB.
두 CTA 문구 겹침 0건, 리드폼 쪽 "알림" 0건(남은 1건은 서버 메일 알림을 설명하는 주석),
영업 표현 0건, `InterestRegistration` 잔존 참조 0건.

---

## S8 (2026-08-21) — 회색 텍스트 가독성

- (A) 회색 토큰 단계별 강화. 정의 블록은 :root 한 곳뿐이다
  (html.font-* 스코프는 크기·간격만 재정의하고 색은 다루지 않는다)
    --text-secondary #4B5563 → #374151 (6.74 → 9.19)
    --text-tertiary  #556070 → #4B5563 (5.69 → 6.74)
  tertiary 를 기존 secondary 값으로 올리는 게 핵심. 회색 계열 2,180건이 본문색
  1,128건의 두 배라, 개별 대비가 통과해도 화면의 3분의 2가 회색이라 흐리게 읽혔다.
  secondary 를 함께 내려 3단 위계 유지 (surface 기준 17.74 / 10.31 / 7.56)
- (B) 회색 × opacity 텍스트 5건 제거. 실효 대비 2.66~3.58 → 토큰값 그대로
- (C) 밝은 배경 위 반투명 흰 글자 2건 교체, 122건은 제외 판정

### B 제외 4건
- FeedClient:502 · ReportButton:74 — transition: opacity 가 같이 있는 호버 효과
- UserDetailClient:146,147 — disabled 버튼. opacity 는 비활성 어포던스이고
  비활성 컨트롤은 WCAG 대비 기준 적용 대상이 아니다

지시서 목록 중 AptHeaderV5:49(📍) · big-events:103,114('/') · blog/series:54(아이콘)은
텍스트가 아니라 제외. AptHomeHero:64 · CriticalAlertBar:43 · BigEventCharts:196 은
해당 위치에 opacity 가 없었다.

### C 교체 2건 — 둘 다 앞선 작업이 남긴 잔재
- apt/[id] 이미지 없는 폴백 카드의 시공사 줄. S5-2 에서 카드 배경을 var(--bg-elevated)로
  바꾸며 지역·단지명은 토큰화했는데 이 줄만 흰 글자로 남아 있었다
- BlogHeroExtras '한눈에 보기' 박스. 배경 rgba(255,255,255,0.02)·보더
  rgba(255,255,255,0.08) 이라 라이트에서 상자 자체가 안 보였다. 텍스트·배경·보더를
  함께 토큰화

### C 제외 122건
api/**(og-*·apt-img) 77 · 다크 모달/시트/바 9파일 · 채도 높은 배경 위 흰 글자
(SectorHeatmap·PortfolioSimulator·InstallBanner·apt/complex 히어로) ·
다크 차트(StockTreemap) · 이미지 오버레이(AptImageGallery 워터마크·캡션 등).
다크 판정 9파일에 표식 주석을 남겼다.

### Architecture Rule 추가
- #85 대비를 잴 때 color hex 만 보지 않는다. opacity 와 rgba 알파가 실효 대비를
  추가로 깎는다. --text-tertiary × opacity 0.6 = 2.87 로 3:1 도 미달이다
- #86 4.5:1 은 '읽을 수 있다'의 하한이다. 회색 토큰이 본문색보다 많이 쓰이면
  개별 대비가 통과해도 화면 전체가 흐리게 읽힌다. 위계를 유지하되 회색 단계 자체를
  어둡게 잡는다

### 다음 — 실기기 확인 필요
- 회색 글자가 또렷해졌는지. 특히 카드 메타(시공사·지역·세대수), 블로그 날짜·조회수,
  하단 고지 문구 — 전부 --text-tertiary 자리다
- 너무 진해 위계가 사라졌으면 --text-tertiary 를 #4F5A69 로 중간 조정
## S7-1 (2026-08-21) — 게이트 전면 제거: 클로킹 해소

**푸시 2026-08-21 09:48 KST** — 커밋 `78110f15` (배포 완료 시각은 Vercel 대시보드 기준으로 별도 확인)
- 이전 30일 게이트 성과: 노출 939 / 클릭 8 (0.85%), 동기간 전체 가입 7
- 관찰 대상: GSC 노출·클릭 14일, 네이버 웹문서 6키워드, 리드 유입량, 가입 전환
- **S0 색인 개방 관찰 기간과 중첩**. 이후 GSC 변화를 해석할 때 두 변경을 구분할 근거는 이 날짜뿐이다

### 무엇이 클로킹이었나

`isBot(user-agent)` 으로 갈라 봇에게만 전문을 줬다. 구글은 유료화 콘텐츠를 허용하지만
구조화데이터 선언이 전제인데 `apt/[id]` 는 선언이 0건이었고, `blog/[slug]` 는 선언한
`.kadeora-paywall` 을 비로그인 기본 경로(`SmartSectionGate`)가 쓰지 않아 불일치였다.
네이버·다음에는 유료화 프로토콜 자체가 없어 국내 검색 기준으로는 예외 없이 클로킹이었다.

### 변경

- `apt/[id]`: `SectionGate` 3곳(ai_analysis / apt_price_compare / apt_trade_compare) 제거,
  자식만 직접 렌더. `isBot` import · `isBotVisit` · 죽은 `aptUA` 제거
- `blog/[slug]`: 렌더 4갈래(isBot / BlogGatedRenderer / BlogTossGate / SmartSectionGate) →
  **단일 경로**. 봇 경로가 이미 `htmlFull` 전문이었으므로 그것으로 통일.
  인라인 `isBot` 정규식, `!isBot` 조건 7곳, 죽은 절단 변수 4개 제거
- `isAccessibleForFree` / `hasPart` JSON-LD 를 **같은 커밋에서** 제거.
  게이트를 없애면서 유료화 선언만 남기면 거짓 선언이 되어 더 나쁘다
- 컴포넌트 7개 파일째 삭제: `SmartSectionGate` `SectionGate` `BlogGatedRenderer`
  `BlogGatedWall` `BlogEarlyGateTeaser` `BlogTossGate` `PaywallMarker`
- 삭제된 컴포넌트를 "현행 대체재"로 가리키던 주석 5곳 갱신 (다시 import 되는 것을 막는다)

### 지시서 범위 밖이었지만 손댄 곳 2건

- **`stock/[symbol]`의 `PaywallMarker`** — 지시서 §1 에 없었으나 `PaywallMarker.tsx` 를
  삭제하려면 이 참조도 지워야 했다. 이 라우트의 게이트(`GatedStockSection`)는 그대로 두었다
- **`GatedStockSection` 의 `className="kadeora-paywall"`** — CSS 정의가 없는
  스키마 선택자 전용 클래스다. `PaywallMarker` 를 지운 뒤로는 아무도 참조하지 않는
  dangling 표식이라 클래스만 제거했다. 게이트 동작(`data-gate-section`·`gate_level`·
  `IntersectionObserver`)은 손대지 않았다 — `GatedStockSection` 제거는 여전히 별도 판단 사항

### 검증

- `grep isBot` (src/app) 0건 / `isAccessibleForFree`·`kadeora-paywall`·`hasPart` 0건 /
  삭제 컴포넌트 참조 0건
- `SectionGate` 제거로 `apt/[id]` 1694행의 JSX children 중괄호가 불법이 돼 타입 에러 3건이
  났다. `{(() => {…})()}` → `(() => {…})()` 로 전환해 해소 (빌드만으로는 못 잡고 tsc 가 잡음)
- 사람 UA vs Googlebot 응답 비교 — 4개 글에서 본문 텍스트 길이 완전 일치.
  `has_gated_content` 글 3편도 전문 렌더 확인 (4783 / 5388 / 5224자)
- 남은 차이는 React 스트리밍 페이로드(`self.__next_f.push`) 청크 순서뿐. 전체 길이 동일

### first-load 변화 (리스크 #5 대응)

| 라우트 | 이전 | 이후 |
|---|---|---|
| `/blog/[slug]` | 39.7 kB / 342 kB | **11.3 kB / 314 kB** |
| `/apt/[id]` | 12.9 kB / 332 kB | 12 kB / 331 kB |
| `/stock/[symbol]` | 15.9 kB / 327 kB | 15.9 kB / 327 kB |

비로그인에게 전문 HTML 이 늘었지만 게이트 JS(클라이언트 컴포넌트 + IntersectionObserver +
localStorage)가 빠져 **순감**했다.

### 부수 이득

`SectionGate` 의 `linear-gradient(to top, var(--bg-base, #0b1220) …)` 하드코딩 페이드가
S1 라이트 전환 후 흰 배경에 남색 그라디언트를 깔고 있었다. `SmartSectionGate` 의
`rgba(224,232,240,…)` 계열 다크 하드코딩과 함께 컴포넌트째 사라졌다.

### 롤백

`git tag pre-s7-20260821` = `1c21ee00` (원격에도 push 완료).
다만 이 태그 이후 다른 세션이 S8 등 4커밋을 얹었으므로 `reset --hard` 로 되돌리면 그 작업까지
날아간다. 되돌릴 때는 `git revert 78110f15` 로 이 커밋만 취소할 것.

---

## S6-3 (2026-08-21) — 가독성 마무리: 행간 · 크기 하한

globals.css 두 블록만 건드렸다. 인라인 lineHeight/fontSize 는 하나도 바꾸지 않았다.

- (A) body line-height 1.5 → 1.65 → **1.58**(실화면 확인 후 조정). 한글은 받침 때문에 1.6~1.8 이 표준인데
  .blog-content(1.85)만 제대로였고 일반 UI 는 1.5 였다. 1.7 이상은 높이 고정 카드에서
  세로 넘침을 만든다. 1.65 는 실화면에서 밀도가 과해 1.58 로 내렸다
- (B) ROOT 스케일링 사다리 하한 11px → 12px (9→12 · 10→13 · 11→14).
  원본 9/10/11px 인라인 1,194건이 1px 씩 올라간다. 12px 이상 구간은 미변경
- html.font-large / html.font-small 사다리는 사용자가 고른 설정이라 미변경

### 지시서 범위 밖이지만 함께 처리
S5 에서 만든 .text-[Npx] 블록도 같은 하한으로 올렸다. 이 블록은 ROOT 사다리의 짝이라
한쪽만 올리면 같은 10px 가 인라인 13px / 클래스 12px 로 갈린다.
S5 에서 없앤 '같은 크기가 다르게 보이는' 불일치가 그대로 되살아난다.

### 세로 넘침 사전 점검 — 코드로 확인 가능한 범위
고정 height + overflow:hidden 조합 11곳을 열어봤으나 전부 프로그레스 바 ·
이미지 컨테이너 · 단일 행 티커라 다행 텍스트가 없다.
하단 탭바는 minHeight:56 이라 늘어나고, 헤더 pill(height:34)은 13px 한 줄이라
1.65 적용 시 21.5px 로 여유가 있다. AptImageGallery 폴백 카드(height:140)는
지역+단지명 2행 기준 약 122px 로 들어간다.
**실제 넘침 여부는 렌더해야 판정된다 — 아래 실기기 확인 항목.**

### 앞선 진단 정정 (지시서가 짚은 것)
S5 감사의 '14px 미만 2,093건'은 소스값이지 렌더값이 아니었다.
스케일링 사다리가 이미 끌어올리고 있어 실제 렌더 12px 미만은 63건뿐이었다.
3,064건 일괄 치환 대신 사다리 한 블록을 올려 1,194건을 함께 움직였다.

### Architecture Rule 추가
- #83 한글 본문 행간은 1.6 이상. 라틴 기준 1.5 는 한글에서 좁다.
  단 배지·숫자·한 줄 라벨은 예외
- #84 인라인 폰트 크기는 컴포넌트를 일괄 치환하지 말고 globals.css 의 스케일링
  사다리에서 조정한다. 한 블록으로 수천 건이 함께 움직인다.
  사다리를 고칠 때는 [style*=] 블록과 .text-[Npx] 블록을 항상 같이 본다

### 다음 — 실기기 확인 필요 (숫자로 판정 불가)
- /apt 목록 · /apt/busan 카드가 세로로 늘어나 어색하지 않은지
- 바텀 내비 · 헤더 텍스트 넘침 여부
- 전체적으로 읽기 편해졌는지. 1.58 도 넓으면 1.5 로 되돌린다
## S4-4 (2026-08-21) — 리드폼 확산: 블로그 삽입(P1) + 전 현장 적용(P2)

- `src/lib/apt/lead-eligibility.ts` 신설. 상세(P2)·블로그(P1)가 같은 판정을 쓴다
- P2: `/apt/[id]` 의 트라비스 슬러그 하드코딩 가드 제거 → `isLeadEligible(site.lifecycle_stage)`.
  `lifecycle_stage` 는 이미 `APT_COLS` 에 있었다 (S0 `data_quality_score` 누락 유형 아님)
- P1: 블로그 상세에서 `hub_apt_slug` → `apt_sites` 단건 조회 후 대상 단계일 때만 본문 하단
  (관련 글 위)에 폼. 상단 앵커는 넣지 않는다
- `LeadFormProps.variant?: 'detail' | 'blog'` 추가 — 설명 한 줄만 분기. 컴포넌트 복제 없음.
  블로그는 `typeOptions` 를 넘기지 않아 `선택 안 함 / 미정` 2개만 뜬다
- `LeadForm` / `LeadFormAnchor` 내부 로직은 손대지 않았다

### 지시서 전제 정정 2건 (실측)

**1. 트라비스가 `move_in_ready` 라 지시서 목록으로는 폼이 사라졌다.**

지시서 §5 검증 항목은 "트라비스(`unsold_active` 계열) → 앵커+폼 둘 다 보임" 인데 실제 단계는
`move_in_ready` 다. 지시서의 5단계 목록을 그대로 쓰면 §5 검증 대상 4건(트라비스 상세 +
블로그 92501/48502/41519)이 **전부 폼 없음**이 된다. 셋 다 `hub_apt_slug` 가 트라비스다.

`fn_refresh_lifecycle_stage()` 정의를 보면 `move_in_ready` 는 "입주 준비"가 아니라
**계약 체결 기간 종료**(`v_today > cntrct_cncls_endde`)다. 입주월이 지났으면 `post_move_in`,
이번 달이면 `move_in_started` 가 CASE 에서 먼저 걸리기 때문에, `move_in_ready` 720건은
**전부 입주예정이 미래**다 (202609~203104, 과거 0건). 분양가·일정 알림이 유효한 구간이라
사용자 확인 후 대상에 포함했다.

| | 지시서 5단계 | move_in_ready 포함 (채택) |
|---|---|---|
| 현장 | 463 | **1,183** |
| 발행 블로그 | 199 | **354** |

**2. 블로그 도달 범위는 319편이 아니다.** 지시서 5단계 기준 실측 199편, 채택안 기준 354편.
(발행 8,833 / `hub_apt_slug` 보유 1,790 / 해석 가능 1,790 — 끊긴 참조 0 은 지시서와 일치)

### 성능

- `hub_apt_slug` 가 null 이면 조회 자체를 하지 않는다 (발행 글의 80%)
- 기존 병렬 뭉치에 합치지 않았다. 애초에 이 파일에는 `Promise.all(Settled)` 가 없어
  순차 `await` 단건 조회로 들어간다 (Rule #49)
- `apt_sites.slug` 에 유니크 인덱스 + 보조 인덱스 존재 확인
- 빌드 46s → 40s (증가 없음). `/blog/[slug]` first-load 337 → 342 kB (LeadForm 클라이언트 번들분)

### 검증

단계 판정 8건 DB 실측: 트라비스 O / 명륜자이(landmark) X / landmark X / post_move_in X /
move_in_started X / subscription_open O / unsold_active O / site_planning O.

블로그 렌더 6건 헤드리스: 트라비스 연결 글 2건 폼 O·앵커 X, `hub_apt_slug` null 2건 폼 X,
비대상 단계 연결 2건 폼 X. blog variant 문구·희망타입 2개 노출 확인.

`/apt/[id]` 는 로컬에서 여전히 전부 404 (`.env.local` service-role placeholder) — P2 실물 렌더는
배포 후 확인 필요.

---

## S4-3 (2026-08-21) — 인라인 font-size 스케일링 선택자 누락 15건

`globals.css` 인라인 스케일링에서 `html.font-large` / `html.font-small` 블록의
**콤마 뒤 두 번째 선택자에 prefix 가 빠져 있었다.**

```css
html.font-small [style*="font-size: 12px"],
[style*="font-size:12px"] { font-size: 11px !important; }   /* ← 무조건부 */
```

셀렉터 리스트는 각 선택자가 독립적으로 매칭된다. 두 번째 줄은 `html.font-small` 과
무관하게 전역에 걸리고, 같은 명시도·같은 `!important` 끼리는 소스 순서상 마지막이 이기므로
**모든 사용자가 font-small 값을 받고 있었다.**

- 대상: font-large 8건 + font-small 7건 = **15 규칙**. ROOT 블록 7건은 원래 무조건부가
  맞으므로 건드리지 않았다. diff 는 정확히 15줄 치환뿐
- 무공백 표기(`font-size:13px`)만 새는 이유는 React 직렬화 형태이기 때문이다.
  CSSOM 이 다시 쓴 요소는 `font-size: 13px`(공백)이 되어 ROOT 규칙에 걸렸다 —
  같은 선언이 렌더 경로에 따라 다른 크기로 나오던 원인

### 기본(font-medium) 상태 변화 — no-op 이 아니다

수정 전에는 무공백/공백 표기가 **8개 크기 전부에서 서로 다른 값**으로 해석됐다.
수정 후 둘이 일치한다.

| 선언 | before 무공백 / 공백 | after (양쪽 동일) |
|---|---|---|
| 9px | 13 / 11 | 11 |
| 10px | 10 / 12 | 12 |
| 11px | 10 / 13 | 13 |
| 12px | 11 / 14 | 14 |
| 13px | 12 / 15 | 15 |
| 14px | 12 / 16 | 16 |
| 15px | 13 / 16 | 16 |
| 16px | 14 / 16 | 16 |

즉 **무공백 인라인은 기본 상태에서 3~4px 커진다.** 원래 ROOT 가 의도한 값으로 돌아온 것이지만
화면이 바뀌는 변경이다. 실측 표본(/privacy /apt /stock /blog, 인라인 font-size 414개 중
무공백 16개): 11개 요소가 커졌다 — 14px 4곳(12→16), 13px 2곳(12→15), 12px 1곳(11→14),
11px 4곳(10→13). 19px·28px 5+1곳은 해당 규칙이 없어 변화 없음

### 사용자 설정 동작 확인

| html 클래스 | 11px | 12px | 13px | 14px | 16px |
|---|---|---|---|---|---|
| (기본) | 13 | 14 | 15 | 16 | 16 |
| font-small | 10 | 11 | 12 | 12 | 14 |
| font-large | 15 | 16 | 17 | 18 | 20 |

세 상태 모두 무공백/공백 값이 같고, small/large 가 정상 동작한다 (수정 전에는 클래스를
무엇으로 두든 무공백은 항상 font-small 값이었다).

### Architecture Rule 추가
- #81 셀렉터 리스트에서 `html.font-*` 같은 상태 prefix 는 **콤마로 나뉜 선택자마다** 붙인다.
  한 곳만 붙이면 나머지가 전역 규칙이 되어 조용히 우선순위를 뒤집는다
## S6-2 (2026-08-21) — 잔여 전경색 토큰화 + S6 회귀 수정

- 사용자 화면 32건 21파일 + 어드민 8건 5파일 = 40건 교체.
  color: 지정만, background/border 는 미변경
- S6 회귀 4건 되돌림 (아래)

### 다크 배경 판정으로 제외 (파일을 열어 배경을 확인)
- components/apt/AptHero.tsx 2건 — 히어로 배경이 #0F0F0E 다크 잉크.
  #B4B2A9 는 그 위 보조 텍스트다
- components/signup/SignupPopupModal.tsx 1건 — #1a1030→#0F1729 다크 모달
- app/admin/NotificationBell.tsx 4건 — 드롭다운이 rgba(10,16,30,0.98) 다크 패널.
  현재 어디에서도 import 되지 않는 사문화 컴포넌트이기도 하다
- lib/og-tokens.ts 1건 · lib/constants.ts 5건 — 생성 이미지 팔레트 / 공용 상수라
  소비처 배경이 제각각이다. 지시서 목록에도 없어 미변경

### S6 회귀 4건 — 배경을 안 보고 hex 만 보고 친 결과
S6 커밋2 가 건드린 파일 전체를 다크 배경 기준으로 재점검했다.
- NotificationBell #60A5FA → var(--brand) 로 바뀌어 대비 5.9 → 2.6.
  var(--accent-blue-light)(같은 값)로 원복
- BlogFloatingBar 3건 — rgba(15,20,35,0.95) 다크 바 위. #f59e0b·#60a5fa·#22c55e 원복
- SmartSectionGate 2건 — rgba(12,21,40,0.97) 다크 게이트 위. #4ade80 로
- 두 파일에 다크 서피스 표식 주석을 남겨 다음 일괄 치환이 같은 실수를 반복하지 않게 했다

### Architecture Rule 추가
- #81 하드코딩 색의 대비를 잴 때 색 자체의 밝기를 먼저 본다. 밝기 0.45 이상인 값은
  어두운 배경 전용 텍스트이므로 밝은 배경 기준 대비가 낮게 나오는 것이 정상이며
  교체 대상이 아니다
- #82 색을 일괄 치환할 때는 hex 가 아니라 그 요소가 놓인 배경을 먼저 확인한다.
  다크 서피스가 남아 있는 화면(잉크 블록·모달·플로팅 바·게이트)에서는
  밝은 값이 정답이다

---

## S6 (2026-08-21) — 가독성 · 대비 · 폰트

- (A) 색 토큰 대비 교정 7종 + 추가 3건. WCAG 2.1 상대휘도 공식으로 재계산해
  --bg-base #F5F7FA / --bg-surface #FFFFFF / --bg-elevated #F0F2F5 셋 모두에서
  교체 후 최저 대비가 4.5:1 을 넘는 것을 확인했다
    --warning #D97706→#92400E(2.84→6.32) · --accent-yellow #CA8A04→#854D0E(2.62→6.11)
    --accent-orange #EA580C→#9A3412(3.17→6.52) · --accent-green #059669→#065F46(3.36→6.85)
    --accent-cyan #0891B2→#155E75(3.28→6.48) · --accent-red/--error #DC2626→#991B1B(4.31→7.41)
    --text-tertiary #6B7280→#556070(4.31→5.69)
- (B) 다크 전제 하드코딩 전경색 133건을 토큰으로. background/border 로 쓰인 같은 hex 는 미변경
- (C) globals.css 의 local() 전용 @font-face 삭제 (CDN 정의만 남김),
  --font-sans / --font-serif 정의 추가. 서체는 Pretendard 유지
- 죽은 다크 폴백 var(--token, #hex) 337건 66파일 제거 (S5-2 잔여분)

### 지시서 목록 밖이지만 함께 처리
- --success 도 #059669 였다. --accent-green 과 같은 값인데 텍스트로 5곳 쓰여서 같이 교정.
  안 고치면 같은 색이 곳에 따라 읽히고 안 읽히게 된다
- --blog-disclaimer-border 하드코딩 #D97706 → var(--warning) 참조.
  보더라 대비 대상은 아니지만 --warning 과 짝이라 값을 따라가게 뒀다
- (main)/page.tsx '오늘의 이슈' 라벨이 --accent-orange-light(2.50)를 텍스트로 쓰고 있어
  --accent-orange 로 교체 (지시서의 light 계열 조항)

### 제외 판정 (파일을 열어 배경을 확인)
- KakaoHeroCTA #34D399 — var(--ink-bg-deep) 잉크 블록 위 텍스트라 민트가 맞다
- SignupPopupModal #60A5FA — #1a1030→#0F1729 다크 모달 위 텍스트
- src/app/api/** · og-* · opengraph-image — ImageResponse 생성물
- --stock-up/--stock-down #DC2626/#2563EB — 국내 증시 색 관례라 별도 판단이 필요하다
- #fff·#FFFFFF·#FEE500 — 지시서 경고대로 대상 아님

### 남은 것
- 인라인 fontSize 3,064건 (14px 미만 2,093, 10~11px 1,158). 별도 과제
- #fbbf24·#fde047·#4ade80·#86EFAC·#FCA5A5·#FB923C 등 지시서 목록 밖 밝은 계열이
  텍스트로 남아 있다. 같은 검사를 다시 돌릴 필요가 있다

### Architecture Rule 추가
- #79 텍스트 색은 WCAG 4.5:1 을 --bg-base·--bg-surface·--bg-elevated 셋 모두에서
  충족해야 한다. Tailwind 400~500 계열은 밝은 배경에서 미달하므로 텍스트로 쓰지 않는다
- #80 웹폰트 @font-face 는 한 곳에서만 선언한다. 같은 family 를 중복 선언하면
  캐스케이드에 따라 로컬 전용 선언이 CDN 정의를 덮을 수 있다

### 다음 — 실기기 확인 필요
- 개발자도구 Network 에 pretendard woff2 가 받아지는지
- 상태 pill(접수중·임박)과 경고 문구가 이전보다 또렷한지
- 어두웠던 민트·연빨강 글자가 사라졌는지
## S4-2 (2026-08-21) — 리드폼 확장: 필드 4개 · 입력 예시 · 시인성 · 상단 앵커

- 필드 2 → 4. 필수는 이름·연락처 그대로. `birthDate` / `desiredType` 를 payload 에 추가하고
  미입력 시 빈 문자열로 보낸다 (null 처리는 서버)
- 희망 타입 선택지는 하드코딩하지 않고 모집공고 원본 `sub.house_type_info[].type` 의
  앞 숫자(전용면적)에서 파생해 `typeOptions` 로 내린다. 트라비스 = 59/74/84/101/133/155㎡.
  `apt_sites` 에는 area_types 류 컬럼이 없어 청약 공고 쪽을 원본으로 삼았다
- 전화번호 실시간 하이픈. 하이픈 위 백스페이스가 먹지 않는 문제를 따로 처리했다 —
  숫자 개수가 그대로인데 길이만 줄면 캐럿 앞 숫자를 대신 지우고, 서식 후 캐럿을
  "앞쪽 숫자 개수" 기준으로 되돌린다 (그냥 재서식하면 하이픈이 되살아나 안 지워진 것처럼 보인다)
- 생년월일은 선택 항목이라 비어 있으면 통과. 값이 있는데 6자리도 8자리도 아닐 때만 막는다
- 시인성: 2px `--kd-accent-border` 테두리 + 상단 `--kd-accent-bg` 밴드 + SectionHeader(NOTIFY)
  + 상하 2rem. 배경은 다른 카드와 동일한 `--bg-surface` 유지. 그라디언트·그림자·애니메이션 없음
- 생년월일·희망타입 2열, 480px 이하 1열 (S5 수렴 브레이크포인트 재사용, 신규 BP 없음)
- `LeadFormAnchor` 신설 — 히어로 아래 / 스펙 표 위 한 줄 진입 바. 하단 폼(`#lead-form`)으로
  smooth 스크롤 후 이름 칸 포커스. 상단에 폼 전체를 얹지 않은 이유는 컴포넌트 주석에 기재
- 앵커와 폼은 같은 조건(엔드포인트 + 대상 현장)으로 뜨고 같이 사라진다.
  페이지에 `showLeadForm` 단일 플래그를 두어 둘이 갈라지지 않게 했다

### 지시서와 달라진 곳

- **토큰 5개가 전부 미정의**였다: `--border-accent` `--bg-accent` `--text-accent` `--text-muted`
  `--font-size-heading`. 저장소 실재 토큰으로 대체 —
  `--kd-accent-border` / `--kd-accent-bg` / `--kd-accent` (AptPriceTrendCard·AptSidebar·
  AptCompareTable 이 이미 같은 용도로 쓰는 시그니처 앰버 세트), `--text-tertiary`, `--fs-*`.
  앰버라서 "빨강 계열 금지" 조건도 만족한다
- **제목은 `SectionHeader`(eyebrow + H2 24px/700)를 그대로 썼다.** 지시서의 18px/500 은
  미정의 토큰(`--font-size-heading`) 기준값인데, 같은 항목이 "S2 3단 리듬을 따른다"고도
  적혀 있어 페이지 전체가 쓰는 컴포넌트 쪽을 택했다. 본문보다 작아 보이던 문제는 해소됨
- **연락처 검증이 9자리 → 11자리로 강화됐다.** 지시서 메시지가 "11자리를 모두 입력해 주세요"
  라서 요구 자릿수를 11 로 맞췄다 (S4 는 9자리 이상이었음)

### 새로 발견한 기존 버그 (이번에 고치지 않음)

`globals.css` 인라인 font-size 스케일링(276~325행)의 `html.font-large` / `html.font-small`
블록에서 **콤마 뒤 두 번째 선택자에 prefix 가 빠져 있다.**

```css
html.font-small [style*="font-size: 12px"],
[style*="font-size:12px"] { font-size: 11px !important; }   /* ← 이 줄이 무조건부 */
```

공백 없는 변형이 전역에 걸리므로, 사용자가 어떤 글자 크기를 골랐든 **소스 순서상 마지막
무조건부 규칙(font-small)** 이 이긴다. 실측(`html` 클래스 없음): 12px→11px, 13px→12px,
16px→14px, 9px→13px(font-large 쪽). 전부 기본값이 아니다.

더 성가신 건 같은 값이 렌더 경로에 따라 갈린다는 점이다. SSR HTML 은 `font-size:13px`(공백
없음)로 나가 위 규칙에 걸리고, 클라이언트에서 React 가 건드린 뒤에는 CSSOM 직렬화라
`font-size: 13px`(공백)이 되어 ROOT 규칙(15px)에 걸린다. 실제로 이 폼에서 서버 렌더된 힌트는
11px, 제출 후 나타나는 오류 문구는 15px 로 서로 다르게 나온다.

`564f1e5a` "표기 불일치로 크기가 갈리던 문제" 가 잡으려던 바로 그 증상이고, 무공백 변형을
추가하면서 prefix 를 같이 안 붙인 것이 원인이다. 전역 타이포 blast radius 라 S4-2 범위에서
건드리지 않았다. 고칠 때는 두 번째 선택자에도 `html.font-small ` / `html.font-large ` 를
붙이면 된다 (14곳).

---

## S5-2 (2026-08-21) — 터치 타깃 · 컨테이너 폭 · 부수 정리

- (E) globals.css 에 .touch-target 유틸 신설 — 투명 ::after 로 히트 영역만 44px 확보.
  시각 크기는 그대로 둔다(height 를 키우면 헤더·툴바가 밀린다). 15개소 적용
- (F) --container-max: 720px 토큰 신설. 560 → 480(4건), 780 → 토큰(5건),
  900 → 토큰(5건), 960 → 900(2건). 1400·1200·480 미변경
- 서브픽셀 보더 0.5px → 1px 56건 27파일
- S1 잔존 다크 폴백값 145건 43파일 제거 + 직접 사용분 4곳 토큰화

### 900/960 판단 근거 (파일을 열어 확인)
- 900 유지 — apt/data · stock/data:
  auto-fit minmax(140px)/minmax(260px) 다열 데이터 대시보드. 720 으로 줄이면 열이 접힌다
- 720 으로 — apt/big-events(단일 ul 목록) · apt/redev · apt/redev/[region] 2곳
  (minmax(140px)/minmax(80px) 타일, 720 에서도 열수 유지) · calc(minmax(200px) → 3열 유지)
- 960 → 900 — apt/complex(도넛 svg + repeat(3,1fr) 스펙 표) · apt/map(지도는 넓을수록 유리)

### 지시서와 다르게 처리
- letterSpacing: 0.5px 23건은 1px 로 바꾸지 않았다. 자간이지 보더가 아니고,
  바꾸면 자간이 두 배가 되는 시각 회귀다. Rule #55~#62 는 보더 규칙이다
- ProfileTabs:161(스피너)·PortfolioTab:211(아이콘 컨테이너)은 onClick 이 없는
  비상호작용 요소라 터치 타깃 대상에서 제외
- BigEventCharts 의 maxWidth 560 은 컨테이너가 아니라 svg 차트 폭이라 제외
- api/apt-img/route.tsx 의 #0c1629 유지 — og-* 와 같은 ImageResponse 생성 이미지이고,
  프록시 이미지 뒤 레터박스 배경이라 다크가 의도된 값이다

### 남은 같은 계열 (다음 범위)
- var(--bg-elevated, #1f2028) · var(--bg-surface, #1a1b22) · var(--text-primary, #fff)
  같은 죽은 폴백이 어드민 위주로 남아 있다. 지시서 hex 목록 밖이라 이번엔 손대지 않았다
- D(인라인 fontSize 3,064건) 여전히 미착수

### Architecture Rule 추가
- #77 상호작용 요소의 히트 영역은 최소 44px. 시각 크기를 키우는 대신
  padding 또는 투명 히트영역(.touch-target)으로 확보한다
- #78 컨테이너 최대폭은 --container-max(720) 기준.
  어드민(1400)·앱셸(1200)·좁은 폼(480)·데이터 대시보드(900)만 예외로 허용한다

---

## S5 (2026-08-21) — 반응형 · 타이포 정합성

- (B) input/textarea/select 에 font-size: max(16px, var(--fs-sm)) 전역 적용.
  기존 하한은 @media (max-width: 640px) 안에만 있어 641px 이상 뷰포트에서는
  iOS 포커스 자동 확대가 그대로 일어났다. 기본 상태 값 변화 없음
- (G) SiteCard·SectionHeader 의 fontSize 11/18 하드코딩 → var(--fs-xs)/var(--fs-lg).
  SiteCard 에 width:100% + maxWidth:640 명시, @media (max-width:480px) 추가,
  next/image sizes 경계 640 → 767
- (A) 인라인 스케일링 규칙 22개에 공백 없는 표기 셀렉터 병기 +
  Tailwind text-xs·text-[Npx] 20종 스케일 규칙 추가 + JSX fontSize 표기 통일 211건
- (C) 브레이크포인트 15종 → 11종. 380·420·540 → 480 흡수,
  max-width: 768px → 767px 로 768 이중 적용 해소

### 감사 진단과 실측이 달랐던 것 (A)
지시서는 "JSX 의 `fontSize:13`(공백 없음) 표기가 매칭 안 된다"고 봤으나,
JSX 소스의 객체 키 뒤 공백은 렌더 결과에 영향이 없다. 실제 원인은 직렬화 경로 차이다.
`.next/server/app/*.html` 실측 결과 **SSR 은 공백 없이** `style="font-size:13px"` 로 내보내고,
CSSOM 을 거친 뒤에만 `font-size: 13px` 로 공백이 붙는다.
즉 기존 규칙 22개는 **SSR 상태에서 하나도 매칭되지 않았고** 하이드레이션 뒤에만 걸렸다.
같은 크기라도 요소·시점마다 결과가 갈리던 직접 원인이 이것이다. 두 표기를 모두 매칭하도록 고쳤다.

### 범위에서 뺀 것
- D(인라인 하드코딩 3,064건)는 지시서가 명시적으로 제외. 미착수
- max-width: 320px 6건은 유지. 380·420 처럼 480 으로 흡수하면 bottom-nav 9px,
  지역 타일 3열 같은 '극소 화면' 보정이 390~430px 일반 폰에도 적용돼 회귀가 된다.
  지시서 커밋 제목의 목표치(15종 → 11종)와도 일치한다
- 768/769·899/900·1200 정리는 지시서대로 2차로 미룸
- E(터치 타깃 46건), F(컨테이너 maxWidth 8종)는 이번 커밋 분할에 없어 미착수

### Architecture Rule 추가
- #75 신규 코드에서 인라인 fontSize 숫자값을 쓰지 않는다. var(--fs-*) 사용.
  기존 3,064건은 화면 단위로 점진 흡수
- #76 브레이크포인트는 480 / 767 / 768 / 1024 네 종을 기본으로 한다.
  max 와 min 경계가 같은 값으로 겹치지 않게 한다(767 ↔ 768)

### 다음 — 실기기 확인 필요 (코드로 판정 불가)
- iOS 입력창 탭 시 확대되지 않는지
- /apt/busan 360px 폭에서 카드 가로 넘침 여부
- 같은 카드 안 글자 크기 균일 여부 (커밋3 검증)
- PWA/앱인토스와 모바일 웹 비교 — 여전히 다르면 웹뷰 전용 CSS 존재

---

## S4 (2026-08-21) — 리드폼 P0: 관심 현장 알림 신청 (트라비스 단일 현장)

- `src/components/apt/LeadForm.tsx` 신설. 상세 페이지 FAQ 아래 / 관련 섹션 위에 삽입.
  슬러그 가드 `site?.slug === '엄궁역-트라비스-하늘채'` 는 P0 검증용 임시 코드 (P2 확산 시 제거)
- `NEXT_PUBLIC_LEAD_ENDPOINT` 미설정이면 컴포넌트가 null 반환 — 폼만 뜨고 제출이 실패하는 상태 방지
- Content-Type `text/plain;charset=utf-8` 고정. `application/json` 이면 OPTIONS preflight 가 발생하고
  Apps Script 는 OPTIONS 에 응답할 수 없어 CORS 로 전부 차단된다. `mode:'no-cors'` 도 쓰지 않음
- 허니팟(`company`)은 `display:none` 대신 화면 밖 배치 + tabIndex -1 + aria-hidden
- 임시 보관 `kd_lead_draft:{slug}` — 전송 성공 응답 이후에만 삭제. 미전송분은 `kd_lead_pending:{slug}`
  에 넣고 다음 마운트에서 조용히 1회 재전송 (UI 표시 없음)
- 재시도 300 → 900 → 2700ms. 3회 모두 실패해도 접수된 것처럼 안내하지 않음
- 개인정보처리방침 v2.1: 파기 절차·국외 이전(Google LLC, 미국)·광고성 정보 수신 3개 절 신설,
  수집 항목/목적/보유 기간(6개월)/정보주체 권리 연락처 보강. 13개 절로 재번호

### 지시서와 달라진 곳 (3건)

- **CSP `connect-src` 에 `script.google.com` + `script.googleusercontent.com` 추가** (middleware.ts).
  지시서에 없던 항목인데 이게 없으면 폼이 전혀 동작하지 않는다. 브라우저가 CORS 판정 이전에
  CSP 로 차단해 `TypeError: Failed to fetch` 가 난다 — Content-Type 을 아무리 맞춰도 소용없음.
  `/exec` 가 302 로 googleusercontent 로 넘기고 CSP 는 리다이렉트 홉마다 검사하므로 두 호스트 다 필요.
  헤드리스 실측으로 추가 전 `Failed to fetch` → 추가 후 200 + 본문 판독 확인
- **`--text-danger` → `--error`**. `--text-danger` 는 globals.css 에 없는 이름이라 그대로 쓰면
  값 없이 상속색으로 렌더된다 (Rule #94 재발). `bg-surface-2` 도 `--surface-2` 가 저장소 어디에도
  정의돼 있지 않아 `.apt-card` 관행대로 `--bg-surface` 사용
- **`ok:true` 만으로 성공 처리하지 않음.** 서버는 필터에 걸린 요청도 200 + `ok:true` 로 답하고
  `skipped` 사유만 덧붙인다 (실측 `{"ok":true,"skipped":"too_fast"}`). ok 만 보면 걸러진 신청이
  접수된 것으로 안내된다. `skipped` 를 판정에 포함하고, 서버가 판정을 내린 건은 재시도하지 않음
  (거절된 payload 가 pending 에 영구 잔존하는 것도 함께 차단). 허니팟만 예외로 성공 화면 유지

### 알려진 제약

- 오류 메시지는 13px 로 작성했으나 globals.css:274 의 접근성 하한(`[style*="font-size: 13px"]` → 15px)
  으로 15px 렌더된다. 저장소 전역 규칙이라 `!important` 로 뚫지 않고 그대로 둠
- `/apt/[id]` 는 로컬에서 전부 404 (`.env.local` 의 service-role 키가 placeholder). 트라비스 페이지
  렌더 확인은 배포 후에만 가능. 컴포넌트 자체는 /privacy 에 임시 마운트해 헤드리스로 30항목 검증 후 복원

---

## S3 (2026-08-21) — 큐레이션 카드 · 위성 히어로 · 부산 허브

- SiteCard 신설. 히어로는 satellite_image_url 하나만(16:10), 폴백 배경 var(--bg-elevated).
  상태 pill 은 --status-fcfs/open/soon/closed, 숫자는 --font-mono + tabular-nums,
  next/image + sizes 로 카드 폭만 요청
- 위성이 없는 현장은 빈 이미지 슬롯 대신 SiteRow(표 행). 오티에르 해운대가 현재 여기 해당 —
  apt-satellite-crawl 크론(30분 주기)이 채우면 자동으로 카드로 승격된다. 코드 특별 처리 없음
- /apt/busan 큐레이션 허브 신설. is_curated=true AND region='부산' 기준.
  상태 필터 탭(전체/선착순/분양중/분양예정), 청약홈 파생 목록, 부산 분양 분석 3섹션.
  큐레이션 0건이면 섹션 미렌더. ISR 900 + 데이터 레이어 unstable_cache(/apt 와 동일 구조)
- Disclaimer 의 apt/unsold/redev/trade/general source 에 VWorld 출처 추가

### 지시서와 다르게 처리
- Disclaimer 의 compact 모드는 source 를 아예 렌더하지 않던 구조라, 그대로 두면
  위성을 쓰는 화면에서 출처 표기가 통째로 사라진다. compact 에서도 source 가 나오도록 고치고
  /apt/busan 은 non-compact 로 뒀다
- SiteCard 주석의 '조감도' 표기를 '시행사 완공 예상도'로 바꿨다 (지시서 검증 grep 이 0 을 기대)

### Architecture Rule 추가
- #71 현장 히어로 이미지는 satellite_image_url(VWorld 자체 호스팅)만 사용한다.
  조감도는 시행사 저작물이며 외부 스크랩·임의 생성 모두 금지.
  images 배열은 출처 혼재·오매칭이 있어 히어로로 쓰지 않는다
- #72 타사 데이터를 화면 전면에 쓰면 출처 표기를 같은 화면에 함께 낸다.
  표기가 렌더되지 않는 경로(compact 등)가 없는지 확인한다

### 다음
- 오티에르 해운대 위성 확보 후 /apt/busan 카드 2장 확인
- 큐레이션 현장 확대 시 /apt/{region} 큐레이션 허브 일반화 검토

---

## S2-잔여 (2026-08-21) — 이모지 · 카카오 CTA · https 승격

- 상세 페이지 이모지 122자 → 3자. 남은 3개는 지도(카카오/네이버)·청약홈 원문 링크분으로 의도적 유지
  - 섹션 h2 8개를 SectionHeader eyebrow 로 교체: SUPPLY/LOCATION/SCHEDULE/NOTICE/COMMENTS/FAQ/ANALYSIS/NEARBY
  - eyebrow 문구가 지시서에 없는 나머지 h2 9개는 이모지만 제거하고 apt-section-title 유지
  - 데이터 라벨 이모지 47줄 제거. KpiCards.icon 필드, tier.emoji, devType.icon,
    categoryIcons 맵은 필드째 삭제 (빈 문자열을 남기지 않음)
  - 아이콘 라이브러리 신규 도입 0건
- 카카오 채널 ID 를 constants 단일 출처로: KAKAO_CHANNEL_ID / _URL / _CHAT_URL
  KakaoChannelAddModal · MarketingConsentModal 이 import 하도록 변경 (같은 값 2곳 박힘 해소)
- 상세 보조 CTA 추가: InterestRegisterHero 안에 '카카오톡 문의' 텍스트 링크
  (pf.kakao.com/_NFxdxhX/chat). 주 CTA(관심 등록)와 경쟁하지 않도록 버튼이 아닌 링크
- layout.tsx Organization JSON-LD sameAs 의 pf.kakao.com http → https. 전수 확인 결과 이 1건뿐

### Architecture Rule 추가
- #73 이모지를 UI 라벨·아이콘으로 쓰지 않는다. OS별 렌더가 다르고 스크린리더가 오낭독한다.
  외부 링크 식별용은 예외
- #74 외부 서비스 식별자(채널 ID·계정 ID)는 constants 한 곳에서만 정의한다

---

## S2 (2026-08-21) — 카드 · 진행 눈금자

- LifecycleRail 신설. 단계 결정 우선순위: apt_subscriptions 날짜 파생 > lifecycle_stage > 미표시.
  날짜 비교는 'YYYY-MM-DD' 문자열 사전순 (Date 객체 UTC/KST 밀림 회피)
  레일 미표시 site_type: unsold_active / landmark_active / active_trade / redevelopment_active
- SectionHeader/SectionLink 신설. /apt 4개 섹션을 eyebrow(Mono·uppercase·--brand) + H2 + 텍스트링크로 통일
- SubscriptionCard/AptCardCompact 하단에 미니 레일, 숫자에 --font-mono + tabular-nums
- subscription-badge: hex 12개 제거 → 상태 토큰(--status-open/soon/fcfs/closed) 매핑
- 상세 페이지: H1 2개 → 1개(AptHero h1 → div), 세대수 5회 → 규모/일반분양 2행(공급 정보 표),
  일정 3벌 → 풀 레일 1 + 날짜표 1, 관심등록 전체 폼(알림·가점)은 접이식으로 하단 이동
- CARDERA → KADEORA 오탈자 2건 수정 (AptPriceTrendCard, LifecycleTimeline)
- 분양가 미공개 시 지역 평균 대체값 제거 — 하이엔드 현장에 지역 전체 평균을 붙이면 오정보

### 지시서와 다르게 처리
- var(--rule) 은 정의된 적 없는 토큰이라 기존 var(--border) 사용 (신규 색 도입 0건 규칙 준수)
- '카카오톡 문의' 보조 CTA 는 채널 URL 이 코드베이스에 없어 신설하지 않음.
  기존 KakaoDirectShare 를 그대로 두고, 나머지 CTA 만 접거나 하단 이동
- /apt 섹션 제목에는 원래 이모지가 없어 제거할 대상이 없었음 (상세 페이지 h2 이모지는 S2 범위 밖)

### Architecture Rule 추가
- #71 생애주기 단계는 저장값보다 일정 날짜에서 파생한 값을 우선한다. 둘 다 없으면 렌더하지 않는다
- #72 같은 사실(세대수·일정)은 한 화면에서 한 번만 표기한다. 중복은 정보가 아니라 소음이다

### 다음
- S3에서 조감도/이미지 데이터 확보 후 카드 이미지 슬롯 추가
- 상세 페이지 나머지 h2 이모지 정리

---

## S1 (2026-08-21) — 라이트 단일 모드 전환

- globals.css: html.theme-light(91) / html[data-theme="light"](22) 변수 블록을 :root로 승격(113건 덮어쓰기).
  남은 html.theme-light 오버라이드 45건은 선택자에서 테마 클래스만 떼어 무조건 적용으로 승격(파일 끝 배치),
  html.theme-light.dark 2건은 사문화되어 삭제. theme-light/data-theme 잔여 0
- 신규 토큰: --ink-*(5) / --status-*(4) / --rail-*(5). 신규 색상 도입 0건 (기존 다크값 승계 또는 var() 참조)
- ThemeProvider.tsx 삭제. layout의 kd_theme 부트스트랩 스크립트·래퍼 제거 → FOUC 소멸.
  themeColor 메타 정적 #F5F7FA 고정
- Navigation: 테마 전환 UI 1곳·토글 버튼 2곳·useTheme·data-theme 강제 제거
- TossModeInit: data-theme 강제 제거 (toss-mode 클래스만 유지)
- apt-tabs.css: [data-theme="dark"] 2블록 + prefers-color-scheme:dark 2블록 삭제
- dark: 변형 184개 토큰 제거(14파일). 사전 점검에서 고아 dark: 0건 확인 —
  라이트 모드 렌더 결과와 동일
- PageViewTracker: theme_mode 를 localStorage.kd_theme 기반으로 변경 (light/dark/unset).
  테마 클래스 소멸로 기존 판별식이 항상 dark를 반환하게 됐고, 토글은 없앴지만 kd_theme 값은
  브라우저에 남아 있어 기존 사용자 선호 분포를 계속 수집할 수 있음
- --kakao-bg/--kakao-text는 카카오 브랜드 고정색이라 미변경
- (후속) layout.tsx의 `<html className="dark">` 제거 + 사문화된 `.dark` 규칙 39건 삭제.
  ThemeProvider가 라이트 선택 시 dark 클래스를 떼주던 구조였는데 Provider만 지워서
  다크 전용 보정 39건이 라이트 화면에 상시 적용되던 상태였음.
  특히 [style*='color:#991B1B'] → #F09595, [style*='color:#7F1D1D'] → #F4A4A4 2건은
  밝은 배경에서 가독성 파괴. tailwind.config.ts의 darkMode:'class'는 dark: 변형 0건이라 유지
- (후속2) 다크 잔재 전수 정리:
  - manifest.json theme_color/background_color #08102A → #F5F7FA (PWA 스플래시·주소창이 다크였음)
  - FirstMissionBanner #10B981 → var(--accent-green). 흰 배경 대비 약 2.4:1로 WCAG AA 미달이었음
  - KakaoHeroCTA #050A18 → var(--ink-bg-deep), NoticeBanner #120E16/#050A18 →
    var(--ink-bg)/var(--ink-bg-deep). 의도적 잉크 블록이라 값 유지하고 토큰화만
  - 낡은 다크 폴백값: SmartSectionGate #050A18, InAppBrowserModal #0d0e14/#2a2b35(2곳) 교체
  - 이미지 플레이스홀더: AptImageGallery 폴백 카드·갤러리 컨테이너, .hero-img → var(--bg-elevated).
    폴백 카드는 흰 텍스트 전제였으므로 텍스트도 var(--text-primary)/var(--text-tertiary)로 함께 전환.
    .hero-img::after 어두운 오버레이는 이미지 위 텍스트 가독성용이라 유지
  - InterestRegistration 생년월일 input colorScheme 'dark' → 'light'

### Architecture Rule 추가
- #68 테마는 라이트 단일이다. dark:, prefers-color-scheme, data-theme, theme-light 를 새로 쓰지 않는다
- #69 의도적으로 어두운 서피스는 --ink-* 토큰을 쓴다. 하드코딩 hex 금지
- #70 테마 장치를 제거할 때는 클래스를 붙이는 쪽(layout)과 그 클래스에 걸린 CSS 규칙을
  함께 확인한다. Provider만 지우면 클래스가 영구 고착된다

### 다음
- 배포 후 라이트 렌더 육안 확인 (피드·단지 상세·블로그·검색·어드민)
- theme_mode 는 light/dark/unset 3값. unset = 한 번도 테마를 바꾼 적 없는 사용자

---

## S0 (2026-08-21) — 색인 차단 해소

- apt/[id]: APT_COLS에 data_quality_score 누락 → 상세 약 5,800개 전부 noindex였음. 해소
- apt/region/[region]: generateStaticParams 사전 인코딩 → 지역 허브 17개 404였음. 해소
- PageViewTracker에 theme_mode 계측 추가 (S1 착수 판단용)
- tailwind.config.js 삭제, BOM 정리, check:bom 스크립트 추가

### Architecture Rule 추가
- #63 select()에 없는 컬럼을 as any로 읽지 않는다. 조건 분기에 쓰는 컬럼은 반드시 조회 목록에 포함
- #64 generateStaticParams는 디코딩된 원본 값을 반환한다. 인코딩은 Next.js가 한다
- #65 설정 파일은 확장자 하나만 유지한다
- #66 모든 텍스트 파일은 BOM 없는 UTF-8. npm run check:bom으로 검사
- #67 generateStaticParams 수정 시 대상 배열의 실제 내용과 가드 조건을 함께 확인한다. tsc 통과는 빌드 성공을 보장하지 않는다

### 다음
- S0 배포 후 라이브 검증 (아래 명령)
- 14일간 GSC 노출수 관찰. 감소 시 중단·재논의
- ~~theme_mode 수집 1주 후 S1 착수 판단 (다크 25% 초과 시 중단)~~ →
  계측 당일 착수했으므로 사전 데이터 없음. localStorage.kd_theme 기반 사후 관측으로 대체.
  롤백 지점 pre-s1-20260821.

---

## [s270] 2026-08-15 — 전수조사 후속: OG dynamic font 400 근절 + 로그 통합 + related-blogs 재시도

**배경**: Vercel 런타임 에러 7일 전수조사에서 `/api/og-apt` "Failed to load dynamic font for ●"
400 에러 5,758회(1,696 users) + `�` 변형 934회(og-blog/apt/square/infographic) 확인.
DB측 조치(autopublish 함수 패치·발행 3편 복구, fn_cron_failure_watch 신설, 크론 130/145
스케줄 분산)는 웹 채팅 세션에서 Supabase 직접 수리 완료 — 이 커밋은 코드측 수정분.

**수정**:
1. `og-apt/route.tsx` — PLACE 카드에 하드코딩된 글리프 `●` 제거 → 순수 CSS 원으로 대체.
   NotoSansKR-Bold.woff 서브셋에 U+25CF가 없어 satori가 매 렌더마다 Google Fonts dynamic
   fetch(400)를 시도하던 것이 5,758회 에러의 근원. sanitizer는 데이터만 거르고 템플릿
   자체 글리프는 못 거른다. (Rule #47 확장: 도형도 글리프 대신 CSS)
2. `og-square/route.tsx`, `og-infographic/route.tsx` — `sanitizeForOG` 미적용 라우트에 적용
   (title/items). `�` 계열 dynamic font 400 차단.
3. `og-stock/route.tsx` — 매 요청 DIAG console.error → console.log 강등 (주 ~2,000행이
   에러 클러스터 오염). 80자 chunk 분할 에러(m0~/s0~) → 2행 통합.
4. `og/route.tsx`, `og-apt/route.tsx` — 동일하게 chunk 분할 로그 → 3행 통합 (에러 그룹
   15개 → 3개로 수렴, 행당 300자는 Vercel 4KB 행 제한 내 안전).
5. `lib/apt/related-blogs.ts` — 'TypeError: fetch failed'(7일 106회, 일시 커넥션 실패)에
   1회 재시도(300ms 고정 지연) 추가. 폭주 방지 위해 재시도 1회로 제한.

**미수정**: url.parse DEP0169 경고는 web-push@3.6.7 의존성 내부 — 자체 코드 아님, 무해.

**검증**: `npx tsc --noEmit` 0 에러. 배포 후 확인 필요: /api/og-apt?card=place 렌더(CSS 원),
Vercel 에러 클러스터 og-apt font 400 소멸 여부(24h), [og-stock] DIAG error 레벨 소멸.

**남은 사용자 조치**: Anthropic API 크레딧 충전(issue-draft 7/31부터 정지), Kakao geocode
키 403 원인 확인, GitHub PAT 로테이션(remote 평문 ghp_ revoke).

---

## [Phase 0 후속] 2026-08-05 — naver-cafe-publish 코드 삭제 (Rule #19 3중 확인 완료)

이전 Phase 0 진단([Phase 0] 항목 참조)에서 `naver-cafe-publish`가 oauth_tokens 미시딩으로
영구 no-op임을 확인 후, 사용자 지시로 관련 코드 전체 삭제.

**Rule #19 3중 확인**: pg_cron 등록 0건(vercel.json 크론으로만 존재) / cron_logs 30일 36회
실행(전부 oauth_not_configured no-op) / src grep로 호출부 전량 확인 후 진행.

**삭제**:
- `src/app/api/cron/naver-cafe-publish/route.ts` (크론 라우트 본체)
- `src/lib/naver/cafe-client.ts` (`postCafeArticle` — 삭제 후 사용처 0건 확인)
- `src/lib/naver/cafe-html.ts` (`toNaverCafeHtml`/`appendSourceBox` — 사용처 0건 확인)
- `vercel.json` 크론 엔트리 1건 (100→**99개**)
- `god-mode/route.ts` 수동 트리거 목록의 항목 1줄

**부분 수정 (유지 범위 명확화)**: `admin/naver-oauth/route.ts`는 provider-agnostic 공용 OAuth
관리 라우트(GET/POST/PUT refresh/DELETE)라 대부분 유지, `action==='test_post'` 분기(naver_cafe
전용 테스트발행 + `postCafeArticle` import)만 제거. `lib/naver/oauth-store.ts`는 공용 모듈이라
미변경.

**미변경 (지시 범위 밖)**: `naver_syndication`/`oauth_tokens` 테이블 데이터, `admin/naver-syndication/*`
큐 조회 라우트(별개 기능).

**검증**: 잔여 grep(`naver-cafe-publish|cafe-client|cafe-html|postCafeArticle|toNaverCafeHtml|
appendSourceBox`) 0건. `npx tsc --noEmit` 관련 에러 0(기존 미설치 패키지 에러 14건은 무관).
vercel.json 크론 100→99개.

---

## [Phase 0] 2026-08-05 — naver 신디케이션 사망진단 + 색인현황 + 404분류 + 슬로우크론 완화

### 1. naver_syndication 04-20 중단 — 원인 2건 확정 (복구는 자격증명 필요 — 미실행)
- **naver-blog-content (적재 크론)**: `fc12668b`(04-12)에서 **의도적 제거** — Vercel Pro 크론 100개
  한도 초과로 `blog-publish-queue + IndexNow` 대체 전략 채택. pg_cron/vercel.json 어디에도 등록 없음
  (grep 3중 확인: cron.job 0건, vercel.json 0건, god-mode 관리자 수동트리거만 잔존). 04-20 이후 신규
  행 0건은 이 의도적 폐기의 자연스러운 결과 — **버그 아님**.
- **naver-cafe-publish (발행 크론)**: pg_cron 없이 vercel.json `0 9,21 * * *`로 지금도 정상 실행 중이나
  `records_processed=0`이 매 실행 "success"로 기록(72회+ 연속 확인). 실제 원인: `oauth_tokens` 테이블에
  `naver_cafe` 행이 0건 → `getValidAccessToken()`이 null 반환 → `oauth_not_configured`로 조용히 no-op.
  cafe_pending 51건 / blog_pending 57건이 무기한 대기 중.
  **자격증명은 실재함** — Vercel prod env에 `NAVER_CAFE_ACCESS_TOKEN`/`REFRESH_TOKEN`/`CLIENT_ID`/
  `CLIENT_SECRET`/`ID`/`MENU_ID` 전부 등록(115일 전) 확인. 코드가 env 대신 DB(`oauth_tokens`)만 읽도록
  리팩터된 이후 그 값들을 DB로 옮기는 단계가 누락된 것으로 추정.
  **복구 미실행**: `vercel env pull`로 평문 시크릿을 읽어 DB에 INSERT하는 절차가 안전 classifier에
  의해 차단됨(정상 동작) — 시크릿 노출 우회 시도 안 함. **사용자가 어드민 NaverPublishTab에서
  재등록**하거나, 직접 `vercel env pull` 후 `oauth_tokens` upsert 필요.

### 2. 네이버 색인 현황 — 조회 불가 확정 (자격증명 완전 부재)
- `naver-sc-sync`(jobid 141, 매일 실행)가 72회+ 연속 `naver_sc_credentials_missing`로 실패.
- `naver_sc_daily` 테이블 **완전히 비어있음**(max_date NULL) — 단 1회도 성공 적재된 적 없음.
- `vercel env ls production` 확인: `NAVER_SC_CLIENT_ID`/`NAVER_SC_CLIENT_SECRET`/`NAVER_SC_PROPERTY_ID`
  **전부 미등록**(`NAVER_CLIENT_ID`/`SECRET`은 존재하나 코드가 요구하는 변수명과 다름 — 별개 항목).
  → Search Advisor Open API 자체를 호출할 자격증명이 없어 현재 색인 수 조회 불가. 네이버 서치어드바이저
  사이트 등록 + Open API 키 발급이 선행되어야 함(사용자 액션).

### 3. 404 분류 (24h, Vercel runtime logs, top requestPath 1211종)
- **봇/스테일크롤 (다수, 조치 없음)**: `/apt/complex/{"url":...,"source":"naver",...}` 계열
  (137/52/21/... 건) — DB(`apt_sites`/`apt_complex_profiles`) 실측 결과 현재 데이터에 이런 JSON
  오염 0건, edge-middleware가 `cache=HIT`으로 응답 — **과거에 이미 고쳐진 버그의 잔여 크롤 트래픽**.
  현재 코드가 재생산하지 않음 확인 → 방치.
- **내부링크 깨짐 (수정 완료, 아래 참조)**: `/apt/subscription`(단수, id 없음) 14건 — 페이지 자체가
  존재하지 않는데(`/apt/[id]`만 존재) `BlogMentionCard.tsx` 2곳이 하드코딩 링크.
- **기타 (조치 안 함, 범위 밖)**: `/apt/null`, `/null`, `/daily/전국` 등 소량 — 개별 추적 필요하나
  이번 세션 범위(내부링크 카테고리) 밖.

**수정**: `BlogMentionCard.tsx` 두 곳의 "청약 일정 보기" CTA `href="/apt/subscription"` →
형제 링크와 동일한 region-aware `/apt` 링크로 교체(사이트에 청약 전용 페이지가 없고 `/apt`가
청약·미분양·재개발 통합 허브임을 확인). 동일 원인으로 신규 발행 블로그 글에 계속 주입되던
`/apt/subscriptions`(복수, 이 역시 미존재 경로) 링크를 생성하는 6개 콘텐츠 크론
(`blog-life-guide`×6, `blog-competition-rate`, `blog-comparison`, `blog-builder-analysis`,
`blog-district-guide`, `blog-invest-calendar`)도 `/apt`로 정정 — 향후 생성 글부터 반영
(기존 발행 글 `blog_posts` 데이터는 미수정, 지시사항 준수).

### 4. 슬로우 크론 완화 (pg_cron, 삭제 없음)
- `replace_blog_body_og`(jobid 125): 평균 4.9s/최대 12s, `*/15 * * * *`(96회/일) → **`*/60 * * * *`**(24회/일).
- `refresh-mv-seo-portal-stats`(jobid 53): 평균 9.5s/최대 12.5s, `40 */2 * * *`(12회/일) → **`40 */6 * * *`**(4회/일).
- 검증: `cron.job` 재조회로 두 schedule 반영 확인.

### 검증
- `npx tsc --noEmit`: 수정 파일 7개 관련 에러 0건 (기존 미설치 패키지 에러 14건은 무관 pre-existing).
- `git diff --stat`: 7 files changed, 13(+)/13(-) — 지시 범위 내 최소 변경.

---

## [ByteString 종결 실증] 2026-07-19 — 한글 슬러그 55%(5,149건) 경로 차단 확인

사용자 DB 교차: 발행글 9,389 중 한글 슬러그 5,149(54.8%). 이 전부에 아침 수정
(encodeURIComponent)이 실제 적용되는지 실증:
- **48/48 real**: og-blog(4 슬러그×카드1~6) + og-apt(구버전서 ByteString 났던 서초자이르네·
  목포-수창해뜨레 등 4×6) 전부 200 + fallback 아님. 응답헤더 raw 非ASCII 0.
- **로그**: 수정 후 구간(01:14Z~, ee1d76a2 배포 00:40Z 뒤) ByteString **0건**. 로그에 보이던
  ByteString 에러(og-blog/og-apt 대량)는 `group_by deploymentId`로 갈라보니 전부
  **구버전 dpl_BwbYfaPp(f4eecf0d, 수정 전)** + 타임스탬프 00:40Z 이전. lookback 윈도우에 옛
  배포가 남아 "아직 뜨는 것처럼" 보였을 뿐.
- 교훈: 로그 에러는 결론 전에 **deploymentId로 귀속** + since를 fix 시점 이후로 잘라 확인.
- 잔여: 구버전이 2h 내 소량 트래픽(10건, 전부 pre-fix). 크롤러 캐시 → 네이버/카톡 강제 재크롤 권장.

---

## [OG 네이버 최적화 전수조사] 2026-07-19 — 오진 정정 + 실결함 2건 수정 (commit 4737c3bd)

지시서 최우선 가설(og:image 상대경로 → "소스 노출")은 **오진**. claude.ai 가 egress 차단
(403 allowlist)으로 DB의 `og_cards.url`(100% 상대경로 `/api/og-blog?..`)만 관측했으나,
CC 로컬 실렌더(egress 정상)로 실제 배포 HTML `View Source` 검증:

- **og:image 는 모든 페이지 타입에서 이미 절대경로**. `generateMetadata` 가 `c.url.startsWith('http') ? c.url : ${SITE}${c.url}` 로 절대화(`SITE_URL=https://kadeora.app`). 실측:
  blog=`https://kadeora.app/api/og-blog?..`(630×630), apt/complex=절대 실사진, apt/[id]=`${SITE_URL}` 프리픽스. → **상대경로 결함 없음**. "소스 노출"은 ByteString-era fallback(직전 `ee1d76a2`로 해결) 잔상으로 추정.
- **네이버 1:1 크롭도 비이슈**: og-blog 는 이미 `SIDE=630` **630×630 정방형**, 제목 세로 중앙 밴드. 6-card 글(백필 후 100%)은 정방형 cover 가 첫 이미지(primary). 크롭 손실 없음.

실제 결함 2건만 수정:
1. **전역 og:image 치수 충돌** — `layout.tsx` `other` 의 `name="og:image:width"=1200/height=630/alt`
   3줄 제거. 페이지별 openGraph.images 가 내보내는 `property="og:image:width"=630`(정방형)과
   **모든 페이지에서 공존·충돌** → 크롤러가 landscape 로 기대해 정방형 카드 letterbox/오크롭 위험.
   치수는 이미지별로 이미 정확 제공 → 전역 강제는 불필요·유해. (실측: 라이브 HTML 에 두 세트 공존 확인)
2. **커버 가독성** — og-blog `renderCover`: 제목이 남는 세로공간 채워 정중앙(flex:1+center),
   폰트 상향(30~70 → 38~78). 네이버 검색결과 ~120px 축소 실측(sharp 다운스케일)에서 제목 비중 상향.

검증: blog/apt/apt-complex og:image 라이브 grep(전부 https://), og-blog card 1/2/6 실렌더 캡처
(x-og-fallback none — ByteString 수정 유지), 120px 썸네일 다운스케일 캡처, tsc exit 0.
(로컬 full build 는 .env.local 에 Supabase 키 부재로 prerender 단계만 실패 — 코드 컴파일 정상, Vercel 정상.)

---

## [OG 전수조사] 2026-07-19 — ByteString 버그·OG 개선·og_cards 백필

1. **IndexNow speedup 원복**: batch pg_cron `2-59/10`(10분) → `5,35`(30분). 드레인 완료(failed 0).
2. **OG ByteString 버그 (최우선)** — `ee1d76a2`: `/api/og-blog` 등이 200 반환하지만 응답 헤더
   `X-OG-Slug`에 한글 슬러그를 raw 로 넣어 `Cannot convert to ByteString (45908)` throw → catch →
   **fallback 이미지(숨은 실패)**. 헤더는 ByteString(0-255)만 허용. 쿼리 파생 헤더값(slug/symbol/card)을
   `encodeURIComponent`로 감쌈 — og-blog/og-apt/og-stock/og. 이미지 본문(satori) 한글은 정상, 헤더만.
   실측 검증: 한글 슬러그 글 → fallback 헤더 사라지고 real 이미지 반환.
3. **OG 개선** — `e075f554`: og-blog `renderCover`(공유 메인 카드) — 브랜드 마크(우상단 고정),
   반응형 제목 7단계(44자+ 대응), 제목 그림자. before/after 실렌더 비교 완료.
4. **og_cards 백필** — `3dfab7e3` + SQL(MCP): 발행글 26%(2,463)가 `og_cards='[]'`로 발행됨 —
   **생성 코드가 아예 없었음**(6,926은 일회성 백필, 이후 전부 빈 채). 근본 수정:
   - `src/lib/blog-og-cards.ts` `buildBlogOgCards(slug,title)` — 기존 6-card 구조 결정적 재현.
   - `/api/cron/blog-og-cards` — 빈 og_cards 채우는 크론(신규글 대응) + `og_cards_updated_at` 기록.
     pg_cron `blog_og_cards` (jobid 159, 매시 :47) 등록.
   - SQL 백필: 2,463 전량 populated(has_cards 9,389, empty 0) + og_cards_updated_at 전량 채움(NULL 0,
     기존 6,926은 published_at 프록시).
5. **배너 최종본**: design D(항상고정 + "부동산 정보 공유방" + fixed z-[110]) 이미 라이브(`fe7324c1`).
   할 일 없음 — MEMBER_COUNT 실값만 사용자 몫.

DB 쓰기는 사용자 승인 하에 CC가 Supabase MCP `execute_sql`로 실행(IndexNow 리셋 + og_cards 백필 + pg_cron).

---

## [P0 indexnow + P1 banner-D] 2026-07-18 — 전수조사 후 유일 미해결(IndexNow) 수정

### P0 — IndexNow 71일 조용한 실패 수정 (commit 003a3924)
증상: indexnow-urgent 가 9ms 에 `submitted:100` 반환하는데 실제 제출 0, urgent pending
154건 attempt_count=0. 앱 코드 근본원인 2개 (DB 결백 — claude.ai 실측):
1. `lib/indexnow.ts` 가 `INDEXNOW_KEY || ''` (fallback 없음) → env 미설정 시 submitIndexNow
   가 no-op(9ms). **호스팅 키 `3a23def313e1b1283822c54a0f9a5675`**(public/*.txt=200,
   indexnow-full-sweep/mass 가 쓰는 키)를 fallback 으로. 라이브 포털 실측: api.indexnow.org
   200 / bing 200 / naver 422(포털측). → 이 lib 를 쓰는 모든 호출부(blog-publish-queue,
   issue-draft, api/indexnow, indexnow-backfill, issues/publish)도 동시 복구.
2. 라우트가 `status:'sent'` 기록 — CHECK(pending/submitted/success/failed/skipped)에 없어
   UPDATE 가 조용히 실패 → 행이 pending/attempt_count=0 에 영구 고착, 그런데도 라우트는
   submitted:urls.length(가짜 성공) 반환. (s258 회귀: 주석에 'submitted'→'sent' 로 바꿨다고
   명시돼 있음.) → 되돌려 `submitted`, 실제 포털 결과로 `submitted`/`failed` 확정.
- submitIndexNow 가 `{ok,accepted,attempted}` 반환하도록 변경(하위호환, 기존 호출부 영향 0).
- 검증: 키·포털 수락 curl 실측(indexnow.org/bing 200, naver 422) + type-check/build.
  **큐 status 전이 + net._http_response 는 claude.ai 가 프로덕션에서 검증**(로컬 env 없음).
- env `INDEXNOW_KEY`: **미설정 확정**(9ms no-op = 빈 키 early-return 근거). fallback(호스팅 키)로
  해소. 유지보수 위해 Vercel env 등록 권장(선택). 검증파일 public/3a23…675.txt=200.
- **키 resolve 직접 실측**(임시 진단 endpoint 39ab9315→365b64a1 즉시 삭제·404 확인):
  env `INDEXNOW_KEY` **설정됨 + 값=`3a23de…5675`(올바른 키)**, resolved 키의 .txt=200 +
  내용 byte-exact 일치. **no-op 위험 없음 확정**. (사용자 우려 "env가 옛 키로 오버라이드"는 반증)
- **staged 검증 통과**(49e58ba7, BATCH_SIZE 10): submitted 2,214→2,379(+165), last_submit
  5/08→오늘, status 실제 전이. 포털 실측 indexnow.org/bing 200. → **BATCH_SIZE 100/500 복원**(8821078c).
- **dedup(옵션 A)**(8821078c): `UNIQUE(url,status)` 충돌 — pending 을 submitted 로 UPDATE 시
  같은 url 의 submitted 쌍둥이(71일 반복 큐잉, 3,519 dup 중 78~79 pending stuck)와 (url,submitted)
  중복 → UPDATE 막힘. **성공 시 쌍둥이 있는 pending 은 UPDATE 대신 삭제(이미 색인됨), 나머지만
  submitted 로 UPDATE.** 응답 `{submitted, deduped}`.

### 검증 현황 (2026-07-18 ~06:00 claude.ai 실측)
- ✅ **urgent pending 154 → 0** (전부 처리 완료), submitted +165, last_submit 71일 만에 오늘 갱신.
- ✅ 키 resolve 검증 통과 + 진단 라우트 삭제(404) 확인. 배포 `053169be`(dpl_7FWM/9YC3) 반영 중.
- ❌→✅ **06:05 batch(500) 실패 → 원인·수정 완료**(a19b55bc): 응답 `{submitted:500,deduped:0}`
  지만 records_updated=0, pending 안 줄고 attempt_count=0. **근본원인**: dedup twin 조회
  `.in('url',[500 긴 URL])` 가 PostgREST URI 길이 한도(~8KB) 초과 → 빈 결과 → twin 79건 놓침
  → UPDATE 가 500건 전부 submitted 시도, 79건 `(url,submitted)` UNIQUE 충돌 → **원자 UPDATE
  전체 실패 → 드레인 0**. urgent(100)는 한도 안이라 정상이었음(SELECT/WHERE 자체는 정상).
  → **수정**: `markIndexNowSubmitted()` 공유 헬퍼가 **50개씩 청크**로 dedup+UPDATE+DELETE
  (`.in()` URI 안전) + **실제 처리 건수 반환**. `accepted`→`portals_ok`(URL 아니라 엔드포인트 수) 개명.
- ✅ **07:05/07:35 batch 확정**: `selected:500`(SELECT 완벽), `submitted:497/487`, `deduped:3/13`,
  pending 3,588→2,593(드레인), submitted +984. status 전이 정상. **dedup 청크 수정(a19b55bc) 성공.**
- ✅ **`portals_ok:3` 의미 확정 = "포털 엔드포인트 3개 성공"**(indexnow.org/naver/bing), *URL 3개 아님*.
  lib 는 500 URL 을 한 요청 body.urlList 에 통째로 보내고(포털당 1요청), `accepted`=2xx 낸 엔드포인트
  수(최대 3). curl 실측: 500 URL payload(18KB) → indexnow.org/bing **200**(all-or-nothing 전량 수락).
  → **거짓 성공 아님, submitted 전량 실제 색인됨.** 응답에 `urls_sent`/`portals_total` 추가로 명확화(c06aaad5),
  임시 exact-count diag 제거(Rule #15).
- ✅ **failed 7,927 정리 완료** (CC가 Supabase MCP `execute_sql`로 실행 — 사용자 승인):
  - STEP 1 삭제 **3,544** (submitted/pending 쌍둥이 = 중복, 이미 색인/큐잉)
  - STEP 2 리셋 **4,383** (clean orphan → pending, 1000씩 5회) → **failed 0**
  - 직후: pending 6,507 / submitted 3,853 / failed 0
- ⚡ **batch pg_cron speedup**: job#88 `indexnow_batch` `5,35 * * * *`(30분) → **`2-59/10 * * * *`(10분)**.
  드레인 가속용(포털 3개 다 200, rate limit 여유). pending ~6,500 / 500당 10분 ≈ 2.2h.
  ### ★★★ 드레인 완료 후 반드시 원복 (pending ~0 되면):
  ```sql
  SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='indexnow_batch'),
                        schedule := '5,35 * * * *');
  ```

**IndexNow P0 완전 정상화 (71일 무제출 → 큐 0 정리 + 가속 드레인 중). 원복만 남음.**
- **같은 근본원인 추가 수정**(commit 26d705c4): `indexnow-new-content`(5a7b…→404) +
  `blog-auto-publish`(kadeora-indexnow-key→404) 키를 호스팅 키로 교정. (큐와 무관·bounded.)
- ⚠️ 남은 같은 패턴(플래그): `search-engine-ping` `INDEXNOW_KEY||''` 빈 키(저가치·homepage ping).
- ⚠️ failed 7,927 리셋은 이 수정 동작 확인 후 (claude.ai, 500건씩).

### P1 — 배너 최종본 (design D, 이미 라이브 fe7324c1)
플랜의 "현재 prod=88861795"는 stale. design D(항상 고정 + "부동산 정보 공유방" +
MEMBER_COUNT=1240 + 라이브 점)는 이미 fe7324c1 로 배포됨. banner-z.mjs 재실측 결과
**z-30 은 여전히 겹침**(헤더가 배너 덮음, scrollY 20/40, 모바일+데스크톱) — 원인은 배너
숨김이 아니라 헤더(sticky 깨져 흐름 안)가 fixed 배너를 뚫고 올라오는 것. → **z-[110] 유지**.
인라인 배너 blog/apt/complex 기존 삽입 유지. MEMBER_COUNT 는 사용자가 실값 교체 예정.

### P2 — 손대지 않음 (근거: 트래픽 적어 실익 없음)
커넥션 31/90, auth_rls_initplan 114, blog_no_cover 17 — 트래픽 회복 후로 미룸.

---

## [banner v2] 2026-07-18 — sticky 배너 디자인 B(순수 CSS) + position:fixed 로 스크롤 동작 살림

디자인 B 확정(카카오 노랑, 52px, 순수 CSS — 이미지 폐기). `files (56)` 신규 컴포넌트로
`StickyTalkBanner.tsx` 덮어씀. `STICKY_BANNER_HEIGHT=52` export.

**핵심 판단(사용자 "기존 구조 보고 판단해라" 위임)**: 델리버된 컴포넌트는 `position:sticky`
지만, `globals.css` 의 `html,body{overflow-x:hidden}` 가 sticky 를 앱 전역에서 깨뜨려
(기존 Navigation 헤더도 pin 안 됨 — 이전 프로덕션 실측) sticky 로는 "스크롤 다운 숨김/업
복귀" 가 동작 안 함. → **`position:fixed` + 동일 높이 spacer** 로 구현(디자인/카피/높이/
export 는 그대로). fixed 는 overflow 영향 없어 pin·hide·show 정상. spacer 가 콘텐츠를
밀어 겹침 방지 → **Navigation top 조정 불필요, 이전 var(--talk-banner-h) 변경은 되돌려
Navigation 원복**(top:0).

- 트래킹: sticky `handleClick` → `track('banner_click','bujeonggong_talk',{slot:'sticky',page_path})`.
- 인라인(blog/apt/complex)·InlineTalkBanner·webp 원본은 이전 커밋 그대로 유지.
- sticky-slim*.webp 없음(삭제 불필요).

검증: type-check clean, build 성공. 스크롤 hide/show·375px 는 배포 후 프로덕션 스모크.

---

## [banner] 2026-07-18 — 부정공 TALK 배너 통합 (claude.ai 에셋/컴포넌트 → 레포 연결)

에셋 4개 복사: `public/banners/bujeonggong-talk{,-mobile}.webp`,
`src/components/banner/{Sticky,Inline}TalkBanner.tsx`. (원본은 로컬 Downloads —
`/mnt/user-data/outputs/` 는 claude.ai 샌드박스 경로라 이 머신엔 없음.)

연결 3곳:
1. 상단 sticky — `ClientShell.tsx` 의 `<Navigation/>` 바로 위에 `<StickyTalkBanner/>`.
   **z-index 충돌 해결**: 헤더(`Navigation` <header>)가 `sticky top:0 z:100` 이라
   배너(z-30)와 top:0 에서 겹침. 헤더 `top` 을 `var(--talk-banner-h, 0px)` 로 바꾸고
   배너가 자기 높이를 이 변수에 발행(보이면 헤더가 그만큼 내려가 나란히 stack,
   숨으면 0 복귀). 배너 없는 라우트/미마운트 시 기본값 0px → 기존과 동일(blast radius 0).
2. 인라인 — `apt/[id]`(AptBlogStack↔AptCompareTable 사이), `apt/complex/[name]`
   (설명 섹션↔AptLocationMini 사이), `blog/[slug]`.
3. 트래킹 — 두 컴포넌트 `handleClick` 에서 `track('banner_click','bujeonggong_talk',
   {slot, page_path})` (`@/lib/analytics`). InlineTalkBanner 는 이를 위해 'use client' 전환.

중복 방지: StickyTalkBanner `INLINE_ROUTES` 정규식이 blog/apt/complex 에서 상단 배너를
렌더 안 함(그대로 사용).

⚠️ 미완/판단 필요 — **blog 인라인은 "본문 중간" 이 아니라 "본문 진입부(TOC/차트 직후)"**.
본문은 4개 렌더 경로(isBot / BlogGatedRenderer / BlogTossGate / SmartSectionGate)로
갈리는데 실사용자 경로는 gate 컴포넌트 내부에서 HTML 을 렌더 → 진짜 중간 분할은 그 3개
전환율-critical 컴포넌트를 수정해야 함. 장애 직후 blast radius 고려해 보류하고 안전한
진입부에 배치(하단 AdSlot 과 250px+ 이격, isBot 제외). 진짜 중간이 필요하면 gate 수정 필요.

검증: type-check clean, build 성공. 스크롤 숨김/복귀·375px 는 로컬 env(Supabase 키) 없어
프로덕션/프리뷰 스모크 필요.

---

## [hotfix-522 r2] 2026-07-18 — DB 진단 정정 후 앱 코드 후속 + IndexNow

DB 진단 정정 (claude.ai 실측):
- 504 원인 = **쿼리 속도가 아니라 동시 커넥션 개수**. 개별 쿼리는 빠름
  (apt_subscriptions ILIKE 8.2ms, apt_sites region 0.8ms). max_connections=90.
- 진짜 근본: statement_timeout=120s(함수는 30~60s) + idle timeout 0 + kill_slow_queries()
  가 authenticator(=PostgREST 전 트래픽)를 보호목록에 넣어 좀비를 못 죽임 → 단방향 누적.
- DB 핫픽스는 claude.ai 가 **검증본(hotfix-522-db-VERIFIED.sql)** 으로 처리:
  kill_slow_queries authenticator 보호 제거 + role statement_timeout(anon/auth 8s,
  service_role 55s) + kill cron 1분. → 내가 넘긴 미검증 `docs/_setup/hotfix-522-db.sql`
  은 **폐기(삭제)**. RPC 통합 함수도 폐기(개별 쿼리 빠르므로 불필요).

앱 코드 (요청당 동시 커넥션 수 축소 — 개수 목표):
1. `apt/[id]/page.tsx` — fan-out 8-wide → **2-wide 4웨이브**, 렌더당 peak 동시 커넥션 8→2.
2. `apt/complex/[name]/page.tsx` — 4-wide → **2-wide 2웨이브**, peak 4→2.
3. `indexnow-new-content` 504 — 엔드포인트 fetch 에 timeout 부재 → 포털 hang 시 60s 블록.
   per-fetch `AbortSignal.timeout(8000)` + 3개 병렬(최악 24s→8s). `lib/indexnow.ts`
   submitIndexNow 에도 동일 timeout(urgent/batch 크론 hang 방지).
4. cron_logs id=undefined 고아 — 이전 커밋 `27fe862f` 의 cron-logger.ts 수정이 유일 경로.
   (blog-generate-images/cron-lock/cron-log 는 이미 `if(!logId) return` 가드). 배포 대기.

▶ Item: indexnow 71일 조용한 실패 — **진범 = DB 트리거 (claude.ai 처리, 앱 무관)**:
- (내 앞선 진단 3개 오진 정정) 154 stuck 은 진짜 urgent(is_urgent=true/priority=1),
  pg_cron 살아있음(indexnow_urgent job#87 / indexnow_batch job#88 등록+active),
  드레인도 이미 돎(02:19·02:24 submitted:100 2회). vercel.json cron 만석은 무관.
- **진짜 원인**: 트리거 `fn_indexnow_queue_status_safety` 가 `status:='sent'` 를 쓰는데
  CHECK 제약은 'sent' 를 안 받아(pending/submitted/success/failed/skipped) UPDATE 가
  통째로 롤백. 포털 제출은 성공하는데 큐 기록만 안 됨 → 같은 URL 무한 재제출.
  증거: failed 7,927건 attempt_count=99, pending 오히려 증가, last_submit 5/08 고정.
- 수정: 트리거 'sent'→'submitted' (CHECK 정합). DB 영역이라 **claude.ai 가 처리**
  (hotfix-522-db-VERIFIED.sql STEP 4). **앱 코드는 IndexNow 로직 건드리지 않음** —
  유지하는 건 오직 504 방어용 AbortSignal.timeout(위 3번)뿐.

검증: type-check clean, build 컴파일 성공(559 pages, placeholder env). push 대기.

---

## [hotfix-522] 2026-07-18 — 프로덕션 전면 522 (DB 커넥션풀 포화) 코드레벨 대응

배경:
- 프로덕션 전면 522 (Cloudflare→origin 커넥션 타임아웃). 원인 = 애플리케이션 코드에
  의한 DB 커넥션풀 포화. `max_connections = 90`. **pg_cron 은 5/28 부터 사망 상태라 무관.**
- 제약: DB 접속 불가 → 코드레벨만 수정. 새 마이그레이션/RPC 생성 불가(claude.ai 담당).

수정 (앱 코드 4건 — 커넥션 압력 즉시 완화):
1. `src/lib/cron-logger.ts` — `withCronLogging` insert 응답에서 id 를 못 받으면
   후속 UPDATE 를 **스킵**. 기존엔 `.eq('id', log?.id as string)` 가 `?id=eq.undefined`
   로 나가 풀 포화 시 커넥션을 추가 소비하는 피드백 루프였음 (로그의 `?id=eq.undefined` 정체).
2. `src/app/(main)/apt/[id]/page.tsx` — 8-wide `Promise.allSettled`(Rule #49 위반)를
   **4+4 두 웨이브로 분할** → 렌더당 peak 동시 커넥션 8→4. 출력 불변.
3. `src/lib/daily-report-data.ts` — 구별 시세 `apt_complex_profiles` 조회 `limit(10000)`→
   `limit(2000)`. SSR request-path 커넥션 홀드 시간 단축.
4. `src/lib/apt-fetcher.ts` — `fetchPriceBands` 5000→2000, `fetchBuildersHub` 8000→3000
   (JS 집계 샘플 축소, 커넥션 홀드 단축).

DB 필요 → 적용 대기 (`docs/_setup/hotfix-522-db.sql`, claude.ai 검토 후 적용):
5. `statement_timeout` < 함수 maxDuration — anon/authenticated 12s, service_role 120s.
   maxDuration 30s 에 함수는 죽지만 SQL 은 계속 살아 orphan 커넥션 되는 문제 차단.
   (⚠️ 앱 코드로는 세션 statement_timeout 설정 불가 → DB 롤 설정 필수)
6. `get_apt_detail_bundle` RPC — apt/[id] fan-out 을 1회 왕복으로 근본 통합(위 2번의 후속).
7. `get_daily_gu_prices` RPC — daily 구별 시세를 DB-side GROUP BY 로(위 3번의 후속, 선택).

미해결 finding (scope 밖 — 추가 지시 대기):
- `daily-report-data.ts fetchDailyReportData` 는 30-wide `Promise.all` + 순차 10쿼리.
  daily/[region] SSR(ISR 60s)에서 콜드 스톰 시 렌더당 최대 40 커넥션 스파이크.
  → 웨이브 분할 또는 snapshot(daily-report-snapshot cron) read 전환 권장.
- `vercel.json` catch-all `api/**:30` 이 코드 `export const maxDuration` 를 override
  (analysis-refresh 300, apt-crawl-pricing 300, admin/batch-ops 300 등 → 30 으로 cap).
  Rule #18. 5번 statement_timeout 과 함께 orphan 커넥션 유발.

검증: `npm run type-check` clean. `npm run build` 컴파일 성공(559 pages) — 로컬 env 없어
prerender 는 placeholder env 로 통과 확인. 스모크는 배포 후 프로덕션에서.

---

## [s260] 2026-05-08 — 회원가입 funnel + 전방위 stabilize 일괄 적용 (production main)

브랜치: `main` · commit `1d528d51`

배경:
- s258 plan 을 처음에 사용자 지시(feat/main-redesign-v5 유지)로 feat 브랜치에 적용했으나,
  feat 브랜치에는 plan 이 가정한 인프라(useInAppBrowser hook, x-kd-region 헤더,
  cta-navigate.ts, ResidenceNudgeModal) 가 삭제되어 있어 6건만 적용 가능.
- 이후 production = main 확정. main 에는 plan 의 모든 인프라 코드 존재.
- main 에 9건 전체 적용한 것이 본 s260 entry.

코드 수정 (9건):
1. WelcomeReward localStorage race fix — kd_welcomed mark 를 fetch 성공 후로 이동
   (100P 미지급 dead loop 종결)
2. LoginClient track-attempt keepalive + catch 블록 error_message capture (250자)
3. LoginClient 카카오/구글 disabled 조건에 `|| !inApp.resolved` — 인앱 브라우저 SSR race 보강
4. callback IP hash sha256/16 hex 통일 — track-attempt 와 매칭 (base64/24 mismatch 로
   existingAttempt 룩업 0건 → INSERT 분기 누적되던 문제 해소)
5. callback redirect 에 `?welcome=1` 부착 — WelcomeToast 활성화
6. middleware `regionHeaderValue` encodeURIComponent — Edge 24h Invalid header warning 종결
   (소비측 SSR 사용처 0건 — 추후 구독자 추가 시 decodeURIComponent)
7. cta-navigate `trackCtaClick` 중복 호출 제거 + `setTimeout` 80→50ms (navigation 지연 단축)
8. SmartSectionGate hydration placeholder — visibleSection 만 노출 (기존 전체 htmlContent
   노출 시 게이트 판정 후 사라지는 시각적 결함 + content gate 우회 차단)
9. Marketing/KakaoChannel/ResidenceNudge 모달 3종 `/onboarding` pathname 가드
   (다중 모달 충돌 방지)

Supabase (feat 작업 시 이미 적용 완료, DB 공유):
- migration `cron_logs_30d_purge` — `purge_old_cron_logs()` + 매일 04:15 UTC 스케줄
- migration `v_signup_funnel_daily_redefine` — login_visits 정의 변경:
  `conversion_events.cta_click + (category='signup' OR cta_name LIKE '%login%' OR ...)`.
  page_view 트래커가 OAuth 즉시 redirect 로 drop 되던 측정 누락 해소.

Architecture Rules:
- #63 신설: 응답 헤더 값 ASCII 강제 (Latin-1 외 문자 encodeURIComponent)
- #64 신설: 가입 보너스 mark 는 외부 호출 성공 응답 확인 후 (race 방지)

Pending next:
1. `complete_profile_and_reward` RPC 통합 (welcome-bonus + signup_attempts UPDATE 단일화)
2. `auth_rls_initplan` 108건 일괄 fix (Supabase advisor)
3. pg_cron startup timeout 진단
4. OG `og-apt` / `og-stock` / `og-blog` 잔여 TypeError

---

# Session 205 — Oneshot Batch (2026-05-02 KST)

브랜치: `main` · 한 commit / 한 deploy. session-205-oneshot-batch tag.

## 변경 요약 (work order 9건)

- **W1 (P0)**: `/apt` SSR 복구 — `next/headers` 의존 server-side region detection 분리. `searchParams.region ?? '전국'` 으로 default SSR + `RegionAutoSelect` (client) 가 브라우저 IP/저장값 기반 `?region=` 으로 replace. 봇 HTML 에 단지 카드 0건 → 50+ 회복 목표.
- **W2 (P1)**: 오늘의 종목/현장/블로그 hero 3종 제거. `/stock` HeroCard + StockHeroCarousel, `/blog` blogHero HeroCard 삭제. 14일 클릭 0~1건 확정. `vercel.json` 의 `stock-hero-refresh` cron 도 정리.
- **W3 (P1)**: `lib/apt/imagePriority.ts` 신설. `pickPrimaryImage()` 가 우선순위 정렬 후 1장 추출 — satellite=90 (강등), 시공사 도메인=5 (우대). `thumbnail-fallback.ts` 의 `firstImageUrl` 이 새 헬퍼 사용. 카드 썸네일에서 satellite 비율 < 5% 목표.
- **W4 (P2)**: BlogCard 정보 디자인 — SKIP (별도 컴포넌트 없이 인라인이라 디자인 변경 폭 큼, 다음 세션에서 별도 PR).
- **W5 (P0)**: `blog-meta-rewrite-poll` — batch select 에 `'completed'` status 포함 (results_processed=false 인 stuck 케이스). 404/410 = batch 만료 분기 추가, batch 자체만 expired 마킹하고 큐는 pending 유지 (재제출용).
- **W6 (P0)**: `blog-image-supplement` — errors 를 `{post_id, msg, stack}` 객체 배열로. cron_logs.metadata 에 첫 5개 보존. 24h 440/440 fail 의 진짜 원인을 다음 1회 실행 후 파악.
- **W7 (P1)**: `stock-logo-fetch` — KOSPI/KOSDAQ 6자리 심볼용 fallback chain 보강. `/imgstock/icons/` + `/imgstock/item/logo/` + Google/DuckDuckGo favicon. 1,317건 모두 NULL → 1h 후 30%+ 회복 목표. push 직후 `reset_kr_stock_logo_queue()` 호출 필요.
- **W8 (P0)**: STATUS.md 본 섹션 + Architecture Rule #17 추가.
- **W9 (P0)**: `/api/og-blog`, `/api/og-apt` catch 로깅 prefix 통일 (`[og-blog] FULL:` / `[og-apt] FULL:`). og-apt 는 fetchSite 도 try 로 감싸 ImageResponse 영역과 분리. TypeError 24h 의 진짜 message+stack 노출.

## DB 측 사전 적용

- `get_image_priority` RPC + `get_apt_site_images_sorted` RPC
- `app_config WHERE namespace=ui_hero` 토글 3종 false (hero 제거 안전 가드)
- `trg_stock_hero_toggle` 트리거
- `blog_meta_rewrite_queue` 4,780건 in_progress→pending reset (batch_id 보존)
- `reset_kr_stock_logo_queue()` 헬퍼
- `v_image_quality_summary`, `image_quality_daily` 뷰

## 검증 (배포 후)

- `/apt` 봇 뷰: `curl -A Googlebot https://kadeora.app/apt` HTML 에 "분양"/"청약" 50회+
- `blog_meta_rewrite_queue.status='completed'` 15분 내 진행 (poll 워커 동작)
- `apt_sites` 카드 첫 이미지 satellite 비율 < 5%
- `stock_quotes` market IN (KOSPI/KOSDAQ) logo_url 1h 후 30%+
- Vercel runtime logs 에서 `[og-blog] FULL:` / `[og-apt] FULL:` prefix 로 진짜 에러 캡처

---

# Session 189 — Post-Marathon Recovery (2026-04-28 KST)

브랜치: `fix/post-marathon-recovery` · 한 commit 한 deploy.

## 0) DB 인시던트 — `match_related_blogs` row_to_jsonb(record) 버그 (Architecture Rule #11)
- claude.ai 측에서 production DB 에 직접 핫픽스 적용 (마이그레이션: `fix_match_related_blogs_row_to_jsonb_record`).
- 본 PR 에서는 추가 SQL 마이그레이션을 추가하지 않음. (사후 마이그레이션은 `supabase mcp` 로 등록·관리됨.)

## 1) Track A — Chrome 단일화 (LiveBar)
- `(main)/layout.tsx` 가 이미 단일 `Navigation` (header + mobile bottom nav) 을 갖고 있음 → 추가 변경 불필요.
- 누락 영역인 LiveBar 만 layout 으로 이전:
  - `src/components/ui/LiveBarChrome.tsx` 신설 — `usePathname()` 기반 page 분기, fetch 실패/로딩 시 skeleton (텍스트 ❌).
  - `src/app/api/livebar/route.ts` 신설 — `?page=apt|stock|blog|feed` 카운트 합쳐 `{text}` 반환. 60s revalidate.
  - `(main)/layout.tsx` 에 `<LiveBarChrome />` 1회 mount.
  - `/apt`, `/stock`, `/blog`, `/feed` 페이지에서 인라인 `<LiveBar text=…/>` + import 제거.
- 결과: 4 페이지 nav DOM 동일, LiveBar 텍스트는 클라이언트 fetch 후 채워지며 실패 시 텍스트 0.

## 2) Track B — 클라이언트 버그 3종
- **B-1** `src/app/(main)/apt/page.tsx`, `src/app/(main)/stock/page.tsx` — Suspense fallback 텍스트("부동산 정보를 불러오는 중...", "주식 시세를 불러오는 중...") → `null`. SSR HTML 에 자열 박힘 제거 (view-source 0건 충족).
- **B-2** `src/lib/market-hours.ts` 신설 — KST(Asia/Seoul) 환산 후 weekday 판정. `kstWeekday`, `isKstWeekend`, `isKstWeekday`, `kstWeekdayLabel`, `isKrxOpen` export. `DailyReportCard.tsx` 가 새 helper 사용.
- **B-3** `src/components/PageViewTracker.tsx` — `/api/analytics/pageview` 전송 경로를 `navigator.sendBeacon` 우선, 실패 시 `fetch({ keepalive: true })` 폴백으로 변경. (`/api/analytics/events` 는 이미 `src/lib/analytics.ts` 에서 sendBeacon 사용 중.)
- **B-4 og-blog TypeError** `src/app/api/og-blog/route.tsx` — Vercel logs 에서 6장 burst 마다 6번 throw → 302 redirect 폴백 중. 원인: `renderCover` (line 84) `post.title.length`, `renderKeyPoints` (line 130-131) `post.title.slice/length` 가 `post.title === null` row 에서 TypeError. 기존 try 는 `new ImageResponse(...)` 만 감싸 render fn 호출(body 구성) 시점의 throw 를 잡지 못함. 수정:
  - `fetchPost()` 후 row 정규화 — title/excerpt/tldr/meta_description/hub_cta_target/hub_apt_slug 를 string 또는 null 로 강제. title 이 비면 slug 또는 `'카더라 콘텐츠'` 사용.
  - body 구성 + ImageResponse 를 단일 `try` 로 wrapping → 어떤 필드 throw 도 fallback redirect (`/images/brand/kadeora-hero.png`) 로 다운그레이드.
  - error log 에 `{ slug, card, hasPost, message, stack }` 포함 → 차후 원인 row 추적 용이.

## 3) Track C — ISR + 카드
- **C-1** `scripts/revalidate-sweep.ts` 신설 — `'use server'` action, `requireAdmin()` 가드. `/apt`, `/blog`, `/feed`, `/apt/region` 루트 + 활성 `apt_sites.slug` 전수 + 게시 `blog_posts.slug` 전수 + region/sigungu/category 조합 일괄 `revalidatePath`. 어드민 라우트에서 import 해 호출.
- **C-2 popularity_score === 100 hide** — 4 곳에 `!== 100` 가드 추가:
  - `src/components/apt/AptHubCuration.tsx` (오늘의 추천 카드 ★ pill)
  - `src/app/(main)/apt/page.tsx` (HeroCard stat)
  - `src/app/(main)/apt/ranking/[region]/[category]/page.tsx`
  - `src/app/(main)/apt/region/[region]/[sigungu]/[category]/page.tsx`
- **C-2 카드 Link wrap** — 활성 apt 카드 렌더링 사이트(`AptClient.tsx`, `AptHubCuration.tsx`, `LandmarkAptCards.tsx`, `AptRankingCard.tsx`, region/sigungu/category 페이지) 모두 이미 `<Link>` 래핑 확인. 별도 누락 발견 사례 없음.

## 검증
- 로컬 `npm run build` (Track D).
- 로컬 smoke 8 URL — view-source 에서 "잠시만요" / "불러오는 중" 0건 확인.

## 금지 사항 준수
- daily_create_limit 미변경.
- 블로그 데이터 미변경.
- DB 마이그레이션 미추가.
- profiles.points 직접 UPDATE 없음.
- CSP middleware.ts 외 미변경.

---

# Session 188 — signup_source OAuth 보존 + 온보딩 미션 UI 활성화 (2026-04-27 KST)

## 배경 (실측 데이터)
- signup_source 추적률 8.9% (518건 중 46건만 기록 — **91% 누락**)
- first_mission 완료율 2.2% (638명 중 14명)
- 7일 재방문율 6.7% (15명 중 1명)
- 가입 후 행동: 스크롤만, 글/댓글/북마크 0건
- 인프라 (`first_mission_progress` jsonb, `WelcomeReward`, `GlobalMissionBar`) 는 이미 존재. 노출 부족이 진짜 병목.

## 변경

### 1) `src/app/auth/callback/route.ts` — signup_source 91% 누락 해결
- **버그:** `void supabase.from('profiles').update({signup_source}).then(()=>{})` fire-and-forget 패턴이 직후 `NextResponse.redirect(...)` 가 발사되며 cancel 됨 (서버리스 함수 종료). 이게 91% 누락의 직접 원인.
- **부수 버그:** `searchParams.get('source') ?? 'direct'` 가 "URL 에 source 없음" 케이스를 'direct' 로 덮어 `!== 'direct'` 가드가 항상 통과되는 것처럼 보이지만, 실제로는 어떤 source 값이라도 update 자체가 cancel 되어 무용지물.
- **수정:**
  - `sourceParam = searchParams.get('source')` (raw, null 가능) 추가 — 'direct' fallback 과 분리.
  - admin client (`getSupabaseAdmin`) + `await` + `.is('signup_source', null)` 멱등 가드.
  - `sourceParam !== 'direct'` 일 때만 update — URL 에 없으면 건너뜀.
  - try/catch 로 실패 로깅 (silent fail 방지).

### 2) `src/components/GlobalMissionBar.tsx` — 미션 완료율 2.2% → 노출 강화
- **버그:** `useState(false)` (collapsed 기본값) — 사용자가 헤더 클릭해야만 4개 미션 보임. 14/638 의 직접 원인.
- **수정:**
  - `useState(true)` — 기본 expanded.
  - collapsed 시에도 4개 진행도 도트 (• • • •) 시각 노출 — 클릭 안 해도 진행 상황 인지 가능.
  - 댓글 미션 link `/feed` → `/blog` (블로그 글 읽고 댓글 다는 동선이 자연스러움).
  - 관심 미션 link `/onboarding` → `/apt` (interest mission 은 apt_site_interests 와 매핑됨).

### 3) `src/app/(main)/layout.tsx` — SignupNudgeModal 제거
- StickySignupBar 와 동일 대상 (비로그인) 에 중복 노출. SignupNudgeModal 은 모달 (intrusive), Sticky 는 하단 바 (gentle). gentler 옵션 유지.
- import + mount 둘 다 제거. 컴포넌트 파일 (`SignupNudgeModal.tsx`) 자체는 미삭제 — 향후 A/B 가능성 보존.

### 4) redirect URL 이중 인코딩 — 검증 결과 **버그 없음**
- `grep encodeURIComponent(encodeURIComponent` → 0 매치.
- 모든 `?redirect=...` 콜사이트가 `encodeURIComponent(pathname)` 1회 적용 (pathname 은 `usePathname()` 또는 `window.location.pathname` — 이미 디코드됨).
- `InterestRegisterHero.tsx` 의 변수 사전인코딩 패턴은 가독성만 다를 뿐 단일 인코딩. 행동 동일.

## 검증
- `npx tsc --noEmit --skipLibCheck` → src 코드 0 errors. (`.next/types/validator.ts` 의 stale admin/pulse_v3, master/execute-all, master/status 참조는 사전 빌드 잔여물 — 이번 변경과 무관)

## 다음 (재측정 시점 권장: 7일 후)
- signup_source 추적률 8.9% → ?
- first_mission_completed 2.2% → ?
- 7일 재방문율 6.7% → ?
- 만약 signup_source 추적률이 여전히 낮다면: `complete_signup_frictionless` RPC 가 자체적으로 signup_source 를 'direct' 로 덮어쓰는지 (RPC 본문 SQL 확인 필요) 추가 점검.

---

# Session 173 — P0 크론 stagger + P1 피드 정비 + s168 build fix 재적용 (2026-04-25 KST)

## 배경
s169+s170 머지가 origin 에서 33e071fd 로 revert 되며 s168 build fix 도 함께 사라짐.
이번 세션은 (a) P0 크론 안정화 + (b) P1 피드 정비 + (c) s168 build fix 재적용 (cherry-pick).
신규 컴포넌트 (LiveActivityBar/LiveDiscussionCards/DailyReportBadge) 생성 금지 — 기존 컴포넌트 수정만.

## P0 (Supabase 연결풀 보호)
1. **`vercel.json` 크론 stagger** — 매시 :00 동시 발사 5개 분산
   - `seed-posts`: `0 * * * *` (유지, 가벼움)
   - `refresh-mv`: `0 * * * *` → `12 * * * *`
   - `collect-site-images`: `0 * * * *` → `22 * * * *`
   - `blog-generate-images`: `0 * * * *` → `32 * * * *`
   - `blog-enrich-rewrite`: `0 * * * *` → `42 * * * *`
   - `0 */N * * *` 카덴스 크론은 의미 보존 위해 미변경
2. **`blog-quality-score/route.ts`** — `BATCH = 200 → 50` (Vercel 60s 제한 + DB 부하 보호)
3. **`AdminShell.tsx` + `NotificationBell.tsx`** — `setInterval 60s → 300s`
4. **`apt/search`** — RPC + revalidate=300 + perPage=30 이미 적용 (SKIP)
5. **`issue-draft` 중복** — 단일 entry, 중복 없음 (SKIP)

## P1 (피드 UX)
1. **`Sidebar.tsx`** — `🔔 알림` Link 제거 + orphan state/import 정리
2. **`AnonymousFeedHero.tsx`** — 거대 `🚀` CTA 카드 블록 제거. 가치/통계/청약/블로그/토픽 유지
3. **`QuickPostBar.tsx`** — collapsed state 1줄 슬림 (24px 아바타 + "무슨 생각이세요?")
4. **`AdBanner.tsx`** — 금색 1.5px 테두리 + soft glow
5. **`FeedClient.tsx`** — AttendanceBanner 양쪽 push 경로 + import 제거. 비로그인 i===2 컴팩트 CTA (poll/vs/predict/normal 모두)
6. **면책 문구** — s172 가 이미 변경 (SKIP)

## s168 build fix 재적용 (cherry-pick)
- `e9c0256a → 66d29116`: 4 cron force-dynamic + us-market-cron-helpers lazy
- `e7c780a9 → 71284cd2`: 5 page.tsx generateStaticParams=[] + 17 route.ts force-dynamic
- ⚠️ blog/[slug]/page.tsx 는 generateStaticParams 만 변경 (렌더링 로직 미변경)

## 검증
- `npx tsc --noEmit --skipLibCheck` → 0 errors
- `npm run build` (`.env.local` 제거 상태) → exit=0

## CTA 보존 확인 (s145 재발 방지)
- 카카오 CTA 3곳 건재: i===2 컴팩트 (신규) / i===3 RelatedContentCard / following 탭 안내 (line 382)
- AnonymousFeedHero 거대 CTA 만 제거 — 컴팩트 CTA 가 대체

## Forbidden 영역 준수
- ❌ blog/[slug]/page.tsx 렌더링 로직 미변경 — generateStaticParams 만 변경
- ❌ Navigation.tsx 신규 컴포넌트 삽입 안 함
- ❌ LiveActivityBar/LiveDiscussionCards/DailyReportBadge 신규 컴포넌트 생성 안 함
- ❌ award_points/deduct_points RPC 미변경
- ❌ vercel.json 크론 path 미변경 (schedule 만 변경)

## 다음 세션 잔여
- GitHub PAT 토큰 revoke
- Edge Function 2개 삭제 (`github-commit-patch`, `github-read-file`)
- Supabase Auth Leaked password protection
- RLS `auth_rls_initplan` 99건 래핑
- `mv_apt_pulse` RPC+cache
- `naver-complex-sync` 401
- 매 2/4/6 시간 :00 크론 stagger 필요 여부 모니터링

---

# Session 174 — 크론 stagger 확장 + canonical 정규화 + 진단 (2026-04-25 KST)

## 실제 변경 3건 (코드)
1. **`vercel.json`** — 매시 :00 발사 multi-hour 크론 5개 stagger
   - `check-price-alerts`: `0 */2` → `9 */2`
   - `issue-preempt`: `0 */2` → `11 */2`
   - `apt-parse-announcement`: `0 */4` → `43 */4`
   - `indexnow-new-content`: `0 */4` → `9 */4`
   - `blog-upcoming-projects`: `0 */4` → `49 */4`
   - 매 6시간 (`0 */6`) 4개 (`apt-parse-pdf-pricing`, `indexnow-mass`, `refresh-trending`, `auto-verify-households`)는 빈도 낮아 미변경
2. **`blog/[slug]/page.tsx:265`** — canonical URL 한글 slug 정규화
   - `${SITE}/blog/${slug}` → `${SITE}/blog/${encodeURIComponent(slug)}`
   - generateMetadata 내 alternates.canonical 만 변경. 페이지 렌더링 로직 미변경
3. **`apt/search/page.tsx`** — pg_trgm 인덱스 TODO 주석 추가 (실제 코드 변경 無)
   - 추가 권장: `CREATE INDEX ... USING gin (apt_name gin_trgm_ops)`

## 진단 결과 (코드 변경 無 — STATUS 기록)

### Task C: 면책 문구
- 현재 line 1236: "공공 데이터(국토교통부, 한국거래소, 금융위원회 등) 기반의 정보 제공" — s172 가 이미 변경
- **SKIP** (작업 불필요)

### Task D: 포인트 기능 검증
- `award_points` RPC 호출 경로 (10+ 지점 확인):
  - `welcome-bonus` 100P / `feed/short` 10P / `feed/vs` 10P / `comment` 5P / `share` 5P / `chat` 1P
  - `attendance-check` 10P (+streak7 30P, +streak30 100P)
  - `profile/mission` 50P / `profile/complete-bonus` 50P / `stock/watchlist` 50/200P
- `lib/point-rules.ts` POINT_RULES 정의 정상
- `AuthProvider.points` context → `ProfileHeader` 표시. Navigation 헤더엔 미표시 (디자인 결정)
- **상태: 정상. 수정 불필요**

### Task F: naver-complex-sync 401 진단
- 파일: `src/app/api/cron/naver-complex-sync/route.ts`
- API 호출처:
  - `https://new.land.naver.com/api/search` (line 30)
  - `https://fin.land.naver.com/front-api/v1/search/complex` (line 32)
  - `https://new.land.naver.com/api/complexes/{complexNo}` (line 44)
- **인증 방식: API 키 無 — Mozilla User-Agent + Referer 헤더로 스크래핑**
- **401 원인 추정:**
  1. 네이버가 봇 트래픽 감지 → User-Agent/IP 차단 (가장 가능성 높음)
  2. Referer 헤더 검증 강화 (네이버 land 도메인 외 거부)
  3. 일일 호출 한도 (스크래핑이라 공식 한도 없음, 실효적 throttle)
- **해결 옵션:**
  - (a) 네이버 부동산 공식 Open API 가입 (`fin.land.naver.com` 비공개라 어려울 수 있음)
  - (b) User-Agent 로테이션 + 헤더 다양화
  - (c) Vercel IP 회피 위해 별도 프록시 경유
  - (d) 크론 빈도 축소 (현 매시 → 6시간마다)
- **권장: (d) 즉시 적용 후 (b) 점진 도입. 코드 수정은 다음 세션에서**

### Task G: 슬로우 쿼리 인프라
- `/api/admin/analytics` 만 존재 (page_view 집계)
- pg_stat_statements 모니터링 엔드포인트 없음
- **TODO**: `/api/admin/slow-queries` 엔드포인트 추가
  ```sql
  SELECT query, calls, mean_exec_time, total_exec_time
  FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;
  ```

## 검증
- `npx tsc --noEmit --skipLibCheck` → 0 errors
- `npm run build` (`.env.local` 제거) → exit=0

## Forbidden 영역 준수
- ❌ blog/[slug]/page.tsx 렌더링 로직 미변경 (generateMetadata.alternates.canonical 만 변경, 사용자 명시 허용 범위)
- ❌ Navigation.tsx 미수정
- ❌ award_points/deduct_points RPC 미수정
- ❌ vercel.json cron path 미변경 (schedule 만)
- ❌ LiveActivityBar/LiveDiscussionCards/DailyReportBadge 미수정 (origin/main ff41d3cb 가 재추가했으나 건드리지 않음)

## 수동 처리 필요 (코드 외)
- GitHub PAT 토큰 revoke → GitHub Settings → Developer settings → PATs
- RESEND_WEBHOOK_SECRET → Vercel Dashboard → Settings → Environment Variables
- RLS `auth_rls_initplan` 99건 → Supabase SQL Editor 직접 실행
- 네이버 부동산 Open API 키 발급 검토 (naver-complex-sync 대안)
- pg_stat_statements 활성화 확인 + slow query 어드민 라우트 추가

---

# Session 161 — 위성 라우트 + VACUUM 크론 복구 (2026-04-24 KST)

## 작업 요약
1. **VACUUM 크론 dblink 우회로 수정** (Claude SQL, pg_cron 80개 schedule 무건드림)
   - `weekly_vacuum_analyze_blog` 재생성 **금지** — 이미 dblink로 수정 완료된 경로 유지
2. **위성 라우트 PR 머지 + 24,719편 위성 썸네일 복구**
   - PR `fix/satellite-endpoint` → `main` 머지 → Vercel 자동 배포
   - `src/app/api/satellite/route.ts` (edge, 30일 immutable): Esri World Imagery → OSM fallback → `/api/og-chart` 302
   - `src/components/AptImageGallery.tsx`: 위성 슬라이드에 🛰️ 위성 사진 배지 (모바일 캐러셀 + 데스크탑 1+2)
   - 머지 후 1회 SQL (`apt_complex_profiles` 만):
     ```sql
     UPDATE apt_complex_profiles
     SET images = jsonb_build_array(metadata->>'satellite_url_pending') || images,
         og_image_url = metadata->>'satellite_url_pending'
     WHERE metadata->>'satellite_url_pending' IS NOT NULL;
     ```
   - 외부 API 키 0개 추가. 인증 불필요 타일 소스만 사용.

## 잔여 이슈
- **`naver-complex-sync` 401** — Node에서 수동 재시도 필요. cron 루프가 아닌 일회성 backfill 스크립트.

## 금지 영역 (건드리지 말 것)
- `pg_cron` 기존 80개 schedule
- `weekly_vacuum_analyze_blog` 재생성 (dblink 경로 유지)
- `apt_complex_profiles.images` 직접 수정 (위 SQL 1회 외)

---

# Session 145 — v2.0 Week 1 (2026-04-22 KST)

## Commit 5 — `feat(admin): pulse_v3 tab + 4 widgets`
- **신규**:
  - `src/app/api/admin/pulse_v3/route.ts` — GET requireAdmin. 4 뷰 Promise.all 병렬 fetch.
  - `src/app/admin/pulse_v3/page.tsx` + `PulseV3Client.tsx` — 전용 라우트 + 클라이언트 렌더
- **수정**: `src/app/admin/AdminShell.tsx` — 'pulse_v3' 탭 등록 (🫀 아이콘, 맨 오른쪽)
- **위젯 4종**:
  1. **KPI 8-grid**: active_now / pv_today (yst ±%) / uv_today / signups_today / signups_7d / cta_ctr_7d / whales_unconverted / action_items
  2. **Blog × APT 전환 매트릭스**: 6-bucket 색상 (gray→red→yellow→green→emerald). 각 셀 signups/visitors (pct%)
  3. **미가입 고래 TOP 10**: visitor_id / pv / active_days / uniq_pages / deep_reads / last_seen
  4. **Action Items**: severity pill (red/yellow/cyan) + key + message + action
- **배너**: red/yellow severity Action Items 있을 때 상단 경고 배너
- **DB deps**: `v_admin_master_v3`, `v_admin_action_items`, `v_admin_whale_unconverted`, `v_admin_behavior_conversion_matrix`
- **접근**: `/admin` 에서 'Pulse v3' 탭 또는 `/admin/pulse_v3` 직접 URL
- **Caveats**: `get_admin_user_detail` 모달 연동은 이번 C5 범위 밖 — 고래 행 클릭은 단순 표시만.

## Commit 4 — `feat(blog): 50% scroll mid-gate with variants`
- **신규**: `src/components/blog/BlogMidGate.tsx` (client)
  - props: `{ blogId, isGatedPost?, isLoggedIn?, sentinelSelector?, className? }`
  - 세션당 1회 (`sessionStorage.blog_mid_gate_shown_${blogId}`)
  - variants DB: `cta_message_variants WHERE cta_name='blog_mid_gate' AND variant_key='default' AND is_active=true`
  - 폴백: `title="이 글 끝까지 보는 사람 8%뿐"` / `body="핵심 정보는 아래에..."`
  - sentinel `[data-mid-gate-sentinel]` IntersectionObserver 진입 시 노출. 없으면 window scroll 50% 폴백.
  - UI: indigo gradient card + dismiss(×) + 카카오 노란 버튼
  - 이벤트: `cta_view('blog_mid_gate')` / `cta_click('blog_mid_gate')` / `cta_click('blog_mid_gate_dismiss')`
- **수정**: `src/components/blog/BlogGatedRenderer.tsx` — classified.flatMap 으로 refactor, H2 섹션 중간(`midIdx = floor(length/2)`) 앞에 `<div data-mid-gate-sentinel />` inject
- **수정**: `src/app/(main)/blog/[slug]/page.tsx` — 비로그인 + `!has_gated_content` 인 경우만 `<BlogMidGate />` 마운트 (BlogGatedWall 과 중복 방지)
- **DB deps**: `cta_message_variants` (이미 존재, blog_mid_gate default row 필요)
- **Caveats**: BlogGatedRenderer 가 client-side 렌더이므로 gated 포스트에서는 sentinel 주입 가능. 단 BlogGatedWall 과 중복 노출 방지 위해 mid-gate 는 `has_gated_content=false` 인 블로그에만 노출.

## Commit 3 — `chore(cta): remove 5 dead CTAs + C1 unlock logs backfill`
- **삭제 파일**: `src/components/ActionBar.tsx`, `src/components/BlogFloatingBar.tsx`, `src/components/ContentLock.tsx`
- **수정**:
  - `src/app/(main)/layout.tsx` — ActionBar import + `<ActionBar />` 제거
  - `src/app/(main)/blog/[slug]/page.tsx` — BlogFloatingBar import + 렌더 제거, LoginGate blog_compare/blog_stock_ai/blog_finance 블록(996-1022) 제거
  - `src/app/(main)/apt/[id]/page.tsx` — ContentLock import + 2 wrapper(실입주/한줄평) 제거 (내부 컴포넌트만 노출)
- **유지**: action_bar_kakao / action_bar_comment / action_bar_bookmark (별개 액션 버튼), 기타 고CTR CTA 전부 보존
- **신규**: `src/app/api/events/apt-compare-unlock/route.ts` (fire-and-forget INSERT), `src/components/apt/SimilarAptsTracker.tsx` (client, mount=viewed_3rd_locked / 3rd card click=clicked_3rd_cta)
- **C1 보강**: `SimilarAptsSection` 에 `data-similar-apt-card` + `data-similar-idx` 속성 추가 + `<SimilarAptsTracker />` 마운트 → apt_compare_unlock_logs 기록
- **DB**: `apt_compare_unlock_logs` (기존) — rowsecurity=false 라 admin 경유 INSERT 필수
- **Caveats**: blog_finance feature 도 동일 LoginGate 블록에 포함되어 같이 제거됨 (별도 낮은 CTR). 복구 필요 시 별도 컴포넌트로 재도입.

## Commit 2 — `feat(blog): related blogs 3-card, 3rd = strategy badge`
- **신규**: `src/components/blog/RelatedBlogsSection.tsx` (server), `src/components/blog/RelatedBlogsTracker.tsx` (client)
- **수정**: `src/app/(main)/blog/[slug]/page.tsx` — BlogActions 직후, BlogEndCTA 앞에 `<RelatedBlogsSection blogId={post.id} />` 마운트. import 추가.
- **DB**: `match_related_blogs(p_blog_id bigint, p_limit int default 3)` → jsonb { id, title, slug, cover_image, reading_minutes, tldr, badge }
- **UI**: grid auto-fit minmax(220px,1fr), 16:9 cover, 제목 2-line clamp, tldr 2-line clamp, ⏱{min}분. badge='strategy' → amber gradient + ⚡전략 pill.
- **이벤트**: mount 시 cta_view `related_blog_section` (category=engagement). data-related-card 클릭 capture → cta_click `related_blog_strategy`/`_normal`.
- **섹션 헤더**: "이어서 읽을 만한 글" + 서브 "블로그 2글 이상 본 분들, 가입률 6.5배 (실측)"
- **Caveats**: isBot 체크 제외 (SSR 렌더 허용). RPC 0건 → 섹션 null.

## Commit 1 — `feat(apt): similar apts section (get_similar_apts RPC)`
- **파일**: `src/components/apt/SimilarAptsSection.tsx` (신규, 서버 컴포넌트), `src/app/(main)/apt/[id]/page.tsx` (import + 마운트 지점 추가)
- **동작**: `apt_sites.id` → `get_similar_apts(p_apt_site_id, p_limit=6)` RPC 호출 → 6개 카드 그리드
- **카드 구성**: satellite_image_url 우선, 없으면 og_image_url → 폴백 /api/og. 이름 + 지역(region sigungu).
- **위치**: `apt/[id]` 페이지 하단, `Disclaimer` 직전
- **링크**: `slug` 있으면 `/apt/{slug}`, 없으면 `/apt/{id}` (UUID)
- **스타일**: grid `auto-fit minmax(140px, 1fr)`, aspect 4/3, 모바일 1~2 col / 데스크탑 4~6 col 자동
- **안전**: RPC 실패 → 빈 배열 → 섹션 null (폴백 렌더 없음), 로그 없음

---

# 카더라 프로젝트 STATUS — 세션 52 (2026-03-29 KST)
> SEO 극대화 + UI 글래스모피즘 + 프리미엄 멤버십 풀스택 + 주식 카드뷰
> **다음 세션 시작:** "docs/STATUS.md 읽고 작업 이어가자"

## 프로덕션 현황

| 지표 | 수치 | 비고 |
|------|------|------|
| **유저** | 121명 | 실제 21명 + 시드 100명 |
| **프리미엄** | 0명 | 결제 시스템 구현 완료, Toss 키 설정 대기 |
| **게시글/댓글** | 4,195 / 2,115 | |
| **블로그** | 18,522편 | IndexNow 미전송 18,522편 (크론 대기) |
| **주식 종목** | 728개 | KOSPI 212/KOSDAQ 152/NYSE 222/NASDAQ 142 |
| **청약** | 2,692건 | |
| **apt_sites** | 5,512 (active) | |
| **재개발** | 202건 | |
| **완료 결제** | 0건 | Toss 키 미설정 |
| **크론 에러** | 0건 (24h) ✅ | 181회 정상 |

## 코드베이스

| 지표 | 수치 |
|------|------|
| 파일 수 | 544개 |
| API 라우트 | 180개 |
| 크론 | 79개 |
| DB 테이블 | 127개 |
| 최신 커밋 | `3350f00` |

---

## 🚨 즉시 실행 필요 (코드 외)

### [긴급] 3/31 마감
- [ ] **토스 정산 등록**

### [최우선] 검색 노출 (Google 인덱싱 0건!)
- [ ] **Google Search Console** → 사이트맵 `https://kadeora.app/sitemap.xml` 제출
- [ ] **Google URL 검사** → `/`, `/stock`, `/apt`, `/blog`, `/feed` 수동 인덱싱
- [ ] **네이버 서치어드바이저** → 사이트맵 + RSS 4개 제출
- [ ] **Bing 웹마스터** → 사이트맵 제출
- [ ] **Daum 검색등록** → 사이트 등록

### [중요] 결제 활성화
- [ ] **Toss 키 발급** (developers.tosspayments.com)
- [ ] **Vercel 환경변수**: `TOSS_SECRET_KEY`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`
- [ ] 테스트 결제 → DB 확인

### [중요] API 키
- [ ] **Anthropic 크레딧 충전** (블로그 크론 재가동)
- [ ] **KIS_APP_KEY** 발급 (주식 실시간)
- [ ] **FINNHUB_API_KEY** 발급

### [권장] 마케팅
- [ ] 네이버 블로그/카페 소개글 (백링크)
- [ ] 커뮤니티 소개글 (디시, 에펨코리아 등)
- [ ] Google Adsense 승인 대기 (코드 적용됨)

---

## 세션 52 완료 작업

### SEO 실전 강화
- IndexNow 배치 500개 + 3개 엔드포인트
- indexnow-mass 크론 (500편/6시간)
- indexed_at 마이그레이션 실행 완료
- 블로그 200편 + 주식 728종목 SSG
- preconnect + modifiedTime 수정
- Google deprecated ping 제거

### UI/UX 글래스모피즘
- CSS 8종: kd-glass/card-glow/btn-glow/counter/pulse-dot/shimmer/section-card/fade-in
- 헤더/탭바/랜딩/피드/블로그/EmptyState 전면 개선
- 주식 카드뷰 토글

### 프리미엄 멤버십 풀스택
- /premium 랜딩 + 결제 후처리 + 상태 API + 만료 크론
- AuthProvider isPremium + 배지 + 업셀 배너 3곳

---

## 크론 (79개)

| 카테고리 | 수 | 비고 |
|---------|-----|------|
| 블로그 | 37 | AI 크레딧 부족→생성 0건 |
| 주식 | 7 | 정상 |
| 부동산 | 14 | 정상 |
| SEO | 2 | indexnow, indexnow-mass |
| 결제 | 1 | premium-expire |
| 시스템 | 18 | 정상 |

## API 키 현황

| 키 | 상태 |
|----|------|
| ANTHROPIC_API_KEY | ⚠️ 크레딧 부족 |
| CRON_SECRET | ✅ |
| STOCK_DATA_API_KEY | ✅ |
| INDEXNOW_KEY | ✅ |
| TOSS_SECRET_KEY | ❌ 미설정 |
| NEXT_PUBLIC_TOSS_CLIENT_KEY | ❌ 미설정 |
| KIS_APP_KEY | ❌ 미발급 |
| FINNHUB_API_KEY | ❌ 미발급 |

## 아키텍처 규칙 (불변)

1. 블로그 데이터: 절대 삭제/수정 금지
2. stockcoin.net: 카더라와 연결 금지
3. 포인트: RPC로만 수정
4. CSP: middleware.ts 전용
5. 크론 에러: 항상 200 반환
6. OG 폰트: Node.js fs (Edge 금지)
