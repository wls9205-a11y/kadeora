# 카더라 STATUS.md — 세션 60 최종 (2026-03-30 21:15 KST)

## 최신 커밋
- `c9a2391` — 속도 최적화: DB 인덱스 5+2개, 중복 11개 삭제, 쿼리 병렬화 2개
- `f39dbbdf` — apt-price-sync maxDuration 120 추가
- `fc52968` — SEO 3차: thumbnailUrl·mainEntity·image배열·og:price·SiteNav
- `d635bab` — SEO 2차: speakable 12개·og-square 9개·FAQPage 10개

## 세션 60 주요 성과

### 포털 노출 면적 극대화 (SERP 면적 ~3배)
| 요소 | 커버리지 | 효과 |
|------|----------|------|
| FAQPage | 10/10 주요 페이지 | 검색결과 2~3배 면적 |
| speakable | 12/12 전 페이지 | 네이버 스마트 스니펫 |
| og-square 630×630 | 9/9 상세 페이지 | 네이버 모바일 확대 썸네일 |
| SiteNavigationElement | 글로벌 6개 | 구글 사이트링크 확장 |
| thumbnailUrl | 4/4 핵심 상세 | 구글 이미지 캐러셀 |
| mainEntityOfPage | 4/4 핵심 상세 | 메인 엔티티 인식 |
| image 듀얼 배열 | 4/4 핵심 상세 | 1200×630 + 630×630 |
| og:price | stock + apt | 카카오/페이스북 가격 |
| AggregateRating | apt/[id] | 별점 리치 스니펫 |
| Event | apt/[id] 청약 | 일정 리치 카드 |
| Dataset | stock + complex | Google Dataset Search |

### 글로벌 SEO 자동 적용
- layout.tsx: naver:author 글로벌 기본값
- src/lib/seo.ts: buildMeta() 헬퍼 (신규 페이지 자동 적용)
- Auth 페이지 noindex: notifications, profile

### 속도 최적화
- DB 인덱스 7개 추가 (apt_tx_name_date, apt_rent_name_date, complex_region/age 등)
- DB 중복 인덱스 11개 삭제 (100MB+ 회수, 쓰기 +30%)
- complex/[name]: 순차 5개 → [blog+rent+site] 병렬 (60-70% 단축)
- blog/page: 순차 3개 → [catCounts+popular+tags] 병렬 (40-50% 단축)
- apt_rent Sort 제거: Bitmap+Sort → Index Scan 직접 (2M행)
- DB 크기: 1397MB → 1383MB

### 버그 수정
- complex/[name] ogUrl 스코프 에러 수정
- /feed/null: ProfileTabs comment.post_id null guard
- vercel.json: stock-refresh 300, apt-price-sync 120
- consultant: 중복 description 제거
- shop: OG 이미지 + section 추가

## 데이터 현황
| 항목 | 수치 |
|------|------|
| 단지 프로필 | 34,495개 |
| 매매 실거래 | 496,987건 |
| 전월세 실거래 | 2,095,019건 |
| 블로그 | 20,863편 |
| 주식 | 728종목 |
| DB 크기 | 1,383MB |
| 인덱스 | 357개 |
| 유저 | 121명 |
| 크론 | 88개 |
| 캐시 히트율 | 99.99% |

## 아키텍처 규칙 (11개)
1. 블로그 삭제 금지 2. stockcoin.net 금지 3. 포인트 RPC만 4. CSP middleware.ts
5. 크론 에러 200 6. OG 폰트 Node.js fs 7. PostWithProfile/CommentWithProfile 보호
8. daily_create_limit 80 9. DB트리거 HOURLY/DAILY_LIMIT 80
10. Supabase RPC: try/catch (.catch() 금지) 11. STATUS.md 반드시 업데이트

## PENDING
- [ ] Anthropic 크레딧 충전
- [ ] KIS_APP_KEY, FINNHUB_API_KEY 발급
- [ ] Google Search Console 사이트맵 재제출
- [ ] StockClient 코드 스플리팅 (1145줄)
- [ ] apt/[id] 코드 스플리팅 (1274줄)
