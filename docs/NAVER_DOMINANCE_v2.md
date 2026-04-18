# 네이버 1위 마스터플랜 v2 — 3층 전면 개편 설계서

> 작성: 2026-04-18 (v1 폐기, v2로 전면 개편)
> 근거: 풀스택 실측 진단 (DB + Vercel 로그 + cron 로그 + 트래픽 분석 + 킬러 글 역공학)
> 구조: **인프라 → 플랫폼 → 콘텐츠** 3층. 아래층이 무너지면 위층 노력 전부 무효.

---

## 0. v1을 왜 버렸나 (풀스택 실측 후 드러난 진실)

v1은 **콘텐츠층만** 봤다. 실측해보니:
- **Vercel 타임아웃 대량 발생** — 1~2분 단위 묶음으로 `/blog/*` 504 + 200-timeout 수십 건
- **DB가 전체 부하의 50%+ 를 `blog_posts` 단일 테이블에 쏟고 있음** — 평균 371ms 쿼리
- **인덱스 중복 심각** — slug 3중, category 6중, pgroonga 2개 0-scans
- **`naver_syndication` 시스템 만들어놓고 운용 10%만 함** (네이버 1위 가려는데!)
- **Hostinger 109사이트 ↔ 카더라 백링크 시스템 전무**
- **killer 글 1개가 네이버 유입 78% 차지** (레이카운티 1,336/1,708 PV) — 나머지 5,364편은 네이버에서 거의 유입 0

즉: 콘텐츠 다듬기 전에 **인프라 먼저 살리고, 플랫폼 먼저 깔아야**. 그 다음이 콘텐츠.

---

## 1. 풀스택 실측 스냅샷 (2026-04-18)

### 1.1 트래픽 레퍼러 (7일, /blog/*)
| 출처 | PV | Unique | 비중 |
|---|---|---|---|
| direct | 4,359 | 3,828 | 65% |
| **naver** | **1,708** | **1,169** | **25.5%** |
| google | 294 | 227 | 4.4% |
| daum/kakao | 290 | 230 | 4.3% |
| bing | 25 | 20 | 0.4% |
| internal | **17** | 8 | **0.25%** |

**시사점 1**: 네이버가 구글의 **5.8배** — 네이버 집중이 정답
**시사점 2**: 내부 이동 17건 → **체인(Chain) 축 거의 작동 안 함**
**시사점 3**: 레이카운티 하나가 네이버 1,708 중 **1,336 (78%)** 차지 — power-law 극단

### 1.2 인프라 층
| 항목 | 실측 | 이슈 |
|---|---|---|
| Vercel runtime error (6h) | 블로그 라우트 30+ timeout | 크롤 예산 낭비·인덱싱 감소 |
| Top SQL 평균 | 371ms (`blog_posts is_published=? ORDER BY view_count DESC`) | 서버리스 10s 한계에 근접 |
| blog_posts dead rows | 9,274 / 59,559 (15%) | 수동 VACUUM 없음 |
| 총 인덱스 크기 | 95MB | 중복·unused 30MB+ |
| pgroonga 인덱스 | 2개 설치, 0 scans | 한국어 FTS인데 안 씀 |
| Supabase idle 커넥션 | 46 / 활성 3 | 17일 idle 쿼리 존재 |

### 1.3 플랫폼 층 (네이버 등록·Syndication·백링크)
| 시스템 | 존재 | 운용률 |
|---|---|---|
| robots.txt (Yeti/Daum/Zum 허용) | ✅ | 정상 |
| sitemap.xml (30개 인덱스) | ✅ | 최근 수정됨 |
| naver_syndication 테이블 + 크론 + NaverPublishTab | ✅ | **10%** (60 생성 / 6 발행) |
| naver-cafe-publish 크론 | ✅ | 24h 2회 실행 / 실제 발행 0 |
| Hostinger 109사이트 연동 | ❌ | 테이블·크론·코드 전무 |
| IndexNow 크론 (mass + new-content) | ✅ | 24h 48건 처리 |
| IndexNow submission 로그 | ❌ | 실패 추적 불가 |
| 네이버 웹마스터 도구 검증 파일 | ✅ (`3a23def...txt`) | 등록 상태 재확인 필요 |

