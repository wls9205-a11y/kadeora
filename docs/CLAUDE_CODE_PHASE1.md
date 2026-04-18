# Claude Code 논스톱 실행 지시서 — v3 Phase 1

> 이 문서는 Claude Code가 Node의 추가 입력 없이 **중단 없이** Phase 1 전체를 끝낼 수 있도록 작성됨.
> 작성 시점에 이미 완료된 작업(`✅ DONE`)은 건너뛸 것.

---

## 🚨 실행 절대 원칙 (반드시 지킬 것)

1. **절대 질문하지 않는다.** 모든 판단은 이 문서 + 상황 추론으로 결정.
2. **모든 작업은 병렬 진행.** 의존성 없는 건 동시에.
3. **각 작업 단위(L#-#) 완료 시 즉시 `[L#-#]` prefix로 git commit.** 마지막에 한 번 push.
4. **실패 시 최대 3회 재시도 후 skip + 리포트.** 한 작업이 전체를 막지 않도록.
5. **타입체크는 변경 파일에 한정해서 검증.** 전체 `tsc --noEmit`는 기존 에러 때문에 느리므로 변경 파일 단위로.
6. **Node 손이 필요한 항목은 skip + 최종 리포트에 명시.**
7. **작업 시작 시 반드시**: `docs/STATUS.md`, `docs/NAVER_DOMINANCE_v3.md` 읽기 + `git pull origin main --rebase`.
8. **매 commit 전**: `git pull --rebase`로 충돌 방지.
9. **작업 중 막히면 다음으로 넘어가고 나중에 처리**. 30분 이상 한 작업에서 막히면 skip.
10. **최종 단계**: STATUS.md 갱신 + 결과 리포트 + push.

---

## 이미 완료된 것 (건너뛸 것)

### ✅ DONE (Claude 챗에서 이미 처리)
- `[L1-2]` 인덱스 드롭 완료: `idx_blog_posts_pgroonga_title`, `idx_blog_posts_pgroonga_content`, `idx_blog_posts_title_length`, `idx_blog_posts_content_length`, `idx_blog_posts_slug` (인덱스 95MB → 90MB)
- `[L1-3 즉시]` VACUUM ANALYZE 실행 (dead rows 9,274 → 4)
- `[L1-3 주간]` pg_cron `weekly_vacuum_analyze_blog` 등록 완료 (매주 일 19:00 UTC)
- `[L1-4 좀비]` cron_logs 37개 좀비 타임아웃 처리
- `[L1-4 자동화]` pg_cron `cleanup_zombie_crons` 등록 완료 (5분 주기)

위 5개 작업은 이미 DB에 반영됨. 재실행 금지.

### ⚠️ Node 수동 필요 (Phase 1에서 skip + 리포트)
- `[L0-3]` 네이버 인플루언서 신청
- `[L0-4]` 카더라 공식 네이버 블로그 개설
- `[L4-1]` Google Search Console OAuth 토큰
- `[L5-1]` YouTube Data API 키 + 채널 연동

---

## Phase 1 — Claude Code가 해야 할 작업 (순서 무관, 병렬)

### 🔴 P0 — 가장 먼저 (Critical path)

#### [L1-5] 킬러 글 URL 강제 static pin (최우선)
**근거**: 14:09 로그에서 레이카운티·두산위브 동시 504. 도메인 유입 78%가 이 글.

**작업**:
1. `src/app/(main)/blog/[slug]/page.tsx`의 `generateStaticParams` 수정:
   - 기존: view_count top 200
   - 변경: 다음 3개 쿼리 병렬 → 합집합 → **60편 고정 static**
     - view_count DESC top 30
     - published_at DESC top 15 (최신 중요 이슈 보장)
     - `slug` 하드코딩 리스트 10개 (아래)
2. **강제 포함 슬러그 리스트**:
   ```ts
   const PINNED_SLUGS = [
     '레이카운티-무순위-청약-재분양-총정리-2026',
     '두산위브-트리니뷰-구명역-분양-총정리-2026',
     'guide-tax-regulated-area-2026',
     'apt-trade-이펜하우스3단지-서울-2026',
     // 아래는 DB에서 view_count 추가 top 6 동적 선정 로직으로 대체
   ];
   ```
3. `revalidate` 기본값을 **300 → 900** (5분 → 15분) 상향해서 안정성 ↑
4. 추가: 서버 컴포넌트에서 첫 번째 쿼리 (`blog_posts select by slug`)를 `generateMetadata`와 **React `cache()`로 공유** (현재 같은 row 2번 fetch)
5. 타입체크 → 빌드 검증 → commit `[L1-5] killer URL static pin + metadata dedup`

#### [L1-6] Crawler 재시도 패턴 차단 (middleware)
**근거**: 같은 URL Yeti/Googlebot이 10초 내 3~10회 재요청 → 크롤 예산 낭비.

**작업**:
1. `src/middleware.ts`에 UA 감지 추가:
   ```ts
   const isCrawler = /googlebot|yeti|bingbot|daumoa|yandex/i.test(ua);
   ```
2. Upstash Redis 써서 `ckey = crawler:${ip}:${pathname}` 키로 10초 내 3회+ hit 감지 → 304 Not Modified 즉시 반환
3. 또는 Edge Config로 최근 실패 URL list 관리 → static pin 큐에 자동 편입
4. commit `[L1-6] crawler retry throttle`

#### [L1-1] /blog/[slug] 쿼리 다이어트
**근거**: 페이지당 18~20개 쿼리. 평균 TTFB 371ms.

**작업**:
1. `generateMetadata` + `BlogDetailPage` 서버 컴포넌트에서 `blog_posts` 단일 row fetch를 **React `cache()`로 통합** — 현재 같은 row 2번
2. content 컬럼 제거된 버전 메타데이터 전용 쿼리 생성 (content 30KB는 본문용 1번만)
3. related 3단 폴백 (line 313~353) 을 **단일 RPC `get_related_posts(post_id, category, tags, limit)`** 로 통합 + 마이그레이션 추가
4. apt_sites / stock_quotes / apt_complex_profiles / blog_post_images / galleryImages 등 사이드바 데이터 → 단일 RPC `get_blog_sidebar_bundle(post_id, category, tags)`로 통합
5. `prev/next` 쿼리 `Promise.all`은 이미 쓰고 있지만 **같은 RPC 안으로 편입**
6. commit `[L1-1] query diet: 18→8 queries + React cache + bundled RPCs`
7. **예상 효과**: TTFB -400ms, DB 부하 -50%

#### [L1-7] Bot Edge Caching
**작업**:
1. `middleware.ts`에서 crawler UA 감지 시 → Upstash Redis에서 `/blog/*` 응답 HTML 체크
2. 캐시 hit: 즉시 반환 (TTL 1시간)
3. 캐시 miss: 정상 처리 + 응답 백그라운드로 캐시 저장
4. `revalidate-on-demand`: 블로그 글 업데이트 시 해당 slug 캐시 무효화 RPC/webhook
5. commit `[L1-7] bot edge cache`

#### [L1-4 나머지] Redis lock + 이미지 생성 실패 해결
**근거**: blog-generate-images 35% 실패 / blog-image-supplement 52% 실패.

**작업**:
1. `src/lib/cron-lock.ts` 신규 생성 (Upstash Redis SET NX EX):
   ```ts
   export async function acquireCronLock(cronName: string, ttlSec = 600): Promise<boolean>
   export async function releaseCronLock(cronName: string): Promise<void>
   ```
2. `withCronLogging` wrapper에 lock 통합 → 중복 실행 차단
3. `blog-generate-images` route의 실패 원인 조사:
   - `cron_logs` metadata 열어보기
   - 실패 샘플 3건의 에러 메시지 확인
   - AI API 응답 파싱 에러 / timeout / URL 형식 / 이미지 없음 중 원인 특정
   - 수정 후 재배포
4. `blog-image-supplement`도 동일
5. commit `[L1-4] cron lock + image gen fix`

---

### 🟡 L0 — 권위 (Authority, 동시 진행)

#### [L0-1] 카더라 브랜드 About 페이지 (저자는 개인 아닌 브랜드)
**작업**:
1. `src/app/about/page.tsx` 신규 또는 기존 확장:
   - **헤드라인**: "카더라 — 부동산·주식 데이터가 모여 이야기가 되는 곳"
   - 설립 배경: 2026년, 부산 기반 프롭테크
   - 데이터 기반: 아파트 34,500+ 단지·실거래 495K+건·종목 1,805개
   - 카테고리별 분석팀 소개 (부동산팀 / 주식팀 / 재테크팀 / 데이터팀)
   - 카더라 사명·원칙 (투자자문 아님 + 데이터 투명성)
   - JSON-LD `Organization` schema (founder 필드 **없음**, foundingDate만)
2. `src/app/about/authors/page.tsx` — **팀 페이지** (복수 "팀" 구조, 실명 저자 없음):
   - 카더라 부동산팀 · 카더라 주식팀 · 카더라 재테크팀 등
   - 각 팀의 전문 영역 + 데이터 소스 명시
3. blog/[slug]/page.tsx의 저자 카드에서 `/about`로 링크
4. commit `[L0-1] 카더라 브랜드 about + team pages`

#### [L0-2] ❌ SKIP — 이미 처리됨
**상태**: Claude 챗에서 DB 레벨로 처리 완료:
- 기존 `author_name` "노영진" 19건 → 카테고리별 "카더라 부동산팀/주식팀/재테크팀"으로 롤백
- 코드 파일(`constants.ts`, `layout.tsx`, `llms.txt`) 3곳 모두 노영진 제거 완료
- **중요**: 이 작업 건드리지 말고 skip. author_name은 **가상팀명 7종 유지** (카더라 브랜드).
- `blog-rewrite` / `blog-enrich` cron이 향후 author_name 채울 때도 카테고리별 팀명 사용할 것 (노영진 금지)

#### [L0-5] E-E-A-T: 외부 인용·출처 자동 주입
**작업**:
1. `blog-rewrite` cron에 source_ref 자동 추출 로직 추가:
   - 본문에서 "국토교통부", "금융감독원", "통계청" 등 기관명 감지 → 해당 기관 공식 링크 자동 첨부
   - 레퍼런스 블록 본문 하단 자동 생성
2. `src/app/(main)/blog/[slug]/page.tsx`에 `source_ref` 있을 때 "참고자료" 섹션 렌더
3. external 링크는 `rel="noopener nofollow"` 유지 (이미 되어 있음 — 확인만)
4. commit `[L0-5] source_ref auto-inject + references section`

#### [L0-6] YMYL 면책 배너
**작업**:
1. `src/components/YMYLBanner.tsx` 신규 (투자자문 아님 + 데이터 출처 + 저자 자격)
2. `blog/[slug]/page.tsx`에서 `category IN ('stock', 'finance', 'apt', 'unsold')` 이면 본문 **첫 H2 앞에** 자동 삽입
3. 디자인: 기존 색상 팔레트 (var(--warning-bg), var(--text-secondary)) 준수
4. commit `[L0-6] YMYL disclosure banner`

---

### 🟡 P0 — 퀵 윈 (Quick wins)

#### [L3-6] JSON-LD seed 댓글 필터 (10분)
**작업**:
1. `src/app/(main)/blog/[slug]/page.tsx` line ~583:
   - 기존: `comment: comments.slice(0, 3).map(...)`
   - 변경: `comment: comments.filter(c => !c.is_seed).slice(0, 3).map(...)`
   - `commentCount: comments.length` 도 `comments.filter(c => !c.is_seed).length`
2. commit `[L3-6] JSON-LD seed filter (spam signal removal)`

#### [L2-4] 네이버 Search Advisor 검증 파일 확인
**작업**:
1. `public/3a23def313e1b1283822c54a0f9a5675.txt` 파일 존재 확인 (이미 있음)
2. `public/robots.txt`에서 Naver Search Advisor URL (`Host:`) 유효성 재확인
3. `public/naver_search_advisor_notes.md` 신규 생성 — Node가 searchadvisor.naver.com에서 수동 확인할 항목 리스트
4. commit `[L2-4] naver SA verification notes`

---

### 🔴 P0 — 이슈 파이프라인 (Draft → Publish 병목)

#### [L3-3] issue_alerts 230건 pending drain + news_rss 0% 원인 해결
**작업**:
1. `src/app/api/cron/blog-publish-queue/route.ts` 조사:
   - 현재 빈 큐 돌리고 있음 (processed 0)
   - `issue_alerts WHERE is_auto_publish=true AND is_published=false AND draft_content IS NOT NULL` 을 실제로 쿼리하는지 확인
   - 안 읽으면 hook 추가
2. `fact_check_passed = false` 케이스 51건 확인 — 과도한 gate면 해당 rule 완화
3. news_rss stock/economy/commodity `is_auto_publish` 기본값 true로 변경 (현재 false일 가능성)
4. 한 번 수동 trigger로 230건 중 50건 드레인 테스트 → 로그 확인
5. commit `[L3-3] publish queue fix + news_rss unblock`

#### [L2-7] trending_keywords → 선제 블로그 phase (P0 신규)
**작업**:
1. `src/app/api/cron/issue-preempt/route.ts`에 Phase 5 추가:
   ```ts
   async function detectTrendingKeywordGaps(sb: any) {
     const { data: trending } = await sb.from('trending_keywords')
       .select('keyword, heat_score, category, rank')
       .gte('heat_score', 70)
       .gte('updated_at', new Date(Date.now() - 12 * 3600000).toISOString())
       .in('category', ['stock', 'apt', 'search'])
       .order('heat_score', { ascending: false })
       .limit(30);
     
     for (const t of trending) {
       const { count } = await sb.from('blog_posts')
         .select('id', { count: 'exact', head: true })
         .eq('is_published', true)
         .or(`title.ilike.%${t.keyword}%,tags.cs.{${t.keyword}}`);
       
       if (count === 0 || count === null) {
         // issue_alerts insert with multiplier 1.5
         await (sb as any).from('issue_alerts').insert({
           title: `[급상승] ${t.keyword} — heat ${t.heat_score}`,
           ...
           base_score: 50,
           multiplier: 1.5,
           final_score: 75,
           is_auto_publish: true,
         });
       }
     }
   }
   ```
2. 기존 Phase 1~4와 `Promise.allSettled` 병합
3. commit `[L2-7] trending keyword gap detection phase 5`

---

### 🔵 L3-9 meta_description batch 재생성 (코드만 + Node 실행)

**작업**:
1. `src/app/api/admin/meta-description-batch/route.ts` 신규 POST route:
   - `WHERE is_published=true AND length(meta_description) < 80` 대상 slug 리스트
   - Anthropic Batch API 제출 (50% 할인) — slug당 프롬프트: "기존 meta_description 개선, 80~160자, 감정+숫자 포함, ## 형식 금지"
   - `batch_rewrite_jobs` 테이블에 job_id 저장 (이미 있을 것, 없으면 신규)
2. admin UI 버튼 추가 (`MasterControlTab.tsx` 또는 적절한 탭)
3. Node가 수동으로 "시작" 버튼 1회 클릭 → 밤새 처리
4. commit `[L3-9] meta_description batch regeneration API`

---

### 🟢 P1 — 추가 작업 (Phase 1 시간 되는대로)

#### [L1-8] Next Image 전환 (부분)
**작업**:
1. `BlogHeroImage.tsx` 는 이미 적용 — 확장만
2. `renderer.image` (marked) 에서 `<img>` 대신 **srcset + sizes** 포함하도록 튜닝
3. 네이버 CDN 이미지는 `unoptimized` 처리 (pstatic 거치면 네이버 이미지 탭 이점 상실)
4. commit `[L1-8] next-image extension`

#### [L0-관련] author_role 다양성 확보
**작업**:
1. source_type=auto glob 글에 대해 sub_category 기반 author_role 자동 분류:
   - stock → "카더라 편집부 (AI-assisted · 종목 분석)"
   - apt → "카더라 편집부 (AI-assisted · 부동산 분석)"
   - finance → "카더라 편집부 (AI-assisted · 재테크)"
2. commit `[L0-X] author_role 세분화`

---

## 작업 흐름 (정확한 순서)

```
1. cd ~/kadeora (또는 Claude Code 작업 디렉토리)
2. git pull origin main --rebase
3. cat docs/STATUS.md  # 현재 세션 번호 기록
4. cat docs/NAVER_DOMINANCE_v3.md | head -100  # 플랜 재인식

5. 병렬 워커로 진행:
   - Worker A: L1-5, L1-6, L1-1, L1-7 (인프라 코어)
   - Worker B: L1-4 나머지, L2-7, L3-3 (파이프라인)
   - Worker C: L0-1, L0-2, L0-5, L0-6 (권위)
   - Worker D: L3-6, L2-4, L3-9, L1-8 (퀵 윈)

6. 각 작업 완료 즉시:
   - 변경 파일 한정 타입체크: npx tsc --noEmit [파일]
   - git add [변경 파일]
   - git commit -m "[L#-#] 작업 요약"
   - (push는 마지막에 묶어서 1회만)

7. 모든 작업 완료 후:
   - git pull origin main --rebase  # 혹시 모를 충돌 방지
   - npm run build 로컬 검증 (선택사항, 시간 되면)
   - git push origin main  # 단 한 번의 push
   - vercel deploy 자동 트리거 확인

8. STATUS.md 업데이트:
   - 세션 N+1 헤더 추가
   - 완료된 [L#-#] 목록
   - skip 된 항목 + 사유
   - Node 수동 필요 항목 (L0-3, L0-4, L4-1, L5-1)
   - 다음 Phase 2 진입 조건

9. 최종 리포트 출력 (stdout):
   ✅ 완료: N개
   ⚠️  skip: N개 (사유)
   📋 Node 수동: 4개
   🚀 배포: dpl_xxx
```

---

## 최종 리포트 템플릿 (작업 끝난 후 출력)

```
# v3 Phase 1 완료 리포트

## 완료 [N개]
- [L1-5] killer URL static pin ✅ 
- [L1-6] crawler retry throttle ✅
- ... (각 항목)

## 측정 (before → after)
- Vercel /blog timeout / 시간: XX → YY
- Top DB 쿼리 평균: 371ms → ZZZms  (SELECT 1 FROM pg_stat_statements 비교)
- 인덱스 크기: 95MB → 90MB (이미 완료)
- 본문 이미지 포함 비율: 11.4% → ??? (이미지 크론 재가동 여부)

## Skip [N개]
- [L#] 사유

## Node 수동 필요 [4개]
- [L0-3] 네이버 인플루언서 신청 → searchadvisor.naver.com
- [L0-4] 공식 네이버 블로그 개설 → blog.naver.com
- [L4-1] Google Search Console OAuth → Node의 구글 계정으로 https://search.google.com/search-console/api
- [L5-1] YouTube Data API 키 + 채널

## 다음 Phase 2 착수 가능 여부
- [ ] Phase 1 safety check 통과 (timeout 0~2/hour)
- [ ] Node 수동 4개 중 L0-3, L0-4 완료 시 Phase 2로 이행
```

---

## 실행 명령어 (Node가 복사해서 터미널에 붙이기)

### 옵션 A: 내 컴퓨터에서 Claude Code 직접 실행 (권장)

```bash
cd ~/dev/kadeora  # 또는 실제 레포 경로

# 1. 레포 최신화
git pull origin main --rebase

# 2. Claude Code 논스톱 실행 (yes 클릭 불필요)
claude --dangerously-skip-permissions "docs/CLAUDE_CODE_PHASE1.md 파일을 읽고 거기 적힌 내용을 전부 수행해. 절대 질문하지 말고, 병렬로 작업을 진행하고, 실패한 건 skip 후 리포트해. 모든 변경사항은 [L#-#] prefix commit으로 남기고 마지막에 1회 push. STATUS.md 업데이트 필수. 완료되면 최종 리포트 출력."
```

### 옵션 B: headless 모드 (background 실행)

```bash
nohup claude --dangerously-skip-permissions \
  "docs/CLAUDE_CODE_PHASE1.md 파일을 읽고 거기 적힌 모든 Phase 1 작업을 수행해. 질문 금지, 병렬 진행, 실패 시 skip. 완료 후 STATUS.md 갱신 + push." \
  > phase1.log 2>&1 &

# 진행 모니터링
tail -f phase1.log

# 완료 후 리포트
cat phase1.log | tail -100
```

### 옵션 C: 세분화 (안전)

Phase 1을 4개 Worker로 쪼개서 순차 실행:

```bash
# Worker A — 인프라 코어
claude --dangerously-skip-permissions \
  "docs/CLAUDE_CODE_PHASE1.md 중 [L1-5], [L1-6], [L1-1], [L1-7] 만 수행. 완료 후 commit + push."

# Worker B — 파이프라인
claude --dangerously-skip-permissions \
  "docs/CLAUDE_CODE_PHASE1.md 중 [L1-4 나머지], [L2-7], [L3-3] 만 수행."

# Worker C — 권위
claude --dangerously-skip-permissions \
  "docs/CLAUDE_CODE_PHASE1.md 중 [L0-1], [L0-2], [L0-5], [L0-6] 만 수행."

# Worker D — 퀵윈
claude --dangerously-skip-permissions \
  "docs/CLAUDE_CODE_PHASE1.md 중 [L3-6], [L2-4], [L3-9], [L1-8] 만 수행. 마지막에 STATUS.md 갱신 + push."
```

---

## ⚠️ 안전장치

- **Git 충돌**: `git pull --rebase` 실패 시 `git rebase --abort` 후 conflict 있는 파일 수동 판단 (기존 변경 vs 원격 변경). 불확실하면 skip.
- **Build 실패**: 해당 commit revert 후 다음 작업 계속.
- **RPC 생성 실패**: apply_migration 에러 시 SQL syntax 재검토 1회 → 실패 시 skip + 리포트.
- **Vercel 배포 실패**: build 로그에서 에러 즉시 수정 (eslint.ignoreDuringBuilds=true 이미 켜져 있음).
- **timeout이 Phase 1 하고도 해결 안 되면**: L1-5 static pin 실패 가능성 — 재점검.

---

## 작업 중 막히는 지점 대응

- **"이거 권한 필요한데요?"** → `--dangerously-skip-permissions` 플래그로 실행 중이므로 이 질문 자체가 안 뜸.
- **"이 작업 어떻게 해야 하나요?"** → 이 문서 섹션 재확인. 불명확하면 **합리적 추론으로 진행** (Node의 코드 스타일: dark navy theme, CSS vars, `is_published=true` 필터 필수, `.single()` → `.maybeSingle()` 등).
- **"테스트해볼까요?"** → No. 타입체크만 하고 진행. 문제는 deploy 후 Vercel log로 확인.

---

## Success Criteria

Phase 1 완료 = 다음 4개 중 최소 3개 달성:

- [ ] Vercel `/blog/*` timeout 시간당 < 5 (현재 20+)
- [ ] killer 20편 URL 응답 TTFB < 500ms
- [ ] issue_alerts pending_draft < 50 (현재 230)
- [ ] 본문 이미지 포함 블로그 비율 > 50% (현재 11.4%) — L1-4 이미지 크론 복구 시

달성 시 Phase 2 자동 승격. 미달 시 재시도 1회 후 Node 확인 요청.

---

**작성자 주**: 이 문서는 Claude Code가 혼자서 작업하는 지시서로, Node는 단 한 번의 커맨드만 입력하면 됨. 작업 중 일체 개입 불필요. 완료 후 STATUS.md와 Vercel 대시보드만 확인.
