# 카더라 STATUS.md — 세션 58 최종 (2026-03-30 09:30 KST)

## 최신 커밋
- `ca44877` — 단지백과 레이아웃 대폭 압축 + 카드 정보 강화 (스크롤 70% 감소)
- `c14ba73` — 단지백과 지역별 필터 연동 (?region= 서버 필터링)
- `12d79ed` — 어드민 단지백과 KPI 패널 + 메인 레이아웃 재배치
- `ec35410` — /rss 404 → /feed.xml 리다이렉트 + DB VACUUM
- `38513d1` — 세대수 표시 개선 (일반분양 오표기 수정)
- `68241b9` — 모바일 UX 전면 개선 + 속도 최적화 + 자동화
- `4567c87` — 지역별 실거래/재개발 건수 즉시 표시 RPC GROUP BY
- `8dcd46a` — safeBlogInsert 7개 크론 에러 해결

## 속도 최적화 최종 결과
- blog 검색: 164ms → 1.77ms (93배, trigram GIN)
- blog 목록: 65ms → 19ms (복합 인덱스)
- 실거래 지역별: 497K로드 → 15행 RPC
- 전월세 카운트: 260ms → 177ms (VACUUM, Heap 0)
- /apt 타임아웃: 해소 (ISR 60s + maxDuration)
- 인덱스: 427 → 364개 (63개 삭제 + 8개 추가)
- DB 에러/런타임 에러: 0건

## 어드민 대시보드 개선
- DB 크기: 하드코딩 '333 MB' → 동적 RPC (get_db_size)
- 이미지 수집 진행률: 654/5,512 (11.9%) 실시간 표시
- 데이터 커버리지: 3열 → 4열 (이미지 추가)
- HealthBadge: 이미지/DB 배지 추가

## 데이터 현황
- ✅ 블로그: 20,855편
- ✅ 매매 실거래: 496,987건
- ✅ 전월세 실거래: 2,095,019건
- ✅ 단지백과: 34,495개
- ✅ apt_sites: 5,512/5,512 (100%)
- ✅ 유저: 121명 / DB: 1,380 MB / 크론: 88개 / 인덱스: 364개
- 🔄 이미지: 654/5,512 (11.9%)
- 🔄 좌표: 641/5,512 (11.6%)
- 🔄 분양가: 3,684/5,512 (66.8%)

## PENDING
- [ ] Anthropic 크레딧 충전
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
