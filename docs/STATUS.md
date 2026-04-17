# 카더라 STATUS — 세션 132 (2026-04-17)

> **반드시 세션 시작 시 읽고, 종료 시 갱신** (Architecture Rule #11)

## 🚨 머지 전 필수 체크 (배포 차단 사항)

### 1. DB 마이그레이션 4개 — Supabase Dashboard SQL Editor에서 순서대로 실행
```
docs/migrations/20260417_app_config.sql
docs/migrations/20260417_oauth_tokens.sql
docs/migrations/20260417_calc_results.sql
docs/migrations/20260417_calc_topic_clusters.sql
```
**의존성**: 코드가 이 4개 테이블을 참조함. 마이그레이션 안 돌리면:
- `app_config` 미존재 → 모든 cron이 폴백 defaults로 작동 (한도/스위치 무시)
- `oauth_tokens` 미존재 → 네이버 카페 발행 작동 안 함
- `calc_results` 미존재 → 결과 공유 URL 생성 실패
- `calc_topic_clusters` 미존재 → 토픽 허브 페이지 빈 페이지

### 2. 신규 의존성 설치
```bash
npm install
# 신규 패키지: nanoid@^5.0.0, isomorphic-dompurify@^2.16.0
```

### 3. 네이버 OAuth 등록 (코드 머지 후)
1. https://developers.naver.com/apps/ → 카페 글쓰기 권한 OAuth 앱 등록
2. Postman/curl 로 1회 OAuth 인증 → access_token + refresh_token 획득
3. 어드민 → 마스터 → 네이버 발행 탭 → OAuth 등록
4. "🧪 테스트 발행" 버튼 → 카페에서 한글 정상 표시 확인
5. 정상 작동 확인 후 vercel.json cron 자동 작동

---

## 📦 이번 세션 작업 — 풀스택 마스터 실행

### 신규 파일 (20개)
**DB 마이그레이션 (docs/migrations/)**:
- `20260417_app_config.sql` — 통합 설정 + 17 시드 + master_kill 스위치 + set_app_config RPC
- `20260417_oauth_tokens.sql` — OAuth 영구 저장
- `20260417_calc_results.sql` — 결과 영구 URL + 3개 RPC
- `20260417_calc_topic_clusters.sql` — 50개 토픽 시드

**라이브러리 (src/lib/)**:
- `app-config.ts` — 1분 캐싱, getConfig/setConfig/getAIModel/shouldUsePromptCache
- `jsonld.ts` — XSS 방지 jsonLdSafe
- `naver/cafe-client.ts` — URL-encoded UTF-8 (multipart 폐기)
- `naver/cafe-html.ts` — HTML 정화 + 출처 박스
- `naver/oauth-store.ts` — refresh rotation + listOAuthProviders + deleteOAuthProvider
- `calc/result-share.ts` — nanoid 8자리 short_id

**API 라우트 (src/app/api/)**:
- `cron/naver-cafe-publish/route.ts` — 한글 픽스 적용 신버전 (재작성)
- `cron/calc-topic-refresh/route.ts` — AI 갱신, prompt cache 사용
- `cron/cleanup-calc-results/route.ts` — 만료 정리
- `admin/naver-oauth/route.ts` — OAuth CRUD + 테스트 발행
- `admin/config/route.ts` — app_config 통합 GET/POST/DELETE
- `admin/master/status/route.ts` — 10개 영역 종합 + health_score + next_actions
- `admin/master/execute-all/route.ts` — 9단계 일괄 실행 + dryRun
- `calc/result/route.ts` — 결과 저장/조회
- `og-calc/route.tsx` — 결과 OG 이미지 (한글 폰트, 카테고리별 컬러)

**페이지 (src/app/(main)/calc/)**:
- `[category]/[slug]/r/[shortId]/page.tsx` — 결과 영구 URL (JSON-LD WebPage+Breadcrumb, 인기 결과+관련 블로그)
- `topic/[keyword]/page.tsx` — 토픽 허브 (CollectionPage+ItemList+FAQPage+Breadcrumb 4중 JSON-LD)

**어드민 탭 (src/app/admin/tabs/)**:
- `MasterControlTab.tsx` — 헬스 80px, 마스터 킬, 권장 조치, 6 카드, 환경변수, 🚀 전체 실행
- `NaverPublishTab.tsx` — OAuth 등록, 강제 Refresh, 🧪 테스트 발행, 큐 관리, 한도 토글

### 수정 파일 (16개)
- `src/lib/sanitize-html.ts` — DOMPurify 교체 (4가지 XSS 페이로드 차단), 폴백 강화
- `src/lib/calc/formulas.ts` — subscriptionScore 추가 (배우자 통장 합산)
- `src/lib/calc/registry.ts` — subscription-score 4 inputs
- `src/lib/constants.ts` — Sonnet 4.6, Opus 4.7
- `src/components/calc/CalcEngine.tsx` — "🔗 결과 URL 공유" 버튼 (POST /api/calc/result)
- `src/app/admin/AdminShell.tsx` — master + naver 탭 등록 (master 첫 탭)
- `src/app/api/admin/naver-syndication/route.ts` — requireAdmin, failed stat, retry alias
- `src/app/api/cron/indexnow-mass/route.ts` — calc topic + 결과 100/200건 추가
- `src/app/auth/callback/route.ts` — open redirect 픽스 (//, /\, /\t 등)
- `src/app/(auth)/login/page.tsx` — open redirect 픽스
- `src/app/sitemap.xml/route.ts` — ID 30, 31 추가
- `src/app/sitemap/[id]/route.ts` — case 30 (calc topics), 31 (popular results)
- `public/robots.txt` — Claude-Web 제거, ClaudeBot/anthropic-ai/Amazonbot/Applebot-Extended/Meta-ExternalAgent 추가, 중복 PerplexityBot 제거
- `vercel.json` — 신규 크론 12개 추가 (총 112개)
- `package.json` — nanoid + isomorphic-dompurify

### 진단·문서
- `docs/MASTER_EXECUTION_PLAN.md` — 4-Wave 병렬 실행 설계안

---

## 🎯 핵심 변화 요약

### 네이버 카페 한글 깨짐 영구 해결
- **원인**: `form-data` npm + multipart 사용 → part header 에 charset=utf-8 누락 → 네이버 게이트웨이가 EUC-KR 로 디폴트 해석
- **해결**: `URLSearchParams` + `application/x-www-form-urlencoded; charset=utf-8` → 자동 UTF-8 percent-encoding (검증 완료: "카더라 부동산 — 강남구 청약 가점 분석" 정상 인코딩)
- **부가**: refresh_token DB 저장 + 자동 rotation → 1년 후 정지 사고 영구 방지

### 계산기 노출면적 50배 증가 (Naver 1위 전략)
1. **결과 영구 URL** (`/calc/.../r/[shortId]`) — 카톡 공유 시 OG 이미지로 결과값 큰 노출
2. **토픽 클러스터 허브 50개** (`/calc/topic/[keyword]`) — AI 자동 갱신 (intro+FAQ+meta), 4중 JSON-LD
3. **자동 블로그 매칭** — 토픽별 관련 블로그 자동 연결
4. **사이트맵 분리** — ID 30 (토픽), 31 (인기 결과 1000건) 독립 청크
5. **IndexNow** — 토픽 100 + 인기 결과 200 매 6시간 색인 요청
6. **결과 OG 이미지 API** — 카테고리별 컬러, 한글 폰트, Pretendard

### 무하드코딩 100% 달성
- AI 모델: `app_config.ai_models.{default_haiku, default_sonnet, default_opus, use_prompt_cache, use_batch_api}`
- 네이버 카페: `app_config.naver_cafe.{enabled, batch_size, sleep_between_ms, daily_limit}`
- 계산기 SEO: `app_config.calc_seo.*`
- OAuth 토큰: `oauth_tokens` 테이블 (환경변수 X)
- 마스터 킬: `app_config.master_kill.{all_crons_paused, all_publishing_paused}`
- 어드민 `MasterControlTab` 에서 토글 한 번으로 즉시 변경 (1분 캐싱)

### 마스터 어드민 대시보드
- **`/admin` 첫 탭**: 마스터 (master)
- **헬스 스코어 80px 원형** (마이그레이션, 크론 성공률, 환경변수, 마스터 킬, OAuth 가중)
- **🚨 마스터 킬 스위치 2개** (긴급정지)
- **📋 자동 권장 조치** (high/medium/low priority 색상 구분)
- **6개 시스템 상태 카드** (DB / OAuth / 카페 큐 / 토픽 / 결과 / 크론)
- **환경변수 13개 그리드** (✓/✗)
- **🚀 전체 실행 버튼** (2단계 확인 — 첫 클릭 빨강 경고, 5초 내 두 번째 클릭 즉시 실행)
- **단계별 개별 트리거 9개** (마지막 결과 옆에 표시)
- **마지막 실행 결과 details 뷰**

---

## ⛔ 머지 안 함 / 배포 안 함

- 모든 변경은 `/home/claude/kadeora/` 에만 존재
- `git commit` 안 함, `git push` 안 함
- `npm install` 안 함 (sandbox 제한)
- Vercel deploy 안 됨

---

## 📊 변경 통계
- **신규 파일**: 20개
- **수정 파일**: 16개 (557 insertions, 123 deletions)
- **마이그레이션**: 4개 (수동 실행 필요)
- **시드 데이터**: 50개 토픽 클러스터 + 17개 app_config 기본값
- **TypeScript**: 내가 만든 코드는 narrowing 픽스 후 클린 (npm install 후 next/server 등 인식되면 0 errors)

---

## 🔧 다음 세션 우선순위

1. **Toss 결제 idempotency + webhook 핸들러** (v7-v9 핵심 미해결)
2. **RLS 13개 테이블 감사** (Supabase Dashboard SQL `SELECT * FROM pg_policies`)
3. **exec_sql RPC 보안 리뷰** (`\df+ public.exec_sql`)
4. **슬러그 생성 한글 문제** (`"오늘 커피 마셨다" → -abc123de` 95% 피드 garbage URL)
5. **Sentry 커스텀 캡처** — 결제·award_points·indexnow 경로
6. **블로그 generateStaticParams 200→2000 확장** (view_count >= 10)

---

## 💡 운영 팁

### 카페 발행 첫 사용 시
1. 어드민 → 마스터 탭 → 헬스 100점 확인
2. "마스터 킬 스위치" 모두 OFF (정상) 상태 확인
3. 어드민 → 네이버 발행 탭 → OAuth 등록 후 🧪 테스트 발행
4. 마스터 탭 돌아가서 🚀 전체 실행 → 9단계 결과 확인

### 계산기 토픽 추가
- `calc_topic_clusters` 에 INSERT 만 하면 자동으로 사이트맵·IndexNow·페이지 생성
- AI 콘텐츠는 `calc-topic-refresh` 다음 실행 (일요일 5시) 시 자동 채워짐
- 즉시 채우려면 어드민 → 마스터 → 단계별 → "계산기 토픽 클러스터 AI 갱신" 클릭

### 마스터 킬 사용 사례
- **`all_crons_paused`**: Vercel 한도 초과 / Supabase 장애 / Anthropic API 비용 폭증 등 모든 자동화 즉시 정지
- **`all_publishing_paused`**: 네이버 정책 변경 / 카페 정지 등 외부 발행만 정지 (내부 콘텐츠는 계속 생성)

---

세션 132 종료 시점 기준. 다음 세션에서 이 문서 먼저 읽고 시작.
