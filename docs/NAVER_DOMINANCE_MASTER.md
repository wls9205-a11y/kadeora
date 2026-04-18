# 네이버 1위 마스터플랜 — 카더라 블로그 압도적 전환 설계서

> 작성: 2026-04-18 · 통합 범위: 하위페이지 강화 + 이슈 선점 + 자체 진화 + 보안 강화
> 목표: 핵심 키워드 네이버 **VIEW 탭 1위** 점유 + 동시에 Google AEO·AIO 대응

---

## 0. Executive Summary

### 현재 상태 (실측)
| 지표 | 현재 | 목표 (90일) |
|---|---|---|
| 게시 블로그 | 5,365편 | 8,000편 (고품질) |
| 100+ view 글 | 1,554편 (29%) | 3,200편 (40%) |
| 본문 인라인 이미지 | 11.4% | 80%+ |
| meta_description 80자+ | 일부 | 100% |
| 실댓글 | 4건 | 1,000건 (목표 주간 20건) |
| issue_alerts 게시율 | 4.5% (65/1,424) | 40%+ |
| competition_score 계산 | **0 (미작동)** | 전건 계산 |
| 일일 유입 | 3,900 (피크) | 15,000+ |

### 핵심 전략 4축 (네이버 VIEW 탭 알고리즘 기반)

1. **C-Rank 축** — 출처 신뢰도 (주제 집중 + 발행 리듬 + 내부 연결성)
2. **DIA 축** — 의도 매칭 정밀도 (쿼리-제목-본문 일관성)
3. **DIA+ 축** — 사용자 참여 시그널 (체류·스크롤·재방문·북마크)
4. **Syndication 축** — 네이버 서치어드바이저 직접 편입

### 실행 원칙
- **"선점 → 진화 → 방어"** 3단 루프를 모든 신규 글에 자동 적용
- 기존 5,365편도 같은 루프에 편입 (blog-rewrite + blog-internal-links 강화)
- 보안은 SEO 품질 시그널 방어 차원 (스팸 신호 차단 = C-Rank 보호)

---

## 1. 현재 상태 정밀 진단

### 1.1 블로그 하위페이지 (from 세션 A 분석)

**DB 실측 (2026-04-18)**
- 전체 59,559건 → 게시 5,365건 (SEO rewrite 진행 중)
- 카테고리: apt 2,348 / stock 1,898 / unsold 501 / redev 316 / finance 293 / general 9
- 인라인 이미지 `![](...)` 포함: **612/5,365 = 11.4%** (가장 큰 SEO 구멍)
- 테이블 포함: 57.7% / FAQ 섹션: 81.8% / 번호 섹션: 46.1%
- 태그 5개+: 55.6% (청약분석 자동글은 4개 평균 — 빈약)
- `blog_post_images` 31,788장 존재 (site_photo 6,789 / infographic 3,469) — **마크다운에 미주입**

**page.tsx 리뷰 결과 (1,303줄)**
- JSON-LD: BlogPosting, NewsArticle, FAQPage, HowTo, Dataset, ImageGallery, BreadcrumbList — 구조는 완비
- 관련글 3단 폴백 (related_slugs → tag → category) — 로직 좋음
- 봇/로그인/비로그인 본문 분기 — OK
- 상단 breadcrumb + 저자 카드 + 태그 pill + 시리즈 진행률 — OK

**구멍**:
1. 상위 글조차 `meta_description` 45~59자 다수 (최적 120~160자의 30%)
2. 관련글 카드에 cover_image/excerpt 미노출 (title만)
3. sidebarRelatedLinks 하단 배치 → 모바일 도달률↓
4. 이전/다음글이 category 시간순 — sub_category 연속성 활용 안 함
5. JSON-LD에 seed 댓글 노출 (`is_seed=false` 필터 없음) — **스팸 신호 위험**

### 1.2 이슈 선점 파이프라인 (from 세션 B 분석)

**issue_alerts 30일 통계**
- 탐지 1,424건 / 게시 65건 (4.5%) / draft만 존재 1,029건
- **230건 pending_draft** (is_auto_publish=true인데 drafted·published 둘 다 없음)
- `apt_sites_gap`: 826건 탐지 → 19건 게시 (2.3%)
- `news_rss stock/economy/commodity/redevelopment`: 100+건 탐지 → **0건 게시**
- `competition_score`: **전건 0** (컬럼 존재, 계산 로직 미구현)
- `fact_check_passed=false`: 51건 (3.5%)

