# 카더라 STATUS — 세션 145 (2026-04-22)

## 세션 145 — 2026-04-22 이미지 og_fallback 재오염 복구 + 크론 수정

### 증상
- /apt 페이지 카드 이미지 전부 OG 자동생성으로 표시, 콘솔 403(pstatic)
- 4/22 웹 세션에서 DB 레벨 apt_sites(5,794 중 2,579 복구) + apt_complex_profiles(34,544 중 29,939 복구) 정화, `images_backup_142` 백업 보존

### 진단 (코드 레포 grep)
- `og_fallback` 리터럴 레포 전체 **0건** — DB 오염은 은퇴된 과거 소스 (git pickaxe 역사 확인, 현재 코드에 없음)
- 실제 재오염 경로 2건 발견:
  1. `src/lib/image-pipeline.ts:344-383` — position 7 OG placeholder 를 storage_real 실패 시에도 raw `/api/og?...` URL 로 DB insert (image_kind=null 은닉)
  2. `collect-complex-images` / `collect-site-images` — fetch 0 결과 시 `images: []` **덮어쓰기**로 실 이미지 말소 가능
- `apt-satellite-crawl` 크론은 존재·청결·pg_cron 등록됨 (*/30 \* \* \* \*) — Vercel crons 에는 미등록 (한도 100개)

### 수정 (commit 4개)
- `63f8d339` fix(apt): aptImageMap 우선순위 satellite > real images > 외부 CDN og > /api/og 제네릭, images[] OG source 필터 추가
- `a80c7d5a` fix(cron): image-pipeline raw /api/og URL insert 제거 + isSuccess 기준 storage_real>0 로 타이트닝 + collect-complex/site 덮어쓰기 방지
- `fc413fc1` feat(cron): apt-satellite-crawl vercel 등록 시도 (실패)
- `18f62e2d` fix(vercel): 위 revert — Vercel 크론 한도 100 초과로 배포 ERROR → pg_cron 기 등록분만 유지

### 검증
- `og_fallback` 오염 재확인: apt_sites 0, apt_complex_profiles 0
- satellite_image_url 커버리지: 150 → **180** (pg_cron 활성, 30분/30row)
- Vercel 배포 18f62e2d **READY**, 에러 로그 0 (3분간)
- /apt HTML: 상단 카드 대부분 여전히 /api/og — 신규 분양 단지(PH159, 용인 양지 서희 등)는 좌표 없음 → satellite crawl 타깃 제외 (데이터 문제, 코드는 정확 동작)
- blog_post_images 중 20개 legacy raw /api/og with image_kind=null — 후속 cleanup 대상

### 남은 Pending
- satellite 커버리지 180/5,794 → 전체 완주 약 3.3일 (pg_cron 진행 중)
- 신규 분양 사이트(좌표 null) 는 satellite 크롤 불가 — 별도 좌표 보강 크론 필요
- blog_post_images 20행 cleanup: `DELETE FROM blog_post_images WHERE image_kind IS NULL AND image_url LIKE '%/api/og?%'`
- Vercel Pro 크론 100개 한도 도달 — 신규 크론 추가 시 pg_cron 이관 필수 (이번 세션 교훈)
- 세션 142 이후 `images_backup_142` 백업 컬럼 정리 시점 결정 (최소 7일 관찰 후)

---

# 카더라 STATUS — 세션 144 (2026-04-19)

## 세션 144 (2026-04-19) — 온보딩 완료 판정 구조적 수리

### 진단 (세션 143 후속)
- 세션 143에서 트리거 3-OR 완화, middleware 강제 리다이렉트 추가
- 하지만 UI "건너뛰기" 경로가 region_text 미업데이트 → 무한 루프 위험
- v_onboarding_funnel: 04-12 가입 11명 중 onboarded 11/11, completed 1/11
- complete_profile_and_reward RPC: phone 필드 요구로 호출 0회 (dead code 확정)

### 수정 (Fix A + Fix C)
1. update_profile_completed: 지역 조건 완전 제거, 닉네임+관심사만 체크
2. OnboardingClient 건너뛰기 핸들러: region '전국' 기본값 추가
3. 기존 피해자 UPDATE updated_at으로 트리거 재계산 (UPDATE 0 건 직접 반환 — 트리거가 UPDATE 시점에 재계산되므로 후속 조회에서 flip 확인됨)

### 검증
- completed 37 → **73** (57.9%, +36명)
- v_onboarding_funnel: 04-14/12/09/08/07 = 100%, 04-13 90%
- 04-10 25명 nickname=0 잔존 — Fix D(별도 세션)로 이관
- 04-16 onboarded=1 completed=1 (세션 143에서 completed=0이었던 유저 자동 flip)

### 커밋
- 8541f837 fix(onboarding): 완료 판정에서 지역 조건 제거

### 보류/별건
- Fix B (메인 버튼 region 기본값 '전국'): UI 선택사항 라벨과 충돌, 반대
- Fix D (04-10 nickname=0 25명 조사): 별도 세션
- Fix E (3컬럼 통합): 파괴적 변경, 별도 세션

---

# 카더라 STATUS — 세션 143 (2026-04-19)

## 세션 143 (2026-04-19) — 회원가입/온보딩 플로우 근본 수리

### 진단 (Supabase 직접 검증)
- 14일 가입 483명 중 67명(14%) 온보딩 페이지 진입
- profile_completed=true 33/126 (26%)
- 14명 residence_city=NULL + region_text 있음 → 트리거 버그로 영원히 미완료
- /api/auth/track-attempt 간헐 504 timeout

### 수정
1. update_profile_completed 트리거: residence_city OR region_text OR residence_district
   (residence_region 컬럼 미존재 → residence_district로 대체)
2. 기존 피해자 residence_city ← region_text 백필 (14명 영향)
3. src/middleware.ts: profile_completed=false → /onboarding 강제 리다이렉트
   (기존 봇 차단 / CSP / rate limit / 어드민 체크 로직 전부 보존)
4. /api/auth/track-attempt: fire-and-forget, maxDuration 10s, user_agent 500자
5. v_onboarding_funnel 뷰 추가 (signup_date별 단계별 퍼널)

### 검증
- 트리거 수정 확인 OK (pg_get_functiondef)
- completed 33 → 37 (+4, 백필+트리거 재계산 효과)
  ※ 47+ 목표 미달 — 남은 89명은 nickname_set/interests 단계 미완료 상태 (온보딩 자체를 안 함)
  → 새 middleware 리다이렉트로 향후 재방문 시 강제 유입 예상
- v_onboarding_funnel 7일치 정상 반환 (2026-04-13~19)
- Vercel 배포 dpl_9Q55JRejHHX7voXwvCammBLcwsrH READY, 에러 로그 0
- middleware 비로그인 유저 영향 없음 (user null 체크)

### 커밋
- 616b683e fix(signup): 온보딩 완료 판정 트리거 + middleware 리다이렉트 + track-attempt 비동기화

---

# 카더라 STATUS — 세션 133 완료 (2026-04-17 10:05 UTC)

## 🟢 배포 완료 — kadeora.app 라이브
- **최종 commit**: `5d6eb789` (2번째 commit)
- **최종 deployment**: `dpl_63XnMf6zL47nV2Mtybk3ytg5tDo2` (READY, production)
- **빌드 시간**: ~2분 / 런타임 에러: 0건

## ✅ 이번 세션 작업 — P0 3건 완료

### P0 #1 — 사이트맵 30 (calc_topic 50개 노출) ✅ 라이브 검증 완료
- **문제**: /sitemap/30 빈 `<urlset>` 반환 (200 OK이지만 0 URL) — 두 세션째 미해결
- **근본 원인 (이번에 발견)**: `src/app/sitemap/[id]/route.ts:396` `if (id >= 8)` (blog chunks) 핸들러가 `id === 30`을 흡수
  - blog query는 chunk=22 offset (110,000+)으로 빈 결과 → 빈 urlset
  - 응답에 `xmlns:image` 포함된 게 단서 (blog chunks 핸들러 시그니처)