### 1.4 콘텐츠 층
| 항목 | 실측 | 목표 |
|---|---|---|
| 게시 블로그 | 5,365편 | - |
| SEO tier S | 1,948 (36%) | 유지 + 확장 |
| SEO tier A | 3,345 (62%) | S로 승격 |
| 본문 인라인 이미지 있음 | 612 (11.4%) | 80%+ |
| **본문 이미지 0편** | **4,753 (88.6%)** | < 20% |
| 실댓글 (is_seed=false) | 4건 | 주간 20건 |
| helpful_count > 0 | 거의 없음 | - |
| view_logs 7일 | 19건 (PV 6,710 중 0.28%) | 20%+ |

### 1.5 이슈 파이프라인
| 단계 | 30일 수치 | 전환율 |
|---|---|---|
| detect | 1,424 | - |
| draft | 1,029 | 72% |
| publish | 65 | **4.5%** |
| competition_score 계산 | 0 (전건) | 미작동 |
| news_rss stock/economy publish | 0 | **0%** |
| apt_sites_gap publish | 19/826 | 2.3% |

### 1.6 크론 운용 (24h)
| 크론 | 상태 | 주요 이슈 |
|---|---|---|
| blog-generate-images | 2,300 처리 / **800 실패 (35%)** | 이미지 생성 실패율 — 11.4% 갭 원인 |
| blog-image-supplement | 120 처리 / **62 실패 (52%)** | 더 심각 |
| issue-draft | 10 failed + 16 running (좀비) | 900초 평균 — 타임아웃 위험 |
| naver-cafe-publish | 2 성공 / 실제 발행 0 | 실질적 비활성 |
| issue-preempt | 12 성공 / 229건 처리 | 정상 |
| batch-rewrite-submit | 7일 59회 / 435편 rewrite | 정상 |
| blog-publish-queue | 3회 / processed 0 | **빈 큐 돌고 있음** |

### 1.7 킬러 글 역공학 (레이카운티 사례)

네이버 1위권 4편 공통점:
| 지표 | 레이카운티 (5,124) | 조정대상지역 (1,002) | 이펜하우스3 (916) | 두산위브 (307) |
|---|---|---|---|---|
| content 길이 | 4,493자 | 2,673자 | 4,964자 | 4,259자 |
| meta_description | 126자 | 158자 | **46자** | 126자 |
| tag 개수 | **12개** | 4 | 5 | 8 |
| 본문 이미지 | 0 | 0 | 0 | 0 |
| H2 개수 | 7 | 12 | 10 | 5 |
| 표 파이프 수 | **60** | 0 | 49 | 52 |
| source | manual | auto | auto | manual |
| comment/helpful | 0/0 | 2/0 | 2/0 | 0/0 |
| sub_category | 청약 | 재테크일반 | 실거래·시세 | **null** |

**킬러 글 공통 DNA**:
1. 본문 4,000~5,000자 (auto 글은 2,600~3,000자로 짧음)
2. 감정 + 숫자 리드 ("5억 차익", "역대급 경쟁률")
3. 표 풍부 (파이프 50+) = DIA 구조화 점수
4. manual 글이 auto보다 잘 먹힘
5. 태그 많을수록 좋음 (레이카운티 12개)
6. **이미지 없어도 1위 가능** — 이미지는 +α, 본질은 제목·리드·표

---

