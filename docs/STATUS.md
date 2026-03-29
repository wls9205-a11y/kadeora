# 카더라 STATUS.md — 세션 58 (2026-03-30 08:30 KST)

## 최신 커밋
- `12d79ed` — 어드민 단지백과 KPI 패널 + 메인 레이아웃 재배치 (지역→연차 순서)
- `f58a046` — ComplexClient implicit any 타입 11개 수정
- `e90c4f2` — geo meta 타입 에러 + 미사용 useEffect 제거
- `5929d4a` — ComplexClient 버튼 border 속성 중복 제거
- `ce5aeda` — 단지백과 상세 페이지 시각 전면 리디자인
- `2c46d6f` — 단지백과 메인+클라이언트 시각 전면 리디자인
- `886a7b5` — SEO 대폭 강화 (geo, JSON-LD, OG, naver:author)
- `7e2b149` — 사이트맵 34,495개 단지 추가
- `d36c90c` — 단지백과 검색 기능
- `add062c` — /apt 타임아웃 수정 (fetchAllRows 제거)
- `9f2e21d` — 단지백과 DB 뷰 기반 전환
- `8b60c71` — 단지백과 메인 apt_complex_profiles 전환

## 세션 58 작업 내역

### 단지백과 시각 디자인 전면 리디자인 (신규)
- 메인 히어로: 그라데이션 navy→blue + 데코 원형 + 4열 수치 카운터
- 연차별 차트: 7색 그라데이션 28px 바 + box-shadow
- 지역별 현황: 카드 그리드 + TOP 3 하이라이트
- ComplexClient: 글래스모피즘 검색, 컬러 칩 필터, 전세가율 게이지 바
- 카드: 상단 컬러 보더 + 3열 가격 + TOP 3 뱃지 + hover 애니메이션
- 상세 요약: 매매 히어로 카드 (그라데이션) + 전세/월세 사이드 카드
- 시세 차트: 2px 선 + 최근값 점 + 향상된 그라데이션 채우기
- 면적별: 8색 그라데이션 바 + 좌측 컬러 보더 카드 + 평당가
- 거래 이력: 3열 그리드 테이블 + 헤더 + 금액 색상 코딩 + ㎡→평 변환
- CTA: 그라데이션 navy→blue + box-shadow

### 단지백과 SEO 대폭 강화 (신규)
- 상세: Place+GeoCoordinates JSON-LD (1,762개 좌표)
- 상세: Dataset JSON-LD (실거래 데이터셋 스키마)
- 상세: BreadcrumbList 5단계 + FAQPage 4Q
- 상세: DB프로필 기반 metadata (seo_title/description)
- 상세: geo.position/ICBM/geo.placename 메타
- 상세: OG 이미지에 실제 시세 데이터 + 630x630 네이버용
- 상세: naver:author, article:published_time/modified_time
- 메인: CollectionPage+numberOfItems, Dataset, BreadcrumbList, FAQPage 3Q
- DB: 34,495개 SEO title/description 대량 생성

### 단지백과 기능 구현 (신규)
- /apt/complex 메인: apt_complex_profiles DB 기반 전환
- v_complex_age_stats + v_complex_region_stats DB 뷰
- /api/complex-search: trigram GIN 인덱스 검색 API
- ComplexClient: 디바운스 300ms 검색 + 초기화
- 사이트맵 5~7: 34,495개 단지 페이지 (12,000개/청크)

### /apt 페이지 타임아웃 수정
- 미사용 fetchAllRows 49만건 순차 로드 제거
- 에러 반복 발생 → 0건 해소

### 어드민 대시보드 단지백과 KPI
- complexKpi API: 총 프로필/매매/전세/좌표/전월세거래 6개 수치
- 프론트 KPI 패널: 6개 카드 + 매매/좌표 커버율 + 총 실거래

### 단지백과 메인 레이아웃 재배치
- 히어로 → 지역별 현황 → 연차별 차트 → 카드 (지역 셀렉 1순위)

