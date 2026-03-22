# 카더라 프로젝트 현황 (STATUS.md)

> **마지막 업데이트:** 2026-03-23 세션 22 종료
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

## DB 현황 (2026-03-23 기준)

| 테이블 | 건수 | 비고 |
|--------|------|------|
| blog_posts (발행) | 13,778+ | AI 자동 생성 크론 활발 |
| apt_transactions | 3,827+ | 올해 1~3월, 전국 200개 시군구 |
| posts | 3,749+ | 커뮤니티 게시글 |
| apt_subscriptions | 2,500+ | 매일 06시 자동 수집 |
| redevelopment_projects | 739+ | 서울+경기+부산 (전국 크론 배포됨) |
| unsold_apts | 203 | 국토부 통계, 매월 갱신 |
| stock_quotes (활성) | 150 | 공공데이터 API |
| profiles | 111 | |
| apt_trade_monthly | 44 | RPC 수정 완료, 정상 집계 |
| daily_stats | 7+ | 매일 자동 수집 |

---

## 크론 현황 (47개 등록, vercel.json — 세션 22에서 2개 정리)

### 부동산
| 크론 | 주기 | 상태 |
|------|------|------|
| crawl-apt-subscription | 매일 06시 | ✅ 2,500건 |
| crawl-apt-trade | 평일 08시 | ✅ 올해 전체, 200개 시군구 |
| crawl-apt-resale | 주 1회 | ✅ 35개 시군구 확대 |
| crawl-competition-rate | 매일 12시 | ✅ |
| crawl-unsold-molit | 매월 1일 | ✅ |
| crawl-seoul-redev | 주 1회 | ✅ total_households 매핑 추가(세션22) |
| crawl-busan-redev | 주 1회 | ✅ 매핑 필드 9개 확대+범위검증(세션22) |
| crawl-gyeonggi-redev | 주 1회 | ✅ |
| crawl-nationwide-redev | 매주 월요일 | ⚠️ API 키 필요 |
| aggregate-trade-stats | 매일 | ✅ |

### 주식
| 크론 | 주기 | 상태 |
|------|------|------|
| stock-refresh | 평일 장중 5분마다 | ✅ KIS→Naver→Yahoo 3중 폴백 |
| stock-price | 평일 15분마다 | ✅ 히스토리 스냅샷 |
| stock-theme-daily | 매일 | ✅ |
| stock-daily-briefing | 매일 | ✅ |
| exchange-rate | 매일 | ✅ |

### 콘텐츠
| 크론 | 주기 | 상태 |
|------|------|------|
| seed-posts | 30분마다 | ✅ |
| seed-comments | 4시간마다 | ✅ UUID v4 자연스럽게(세션22) |
| seed-chat | 6시간마다 | ✅ UUID v4 자연스럽게(세션22) |
| daily-stats | 매일 14:55 | ✅ |
| blog-publish-queue | 2회/일(09,14시) | ✅ 3→2회 정리(세션22) |
| blog-* (10+개) | 다양 | ✅ AI 자동 생성 |

### 시스템
| 크론 | 주기 | 상태 |
|------|------|------|
| auto-grade | 매일 02시 | ✅ 등급 자동 갱신 |
| health-check | 30분마다 | ✅ |
| cleanup | 매일 03시 | ✅ |
| ~~invite-reward~~ | ~~삭제~~ | 🗑️ 세션22에서 제거 (초대코드 2건뿐) |

---

## 세션 22 변경 요약 (12건 커밋)

### 1. 20개 항목 전수 검사 + 수정
- #1 햅틱: 탭 전환 + 관심단지에 haptic 추가
- #2 검색: 재개발/미분양/실거래/토론 4테이블 추가 + UI 렌더링
- #4 공유버튼: 터치타겟 44px
- #7 배너과다: 쿠키동의 후 순차 표시
- #10 어드민 조회수: is_admin 제외
- #11 크론정리: invite-reward 제거, blog-publish-queue 3→2
- #12 시드유저: fallback UUID v4 자연스럽게
- #13 지도: 재개발+분양중 모달에 카카오맵/네이버지도, 네이버 URL /p/search/ 최신화
- #14 토론 실시간: optimistic update
- #16 채팅방 반응형: dvh maxHeight
- #17 관심단지 알림: 토스트 + haptic
- #18 실거래 반응형: flexWrap + 줄바꿈
- #19 위치상세: 주소 3단어
- #20 세대수: 부산+서울 매핑 확대