**crons 분석 (53개 blog-* + 5개 issue-*)**
- `issue-preempt`: Phase 1~4 중 Phase 4 (시공사 크롤) DISABLED
- `issue-detect`: RSS 20+ 피드 + Google Trends RSS — 탐지는 잘 됨
- `issue-draft`: 1,029건 draft 생성 — 나쁘지 않음
- **drain 없음**: draft → publish 이행 trigger 없음
- DART (`dart-ingest`, `dart-classify`) 크론 존재하지만 issue_alerts 미연동

### 1.3 자체 진화 시스템 (from 세션 B 분석)

**현재 작동**
- `blog-rewrite` 6편/4h + `batch-rewrite-submit` 500/day
- `blog-internal-links` 내부 링크 자동 주입
- `blog-data-update` 데이터 만료 감지 (작동 여부 미검증)
- `blog-series-assign` 시리즈 자동 배속

**구멍**
- 댓글 → FAQ 피드백 루프 없음
- `post_24h_views` 컬럼 존재하지만 제목 A/B 테스트 미구현
- 신규 엔티티 생성 시 기존 블로그 자동 스캔 + 링크 추가 없음
- 본문 이미지 주입 자동화 없음 (11.4% 갭의 원인)
- 시리즈 다음 편 자동 기획 없음

### 1.4 보안 태세 (from 세션 B 분석)

**완비된 것**
- RLS 100% (11개 blog 테이블)
- DOMPurify 설치 + fallback regex
- Rate limit Upstash + 메모리 폴백 (api 30/min, auth 5/min)
- Zod + sanitize + banned words + blocked URLs (comments)
- CSP 기본 적용 + X-Frame SAMEORIGIN + HSTS 2년

**구멍**
1. CSP `script-src 'unsafe-inline' 'unsafe-eval'` 유지 — nonce 인프라는 있는데 미적용
2. JSON-LD에 seed 댓글 노출 (스팸 신호)
3. `blog_post_images.image_url` SSRF allowlist 없음
4. Blog view rate limit이 공용 api tier (30/min) — 전용 tier 없음
5. Tag sanitization 확인 안 됨 (blog-rewrite cron에서 AI 생성 tag 검증)

---

## 2. 네이버 1위 전략 프레임워크

### 2.1 C-Rank 축 — 출처 신뢰도

**네이버 C-Rank 3요소**: Context(문맥) · Content(내용) · Chain(연결)

| 요소 | 현재 | 개선 방향 |
|---|---|---|
| Context (주제 집중) | sub_category 98% 채워짐 | sub_category별 hub 페이지 생성 |
| Content (내용 품질) | 본문 4,053자 평균 | 이미지 10+, 표·차트 시각화 필수 |
| Chain (연결성) | 관련글 3단 폴백 | 카테고리 hub → 시리즈 → 개별글 3계층 |

**목표**: 도메인 전체 주제 집중도 점수 향상 → 특정 키워드 검색 시 카더라 도메인 전체가 "권위 있는 출처"로 분류

### 2.2 DIA 축 — 의도 매칭

**네이버 DIA 평가 항목**
- 제목-본문-태그 일관성
- 엔티티(종목명/단지명/지역명) 명시
- 최신 데이터 (데이터 일자 표기)
- 출처 명시 (E-E-A-T)

**현재 갭**
- `apt-sub-analysis-*` 자동글 태그 4개 (의도 매칭 영역 좁음)
- 본문 이미지 11.4% (네이버는 이미지 풍부한 글 DIA 점수↑)
- `data_date` 있는 글 1,111/2,348 (apt 47%)

### 2.3 DIA+ 축 — 참여 시그널

**네이버가 보는 참여 시그널**
- 평균 체류시간
- 스크롤 깊이
- 재방문율
- 북마크/공유
- 댓글 품질

**현재 갭 (심각)**
- 실댓글 4건 / 북마크 3건 / 체류 분석 이벤트 없음
- `ReadingProgress` UI는 있는데 analytics event 미발사
- 재방문 측정 미구현

