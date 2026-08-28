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

## Rule #115 — 값이 이상하면 «함수를 고치기 전에» 그 컬럼의 기록자를 전부 나열한다 (H7-2 신설)

**Symptom**: 어떤 컬럼의 값이 틀렸다. 그 값을 만드는 함수를 찾아 고친다. 그런데 다음 날 또 틀려 있다.

**Cause**: 그 컬럼에 «쓰는 곳이 하나가 아니다». 뒤에 도는 쪽이 앞의 결과를 덮는다.
고친 함수는 애초에 옳은 값을 내고 있었고, 바꾼 것은 «맞는 로직» 이다.

**실제 사례 2건**

| 컬럼 | 고치려던 것 | 실제로 덮던 것 |
|---|---|---|
| `apt_sites.lifecycle_stage` | `derive_subscription_stage` (05:00) | `fn_refresh_lifecycle_stage` (06:23, 전진 전용) |
| `blog_posts.content` | R1 외부 이미지 제거 | pg_cron `replace_blog_body_og` (OG→실사 역방향) |

**Rule** — 값이 틀렸을 때 «순서»:

1. 그 컬럼에 쓰는 것을 **전부 나열**한다. 코드만 보지 말 것 — 셋 다 본다:
   ```sql
   -- ① DB 함수
   select proname from pg_proc where prosrc ilike '%set <컬럼>%' or prosrc ilike '%update <테이블>%';
   -- ② 트리거
   select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid='<테이블>'::regclass and not tgisinternal;
   -- ③ 스케줄
   select jobname, schedule, active, command from cron.job where active;
   ```
   앱 코드는 `grep -rn "<컬럼>" src/ | grep -iE "update|upsert|insert"`.

2. **저장값과 재계산값을 대조**한다. 둘이 다르면 「함수가 틀렸다」가 아니라
   「누가 덮었다」다. 함수에 «그 값을 낼 경로가 있는지» 부터 본다 —
   없으면 그 함수는 범인이 아니다.

3. 기록자를 줄일 때는 **끄기 전에 커버리지를 잰다**. 잃는 행이 몇 개인지 모르고
   끄면 조용한 결손이 된다. 실측 예: 이름 조인 2,758 vs source_ids 조인 2,755 → 1곳.

4. ⛔ **삭제하지 않는다.** 스케줄만 내리고(`cron.alter_job(active := false)`) 함수는 남긴다.
   주석으로 「되살리지 말 것」과 이유를 박는다.

⚠️ 남는 1곳처럼 «자동에서 빠지는 것» 은 반드시 검수 큐에 올린다. 알고 빠뜨리는 것과
   모르고 빠뜨리는 것은 다르다.
## Rule #18 — ⚠️ 2026-08-27 정정: 캐치올은 per-route export 를 «덮지 않는다»

**⚠️ 이 규칙은 2026-05-04(s223)에 세워졌고 2026-08-27 실측에서 «성립하지 않았다». 아래가 현행이다.**

### 오늘의 실측 (2026-08-27 · 최근 14일 cron_logs 전수)

캐치올 `src/app/api/**/*.ts → maxDuration 30` 은 «지금도 그대로 있다». 그런데:

- **functions 항목이 «없는»** 라우트 **14개** 가 30초를 넘겨 «성공» 했다.
  전부 라우트에 `export const maxDuration` 만 있다:

  | 라우트 | 최대 실행 | functions | 라우트 export |
  |---|---|---|---|
  | issue-draft | 281.2s | 없음 | 300 |
  | stock-analysis-gen | 218.0s | 없음 | 300 |
  | issue-image-attach | 151.7s | 없음 | 300 |
  | apt-enrich-location | 142.8s | 없음 | 300 |
  | apt-analysis-gen | 128.2s | 없음 | 300 |
  | batch-cluster-submit | 104.0s | 없음 | 300 |

  `apt-enrich-location` 은 **6일 연속 매일 136~143초로 전부 성공** 했다. 우연이 아니다.

- **functions 도 없고 라우트 export 도 «없는» 채 30초를 넘긴 것: 0개.**
  즉 둘 다 없을 때 30초가 걸리는 것 자체는 반증되지 않았다.

### 그래서 무엇이 참인가

> **라우트의 `export const maxDuration` 하나로 «충분하다».**
> 캐치올은 그것을 덮지 않는다.

⚠️ 둘 «다» 있고 값이 다를 때 어느 쪽이 이기는지는 **아직 모른다**. 관측된 실행 중
   더 작은 값을 넘긴 사례가 없어 가려지지 않았다(blog-quality-score functions 300 /
   export 120 / 최대 116.9s 등). 모르는 것을 안다고 적지 않는다.

⚠️ s223 당시(stock-fundamentals-kr · data-quality-fix 가 export 60 인데 30초에 죽음)의
   관측이 틀렸는지, 그 사이 Vercel 동작이 «바뀐» 것인지는 가릴 수 없다. 어느 쪽이든
   **현행 판단 근거는 오늘의 실측** 이다.

### 운용 지침 (개정)

