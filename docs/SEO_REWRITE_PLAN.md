# 카더라 SEO 콘텐츠 리라이트 최종 설계안

> **작성일:** 2026-04-06  
> **상태:** 계획 확정, 구현 대기  
> **예상 총 비용:** ~$180 (Batch API)  
> **예상 기간:** 2~3주 (단계적 실행)

---

## 1. 현황 진단

### 1.1 블로그 현황 (2026-04-06 기준)

| 항목 | 수치 |
|------|------|
| 전체 게시글 | 59,389편 |
| 리라이트 완료 | 17,804편 (30%) |
| 리라이트 미완료 | 41,585편 (70%) |
| apt 카테고리 | 49,663편 (84%) |
| stock 카테고리 | 8,371편 (14%) |
| unsold/finance/general | 1,355편 (2%) |

### 1.2 핵심 문제점

#### A. 구조적 스팸 리스크 (구글 + 네이버 공통)
- 59,389편 중 84%가 동일 템플릿 apt 글
- 신생 도메인에 단기간 대량 콘텐츠 = 자동화 어뷰징 시그널
- 편당 평균 조회수: apt 1.1회, stock 4.7회 = 사용자 가치 입증 불가

#### B. 기존 리라이트 품질 문제 (신규 발견)
- 리라이트 완료된 apt 12,774편 중 **9,622편(75%)이 2,500자 미만**
- 100% FAQ 섹션 포함, 82% 면책 문구 포함 = AI 생성 패턴 감지 가능
- 리라이트 후에도 편당 10.5회 조회 (2,500자 이상은 82.5회) → 품질 미달

#### C. 네이버 특화 리스크
- **C-Rank:** 사이트 레벨 신뢰도 평가 — 저품질 글이 많으면 사이트 전체 강등
- **D.I.A:** 사용자 반응(체류시간, 클릭률, 댓글) 기반 — 현재 거의 0
- **사이트 단위 저품질 판정:** 네이버는 페이지가 아닌 사이트 단위로 처리
- **noindex 무의미:** 네이버는 사이트 전체 크롤링 → noindex만으로는 부족
- **경험 증거 부재:** 직접 촬영 이미지, 체험 데이터 없음
- **published_at 조작 감지:** 21,766편이 2025년 이전 날짜지만 사이트는 2026년 생성

#### D. 구글 특화 리스크
- Helpful Content Update: 자동 생성 콘텐츠 사이트 전체 강등
- Thin content: 2,500자 미만 글 대량 존재
- 중복 콘텐츠: 동일 템플릿 구조 수만 편

---

## 2. 전략 방향

### 핵심 원칙
1. **글 수를 줄이고, 남은 글의 품질을 극대화한다**
2. **점진적으로 변경한다** (급격한 변화는 그 자체가 시그널)
3. **구글과 네이버 양쪽 모두 안전한 방법을 사용한다**
4. **비용 대비 효과(ROI)가 높은 글부터 처리한다**

### 목표 상태
- 게시 글 수: 59,389 → **~15,000편** (74% 감축)
- 리라이트 완료율: **100%** (게시 중인 글 전부)
- 평균 콘텐츠 길이: 2,550자 → **4,000자 이상**
- AI 패턴 다양성: FAQ 100% → **60% 이하** (선택적 포함)

---

## 3. 실행 계획 (5단계)

### Phase 0: DB 준비 + 품질 점수 시스템
**기간: 1일 | 비용: $0**

#### 0-1. 컬럼 추가
```sql
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_score smallint DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS seo_tier text DEFAULT 'unscored';
-- is_published 기존 컬럼 활용 (비공개 처리용)
```

#### 0-2. seo_score 산출 기준 (100점 만점)
| 항목 | 배점 | 산출 방식 |
|------|------|----------|
| 콘텐츠 길이 | 25점 | 4000자 이상 = 25, 3000자 = 18, 2000자 = 10, 미만 = 5 |
| 조회수 | 25점 | view_count 상위 % 기준 정규화 |
| sub_category 존재 | 15점 | NULL이 아니면 15점 |
| source_ref 연결 | 10점 | apt_subscriptions/stock_quotes 실제 JOIN 가능 = 10 |
| 사용자 반응 | 10점 | helpful_count + comment_count 기반 |
| 리라이트 품질 | 10점 | rewritten_at NOT NULL + 3000자 이상 = 10 |
| 제목 고유성 | 5점 | 동일 패턴 제목 그룹 내 중복도 역수 |