### 2.4 Syndication 축 — 직접 편입

**네이버 서치어드바이저 등록 현황 확인 필요**
- sitemap 30개 인덱스 + fixed-id 30,31 (최근 수정됨)
- IndexNow 7일/100 확장 완료 (메모리 기반)
- 네이버 웹마스터 도구 등록 검증 필요

---

## 3. 통합 작업 패키지 (Work Packages)

### WP-1: 하위페이지 콘텐츠 품질 (16 work orders)

| WO | 작업 | Naver 축 | 우선순위 | 예상시간 |
|---|---|---|---|---|
| 1-1 | JSON-LD `is_seed=false` comment 필터 | C-Rank 보호 | P0 | 10분 |
| 1-2 | meta_description < 80자 일괄 재생성 (Anthropic batch) | DIA | P0 | 1일 + API $40 |
| 1-3 | 본문 이미지 자동 주입 cron (`blog_post_images` → 마크다운) | DIA | P0 | 4시간 |
| 1-4 | 관련글 카드에 cover_image + excerpt 추가 (page.tsx 3곳) | DIA+ | P0 | 30분 |
| 1-5 | `apt-sub-analysis-*` 태그 4→10개 확장 (지역·세대수·분양가·시공사) | DIA | P1 | 2시간 |
| 1-6 | sub_category 연속성으로 이전/다음글 변경 | C-Rank | P1 | 30분 |
| 1-7 | 본문 H2 중간에 sidebarRelatedLinks 블록 주입 | Chain | P1 | 1시간 |
| 1-8 | `Article.about` + `Article.mentions` 엔티티 JSON-LD | DIA | P1 | 1시간 |
| 1-9 | stock 카테고리 `FinancialProduct` 스키마 추가 | DIA | P1 | 1시간 |
| 1-10 | apt 카테고리 `RealEstateListing` 스키마 (apt_complex_profiles 조인) | DIA | P1 | 1시간 |
| 1-11 | Dynamic geo (apt_sites.region/sigungu → meta) | DIA | P2 | 2시간 |
| 1-12 | 스크롤 25/50/75/100% analytics event 발사 | DIA+ | P1 | 30분 |
| 1-13 | 익명 반응 버튼 (👍👎❓🔥) 1-tap + 로그인 유도 | DIA+ | P1 | 3시간 |
| 1-14 | 본문 중간 "이 글 어떠세요?" 마이크로 설문 | DIA+ | P2 | 2시간 |
| 1-15 | `generateStaticParams` 200→500편 상향 | C-Rank | P2 | 30분 |
| 1-16 | 이미지 lazy loading + priority 첫 이미지 eager | DIA+ | P2 | 30분 |

### WP-2: 이슈 선점 시스템 (12 work orders)

| WO | 작업 | Naver 축 | 우선순위 | 예상시간 |
|---|---|---|---|---|
| 2-1 | **draft → publish 병목 해결** (230건 pending 분석 + queue cron 수정) | Freshness | P0 | 3시간 |
| 2-2 | `competition_score` 계산 구현 (Naver 검색결과 count + 최근 24h 발행) | DIA | P0 | 4시간 |
| 2-3 | `news_rss stock/economy/commodity` 게시율 0% 원인 분석 & 수정 | Freshness | P0 | 2시간 |
| 2-4 | DART 공시 → issue_alerts 자동 편입 hook (`dart-classify` 확장) | Freshness | P1 | 2시간 |
| 2-5 | Phase 4 builder crawl 복구 — browserless.io 무료 tier 연동 | Freshness | P1 | 4시간 |
| 2-6 | Naver 카페 공개글 API → 키워드 급증 감지 cron 신규 | Freshness | P2 | 4시간 |
| 2-7 | `issue-preempt` 주기 2h → 30min (Vercel cron 100개 제한 여유 확인) | Freshness | P1 | 30분 |
| 2-8 | `macro-event-detect` + `calendar` 통합 → 예정된 이벤트 선제 드래프트 | Freshness | P2 | 3시간 |
| 2-9 | Google Trends 공식 RSS 외 categorized trends 편입 | Freshness | P2 | 2시간 |
| 2-10 | `issue_alerts.lifecycle_stage` 활용 (preempt→breaking→followup→evergreen) | C-Rank | P2 | 3시간 |
| 2-11 | 중복 이슈 병합 (parent_issue_id) 자동 계산 | C-Rank | P2 | 2시간 |
| 2-12 | 이슈 게시 즉시 IndexNow + Naver PING 동시 발사 | Syndication | P1 | 1시간 |