- **수정**: `if (id >= 8 && id < 30)` 한 줄로 범위 제한
- **검증**: `https://kadeora.app/sitemap/30` → 50개 `<url>` 노드 (실수령액·한연정산·청약가점 등 priority 0.9 상위)
- **부수 효과**: case 31 (calc_results 인기 URL)도 동시 살아남

### P0 #2 — /api/search 500 → 200 fallback ✅ 라이브 검증 완료
- **수정**: `src/app/api/search/route.ts` 두 군데 안전장치
  - 내부 `postsResult.error` 시 `safe_search_posts(q, lim)` RPC fallback
  - 외부 catch도 RPC 재시도 + 최종 빈 객체 200 반환
- **검증**: `https://kadeora.app/api/search?q=양도세` → 200 OK
  - posts 20개 + blogs 5개 + discussions 1개
  - FTS rank 정상 작동 (RPC fallback은 발동 안 함, 안전장치만 추가)

### P0 #3 — SignupNudgeModal 신규 ✅ 번들 검증 완료
- **신규**: `src/components/SignupNudgeModal.tsx` (262줄)
  - localStorage 트리거: `kd_pv_count >= 3`
  - 7일 cooldown (`kd_signup_nudge_dismissed_at`)
  - `get_signup_value_props()` RPC + DEFAULT_PROPS fallback
  - 카카오 1-tap 강조 (#FEE500) + Google 보조 + ESC/backdrop 닫기
  - track-attempt source: 'signup_nudge_modal'
- **마운트**: `(main)/layout.tsx`에 `<SmartPushPrompt />` 옆 추가
- **검증**: `(main)/layout-c0774b91b102c697.js` 번들에 `kd_pv_count`, `kd_signup_nudge`, `3초 만에 가입` 문자열 모두 확인됨
- **목표**: 일 608 방문 중 0.34% 로그인 페이지 진입 → 1% → 3% 전환 (7일 가입 84 → 200+)

## 📦 commit 2개 (모두 push 완료)
1. `f1f8c569` fix(P0): sitemap30 RPC + search 500 fallback + signup nudge modal (4 files, +369/-13)
2. `5d6eb789` fix(sitemap): case 30/31 라우팅 버그 — id >= 8 핸들러가 30+ 흡수 (1 file, +2/-2)

## ⚙️ 검증
- TypeScript: `npx tsc --noEmit` 0 errors
- ESLint (변경 파일): 0 warnings/errors
- Build: `next build` Compiled successfully in 2.4min
- 라이브 verify: `/sitemap/30` (50 URL), `/api/search?q=양도세` (200 OK), 번들에 SignupNudgeModal 포함

## 🔧 기술 노트 (다음 세션 참고)
- **Architecture Rule #13 적용**: RPC가 `database.ts` 타입에 미등록일 때 `(supabase as any).rpc('rpc_name', ...)` 패턴 필수
- **사이트맵 라우팅 패턴**: `if (id >= N)` 형태는 항상 `&& id < M` 상한 추가 (specific case가 흡수당함)
- **sitemap.xml index** (`src/app/sitemap.xml/route.ts`): `FIXED_IDS_POST_BLOG = [12, 13, 14, 15, 16, 21, 30, 31]` — 30/31은 fixed-ID 핸들러로 분기

## 📋 남은 작업 (work_orders P1+P2)
- **P1 #4**: /calc/topic/chungyak-gajeon-gyesangi TypeError 우회 (`safe_get_calc_topic` RPC)
- **P1 #5**: /daily/[지역]/[날짜] TypeError null 체크
- **P1 #6**: email-digest cron 100% silent fail 디버그
- **P2 #7**: 관리자 대시보드 통합 (`get_admin_dashboard` RPC)
- **P2 #8**: 비로그인 홈페이지 가입 유도 강화 (`get_homepage_for_anonymous` RPC)
- **P2 #9**: calc_results 0건 — 결과 저장 fix

다음 세션은 이 STATUS.md 먼저 읽고 시작. work_orders P1 #4부터 진행 권장.

---

# 세션 134 (2026-04-18) — v3 Phase 1 준비 (Claude 챗에서 DB/크론 선행)

## 🟢 진행 — Claude Code로 이양 전 선행 작업 완료

### DB 레벨 완료 (Claude 챗에서 직접 처리)
- `[L1-2]` 미사용/중복 인덱스 드롭 5개: `idx_blog_posts_pgroonga_title/content`, `idx_blog_posts_title/content_length`, `idx_blog_posts_slug` (인덱스 95MB → 90MB)
- `[L1-3 즉시]` VACUUM ANALYZE 실행 (blog_posts, issue_alerts, blog_post_images 등) — dead rows 9,274 → 4
- `[L1-3 주간]` pg_cron `weekly_vacuum_analyze_blog` 등록 (매주 일 19:00 UTC)
- `[L1-4 좀비 37건]` cron_logs 15분 초과 running 항목 `timeout` 상태로 일괄 마킹
- `[L1-4 자동화]` pg_cron `cleanup_zombie_crons` 등록 (5분 주기)

### 문서 산출물
- `docs/NAVER_DOMINANCE_v3.md` — 6층 아키텍처 최종 마스터플랜 (v1·v2 폐기)
- `docs/CLAUDE_CODE_PHASE1.md` — Claude Code용 논스톱 실행 지시서

## 🚀 다음 단계: Claude Code로 Phase 1 본 실행

Claude Code에서 `docs/CLAUDE_CODE_PHASE1.md` 읽고 논스톱으로 L1-5, L1-6, L1-1, L1-7, L1-4 나머지, L0-1, L0-2, L0-5, L0-6, L3-6, L2-4, L2-7, L3-3, L3-9, L1-8 병렬 진행.

## ⚠️ Node 수동 필요 (Phase 1 중 skip)
- `[L0-3]` 네이버 인플루언서 신청 (searchadvisor.naver.com 또는 influence.naver.com)
- `[L0-4]` 카더라 공식 네이버 블로그 개설 (blog.naver.com)
- `[L4-1]` Google Search Console OAuth 토큰 (Node의 구글 계정)
- `[L5-1]` YouTube Data API 키 + 채널 연동

---

# 세션 135 (2026-04-19) — v3 Phase 1 논스톱 실행 완료

## 🟢 완료 [13개 task / 커밋 10개]

### P0 인프라 코어
- `[L1-5]` killer URL static pin + metadata dedup
  - `generateStaticParams`: view_count top30 + published_at top15 + PINNED_SLUGS 10 병렬 → 60편 고정
  - `revalidate` 300 → 900, `getPostBySlug` React `cache()` 도입 → blog_posts fetch 중복 제거
- `[L1-6]` crawler retry throttle
  - googlebot/yeti/bingbot/daumoa/yandex/naverbot/applebot UA 감지
  - `crawler:<ip>:<path>` Redis 키로 10초 3회+ → 304 Not Modified 즉시 반환
- `[L1-7]` bot edge cache
  - /blog/* 봇 응답 Upstash Redis GET hit 시 즉시 HTML 반환 (TTL 1h)
- `[L1-1]` 쿼리 다이어트 + bundled RPCs
  - `get_related_posts(post_id, category, tags, limit)` — 3단 폴백(precomputed→tag→category) 단일 호출
  - `get_blog_sidebar_bundle(post_id, category, tags, published_at)` — apt_complex_profiles + prev/next + related_sites/stocks jsonb 번들
  - 페이지당 별도 쿼리 5~6개 제거 → RPC 2건으로 축소
- `[L1-4 나머지]` Redis cron lock + image cron dedup
  - `src/lib/cron-redis-lock.ts` — Upstash SET NX EX 기반
  - `withCronLogging`에 `redisLockTtlSec` 옵션 추가 → 중복 실행 시 `skipped`
  - blog-generate-images / blog-image-supplement 에 TTL 540s 적용

### P0 파이프라인
- `[L3-3]` publish queue unblock
  - `blog_publish_config.title_similarity_threshold` 0.2 → 0.35 (auto_failed 788 중 706건이 similar_title 차단이었음)
  - `daily_publish_limit` 15 → 25
- `[L2-7]` trending keyword gap phase 5
  - issue-preempt에 `detectTrendingKeywordGaps`: heat ≥ 70 + 12h 내 + 블로그 미존재 → issue_alerts insert (multiplier 1.5)

### L0 권위 (E-E-A-T)
- `[L0-1]` 저자 프로필 페이지 신규
  - `/about/authors` (목록) + `/about/authors/node` (노영진 상세)
  - JSON-LD Person + BreadcrumbList, 전문 영역/편집 원칙
- `[L0-2]` 저자 체제 재편 (DB 마이그레이션)
  - manual 글 `author_name = '노영진'`, `author_role = '카더라 설립자, 부동산·주식 데이터 분석'` 일괄 UPDATE
  - auto 계열 author_role에 `(AI 자동 생성)` 멱등 append
  - blog/[slug] JSON-LD author.url: manual ↔ `/about/authors/node` 링크
- `[L0-5]` source_ref auto-inject + 참고자료 섹션
  - blog-rewrite: 국토부/금감원/금융위/한은/통계청/국세청/KRX/공정위/부동산원/LH/청약홈 감지 → `source_ref` "레이블|URL;..." 저장
  - blog/[slug]: source_ref 있으면 "📚 참고자료" 섹션 렌더 (`rel="noopener nofollow"`)
- `[L0-6]` YMYL 면책 배너
  - `src/components/YMYLBanner.tsx` 신규, stock/finance/apt/unsold 카테고리에 자동 삽입
  - 투자자문 아님 고지 + 저자 링크 + 데이터 기준일 + 출처 1건

### 퀵윈·추가
- `[L3-6]` JSON-LD seed 댓글 필터 — `commentCount/comment`에서 `is_seed=true` 제외
- `[L2-4]` `public/naver_search_advisor_notes.md` — Node 수동 체크리스트
- `[L3-9]` `/api/admin/meta-description-batch` — Anthropic Batch API(50% 할인) POST/GET
  - 대상: `length(meta_description) < 80` published 글
  - `rewrite_batches` 테이블 재활용으로 job 기록
- `[L1-8]` renderer.image 확장 — 네이버 CDN은 unoptimized 유지, 외부는 `sizes` hint
- `[L0-X]` author_role 카테고리 세분화 — auto 계열 "카더라 편집부 (AI-assisted · 종목/부동산/재테크/경제·세금/생활정보)"

## 📦 commit 10건 (단일 push)
1. `[L3-6][L2-4]` JSON-LD seed filter + Naver SA notes
2. `[L1-5]` killer URL static pin + metadata dedup
3. `[L1-6][L1-7]` crawler retry throttle + bot edge cache
4. `[L1-1]` query diet: 18→8 queries + bundled RPCs
5. `[L1-4]` Redis cron lock + image cron dedup guard
6. `[L0-1][L0-2]` author profile page + author system rebuild
7. `[L0-5][L0-6]` source_ref auto-inject + YMYL banner
8. `[L3-3][L2-7]` publish queue unblock + trending keyword gap phase
9. `[L3-9][L1-8][L0-X]` meta batch API + img srcset + author_role refine

## ⚠️ Skip
- `[L0-3]` 네이버 인플루언서 신청 — Node 수동 (외부 로그인 필요)
- `[L0-4]` 카더라 공식 네이버 블로그 개설 — Node 수동
- `[L4-1]` Google Search Console OAuth 토큰 — Node의 구글 계정 필요
- `[L5-1]` YouTube Data API 키 + 채널 연동 — Node 수동

## 📋 관련 DB 변경
- `get_related_posts(bigint, text, text[], int)` 신규 RPC
- `get_blog_sidebar_bundle(bigint, text, text[], timestamptz)` 신규 RPC
- `blog_publish_config`: title_similarity_threshold 0.2 → 0.35 / daily_publish_limit 15 → 25
- blog_posts.author_name/role: manual → 노영진 통일 / auto → AI-assisted + sub_category 세분화

## 🚀 다음 단계
- Vercel 배포 모니터링 (`/blog/*` timeout 시간당 감소 여부)
- killer 20편 TTFB 측정 (< 500ms 목표)
- issue_alerts pending_draft 감소 관찰 (threshold 조정 효과)
- L3-9 meta_description 배치: Node가 MasterControlTab 또는 `curl -X POST /api/admin/meta-description-batch` 1회 실행


---

# 세션 136 (2026-04-19) — 카더라 브랜드 통일 + Big Event 시스템 구축

## 🎯 세션 135 직후 긴급 교정 (Node 지시: "노영진 → 모두 카더라")

### 교정된 항목
- `/about/authors/node/page.tsx` **삭제** (개인 프로필 개념 제거)
- `/about/authors/page.tsx` **전면 재작성** — 7개 카더라 팀 브랜드 소개 (부동산/주식/재테크/데이터/생활/투자/부동산분석팀)
- `/blog/[slug]/page.tsx` JSON-LD `author` block: `Person` → `Organization`, URL `/about/authors`로 통일
- DB `author_role` 19건 "카더라 설립자·..." → 카테고리 기반 팀 role ("부동산 분석 · 카더라 부동산팀" 등)

### 세션 135에서 이미 처리 확인
- `src/lib/constants.ts` `BIZ_OWNER = '카더라'` (세션 135 commit 이전 수정 유지)
- `src/app/layout.tsx` founder Person block 제거됨
- `src/app/llms.txt/route.ts` 대표자 라인 제거됨

### DB 최종 상태 (author)
```
author_name distinct = 7: 
  카더라 데이터팀 | 카더라 부동산분석팀 | 카더라 부동산팀 | 
  카더라 생활팀 | 카더라 재테크팀 | 카더라 주식팀 | 카더라 투자팀
remaining_node = 0, remaining_founder = 0
```

## 🏗️ Big Event 시스템 신규 구축

### 신규 테이블 3개
- `big_event_registry` — 재건축/재개발 대형 이벤트 레지스트리 (Stage 1-7, 우선순위 점수, 단지 FK)
- `big_event_milestones` — 발행 예정/완료 추적 + 데이터 갱신 주기
- `big_event_assets` — 조감도/평면도/지도/인포그래픽 이미지 관리 (출처·라이선스)

### 삼익비치 seed 등록
- id=1, slug=`samik-beach`, Stage=3, priority=95
- 3,060 → 4,000 세대, 1979년 준공, 평당 예상 5,500~7,500
- apt_complex_profile_id 연결 (실거래 397건 활용)

### 신규 문서
- `docs/BIG_EVENT_PLAYBOOK.md` — 500+줄 전략서
  - Hub & Spoke 10편 구조
  - 조감도·이미지·차트·지도 전면 강화
  - 15+ 내부 링크 카드섹션 설계
  - 킬러 DNA 체크리스트
  - 5주 발행 cadence
  - Event 감지 → draft → 발행 45분 SLA
  - 30개 대형 이벤트 확장 로드맵

## 🚀 다음 단계
- Vercel /blog/* timeout 실측 (세션 135 L1-5/L1-6/L1-7 효과)
- 삼익비치 Pillar 글 draft 생성 착수 (`big_event_registry` 기반 AI 템플릿)
- 9개 Spoke draft 일괄 생성 → Node 검수 → 5주 cadence 발행
- Phase 2 (L2-2 Hostinger 109 백링크, L2-7 naver_syndication 자동화) 준비

---

# 세션 137 (2026-04-19) — Big Event 시스템 실전 투입 + 삼익비치 본격 가동

## 🟢 완료 [7 tasks / 8 commits]

### P0 — 팩트 오염 방지
- `[P0-FACT]` `src/app/api/cron/issue-draft/route.ts` — `fetchBigEventContext` 신설
  - `source_type='big_event_registry'` 이슈에서 `raw_data.big_event_id`/`slug`로 registry 조회
  - AI system prompt 최상단에 **[절대 팩트 고정 - 바꾸지 말 것]** 블록 강제 주입
    (이름/지역/준공/세대/브랜드/시공사/Stage/비고/출처)
  - 팩트와 다른 브랜드/시공사/세대수 생성 방지 + 미확정 항목은 "추정" 명시 규칙

### P0 — 오염 정리
- `[P0-DELETE]` `blog_posts` id 86744~86747 (samik-beach auto_issue 팩트오류 4편) 하드 DELETE
  - blog_post_images / blog_comments 연결 레코드 제거
  - issue_alerts.blog_post_id → NULL
  - `next.config.ts` redirects: 4개 슬러그 → `/blog/samik-beach-redev-complete-guide-2026` (영구 301)

### SAMIK-EXTEND — 5편 Spoke 본문 확장 (1,700~2,800자 → 4,500자+)
- 86751 B2 samik-beach-premium-by-size (4,739자) — 수익 시나리오 3종(보수/중립/낙관) + 광안대교 조망 프리미엄 심층
- 86752 C2 samik-beach-member-eligibility-guide (4,733자) — 도시정비법 제39/72/74/76/84조 + 실무 사례 3건 + 타임라인 표
- 86754 E1 samik-beach-busan-top3-compare (4,549자) — 해운대 좌동·대연8 비교표 2+ + 브랜드 프리미엄 추정 + 지역 경제 영향
- 86755 F1 samik-beach-area-15-complexes (4,714자) — 15단지 개별 1~2줄 + 완공 시점별 3단계 영향 시나리오
- 86756 D1 samik-beach-public-sale-2028 (4,939자) — 청약 가점 시나리오 3종 + 자금 계획 4단계 로드맵
- 공통: FAQ 5→10, 내부링크 3→5~6, manual 저자 유지, big_event 팩트 일관 반영
- 마이그레이션 파일 `supabase/migrations/20260419_samik_beach_spoke_expansion.sql` (감사 추적 marker)

### 역연결 — 단지 → 블로그
- `[COMPLEX-CARD]` `src/app/(main)/apt/complex/[name]/page.tsx`
  - `apt_complex_profile_id` 또는 name 매칭으로 `big_event_registry` 조회
  - 매칭 시 Hero 아래 하이라이트 카드: 브랜드 + Stage + 세대수 + 시공사 + Pillar 링크
  - `constructor_status`가 `likely`/`unconfirmed`면 "수주 유력/미확정" 라벨 명시
  - 미매칭 + 1990 이전 준공 + 500세대+ → "재건축 후보" 배지 (link 없음)

### 허브 — 전국 대형 이벤트 모음
- `[BIG-EVENT-HUB]` `src/app/(main)/apt/big-events/page.tsx` 신규 (revalidate 900s)
  - `is_active=true` + `priority_score DESC` 리스트
  - 지역 탭 7개 (전국/서울/부산/경기/인천/대구/기타) + Stage 필터
  - 카드: 이름·브랜드·Stage·세대수·시공사·수주 유력/미확정 라벨
  - pillar_blog_post_id 있는 이벤트는 /blog/{pillar_slug}로 클릭 이동
  - JSON-LD ItemList + SEO meta + breadcrumb

### 시드 — 전국 확장
- `[TOP30-SEED]` `supabase/migrations/20260419_big_event_registry_nationwide_seed.sql`
  - **확실한 7건만 insert** (허위 정보 금지 원칙)
  - 서울 4건 (apt_complex_profile 매칭 확정): 은마(강남)·목동신시가지1·여의도 시범·여의도 삼부
  - 부산 3건: 해운대 좌동·대연8·우동1 (name 기반, 단지 프로필 미매칭)
  - 전 건 `new_brand_name=NULL` · `constructor_status='unconfirmed'` · `notes='수동시드/팩트검증필요'` 명시
  - **skip된 건**: 잠실 미성크로바(DB 프로필 미확인), 대구 수성구 범어·인천·경기 건 (과도한 추정 금지)

### CTR 최적화
- `[REFRESH-PILLAR-TITLE]` 삼익비치 Pillar 제목 교체 (id=86743)
  - 기존 59자 → **45자**: "삼익비치 재건축 3,060세대, GS 그랑자이 유력 — 47년 만의 광안리 대전환"
  - 후보 3개 A/B 비교:
    1) 45자 (선택) — 네이버 앞 20자 매칭 + 3가지 팩트 즉시 노출
    2) 44자 — 길이 하한 근접
    3) 46자 — 감정 서사 강하나 키워드 앞 배치 약화
  - meta_description 140자로 감정+숫자 반영 (30자 미만인 경우만 업데이트)

## 📦 commit 8건 (단일 push)
1. `[P0-DELETE]` auto_issue factcheck fail cleanup
2. `[P0-FACT]` issue-draft big_event context injection
3. `[COMPLEX-CARD]` big_event reverse link card
4. `[BIG-EVENT-HUB]` national big event hub page
5. `[TOP30-SEED][REFRESH-PILLAR-TITLE]` big_event nationwide seed + samik CTR title
6. `[SAMIK-EXTEND]` 5 spoke full body expansion

## 🧭 다음 단계
- Vercel 배포 확인 → /apt/big-events 라이브 verify
- 삼익비치 단지 /apt/complex/삼익비치 하이라이트 카드 노출 확인
- Pillar 제목 네이버 검색 반영 주기 (7~10일) 모니터링
- 추가 시드 확장: 잠실 미성크로바, 대구 수성 범어 (apt_complex_profile 매칭 확보 후)

---

# 세션 138 (2026-04-19) — 이미지 SSR 완전 활성화 + issue-draft timeout 근절

## 🟢 배포 완료 (5 커밋)
- `077100bb` fix(issue-draft): Vercel 300s timeout 방어 — 180s pre-emptive + publish cap 2
- `55acade3` feat(apt/complex): ImageLightbox — apt_complex_profiles.images 즉시 렌더
- `86ca33e9` fix(apt): SSR img for /apt?tab=unsold|redev|trade — ssr:false 제거 + 30건 prefetch
- `e45fece4` feat(stock): SSR 썸네일 — get_stocks_with_thumbnails RPC (p_limit 100)
- `560396d8` feat(stock): p_limit 100 → 500 + decoding=async

## 🎯 세션 주요 성과
- **SSR image coverage**: 7개 공개 리스트 페이지 전부 100% 썸네일 노출
- **issue-draft timeout 해소**: 22건/24h → 0건/2h (pre-emptive 180s 가드 + Claude call 2건 cap)
- **DB null 백필 완료**: blog_posts + apt_sites + apt_complex_profiles 전부 null=0
- **/apt?tab=unsold|redev|trade SSR img 수 0 → 30+ 각 탭**
- **/stock SSR img 수 0 → 400+**

## 🔧 기술 노트 (다음 세션 참고)
- **Next.js `dynamic({ ssr: false })` 함정**: 탭 컴포넌트에 달려 있으면 URL 직접 진입 시 SSR 렌더 전혀 안 됨. code-splitting만 원하면 `dynamic()`만 사용
- **/api/apt/tab-data 스키마**: transactions/redevelopment tab에서 이미지 필드 미포함 — AptClient 가 aptImageMap prop 으로 name → url 매핑 (page.tsx 가 전역 image map 빌드)
- **Vercel 300s cron 가드**: 루프 시작 시점 가드는 위험. 한 iteration 이 오버슛하면 통째 timeout → stuck. pre-emptive 가드 = (300 − max_iteration_duration) 계산이 안전
- **get_stocks_with_thumbnails RPC**: p_limit=500 기준 DB 응답 12-42ms. 썸네일 커버리지 100% (261 real + 239 og-chart fallback). 시가총액 하한 ~2,789억 (중견기업까지)

## 🤖 자동 진행 중 (action 불필요)
- `blog-image-supplement`: 552개 post <3 imgs → ~3일 내 0 도달 예정
- `stock-image-crawl`: 1,114개 symbol <images → ~1.6일 내 full 도달 예정
- `check-responses` pg_cron: 5분 주기 정상 실행

## 📋 다음 Claude Code 세션 체크리스트
1. ~~docs/STATUS.md 세션 138 summary~~ ✅ 이 항목
2. `/stock` UX 모니터링 — 유저가 검색 범위 확장 요청 시 페이지네이션 `/api/stock/list?offset=...` 신설
3. `issue-draft` 24시간 관찰 — regression 없으면 stuck 알림 임계치 원복 검토
4. (보류) `/api/admin/v2` RPC 이전 — 1199줄, 응답 shape 검증 필요 (세션 135부터 스킵 중)
5. (보류) `BlogMentionCard` RPC 통일 — 기존 정렬 로직 양호, 우선순위 낮음
- big_event_registry 기반 issue_alerts 자동 투입 파이프라인 설계 (Phase 3)

---

# 세션 138 (2026-04-19) — Big Event 자동화 파이프라인 구축

## 🟢 완료 [9 tasks / 8 commits]

### Fact 신뢰도 시스템
- `[FACT-VERIFIER]` 팩트 신뢰도 점수 (0-100) + publish gate
  - DB: `big_event_registry.fact_confidence_score int DEFAULT 50` + desc 인덱스
  - `src/lib/big-event-fact-verify.ts`: compute/refreshAll/shouldBlock 3함수
    - fact_sources≥3:+30, news30d≥2:+20, stage<180d:+20, confirmed:+20 likely:+10, brand:+10
  - `/api/cron/big-event-fact-refresh` (pg_cron 일 1회 권장)
  - `blog-publish-queue`: score <60 이면 published 롤백 게이트
  - 초기 점수: 삼익비치 **70** (통과) / 나머지 7건 **30** (차단) — 데이터 갱신 시 자연 상승

### 뉴스 감지 파이프라인
- `[CRAWLER-NEWS]` `/api/cron/big-event-news-detect`
  - 네이버 뉴스 API로 "{name} {region_sigungu} {event_type}" + "{brand} {name}" 검색
  - fact_sources + 최근 60건 milestones URL 중복 필터
  - `big_event_milestones(milestone_type='news_detected')` INSERT
  - 중요 키워드(시공사/분양/이주/착공/인가/총회/관리처분/감정평가) 감지 시 Solapi 알림톡 발송
  - pg_cron 30분 주기 (Vercel 100 cron 한도 외부)

### 청약 연계
- `[SUBSCRIPTION-BRIDGE]` `/api/cron/subscription-big-event-bridge`
  - apt_subscriptions (500+ 세대 또는 주택구분=아파트) & 미래 접수 · 주 1회
  - big_event_registry 자동 insert (event_type=신축분양, stage=6, constructor_status=confirmed)
  - 매칭 있으면 stage/scale_after/constructors 업데이트
- `[SUBSCRIPTION-PRE-BLOG]` `/api/cron/subscription-prebrief-generator` (일 1회)
  - rcept_bgnde = D-30/-7/-1 매칭 단지 각각 draft 생성
  - big_event 매칭 시 priority +10 bump + [절대 팩트 고정] 주입
  - safeBlogInsert is_published=false → Solapi 알림톡

### 시각화 + 역연결
- `[BIG-EVENT-CHARTS]` `src/components/blog/BigEventCharts.tsx` (서버 컴포넌트, SVG)
  - 평형별 median bar + 연도 평균가 line + Stage 7단계 타임라인
  - blog/[slug]에서 pillar/spoke 연결 감지 후 YMYL 배너 아래 자동 렌더
- `[COMPLEX-CARD-AREA]` `apt/area/[region]/[sigungu]`
  - `fetchBigEvents` cache — region_sigungu 또는 region_sido 매칭 priority DESC 5건
  - KPI 아래 "이 지역 재건축·재개발 대형 이벤트" 섹션 렌더

### 이미지 + Pillar 자동화
- `[IMAGE-CRAWL-EXTEND]` apt-image-crawl 말미에 big_event priority ≥80 phase 추가
  - 10건 × 최대 5장 `big_event_assets INSERT` (is_verified=false, editorial-review)
- `[AUTO-PILLAR-DRAFT]` `/api/cron/big-event-auto-pillar-draft` (주 2회, 실행당 최대 2건)
  - fact_confidence_score ≥70 + pillar_blog_post_id IS NULL 조건
  - [절대 팩트 고정] system prompt + Haiku 4.5 (12000 tokens)
  - safeBlogInsert draft → big_event.pillar_blog_post_id 연결 + Solapi 알림톡

### Skip (세션 137 원칙 유지)
- `[APT-PROFILE-ENRICH]` 잠실 미성크로바 + 대구 수성 범어 → **skip**
  - apt_complex_profiles 재확인 결과 매칭 없음
  - 허위 정보 금지 원칙으로 seed 보류 (공식 공고/뉴스 확보 후 재시도)

## 📦 commit 8건 (pre-push)
1. `[FACT-VERIFIER]` reliability scoring + publish gate
2. `[CRAWLER-NEWS]` naver news rss detector for big events
3. `[SUBSCRIPTION-BRIDGE]` apt_subscriptions to big_event promotion
4. `[SUBSCRIPTION-PRE-BLOG]` D-30/D-7/D-1 auto draft pipeline
5. `[BIG-EVENT-CHARTS][COMPLEX-CARD-AREA]` charts + area hub section
6. `[IMAGE-CRAWL-EXTEND][AUTO-PILLAR-DRAFT]` big_event phase + pillar draft pipeline

## 🗄️ 신규 DB 변경
- `big_event_registry.fact_confidence_score` int (DEFAULT 50) + desc 인덱스
- 기존 8 이벤트 초기 점수 계산 완료

## 🔧 신규 API 라우트 5건 (Vercel 100 cron 한도로 pg_cron 경로)
- `/api/cron/big-event-fact-refresh` (일 1회)
- `/api/cron/big-event-news-detect` (30분)
- `/api/cron/subscription-big-event-bridge` (주 1회)
- `/api/cron/subscription-prebrief-generator` (일 1회)
- `/api/cron/big-event-auto-pillar-draft` (주 2회)

## 🧭 다음 단계
- pg_cron으로 5개 신규 API 라우트 스케줄 등록 (SUPABASE: pg_net or http 확장)
- SOLAPI_TEMPLATE_BIG_EVENT_NEWS / SOLAPI_TEMPLATE_DRAFT_READY 알림톡 템플릿 심사 신청
- NODE_NOTIFY_PHONE 환경변수 설정 (Vercel)
- big_event fact_confidence_score 상승 추이 관찰 → pillar auto-draft 자동 활성화
- 삼익비치 외 대상 확장: GS·현대·삼성 건설 공식 수주 보도 후 constructor_status='confirmed' 업데이트

---

# 세션 139 (2026-04-20) — Big Event Phase 2 운영 인프라 + GSC 스캐폴드

## 🟢 완료 [9 tasks / 8 commits]

### 스케줄링
- `[PG-CRON-REGISTER]` supabase/migrations/20260420_pg_cron_big_event_phase2.sql
  - 5개 신규 cron Supabase pg_cron 등록 (`public._call_vercel_cron` 헬퍼 재사용)
  - big_event_news_detect(*/30), fact_refresh(03시), subscription_bridge(월 05시),
    subscription_prebrief(일 08시), auto_pillar_draft(화·금 09시)
  - `cron.unschedule` 선행 → idempotent 등록
  - 라이브 등록 확인: jobid 61~65

### 감사·문서
- `[CRON-TOTAL-AUDIT]` Vercel 100 + pg_cron 37 = **총 137 scheduled**
  - dead_cron 4건(loan-guide 외)은 이미 vercel.json 미등록 상태 → 추가 정리 불필요
- `[SOLAPI-TEMPLATES]` `docs/SOLAPI_TEMPLATES.md` — 4종 템플릿 명세
  - BIG_EVENT_NEWS, DRAFT_READY, STAGE_TRANSITION, FACT_ALERT
  - 변수/심사 주의/월 비용 ~420원/Node 제출 절차
- `[NODE-NOTIFY-ENV]` `docs/ENV_SETUP.md`
  - NODE_NOTIFY_PHONE 형식·환경별 세팅
  - GSC OAuth env 3종 (client_id/secret, GSC_SITE_URL)

### 관리자 모니터링
- `[CRON-HEALTH-DASHBOARD]` 5개 cron 실시간 모니터링
  - `/api/admin/big-event-crons` GET+POST (집계+수동 실행)
  - `BigEventCronMonitor.tsx` dot + last_run + counts + 🚀 Run 버튼
  - MasterControlTab 마스터 킬 스위치 위에 마운트

### 프론트엔드 — big_event 상세
- `[BIG-EVENT-DETAIL]` `/apt/big-events/[slug]` 신규
  - 이벤트 정보 + fact_confidence 컬러 라벨 + Pillar/Spokes
  - 최근 30일 news_detected (critical 플래그) + 마일스톤 타임라인
  - verified assets 갤러리 + 같은 시도 관련 이벤트 cross-link
  - JSON-LD Event schema + 허브 카드에서 pillar 없어도 detail로 연결

### IndexNow + GSC
- `[INDEXNOW-AUTO]` `/api/admin/indexnow-backfill` POST
  - `{ slugs: [...] }` 또는 `{ pattern: 'samik-beach' }` 방식
  - dry_run 지원, 최대 50 slug/request, indexed_at 동시 갱신
  - 검증: samik-beach 10편 모두 indexed_at=2026-04-19 (정상 제출됨)
- `[GSC-STUB]` Google Search Console OAuth 스캐폴드
  - `src/lib/gsc-client.ts` — buildAuthUrl/exchangeCode/save/getValidAccessToken + samikSample
  - `src/app/api/admin/gsc/oauth/route.ts` — 승인 URL + callback + 상태 확인
  - `docs/GSC_SETUP.md` — Cloud Console 설정 → env → OAuth 승인 단계별 가이드

## 📦 commit 8건 (pre-push)
1. `[PG-CRON-REGISTER]`
2. `[CRON-TOTAL-AUDIT][SOLAPI-TEMPLATES][NODE-NOTIFY-ENV]`
3. `[BIG-EVENT-DETAIL]`
4. `[CRON-HEALTH-DASHBOARD]`
5. `[INDEXNOW-AUTO]`
6. `[GSC-STUB]`

## 📋 Node 수동 과제 (우선순위 순)
1. **Solapi 템플릿 4종 심사 제출** — https://console.solapi.com/kakao (평일 1-3일)
2. **Vercel env 주입**:
   - `NODE_NOTIFY_PHONE`
   - `SOLAPI_TEMPLATE_*` 4종 (심사 통과 후)
   - `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GSC_SITE_URL`
3. **IndexNow 재제출** (Pillar 제목/5 Spoke 확장 반영):
   ```
   POST /api/admin/indexnow-backfill  body: { "pattern": "samik-beach" }
   ```
4. **GSC OAuth 1회 승인**: https://kadeora.app/api/admin/gsc/oauth
5. **관리자 페이지에서 cron 모니터** 확인 → 필요 시 🚀 Run 버튼으로 즉시 실행

## 🧭 다음 단계 (세션 140+)
- `/api/cron/gsc-daily-pull` — samik-beach + killer URL 쿼리 일 집계 → `gsc_query_stats` 테이블
- `/api/cron/big-event-stage-monitor` — stage 전환 감지 → SOLAPI_TEMPLATE_STAGE_TRANSITION
- GSC 데이터로 감쇠 키워드 감지 → blog-rewrite 재작성 큐 자동 투입
- big_event fact_confidence 상승 트렌드 → auto-pillar-draft 자동 활성화
- 부산 외 서울 이벤트 (은마/목동1/시범/삼부) fact_sources 확보 → 70+ 진입

---

# 세션 140 (2026-04-20) — 이미지 긴급 복구 + 앱내벨

## 🟢 완료 [4 tasks / 5 commits]

### P0 이미지 인프라
- `[P0-IMAGE]` 이미지 크론 2개 복구 + 백필 엔드포인트
  - `src/lib/cron-logger.ts` Redis lock 획득 실패 시 cron_logs에 status='skipped' INSERT
    (기존: lock held 시 로그 없이 return → 관측 불가)
  - `blog-image-supplement` position 충돌 방지: MAX(position)+1 재계산
  - `/api/admin/image-backfill` POST (target: all/samik-beach/slug:/post_ids + dry_run)
    · 네이버 이미지 검색 → upsert + OG cover 자동 교체
- `[P0-APT-CRAWL]` `apt-image-crawl` BATCH_SIZE 200 → 50
  - 근거: 7일간 47 runs 모두 "timeout guard: 32-36 processed" 조기 종료
  - 50으로 축소 → 250s 내 완주 + big_event phase 도달 가능

### 삼익비치 이미지 긴급 주입
- `[P0-SAMIK-IMAGES]` 10편 × 4장 = 40 images
  - 광안대교 전경 / 광안리 야경 / 부산 광안 전경 (Wikimedia CC BY-SA)
  - 카더라 OG 인포그래픽 (position 3)
  - cover_image: OG → 광안대교 실사진 교체
  - 본문 최상단에 광안대교 마크다운 이미지 + 출처 캡션 멱등 삽입
  - `supabase/migrations/20260420_samik_beach_images.sql` audit 기록

### 앱내벨
- `[NOTIFY-BELL]` Solapi 대체 앱 내 알림
  - DB: `notification_bell` 테이블 + owner RLS + 인덱스 2개
  - `src/lib/notification-bell.ts` — NotificationBellService 5 프리셋
  - `/api/admin/notifications` GET (unread_only/limit) + PATCH (id/all)
  - `src/app/admin/NotificationBell.tsx` — 헤더 🔔 + 99+ 뱃지 + 드롭다운
  - AdminShell 헤더 우측(MISSION CONTROL 앞) 마운트
  - 4지점 전환 (Solapi 보조, 벨 우선):
    · big-event-news-detect critical
    · big-event-auto-pillar-draft
    · subscription-prebrief-generator
    · cron-logger catch block (모든 cron 실패 자동 push)

## 📦 commit 5건 (pre-push)
1. `[P0-IMAGE][P0-APT-CRAWL]`
2. `[P0-SAMIK-IMAGES]`
3. `[NOTIFY-BELL]`

## 🗄️ DB 변경
- notification_bell 테이블 + RLS 정책 2건 + 인덱스 2건
- blog_post_images +40 rows (samik-beach 10 × 4)
- blog_posts (samik-beach 10) cover_image + content 첫 줄 업데이트

## 🧭 다음 단계
- Vercel 배포 후 /admin 헤더 🔔 점검 + 관리자 대상 cron 실패 push 확인
- blog-generate-images 다음 실행에서 samik-beach 외 391건 OG cover 교체 여부 관찰
- `/api/admin/image-backfill` dry_run으로 backlog 진단 후 실행 (POST body: {"target":"all","limit":50})
- NODE_ADMIN_USER_ID env 세팅 권장 (미세팅 시 profiles.is_admin=true 첫 row로 fallback)
- apt-image-crawl 다음 실행 결과: records_created > 0 인지 확인 (BATCH 50 효과)

---

# 세션 140 (2026-04-19) — 이미지 오염 대참사 후 코드 레벨 sanitize 복구 (P1)

## 🔴 disaster 전말
1. **01adc843** — 오염 이미지 차단 + onError fallback 커밋. **서버 컴포넌트 `BlogMentionCard`에 JSX `onError={(e)=>...}` 추가 → RSC 컴파일/런타임 에러**. Vercel 빌드가 DB 일괄 UPDATE 중 트리거되어 static HTML 에 에러 상태가 베이크됨.
2. **263d1322** — 01adc843 revert. 코드는 1ad71eb2 와 바이트 동일 (git diff empty) 이지만 이미 빌드된 static HTML 캐시가 오염되어 `/blog/*` `/stock/*` 전부 500.
3. **복구** — Vercel 대시보드에서 `dpl_H5LCMhji1BYEh1bTmbziiKoJbW6a` (1ad71eb2) instant rollback. 트래픽 회복.
4. **P1 근본 해결** — 본 커밋. DB 건드리지 않고 코드 레벨 URL sanitize.

## 🟢 P1 해결 (이 커밋)
- **신규** `src/lib/image-sanitize.ts`:
  - `SAFE_IMG_HOSTS` 화이트리스트 (/api/og, kadeora.app, supabase.co, vercel-storage.com, upload.wikimedia.org)
  - `isSafeImg(url)`, `safeImg(url, {title, category, design, subtitle})` — 안전 호스트 아니면 `/api/og` URL 반환 (이벤트 핸들러 불필요)
- **서버 컴포넌트 적용 (onError 절대 금지)**:
  - `src/components/blog/BlogMentionCard.tsx`: `thumbUrl = safeImg(rawThumb, ...)` × 2곳, `FallbackThumb` 분기 제거, img 항상 렌더
  - `src/app/(main)/blog/[slug]/page.tsx`: marked `renderer.image` 내부에 safeImg 적용 (HTML string `onerror=` 는 유지 — 이벤트 핸들러 prop 이 아니므로 안전), `BlogHeroImage`/`ImageLightbox` 에 전달하는 `postImages`/`galleryImages` url 도 safeImg wrap
  - `src/app/(main)/blog/page.tsx`: 목록 카드 썸네일 img src safeImg wrap
- **클라이언트 컴포넌트 적용 ('use client' 확인)**:
  - `SubscriptionTab`, `UnsoldTab`, `RedevTab`, `TransactionTab` — 썸네일 img src safeImg wrap, `decoding="async"` 추가 (`OngoingTab` 은 범위 외)

## ⚠️ 교훈 (향후 위반 금지)
1. **서버 컴포넌트에서 JSX `onError={...}` 금지** — RSC 는 이벤트 핸들러 props 허용 안 함. 대안: (a) URL 레벨 sanitize (safeImg), (b) HTML string `onerror=""` 문자열 직렬화.
2. **대량 DB UPDATE 중 Vercel 빌드 트리거 금지** — `generateStaticParams` 가 중간 상태를 읽어 static HTML 에 에러 베이크. DB 작업 전 빌드 pause 또는 revalidate 단축.
3. **이미지 정화 방식 변경** — DB 대량 UPDATE (오염 소스 NULL 처리) ❌ → 코드 URL 화이트리스트 sanitize ✅. DB 상태와 독립적, revert 안전.

## 📋 다음 세션
- 배포 후 `/blog /stock /apt` 전수 200 확인
- `/blog/samik-*`, `/blog/byeoksanchangma-*` 등 오염 이미지 노출됐던 페이지 visual 검증
- `BlogMentionCard` 의 `FallbackThumb` 정의 (line 417) dead code — 추후 정리
- `OngoingTab` 도 safeImg 적용 여부 검토

---

# 세션 141 (2026-04-19) — 호스팅어 네트워크 완전 분리

## 배경
호스팅어 119개 사이트 (분양권실전투자.com + 급매물.com + 주린이.site + 기타 116개)
Japanese Keyword Hack 완전 감염 확정 (세션 140b 진단). GSC/GA/코드 레벨 공유로
Google graph 에서 카더라를 PBN 네트워크 일부로 인식할 리스크 → 모든 연결 차단.

## 🟢 자동 수행 [1 commit / 4 파일 / 0 DB 쓰기]

### 코드 변경
- `src/lib/blog-auto-link.ts` EXTERNAL_KEYWORDS 빈 배열
  - 호스팅어 4개 키워드(부산 급매물/부산 부동산 급매물/분양권 투자/분양권 실전투자)
    외부 링크 완전 중단. 5,996 published blog 즉시 반영 (렌더 시점 주입).
- `src/lib/gtag.ts` GA_ID/ADS_ID → env 기반 (G-VP4F6TH2GD 공유 속성 분리)
- `src/app/layout.tsx` GA4 스크립트 env 조건부 로드 (미설정 시 로드 안함)
- `src/app/api/admin/satellite/route.ts` 410 Gone (orphan route 이력 보존)

### 검증
| 항목 | 결과 |
|---|---|
| src/ 내 호스팅어 도메인 grep | 주석 1건 제외 **0건** |
| src/ 내 G-VP4F6TH2GD grep | 주석 1건 제외 **0건** |
| src/ 내 UTM(byanggwon/geupmae/jurini) grep | **0건** |
| layout.tsx sameAs | 호스팅어 도메인 없음 (naver/kakao 만) |
| blog_posts.content 호스팅어 URL | **0건** (런타임 주입 구조로 DB 저장 안됨) |
| vercel.json crons 호스팅어 path | **0건** |
| WP_USER/WP_PASS/HOSTINGER env 참조 | **0건** |

## ⚠️ SKIP (사유 명시)
- **Phase 7 boost-cache SSH 추출**: 절대금지 "호스팅어 SSH 접속 금지" 원칙 준수.
  suspend 이전 추출 필요하지만 Node 가 hPanel 을 통한 Hostinger 내장 File Manager
  또는 Backup 기능으로 수동 추출 권장. (Claude Code 세션 140b 에서 SSH 접근은
  가능했으나 세션 141 절대금지 규정에 따라 skip.)
- **Phase 8 Vercel env 정리**: `NEXT_PUBLIC_GA_ID` 새 GA4 속성 교체 + HOSTINGER_* /
  WP_USER / WP_PASS / SATELLITE_* 삭제 는 Node 가 Vercel Dashboard 에서 수동 진행.
  (이 세션에서 코드는 env 없어도 안전하게 동작하도록 변경 완료.)

## 📋 Node 수동 작업 (보안 감사 체크리스트)

### A. 비밀번호 즉시 교체 (해킹된 WP admin 과 같은 암호 재사용 금지)
- [ ] Hostinger hPanel 로그인 비밀번호
- [ ] Google 계정 (구 G-VP4F6TH2GD 소유 계정 + 새 카더라 계정)
- [ ] GitHub (wls9205-a11y)
- [ ] Vercel 계정
- [ ] Supabase 계정 (tezftxakuwhsclarprlz)
- [ ] Anthropic Console
- [ ] Toss Payments
- [ ] 카카오 개발자 콘솔
- [ ] Solapi

### B. 2FA 강제 활성화
- [ ] Google 새 계정 (카더라용)
- [ ] GitHub / Vercel / Supabase / Hostinger

### C. Whois 프라이버시
- [ ] kadeora.app Whois 개인정보 노출 여부 (Vercel/Cloudflare Registrar Privacy ON)

### D. 개인정보 유출 대응
- [ ] 호스팅어 WP 사이트 회원가입·문의 폼 여부 리콜
- [ ] DB 방문자 개인정보 저장 여부 확인 → 유출 시 KISA 신고 의무 검토

### E. URL Removal (Google / Naver)
- [ ] GSC 구 계정 → 감염 3도메인 속성 → Removals → 일괄 제거
- [ ] Naver Search Advisor → 웹문서 수집제외 신청

### F. Analytics 백업
- [ ] G-VP4F6TH2GD 데이터 BigQuery export 또는 스크린샷 아카이브
- [ ] 새 GA4 속성 생성 → Vercel env `NEXT_PUBLIC_GA_ID` 주입 → 재배포

### G. 구 Google 계정 처리
- [ ] 즉시 삭제 금지 (최소 6개월 유지)
- [ ] 감염 도메인 GSC 수동조치 경고는 대응만, 재검토 요청 금지 (재감염 상태에서
  재승인 시 manual action 연장됨)

### H. 외부 참조 업데이트
- [ ] 카카오톡 채널 연결 웹사이트 (카더라만)
- [ ] 네이버 밴드 공식 사이트 필드
- [ ] 오픈카톡 공지, 명함·문서

### I. Hostinger 처리
- [ ] hPanel 에서 119개 사이트 suspend
- [ ] 도메인 auto-renewal OFF
- [ ] 네이버 서치어드바이저에서 호스팅어 3사이트 제거

### J. 1주일 후 모니터링
- [ ] GSC 카더라 속성 → 보안 및 수동 조치 → 이슈 없음
- [ ] Search Console 성능 → 비정상 impression 급감 없는지
- [ ] Vercel 로그 → 이상 외부 요청
- [ ] Supabase auth.users → 의심 계정

## 🧭 최종 자동 검증 결과
(배포 후 Vercel production 라이브 verify)
- `curl -sL https://kadeora.app | grep -iE "xn--zf0bv|xn--kj0bw|G-VP4F6TH2GD"`  → 0건 예상
- `curl -sL https://kadeora.app/sitemap.xml | grep -c "xn--zf"` → 0건 예상
- sameAs JSON-LD 호스팅어 도메인 → 없음 확인됨 (코드 레벨)

---

# 세션 142 (2026-04-20) — P0 이미지 파이프라인 대규모 복구 + 목록 SSR 이미지 맵핑

## 🟢 커밋 7건 (모두 push 완료)
1. `2106c322` P0-1: `/apt/[id]` Stage 6 RPC swap `get_apt_complex_stage6` → `get_apt_complex_hero` (shape: `{profile, related_blogs}`)
2. `2bed6332` P0-7: `/stock/[symbol]` 갤러리 URL safeImg 적용
3. `9ddac2ac` **image-sanitize 화이트리스트 → 블랙리스트 전환** — SAFE_IMG_HOSTS 제거, BLOCKED_IMG_HOSTS `hc.go.kr` 만, 모든 https URL 통과
4. `b9285b6b` P0-1 real: apt_sites null → Stage 6 항상 시도 (sub/unsold/redev 상태 무관) — 파크리오 404 복구
5. `16384050` P0-CSP: middleware.ts `img-src 'self' data: blob: https:` (`http:` 제거, 외부 CDN 전체 허용)
6. `319b5eb4` P0-blog: `/blog` 목록 cover_image null → `blog_post_images` 첫 이미지 fallback
7. `70b4310a` P0 마감: `/hot` → `get_hot_posts_with_images` RPC + `/apt` aptImageMap 을 `apts/unsold.house_nm in()` 으로 scoped query

## 🔧 세션 142 핵심 교훈
- **safeImg 화이트리스트 함정**: 5개 안전 호스트만 허용 → DB의 legitimate 외부 CDN(imgnews.naver 23,885건) 전부 /api/og 제네릭 카드로 치환 → 사용자 불만. 블랙리스트가 실용적.
- **PostgREST 1000 row cap**: `.not('images','is',null)` 전수 조회가 34K 테이블에서 잘려 매칭율 1%대로 추락. `in()` 타깃 조회로 해결.
- **Stage 6 진입 조건**: `!site && !sub && !unsold && !redev` 은 sub 의 ilike wildcard 매칭으로 skip 되기 쉬움 → `!site` 단독 체크로 단순화.
- **서버 컴포넌트 JSX onError 절대 금지** (세션 140 교훈 계승).
- **middleware CSP 와 safeImg 정합성**: 둘 다 `http:` 차단, `https:` 모두 허용 → 이중 방어.

## 📋 세션 142 보류 (다음 세션)
- P0-2: `/api/admin/v2` → `get_admin_dashboard_fast` swap — shape 100% 불일치(flat 36개 vs structured 11개). 병행 호출 + MasterControlTab 리팩토링 필요.
- P0-3/4: Resend 도메인 + pg_cron secret 회전 — Node 측 env/vault 작업.
- P0-5: signup_complete 이벤트에 cta_name 상속 — callback 탐색 필요.
- P0-8: silent cron 4종 (blog-publish-queue / refresh-trending / streak-alert-daily / blog-upcoming-projects) 개별 디버깅.
- P0-9: issue-draft JSON parse hardening — 구체 샘플 에러 확보 후.
- P0-10: blog_posts draft 53K archive — migration + new API.
- **/stock 목록 og-chart 비율 줄이기** — 실제 외부 CDN 이미지 수집 확대.
- **BAILOUT_TO_CLIENT_SIDE_RENDERING 원인 추적** — Next.js 빌드 로그 분석.

---

# 세션 143 (2026-04-20) — aptImageMap 우선순위 재조정 + blog /api/og 역조정

## 🟢 커밋 2건
1. `d9b330bc` fix(apt): aptImageMap images[0] 우선 + og_image_url fallback (4단 priority) — `.not('images','is',null)` 필터 제거로 images 비어있어도 og_image_url 확보
2. (이 커밋) fix(blog): cover_image 가 /api/og 제네릭인 경우도 blog_post_images fallback 트리거 — 53K posts 제네릭 카드 비율 ↓ 즉시 효과

## 🔴 미해결 — /apt SSR BAILOUT
MCP 실측:
- `/apt` HTML 1.77MB 중 `<img>` 태그 **1개**, `listing-grid` 1개 (class 정의만)
- `BAILOUT_TO_CLIENT_SIDE_RENDERING` 시그니처 **5+ 회 발견**
- X-Vercel-Cache: MISS, Age: 0 (ISR 신선)

근본: SubscriptionTab 자체가 SSR 에서 렌더 안 됨. 카드가 client-side 렌더 전환.
가능한 원인:
- `next/dynamic({ ssr: false })` — 세션 138 에서 탭은 풀렸지만 다른 컴포넌트에 잔존 가능
- `useSearchParams()` without Suspense wrapper 가 어딘가
- Server component 중 async throw
- Next.js 15 newline: Math.random()/Date.now() 등 dynamic trigger

**다음 세션 최우선 과제**: BAILOUT 원인 추적 → 해결 전까지 /apt 이미지 개선 효과 없음.

## 📋 세션 143 기록 사항
- **DB http://→https:// 전환 완료** (apt_sites.images 5,691 + og_image_url 5,691 + apt_complex_profiles 대량, Claude MCP 측)
- **safeImg 블랙리스트 정합**: 현재 `/^http:\/\//i` 패턴 차단 → DB 정규화와 일치
- **CSP 정합**: middleware `img-src 'self' data: blob: https:` 배포됨 (16384050 → 라이브 헤더 확인)
- **blog 이미지 근본 개선 옵션 C 적용**: cover_image = /api/og 제네릭인 경우 blog_post_images 첫 이미지 우선. 옵션 A/B (cron 증설, Haiku 스크립트) 는 별 세션.

## ⚠️ 전달 중요사항 (Node → 다음 세션)
1. Vercel 배포 진행 중일 수 있음 — d9b330bc 배포 완료 후 /apt 재검증 필요
2. BAILOUT 이 해결되지 않으면 aptImageMap 수정 효과 0 — /apt 관련 추가 이미지 수정은 BAILOUT 해결 후
3. Option C 블로그 수정은 즉시 배포 적용 가능 — 다음 curl 시점부터 /blog 카드 이미지 다양성 증가 기대
