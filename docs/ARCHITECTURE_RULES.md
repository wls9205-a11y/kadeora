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