### 이미지 갤러리 시스템 (신규)
- AptImageGallery.tsx: 모바일 스와이프(5장) + 데스크탑 1+2 그리드
- CSS 오버레이 워터마크: 중앙 로고 35% + 우하단 "kadeora.app" 60%
- 라이트박스: 전체화면 모달 + ‹ › 네비 + 카운터 + 캡션
- CSP img-src: https: http: 와일드카드 (외부 도메인 수십 개)
- Mixed Content: toHttps() http→https 강제 변환
- referrerPolicy="no-referrer" (핫링크 방어)
- 이미지 로드 실패 자동 제외 (loadFails Set)

### 이미지 수집 최대 속도화
- 네이버+카카오 듀얼소스 병렬 (단지당 6쿼리 동시)
- BATCH_SIZE 400, 5건씩 병렬, 8회/일 (매 3시간)
- 관련성 필터: 타사 워터마크 차단 + 스톡사이트/위키/병원 차단
- 긍정 키워드: 조감도/투시도/배치도/분양/모델하우스 등
- 기존 무관 이미지 37개 단지 초기화 (재수집)
- 속도: 200건/일 → 3,200건/일 (27일→1.5일 완료)

### 이미지 프록시 → CSS 워터마크 복귀
- /api/apt-img 프록시가 속도 저하 주범 (이미지당 2-5초)
- 프록시 제거 → 외부 URL 직접 로드 + CSS 오버레이 워터마크
- API 코드 유지 (향후 CDN 워밍 용도)

### 프로모 바텀시트 (신규)
- PromoSheet.tsx: V1(비로그인→카카오가입) + V2(로그인→PWA설치)
- PWA 설치: prompt 있으면 직접 .prompt() 호출
- prompt 없으면 브라우저별 수동 가이드 (iOS/Samsung/Chrome)
- GuestWelcome 대체

### safeBlogInsert 7개 크론 에러 해결
- Root Cause: h2 헤더 부족 → enrichContent TOC 미생성 → NO_TOC 거부
- 수정: h3→h2 자동 승격 + 최소 TOC 강제 삽입
- FAQ 템플릿: unsold/finance/general 카테고리 추가
- 에러 로깅: error.code/details 추가

### DB 에러 수정
- unsold_apts.complex_name → house_nm (dashboard API)
- redevelopment_projects.project_name → district_name (region 페이지)
- Postgres 로그 반복 에러 해소

### 기타 버그 수정
- 알림 설정 "확인 중..." 영구 멈춤 → 3초 타임아웃
- 504 타임아웃: collect-site-facilities/trends maxDuration 300초
- 프리미엄 페이지 로고 과대 → maxHeight 180px
- 카카오 공유 COOP: same-origin → same-origin-allow-popups
- 세대수: 총공급 + 일반/특별 구분 (카드/히어로/요약/일정표)
- 더보기 메뉴: 블로그/실거래검색/종목비교 추가 (9→12개)
- 어드민 대시보드: 시세 크롤 동적 표시, DB 크기 반영

## 데이터 현황 (라이브)
- ✅ 블로그: 20,855편
- ✅ 매매 실거래: 496,987건
- ✅ 전월세 실거래: 2,095,019건
- ✅ 단지 프로필: 34,495개 (매매 26,807 / 전세 26,592 / 좌표 1,762)
- ✅ apt_sites SEO: 5,512/5,512 (100%)
- ✅ 유저: 121명
- ✅ DB 크기: 1,372 MB
- 🔄 이미지: 654/5,512 (11.9%) — 듀얼소스 8회/일 수집 중
- 🔄 좌표: 641/5,512 (11.6%) — 자동 수집 중
- 🔄 분양가: 3,684/5,512 (66.8%) — 자동 수집 중

## PENDING
- [ ] Anthropic 크레딧 충전 (blog-trade-analysis Sonnet 호출 실패)
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] Google Search Console 사이트맵 제출

## 크론 총 80+개
## 아키텍처 규칙
1. 블로그 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY/DAILY_LIMIT 80
10. Supabase RPC: try/catch (.catch() 금지)
11. 작업 완료 시 STATUS.md 반드시 업데이트
