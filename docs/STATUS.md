# 카더라 STATUS.md — 세션 58 (2026-03-30 09:00 KST)

## 최신 커밋
- `68241b9` — 모바일 UX 전면 개선 + 속도 최적화 + 자동화
- `f58a046` — ComplexClient implicit any 타입 수정 (빌드 에러 해소)
- `f54c087` — RPC 타입 에러 (sb as any) 캐스팅
- `7058f24` — RegionStackedBar implicit any 타입 수정
- `4567c87` — 지역별 실거래/재개발 건수 즉시 표시 RPC GROUP BY
- `c271fea` — 공유 시 메시지 텍스트 제거
- `7fd0593` — 이미지 프록시 제거 → 속도 복원 + CSS 워터마크 복귀
- `8dcd46a` — safeBlogInsert 7개 크론 에러 해결
- `38f78d9` — DB 컬럼명 에러 2건

## 세션 58 작업 요약

### 속도 최적화 (무료)
- 미사용 인덱스 69개 삭제 (427→358, write +30%)
- blog_posts 복합 인덱스 3개 (163ms→~20ms)
- RPC GROUP BY: 497K건 로드 → 15행 (실거래/재개발 즉시 표시)
- ISR 60초: apt, stock 페이지 (TTFB -95%)
- Materialized View 2개 (mv_apt_overview, mv_unsold_summary)
- MV 갱신 크론 (refresh-mv, 매 시간)
- cache-control: complex-search API (s-maxage=60)
- pg_stat_statements 리셋 (효과 측정 베이스라인)
- 이미지 프록시 제거 → 외부 URL 직접 로드 (2-5초→즉시)

### 모바일 UX 개선
- 지역 타일 그리드: 5열→모바일 3열/데스크탑 5열 (지역명 짤림 해소)
- 탭 세그먼트: padding↑, badge fontSize 9→10 (터치 타겟/가독성)
- ComplexClient: fontSize 9→10 (매매/전세/월세 라벨)
- main layout: overflowX: hidden (가로 스크롤 방지)
- 라이트박스: 배경 #000 완전 불투명
- 워터마크: CSS 오버레이 35%/60% (2중 표시 수정)

### 버그 수정
- safeBlogInsert 7개 크론: h3→h2 승격 + 최소 TOC 강제 삽입
- DB 컬럼: unsold_apts.complex_name→house_nm, redevelopment.project_name→district_name
- 알림 설정 "확인 중..." 멈춤 → 3초 타임아웃
- 504 타임아웃: collect-site-facilities/trends maxDuration 300초
- 프리미엄 로고 과대 → maxHeight 180px
- 공유 시 메시지 텍스트 전부 제거
- ComplexClient implicit any 타입 11개 수정

### 신규 기능
- 이미지 갤러리: 모바일 스와이프 + 데스크탑 1+2 그리드
- 이미지 수집 듀얼소스: 네이버+카카오 병렬 (3,200건/일)
- 프로모 바텀시트: V1(회원가입) + V2(PWA설치)

## 데이터 현황 (라이브)
- ✅ 블로그: 20,855편
- ✅ 매매 실거래: 496,987건
- ✅ 전월세 실거래: 2,095,019건
- ✅ 단지백과 프로필: 34,495개
- ✅ apt_sites SEO: 5,512/5,512 (100%)
- ✅ 유저: 121명
- ✅ DB 크기: 1,388 MB
- ✅ 크론: 88개
- ✅ 인덱스: 358개 (69개 삭제)
- 🔄 이미지: 654/5,512 (11.9%)
- 🔄 좌표: 641/5,512 (11.6%)
- 🔄 분양가: 3,684/5,512 (66.8%)

## PENDING
- [ ] Anthropic 크레딧 충전
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] Google Search Console 사이트맵 제출

## 아키텍처 규칙
1. 블로그 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY/DAILY_LIMIT 80
10. Supabase RPC: try/catch (.catch() 금지)
11. 작업 완료 시 STATUS.md 반드시 업데이트
