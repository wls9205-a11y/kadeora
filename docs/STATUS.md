# 카더라 프로젝트 현황 (STATUS.md)

> **마지막 업데이트:** 2026-03-23 세션 21 완전 종료
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

## 크론 현황 (42개 등록, vercel.json)

### 부동산
| 크론 | 주기 | 상태 |
|------|------|------|
| crawl-apt-subscription | 매일 06시 | ✅ 2,500건 |
| crawl-apt-trade | 평일 08시 | ✅ 올해 전체, 200개 시군구 |
| crawl-apt-resale | 주 1회 | ✅ 35개 시군구 확대 |
| crawl-competition-rate | 매일 12시 | ✅ |
| crawl-unsold-molit | 매월 1일 | ✅ |
| crawl-seoul-redev | 주 1회 | ✅ |
| crawl-busan-redev | 주 1회 | ✅ |
| crawl-gyeonggi-redev | 주 1회 | ✅ |
| crawl-nationwide-redev | 매주 월요일 | ⚠️ API 키 필요 |
| aggregate-trade-stats | 매일 | ✅ |

### 주식
| 크론 | 주기 | 상태 |
|------|------|------|
| stock-refresh | 평일 장중 5분마다 | ✅ KIS→Naver→Yahoo 3중 폴백 |
| stock-price | 평일 매일 | ✅ 히스토리 스냅샷 |
| stock-theme-daily | 매일 | ✅ |
| stock-daily-briefing | 매일 | ✅ |
| exchange-rate | 매일 | ✅ |

### 콘텐츠
| 크론 | 주기 | 상태 |
|------|------|------|
| seed-posts | 30분마다 | ✅ |
| seed-comments | 4시간마다 | ✅ |
| seed-chat | 6시간마다 | ✅ |
| daily-stats | 매일 14:55 | ✅ |
| blog-* (10+개) | 다양 | ✅ AI 자동 생성 |

### 시스템
| 크론 | 주기 | 상태 |
|------|------|------|
| auto-grade | 매일 02시 | ✅ 신규 — 등급 자동 갱신 |
| health-check | 30분마다 | ✅ |
| cleanup | 매일 03시 | ✅ |

---

## 세션 19 변경 요약

### 어드민 커맨드센터 전면 개편
- 4탭 분리 → 단일 페이지 대시보드 통합
- 원클릭 실행 8개, 크론 그룹별 상태, 접이식 패널 4개
- 블로그 자동화(설정+큐+리라이팅), 유저, 알림/신고, 공지/SEO/도구

### 등급 자동 갱신 크론 신규
- 포인트 + 게시글 + 댓글 기반 10단계 자동 승급 (강등 없음)

### stock_quotes price=0 자동 비활성화
- 7일 이상 price=0 → is_active=false

### 모바일 반응형 CSS 강화
- 노치 safe-area, 터치 44px, iOS 확대 방지, 스크롤바, 스켈레톤

---

## 세션 21 변경 요약 (24건 커밋, 160+ 파일)

