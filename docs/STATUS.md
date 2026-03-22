# 카더라 프로젝트 현황 (STATUS.md)

> **마지막 업데이트:** 2026-03-22 (세션 18 종료)
> **최신 커밋:** `d0771cd`

---

## 프로젝트 기본 정보

| 항목 | 값 |
|------|-----|
| 앱 URL | https://kadeora.app |
| 스택 | Next.js 15 App Router + Supabase Pro(서울) + Vercel Pro |
| GitHub | wls9205-a11y/kadeora (main, public) |

---

## DB 현황

| 테이블 | 건수 | 비고 |
|--------|------|------|
| apt_subscriptions | 2,500 | 매일 06시 자동 수집, 공공데이터포털 |
| apt_transactions | 3,827 | 전국 200개 시군구, 올해 1~3월 |
| redevelopment_projects | 945 | 서울+경기+부산 (전국 확대 크론 배포됨) |
| unsold_apts | 203 | 국토부 통계, 매월 갱신 |
| stock_quotes | 249 (150활성) | 공공데이터 API 기반 |
| blog_posts | 14,485+ (발행중) | 블로그 생성 크론 활발 |
| posts | 3,747 | 커뮤니티 게시글 |
| profiles | 111 | 사용자 |

---

## 크론 현황 (41개 등록)

| 크론 | 주기 | 상태 |
|------|------|------|
| crawl-apt-subscription | 매일 06시 | ✅ 2,500건 |
| crawl-apt-trade | 평일 08시 | ✅ 올해 전체 월 수집 |
| crawl-apt-resale | 주 1회 | ✅ 35개 시군구 확대 |
| crawl-competition-rate | 매일 12시 | ✅ 신규 |
| crawl-unsold-molit | 매월 1일 | ✅ |
| crawl-seoul-redev | 주 1회 | ✅ 6,470건 |
| crawl-busan-redev | 주 1회 | ✅ 328건 |
| crawl-nationwide-redev | 주 1회 | 🔧 수정 배포됨, 다음 실행 확인 필요 |
| aggregate-trade-stats | 매일 | ✅ RPC 수정 완료 |
| stock-crawl | 평일 22시 | ⏳ API 키 필요 |
| daily-stats | 매일 14:55 | ✅ fallback 강화 |

---

## 미해결 사항

### 관리자 수동
- [ ] Google/네이버 서치콘솔 sitemap 제출
- [ ] 토스 라이브키 교체
- [ ] KIS API 키 발급 (실시간 주식 시세)
- [ ] STOCK_DATA_API_KEY 발급 (공공데이터 주식)

### 코드
- [ ] crawl-nationwide-redev 다음 실행 결과 확인
- [ ] 프로필 관심종목/관심단지 탭
- [ ] 부산 재개발 API 필드명 매핑

---

## 세션 18 (20건 커밋)

글씨 크기 상향, 한국식 주식 색상, 블로그 대폭 강화, 피드 인기글, 
fontSize CSS 변수 전면 전환(100+파일), 부동산 데이터 대폭 확장,
실거래 올해 전체 수집, 경쟁률 크론, 면적필터, 반응형 CSS, 
어드민 버그 수정, 데이터 출처 안내문구, 전국 재개발 크론 수정
