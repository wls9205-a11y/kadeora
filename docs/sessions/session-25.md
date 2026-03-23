# 세션 25 — 카더라 페이지별 진화

**날짜:** 2026-03-23 (세션 24 이후 연속)
**커밋:** 6건

---

## 주식 페이지 강화

### 종목 알림 설정 UI (StockAlertButton)
- 주식 상세 페이지에서 목표가 알림 설정/관리 모달
- 이상/이하 조건 선택 → 목표가 입력 → 알림 추가
- 기존 알림 목록 표시 + 삭제 기능
- price_alerts 테이블 연동

### 섹터 히트맵 (SectorHeatmap)
- 섹터별 시가총액 비중 + 평균 등락률 트리맵
- 국내(빨강=상승/파랑=하락) / 해외(초록=상승/빨강=하락) 색상 자동 구분
- 섹터 크기가 시총 비중에 비례
- 국내 시총탭, 해외 시총탭에 각각 표시

### 주식↔블로그 연결
- 종목 상세에서 해당 종목명/심볼로 블로그 자동 검색
- 최근 5편까지 날짜+조회수와 함께 카드 표시

---

## 부동산 페이지 강화

### 실거래가 검색 전용 페이지 (/apt/search)
- SSR 페이지 — 단지명/지역/면적 필터 + 서버 페이지네이션
- 면적 필터: 소형(~60㎡) / 중형(60~85㎡) / 대형(85㎡~)
- 인기 지역 표시 (get_trade_region_stats RPC)
- SEO: 메타데이터 + canonical + sitemap 등록

### 재개발 타임라인 시각화 (RedevTimeline)
- 수평 프로그레스 바 + 6단계 아이콘 (구역지정→조합설립→사업시행→관리처분→착공→준공)
- 현재 단계 하이라이트 + 과거 단계 체크마크
- 재개발 상세 모달에 AI 분석 아래 표시

### 부동산↔블로그 연결
- 청약 상세에서 단지명+지역으로 블로그 자동 검색
- 최근 5편 카드 표시

---

## 블로그 페이지 강화

### 읽기시간 + 기본 썸네일
- reading_time_min 컬럼 추가 (14,578건 자동 계산, 한국어 500자/분)
- 블로그 목록에 "📖 3분" 표시
- 커버이미지 없는 글에 카테고리 이모지 썸네일 (🏢📈🏚️💰📝)

### TOC 스크롤 추적 (BlogToc)
- Intersection Observer 기반 현재 읽는 섹션 하이라이트
- 클릭 시 smooth scroll
- 활성 항목에 파란색 좌측 보더 + 볼드

### AI 시드 댓글 크론 (blog-seed-comments)
- 댓글 0건인 최근 블로그 20개에 1~2개 시드 댓글 자동 생성
- 카테고리별 템플릿 (주식/부동산/미분양/재테크)
- 닉네임 랜덤 선택 (15종)
- vercel.json 매일 14시 실행 등록

### 댓글 포인트 인센티브
- BlogCommentCTA 강화: 🎁 5P 적립 뱃지 + 이모지 아이콘
- author_name 컬럼 지원 (시드 댓글 표시)

### FTS 전문검색 인덱스
- blog_posts에 title+content GIN 인덱스 생성
- search_blogs_fts RPC가 이미 활용 중

---

## 교차 기능

### 개인화 피드 블로그 추천
- PersonalDashboard에 "추천 읽을거리" 카드 추가
- 관심종목 있으면 → 해당 종목 관련 블로그 추천
- 관심종목 없으면 → 인기 블로그 추천

---

## 신규 파일 (8개)

```
src/components/StockAlertButton.tsx     — 종목 알림 설정 모달
src/components/SectorHeatmap.tsx        — 섹터별 히트맵
src/components/RedevTimeline.tsx        — 재개발 타임라인
src/components/BlogToc.tsx              — TOC 스크롤 추적
src/app/(main)/apt/search/page.tsx      — 실거래 검색 전용 페이지
src/app/api/cron/blog-seed-comments/route.ts — 시드 댓글 크론
```

## DB 마이그레이션 (Supabase 직접)

```
blog_posts.reading_time_min (smallint, 14578건 자동계산)
blog_posts FTS GIN 인덱스
blog_comments.author_name (text)
blog_comments.is_seed (boolean)
blog_comments.author_id nullable
get_trade_region_stats() RPC
```


## 추가 개선 (세션 25 후반)

### 블로그 관련 글 추천 개선
- 태그 유사도 기반 우선 추천 (첫 2개 태그로 검색)
- 부족하면 같은 카테고리 인기순으로 보충 (최대 5편)
- 관련 글에 조회수 표시

### 블로그 검색 확장
- 제목만 → 제목 + 요약(excerpt) 동시 검색

### JSON-LD 댓글 author_name 지원
- 시드 댓글도 JSON-LD 구조화 데이터에 정확한 이름 표시

### 부동산 검색 페이지 SEO
- 하단 지역별 내부 링크 그리드 (17개 광역시도)

## 다음 세션

- [ ] 아파트 단지별 상세 페이지 (/apt/complex/[name])
- [ ] 종목 비교 페이지 (/stock/compare)
- [ ] 관심종목 미니차트 (5일 라인)
- [ ] 블로그 태그 기반 관련글 추천 개선
- [ ] 실거래가 YoY 비교 (2025년 데이터 수집)
- [ ] 미분양 급증 지역 자동 알림
- [ ] 주식 크론 데이터 채우기 (뉴스/수급/브리핑)
