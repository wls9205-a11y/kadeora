# 카더라 STATUS.md — 세션 59 최종 (2026-03-30 12:00 KST)

## 최신 커밋
- `fc52968` — SEO 포털 노출 면적 최대치 (thumbnailUrl·image배열·og:price·SiteNav)
- `d635bab` — SEO 전면 확장 (speakable·og-square·FAQPage 12+9+10 페이지)
- `dd221e7` — 단지백과 연차별/지역별 액센트 컬러
- `f5a1a72` — 단지백과 V1 프리미엄 디자인 + /apt 스타일 지역 섹션
- `4b19557` — 주식 스파크라인 누락 수정 (Supabase 1000행 제한 우회)

## 세션 59 주요 성과

### 포털 노출 면적 최대화 (SEO 풀스택)
- **speakable**: 6→12개 페이지 (네이버 음성검색 + 스마트 스니펫)
- **og-square 630×630**: 2→9개 페이지 (네이버 모바일 확대 썸네일)
- **FAQPage**: 8→10개 페이지 (검색결과 2~3배 면적 확장)
- **thumbnailUrl**: 0→4개 페이지 (구글 이미지 캐러셀 확대)
- **mainEntityOfPage**: 2→4개 페이지 (구글 메인 엔티티 인식)
- **SiteNavigationElement**: 0→6개 섹션 (구글 사이트링크 확장)
- **og:price**: 1→2개 페이지 (카카오/페이스북 가격 표시)
- **Article image 배열**: 단일→듀얼 (1200×630 + 630×630)
- **datePublished/dateModified**: 전 상세 페이지 완비
- **publisher logo size**: width/height 명시
- **naver:author**: 글로벌 기본값 + 개별 오버라이드
- **buildMeta() 헬퍼**: src/lib/seo.ts (신규 페이지 자동 SEO)
- **Auth 페이지 noindex**: notifications, profile
- **vercel.json stock-refresh**: 120→300초 (504 해결)

### 단지백과 V1 프리미엄 디자인
- 그라데이션 히어로 (네이비→블루, 데코 원형)
- 3열 KPI 카드 (평균 매매가/전세가율/총 거래)
- 도넛 차트 연차별 7색 분포 + 범례
- 지역 타일 그리드 (/apt 메인 스타일)
- 카드: 스파크라인 SVG + 원형 게이지 + TOP 뱃지 + 3열 부가
- 연차별 통계 바: 7색 고유 컬러 + 선택 시 발광

### 주식 스파크라인 수정
- 원인: Supabase 기본 limit 1,000행 → 150종목 중 일부 누락
- 수정: gte(date, 15일 전) + limit(3000)
- 기아/KB금융/POSCO/삼성물산/신한지주/LG화학 복원

## 세션 58 주요 성과

### 분양 상세 정확도 개선
- 평형별 바차트 → 정확한 데이터 테이블 (타입|전용면적|일반|특별|합계|최고분양가)
- ai_summary 1,040건 DB 일괄 수정 (오정보 → house_type_info 기반 정확 데이터)
- 입주예정 203004 → 2030년 4월 (fmtYM 적용)
- 분양가 KPI 카드 줄바꿈 표시
- 분양 요약 중복 제거 (히어로만 유지)

### 버그 수정 (12건)
- 토론방 전부 → /discuss 라운지 리다이렉트
- 주변시설 영문(mart/park) → 한글(마트/공원) + updated_at 필터
- 세대수 "일반분양 400세대" → "총 400세대(일반185·특별215)" (4곳)
- 주식 시세 장중 갱신: 30분→5분 + 캐시 300s→60s
- safeBlogInsert 7개 크론 에러 해결
- DB 컬럼명 에러 2건, 알림 멈춤, 504 타임아웃 등

### 속도 최적화
- blog 검색: 164ms → 1.77ms (93배, trigram GIN)
- 실거래 지역별: 497K로드 → 15행 RPC
- 인덱스: 427 → 364개 (63개 삭제 + 8개 추가)
- DB 에러/런타임 에러: 0건

### 기타
- 가이드북 업데이트 (단지백과/종목비교/부동산지도/프리미엄 추가)
- 개인정보처리방침 조항 번호 중복 수정
- 어드민 대시보드: DB 크기 동적 + 이미지 커버리지

## 데이터 현황
- ✅ 블로그: 20,857편 / 매매: 496,987건 / 전월세: 2,095,019건
- ✅ 단지백과: 34,495개 / apt_sites: 5,522개
- ✅ 유저: 121명 / DB: 1,380 MB / 크론: 88개 / 인덱스: 364개

## PENDING
- [ ] Anthropic 크레딧 충전 (블로그 크론 Sonnet 호출 실패)
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] Google Search Console 사이트맵 제출
- [ ] 통신판매업 신고 후 푸터에 번호 추가

## 아키텍처 규칙 (11개)
1. 블로그 삭제 금지 2. stockcoin.net 금지
3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs
7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80
9. DB트리거 HOURLY/DAILY_LIMIT 80
10. Supabase RPC: try/catch (.catch() 금지)
11. 작업 완료 시 STATUS.md 반드시 업데이트
