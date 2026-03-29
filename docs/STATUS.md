# 카더라 STATUS.md — 세션 58 (2026-03-30 08:00 KST)

## 최신 커밋
- `add062c` — /apt 페이지 타임아웃 수정 (미사용 fetchAllRows 49만건 제거)
- `9f2e21d` — 단지백과 연차별/지역별 통계 DB 뷰 기반 전환
- `8b60c71` — 단지백과 메인 apt_complex_profiles 기반 전환
- `9377bc8` — STATUS.md 데이터 대폭 확장 반영 (250만건)
- `01a720a` — sync-complex-profiles limit 200K+500K
- `406a5c2` — 매매 벌크 insert → upsert
- `4728d54` — 매매 벌크 엔드포인트 수정
- `7308d5e` — backfill-trades 인증 수정
- `f3cadce` — collect-site-images 중괄호 누락 수정
- `98bfd4e` — 단지백과 Phase 1+2 전체 구현

## 세션 58 작업 내역

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
