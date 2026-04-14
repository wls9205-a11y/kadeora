# 이슈 선점 블로그 파이프라인 전면 수정 설계안

> 세션 108 심층 진단 결과 | 2026-04-15

---

## 현재 상태 — 파이프라인 전수 조사

```
탐지 597건 → 처리 298건 → 발행 15건 → 실제 공개 8건 → 조회 있음 4건
```

| 단계 | 수치 | 전환율 | 판정 |
|------|------|--------|------|
| 이슈 탐지 (issue-detect) | 597건 (24h: 525) | — | ✅ 정상 |
| 대기 (미처리) | 299건 | — | ⚠️ 밀림 |
| AI 초안 실패 | 183건 (31%) | — | 🔴 치명 |
| 중복 스킵 | 45건 | — | ✅ 정상 |
| 저점수 스킵 | 33건 | — | ✅ 정상 |
| 초안 완료 → blog_post 생성 | 15건 | 탐지→생성 2.5% | 🔴 |
| blog_post 공개 | 8건/15건 (53%) | 생성→공개 53% | 🔴 |
| 유의미 조회 (10+뷰) | 3건/8건 | 공개→조회 38% | ⚠️ |

**End-to-end: 597건 탐지 → 3건 유의미 조회 = 0.5%**

---

## 문제 분류 (총 13건)

### 🔴 A등급 — 즉시 수정 (5건)

#### A1. `/api/og-infographic` 엔드포인트 미존재 (404)

**현상**: 15건 블로그 중 12건에 깨진 인포그래픽 이미지 포함
**원인**: `enrichVisuals()` + AI 프롬프트가 `/api/og-infographic?title=...&type=summary` 참조하지만 **엔드포인트 자체가 없음**
**영향**: 유저에게 깨진 이미지 아이콘 노출 → 신뢰도 하락 + SEO 불이익

**수정**:
```
옵션 A (권장): /api/og-infographic 엔드포인트 신규 생성
- ImageResponse 기반 인포그래픽 이미지 생성
- type: summary (핵심요약 카드), comparison (비교 차트), timeline (타임라인)
- items 파라미터로 동적 데이터 표시
- 디자인: /api/og 와 통일된 브랜드 스타일

옵션 B (빠른 수정): enrichVisuals에서 og-infographic 참조 제거
- 대신 마크다운 테이블/강조 블록으로 대체
- AI 프롬프트에서 og-infographic 참조 삭제
```

#### A2. 발행 성공인데 비공개 — 7/15건 (47%)

**현상**: `issue_alerts.publish_decision = 'auto'`, `is_published = true`인데 `blog_posts.is_published = false`
**원인**: `safeBlogInsert`의 `upsert({ onConflict: 'slug', ignoreDuplicates: true })` → 이전 실패 시도에서 생긴 동일 slug 레코드(is_published: false) 존재 → upsert가 무시 → fallback으로 기존 post id만 가져옴 → is_published 업데이트 안 됨

**수정**:
```typescript
// issue-draft/route.ts processOneIssue 함수
// safeBlogInsert 호출 후, canAutoPublish && blogPostId일 때 강제 공개:

if (canAutoPublish && blogPostId) {
  await sb.from('blog_posts')
    .update({ 
      is_published: true, 
      published_at: new Date().toISOString() 
    })
    .eq('id', blogPostId)
    .eq('is_published', false);  // 이미 공개면 건너뜀
}
```

**즉시 복구**: 현재 비공개 7건 중 score 40+ 건 강제 공개
```sql
UPDATE blog_posts SET is_published = true, published_at = NOW()
WHERE id IN (
  SELECT blog_post_id FROM issue_alerts 
  WHERE publish_decision = 'auto' AND blog_post_id IS NOT NULL
) AND NOT is_published;
```

#### A3. AI 생성 실패율 31% (183건) — 에러 로깅 없음 + 재시도 없음

**현상**: `generateArticle()` → null 반환 → `publish_decision = 'ai_failed'` → `is_processed = true` → 영원히 재처리 안 됨
**원인 추정**: API 429/500 에러, JSON 파싱 실패, 응답 timeout. 하지만 `if (!res.ok) return null`로 에러 코드조차 안 찍음.