#### 0-3. seo_tier 분류
| Tier | 점수 | 조치 | 예상 수량 |
|------|------|------|----------|
| S (우수) | 70+ | 유지 + 리라이트 우선 | ~3,000 |
| A (양호) | 50-69 | 유지 + 리라이트 | ~7,000 |
| B (보통) | 30-49 | 유지 + 리라이트 (후순위) | ~5,000 |
| C (미달) | 15-29 | 비공개 전환 (점진적) | ~20,000 |
| D (삭제 대상) | 0-14 | 즉시 비공개 | ~24,000 |

#### 0-4. rewrite_batches 테이블 생성
```sql
CREATE TABLE rewrite_batches (
  id bigserial PRIMARY KEY,
  batch_id text NOT NULL,           -- Anthropic batch ID
  status text DEFAULT 'submitted',  -- submitted/processing/ended/failed
  post_ids jsonb NOT NULL,          -- [{id, slug, category}]
  batch_size int DEFAULT 0,
  succeeded int DEFAULT 0,
  failed int DEFAULT 0,
  cost_estimate numeric(8,4),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  result_summary jsonb
);
```

---

### Phase 1: 점진적 비공개 전환
**기간: 7일 (매일 일정량) | 비용: $0**

#### 1-1. 왜 "점진적"인가
- 사이트맵이 59,000 → 15,000으로 급감하면 구글/네이버 양쪽에서 이상 시그널
- 7일에 걸쳐 매일 ~3,500편씩 비공개 처리
- 크론으로 자동화: `cron/blog-quality-prune`

#### 1-2. 비공개 처리 방식
```
is_published = false  (비공개)
```
- 404 반환 → 구글은 인덱스에서 자연 제거 (며칠~수주)
- 네이버도 크롤링 실패 시 인덱스에서 제거
- 사이트맵에서 자동 제외 (기존 쿼리가 is_published = true 필터)

#### 1-3. 내부 링크 깨짐 방지
- 비공개된 글의 slug를 `blog/[slug]/page.tsx`에서 체크
- 404 대신 카테고리 목록 페이지로 soft redirect 검토
- related_slugs에서 비공개 글 참조 제거

#### 1-4. 비공개 대상 선별 순서
1. **D tier (0-14점):** 즉시 비공개 — 템플릿만 남은 미리라이트 apt
2. **C tier (15-29점):** 1주일에 걸쳐 점진 비공개
3. **기존 리라이트 저품질 (apt, 2500자 미만):** Phase 2에서 재리라이트 후 유지/비공개 판단

#### 1-5. published_at 정리
- 비공개 전환되지 않는 글 중 published_at이 사이트 생성일보다 이전인 것:
  - `naver:written_time`을 실제 created_at으로 수정
  - 네이버 크롤링 시점과의 괴리 제거

---

### Phase 2: Batch API 리라이트 시스템 구축
**기간: 2일 구현 | 비용: ~$180 (Batch API 50% 할인)**

#### 2-1. 아키텍처
```
[submit 크론] → POST /v1/messages/batches (500건/배치)
                    ↓
              Anthropic 비동기 처리 (1~24시간)
                    ↓
[poll 크론] → GET /v1/messages/batches/{id}
                    ↓ (ended)
              GET results_url → JSONL 파싱
                    ↓
              blog_posts UPDATE (content, rewritten_at, seo_score 재계산)
```

#### 2-2. submit 크론 (`api/cron/batch-rewrite-submit/route.ts`)
- 실행: 1일 1~2회 (vercel.json 등록)
- seo_score 높은 순으로 미리라이트 글 500건 추출
- 각 글에 대해 Batch API request 구성:
  ```json
  {
    "custom_id": "blog-{post_id}",
    "params": {
      "model": "claude-haiku-4-5-20251001",
      "max_tokens": 5000,
      "messages": [{ "role": "user", "content": "..." }]
    }
  }
  ```
- rewrite_batches 테이블에 배치 기록