## 2. 3층 아키텍처 — 각 층이 하는 일

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: 콘텐츠 (Content)                              │
│  — 킬러 글 DNA 자동 이식 / 이슈 선점 / 자체 진화        │
│  ↑ Layer 2가 건전해야 글이 유통됨                       │
├─────────────────────────────────────────────────────────┤
│  Layer 2: 플랫폼 (Platform)                             │
│  — naver_syndication 풀가동 / Hostinger 109 백링크     │
│  — 네이버 웹마스터·IndexNow 신뢰도 관리                │
│  ↑ Layer 1이 빨라야 크롤러가 들어옴                    │
├─────────────────────────────────────────────────────────┤
│  Layer 1: 인프라 (Infra)                                │
│  — DB 쿼리·인덱스 최적화 / Vercel 타임아웃 제거        │
│  — 크론 좀비 청소 / VACUUM / 이미지 생성 실패 해결     │
└─────────────────────────────────────────────────────────┘
```

### 핵심 논리
- Layer 1이 **느리면** → 크롤러 타임아웃 → 인덱싱 실패 → 상위 노출 불가 (콘텐츠 의미 0)
- Layer 2가 **없으면** → 도메인 authority 안 올라감 → C-Rank 바닥 (DIA 점수 높아도 상위 불가)
- Layer 3만 만지면 → **power-law 심화** (킬러 1개 나와도 나머지 5,364편 매몰)

---

## 3. Layer 1 — 인프라 (1주차 전부)

**목표**: Vercel 타임아웃 0 + DB 평균 쿼리 < 50ms + 크론 실패율 < 5%

### L1-1: `/blog/[slug]` 쿼리 다이어트 (P0, 3시간)
**문제**: page.tsx가 한 요청에 최대 **18~20개 DB 쿼리** 실행. content 30KB+ 2번 중복 fetch.

**조치**:
1. `generateMetadata`와 `BlogDetailPage`가 같은 `blog_posts` row를 2번 fetch — **한 번만 + React cache**
2. content 컬럼 분리 select — 메타용 쿼리엔 content 제외
3. related 3단 폴백 쿼리들을 `Promise.all` 병렬화 (현재 순차)
4. apt_complex_profiles + apt_sites 폴백 + 이미지 RPC 3개 → 단일 RPC `get_blog_sidebar_data(post_id)`로 통합

**예상 효과**: 서버 쿼리 18→8개, TTFB -400ms

### L1-2: 중복·미사용 인덱스 드롭 (P0, 30분, apply_migration)
**드롭 대상**:
- `idx_blog_posts_slug` (중복 — `idx_blog_slug_published` + `blog_posts_slug_key`가 덮음)
- `idx_blog_list` (중복 — `idx_blog_category_published` 상위호환)
- `idx_blog_posts_category_tags` (중복)
- `idx_blog_posts_published_recent` (중복)
- `idx_blog_posts_pgroonga_title`, `idx_blog_posts_pgroonga_content` (0 scans — 운영 안 쓸 거면 드롭 / 쓸 거면 한국어 검색 전환)
- `idx_blog_posts_content_length`, `idx_blog_posts_title_length` (0 scans)

**예상 효과**: 인덱스 크기 95→65MB, INSERT/UPDATE 속도 +15%, VACUUM 시간 -20%

### L1-3: VACUUM FULL + ANALYZE (P0, 1시간 maintenance window)
- dead rows 9,274 정리 (15% 공간 회수)
- 평균 쿼리 계획 정확도 상승 (last_analyze 어제인데 주기화)
- 이후 weekly `VACUUM ANALYZE` cron 추가

### L1-4: 좀비 크론 청소 + 이미지 생성 실패 원인 해결 (P0, 4시간)
**좀비**: 
- `blog-enrich-rewrite` (running 10h)
- `blog-internal-links` (running 10h)
- `blog-generate-images` (running 10h)
- `seo-title-optimize` (running 8h)
- `issue-detect` (running 8h)
- `issue-draft` (running 1h, 16개 누적)

**조치**:
1. `cron_logs`에서 `status='running' AND started_at < now() - interval '15 minutes'` 자동 stale 처리
2. 같은 크론 중복 실행 방지 lock (`SELECT FOR UPDATE` 또는 Redis SET NX)
3. `blog-generate-images` 35% 실패 원인 조사 (URL 형식? timeout? API 할당량?)
4. `blog-image-supplement` 52% 실패 원인 해결

**예상 효과**: 이미지 11.4% → 50%+ (콘텐츠 개선 없이 크론 고치기만으로)

### L1-5: 자료형·쿼리 패턴 회귀 (P1, 2시간)
- `idx_blog_popular`가 9.7B tuples_read로 1위 hotpath. 현재 `(is_published, view_count DESC, created_at DESC)` — `idx_blog_posts_published_view`와 기능 겹침. 하나로 통합
- `idx_blog_posts_seo_published_cover` (13MB covering index) 는 36K scans만 — `ROW` selectivity 낮음. 재설계 or 드롭

### L1-6: 공개 페이지 Redis 캐싱 (P1, 4시간)
- 블로그 상세는 revalidate 300 (5분). 추가로 페이지 전체 Edge KV/Redis 캐시 1시간 (UA=bot인 경우만)
- 효과: 크롤러 hit 시 DB 안 타고 즉시 응답 → 타임아웃 원천 제거

### L1-7: blog_posts 파티셔닝 검토 (P2, 설계만)
- 현재 177MB 테이블. 59,559 행. 아직 파티셔닝 필요 단계 아님.
- 단, `category` 단일 축으로 파티셔닝 하면 top 쿼리 (`idx_blog_category_published` 5.9B tuples_read)에 큰 이득 가능. 설계만 해두고 Phase 4에 검토.

---

## 4. Layer 2 — 플랫폼 (2주차)

**목표**: 도메인 authority 구축. 네이버가 카더라를 "권위 있는 출처"로 분류하게 만들기.

### L2-1: `naver_syndication` 자동화 완전체 (P0, 하루)
**현재**: 60건 생성 / 6건 블로그 발행 / 10건 카페 발행 → **실질 활용률 16%**

**조치**:
1. `blog_status='ready'` → 자동 네이버 블로그 API 호출 (현재는 관리자가 수동 복사)
   - 네이버 공식 글쓰기 API 없음 → **Puppeteer + 네이버 로그인 세션 쿠키 방식**
   - 또는 **네이버 블로그 카드뷰 SDK** 활용 (링크 연동만으로도 효과)
2. `cafe_status` 실패 케이스 조사 — 현재 24h 2회 실행 / 실제 발행 0
3. 주간 자동 발행 목표: **일 3편 × 7일 = 주 21편** (현재 주 16건에서 30% 상승)
4. 네이버 블로그 **내부 링크로 kadeora.app 권한 역전달** — 카더라로 outbound 링크 풍부하게

**주의**: 네이버 SmartEditor 기반이므로 **중복 콘텐츠 감점 우회**하려면:
- 제목 30% 변형
- 본문 리드 재작성
- 태그 네이버 기준으로 재선정
- 카더라 블로그로 "자세히 보기" CTA 명시

### L2-2: Hostinger 109 사이트 ↔ 카더라 백링크 시스템 (P0, 2일)
**현재**: 테이블·크론·코드 **전무**. 109사이트 활용도 0.

**설계**:
1. 신규 테이블 `satellite_sites` (id, domain, wp_api_url, wp_api_key, category, is_active)
2. 신규 크론 `satellite-backlink-distribute` (매일):
   - 어제 게시된 카더라 블로그 top 5 선정
   - 카테고리 매칭되는 위성 사이트 3~5개 선정
   - WordPress REST API로 **변형된 요약 글 + 카더라 URL dofollow 링크** 자동 발행
3. 테이블 `satellite_backlinks` (blog_post_id, satellite_site_id, satellite_url, published_at)
4. 주간 점검 크론: 위성 사이트에서 카더라 링크 live 검증

**예상 효과**: 카더라 도메인으로 향하는 **dofollow 백링크 일 15~25개** 자동 생성. 3개월 후 Naver C-Rank 측정 가능한 상승.

### L2-3: IndexNow submission 로그 + 실패 재시도 (P1, 2시간)
**현재**: `indexnow-new-content` 48건 처리 / 실패 추적 테이블 없음

**조치**:
1. 테이블 `indexnow_submissions` (url, submitted_at, engine, status_code, retry_count)
2. 실패 시 exponential backoff 재시도
3. 주간 리포트 크론 (관리자 대시보드 카드)

### L2-4: 네이버 서치어드바이저 재검증 (P0, 30분)
- `/3a23def313e1b1283822c54a0f9a5675.txt` 파일은 있음 → 네이버 Search Advisor 검증용
- **실제 등록 상태는 Node만 확인 가능** (https://searchadvisor.naver.com)
- 사이트맵 3개 (sitemap.xml / news-sitemap.xml / image-sitemap.xml) 제출 상태 확인
- 네이버 Search Advisor **수집 요청 일 100건 쿼터** 활용 — 신규 발행 글 자동 제출 (현재 IndexNow만)

### L2-5: 네이버 카페 타겟 정밀화 (P1, 3시간)
**현재**: naver-cafe-publish 크론 있는데 실제 발행 0

**조치**:
1. 부동산 타겟 카페: "부동산스터디", "경제적자유를꿈꾸는사람들", "부린이" 등 상위 10개
2. 주식 타겟 카페: "슈퍼개미", "가치투자연구소" 등
3. 카페별 가입·등업 조건 관리 + 발행 실패 원인 로깅
4. 카더라 링크 직접 금지 카페는 → 요약 글 + 외부 블로그 링크 트윈(네이버 블로그 → 카더라)

### L2-6: AI 검색 (GPT / Claude / Perplexity) 대응 (P2, 2시간)
- 현재 robots.txt에 GPTBot, ClaudeBot, PerplexityBot 등 전부 허용
- `public/llms.txt` 존재 확인됨 → 내용 최적화
- **AI 답변에 카더라가 출처로 자주 인용되게** 구조화 데이터 + 명확한 팩트 표기 강화

---

## 5. Layer 3 — 콘텐츠 (3주차 + 4주차)

**목표**: 킬러 글 DNA를 전체에 이식 + 이슈 선점 + 자체 진화.

### L3-1: 킬러 DNA 템플릿 (P0, 3시간) — 가장 확실한 업리프트

**레이카운티 DNA 추출**:
```
제목: [감정 후크] + [숫자/수치] + [핵심 키워드]
예: "부산 레이카운티 3세대 재분양, 5억 차익 노린다…" (O)
    "레이카운티 청약 분석" (X, 너무 밋밋)