**수정 (3단계)**:
```
1. 에러 로깅 추가:
   if (!res.ok) {
     console.error(`[issue-draft] AI API ${res.status}: ${await res.text().catch(() => '')}`);
     return null;
   }
   // JSON.parse도 try-catch + 에러 로깅

2. 재시도 로직:
   ai_failed 건에 retry_count 컬럼 추가 (기본 0)
   retry_count < 3이면 is_processed = false로 리셋 (다음 실행에 재시도)
   retry_count >= 3이면 영구 스킵

3. 대기열에서 ai_failed 우선 재처리:
   .or('is_processed.eq.false,and(publish_decision.eq.ai_failed,retry_count.lt.3)')
```

#### A4. 품질 점수 시스템이 마크다운 인식 불가

**현상**: 이슈 블로그 quality_score 0~57 (13/15건이 0). auto_publish_eligible 전부 false.
**원인**: `blog-quality-score`가 HTML 태그(`<h2`, `<table`, `<ul>`)로 구조 검증 → 마크다운 콘텐츠(`## `, `| |`, `- `) 인식 못함

**영향**: issue-draft 직접 발행 실패 시 `blog-auto-publish` 세이프티넷도 무력화 (quality >= 65 조건 미달)

**수정**:
```typescript
// blog-quality-score/route.ts scorePost()

// 구조화 (20점) — HTML + 마크다운 양쪽 지원
const h2Count = (content.match(/<h2/gi) || []).length 
              + (content.match(/^## [^#]/gm) || []).length;
const h3Count = (content.match(/<h3/gi) || []).length
              + (content.match(/^### [^#]/gm) || []).length;
const hasList = /<[uo]l/i.test(content) || /^[-*] /m.test(content);
const hasTable = /<table/i.test(content) || /\|[-:]+\|/.test(content);

// 내부링크 (15점) — 마크다운 링크도 인식
const internalLinks = (content.match(/href="\/(?!api)/gi) || []).length
                    + (content.match(/\]\(\/(apt|stock|blog|calc|feed)/g) || []).length;
```

#### A5. 실사진 0장 — 커버 + 본문 전부 자동생성 이미지

**현상**: 15건 전부 커버가 `/api/og?title=...` (텍스트 OG). 본문 내 실사진 0장.
**원인**: `blog-generate-images` 크론이 5,576건 OG 커버 백로그 처리 중 → 이슈 블로그 우선순위 없음

**수정**:
```
1. issue-draft에서 AI 기사 생성 직후 네이버 이미지 검색 즉시 실행:
   - 제목 키워드로 네이버 이미지 검색 → 상위 3~5장 선택
   - blog_post_images에 저장 (image_type: 'stock_photo')
   - position 0 이미지를 cover_image로 설정
   - 본문 H2 섹션 2~3개마다 이미지 삽입

2. blog-generate-images에서 source_type='auto_issue' 우선 처리:
   .or('source_type.eq.auto_issue')
   .order('created_at', { ascending: false })
```

---

### 🟡 B등급 — 중요 개선 (5건)

#### B1. 크론 로그 미기록 (4개 이슈 크론)

**현상**: issue-detect, issue-draft, issue-preempt, issue-trend 전부 cron_logs에 기록 없음
**원인**: `withCronAuth`만 적용, `withCronLogging` 미적용

**수정**:
```typescript
// 각 크론의 export 변경:
// Before:
export const GET = withCronAuth(handler);
// After:
export const GET = withCronAuth(async (req: NextRequest) => {
  return withCronLogging('issue-draft', async () => {
    // ... handler 내부 로직
  });
});
```

#### B2. 이슈 중복 탐지 약함

**현상**: 동일 뉴스 다중 RSS에서 반복 수집 → 동일 이슈 2~3건 중복 생성
**예시**: "호르무즈 역봉쇄" 2건, "서부발전 AI교육" 3건

**수정**:
```
issue-detect에서 INSERT 전 중복 체크 강화:
1. title 완전 일치: SELECT EXISTS(... WHERE title = $1)
2. 제목 유사도: check_blog_similarity RPC (threshold 0.6)
3. 핵심 엔티티 겹침: related_entities 배열 2개 이상 동일 → 스킵
```