### WP-3: 자체 진화 루프 (10 work orders)

| WO | 작업 | Naver 축 | 우선순위 | 예상시간 |
|---|---|---|---|---|
| 3-1 | `blog-rewrite` 우선순위를 `view_count DESC + rewritten_at 90일 경과` 기반으로 명시화 | DIA | P0 | 1시간 |
| 3-2 | `data_date` 만료 감지 → 자동 rewrite queue (apt 30일 / stock 7일) | Freshness | P0 | 3시간 |
| 3-3 | 댓글 질문 → blog 본문 FAQ 섹션 자동 추가 (daily cron) | DIA+ | P1 | 3시간 |
| 3-4 | 신규 엔티티 생성 시 기존 블로그 본문 스캔 + 내부 링크 자동 삽입 | Chain | P1 | 4시간 |
| 3-5 | 제목 A/B 테스트: 24h view 하위 20% → 제목 3안 생성 → 7일 후 winner 고정 | DIA | P1 | 4시간 |
| 3-6 | 본문 이미지 0장 글 발견 시 site_photo 자동 주입 cron | DIA | P0 | 2시간 (WO 1-3과 통합) |
| 3-7 | 시리즈 편수 < 7인 시리즈 → 누락 주제 자동 기획 → issue_alerts 생성 | C-Rank | P2 | 3시간 |
| 3-8 | `effectiveness_score` 기반 "실패한 글" 판정 → unpublish or 대체 | C-Rank | P2 | 2시간 |
| 3-9 | 월간 카테고리별 top 10 → 자동 "이달의 추천" hub 페이지 | Chain | P2 | 3시간 |
| 3-10 | blog 본문 내부링크 stale check (링크 대상 unpublish 시 자동 삭제) | Chain | P2 | 2시간 |

### WP-4: 보안 강화 (8 work orders)

| WO | 작업 | 효과 | 우선순위 | 예상시간 |
|---|---|---|---|---|
| 4-1 | CSP `'unsafe-inline' 'unsafe-eval'` 제거 → nonce 전환 | C-Rank 스팸 방어 | P1 | 4시간 (테스트 필수) |
| 4-2 | `issue_alerts` RLS — 익명 SELECT 완전 차단 검증 | IP 보호 | P0 | 30분 |
| 4-3 | 이미지 SSRF allowlist (Unsplash/naver/daum/kadeora만) | 스팸 방어 | P1 | 1시간 |
| 4-4 | Blog view 전용 rate limit tier (10/min, visitor_id key) | 뷰 어뷰즈 방어 | P1 | 1시간 |
| 4-5 | Tag sanitization in `blog-rewrite` cron (XSS 방어) | 품질 시그널 | P1 | 1시간 |
| 4-6 | CSP `Content-Security-Policy-Report-Only` 병행 + Sentry 리포트 | 선제 방어 | P2 | 1시간 |
| 4-7 | `dangerouslySetInnerHTML` 중복 sanitize 경로 감사 | XSS 방어 | P2 | 2시간 |
| 4-8 | 봇 UA에만 공개되는 콘텐츠 검증 (cloaking 시그널 방어) | C-Rank | P2 | 1시간 |

---

## 4. 4주 마일스톤

### Phase 1 (Week 1, 2026-04-19 ~ 04-25) — **P0 Quick Wins**
**핵심 목표**: 대형 구멍 4개 막기 (기존 5,365편 품질 즉시 상향)

- WO 1-1: JSON-LD seed 필터 (10분)
- WO 1-2: meta_description 일괄 재생성 batch (밤새 실행)
- WO 1-3 + 3-6: 본문 이미지 자동 주입 cron 가동 (31,788장 활용)
- WO 1-4: 관련글 카드 강화 (cover+excerpt)
- WO 2-1: draft → publish 병목 해결 (230건 drain)
- WO 2-3: news_rss 게시율 0% 해결
- WO 4-2: issue_alerts RLS 검증

