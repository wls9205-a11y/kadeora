# 카더라 프로젝트 현황 (STATUS.md)

> **마지막 업데이트:** 2026-03-22 세션 18 종료
> **최신 커밋:** `973dd00`
> **다음 세션 시작 명령:** "docs/STATUS.md 읽고 작업 이어가자"

---

## 기본 정보

| 항목 | 값 |
|------|-----|
| 앱 URL | https://kadeora.app |
| 스택 | Next.js 15 App Router + Supabase Pro(서울) + Vercel Pro |
| GitHub | wls9205-a11y/kadeora (main, public) |
| Supabase | `tezftxakuwhsclarprlz` |
| Vercel team | `team_oKdq68eA7PwgcxFs61wGPZ7j` |
| Vercel project | `prj_2nDcTjEcgAEew1wYdvVF57VljxJQ` |

---

## DB 현황 (2026-03-22 기준)

| 테이블 | 건수 | 비고 |
|--------|------|------|
| blog_posts (발행) | 13,778 | AI 자동 생성 크론 활발 |
| apt_transactions | 3,827 | 올해 1~3월, 전국 200개 시군구 |
| posts | 3,749 | 커뮤니티 게시글 |
| apt_subscriptions | 2,500 | 매일 06시 자동 수집 |
| redevelopment_projects | 739 | 서울+경기+부산 (전국 크론 배포됨) |
| unsold_apts | 203 | 국토부 통계, 매월 갱신 |
| stock_quotes (활성) | 150 | 공공데이터 API |
| profiles | 111 | |
| apt_trade_monthly | 44 | RPC 수정 완료, 정상 집계 |
| daily_stats | 7 | 7일 소급 생성 완료 |

---

## 크론 현황 (41개 등록, vercel.json)

### 부동산
| 크론 | 주기 | 상태 |
|------|------|------|
| crawl-apt-subscription | 매일 06시 | ✅ 2,500건 |
| crawl-apt-trade | 평일 08시 | ✅ 올해 전체, 200개 시군구 |
| crawl-apt-resale | 주 1회 | ✅ 35개 시군구 확대 |
| crawl-competition-rate | 매일 12시 | ✅ 신규 |
| crawl-unsold-molit | 매월 1일 | ✅ |
| crawl-seoul-redev | 주 1회 | ✅ |
| crawl-busan-redev | 주 1회 | ✅ |
| crawl-gyeonggi-redev | 주 1회 | ✅ |
| crawl-nationwide-redev | 매주 월요일 | ⚠️ 0건 — API 수정 배포됨, 다음 실행 확인 |
| aggregate-trade-stats | 매일 | ✅ RPC 수정 완료 |

### 주식
| 크론 | 주기 | 상태 |
|------|------|------|
| stock-price | 평일 매일 | ✅ 150종목 |
| stock-crawl | 평일 22시 | ⏳ STOCK_DATA_API_KEY 필요 |
| stock-theme-daily | 매일 | ✅ |
| stock-daily-briefing | 매일 | ✅ |
| exchange-rate | 매일 | ✅ |

### 콘텐츠
| 크론 | 주기 | 상태 |
|------|------|------|
| seed-posts | 30분마다 | ✅ |
| seed-comments | 4시간마다 | ✅ |
| seed-chat | 6시간마다 | ✅ |
| daily-stats | 매일 14:55 | ✅ 필드명 수정 완료 |
| blog-* (10+개) | 다양 | ✅ AI 자동 생성 |

---

## 세션 18 변경 요약 (29건 커밋)

### UI/UX
- 글씨 크기 상향 (보통 14→16px, 크게 16→18px)
- fontSize CSS 변수 전면 전환 — 100+파일 1,000건
- 반응형 CSS, loading/error 14개 페이지, JSON-LD SEO
- 프로필 5개 탭 (글/댓글/⭐관심종목/🏠관심단지/🔖북마크)

### 부동산
- 청약: 캘린더 월이동, 정렬3종, 경쟁률크론, 평형별테이블, 자동수집(106→2500)
- 미분양: 지역별 TOP5 순위
- 재개발: 진행률, 전국 크론
- 실거래: 연단위 수집(3827건), 면적필터, 정렬4종, 최고가/최저가, 건축년도

### 주식
- 한국식 색상, ⭐토글, 테마필터, 비슷한종목, 합법API전환

### 블로그/피드/검색
- 블로그: 커버이미지/검색/정렬/페이지네이션/인기글
- 피드: 이미지썸네일, 인기글배너
- 통합검색 블로그 추가

### DB 마이그레이션 (적용 완료)
- aggregate RPC: region→region_nm, area→exclusive_area
- 품질 게이트: INSERT만 적용
- redev unique index 추가

---

## 미해결 (다음 세션)

### 관리자 수동
- [ ] Google/네이버 서치콘솔 sitemap 제출
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY + KIS_APP_SECRET 환경변수
- [ ] STOCK_DATA_API_KEY 발급

### 코드
- [ ] crawl-nationwide-redev 실행 결과 확인
- [ ] 모바일 실기기 반응형 테스트
- [ ] stock_quotes price=0 99건 해결 (KIS 연동 후)

### 선택적 개선
- [ ] 주식 캔들차트
- [ ] 부동산 지도뷰
- [ ] 푸시 알림 VAPID
- [ ] 검색 결과 하이라이팅

---

## 주의사항
- 두 컴퓨터 동시 작업 시 충돌 전적 → 작업 전 반드시 git pull
- ThemeToggle은 default export (named import 금지)
- 에러 시 catch에서 200 반환 (재시도 루프 방지)
- 블로그는 다른 컴퓨터에서 크론으로 생성 중 — 함부로 삭제 금지