#### B3. FAQ 생성율 20% (3/15건)

**현상**: AI 프롬프트에서 "FAQ 5~8개 반드시" 요구하지만 80% 미생성
**원인**: Haiku 모델이 긴 JSON 응답에서 FAQ 섹션을 자주 생략

**수정**:
```
1. AI 프롬프트 강화:
   "⚠️ FAQ 누락 시 기사가 발행되지 않습니다. 반드시 '## 자주 묻는 질문' 섹션을 포함하세요."

2. 생성 후 검증:
   if (!article.content.includes('자주 묻는 질문') && !article.content.includes('FAQ')) {
     // safeBlogInsert의 enrichContent가 자동 삽입하지만
     // AI가 직접 생성한 FAQ가 더 품질 높으므로 재생성 요청 or 로깅
   }

3. enrichContent의 자동 FAQ가 이미 존재하지만 → 
   카테고리별 FAQ를 이슈 맥락에 맞게 커스터마이징
```

#### B4. 발행 시간 지연 — 평균 6.4시간, 최대 15.4시간

**현상**: "선점"인데 선점이 안 됨. 즉시 발행 건(0.05h)도 있지만 편차 극심.
**원인**: issue-draft가 10분마다 실행, 10건/회 → score 높은 순 처리 → 저점수 이슈는 밀림

**수정**:
```
1. score 60+ 이슈: issue-detect에서 즉시 issue-draft 트리거 (fire-and-forget)
2. 처리량 증가: MAX_PER_RUN 10 → 15, 스케줄 */10 → */7
3. 선점형 이슈(issue_type: preempt_*) 별도 우선 큐
```

#### B5. 콘텐츠 길이 편차 (4,200~9,000자)

**현상**: 프롬프트는 5,000~7,000자 요구하지만 실제 미달 빈번
**원인**: Haiku max_tokens 8192이면 한글 약 3,000~4,000자 → 프롬프트 오버헤드 포함 시 부족

**수정**:
```
1. max_tokens: 8192 → 12000 (Haiku 지원 범위 내)
2. 콘텐츠 길이 검증: 4,000자 미만이면 보충 생성 요청
   "위 기사가 5,000자 미만입니다. 다음 섹션을 추가로 작성하세요: ..."
3. enrichContent + enrichVisuals 보강 분량도 포함하면 최종 6,000자+ 확보
```

---

### ⚪ C등급 — 개선 권장 (3건)

#### C1. 카테고리 편향 (apt 87%)

**현상**: 518/597건이 부동산. 주식 55건, 경제 20건.
**원인**: issue-detect RSS 피드가 부동산 위주 + issue-preempt가 apt_subscriptions 기반

**수정**: issue-detect RSS에 증권 전문 피드 추가 (한경, 매경, 이데일리 증권 RSS)

#### C2. seo_tier 대부분 unscored/B

**현상**: 발행된 15건 중 seo_tier 'A' 3건, 'B' 5건, 'unscored' 6건
**원인**: seo-score-refresh 크론이 이슈 블로그를 아직 평가 안 함

**수정**: issue-draft에서 safeBlogInsert 시 `seo_tier: 'A'` 기본값 세팅 (이슈 선점 특성상 A 이상)

#### C3. 25점 미만 pending 잔존

**현상**: pending_low = 0 (현재 정리됨) 하지만 handler 시작 시 1회만 실행
**수정**: 별도 정리 로직 불필요 (현재 정상 작동 중)

---

## 구현 순서

### Phase 1: 즉시 수정 (A1~A3) — 30분

| # | 작업 | 파일 | 영향 |
|---|------|------|------|
| 1 | enrichVisuals에서 og-infographic 참조 제거 → 마크다운 강조 블록으로 대체 | issue-draft/route.ts | 깨진 이미지 제거 |
| 2 | AI 프롬프트에서 og-infographic 참조 삭제 | issue-draft/route.ts | |
| 3 | processOneIssue: 발행 후 blog_posts.is_published 강제 UPDATE | issue-draft/route.ts | 비공개 버그 수정 |
| 4 | generateArticle: 에러 로깅 + status code 기록 | issue-draft/route.ts | 디버깅 |
| 5 | ai_failed 재시도: retry_count < 3이면 is_processed=false 리셋 | issue-draft/route.ts | 31% 실패 복구 |
| 6 | 현재 비공개 7건 DB 강제 공개 | SQL migration | 즉시 효과 |