**Week 1 완료 시 기대 효과**
- 인라인 이미지 11.4% → 60%+ (Naver DIA 점수 즉시 상승)
- meta_description 최적 길이 도달 (CTR +15~25%)
- 230건 pending → 150편 신규 게시 (Freshness 시그널)

### Phase 2 (Week 2, 04-26 ~ 05-02) — **시스템 복구**
**핵심 목표**: 이슈 선점 엔진 풀가동 + A/B 진화 시스템

- WO 2-2: competition_score 계산 (선점 정밀도 상승)
- WO 2-4: DART → issue_alerts 연동 (공시 5분 내 선점)
- WO 2-7: issue-preempt 30분 주기
- WO 2-12: IndexNow + Naver PING 즉시 발사
- WO 3-1, 3-2: rewrite 우선순위 + 만료 감지
- WO 3-5: 제목 A/B 테스트 시스템
- WO 1-5: 청약분석 태그 10개 확장

### Phase 3 (Week 3, 05-03 ~ 05-09) — **진화 루프**
**핵심 목표**: 참여 시그널 증폭 + 내부 링크 그래프

- WO 1-12, 1-13, 1-14: 스크롤 이벤트 + 익명 반응 + 마이크로 설문
- WO 3-3: 댓글 → FAQ 자동 반영
- WO 3-4: 신규 엔티티 → 기존 블로그 링크 주입
- WO 1-7, 1-8, 1-9, 1-10: 엔티티 JSON-LD + 본문 중간 링크 블록
- WO 4-1: CSP nonce 전환

### Phase 4 (Week 4, 05-10 ~ 05-16) — **고도화**
**핵심 목표**: 나머지 P1 + P2 소화 + 성과 측정

- WO 2-5, 2-6, 2-8, 2-9: Phase 4 크롤 복구 + 카페 + calendar + Google Trends 카테고리
- WO 2-10, 2-11: lifecycle 관리 + 중복 병합
- WO 3-7 ~ 3-10: 시리즈 자동 기획 + 실패 글 판정 + hub + stale link
- WO 4-3 ~ 4-8: 나머지 보안 강화
- KPI 측정 + 다음 분기 계획

---

## 5. 성공 지표 (KPI)

### 주간 KPI (매주 월요일 STATUS.md 업데이트)
| 지표 | baseline (04-18) | Week 1 목표 | Week 4 목표 |
|---|---|---|---|
| 본문 이미지 ≥3장 비율 | 11.4% | 60% | 85% |
| meta_description 80~160자 비율 | 미측정 | 80% | 99% |
| issue_alerts 주간 게시 | ~16편 (4.5%) | 50편 | 150편 |
| 실댓글 주간 증가 | ~1건 | 5건 | 20건 |
| 네이버 VIEW 탭 노출 키워드 (상위 10개 추적) | 미측정 | 기준 설정 | +30% |
| 일일 유입 | 3,900 (피크) | 5,000 | 10,000 |
| 카더라 도메인 평균 체류시간 | 미측정 | 기준 설정 | +40% |

### 네이버 1위 추적 키워드 (Tier 1 — 고의도 10개)
- "[단지명] 청약" (예: 두산위브 트리니뷰 청약)
- "[지역] 무순위 청약"
- "[종목명] 주가 전망"
- "[종목명] 배당"
- "양도세 계산"
- "청약 가점 계산"
- "분양가상한제 [지역]"
- "[구] 재개발"
- "[지역] 실거래가"
- "[ETF명] 배당"

**각 키워드별 현재 순위 Week 1 중 측정 → 주간 이동 추적**

### Tier 2 — 중의도 100개 키워드
- apt_sites 상위 관심도 30개 × (청약 / 실거래 / 무순위) = 90개
- stock 코스피 상위 10개 종목명

---

## 6. 리스크 & 대응