#### 2-3. poll 크론 (`api/cron/batch-rewrite-poll/route.ts`)
- 실행: 10분 간격
- 진행 중인 배치 상태 체크
- `ended` 상태 → results_url에서 JSONL 다운로드
- 각 결과를 blog_posts에 반영:
  - content, meta_description, excerpt 업데이트
  - rewritten_at = now()
  - seo_score 재계산
  - naver:written_time용 updated_at 갱신

#### 2-4. 리라이트 프롬프트 개선 (네이버 + 구글 양면 최적화)

**기존 문제점:**
- 100% FAQ 포함 → AI 패턴 감지
- 평균 2,550자 → 네이버 D.I.A 체류시간 부족
- 동일한 면책 문구 → 패턴 반복

**개선 프롬프트 규칙:**
1. **3,500자 이상 필수** (기존 3,000자 → 상향)
2. **FAQ는 40% 확률로만 포함** (랜덤 결정)
3. **면책 문구 5가지 변형 중 랜덤 선택**
4. **내부 링크 패턴 다양화** (고정 5개 → 카테고리별 다른 세트)
5. **경험적 서술 강화** ("현장에서 확인한 결과", "실제 방문 시" 등)
6. **소제목 구조 다양화** (## 4~6개 고정 → 3~8개 랜덤)
7. **스타일 8종 + 구조 변형 4종 = 32가지 조합** (기존 8종)

#### 2-5. 리라이트 실행 순서 + 비용

| 순위 | 대상 | 수량 | Batch API 비용 | 기간 |
|------|------|------|-------------|------|
| 1 | stock 미리라이트 | 4,248 | ~$18 | 1~2일 |
| 2 | apt S/A tier 미리라이트 | ~6,000 | ~$50 | 1~2일 |
| 3 | 기존 리라이트 저품질 apt (2500자 미만) 재리라이트 | ~9,622 | ~$80 | 2~3일 |
| 4 | apt B tier 미리라이트 | ~3,000 | ~$25 | 1일 |
| 5 | unsold/finance 잔여 | ~448 | ~$4 | 수시간 |
| **합계** | | **~23,318** | **~$177** | **5~10일** |

---

### Phase 3: SEO 메타데이터 정비
**기간: 1일 | 비용: $0**

#### 3-1. blog/[slug]/page.tsx 수정
```typescript
// generateMetadata에서:
// 비공개 글 → 404 반환 (기존 동작 유지)
// 게시 중인 글:
//   - robots: { index: true, follow: true }  (기본값, 명시적)
//   - naver:written_time → rewritten_at || updated_at (리라이트 시점)
//   - naver:updated_time → updated_at
```

#### 3-2. 사이트맵 최적화
- is_published = true 글만 포함 (기존 동작)
- lastmod를 rewritten_at || updated_at으로 설정
- 사이트맵 크기 59,389 → ~15,000으로 점진 감소 (Phase 1과 연동)

#### 3-3. RSS 피드 정비
- 최근 50건만 포함 (네이버 서치어드바이저 RSS 제출용)
- 리라이트 완료된 고품질 글 위주

#### 3-4. IndexNow 제출
- 리라이트 완료된 URL을 IndexNow로 구글/빙에 제출
- 네이버 서치어드바이저에 사이트맵 재제출

---

### Phase 4: 모니터링 + 유지보수 시스템
**기간: 지속 | 비용: 크론 운영비**

#### 4-1. 어드민 대시보드 패널 (FocusTab/DataTab)
- **배치 진행률:** 진행 중/완료/실패 배치 수
- **리라이트 현황:** 카테고리별 완료율, 평균 품질 점수
- **비공개 전환 진행률:** 일별 비공개 처리 수
- **검색엔진 인덱싱:** 구글 Search Console + 네이버 서치어드바이저 수동 확인 가이드

#### 4-2. 자동 품질 관리 크론
- **월 1회 seo_score 재계산:** view_count 변화 반영
- **신규 글 자동 Batch 큐:** blog-rewrite 크론을 Batch API 전환
- **비공개 글 승격 검토:** seo_score 재계산 후 30점 이상이면 재게시 후보

#### 4-3. 롤백 전략
- 비공개 전환된 글은 삭제하지 않음 → is_published = true로 복원 가능
- 리라이트 전 원본은 별도 보존하지 않음 (DB 용량 제약)
- 배치 실패 시 자동 재시도 (최대 2회)

---

## 4. 구현 파일 목록

### DB 변경 (2개 마이그레이션)
1. `add_seo_score_tier` — seo_score, seo_tier 컬럼 + 점수 계산 함수
2. `create_rewrite_batches` — rewrite_batches 테이블

### 크론 API (4개)
3. `api/cron/batch-rewrite-submit/route.ts` — 배치 제출
4. `api/cron/batch-rewrite-poll/route.ts` — 배치 결과 수집
5. `api/cron/blog-quality-prune/route.ts` — 점진적 비공개 전환
6. `api/cron/seo-score-refresh/route.ts` — 월별 점수 재계산

### 기존 파일 수정 (4개)
7. `blog/[slug]/page.tsx` — naver:written_time 수정 + 비공개 글 처리
8. `sitemap.xml/route.ts` — lastmod 개선
9. `lib/blog-prompt-diversity.ts` — 프롬프트 구조 다양화
10. `admin/tabs/DataTab.tsx` — 배치 모니터링 패널

### 문서 (1개)
11. `docs/SEO_REWRITE_PLAN.md` — 이 문서

---

## 5. 위험 요소 + 대응

| 위험 | 영향도 | 대응 |
|------|--------|------|
| 급격한 사이트맵 축소로 검색엔진 의심 | 높음 | 7일에 걸쳐 점진적 비공개 |
| 비공개 글로의 내부 링크 깨짐 | 중간 | 카테고리 페이지로 soft redirect |
| Batch API 크레딧 소진 | 중간 | 비용 모니터링 + 500건/배치 제한 |
| 리라이트 후에도 네이버 저품질 유지 | 중간 | 사용자 반응 지표 개선 (댓글, 공유) 병행 |
| 네이버 AI가 리라이트 자체를 AI 생성으로 감지 | 중간 | 프롬프트 다양성 32종 + 경험적 서술 |
| published_at 조작 기존 글 문제 | 낮음 | naver:written_time을 실제 시점으로 수정 |

---

## 6. 성공 지표

| 지표 | 현재 | 4주 후 목표 | 12주 후 목표 |
|------|------|-----------|-----------|
| 게시 글 수 | 59,389 | ~15,000 | ~15,000 |
| 리라이트 완료율 (게시 글 중) | 30% | 100% | 100% |
| 평균 콘텐츠 길이 | 3,596자 | 4,500자+ | 5,000자+ |
| 편당 월 조회수 | 0.29 | 1.0+ | 3.0+ |
| 구글 인덱싱 URL 수 | 미확인 | Search Console 확인 | 10,000+ |
| 네이버 인덱싱 URL 수 | 미확인 | 서치어드바이저 확인 | 5,000+ |
| 검색 유입 비율 | ~0% | 5%+ | 20%+ |

---

## 7. 체크리스트 (작업 시 항상 확인)

- [ ] Phase 0: seo_score 컬럼 + 계산 함수 적용
- [ ] Phase 0: rewrite_batches 테이블 생성
- [ ] Phase 0: seo_score 일괄 계산 실행
- [ ] Phase 1: blog-quality-prune 크론 구현 + 등록
- [ ] Phase 1: blog/[slug] 비공개 글 처리 수정
- [ ] Phase 1: 7일 점진 비공개 실행 시작
- [ ] Phase 2: batch-rewrite-submit 크론 구현
- [ ] Phase 2: batch-rewrite-poll 크론 구현
- [ ] Phase 2: 프롬프트 다양성 32종 구현
- [ ] Phase 2: Anthropic 크레딧 $200 충전
- [ ] Phase 2: stock 리라이트 시작
- [ ] Phase 2: apt S/A tier 리라이트 시작
- [ ] Phase 2: 기존 저품질 리라이트 apt 재리라이트
- [ ] Phase 3: naver:written_time 수정
- [ ] Phase 3: 사이트맵 lastmod 개선
- [ ] Phase 3: IndexNow 제출
- [ ] Phase 4: 어드민 배치 모니터링 패널
- [ ] Phase 4: 월별 seo_score 재계산 크론

---

*이 문서는 모든 세션에서 참조 가능하도록 `docs/SEO_REWRITE_PLAN.md`에 저장됨.*
*STATUS.md에도 요약 반영.*