리드 (첫 2문장):
- 시장 현재 상태 한 문장 ("부산 부동산 시장이 들썩입니다")
- **구체 숫자** 포함 ("최대 5억 원대")

본문 구조:
- H2 5~8개 (너무 많으면 DIA- , 너무 적으면 DIA-)
- 표 최소 2개 (파이프 50+)
- FAQ 섹션 (Q.A. 포맷)

태그: 12개 (지역 3 + 핵심키워드 5 + 롱테일 4)
```

**조치**:
1. `lib/blog-killer-dna.ts` 신규 파일
2. `blog-rewrite` cron에서 이 DNA 적용 (제목 리라이트 + 리드 강화 + 태그 확장)
3. `issue-draft` cron에서도 draft 생성 시 DNA 적용
4. 우선 순위: tier A 3,345편 → S로 승격 (60일 목표)

### L3-2: 이미지 생성·주입 복구 + 자동화 (P0, L1-4와 통합)
- `blog-generate-images` 35% 실패 → 원인 수정 후 재시도
- `blog-image-supplement` 52% 실패 → 수정
- 신규: 본문 이미지 0편 → H2 앞마다 site_photo 1장 자동 삽입 (11.4% → 70%+)

### L3-3: 이슈 선점 파이프라인 복구 (P0, L1-4 + 3시간)
**현재 병목**: 
- 230 pending_draft (is_auto_publish=true 인데 안 나감)
- news_rss 100+건 → publish 0
- competition_score 전건 0

**조치**:
1. `blog-publish-queue` 현재 빈 큐 돌고 있음 → `issue_alerts WHERE is_auto_publish=true AND draft_content IS NOT NULL AND NOT is_published`를 실제 읽도록 수정
2. `competition_score` 계산 로직 구현:
   - Naver 검색 API로 쿼리당 결과 수 count
   - 최근 24h 발행 문서 수 (Naver 통합검색 "블로그" 탭 count)
   - `(comp_density / 100)` → `final_score` multiplier로 역산
3. `news_rss` 0% 원인: 아마 `fact_check_passed` gate — 완화 또는 별도 경로
4. DART → issue_alerts hook (유상증자·배당·실적)

### L3-4: 자체 진화 루프 (P1, 2주차~)
1. **데이터 만료 자동 재작성**: `data_date < now() - interval '30 days'` (apt) / `< 7 days` (stock) → 자동 rewrite queue
2. **댓글 → FAQ 루프**: 실댓글 질문 발생 시 해당 블로그 FAQ에 자동 추가 (주간 cron)
3. **제목 A/B**: `post_24h_views` 하위 20% → 3안 생성 → 7일 후 winner 고정
4. **신규 엔티티 링크 주입**: 새 apt_site / stock 등록 시 기존 블로그 본문 스캔 + 내부 링크 추가
5. **실패 글 자동 조정**: effectiveness_score 낮으면 태그·제목 재생성 or unpublish

### L3-5: 내부 링크 그래프 강화 (P0, 2시간) — **Chain 축 (0.25%) 부양**
**현재 최악**: 내부 유입 17/6,710 = 0.25%. 관련글 클릭이 거의 없음.

**조치**:
1. 관련글 카드에 `cover_image` + `excerpt` 추가 (현재 title만) — 첫 번째 세션에서 이미 지적
2. 본문 중간 H2 바로 뒤에 **"관련 단지·종목 3선"** 블록 자동 주입 (현재 하단만)
3. **"이 글을 본 사람들이 함께 본 글"** 섹션 신설 (visitor_id 기반)
4. 파워-로우 완화: 레이카운티 같은 킬러 글에서 **하위 카테고리 hub로 연결** → 방문자 2번째 클릭 유도

### L3-6: JSON-LD seed 댓글 필터 (P0, 10분)
- v1에서 지적했던 건 — 즉시 적용
- `comments.filter(c => !c.is_seed).slice(0,3)` 1줄 수정

### L3-7: 참여 시그널 계측 정상화 (P0, 3시간)
**현재**: view_logs 19건 / PV 6,710건 = 0.28% coverage. 사실상 **참여 시그널 계측 안 됨**.

**조치**:
1. `BlogViewTracker` 컴포넌트가 view_logs에 duration·scroll 실제 기록하는지 검증
2. 스크롤 25/50/75/100% 이벤트 발사 + `view_logs.scroll_depth` UPDATE
3. 체류 5s/30s/2min 마일스톤 기록
4. 관리자 대시보드에 주간 카테고리별 평균 체류·스크롤 그래프

### L3-8: 익명 반응 버튼 (P1, 3시간)
- 👍👎❓🔥 1-tap, visitor_id 기반
- 로그인 유도 장벽 낮춤
- 데이터: `blog_reactions` 신규 테이블

### L3-9: meta_description 일괄 재생성 (P0, batch, $40)
- < 80자 전체 대상 → Anthropic batch API
- 목표 120~160자

### L3-10: 청약분석 태그 4→10개 확장 (P1, 2시간)
- `apt-sub-analysis-*` 2,348편 대상
- 지역(시/구/동) + 타입 + 세대수대 + 분양가대 + 시공사 + 사업유형 자동 추출

---

## 6. 우선순위 기반 실행 (4주 계획)

### Phase 1 (Week 1, 04-19 ~ 04-25) — **인프라 복구**
**이것만 해도 기존 콘텐츠의 네이버 노출이 즉시 상승**

1. L3-6: JSON-LD seed 필터 (10분) ← 위험 대비 최소 비용, 스팸 신호 제거
2. L2-4: 네이버 Search Advisor 재검증 (30분)
3. L1-2: 중복 인덱스 드롭 (30분, apply_migration)
4. L1-3: VACUUM FULL + weekly ANALYZE 크론 (1시간)
5. L1-4: 좀비 크론 청소 + blog-generate-images 35% 실패 수정 (4시간)
6. L3-2: 이미지 주입 자동화 (L1-4와 통합)
7. L1-1: `/blog/[slug]` 쿼리 다이어트 (3시간)
8. L3-3: issue-pipeline draft→publish 병목 해결 (3시간)
9. L1-6: Bot 요청 Edge 캐싱 (4시간)
10. L3-9: meta_description 재생성 batch submit (Anthropic batch, 밤새)

**Week 1 KPI**
- Vercel timeout 시간당 20+ → 0~2
- 본문 이미지 포함 11.4% → 60%+
- DB 평균 쿼리 371ms → 80ms 이하
- pending_draft 230 → 50 이하
- naver_pv 주간 1,708 → 2,500+

### Phase 2 (Week 2, 04-26 ~ 05-02) — **플랫폼 구축**
**도메인 authority 엔진 가동**

1. L2-1: naver_syndication 자동화 완전체 (1일)
2. L2-2: Hostinger 109 백링크 시스템 (2일) ← 큰 한 방
3. L2-3: IndexNow 로그 + 재시도
4. L2-5: 네이버 카페 타겟 정밀화
5. L3-1: 킬러 DNA 템플릿 + blog-rewrite 적용
6. L3-5: 내부 링크 그래프 강화 (관련글 카드 + 중간 블록)
7. L3-10: 청약분석 태그 확장

**Week 2 KPI**
- naver_syndication 운용률 16% → 80%
- 위성 사이트 자동 백링크 주간 100+ 개
- 내부 유입 0.25% → 2%+
- 일 naver_pv 240 → 400+

### Phase 3 (Week 3, 05-03 ~ 05-09) — **자체 진화**
1. L3-4: 데이터 만료 자동 재작성
2. L3-4: 제목 A/B
3. L3-4: 신규 엔티티 링크 주입
4. L3-4: 댓글 FAQ 루프
5. L3-7: 참여 계측 정상화
6. L3-8: 익명 반응 버튼
7. L1-5: 자료형 회귀 (쿼리 패턴)

**Week 3 KPI**
- view_logs coverage 0.28% → 30%+
- 익명 반응 주간 500+
- effectiveness_score 기반 재작성 주간 30편

### Phase 4 (Week 4, 05-10 ~ 05-16) — **고도화·측정**
1. L3-3: competition_score 계산 + DART hook
2. L2-6: AI 검색 대응 (llms.txt 최적화)
3. L1-7: 파티셔닝 설계 (결정 보류)
4. 보안 마감 (CSP nonce, SSRF allowlist 등 v1 WP-4 흡수)
5. Phase 1~3 KPI 최종 집계 + Phase 2 계획

---

## 7. 성공 지표 KPI (주간 STATUS.md 갱신)

### 북극성 지표 (이 숫자만 봐)
- **네이버 referrer 주간 PV** — 현재 1,708, 4주 후 5,000+, 12주 후 20,000+
- **Tier 1 키워드 네이버 VIEW 탭 1위 수** — 현재 1~2개, 4주 후 5개, 12주 후 20개

### 인프라 KPI
| 지표 | Week 0 | Week 1 | Week 4 | Week 12 |
|---|---|---|---|---|
| Vercel timeout / 시간 | 20+ | 0~2 | 0 | 0 |
| 평균 DB 쿼리 (top 1) | 371ms | 80ms | 40ms | 30ms |
| 크론 실패율 | 35%+ | 10% | 5% | 3% |

### 플랫폼 KPI
| 지표 | Week 0 | Week 2 | Week 4 | Week 12 |
|---|---|---|---|---|
| naver_syndication 발행 주 | 16건 | 21건 | 35건 | 60건 |
| 위성 백링크 주 | 0 | 0 | 100+ | 200+ |

### 콘텐츠 KPI
| 지표 | Week 0 | Week 1 | Week 4 | Week 12 |
|---|---|---|---|---|
| 인라인 이미지 포함 | 11.4% | 60% | 80% | 90% |
| meta_description 80~160자 | 미측정 | 90% | 99% | 99% |
| 내부 이동률 | 0.25% | 1% | 3% | 5% |
| view_logs coverage | 0.28% | 10% | 40% | 60% |
| 실댓글 주간 | ~1 | 5 | 20 | 50 |

### 파이프라인 KPI
| 지표 | Week 0 | Week 2 | Week 4 |
|---|---|---|---|
| issue_alerts 게시율 | 4.5% | 20% | 40% |
| pending_draft | 230 | 100 | 30 |
| news_rss publish 주 | 0 | 10 | 30 |

---

## 8. 리스크 매트릭스

| 리스크 | 가능성 | 영향 | 완화책 |
|---|---|---|---|
| VACUUM FULL 중 서비스 일시 락 | 중 | 5~10분 블록 | maintenance window (02~04시 KST) + VACUUM FULL CONCURRENTLY 불가 → pg_repack extension 검토 |
| 인덱스 드롭 후 특정 쿼리 느려짐 | 낮 | 복구 필요 | pg_stat_statements before/after 비교, 15분 내 원복 가능 |
| 네이버 blog 자동 발행 계정 차단 | 중 | syndication 중단 | 다중 계정 로테이션 + 발행 간격 30분+ + 정품 API 전환 장기 |
| Hostinger 위성 109개 스팸 처리 | 중 | 백링크 전부 무효 | 카테고리 매칭 + 요약 변형 + rate 제한 |
| blog-rewrite DNA 적용 후 기존 성과 글 제목 훼손 | 중 | 레이카운티급 글 역효과 | S tier는 DNA 적용 제외 + 사전 a/b 최소 30편 |
| Anthropic batch 재생성 5000편 품질 저하 | 낮 | 일부 글 rollback | 적용 전 샘플 100편 수동 검수 |
| Vercel cron 100개 한도 | 낮 | 신규 크론 차단 | 기존 다수 크론을 1개로 통합 (orchestrator 패턴) |

---

## 9. 이 문서의 실행 규칙

1. 모든 작업은 이 문서의 **L#-# 번호**로 참조 (예: L1-2)
2. git commit message prefix: `[L1-2]`, `[L2-1]` 형식
3. 각 Phase 완료 시 본 문서 하단에 **진행 상황** 섹션 추가 + STATUS.md 갱신
4. KPI 측정은 매주 월요일 15시 KST (3-hour window 기준)
5. 기존 문서 통합 — 본 v2 발행 이후 SEO_* / SERP_* / ISSUE_PIPELINE_FIX.md 등은 **reference only**, 실행은 이 문서 기준

---

## 10. 이 문서가 풀스택인 이유

| 계층 | v1 (폐기) 에서 본 것 | v2에서 추가한 실측 |
|---|---|---|
| 네트워크 | robots.txt / sitemap | Vercel timeout, Edge 캐시, bot UA 전용 fastpath |
| 애플리케이션 | page.tsx 1303줄 리뷰 | **쿼리 중복**, React cache, Promise.all 병렬화 |
| 데이터베이스 | RLS 확인 | 인덱스 중복·dead rows·pg_stat_statements 분석 |
| 파이프라인 | issue_alerts 1,424건 | **크론 좀비 10+, 이미지 실패율 35~52%** |
| 플랫폼 | 언급 없음 | **naver_syndication 실태, Hostinger 부재** |
| 트래픽 | 언급 없음 | **referrer 세분화, 킬러 글 78% 집중** |
| 콘텐츠 | 이미지 갭, 태그 | 킬러 DNA 역공학 템플릿 |

v2는 **"네이버 1위는 콘텐츠만으로 안 된다"**는 실측 결과의 결론물.

---

## 다음 세션 진입 신호

**"v2 Phase 1 시작"** 또는 **"L1 착수"** → Section 6의 Phase 1 10단계 순서대로 병렬 진행.