| 리스크 | 발생 가능성 | 영향 | 대응 |
|---|---|---|---|
| Anthropic API 비용 급증 (meta 재생성) | 중 | 약 $40 | batch API 활용 (50% 할인) |
| Vercel cron 100개 제한 초과 | 낮음 | 신규 크론 추가 차단 | 기존 크론 주기 통합 (여러 작업 묶기) |
| Naver 카페 API rate limit | 중 | 2-6 지연 | 캐시 + 주기 조절 |
| CSP nonce 전환 시 3rd party 스크립트 깨짐 | 중 | 광고·분석 영향 | Report-Only 선 적용 → 7일 모니터 → enforce |
| blog-rewrite 우선순위 변경으로 신규 글 발행 지연 | 중 | 당일 발행량 저하 | 신규 발행 cron과 rewrite 큐 분리 |
| browserless.io 무료 tier 초과 | 낮음 | 월 1,000회 초과 시 유료 | 시공사 5개로 제한 + 일 30회 |
| 익명 반응 버튼 어뷰즈 | 중 | 참여 지표 왜곡 | visitor_id + IP fingerprint + 같은 visitor 시간당 5회 제한 |

---

## 7. 실행 체크리스트 (Phase 1 구현 순서)

다음 세션 시작 시 이 순서대로 병렬 진행:

```
[ ] 1. docs/STATUS.md 읽고 git pull --rebase
[ ] 2. WO 1-1: blog/[slug]/page.tsx line 583 - comments.filter(c => !c.is_seed).slice(0,3)
[ ] 3. WO 4-2: issue_alerts RLS 추가 policy 확인
[ ] 4. WO 1-4: page.tsx 3곳 select 확장 (cover_image, excerpt 추가)
[ ] 5. WO 3-6 + 1-3: 신규 cron blog-image-inject 생성
      - blog_post_images.post_id 대상 posts 중 본문 이미지 0장인 경우
      - H2 앞에 site_photo 1장 + infographic 1장 자동 삽입
[ ] 6. WO 2-1: draft → publish 병목 분석
      - issue_alerts WHERE is_auto_publish=true AND is_published=false 230건 샘플 조사
      - blog-publish-queue cron이 이 테이블 읽는지 확인
      - 안 읽으면 hook 추가
[ ] 7. WO 2-3: news_rss 0% 원인
      - 30일간 news_rss_stock 56건 전부 draft_content NOT NULL인데 왜 publish 안 됐는지
      - fact_check 통과 여부 / is_auto_publish flag 상태 점검
[ ] 8. WO 1-2: meta_description 재생성 batch submit
      - SELECT slug WHERE is_published=true AND length(meta_description)<80
      - batch-rewrite-submit의 sub-task로 meta만 재생성 옵션 추가
[ ] 9. 검증: 전체 변경 통합 확인 후 deployment
      - TypeScript 0 errors / build 성공 / 대표 블로그 URL 200 OK
      - image 주입 후 샘플 10편 실제 이미지 렌더 확인
      - draft→publish 신규 5편 공개 확인
[ ] 10. STATUS.md 업데이트 (세션 N+1 완료 기록) + push
```

---

## 8. 기존 문서와의 관계

이 문서는 다음 문서들을 **통합·대체**:
- `SEO_REWRITE_PLAN.md` — 본문 재작성 부분 흡수 (WO 3-1, 3-2)
- `SERP_DOMINATION_PLAN.md` / `SERP_TOTAL_DOMINATION.md` — SEO 일반 전략 → 본 문서가 네이버 특화로 재편
- `ISSUE_PIPELINE_FIX.md` — WP-2 전체로 승격
- `BLOG_REDESIGN_MASTERPLAN.md` — WP-1 하위페이지 작업으로 흡수
- `CONVERSION_FINAL_PLAN.md` — DIA+ 참여 시그널 축(WP-1 1-12~1-14)과 정렬

기존 문서들은 상세 reference로 유지하되, **실행 단위는 본 문서의 WO 번호로 통일**.

---

## 9. 다음 세션 시작 신호

Node가 "1위플랜 착수" 또는 "Phase 1 시작" 말하면:
1. 이 문서 section 7 체크리스트 순서대로 병렬 진행
2. 각 WO 완료 시 git commit message에 `[WO-X-Y]` prefix
3. Phase 1 종료 시 본 문서 "진행 상황" 섹션 추가 + STATUS.md 갱신

---

**작성자 주**: 본 설계는 3개 세션(하위페이지 강화 / 이슈선점·자체진화 / 보안)의 진단을 통합한 결과물이며, 모든 수치는 2026-04-18 기준 Supabase 실측 데이터 기반. 실행 중 예상과 다른 결과가 나오면 즉시 본 문서 업데이트.