- 30초를 넘는 라우트는 **라우트에 `export const maxDuration` 을 적는다.** 이것이 1순위다.
- `functions` 항목은 «라우트가 스스로 선언할 수 없을 때» 만 추가한다.
  ⚠️ `functions` 는 **50개가 스키마 상한** 이다(Rule #112). 「Rule #18 때문에 항목을 늘 같이
     넣는다」는 옛 지침이 항목을 51개까지 밀어올려 **배포 3건을 연속으로 죽였다**(2026-08-27).
     그 지침이 이 규칙의 가장 비싼 부작용이었다.
- 새 cron 추가 시 라우트 export 를 «반드시» 적고, functions 는 손대지 않는다.

### observe 504 사후 정정 (2026-08-27)

⚠️ `2c0d9a07` 커밋은 observe 504 의 원인을 「캐치올이 덮었다」로 적었다. **그 진단은 틀렸다.**
observe 는 당시 `export const maxDuration = 60` 이었으므로 한도는 60초였고, 실행이 그것을
넘긴 것이다. 같은 커밋이 `apt_transactions(region_nm, deal_date)` 복합 인덱스도 함께
넣었는데 — **고친 것은 그 인덱스다**. functions 항목 추가는 효과가 없었을 가능성이 크다.
두 변경을 한 커밋에 넣어 원인이 가려졌다.

## Rule #19 — cron route 삭제 전 3종 검증 (s223 신설)

cron route 를 dead 로 판정하고 삭제하기 전에 반드시 다음 3가지를 모두 확인:

1. **cron_logs 30일 실행 기록**: 최근 30일간 한 번도 실행되지 않았는지

```sql
SELECT route, COUNT(*) FROM cron_logs
 WHERE route = '<route>' AND created_at > now() - interval '30 days';
```

2. **Supabase pg_cron job 등록 여부**: cron.job 테이블에 _call_vercel_cron 패턴으로 외부 호출되는지 — vercel.json 에 없어도 pg_cron 이 호출하는 케이스 다수 존재

```sql
SELECT * FROM cron.job WHERE command LIKE '%<route>%';
```

3. **src/ fetch/import grep**: 다른 코드가 fetch 하거나 import 하는지

```bash
grep -r "<route>" src/
```

세 검증 모두 통과 시에만 삭제 가능. vercel.json crons 등록 여부만으로 활성/dead 판단 금지 — s223 Phase 0 검증에서 "dead 추정 30개" 중 27개가 실제 pg_cron 으로 활성 상태였음 (3개만 진짜 dead).

**Discovered**: s223 Big Cleanup (2026-05-04) — vercel.json crons 에서 빠진 cron 들도 pg_cron `_call_vercel_cron` 으로 외부 호출되는 사례 21건 발견. 검증 없이 30개 모두 삭제했으면 production 즉시 손상.

## Rule #20 — 광고성 메시지 발송 5중 가드 (s227 신설)

**Symptom**: 광고성('ad') 카카오 메시지를 발송했는데 정보통신망법 위반 (야간 발송, 동의 만료, 채널 친구 아님 등) 사후 적발 — 감사 증거가 없어 면책 불가.

**Cause**: 발송 직전 가드 체크가 분산되어 있거나 특정 경로에서 누락. 가드 통과 여부와 무관하게 발송 시도 자체가 로그로 남지 않으면 정보통신망법 50조 (광고성 정보 전송 제한) + 62조의3 (자료 보관) 감사 시 면책 근거가 사라진다.

**Rule**:

모든 광고성('ad') 카카오 메시지는 발송 직전 RPC `kakao_send_guard_check` 통과 필수: (1) 활성 사용자, (2) 마케팅 수신 동의, (3) 동의 2년 미만 또는 재확인, (4) 카카오 채널 친구, (5) 발송 시각 KST 08-21시 또는 야간 동의. 가드 통과 여부와 무관하게 모든 시도는 `kakao_message_send_logs` 기록 (정보통신망법 50조 + 62조의3 감사 증거).

**How to apply**:
- 광고성 메시지 발송 코드는 단일 진입점 (예: `src/lib/kakao-send.ts` 또는 admin/marketing 라우트) 으로 통합. 가드 체크 우회 경로 금지.
- RPC 호출: `kakao_send_guard_check(p_user_id, p_message_type, p_send_at)`. `message_type='ad'` 외에도 'info' 등 광고성 외 메시지에도 적용 가능 (야간 발송 가드는 'info' 에도 권장).
- 가드 차단 케이스도 반드시 `kakao_message_send_logs` 에 `delivery_status='blocked'` + `metadata.reason` 기록 — "가드가 막아서 안 보냄" 이력 자체가 감사 증거.
- 가드 통과 시 실제 발송 결과 (`delivered` / `failed`) 도 동일 테이블에 기록. 모킹 환경은 `delivery_status='mock'`.
- consent 만료 (Rule #20 항목 3) 검증은 `consent-renewal-check` (T-14d 알림) + `consent-expiry-revoke` (T+0 자동 철회) 두 cron 으로 보장.

**Discovered**: s227 (2026-05-03) — 마케팅 카카오 채널 발송 파이프라인 신설 시 정보통신망법 50조/62조의3 감사 요건 정식화. cron `kakao-channel-sync` / `consent-renewal-check` / `consent-expiry-revoke` 와 admin route `marketing/kakao/send` 가 모두 동일 가드 + 동일 로그 테이블 사용해야 함.

## Rule #21 — /apt region resolution = Edge → SSR → Client 단일 흐름 (s229 신설)

**Symptom**: `/apt` 진입 시 region picker flash, localStorage 가 redirect 직후 다시 덮어씀, server/client region 가 다르게 계산되어 hydration mismatch.

**Cause**: 이전 흐름은 client-only — server 는 region 모르고 RegionAutoSelect 가 mount 후 redirect 시도. timezone 강제 매핑 + 'apt:lastRegion' 자체 키 사용으로 다른 페이지(`region-storage.ts`의 `kd:region`) 와 mismatch. 결과: SSR 가 '전국' 으로 한 번 렌더 → client 가 다른 값으로 재요청 → 깜빡임.

**Rule**:

`/apt` 의 region 결정 흐름은 단일:

1. **Edge middleware** (`src/middleware.ts`) — `kd_region` 쿠키 → Vercel `x-vercel-ip-country-region` (`isoToKrRegion`) → `null`. 결과를 `request.headers.set('x-kd-region', resolved || '전국')` 로 downstream SSR 에 전달.
2. **SSR page.tsx** — `region = sp.region?.trim() || (await headers()).get('x-kd-region') || '전국'`. 첫 페인트 시점에 정답 region 으로 SSR.
3. **fetcher 전국 처리** — `region === '전국'` 일 때 `.eq()`/`.contains()` 안 걸어 전국 합계 반환 (V_apt_region_summary 등).
4. **Client RegionAutoSelect** — `useSearchParams().get('region')` 있으면 no-op. 없으면 `getStoredRegion()` (`@/lib/region-storage`) → `isValidKrRegion()` 통과 시만 `router.replace`. timezone 매핑/자체 키 금지 — single source `kd:region`.
5. **RegionPicker choose()** — region 선택 시 `kd_region` 쿠키 set (max-age 1y, samesite=lax). 다음 방문에서 middleware 가 즉시 SSR 단계에 region 주입.

**How to apply**:
- 새 region-aware 페이지 (예: `/stock/region/[region]`) 도 동일 패턴 — Edge → SSR header → fetcher 전국 처리.
- 좌표 → region 변환은 `/api/region/from-coords` (Edge runtime, Kakao reverse geocoding) 사용. KAKAO_REST_API_KEY 미설정 시 503 반환 — middleware 흐름은 영향 없음.
- localStorage 키는 `kd:region` 으로 통일. `apt:lastRegion` 등 자체 키 추가 금지.

**Discovered**: s229 (2026-05-04) — /apt picker flash + localStorage 키 mismatch + middleware geo 미사용 합계 10 bugs 추적 중 발견. 단일 source-of-truth 흐름으로 정리.

## Rule #22 — CTA click 트래킹: navigation 일으키는 onClick 은 helper 통과 (s230 신설)

**Symptom**: cta_view 1,121 / cta_click 18 / 24h. desktop CTR 1.5% / mobile 1.6% — 모든 device 공통. 18 click 은 모두 modal/in-page/logged-in (navigation 없는 케이스). anchor / Link / `window.location.href` 로 navigation 일으키는 click 은 0건 기록됨.

**Cause**: `<a href="...">` / `<Link href="...">` / `window.location.href = ...` 가 onClick handler 의 `trackCTA(...)` 호출보다 먼저 실행 — sendBeacon 큐가 enqueue 되기 전 navigation 시작 → 브라우저가 unload 시 in-flight 큐 drop → 이벤트 silent fail. SW 무관, endpoint 정상, hook 정상. 패턴 자체가 race.

**Rule**:

navigation 일으키는 모든 CTA click 은 `src/lib/cta-navigate.ts` 의 `trackCtaAndNavigate(...)` helper 통과 필수:

```ts
trackCtaAndNavigate({
  href: '/login?...',
  ctaName: 'sticky_signup_bar',
  pagePath: pathname,
  category: 'signup',
});
```

helper 가 (1) `trackCTA('click', ...)` (2) `trackCtaClick(...)` 둘 다 호출 (이중 안전망) 후 (3) 80ms `setTimeout` 으로 sendBeacon 큐잉 보장 후 navigate. modal/in-page click (navigation 없음) 은 `trackCTA('click', ...)` 직접 호출 OK.

**How to apply**:
- 새 CTA 추가 시 anchor/Link 직접 navigation 금지. `<button type="button" onClick={...}>` + helper 사용.
- 기존 anchor/Link 의 visual style (border-radius, padding 등) 은 button 으로 옮길 때 100% 보존 — 추가만 (border:'none', background:'none', cursor:'pointer').
- helper 는 fire-and-forget. caller 가 await 하면 navigation 80ms delay 가 의미 없어짐 — 절대 await 금지.
- sendBeacon 실패 시 keepalive fetch fallback 은 `cta-track.ts` send 함수가 처리.

**Discovered**: s230 (2026-05-04) — 12+ BROKEN CTA (sticky_signup_bar 312 view 0 click, login_gate_apt_analysis 423 view 0 click, blog_early_teaser 146 view 0 click 등) 일제히 navigation race 패턴. 8 컴포넌트 button + helper 로 통일.

## Rule #23 — signup flow: frictionless → /onboarding → 거주지+관심사 (s231 신설)

**Symptom**: 신규 가입 30일간 거주지 등록률 21% → 1.3% (16배 추락). 4/14 frictionless RPC 변경 시점과 일치.

**Cause**: `complete_signup_frictionless` RPC 가 신규 사용자를 `onboarded=true` 로 강제 INSERT — 이후 `/onboarding` 페이지에 진입할 path 가 없어 91% skip. 거주지·관심사 등 필수 메타데이터 미수집.

**Rule**:

DB 측 frictionless RPC 는 신규 사용자를 `onboarded=FALSE` 로 INSERT. `auth/callback/route.ts` 가 redirect 직전 profiles 조회 → `onboarded=false` 면 `/onboarding?return=<safeRedirect>` 로 redirect. 사용자가 `/onboarding` 에서 거주지/관심사/마케팅 동의 manual 등록 → `onboarded=TRUE` 마침.

**How to apply**:
- 새 OAuth provider 추가 시 같은 callback 패턴 — onboarded 조회 → 미완료면 /onboarding 으로.
- `/onboarding` 페이지가 fallback 으로 작동해야 하므로 항상 reachable. middleware 의 인증 가드가 차단하지 않도록 주의.
- onboarded=false + residence_city=null 사용자에게는 백업으로 ResidenceNudgeModal (5초 delay, 7일 cooldown) 도 함께 mount — onboarding 직접 접근 못 한 케이스 회수.

**Discovered**: s231 (2026-05-04) — 거주지 등록률 회귀 30일 추적 중 발견. DB W1 (frictionless onboarded=FALSE) + 코드 callback redirect + ResidenceNudgeModal 3종 동시 적용으로 path 복구.

## Rule #24 — 모달 cooldown = localStorage 7일 timestamp (s231 신설)

**Symptom**: 사용자가 dismiss 한 모달 (KakaoChannelAddModal, SignupPopupModal, MarketingConsentModal) 이 새 탭/세션마다 다시 노출 → 짜증 + dismiss 율 ↑.

**Cause**: 기존 cooldown 이 sessionStorage 에 단순 flag (`'1'`) 저장. 새 탭/창 = 새 세션 → flag 사라짐 → 다시 노출.

**Rule**:

모든 client-side 모달의 cooldown 은 `localStorage` + timestamp 패턴:

```ts
const STORAGE_KEY = 'kd_<modal>_dismissed_at';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// skip check
const ts = localStorage.getItem(STORAGE_KEY);
if (ts && Date.now() - Number(ts) < COOLDOWN_MS) return;

// dismiss write
localStorage.setItem(STORAGE_KEY, String(Date.now()));
```

**How to apply**:
- 신규 모달 추가 시 sessionStorage 사용 금지. 키는 `kd_` prefix + 모달 식별자 + `_dismissed_at` suffix.
- COOLDOWN_MS 는 default 7일. 더 짧은 cooldown 이 비즈니스 요구일 때만 override.
- localStorage 접근은 try/catch 로 감쌈 (Safari private 모드 등 차단 케이스).

**Discovered**: s231 (2026-05-04) — KakaoChannelAddModal / SignupPopupModal / MarketingConsentModalMount 3 모달이 sessionStorage 사용해 새 탭마다 부활. 일괄 localStorage 7일 timestamp 로 통일.

## Rule #25 — blog 작성 cron 은 freshness-context inject + auto-unpublish (s232 신설)

**Symptom**: 8,574 published 중 391개 (2024 title) + 9개 (2025 stale 시즌성) 검색 노출 중. LLM 이 학습 cutoff 기준으로 "2024년" 같은 과거 연도를 미래/현재형으로 작성.

**Cause**: blog 작성 cron 의 LLM prompt 에 "현재 시점" 컨텍스트 부재. INSERT 시 freshness 메타데이터 (target_year/expires_at/is_seasonal) 미기록 → stale 자동 정리 불가.

**Rule**:

blog 작성용 LLM 호출은 모두 `getFreshnessContext()` (`src/lib/blog/freshness-context.ts`) 를 system prompt 에 inject 필수:

```ts
const systemPrompt = `${baseSystemPrompt}\n\n${getFreshnessContext()}`;
```

context 에는 오늘 날짜 (KST), 현재 연도/분기, "과거 연도 미래형 금지", target_year/expires_at/is_seasonal 메타 가이드 포함.

INSERT 시 `deriveFreshnessFields({ isSeasonal, targetYear })` 로 freshness 컬럼 채움. seasonal=true 면 `expires_at = now + 90d` 자동 계산.

매일 KST 02:00 `blog-stale-unpublish` cron 이 (1) `expires_at < now` (2) `target_year < current_year` (3) `is_seasonal=true AND published_at < now-180d` 조건의 글을 `is_published=false` + `auto_unpublished_reason` 마킹.

**How to apply**:
- 새 blog 작성 cron 추가 시 freshness-context import 필수. system prompt + INSERT 양쪽 적용.
- `is_seasonal` 휴리스틱: 청약일정/공고/D-day/분기실적 = true; 영구 가이드/단지소개 = false. 애매하면 false (보수).
- `safeBlogInsert` helper 사용 시 freshness 필드가 payload 에 포함되도록 helper 도 forward 하게 업데이트 (s232 follow-up TODO).

**Discovered**: s232 (2026-05-04) — blog_posts 391+9 stale 노출 추적 중 발견. 9 작성 cron + freshness-context lib + 자동 unpublish cron 3종 동시 적용.

## Rule #27 — /apt 하위 컨텐츠 배치 표준 (s235 신설)

**Symptom**: /apt/[id] 사용자 알고싶은 정보 (위치 / 단지스펙) 가 15번째 / 7번째에 배치 → 모바일 스크롤 피로 + bounce.

**Cause**: 섹션 추가 history 가 누적되며 비즈니스 로직 (분양 일정/실거래/사업일정) 이 위에 쌓여 결정 정보 (위치/스펙) 가 뒤로 밀림.

**Rule**:

`/apt/[id]` 와 `/apt/complex/[name]` 등 단지 상세 페이지의 섹션 배치 순서는 다음을 따른다:

1. **Hero** (이름/카테고리/대표 이미지)
2. **KPI cards** (분양가/세대수/입주일 등 요약)
3. **📍 위치 정보** (지도/주소/교통/학군 — 결정 요소)
4. **📅 분양 일정** (D-day, 청약접수 일정)
5. **🏗️ 단지 스펙** (세대수/면적별 구성)
6. **💰 가격 정보** (분양가 vs 실거래가 / 분양가 비교 / 실거래 이력)
7. **📊 분석 섹션** (종합 분석 / 시세 비교 / 최근 실거래 비교)
8. **조건부 섹션** (경쟁률 / 미분양 / 재개발 — 데이터 있는 경우만)
9. **🏪 주변 시설**
10. **❓ FAQ**
11. **footer 그룹** (커뮤니티 / 블로그 / 다른 현장)
12. **Disclaimer**

**How to apply**:
- 새 섹션 추가 시 위 12개 슬롯에 매핑. 슬롯 사이에 끼우면 안 됨.
- 데스크톱 1024+ 는 2-column grid (1.5fr / 1fr) 권장. 분석/추천 섹션을 aside 로.
- 조건부 섹션은 `{data && <section>...}` 패턴 — 데이터 없으면 렌더 X.

**Discovered**: s235 (2026-05-06) — /apt/[id] 14 section 분석 중 위치=15번째, 단지스펙=7번째 발견. 표준 배치로 재정렬.

## Rule #28 — inline raw fontSize/padding 금지, CSS var + class 통일 (s235 신설)

**Symptom**: 컴포넌트마다 `fontSize: 14`, `padding: 14` 같은 raw 숫자 분산. 디자인 토큰 변경 시 일괄 수정 불가 + 데스크톱 layout 미고려.

**Cause**: 빠른 prototyping 으로 `style={{...}}` inline value 채택. 누적되며 디자인 일관성 깨짐.

**Rule**:

`/apt`, `/apt/complex` 등 핵심 페이지의 섹션 타이틀/카드/wrapper 는 다음 클래스 사용:

```css
.apt-page-container { max-width: 720px; padding: var(--sp-md); }
@media (min-width: 1024px) { .apt-page-container { max-width: 900px; padding: var(--sp-lg); } }

.apt-section-title { font-size: var(--fs-md); font-weight: 800; ... }
@media (min-width: 768px) { .apt-section-title { font-size: var(--fs-lg); } }

.apt-card-v2 { background: var(--bg-surface); border-radius: var(--radius-md); padding: var(--sp-md) var(--card-p); }
@media (min-width: 768px) { .apt-card-v2 { padding: var(--sp-lg) var(--card-p); } }
```

raw 숫자 (예: `fontSize: 14`, `padding: 16`) → CSS var (`var(--fs-sm)`, `var(--sp-md)`) 만 사용.

**How to apply**:
- 새 섹션 타이틀 = `<h2 className="apt-section-title">`. 인라인 style 금지.
- 카드 wrapper = `<section className="apt-card-v2">`. inline padding/border 금지.
- 1024+ layout 의무 — sticky aside (`position: sticky; top: 80px`) 패턴 권장.
- 예외: 동적 값 (e.g. `style={{ width: progressPct + '%' }}`) 만 inline 허용.

**Discovered**: s235 (2026-05-06) — /apt/[id] 14 곳 + /apt/complex/[name] 5 곳 inline `style={ct}` 사용 중. 일괄 className 으로 통일 + globals.css 클래스 신설.

## Rule #30 — /apt cover image 우선순위 + 위성/OG fallback 차단 (s236 신설)

**Symptom**: /apt 페이지 카드에 위성사진 / `/api/og` placeholder 가 진짜 사진보다 먼저 노출. 사용자가 "이게 실제 단지 사진이야?" 의심 → 신뢰도 ↓.

**Cause**: `apt_sites.images` jsonb 가 mixed type (string + object) 이고 caption/source 필드 미통일. cover image 정렬 기준이 단순 array index 였음.

**Rule**:

`/apt` 하위 페이지의 cover image priority (낮은 score = 우선):

| score | 종류 | 패턴 |
|---|---|---|
| 1 | 조감도/투시도 | caption: 조감도/투시도/rendering/birdseye |
| 2 | 모델하우스/배치도/평면도 | caption: 모델하우스/견본/평면도/배치도 |
| 3 | 현장 사진 | caption: 현장/건설/공사/시공 |
| 4 | naver/kakao 외부 출처 | url: imgnews.naver/pstatic/kakaocdn/daumcdn |
| 5 | 일반 외부 | (그 외) |
| 8 | 위성 | url: maps.googleapis/staticmap/openstreetmap/aerial.view/satellite.image, caption: 위성사진 |
| 9 | kadeora OG fallback | url: kadeora.app/api/og |

**서버**: DB `pick_apt_cover_image(p_site_id uuid)` RPC 호출 — `apt_sites.cover_image_url` 자동 갱신. 매일 KST 03:30 `cover-image-backfill` cron 이 NULL 또는 OG fallback 인 단지에 카카오 이미지 검색으로 조감도 추가 후 RPC 재호출.

**클라이언트**: `AptImageGallery.tsx` 의 `normalized` 단계에서 satellite filter + priority sort 한 번 더 (RPC 결과 보강). `AptHeroLarge.tsx` / `AptCardV5.tsx` 등 카드는 `isSatellite()` + `isOgFallback()` 헬퍼로 cover 검증 후 `AptImagePlaceholder` (SVG building skyline) fallback.

**Schema**: `src/lib/schema/apt.ts` 의 `buildSchemaImages()` 가 RealEstateListing.image 에 `ImageObject[]` (contentUrl + caption) 로 emit, 위성 차단 + priority sort 적용.

**How to apply**:
- 새 apt 카드 컴포넌트 만들 때 `pickBestAptImage(site)` + `isSatellite()` 가드 + `AptImagePlaceholder` fallback 패턴 의무.
- 새 image 쓰는 cron 은 caption 필드에 출처/종류 명시 (조감도/모델하우스/뉴스 등) — pickRealImage 정렬 보장.
- OG fallback 사용 시 작은 watermark "사진 준비중" 추가 (사용자 신뢰도).

**Discovered**: s236 (2026-05-07) — 4,887 apt_sites 중 진짜 사진 47%, OG fallback 31%, NULL 19%. apt_complex_profiles 34,544 중 cover 재계산 후 위성 거의 사라짐. cover-image-backfill cron 으로 점진 회복.

## Rule #31 — 메인/상세 페이지 og:image 6장 패턴 (s238 신설)

**Symptom**: 네이버/구글 search snippet 에 단일 이미지만 노출. 카루셀 안 잡힘. 캐러셀 보유한 블로그 글 (6장 이상) 만 search rich result 노출.

**Cause**: 메인 페이지 (/apt, /blog, /stock) 의 `openGraph.images` 가 1-2장. 단일 hero/og-square 만으로는 네이버/구글이 캐러셀 못 만듦.

**Rule**:

모든 메인/상세 페이지의 generateMetadata 는 `openGraph.images` 와 `twitter.images` 에 6장 emit 의무:

- 1: `card=hero` (메인 hero)
- 2: `card=stats` (통계 그리드)
- 3: `card=imminent` (D-7 / 임박 / 추천 — amber theme)
- 4: `card=ranking` (TOP 3 또는 ranking list)
- 5: `card=region` (지역 / 카테고리 grid)
- 6: og-square 630×630 (네이버 모바일 1:1 크롭)

`/api/og?card=...&category=...&title=...` 로 단일 라우트가 5개 layout 생성 (DB-free, 빠른 generation). 종목 detail 은 `/api/og-stock?symbol=...&card=price|chart|financial|flow|ai`.

**How to apply**:
- 새 메인/상세 페이지 추가 시 6장 패턴 의무. `og-square` 는 항상 6번째.
- `card` 값은 카테고리별로 어울리게 — 종목은 price/chart/financial, 부동산은 imminent/region.
- 1200×630 + 630×630 ratio 두 종 함께 (구글 carousel + 네이버 1:1 크롭 동시 대응).

**Discovered**: s238 (2026-05-07) — 메인 페이지 og:image 1-2장 vs 블로그 글 6장 격차로 네이버 캐러셀 누락. /apt/complex/[name] 등은 BAILOUT_TO_CSR 로 인덱싱 0%.

## Rule #32 — Server Component BAILOUT_TO_CSR 즉시 fix (s238 신설)

**Symptom**: 페이지가 SSR 안 되고 CSR fallback. Vercel dev 콘솔에 `BAILOUT_TO_CLIENT_SIDE_RENDERING`. Google bot 이 컨텐츠 못 봄 → 자동 noindex.

**Cause**: Next.js 15 의 `dynamic = 'auto'` 가 ambiguous 한 server component (cookies 사용 + ISR + 'use client' 혼합) 를 만나면 BAILOUT 으로 fallback. 흔한 트리거:
- `createSupabaseServer()` 가 `next/headers` 의 cookies 사용 — Dynamic API
- 자식 컴포넌트가 `'use client'` 인데 SSR-critical (h1/h2) 포함
- error.tsx 가 무거운 client-only 작업 수행
- generateMetadata 또는 fetchData 가 throw 시 catch 안 됨

**Rule**:

Server Component 페이지의 BAILOUT 진단 + fix 순서:

1. `export const dynamic = 'force-static' | 'force-dynamic'` 명시 (auto 금지)
2. `export const revalidate = N` ISR 명시
3. `createSupabaseServer()` (cookies 의존) 대신 `getSupabaseAdmin()` (service role, cookie-free) 사용 — 단지 상세/공개 페이지에 한해
4. SSR-critical 자식 컴포넌트 (h1/h2/p) 는 server component 만. `'use client'` 자식은 dynamic import + ssr:false 로 격리
5. 모든 fetch 에 try/catch + fallback null. 절대 throw 금지 (error.tsx 가 client 면 BAILOUT)
6. `generateMetadata` 의 `robots.index: false` 는 명시적 사유 (data_quality_score 등) 만. ambiguous noindex 금지

**Discovered**: s238 (2026-05-07) — /apt/complex/[name] 34,544 단지 BAILOUT_TO_CSR + 자동 noindex. createSupabaseServer→getSupabaseAdmin 전환 + dynamic=force-static + 명시적 robots 가드로 복구.

## Rule #33 — image-sitemap 단지/글당 4-7 이미지 entry (s238 신설)

**Symptom**: image-sitemap 단지/글당 1 entry → 네이버 이미지 검색 노출 절반 이하.

**Rule**:

`src/app/sitemap-image/[page]/route.ts` 가 각 row 의 `images` jsonb 모든 element 를 `<image:image>` entry 로 emit (단지/글당 cap 7):
- cover_image_url 우선
- images jsonb 의 모든 element (string + object)
- satellite/og fallback 필터 (Rule #30 패턴)
- caption 필드 명시 (image:title + image:caption)

**How to apply**:
- 새 image-bearing 컬럼 추가 시 sitemap 에 emit. 신규 페이지 (apt/region/* 등) 도 동일.
- cap 7 은 네이버 권장. 더 많이 노출하려면 페이지 자체에 schema:ImageObject 로 추가.

**Discovered**: s238 (2026-05-07) — apt_sites 5천 + apt_complex_profiles 3.4만 = 약 30,869 entries → 4-7배 = 100,000+ entries.

## Rule #34 — news-sitemap 48h 신선도 + 카테고리 우선순위 (s238 신설)

**Symptom**: news-sitemap 100건 중 60건이 7일+ 이전 글. 네이버 뉴스 search 는 48h 신선도 절대 우선.

**Rule**:

`src/app/news-sitemap.xml/route.ts`:
- WHERE `published_at > NOW() - INTERVAL '48 hours'`
- 카테고리 우선순위 sort: finance(1) > unsold(2) > redev(3) > apt(4) > 기타(9). 같은 우선순위 내 published_at DESC.
- LIMIT 50 (네이버 권장 cap)

**How to apply**:
- 카테고리별 평균 view 데이터 변경 시 우선순위 재조정 (현재 finance=180, unsold=172).
- PostgREST CASE 정렬 불가 → JS 측 post-sort 사용.

**Discovered**: s238 (2026-05-07) — finance/unsold 카테고리가 view 평균 높지만 sitemap order 무차별 → 신선도 낮은 일반 글이 위로 와서 네이버 색인 누락.

## Rule #36 — SITE_URL 사용 의무 (s239 신설)

**Symptom**: `https://kadeora.app/...` 직접 박힌 코드 17 파일. 도메인 변경 시 일괄 수정 불가, 환경별 staging URL 차별화 불가.

**Rule**:
- 코드 안 `https://kadeora.app/...` 직접 박지 말 것.
- `import { SITE_URL } from '@/lib/constants'` 후 `${SITE_URL}/...` 사용.
- 예외: User-Agent header 의 `(+https://kadeora.app)` 는 브랜딩 식별자 — keep.
- 검증: `grep -rn "'https://kadeora.app/" src/` 결과 = User-Agent 만.

**Discovered**: s239 (2026-05-07) — 17 파일 + 33 occurrences 통일.

## Rule #37 — NEXT_PUBLIC_SUPABASE_URL env var 사용 (s239 신설)

**Rule**:
- layout.tsx 등에 supabase URL 직접 박지 말 것.
- `process.env.NEXT_PUBLIC_SUPABASE_URL ?? '<hardcoded fallback>'` 패턴.
- 빌드 타임 치환 + env 미설정 시 안전 fallback.

## Rule #38 — OG 토큰 단일 source `src/lib/og-tokens.ts` (s239 신설)

**Rule**:
- 6 OG route (og/og-apt/og-blog/og-square/og-image/og-stock) 모두 `OG_CAT` import.
- 색상/라벨/아이콘 변경 시 이 파일만 수정.
- 새 OG route 추가 시 반드시 OG_CAT import + `getOgCat(key)` fallback.

**`OgCategoryToken` 필드**: color / dim / bg [3-stop] / label / code / icon.

## Rule #39 — console.error 분할 출력 (s239 신설)

**Symptom**: Vercel runtime log 1 row 길이 제한 (~250 chars). 단일 호출로 message + stack + input 묶어 보내면 stack/input 부분 truncated.

**Rule**:
- 패턴: 한 줄에 한 정보만.
  ```ts
  console.error('[name] message=', e?.message);
  console.error('[name] stack=', e?.stack);
  console.error('[name] class=', e?.constructor?.name);
  console.error('[name] input=', JSON.stringify({...}));
  ```
- prefix `[route-name]` 통일 (grep 용이).
- 단일 console.error 에 `stack=`, `class=` 등 함께 넣지 말 것.

**Discovered**: s239 (2026-05-07) — /api/og + /api/og-blog throw 메시지 진단 시 단일 console.error 가 30자 자르고 stack/input 모두 사라짐 발견.

## Rule #40 — light mode `!important` body/html 만 제거 (s239 신설)

**Symptom**: light mode 의 background/color !important 가 component override 차단 (specificity 깨짐).

**Rule**:
- `html.theme-light body` 의 `!important` 제거. 다른 component 가 override 가능.
- 단, `input/textarea/select` 의 `!important` 는 keep — third-party form widget (kakao/google/toss) 호환.
- font-size adjust (`html.font-large` 등) 의 `!important` 도 keep — 사용자 접근성 우선.

## Rule #41 — onboarded 컬럼 변경 권한 (s239 신설)

**Symptom**: 카카오 24h 가입자 100% onboarded=TRUE / residence=NULL — ResidenceNudgeModal 작동 0건. /onboarding 페이지 redirect path 무용.

**Cause**: `auto_rescue_stuck_users` RPC 가 가입 5분 후 모든 사용자 강제 onboarded=TRUE. + MarketingConsentModal/profile/consent route 가 동의 시 onboarded:true 함께 update.

**Rule**:

`onboarded=TRUE` 설정 권한은 **단 두 곳**:
1. `complete_onboarding` RPC — 사용자가 `/onboarding` 페이지 완료 시 (거주지 + 관심사 + 마케팅 동의 manual)
2. `auto_rescue_stuck_users` RPC — 가입 24h 후 fallback (조건: residence_city OR interests >= 1)

**금지 위치** (s239 적용):
- `handle_new_user_autoprofile` trigger — `onboarded=FALSE` 로 INSERT (이미 OK)
- `complete_signup_frictionless` RPC — onboarded 변경 금지 (이미 OK)
- `MarketingConsentModal.tsx` — 동의/거부 모두 onboarded 변경 금지 (s239 W1.A fix)
- `profile/consent/route.ts` — onboarded body 무시 (s239 W1.D fix)
- 기타 client/server 코드 일체 — 직접 update 금지

**How to apply**:
- 새 trigger/RPC 추가 시 onboarded 변경 코드 review 필수.
- ResidenceNudgeModal 등 onboarded=FALSE + residence=NULL 조건 사용하는 컴포넌트는 path 보존 검증.

**Discovered**: s239 (2026-05-07) — auto_rescue 5분 → 24h + 조건 추가, 2 client + 1 server route fix.

## Rule #42 — 메인 페이지 ISR `revalidate=600` (s239 신설)

**Rule**:
- `/apt`, `/blog`, `/stock` 메인 페이지: `export const revalidate = 600` (10분 ISR).
- cold start 감소 + 봇 캐시 hit rate 향상.
- 단지/글 상세 페이지는 `force-static` (Rule #32 / s238 적용).
- 더 짧은 revalidate (60s) 는 트래픽 적은 페이지 한정 — 봇 hit rate 가 cold start 비용 못 갚음.

## Rule #43 — 중복 생존자를 `content_score` 로 고르지 말 것 (M2 B-4 신설)

**Rule**:
같은 현장의 중복 행 중 무엇을 남길지(생존자) 정할 때 **`content_score` 를 판정 축으로 쓰지 않는다.**
판정 축은 **슬러그 품질**이다 — 영문·블록 토큰이 온전한 쪽이 생존자다.

```
꺼짐  ---아이파크포레                 cs100   ← 점수가 높다
살음  dmc-sk-view-아이파크포레         cs94    ← 이쪽이 생존자다
```

**왜**:
`content_score` 는 은퇴한 행에도 그대로 남는다. 페이지 품질이 아니라 잔여값이다.
점수로 고르면 **깨진 슬러그가 이긴다** — 토큰이 빠진 쪽이 먼저 만들어져 데이터가 더 쌓여
있는 경우가 많기 때문이다.

**이미 두 번 사고가 났다**:
1. V15 A-1 병합 — 생존자 선정에 슬러그 품질 기준이 빠져 **23쌍이 거꾸로** 잡혔다.
   DB 담당이 방향을 뒤집었고 `src/lib/apt/merged-slugs.ts` 헤더에 기록이 남아 있다.
2. 지시서 M2 B-4 — "비활성인데 content_score 80+ 30건을 되살려라"로 **같은 기준이 다시 적혔다.**
   실측하니 219건이었고 그중 210건이 `apt_site_merges.dead_slug` 였다. 그대로 켰다면
   middleware 가 301 로 넘기고 있는 URL 이 통째로 되살아났다.

**How to apply**:
- 중복 판정 쿼리를 쓸 때 `ORDER BY content_score DESC` 로 생존자를 고르지 않는다.
- 생존자 후보가 갈리면 슬러그를 본다. `--` 나 앞뒤 하이픈으로 토큰이 빠진 쪽이 은퇴 대상이다.
- 이미 `apt_site_merges` 에 등재된 쌍은 **다시 판정하지 않는다.** 그 표가 유일한 근거다.
- 비활성 행을 되살리기 전에 반드시 확인:
  `SELECT 1 FROM apt_site_merges WHERE dead_slug = :slug` — 있으면 켜지 않는다.
- 중복을 정리할 때 순서는 **① 생존자 `name_variants` 에 은퇴자 이름 편입 → ② 은퇴자
  `is_active=false` → ③ `apt_site_merges` 등록 → ④ `node scripts/gen-merged-slugs.mjs`** 다.
  ①을 빠뜨리면 구역명 검색어가 사라진다 (`sa.py` 가 `name_variants` 를 키워드로 확장한다).
- `apt_sites` 에서 `DELETE` 금지. `is_active=false` 로만 은퇴시킨다.

**Discovered**: M2 B-4 (2026-08-25) — 219건 중 조치 대상 0건. 병합표 미등재 9건만
등록해 404 → 301 로 복구했다. `is_active` 는 한 행도 켜지 않았다.

## Rule #107 — `apt_sites.page_views` 를 사용자 노출 순위에 쓰지 말 것 (H4-1 신설)

> 번호 근거: 착수 시 리포지터리 전수 `grep -rno "Rule #[0-9]\+"` 로 최대값이 #106
> (`STATUS.md:1852`)임을 확인하고 #107 을 부여했다. 채팅이 미리 적은 번호가 아니다.

**Symptom**: 홈 「많이 보는 현장」 9위가 `2020.2.7. LH 국민임대 예비입주자 모집공고` 였다.
현장이 아니라 6년 전 공고문이다.

**Cause**: `apt_sites.page_views` 는 실제 조회수가 «아니다». 합성값이다.

| 확인 | 값 |
|---|---|
| `apt_sites.page_views` 컬럼 총합 | 200,655 |
| `page_views` **테이블** 3개월 apt 경로 | 1,941 |
| 부울경 PV 상위 12곳의 실제 사람 조회 | **전부 0** |

100배 괴리 + 상위권 전부 실조회 0. 순위를 만들 근거가 아니다.

**Rule**:

- `page_views` 컬럼으로 «사용자에게 보이는» 목록을 정렬하지 않는다.
  홈 칩·홈 섹션·목록 정렬 어디에도 금지.
- 같은 이유로 「인기」·「많이 보는」·popular·hot 류의 **순위를 주장하는 라벨을 쓰지 않는다.**
  부울경에서 30일간 사람이 3회 이상 본 현장이 **0곳**이다(235곳에 858건 흩어짐).
  순위 신호 자체가 없다.
- 기존 크론이 «배치 대상 선정»에 쓰는 건 그대로 둔다 — 그건 순위 노출이 아니다.
  컬럼을 지우면 그것들이 깨진다.
- 대신 계측을 먼저 붙인다(H4-3). 봇 제외 집계가 **현장당 3회 이상 · 5곳 이상** 나오면
  그때 라벨을 승격한다. 기준 미달이면 승격하지 않는다.

**같이 걸러야 하는 소스** — 전부 실측으로 탈락했다.

| 소스 | 실측 | 판정 |
|---|---|---|
| `content_score` | 은퇴 행에도 남는 잔여값 | Rule #43 |
| `trending_keywords` | heat_score 전부 100 · `2026` `아파트` 혼입 · 경기·서울 혼입 | H3-3 |
| `search_logs` (42,576) | 30일 클릭 0 · 로그인 0 · 새벽 4~5시 최고치 | 크롤러 |
| `gsc_search_analytics` | 마지막 적재 2026-04-22 · 상위 20개 전부 주식 종목 | 낡음 |

**How to apply**:
- 홈·목록에 새 「무엇무엇 순」 섹션을 붙이기 전에 «그 순서의 근거 컬럼이 사람의 흔적인지»
  먼저 캔다. `select sum(page_views) from apt_sites` 와 실제 로그 테이블 집계를 나란히 놓는다.
- 칩·섹션의 **라벨과 소스를 한 함수에서 같이** 낸다 (`src/lib/home/chips.ts`).
  둘을 따로 두면 소스만 바뀌고 라벨이 남아 조용히 거짓말이 된다.
- 소스가 둘 이상이면 **섞지 않는다.** 소스를 통째로 고르고 라벨을 거기 맞춘다.

**Discovered**: H4-1 (2026-08-26) — 홈 「많이 보는 현장」 섹션 제거.
`lib/home/sections.ts` 의 popular 계산은 판정 기록과 함께 남겨 뒀다.
