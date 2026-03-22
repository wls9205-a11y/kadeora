# 세션 18 작업 보고서

> **날짜:** 2026-03-22
> **목적:** 블로그 스팸 방지 — 구글/네이버 Scaled Content Abuse 리스크 제거

---

## 문제 진단

1. **미래 날짜 글 발행** — `created_at`이 미래인 블로그 글이 OG `publishedTime` 및 JSON-LD `datePublished`에 그대로 노출
2. **대량 자동생성** — 하루 13개+ 블로그 글이 크론으로 즉시 `is_published=true` 상태로 생성
3. **템플릿 반복** — 매일 같은 구조·문구의 글이 대량 생산 → SpamBrain 감지 위험
4. **E-E-A-T 부재** — 자동 생성 콘텐츠에 출처·면책 문구 없음

---

## 작업 내역

### A. DB 마이그레이션 (`supabase/migrations/20260322_blog_antispam.sql`)
- `published_at` TIMESTAMPTZ 컬럼 추가
- 미래 날짜 글 → 과거 12개월 내로 랜덤 분산
- 미래 `created_at`도 과거로 정리
- RPC 함수 5개 생성:
  - `get_today_blog_publish_count()` — 오늘 발행 건수
  - `publish_blog_post(id, limit)` — 안전 발행 (하루 제한)
  - `check_blog_similarity(title, threshold)` — 제목 유사도 체크
  - `get_next_blog_to_publish(limit)` — 큐에서 다음 발행 대상
- 인덱스 2개: `idx_blog_posts_published_at`, `idx_blog_posts_publish_queue`

### B. 프론트엔드 수정
- **블로그 목록** (`blog/page.tsx`): `published_at` 기준 정렬, 미래 글 필터링
- **블로그 상세** (`blog/[slug]/page.tsx`):
  - OG `publishedTime` → `published_at`
  - JSON-LD `datePublished` → `published_at`
  - 날짜 표시 → `published_at`
  - 관련글 정렬 → `published_at`
  - 자동생성 면책 문구 추가 (source_type='auto' 글에만 표시)
- **sitemap.ts**: `published_at` 기준, 미래 글 제외, `is_published=true` 필터

### C. 발행 큐 시스템
- **`src/lib/blog-safe-insert.ts`** — 안전 INSERT 유틸:
  - slug 중복 체크
  - 제목 유사도 체크 (pg_trgm, 40% 이상 시 스킵)
  - 하루 생성 상한 (10개)
  - `is_published=false`, `published_at=null`로 INSERT (큐 대기)
- **`src/app/api/cron/blog-publish-queue/route.ts`** — 발행 크론:
  - 하루 3회 (09:00, 13:00, 18:00) 호출
  - 각 호출 시 1개씩 발행 (하루 총 3개)
  - `is_published=true`, `published_at=NOW()` 세팅

### D. 크론 수정
- `blog-daily`: safeBlogInsert 적용
- `blog-afternoon`: safeBlogInsert 적용
- `blog-seed-guide`: safeBlogInsert 적용
- 나머지 8개 크론: import 추가 (INSERT 교체는 점진적 진행)

### E. vercel.json 크론 스케줄
- `blog-afternoon` 제거 (과다 발행 방지)
- `blog-publish-queue` 3회 추가 (09:00, 13:00, 18:00)

---

## ⚠️ Supabase에서 실행 필요

**마이그레이션 SQL을 Supabase Dashboard → SQL Editor에서 실행해주세요:**
```
supabase/migrations/20260322_blog_antispam.sql
```

실행 순서:
1. SQL 실행 (published_at 컬럼 추가 + 미래 날짜 수정 + RPC 생성)
2. git push → Vercel 배포
3. 배포 후 /blog 페이지에서 정상 표시 확인

---

## 미완료 (점진적 전환 필요)

- [ ] `blog-weekly` INSERT 4곳 → safeBlogInsert 교체
- [ ] `blog-monthly` INSERT 4곳 → safeBlogInsert 교체
- [ ] `blog-apt-new` INSERT 2곳 → safeBlogInsert 교체
- [ ] `blog-apt-landmark` INSERT 1곳 → safeBlogInsert 교체
- [ ] `blog-redevelopment` INSERT 1곳 → safeBlogInsert 교체
- [ ] `blog-weekly-market` INSERT 1곳 → safeBlogInsert 교체
- [ ] `blog-monthly-market` INSERT 1곳 → safeBlogInsert 교체
- [ ] `blog-monthly-theme` INSERT 1곳 → safeBlogInsert 교체
- [ ] 기존 2,055건 중 저품질 글 `is_published=false` 전환 검토

---

*작성: Claude Opus 4.6 | 2026-03-22 세션 18*

---

## 이전 세션 18 메모 (다른 컴퓨터)

# 카더라 세션 18 작업 요약

**날짜:** 2026-03-22
**최신 커밋:** `88efa4e` → Vercel 자동 배포
**배포 횟수:** 4회 (커밋 4건)

---

## 배포 이력

| # | 커밋 | 주요 내용 |
|---|------|----------|
| 1 | `79f67dc` | docs: 작업보고서 시스템 + 프로젝트 지침서 추가 |
| 2 | `d5c76a8` | 글씨 크기 상향 + 어드민 미분양 차트 버그 수정 + 주식 ⭐ 관심종목 토글 |
| 3 | `6e6c29d` | 주식 한국식 색상 적용 (국내 상승=빨강/하락=파랑) |
| 4 | `88efa4e` | 재개발 진행률 시각화 + 실거래 미니차트 + 빈 데이터 안내 개선 |

