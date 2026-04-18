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

