# 카더라 세션 17 작업 요약

**날짜:** 2026-03-22
**최신 커밋:** `422cd6e` → 배포 `dpl_GmhTQ8YX` (READY ✅)
**배포 횟수:** 8회

---

## 배포 이력

| # | 커밋 | 배포 ID | 주요 내용 |
|---|------|---------|----------|
| 1 | `e3043d6` | `dpl_9H1u71am` | 부동산 UI 대폭 개선 |
| 2 | `3836724` | `dpl_HrD9Ci5` | 글씨 크기 CSS 변수 + title 중복 수정 |
| 3 | `0d4c0c9` | `dpl_7LhUcts` | 어드민 KPI 0 버그 + 다크모드 + 미분양 12개월 |
| 4 | `d7a08d5` | `dpl_J5vFUw` | 주식 환율 헤더 이동 |
| 5 | `07db36c` | `dpl_ERDnDA` | 주식 새로고침 버튼 제거 |
| 6 | `8dbc671` | `dpl_BK5qUP` | robots /blog/ Allow + sitemap 5000 + 크론 에러 |
| 7 | `1eb45ad` | `dpl_DREqjp` | 청약 클릭 + 재개발 한줄평 + 평당가 + ⭐ + 글씨 |
| 8 | `422cd6e` | `dpl_GmhTQ8` | blog title 중복 + robots + AptClient CSS 변수 |

---

## 주요 변경사항

### 부동산 UI 대폭 개선 (1차 배포)

**긴급 버그 수정:**
- `unsold_monthly_stats` 컬럼명 오류: `region_nm`→`region`, `unsold_count`→`total_unsold`, `after_completion_count`→`after_completion`
- `apt_trade_monthly_stats` 컬럼명 오류: `avg_price_per_py`→`avg_price_per_pyeong`, `region_nm`→`region`
- 미분양 히트맵/추이 차트 데이터 전부 0 표시되던 문제 해결

**청약:** 캘린더 날짜 클릭→단지 목록, ⭐ 관심단지 토글 버튼 추가
**미분양:** 히트맵 바 디자인 개선, 상세 페이지 현황 요약 카드 추가
**재개발:** 파이프라인 숫자 클릭→해당 단계 필터
**실거래:** 수집 시군구 40→74개 확대 (대구/인천/광주/대전/울산/세종 추가)

### 글씨 크기 시스템 (2차 배포)

- CSS 변수 `--fs-xs` ~ `--fs-2xl` 도입
- `html.font-large` / `html.font-small` 클래스 오버라이드
- `profiles.font_size_preference` 서버 저장

### title 중복 수정 (2차, 8차 배포)

- 22개 페이지에서 `| 카더라` 접미사 제거 (layout.tsx template 자동 추가와 중복)
- blog page.tsx에서도 '카더라' 제거

### 어드민 + 다크모드 + 미분양 (3차 배포)

- KPI 전부 0 → 개별 count 쿼리 교체 (RPC 의존 제거)
- 다크모드 하드코딩 잔여분 → rgba() 투명 색상
- `refresh-all` maxDuration=60초 (504 방지)
- 평당가 TOP10 불필요한 `/10000` 연산 제거
- 지역별 추이 차트 클릭 가능한 지역 버튼
- 미분양 추이 6→12개월 확장
- 재개발 모달 대표 지번 표시

### 주식/환율 (4~5차 배포)

- 환율을 인덱스 바→헤더 우측으로 이동 (콤팩트 칩)
- 수동 새로고침 버튼 삭제 (5분 자동갱신 유지)

### SEO (6차, 8차 배포)

- robots.txt: `/blog/` Allow 추가 (2,055건 크롤링 차단 해소)
- sitemap: blog_posts limit 1000→5000
- 크론 안정화: contents[i] 범위 초과 방지, catch에서 200 반환

### 청약/재개발/실거래 UI (7차 배포)

- 캘린더 현장 클릭→`/apt/{id}` 상세 링크
- 재개발 모달에 💬 한줄평 작성 버튼
- 평당가 TOP10 라벨 바 우측 바깥에 표시
- ⭐ 버튼 16px→20px, 노란 배경+테두리

### CSS 변수 전면 적용 (7~8차 배포)

- Navigation: 탭/메뉴 → `var(--fs-xs)`, `var(--fs-sm)`
- StockClient: 종목명/가격/등락률 → CSS 변수
- PostCard/FeedClient: 제목/본문 → CSS 변수
- **AptClient.tsx 인라인 fontSize 102건 전부 CSS 변수 교체 완료**

---

## DB 변경사항

| 테이블 | 변경 | 내용 |
|--------|------|------|
| `apt_watchlist` | 컬럼 타입 | `item_id`: UUID → TEXT |
| `unsold_monthly_stats` | 데이터 확장 | 6→12개월, 17시도 × 12개월 = 204건 |

---

## 전체 점검 결과

모든 주요 페이지 200 OK, title 정상, sitemap 1,261개 URL, robots.txt /blog/ Allow,
JSON-LD 전 페이지, Google/Naver 인증 정상, 다크모드·글씨크기·사업자정보·404·RLS 전부 확인.

---

*작성: Claude Opus 4.6 | 2026-03-22*