### 1. 네이비 브랜드 컬러 시스템 전면 전환
- 오렌지(#FF4500) → 네이비(#0B1426) + 블루(#2563EB) 전체 전환
- 로고/파비콘/PWA아이콘/OG이미지/브랜드이미지 전체 재생성 (29파일)
- CSS 변수, Tailwind, 하드코딩 hex, rgba, 이미지 전부 교체
- 10개 카테고리 전수검사 전부 0건 달성

### 2. 다크모드 단일 테마 확정
- 라이트모드 완전 제거 (ThemeProvider, .light CSS, tailwind darkMode)
- 텍스트 가독성: --text-tertiary #64748B→#7D8DA3, --text-secondary #94A3B8→#9DB0C7
- 최소 폰트 사이즈 10px 강제

### 3. 임팩트 컬러 디자인 확정
- 선택 상태: #2563EB 채움 + #fff 텍스트 (전체 통일)
- 구 오렌지 rgba 11건 완전 제거
- --brand-light: #0F1D35→#1E3A5F (배경과 구분)

### 4. 부동산 데이터 정확성 검증 & 수정
- KST 보정: 청약 상태/캘린더/마감임박/분양중 — UTC→KST 전환
- 재개발 서울 104건: stage '기타'→'정비구역지정' (DB 직접 수정)
- 재개발 크론: guessStage() 함수 추가
- 청약 쿼리: 1년→3개월, 실거래: 올해 기준
- 검색 GIN 인덱스 5개 추가, 필터 인덱스 2개 추가

### 5. 기능 추가
- 글쓰기 임시저장 (localStorage draft, 자동 저장/복원)
- 실거래 쿼리 범위 + 빈 데이터 메시지 개선

---

## 세션 20 변경 요약 (10건 커밋)

### 부동산 분양중 탭 신규 + 대폭 강화
- 청약 바로 뒤 5번째 탭: 📅 청약 → 🏢 분양중 → 🏚️ 미분양 → 🏗️ 재개발 → 💰 실거래
- 데이터 소스: apt_subscriptions(청약마감+입주전) + unsold_apts(미분양) 통합, 중복 제거
- 종합 현황 5열 (전체/분양중/미분양/수도권/지방)
- ① 입주 임박 배너: 3개월 이내 입주 예정 D-day 하이라이트
- ② 지역별 그리드 현황판: 클릭 가능 카드 (분양/미분양 비율 게이지)
- ③ 단계별 파이프라인: 청약마감→당첨→계약→공사→입주 5단계
- ④ 분양가 TOP10 바 차트
- ⑤ 지역별 히트맵 바 (분양중/미분양 스택)
- ⑥ 카드 borderLeft 색상 + 미분양률 바
- ⑦ 카드 클릭 모달 (바텀시트 상세 + 시세비교 + 관심단지/한줄평)
- 검색바, 상태필터, 정렬 4종, 경쟁률, 인근시세비교, 프로그레스바
- ⭐ 관심단지, 💬 한줄평, 공고 링크, 전화문의, 페이지네이션

### 한줄평 맞춤 프롬프트
- 분양중: 모델하우스/시공사/교통/분양가 질문 프롬프트
- 미분양: 이유/할인/실거주vs투자 질문 프롬프트
- 재개발: 사업 진행/주민 의견 질문 프롬프트
- 유형별 동적 placeholder

### 분양 상담사 프리미엄 리스팅 시스템 (신규)
- DB: consultant_profiles + premium_listings 테이블
- 3티어: BASIC(4.9만)/PRO(14.9만)/PREMIUM(29.9만) 월 구독
- API: 상담사 등록/조회 + 리스팅 CRUD + 노출/클릭 추적
- UI: /consultant 3단계 페이지 (등록→요금제→대시보드)
- 분양중 탭 하단 "분양 상담사이신가요?" CTA 배너
- expire-listings 크론 (매일 03시, 만료 자동 비활성화)
- ⚠️ DB 마이그레이션 미실행: supabase/migrations/20260322_consultant_premium.sql

---

## 미해결 (다음 세션)

### 긴급
- [ ] Vercel ERROR 배포 정리 (동시 빌드 큐 문제 — 대시보드에서 Cancel)
- [x] consultant_premium 마이그레이션 — 이미 실행됨 확인 ✅
- [ ] 분양중 카드에 프리미엄 리스팅 골드 하이라이트 + 상담사 CTA 연동

### 관리자 수동
- [ ] Google/네이버 서치콘솔 sitemap 제출
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY + KIS_APP_SECRET 환경변수
- [ ] STOCK_DATA_API_KEY 발급

### 코드
- [ ] crawl-nationwide-redev API 키 등록 후 실행 확인
- [ ] auto-grade 크론 첫 실행 결과 확인
- [x] 모바일 반응형 코드 레벨 점검 ✅ 세션 21
- [ ] 모바일 실기기 테스트 (수동)

### 선택적 개선
- [ ] 주식 캔들차트
- [ ] 부동산 지도뷰
- [x] 게시글 임시저장 (localStorage draft) ✅ 세션 21
- [ ] Full-Text Search (현재 ILIKE)

---

## 주의사항
- 두 컴퓨터 동시 작업 시 충돌 전적 → 작업 전 반드시 git pull
- ThemeToggle은 default export (named import 금지)
- 에러 시 catch에서 200 반환 (재시도 루프 방지)
- 블로그는 다른 컴퓨터에서 크론으로 생성 중 — 함부로 삭제 금지
- profiles.points 직접 UPDATE 절대 금지 → award_points/deduct_points RPC
- 알림은 DB 트리거가 처리 — 수동 INSERT 금지 (팔로우만 예외)
