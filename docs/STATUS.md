# 카더라 프로젝트 현황 (STATUS.md)

> **마지막 업데이트:** 2026-03-22 (세션 18 종료 시점)
> **최신 커밋:** `a1fd509` → Vercel 자동 배포

---

## 프로젝트 기본 정보

| 항목 | 값 |
|------|-----|
| 앱 URL | https://kadeora.app |
| 스택 | Next.js 15 App Router + Supabase Pro(서울) + Vercel Pro |
| Supabase project_id | `tezftxakuwhsclarprlz` (ap-northeast-2) |
| Vercel team_id | `team_oKdq68eA7PwgcxFs61wGPZ7j` |
| Vercel project_id | `prj_2nDcTjEcgAEew1wYdvVF57VljxJQ` |
| GitHub | wls9205-a11y/kadeora (main, public) |
| 도메인 | kadeora.app |
| 앱 성격 | 금융·부동산 정보 커뮤니티 (주식, 청약, 미분양, 재개발, 실거래가, 커뮤니티, 블로그) |

---

## 사이트 상태

| 페이지 | 상태 | 비고 |
|--------|------|------|
| /feed | ✅ | 인기글 배너, 무한스크롤, 좋아요/댓글/공유 |
| /stock | ✅ | 한국식 색상, ⭐ 관심종목 토글, 비슷한 종목 |
| /apt | ✅ | 마감임박 배너, 재개발 진행률, 실거래 평당가/차트 |
| /discuss | ✅ | 찬반 투표 토론 |
| /blog | ✅ | 커버이미지, 검색, 정렬, 페이지네이션, 인기글 |
| /admin | ✅ | KPI, 크론 상태, 유저 관리, 신고 처리 |
| sitemap | ✅ | 블로그+주식+청약 동적 URL 포함 |
| 다크모드 | ✅ | CSS 변수 기반, 하드코딩 0건 |
| 글씨 크기 | ✅ | 보통 base 16px, 크게 base 18px |
| RLS | ✅ | 전 테이블 적용 |

---

## DB 현황

| 테이블 | 건수 | 비고 |
|--------|------|------|
| blog_posts | 2,055 | 커버이미지, 12개월 분산, 품질 게이트 |
| stock_quotes | 249 | is_active=false 99건 (price=0) |
| apt_subscriptions | 106 | 만료분 status='closed' |
| redevelopment_projects | 945 | 6단계 파이프라인 |
| posts | 3,741 | 카테고리 영문 통일 |
| profiles | 111 | 등급 1~10, 포인트, 글씨 크기 설정 |
| unsold_monthly_stats | 204 | 17시도 × 12개월 |
| daily_stats | 2+ | 크론 fallback 강화됨 |

---

## 미해결 사항 (TODO)

### 관리자 수동 작업
- [ ] Google Search Console — sitemap 제출
- [ ] 네이버 서치어드바이저 — sitemap 제출
- [ ] 토스 라이브키 교체
- [ ] Supabase Vanity URL 설정
- [ ] VAPID 키 생성 (푸시 알림)

### 코드 작업
- [ ] 부산 재개발 API 필드명 매핑 수정
- [ ] stock_quotes 99개 price=0 — KIS API 연동
- [ ] 지역별 거래가 추이 차트 구 탭 연동 확인
- [ ] 프로필에 관심종목/관심단지 탭 추가
- [ ] 상점 페이지 UI 개선
- [ ] 주식 테마 클릭→종목 필터 연동

### 블로그
- [ ] 크론→빌더 RPC 전환 (6개 함수)
- [ ] robots.txt/sitemap CDN 캐시 갱신 확인

---

## 최근 세션 이력

| 세션 | 날짜 | 주요 작업 | 커밋 |
|------|------|----------|------|
| 16 | 03-21~22 | 블로그 시드 대량→정리, 품질 게이트, 빌더 RPC | 다수 |
| 17 | 03-22 | 부동산 UI, 글씨 CSS 변수, title, SEO, 어드민 | 8회 |
| 18 | 03-22 | 글씨 상향, 한국식 색상, 블로그 강화, 피드 인기글, 크론 | 7회 |

---

## 알려진 이슈

- 두 컴퓨터 동시 작업 시 import 충돌로 사이트 다운 전적 (세션 16)
- stock_quotes is_active=false 99건은 UI 숨김, DB 잔존
- 블로그 published_at 필터 다른 컴퓨터에서 추가됨 — 충돌 해결 완료
