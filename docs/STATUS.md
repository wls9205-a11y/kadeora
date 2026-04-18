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