### 2. 주식 페이지 5차 진화
- 시장 요약 카드 (종목수/평균등락/상승/하락)
- 섹터 히트맵 칩 (국내+해외 동적)
- 종목 모달 바텀시트 (시총/거래량/전일대비 + 관심종목)
- StockRow 등락률 미니바
- 환율 전일대비 변동률
- 상한가/하한가 카운트 뱃지
- M7 합산 시총
- 종목 비교 현재가/거래량 추가
- 테마 스파크라인 추이
- 관심종목/캘린더 빈 화면 가이드
- 검색 클리어(X) 버튼
- 시장 전환 시 검색어/섹터 초기화
- 탭 전환 스크롤 맨 위로
- 지수 전일대비 금액 표시
- 상세 개요에 미니차트
- AI 한줄평 없을 때 안내 UI
- 뉴스 감성분석 요약 바
- 수급 누적 순매수 카드
- 공시 건수 표시
- 같은 섹터 종목 시총칩+미니바

### 3. 부동산 페이지 5차 진화
- 전 탭 지역별 현황 그리드 상단 배치 + 필터 관통
- 이번 주 청약 하이라이트 배너
- 청약 D-day: 접수중=마감일, 예정=시작일
- 재개발 카드 진행률 미니바
- 분양중/재개발 모달 지도 버튼
- 실거래 최고가 대비 % 뱃지
- 실거래 모달 거래가/면적/평당가 3열
- 미분양 심각도 아이콘 + 악성 뱃지
- 미분양 히트맵 클릭→필터 연동
- 탭 건수 표시
- 전 탭 투자 면책 조항
- 모바일 반응형 강화

---

## 세션 21 변경 요약 (24건 커밋, 160+ 파일)

### 1. 네이비 브랜드 컬러 시스템 전면 전환
- 오렌지(#FF4500) → 네이비(#0B1426) + 블루(#2563EB) 전체 전환
- 로고/파비콘/PWA아이콘/OG이미지/브랜드이미지 전체 재생성 (29파일)

### 2. 다크모드 단일 테마 확정
- 라이트모드 완전 제거, 텍스트 가독성 개선

### 3. 부동산 데이터 정확성 검증 & 수정
- KST 보정, 재개발 서울 104건 stage 수정, 검색 GIN 인덱스 추가

### 4. 기능 추가
- 글쓰기 임시저장 (localStorage draft)

---

## 미해결 (다음 세션)

### 긴급
- [ ] Vercel ERROR 배포 정리 (동시 빌드 큐)
- [ ] 분양중 카드에 프리미엄 리스팅 골드 하이라이트 연동

### 관리자 수동
- [ ] Google/네이버 서치콘솔 sitemap 제출
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY + KIS_APP_SECRET 환경변수
- [ ] STOCK_DATA_API_KEY 발급

### 코드
- [ ] crawl-nationwide-redev API 키 등록 후 실행
- [ ] 시드 유저 DB UUID도 자연스럽게 마이그레이션 (현재 fallback만 변경)
- [ ] Full-Text Search (현재 ILIKE → pg_trgm GIN 인덱스는 추가됨)
- [ ] 부동산 지도뷰
- [ ] 주식 캔들차트 (CandlestickChart 컴포넌트 있으나 OHLC 데이터 부족)

---

## 주의사항
- 두 컴퓨터 동시 작업 시 충돌 전적 → 작업 전 반드시 git pull
- ThemeToggle은 default export (named import 금지)
- 에러 시 catch에서 200 반환 (재시도 루프 방지)
- 블로그는 다른 컴퓨터에서 크론으로 생성 중 — 함부로 삭제 금지
- profiles.points 직접 UPDATE 절대 금지 → award_points/deduct_points RPC
- 알림은 DB 트리거가 처리 — 수동 INSERT 금지 (팔로우만 예외)
- 페이지뷰: 관리자(is_admin) 조회수 제외됨 (세션22 적용)
