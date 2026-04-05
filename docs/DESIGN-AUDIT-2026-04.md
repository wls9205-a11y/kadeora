# 카더라 전체 보안·진화 설계안

> 작성일: 2026-04-05 | 대상: kadeora.app (세션 72 기준)
> 아키텍처: 57 페이지 · 233 API · 112 컴포넌트 · 98 크론 · 136 DB 테이블

---

## 목차

1. [Phase 1: 즉시 수정 — 보안 Critical (5건)](#phase-1)
2. [Phase 2: 단기 수정 — High 우선순위 (8건)](#phase-2)
3. [Phase 3: 중기 개선 — Medium 품질 향상 (12건)](#phase-3)
4. [Phase 4: 장기 진화 — 기능 확장 로드맵](#phase-4)
5. [리스크 매트릭스](#risk-matrix)
6. [롤백 전략](#rollback)
7. [테스트 체크리스트](#testing)

---

<a id="phase-1"></a>
## Phase 1: 즉시 수정 — 보안 Critical (5건)

> 예상 작업 시간: 2~3시간
> 리스크 레벨: 수정하지 않으면 외부 공격 가능

### 1-1. Admin API 2개 완전 무인증 (blog-enrich, verify-households)

**현재 상태:**
- `blog-enrich` (398줄): GET/POST 모두 `getSupabaseAdmin()` 직접 사용. POST는 `kd-reparse-2026` 하드코딩 토큰으로만 인증. GET은 POST를 호출하므로 동일.
- `verify-households` (56줄): GET/POST 모두 `getSupabaseAdmin()` 직접 사용. 인증 0.

**위험:**
- URL만 알면 누구나 호출 가능
- blog-enrich POST: 블로그 59,388편 일괄 수정 가능
- verify-households POST: apt_subscriptions 데이터 변경 가능

**수정 계획:**
```typescript
// 두 파일 모두 상단에 추가
import { requireAdmin } from '@/lib/admin-auth';

// 각 핸들러 첫 줄에 추가
const auth = await requireAdmin();
if ('error' in auth) return auth.error;
const { admin } = auth;
// 기존 getSupabaseAdmin() → admin으로 교체
```

**리스크 분석:**
- blog-enrich는 현재 `?token=kd-reparse-2026`으로 호출 중 → requireAdmin으로 교체하면 기존 호출 방식이 깨짐
- 단, 이 API는 어드민 패널 또는 수동 호출 전용이므로 영향 없음
- verify-households도 어드민 전용이므로 영향 없음
- 롤백: git revert 한 커밋으로 원복 가능

**기존 기능 깨질 가능성:** 없음 (두 API 모두 어드민 수동 호출 전용)

---

### 1-2. 하드코딩 토큰 `kd-reparse-2026` 제거 (5개 API)

**현재 상태:**
```
batch-pdf-parse:   token === 'kd-reparse-2026' || token === process.env.CRON_SECRET
batch-reparse:     token !== process.env.CRON_SECRET && token !== 'kd-reparse-2026'
batch-reparse-v2:  token === 'kd-reparse-2026' || token === process.env.CRON_SECRET
batch-total-hh:    token === process.env.CRON_SECRET || token === 'kd-reparse-2026'
blog-enrich:       token !== 'kd-reparse-2026' (CRON_SECRET 미사용!)
```

**위험:**
- GitHub public repo에 평문 토큰 노출
- 토큰만 알면 누구나 대량 DB 조작 가능
- batch-pdf-parse: PDF 파싱 재실행 (서버 부하)
- batch-reparse: 블로그 콘텐츠 일괄 재파싱
- batch-total-hh: 세대수 데이터 변경
- blog-enrich: 블로그 59K편 콘텐츠 변경

**수정 계획:**
```typescript
// 방법 A: requireAdmin으로 통일 (권장)
const auth = await requireAdmin();
if ('error' in auth) return auth.error;

// 방법 B: CRON_SECRET만 유지 (batch API는 크론에서도 호출하므로)
const token = searchParams.get('token');
const authHeader = req.headers.get('authorization');
const isAuthed = token === process.env.CRON_SECRET || 
                 authHeader === `Bearer ${process.env.CRON_SECRET}`;
if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
// 'kd-reparse-2026' 참조 완전 삭제
```

**리스크 분석:**
- batch-pdf-parse, batch-reparse, batch-reparse-v2, batch-total-hh는 GOD MODE에서 CRON_SECRET으로 호출함 → CRON_SECRET 인증은 유지해야 함
- blog-enrich만 kd-reparse-2026 토큰 단독 사용 → requireAdmin으로 교체
- 하드코딩 토큰 삭제 시 기존 수동 호출 스크립트가 있다면 깨짐 → 없음 (Claude 세션에서만 사용)
- Git history에 토큰이 남지만, 토큰 자체가 보안 키가 아닌 단순 문자열이므로 삭제만으로 충분

**기존 기능 깨질 가능성:** 없음 (GOD MODE는 CRON_SECRET으로 호출)

---

### 1-3. RLS 미적용 5개 테이블 활성화

**현재 상태:**
| 테이블 | 행 수 | 위험도 | 설명 |
|--------|-------|--------|------|
| apt_complex_profiles | 34,500 | 높음 | 단지백과 전체 데이터 (주소, 가격, 세대수) |
| apt_rent_transactions | 2,109,092 | 높음 | 전월세 거래 내역 (금액, 주소, 면적) |
| popup_ads | 0 | 낮음 | 팝업 광고 데이터 |
| usage_limits | 0 | 낮음 | 사용 제한 설정 |
| marketing_publish_logs | 0 | 낮음 | 마케팅 발행 로그 |

**위험:**
- Supabase anon key는 클라이언트 JS에 노출됨 (NEXT_PUBLIC_SUPABASE_ANON_KEY)
- 브라우저 DevTools → Network → 어떤 API 요청에서든 anon key 추출 가능
- RLS 없는 테이블은 anon key로 직접 REST API 호출 가능:
  ```
  curl https://tezftxakuwhsclarprlz.supabase.co/rest/v1/apt_complex_profiles?select=* \
    -H "apikey: [anon_key]" -H "Authorization: Bearer [anon_key]"
  ```
- apt_rent_transactions 210만건 전체 덤프 가능
- 공개 데이터이기는 하지만, 대량 스크래핑 방지를 위해 RLS 필요

**수정 계획:**
```sql
-- apt_complex_profiles: 누구나 읽기 가능, 수정은 service_role만
ALTER TABLE apt_complex_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON apt_complex_profiles FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE는 정책 없음 → service_role만 가능

-- apt_rent_transactions: 동일
ALTER TABLE apt_rent_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON apt_rent_transactions FOR SELECT USING (true);

-- popup_ads: 읽기는 공개, 수정은 admin만
ALTER TABLE popup_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON popup_ads FOR SELECT USING (true);

-- usage_limits: 본인 것만 읽기
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_read" ON usage_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON usage_limits FOR INSERT WITH CHECK (auth.uid() = user_id);

-- marketing_publish_logs: service_role만 (관리자 전용)
ALTER TABLE marketing_publish_logs ENABLE ROW LEVEL SECURITY;
-- 정책 없음 → service_role만 접근 가능
```

**리스크 분석:**
- apt_complex_profiles, apt_rent_transactions: `FOR SELECT USING (true)`이므로 읽기는 그대로 작동. INSERT/UPDATE/DELETE는 service_role(getSupabaseAdmin)만 가능 → 크론에서 service_role 사용하므로 영향 없음.
- usage_limits: user_id 컬럼이 있는지 확인 필요. 없으면 `USING (true)` 사용.
- marketing_publish_logs: 크론에서 service_role로만 쓰므로 영향 없음.
- popup_ads: 프론트엔드에서 anon key로 읽어오는 곳이 있을 수 있음 → PopupAdManager 확인 필요.

**기존 기능 깨질 가능성:**
- 낮음. 단, PopupAdManager가 createSupabaseBrowser()로 popup_ads를 직접 읽는 경우 RLS 정책 추가 필요.
- 크론/어드민은 모두 service_role 사용하므로 무관.
- 프론트엔드에서 apt_complex_profiles, apt_rent_transactions를 직접 쿼리하는 곳 확인 필요 (SSR에서는 service_role 사용하므로 영향 없음).

---

### 1-4. Admin API 14개 is_admin 미확인 → requireAdmin 전환

**현재 상태:**
이 14개 API는 `createSupabaseServer()` → `auth.getUser()`로 로그인 체크는 하지만, `is_admin` 확인 없음:

| API | 메서드 | 줄수 | 위험 수준 |
|-----|--------|------|----------|
| god-mode | POST,GET | 402 | 극히 높음 (모든 크론 실행) |
| decrypt-phone | POST | 78 | 극히 높음 (전화번호 복호화) |
| push-broadcast | POST | 67 | 높음 (전체 푸시 발송) |
| trigger-cron | POST | 51 | 높음 (임의 크론 실행) |
| fix-apt | POST | 98 | 중간 (부동산 데이터 수정) |
| fix-stock | POST | 128 | 중간 (주식 데이터 수정) |
| pin-post | POST | 33 | 중간 (게시글 고정) |
| batch-ops | POST,GET | 146 | 높음 (대량 DB 작업) |
| backfill-trades | POST | 152 | 중간 (거래 데이터 백필) |
| refresh-apt-cache | POST | 119 | 낮음 (캐시 갱신) |
| trigger-stock-refresh | POST | 41 | 낮음 (시세 갱신) |
| naver-test | GET | 110 | 낮음 (네이버 API 테스트) |
| blog-limit-reset | POST | 24 | 중간 (블로그 제한 해제) |
| audit | GET | 307 | 낮음 (읽기 전용 감사) |

**위험:**
- 카카오 로그인만 하면 일반 유저가 GOD MODE 실행 가능
- 전체 푸시 발송, 전화번호 복호화 가능

**참고:** god-mode와 trigger-cron은 실제 코드 내부에서 is_admin을 직접 체크하고 있음 (확인 완료). 나머지 12개는 진짜로 로그인만 체크.

**수정 계획:**
```typescript
// 각 파일 상단
import { requireAdmin } from '@/lib/admin-auth';

// 각 핸들러 첫 줄
const auth = await requireAdmin();
if ('error' in auth) return auth.error;
const { admin } = auth; // 또는 const { user, admin } = auth;

// 기존 createSupabaseServer + getUser + getSupabaseAdmin → admin 하나로 통일
```

**리스크 분석:**
- god-mode, trigger-cron: 이미 내부에서 is_admin 체크하므로 requireAdmin 추가해도 중복 체크일 뿐, 기능 변화 없음. 안전.
- 나머지 12개: 현재 어드민 패널에서만 호출됨 → requireAdmin 추가 시 어드민 패널 정상 작동 (어드민이 로그인한 상태에서 호출하므로).
- 일반 유저가 이 API를 호출하던 경로는 없음 (프론트엔드에 호출 코드 없음).

**기존 기능 깨질 가능성:** 없음. 어드민만 사용하는 API에 어드민 체크를 추가하는 것이므로.

---

### 1-5. sanitizeHtml regex 기반 → DOMPurify 검토

**현재 상태:**
```javascript
// src/lib/sanitize-html.ts
const DANGEROUS_TAGS = /(<\s*\/?\s*)(script|iframe|object|embed|...)(…)?>/gi;
clean = clean.replace(DANGEROUS_TAGS, '');
clean = clean.replace(EVENT_HANDLERS, ''); // on* 속성 제거
clean = clean.replace(JS_PROTOCOL, '');     // javascript: 제거
```

**위험:**
- regex 기반 HTML 산니타이징은 우회 가능한 것으로 알려져 있음
- 예: `<scr\nipt>`, `<SCRIPT/SRC=...>`, `<img onerror=alert(1)>` 변형
- 현재는 AI 크론이 생성한 콘텐츠만 거치므로 실제 공격 가능성은 낮음
- 하지만 향후 유저 생성 콘텐츠 (블로그 댓글 HTML 등)가 추가되면 위험

**수정 계획:**
```
방법 A (권장): isomorphic-dompurify 도입
  - jsdom 의존성 때문에 Vercel Edge Runtime에서 에러 발생 가능
  - 해결: sanitizeHtml을 서버 컴포넌트에서만 호출 (현재도 그러함)
  - npm install isomorphic-dompurify
  - sanitize-html.ts에서 DOMPurify.sanitize() 사용

방법 B (현실적): 현재 regex 강화
  - 대소문자 혼합 처리 강화 (이미 /gi 플래그 사용 중)
  - HTML 엔티티 디코딩 후 재검사 추가
  - `<img onerror=`, `<svg onload=` 등 추가 패턴 차단
  - 주석 <!-- --> 내부의 위험 코드 제거

방법 C (최적): pre-sanitized HTML 저장
  - 블로그 글 INSERT 시점에 sanitize → html_content 컬럼에 저장
  - SSR 시 marked() + sanitize 재실행 불필요
  - 성능 + 보안 동시 해결
```

**리스크 분석:**
- 방법 A: isomorphic-dompurify는 Node.js 런타임에서만 작동. Vercel Serverless Functions(Node.js 18)에서는 가능하지만, Edge Runtime에서는 불가. 블로그 페이지가 Edge가 아닌 Serverless이므로 사용 가능.
- 방법 B: 기존 구조 유지, 패턴만 추가하므로 가장 안전. 단, regex 기반은 완벽하지 않음.
- 방법 C: DB 스키마 변경 필요 (html_content 컬럼 추가). 59K편 마이그레이션 필요. 가장 근본적이지만 작업량 큼.
- 현재 공격 벡터: AI 크론 콘텐츠만 거치므로 실질적 위험은 낮음. 우선순위는 다른 항목보다 낮을 수 있음.

**기존 기능 깨질 가능성:**
- 방법 A: DOMPurify가 더 엄격하게 필터링하므로 일부 합법적 HTML이 제거될 수 있음 (예: `style` 속성). DOMPurify 설정으로 ALLOWED_TAGS/ALLOWED_ATTR 커스텀 필요.
- 방법 B: 기존 콘텐츠에 영향 없음. 새 패턴만 추가.
- 방법 C: 기존 콘텐츠 마이그레이션 중 에러 가능. 배치 처리 필요.

---

<a id="phase-2"></a>
## Phase 2: 단기 수정 — High 우선순위 (8건)

> 예상 작업 시간: 3~4시간
> 리스크 레벨: 서비스 품질·안정성에 영향

### 2-1. 사용자 API 10개 sanitize 미적용

**대상 API:**
| API | 입력값 | 위험 | 수정 방법 |
|-----|--------|------|-----------|
| likes | post_id (숫자) | 낮음 | `Number(body.post_id)` 타입 강제 |
| bookmarks | postId (숫자) | 낮음 | `Number(body.postId)` 타입 강제 |
| feedback | message, category, rating | 중간 | `sanitizeText(message, 1000)` |
| report | reason, content_id | 중간 | `sanitizeText(reason, 500)` |
| discuss/route | title, content | 높음 | `sanitizePostInput()` 적용 |
| blog/bookmark | blogPostId | 낮음 | `sanitizeId(blogPostId)` |
| blog/helpful | blogPostId | 낮음 | `sanitizeId(blogPostId)` |
| attendance | (입력 없음) | 없음 | 불필요 |
| polls | poll_id, option_index | 낮음 | `Number()` 타입 강제 |
| push/subscribe | subscription 객체 | 중간 | JSON schema 검증 |

**리스크 분석:**
- likes, bookmarks, blog/bookmark, blog/helpful: 숫자 ID만 받으므로 `Number()` 캐스팅만으로 충분. SQL 인젝션 위험 없음 (Supabase는 파라미터화 쿼리 사용).
- feedback, report: 텍스트 입력이 DB에 저장됨 → sanitizeText 필요.
- discuss/route: 제목+내용이 다른 유저에게 표시됨 → sanitizePostInput 필수.
- push/subscribe: subscription 객체의 endpoint URL이 SSRF에 사용될 수 있음 → URL 검증 추가.

**기존 기능 깨질 가능성:** 없음. 타입 강제와 문자열 정리만 추가.

---

### 2-2. blog/bookmark, blog/helpful rate limiting 없음

**현재 상태:** 두 API 모두 `rateLimit` import 없음. 무제한 호출 가능.

**위험:** 봇이 무한 반복 호출 → DB 부하 + 데이터 오염 (북마크/도움됨 수 조작)

**수정 계획:**
```typescript
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';
// GET/POST 핸들러 첫 줄
if (!(await rateLimit(req, 'api'))) return rateLimitResponse();
```

**기존 기능 깨질 가능성:** 없음. 정상 사용자는 120회/분 제한에 걸리지 않음.

---

### 2-3. naver-complex-sync maxDuration 미설정 → 504 매 실행

**현재 상태:** `maxDuration` 없음 → Vercel 기본 10초 타임아웃 → 매번 504

**수정 계획:**
```typescript
export const maxDuration = 120; // 2분
```

**기존 기능 깨질 가능성:** 없음. 타임아웃만 늘어남.

---

### 2-4. safeBlogInsert 15+ 크론 동시 실패 (Anthropic 크레딧)

**현재 상태:** Anthropic API 크레딧 소진 → safeBlogInsert 내부에서 Anthropic 호출 실패 → 15+ 블로그 크론 동시 에러

**수정 계획:**
1. console.anthropic.com에서 크레딧 충전 (근본 해결)
2. safeBlogInsert에 Anthropic 에러 시 graceful fallback 추가:
   - 크레딧 소진 시 AI 생성 건너뛰고 DB 데이터만으로 기본 콘텐츠 생성
   - 또는 큐에 넣고 나중에 재시도

**기존 기능 깨질 가능성:** 없음. 현재도 에러 시 200 반환.

---

### 2-5. vercel.json 중복 크론 2개

**현재 상태:**
- `/api/cron/stock-price`: 두 번 등록 (*/5 0-7, */15 0-6)
- `/api/stock-refresh`: 두 번 등록 (*/5 0-7, 0 14,16,18,20,22)

**수정 계획:** 중복 항목 중 하나 삭제. 의도된 스케줄을 확인 후 병합.

**기존 기능 깨질 가능성:** 낮음. 중복 실행이 사라지므로 오히려 정상화.

---

### 2-6. 사용자 API에서 getSupabaseAdmin() 사용 (RLS 바이패스)

**현재 상태:** alerts, apt/reviews, comments, posts, attendance 등에서 사용자 요청을 service_role로 처리.

**위험:** 의도치 않은 RLS 우회. 사용자 A가 사용자 B의 데이터에 접근 가능할 수 있음.

**수정 계획:**
- 읽기 전용 (SELECT): createSupabaseServer()로 전환 (RLS 적용)
- 시스템 작업 (포인트 적립, 알림 생성 등): getSupabaseAdmin() 유지 (RLS 바이패스 필요)
- 각 API별 개별 검토 필요

**기존 기능 깨질 가능성:** 중간. RLS 정책이 없거나 불완전한 테이블에서 데이터 접근 실패 가능. 개별 테스트 필수.

---

### 2-7~2-8. API 에러 메시지 클라이언트 노출

**대상:**
- `apt/comments`: `error.message` 직접 반환
- `apt-proxy`: `err.message` 직접 반환

**수정 계획:**
```typescript
// Before
return NextResponse.json({ error: error.message }, { status: 503 });
// After
return NextResponse.json({ error: '서비스 일시 오류입니다' }, { status: 503 });
```

**기존 기능 깨질 가능성:** 없음.

---

<a id="phase-3"></a>
## Phase 3: 중기 개선 — Medium 품질 향상 (12건)

> 예상 작업 시간: 1~2일
> 리스크 레벨: 품질·접근성·SEO 향상

### 3-1. CSP 'unsafe-inline' → nonce 기반 전환

**현재 상태:** 미들웨어에서 nonce를 생성하지만 CSP에 적용하지 않음.

**수정 계획:**
- `script-src 'self' 'nonce-${nonce}'` 형태로 전환
- 모든 inline `<script>` 태그에 `nonce` 속성 추가
- JSON-LD `<script type="application/ld+json">` 태그도 nonce 필요

**리스크:** 높음. inline script가 많은 페이지에서 누락 시 기능 깨짐. 카카오 SDK, Toss SDK, Google Analytics 등 서드파티 스크립트도 영향. 단계적 전환 권장.

---

### 3-2. next/image 전환 (img 6건)

**대상 컴포넌트:** AptImageGallery(3), CommentSection(1), ImageUpload(1), AdBanner(1) 등

**효과:** 자동 WebP/AVIF 변환 + lazy loading + 반응형 srcset

**리스크:** 낮음. Supabase Storage, kakaocdn.net 등 remotePatterns 이미 설정됨.

---

### 3-3. 프로필 페이지 민감 필드 제거

**현재 노출 필드:** `is_admin, is_banned, is_seed`

**수정:** select에서 제거 또는 본인만 볼 수 있도록 조건 분기

---

### 3-4. daily_create_limit 80 코드 강제

**현재:** 메모리에만 규칙 존재, 코드에서 미강제.

**수정:** posts POST 핸들러에 오늘 작성 수 체크 추가.

---

### 3-5~3-12. 기타 Medium 항목

- OG API CORS 문서화
- 블로그 SSR 성능 (pre-render HTML)
- 접근성 role/alt 확대
- Admin PII 접근 감사 로그
- 블로그→계산기 내부 링크 자동화
- /author/[name] 페이지 (E-E-A-T)
- calc_history 테이블 (계산기 결과 저장)
- 한국식 숫자 포맷 (만/억)

---

<a id="phase-4"></a>
## Phase 4: 장기 진화 — 기능 확장 로드맵

### 4-1. 블로그 → 계산기 내부 링크 자동화

**설계:**
- enrichContent() 또는 별도 크론에서 블로그 카테고리별 관련 계산기 자동 삽입
- 부동산 블로그 → 취득세/양도세/중개수수료 계산기 링크
- 주식 블로그 → 복리/배당금/PER 계산기 링크
- 59K편 대상 → 배치 SQL UPDATE로 content에 링크 append

**예상 효과:** 내부 링크 밀도 대폭 증가, 계산기 트래픽 유입, SEO 향상

---

### 4-2. 계산기 결과 저장 (calc_history)

**설계:**
```sql
CREATE TABLE calc_history (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  calc_slug text NOT NULL,
  inputs jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE calc_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON calc_history USING (auth.uid() = user_id);
```

**프론트엔드:** CalcEngine에서 로그인 유저 → 결과 자동 저장 → 마이페이지에서 이력 조회/비교

---

### 4-3. /author/[name] 프로필 페이지

**설계:** 블로그 작성자 프로필 페이지. Google E-E-A-T 신호.
- JSON-LD Person 구조화 데이터
- 작성 글 목록, 전문 분야, 자격 정보
- author_name으로 blog_posts GROUP BY

---

### 4-4. GA4 이벤트 (계산기)

**설계:**
- `calc_start`: 계산기 페이지 진입
- `calc_complete`: 결과 표시
- `calc_share`: 공유 버튼 클릭
- `calc_signup_click`: CTA 클릭

---

### 4-5. 전월세 탭 UI

**설계:** apt_rent_transactions 2,109,092건 활용. 지역별/면적별/시기별 전월세 시세 조회.

---

<a id="risk-matrix"></a>
## 리스크 매트릭스

| # | 항목 | 수정 난이도 | 기능 깨질 확률 | 롤백 용이성 | 우선순위 |
|---|------|-----------|--------------|-----------|---------|
| 1-1 | 무인증 API 2개 | 쉬움 (5분) | 0% | git revert | P0 즉시 |
| 1-2 | 하드코딩 토큰 | 쉬움 (10분) | 0% | git revert | P0 즉시 |
| 1-3 | RLS 5개 테이블 | 중간 (20분) | 5% | DROP POLICY | P0 당일 |
| 1-4 | is_admin 14개 | 쉬움 (30분) | 0% | git revert | P0 당일 |
| 1-5 | sanitizeHtml | 높음 (2시간) | 10% | git revert | P1 이번주 |
| 2-1 | sanitize 10개 | 쉬움 (20분) | 0% | git revert | P1 이번주 |
| 2-2 | rate limit 2개 | 쉬움 (5분) | 0% | git revert | P1 이번주 |
| 2-3 | maxDuration | 쉬움 (1분) | 0% | git revert | P1 즉시 |
| 2-5 | 중복 크론 | 쉬움 (5분) | 5% | vercel.json 복원 | P2 이번주 |
| 2-6 | adminSB 전환 | 높음 (2시간) | 20% | git revert | P2 다음주 |
| 3-1 | CSP nonce | 매우 높음 | 30% | git revert | P3 다음달 |

---

<a id="rollback"></a>
## 롤백 전략

### 코드 변경 (Phase 1~2)
```bash
# 문제 발생 시 즉시 롤백
git log --oneline -5           # 커밋 해시 확인
git revert <commit_hash>        # 해당 커밋 되돌리기
git push origin main            # Vercel 자동 배포
```
- Vercel은 이전 빌드로 즉시 롤백 가능 (Dashboard → Deployments → Promote)
- 롤백 소요시간: ~2분 (빌드 + 배포)

### DB 변경 (RLS)
```sql
-- RLS 롤백: 정책 삭제 + RLS 비활성화
DROP POLICY IF EXISTS "public_read" ON apt_complex_profiles;
ALTER TABLE apt_complex_profiles DISABLE ROW LEVEL SECURITY;
```
- Supabase SQL Editor에서 즉시 실행 가능
- 롤백 소요시간: ~10초

### 작업 순서 (안전 우선)
1. **먼저 테스트:** Vercel Preview 배포로 검증
2. **한 번에 하나씩:** 커밋 1개 = 변경 1종류
3. **모니터링:** 배포 후 5분간 Vercel Runtime Logs 확인
4. **야간 작업 회피:** 한국 시간 오전 10시~오후 6시에 작업 (트래픽 낮은 시간)

---

<a id="testing"></a>
## 테스트 체크리스트

### Phase 1 배포 후 확인

**1-1. requireAdmin 추가 후:**
- [ ] 어드민 로그인 → /api/admin/blog-enrich POST 정상 응답
- [ ] 비로그인 → /api/admin/blog-enrich POST → 401 반환
- [ ] 일반 유저 로그인 → /api/admin/blog-enrich POST → 403 반환
- [ ] 어드민 패널 대시보드 정상 로딩

**1-2. 하드코딩 토큰 제거 후:**
- [ ] GOD MODE → 전체 실행 정상 (CRON_SECRET으로 호출)
- [ ] `?token=kd-reparse-2026` → 401 반환 (더 이상 작동 안 함)

**1-3. RLS 활성화 후:**
- [ ] /apt/complex/[name] 페이지 정상 렌더링
- [ ] /apt/[id] 페이지 전월세 데이터 표시 정상
- [ ] 어드민 패널 부동산 섹션 정상
- [ ] 블로그 크론 정상 실행 (apt_complex_profiles 조회)

**1-4. is_admin 체크 추가 후:**
- [ ] 어드민 → GOD MODE 정상 실행
- [ ] 어드민 → decrypt-phone 정상 작동
- [ ] 어드민 → push-broadcast 정상 발송
- [ ] 일반 유저 → 위 API들 → 403 반환

### Phase 2 배포 후 확인
- [ ] 좋아요/북마크 정상 작동
- [ ] 블로그 북마크/도움됨 정상 + 빠른 연속 클릭 시 429 반환
- [ ] naver-complex-sync 크론 504 없이 완료
- [ ] 에러 응답에 DB 상세 메시지 없음

---

## 요약: 실행 로드맵

```
Week 1 (즉시):
  ├── Phase 1-1: blog-enrich, verify-households requireAdmin 추가
  ├── Phase 1-2: kd-reparse-2026 토큰 제거
  ├── Phase 1-3: RLS 5개 테이블 활성화
  ├── Phase 1-4: Admin API 14개 requireAdmin 전환
  ├── Phase 2-2: blog/bookmark, blog/helpful rate limit 추가
  ├── Phase 2-3: naver-complex-sync maxDuration 120 설정
  └── Phase 2-5: vercel.json 중복 크론 제거

Week 2:
  ├── Phase 2-1: sanitize 미적용 10개 API 입력 검증
  ├── Phase 2-7~8: 에러 메시지 노출 제거
  ├── Phase 3-3: 프로필 민감 필드 제거
  └── Phase 3-4: daily_create_limit 코드 강제

Week 3~4:
  ├── Phase 1-5: sanitizeHtml DOMPurify 전환 또는 강화
  ├── Phase 2-6: getSupabaseAdmin → createSupabaseServer 전환
  ├── Phase 3-2: next/image 전환
  └── Phase 3-5~12: 기타 Medium 항목

Month 2+:
  ├── Phase 4-1: 블로그→계산기 내부 링크
  ├── Phase 4-2: calc_history 테이블
  ├── Phase 4-3: /author/[name] 페이지
  └── Phase 4-4: GA4 이벤트
```

---

> 이 문서는 세션 72 기준으로 작성되었습니다.
> 각 Phase 완료 시 STATUS.md에 반영하고, 이 문서의 체크리스트를 업데이트합니다.
