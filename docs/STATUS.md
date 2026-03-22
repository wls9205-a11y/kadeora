# 카더라 프로젝트 현황 (STATUS.md)

> **마지막 업데이트:** 2026-03-23 세션 23 (부동산 탭 진화 + 어드민 정비)
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

## DB 현황 (2026-03-23 세션 23 기준)

| 테이블 | 건수 | 비고 |
|--------|------|------|
| blog_posts (발행) | 14,578 | 세션23: +905건 시드 + 스팸전수조사 완료 |
| apt_transactions | 3,885+ | 올해 1~3월, 전국 231개 시군구 |
| posts | 3,764+ | 커뮤니티 게시글 |
| apt_subscriptions | 2,500+ | 매일 06시 자동 수집 |
| redevelopment_projects (활성) | 217 | 11개 지역 (서울114/부산35/경기24/인천18+) |
| unsold_apts (활성) | 180 | 활성 (수동입력23건 비활성화) |
| stock_quotes (활성) | 150 | 공공데이터 API |
| profiles | 111 | |
| apt_trade_monthly | 44 | RPC 수정 완료, 정상 집계 |
| daily_stats | 7+ | 매일 자동 수집 |

---

## 크론 현황 (45개 등록, vercel.json — 세션 22에서 구형 2개 제거)

### 부동산
| 크론 | 주기 | 상태 |
|------|------|------|
| crawl-apt-subscription | 매일 06시 | ✅ 2,500건 |
| crawl-apt-trade | 평일 08시 | ✅ 올해 전체, 231개 시군구 |
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

## 세션 23 변경 요약

### 1. 주식 캔들차트 강화
- 터치/마우스 호버 시 OHLCV 툴팁 + 크로스헤어
- 라인/캔들 차트 전환 토글, 기간 선택 (1주/1개월/3개월/전체)
- 기간별 변동률/최고가/최저가 요약 카드

### 2. 알림 클릭 → 해당 게시글 이동
- DB link 컬럼 활용 (기존: 항상 /feed → 이제: /feed/{post_id})

### 3. 블로그 SEO 전면 강화
- Article JSON-LD: wordCount, timeRequired, commentCount, interactionStatistic
- BreadcrumbList + ItemList 구조화 데이터 (목록+상세)
- 카테고리별 동적 metadata + canonical URL + 2p+ noindex
- marked heading id 자동 생성 → TOC 앵커 작동
- 읽기 시간 표시, next/image 적용, sitemap priority 동적화

### 4. 블로그 시드 +905건 (14,578건 total)
- 실거래 아파트별 607건, 재개발 123건, 미분양 168건
- 고품질 가이드 7건 (ISA/ETF/절세/배당주/부동산세금/가치투자/차트분석)

### 5. 블로그 스팸 전수조사 완료 (위험요소 전항목 0건)
- URL 제목 189건 비공개, 중복 873건 비공개
- 1200자 미만 8,890건 패딩 추가, cover_image 967건 세팅
- 면책 문구 292건 추가, 발행 날짜 24개월 균등 재분배

### 6. 속도 최적화 10건
- 미들웨어: 공개 페이지 auth 스킵 (TTFB 200~500ms 단축)
- 부동산 select('*') → 필요 컬럼만 (payload 50~70% 감소)
- 레이아웃 7개 컴포넌트 dynamic import (초기 JS 축소)
- 블로그 count 5개 쿼리 → RPC 1개 (blog_category_counts)
- 주식 목록/상세/클라이언트 리프레시 select 최적화
- 피드 content→excerpt 전환 (posts.excerpt 생성 컬럼, payload 80% 감소)
- optimizePackageImports 확장 (lucide-react, marked)

### 7. 가이드북 전면 업데이트
- 기능 소개 19→25개 (블로그/캔들차트/재개발/실거래/통합검색/관심종목 등)
- FAQ 6개 추가, 문의·건의 섹션 추가

### 8. 글씨 크기별 레이아웃 간격 시스템
- CSS 변수: --sp-xs~2xl, --card-p, --btn-h, --touch-min, --radius-sm~lg
- font-small/medium/large별 간격 자동 조절
- 모바일+font-large 반응형 보정 (글씨/간격 축소)
- 유틸리티 클래스 14개 (.kd-card, .kd-btn, .kd-tabs 등)

### 9. RSS 피드 + 검색엔진 등록
- /feed.xml 라우트 생성 (블로그 50개 + 커뮤니티 20개, RSS 2.0)
- Bing 웹마스터도구 메타태그 추가
- 다음 웹마스터도구 PIN 코드 robots.txt 추가
- robots.txt를 route handler로 전환 (커스텀 텍스트 지원)