### Phase 2: 품질 체계 (A4~A5 + B1~B3) — 45분

| # | 작업 | 파일 | 영향 |
|---|------|------|------|
| 7 | quality-score: 마크다운 H2/H3/리스트/테이블/링크 인식 | blog-quality-score/route.ts | 점수 정상화 |
| 8 | issue-draft에서 네이버 이미지 검색 → 실사진 3~5장 삽입 | issue-draft/route.ts | 이미지 품질 |
| 9 | 4개 이슈 크론에 withCronLogging 적용 | 4개 route.ts | 모니터링 |
| 10 | issue-detect 중복 탐지 강화 (title + entity) | issue-detect/route.ts | 중복 제거 |
| 11 | AI 프롬프트 FAQ 필수 강화 + max_tokens 12000 | issue-draft/route.ts | 콘텐츠 품질 |

### Phase 3: 성능 최적화 (B4~B5 + C1~C2) — 20분

| # | 작업 | 파일 | 영향 |
|---|------|------|------|
| 12 | score 60+ 즉시 트리거 | issue-detect/route.ts | 선점 속도 |
| 13 | safeBlogInsert seo_tier 기본값 'A' | issue-draft/route.ts | SEO |
| 14 | 증권 RSS 피드 추가 | issue-detect/route.ts | 카테고리 균형 |

### Phase 4: /api/og-infographic 엔드포인트 (선택)

| # | 작업 | 파일 |
|---|------|------|
| 15 | og-infographic/route.tsx 신규 생성 | api/og-infographic/route.tsx |
| | type: summary, comparison, timeline 3종 | |
| | ImageResponse 기반 동적 인포그래픽 | |

---

## DB 마이그레이션

```sql
-- issue_alerts에 retry_count 추가
ALTER TABLE issue_alerts ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- 현재 비공개 이슈 블로그 강제 공개
UPDATE blog_posts SET is_published = true, published_at = NOW()
WHERE id IN (
  SELECT blog_post_id FROM issue_alerts 
  WHERE publish_decision = 'auto' AND blog_post_id IS NOT NULL
) AND NOT is_published;

-- ai_failed 중 score 40+ 재시도 대상으로 리셋
UPDATE issue_alerts 
SET is_processed = false, publish_decision = NULL, retry_count = 0
WHERE publish_decision = 'ai_failed' AND final_score >= 40 AND retry_count = 0;
```

---

## 예상 성과

| 지표 | 현재 | 목표 | 근거 |
|------|------|------|------|
| AI 생성 성공률 | 69% | 90%+ | 재시도 3회 + 에러 로깅으로 원인 파악 |
| 발행 공개율 | 53% (8/15) | 95%+ | is_published 강제 UPDATE |
| 이미지 품질 | OG만 + 깨진 인포그래픽 | 실사진 3~5장 | 네이버 이미지 검색 즉시 실행 |
| quality_score | 0~57 (65 미달) | 65~80 | 마크다운 인식 수정 |
| 선점 속도 | 평균 6.4시간 | 2시간 이내 (60+ 즉시) | 즉시 트리거 + 처리량 증가 |
| End-to-end 전환 | 0.5% (3/597) | 5%+ | 전체 파이프라인 정상화 |

---

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| src/app/api/cron/issue-draft/route.ts | A1~A3, A5, B3, B4, B5 수정 |
| src/app/api/cron/issue-detect/route.ts | B2, B4, C1 수정 |
| src/app/api/cron/issue-preempt/route.ts | B1 withCronLogging |
| src/app/api/cron/issue-trend/route.ts | B1 withCronLogging |
| src/app/api/cron/blog-quality-score/route.ts | A4 마크다운 인식 |
| src/app/api/cron/blog-generate-images/route.ts | A5 이슈 블로그 우선 |
| src/app/api/og-infographic/route.tsx | Phase 4 신규 (선택) |
| SQL migration | retry_count + 비공개 복구 + ai_failed 리셋 |

총: 수정 6개 + 신규 0~1개 + DB 마이그레이션 1건
