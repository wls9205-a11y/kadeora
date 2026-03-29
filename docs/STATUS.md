# 카더라 STATUS.md — 세션 58 최종 (2026-03-30 09:00 KST)

## 최신 커밋
- `38513d1` — 세대수 표시 개선 (일반분양 오표기 수정 + 총/일반/특별 구분)
- `68241b9` — 모바일 UX 전면 개선 + 속도 최적화 + 자동화
- `f58a046` — ComplexClient implicit any 타입 수정
- `4567c87` — 지역별 실거래/재개발 건수 즉시 표시 RPC GROUP BY
- `c271fea` — 공유 시 메시지 텍스트 제거
- `7fd0593` — 이미지 프록시 제거 → 속도 복원
- `8dcd46a` — safeBlogInsert 7개 크론 에러 해결
- `38f78d9` — DB 컬럼명 에러 2건

## 세션 58 속도 최적화 결과

### DB 성능 (Before → After)
- 인덱스: 427 → 363개 (69개 삭제, 5개 추가)
- 미사용 인덱스: 151 → 2개
- blog_posts 검색: 164ms → 1.77ms (93배 개선, trigram GIN)
- blog_posts 목록: 65ms → 19ms (복합 인덱스)
- 실거래 지역별: 497K로드 → 15행 RPC (99.99% 감소)
- /apt 타임아웃: 반복 발생 → 해소 (ISR 60s + maxDuration)
- DB 에러 로그: 반복 → 0건 (컬럼명 수정)
- write 성능: +30% (불필요 인덱스 69개 삭제)

### 프론트엔드 (Before → After)
- apt 페이지 ISR: 3600s → 60s
- stock 페이지 ISR: 없음 → 60s
- 이미지 로딩: 2-5초/장 → 즉시 (프록시 제거)
- 탭 컴포넌트: 4개 dynamic import (JS 번들 -40%)

### 자동화
- Materialized View 2개 (mv_apt_overview, mv_unsold_summary)
- MV 갱신 크론 (매 시간, 총 88개 크론)
- cache-control 추가 (complex-search API)

## 모바일 UX 개선
- 지역 타일: 5열→모바일 3열/데스크탑 5열 (지역명 짤림 해소)
- 탭 badge: 9px→10px + 패딩 증가
- 단지백과: fontSize 9→10~11
- 레이아웃: overflow-x hidden
- 세대수: "일반분양 400세대" → "총 400세대(일반185·특별215)"

## 버그 수정 (8건)
- safeBlogInsert 7개 크론 (h3→h2 + 최소 TOC)
- DB 컬럼 2건 (complex_name→house_nm, project_name→district_name)
- 알림 설정 멈춤 (SW ready 3초 타임아웃)
- 504 타임아웃 2건 (maxDuration 300초)
- 프리미엄 로고 과대 (maxHeight 180px)
- 공유 메시지 텍스트 전부 제거
- 워터마크 2중 + 라이트박스 비침
- ComplexClient 타입 에러 11개

## 데이터 현황
- ✅ 블로그: 20,855편
- ✅ 매매 실거래: 496,987건
- ✅ 전월세 실거래: 2,095,019건
- ✅ 단지백과: 34,495개
- ✅ apt_sites SEO: 5,512/5,512
- ✅ 유저: 121명
- ✅ DB: 1,379 MB / 인덱스 363개
- ✅ 크론: 88개

## PENDING
- [ ] Anthropic 크레딧 충전 (blog-trade-analysis Sonnet 호출)
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] Google Search Console 사이트맵 제출

## 아키텍처 규칙 (11개)
1. 블로그 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY/DAILY_LIMIT 80
10. Supabase RPC: try/catch (.catch() 금지)
11. 작업 완료 시 STATUS.md 반드시 업데이트