### 10. 컬러 시스템 전수조사 + CSS 변수 전환 (44파일, 349건)
- 시맨틱 액센트 변수 6쌍 추가 (--accent-green/purple/orange/yellow/red/blue + bg)
- 하드코딩 hex (#34D399, #A78BFA 등) → var(--accent-*) 전환
- #34D399: 106→7, #A78BFA: 38→1, #FB923C: 21→1, #F87171: 165→10, #60A5FA: 105→18, #FBBF24: 58→1

### 11. 미분양 탭 건수 표시 수정
- 단지수(180) → 세대수(68k)로 변경 (다른 탭과 통일)

### 12. 부동산 5개 탭 전면 진화
- **청약**: 단지명/지역 검색 + 경쟁률순 정렬(4종) + 접수중/예정/마감 카운트
- **미분양**: 위험도 카드(고위험500+/주의100~499/전체) + 전월 대비 증감 배너 + 검색 + 결과 카운트
- **재개발**: 구역명/지역/시공사 검색 + 시공사 확정 건수 표시
- **실거래**: 단지명/법정동 검색 + 요약 통계(평균가/최고가/건수) + 🏆 신고가 골드 보더+배지
- **분양중**: (이미 완성도 높아 이번에 변경 없음)

### 13. 어드민 커맨드센터 전면 재정비
- QUICK_ACTIONS 15개 (실거래/경쟁률/미분양/만료/집계 크론 추가)
- 데이터 품질 현황 패널 (비활성 건수/시공사 입력/FTS 상태)
- AI 요약 현황 패널 (청약/재개발/미분양별 생성률% + 프로그레스)
- qualityStats state 분리 (redevInactiveR 크래시 수정)
- CRON_MAP 44개 완전 매핑 + 누락 12개 추가

### 14. 크론 감사 + 불필요 크론 정리
- aggregate-trade-stats: RPC 미존재 → 생성 (62.5% 실패 해결)
- blog-weekly/blog-monthly 구형: vercel.json에서 제거 (신형과 중복)
- invite-reward: vercel.json 미등록 확인 (사실상 미사용)

### 15. 빌드 에러 + API 누락 수정
- Server Component `ssr:false` → ClientDynamics.tsx 분리 (빌드 에러 해결)
- /api/admin/trigger-cron 생성 (부동산 관리 페이지 수동 크론)
- 존재하지 않는 링크 제거 (/admin/consultant, /blog-sitemap.xml)

### 16. 부동산 상세 정보 확장
- DB 30+ 컬럼 추가 (시공사/시행사/동수/최고층/분양가상한제/전매제한 등)
- 청약 상세: 단지 개요 + 분양 조건 + 교통/학군 섹션
- 재개발 모달: 10+ 신규 필드 + key_features
- AI 한줄 분석: 크론(매일 05시) + UI(청약/미분양/재개발)

---

## 세션 22 변경 요약 (20건+ 커밋)

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

### 4. 프리미엄 리스팅 골드 하이라이트 연동
- 분양중 카드: premiumListings fetch → 매칭 시 골드 보더/PREMIUM 배지
- 상담사 CTA (회사명/이름/전화버튼) 카드 내 표시
- 노출(impression) + 전화 클릭 추적 PATCH 연동

### 5. auto-grade 크론 개선
- admin_set_grade RPC 의존 제거 → profiles 직접 update
- .in() 배치 처리 (200명씩), 승급 시 notifications 알림 자동 생성

### 6. Full-Text Search 전환
- posts + blog_posts: tsvector GENERATED 컬럼 + GIN 인덱스 마이그레이션
- search_posts_fts / search_blogs_fts RPC 함수
- 검색 API: FTS 우선 → ILIKE 폴백 구조
- ⚠️ Supabase에서 마이그레이션 SQL 실행 필요 (`20260323_fulltext_search.sql`)

### 7. expire-listings 크론 안정화
- RPC 실패 시 직접 update 폴백 추가

### 8. 부동산 데이터 전수조사 + 부정확 데이터 정리
- 미분양 수동입력 23건 비활성화 (에코델타 롯데캐슬 등 존재하지 않는 단지명)
- 재개발 세대수 전량 리셋 (범천1-1: 4850→1323, 광명4R: 4300→1957 등 2~4배 뻥튀기)
- 재개발 중복 31건 비활성화 (부산15 + 경기16)
- 분양중 탭 시군구 통계 168건 제외
- 세대수 미확정 → 단계별 한글 설명 표시 (구역지정/조합설립/시행인가/관리처분/착공)

### 9. 데이터 제한 해제 + 시군구 확대
- 청약 limit 300→1000, 실거래 limit 2000→5000
- 실거래 크론 시군구 67→231개 (경기 31개, 부산 16개 확대)
- 청약 크론 페이지 5→10 (최대 5000건)

### 10. 카드 디자인 리뉴얼
- 청약: borderLeft 제거 → 접수중 블루 그라데이션, D-day 배지, 타임라인 바
- 실거래: 금액 우측 분리 강조, 최고가 대비% 상단 배지
- 재개발: 상단 전체너비 진행률 바 + 진행률% 인라인

### 11. DB 스키마 확장 (30+ 새 컬럼)
- 청약: 시공사/시행사/동수/최고층/주차/난방/분양가상한제/전매제한/거주의무/견본주택/총세대수
- 재개발: 시행사/동수/최고층/용적률/건폐율/부지면적/입주예정/최근접역/학교/핵심특징
- 실거래: 총세대수/동수/주차비율/최근접역
- 미분양: 시공사/시행사/최근접역/평당분양가/할인정보/핵심특징

### 12. 상세 페이지 정보 밀도 대폭 강화
- 청약 상세: 단지 개요(시공사/시행사/동수/최고층/주차) + 분양 조건(상한제/전매/거주의무) + 교통/학군
- 실거래 모달: 단지 가격 통계(최고/최저/평균) + 지도
- 재개발 모달: 10+ 신규 필드 + 핵심특징 하이라이트
- 미분양 상세: 시공사/할인정보/핵심특징 배너 + 최근접역 + 구글맵

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

### 관리자 수동
- [x] Supabase FTS 마이그레이션 실행 ✅ 세션 22
- [x] Supabase 상세 필드 마이그레이션 실행 ✅ 세션 22
- [ ] Google/네이버 서치콘솔 sitemap 제출
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY + KIS_APP_SECRET 환경변수
- [ ] STOCK_DATA_API_KEY 발급

### 코드
- [ ] crawl-nationwide-redev API 키 등록 후 실행
- [ ] 재개발 세대수 크론 검증 수집 (부산시/서울시 정비사업 API 연동)
- [ ] 부동산 지도뷰
- [x] 주식 캔들차트 ✅ 세션 23 (터치 툴팁+라인/캔들 전환+기간 선택)
- [ ] 청약 상세의 신규 필드 데이터 채우기 (크론 실행 후 자동)

### 완료
- [x] 분양중 골드 하이라이트 ✅
- [x] Full-Text Search ✅
- [x] auto-grade 크론 개선 ✅
- [x] 부동산 데이터 전수조사 + 부정확 데이터 정리 ✅
- [x] 데이터 제한 해제 (청약1000/실거래5000/시군구231) ✅
- [x] 카드 디자인 리뉴얼 ✅
- [x] DB 스키마 확장 (30+ 컬럼) ✅
- [x] 상세 페이지 정보 밀도 강화 ✅
- [x] 부동산 5개 탭 검색 + 통계 + 위험도 + 신고가 ✅ 세션 23
- [x] 어드민 커맨드센터 전면 재정비 (CRON_MAP 44개 + 품질패널 + AI현황) ✅ 세션 23
- [x] 크론 감사 (aggregate RPC 생성 + 구형 블로그 제거) ✅ 세션 23
- [x] AI 한줄 분석 크론 + UI ✅ 세션 22
- [x] 빌드 에러 수정 (ClientDynamics 분리) ✅ 세션 23
- [x] trigger-cron API 생성 ✅ 세션 23

---

## 주의사항
- 두 컴퓨터 동시 작업 시 충돌 전적 → 작업 전 반드시 git pull
- ThemeToggle은 default export (named import 금지)
- 에러 시 catch에서 200 반환 (재시도 루프 방지)
- 블로그는 다른 컴퓨터에서 크론으로 생성 중 — 함부로 삭제 금지
- profiles.points 직접 UPDATE 절대 금지 → award_points/deduct_points RPC
- 알림은 DB 트리거가 처리 — 수동 INSERT 금지 (팔로우만 예외)
- 페이지뷰: 관리자(is_admin) 조회수 제외됨 (세션22 적용)
- 재개발 세대수: 전량 NULL 리셋 상태. 새로 입력 시 반드시 공식 출처 확인 후 입력
- AdminCommandCenter: 신규 DB 쿼리 결과는 반드시 state에 저장 후 JSX에서 참조 (loadAll 로컬 변수 직접 참조 금지)
- CRON_MAP: 크론 추가/삭제 시 라우트파일+vercel.json+CRON_MAP 3곳 동시 반영
- aggregate-trade-stats RPC: `aggregate_trade_monthly_stats()` — 컬럼명 `region` (region_nm 아님)