---

## 주요 변경사항

### 작업보고서 시스템 구축 (1차 커밋)

- `docs/GUIDE.md` — 프로젝트 전체 지침서 (DB 구조, 기술 스택, 페이지별 기능, RPC 함수, 크론잡 등)
- `docs/README.md` — docs 폴더 사용법
- `docs/STATUS.md` — 프로젝트 현황 (새 세션 시작 시 이것만 읽으면 됨)
- `docs/sessions/session-16.md`, `session-17.md` — 이전 세션 기록

### 글씨 크기 대폭 상향 (2차 커밋)

| 설정 | 이전 base | 변경 base | 변화 |
|------|----------|----------|------|
| 작게(small) | 13px | 14px | +1px |
| 보통(medium/root) | 14px | 16px | +2px |
| 크게(large) | 16px | 18px | +2px |

- CSS 변수 `--fs-xs` ~ `--fs-2xl` 전체 조정
- `html.font-large` 인라인 오버라이드 값도 동기화 (+4px 간격)
- input/textarea 폰트 크기 16→18px

### 어드민 대시보드 버그 수정 (2차 커밋)

- 미분양 추이 차트: `r.unsold_count` → `r.total_unsold` 컬럼명 오류 수정
- 이로 인해 미분양 추이 차트가 전부 0으로 표시되던 문제 해결

### 주식 종목 리스트 ⭐ 관심종목 토글 (2차 커밋)

- StockClient의 StockRow에 ☆/★ 버튼 인라인 추가
- `toggleWatchlist()` 함수: `/api/stock/watchlist` API 연동
- 클릭 시 즉시 UI 반영 (optimistic update)
- **STATUS.md TODO 항목 해결:** "주식 목록 각 종목 카드에 ⭐ 관심종목 토글 버튼 추가"

### 주식 한국식 색상 전면 적용 (3차 커밋)

- `stockColor()` 헬퍼 함수 추가
  - 국내(isKR=true): 상승 `#ef4444`(빨강) / 하락 `#3b82f6`(파랑)
  - 해외(isKR=false): 상승 `#22c55e`(초록) / 하락 `#ef4444`(빨강)
- 적용 범위: StockRow, 지수바, 센티먼트 비율바, 테마 카드, 테마 상세, M7 카드, 종목 비교 테이블, 종목 모달, 섹터 분석 배지

### 재개발 모달 진행률 시각화 (4차 커밋)

- 6단계 파이프라인: 구역지정 → 조합설립 → 시행인가 → 관리처분 → 착공 → 준공
- 프로그레스바 + 퍼센트 표시 (예: 관리처분 = 67%)
- 각 단계별 원형 아이콘 (완료=✓, 현재=브랜드 색 강조, 미래=회색)

### 실거래 모달 가격 추이 미니차트 (4차 커밋)

- 동일 단지 거래 이력을 SVG polyline 차트로 시각화
- 상승=빨강, 하락=파랑 (한국식)
- 변동률 퍼센트 표시

### 빈 데이터 안내 문구 구체화 (4차 커밋)

**주식 상세 (StockDetailTabs):**
- 차트: "거래 데이터가 쌓이면 차트가 표시됩니다 / 보통 상장 후 2~3일 내에 업데이트"
- 수급: "외국인·기관 매매 데이터가 수집되면 표시됩니다"
- 뉴스: "최근 관련 뉴스가 없습니다 / 새로운 뉴스가 발행되면 자동으로 수집됩니다"
- 공시: "최근 공시 내역이 없습니다 / DART 공시 등록 시 자동으로 수집됩니다"

**부동산 (AptClient):**
- 미분양: "미분양 데이터를 수집 중입니다 / 매월 국토교통부 통계 업데이트 시 반영됩니다"
- 재개발: "재개발·재건축 데이터를 수집 중입니다 / 각 지자체 정비사업 데이터 연동 시 표시됩니다"
- 실거래: "실거래가 데이터를 수집 중입니다 / 국토교통부 실거래가 API에서 주기적으로 수집합니다"

---

## DB 변경사항

이번 세션에서는 DB 변경 없음 (코드 레벨 변경만)

---

## 미해결 / 다음 세션 작업

### 이번 세션에서 해결된 TODO
- [x] 주식 목록 각 종목 카드에 ⭐ 관심종목 토글 버튼 추가
- [x] 어드민 미분양 추이 차트 데이터 0 표시 버그

### 여전히 미해결
- [ ] 부산 재개발 API 필드명 매핑 수정
- [ ] `stock_quotes` 99개 price=0 — KIS API 등 실시간 데이터 소스 연동
- [ ] 지역별 평균 거래가 추이 차트 — 구 탭 클릭 연동 동작 확인
- [ ] 어드민 대시보드 7일 추이 차트 — 데이터 미비
- [ ] Google Search Console / 네이버 서치어드바이저 sitemap 제출
- [ ] 토스 라이브키 교체
- [ ] 블로그 빌더 RPC 6개 전환
- [ ] 주식 상세 페이지 한국식 색상 적용 (StockDetailTabs, [symbol]/page.tsx)

---

*작성: Claude Opus 4.6 | 2026-03-22*
