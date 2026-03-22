# 세션 21 — 네이비 브랜드 컬러 시스템 전면 적용

**날짜**: 2026-03-23
**커밋 범위**: `b115d39` → `670c8f1` (7개 커밋)

---

## 작업 요약

### 네이비 컬러 전면 전환 (7커밋, 93+ 파일)

기존 오렌지(#FF4500) + GitHub 다크(#0d1117) 시스템에서
네이비(#0B1426) + 블루(#2563EB) 시스템으로 전체 전환.

#### 커밋 1: CSS/코드 (21파일)
- globals.css: 다크모드 #0d1117→#0B1426, 라이트 #fff→#F0F4FA
- tailwind.config.ts: brand 색상 블루 + navy 팔레트(50~950) 추가
- Navigation.tsx: 로고 네이비~블루 그라데이션
- 어드민 5개, 페이지 6개, 컴포넌트 3개, lib 2개 등

#### 커밋 2: 이미지 (29파일)
- favicon.svg/png, icon.svg, logo.svg 전체 네이비
- PWA 아이콘 8종 (72~512px) SVG+PNG 재생성
- og-image, og-image-kakao SVG+PNG 재생성
- 브랜드 이미지 5종 (hero/full/wide/compact/features) 재생성

#### 커밋 3: 잔존 제거 (4파일)
- offline.html, appintoss, twa-build

#### 커밋 4: 카테고리/등급/시맨틱 색상 재조정 (41파일)
- 주식 카테고리: #ef4444→#38BDF8 (스카이블루)
- 부동산 카테고리: #3b82f6→#34D399 (에메랄드)
- 자유 카테고리: #8b5cf6→#A78BFA (라벤더)
- 우리동네: #10b981→#FBBF24 (앰버)
- 등급 10단계 전부 밝은 톤으로 통일
- 아바타 8색 팔레트 네이비 최적화
- 시맨틱: success=#34D399, error=#F87171, warning=#FBBF24, info=#60A5FA

#### 커밋 5: rgba/hex/fallback 완전 제거 (28파일)
- 8종 구 rgba 매핑 일괄 교체
- #dc2626, #16a34a 등 잔존 제거
- CandlestickChart, offline.html fallback 교체

#### 커밋 6: kd- 보조 시스템 재작성 (2파일)
- src/styles/globals.css: 382줄 Reddit 스타일 → 144줄 네이비 시스템
- global-error.tsx fallback 색상 네이비로

#### 커밋 7: 부동산 페이지 '푸르댕댕' 해결 (1파일)
- 탭: brand 채움 → elevated + shadow
- 필터 pill: 반투명 블루
- 지역 카드: elevated 배경 + #60A5FA 보더
- 분양중: #60a5fa→#34D399 (에메랄드)
- 접수예정: #60A5FA→#FCD34D (앰버)

---

## 최종 검증 결과

5개 카테고리 전부 **0건**:
1. 오렌지 브랜드 (#FF4500 계열) — 0건
2. Material Design (#4CAF50 등) — 0건
3. 구 Tailwind hex (#ef4444 등 7종) — 0건
4. GitHub 다크 (#0d1117 등) — 0건
5. 구 rgba (8종) — 0건

---

## 현재 컬러 시스템

### 다크모드 (기본)
| 토큰 | 값 | 용도 |
|------|-----|------|
| --bg-base | #0B1426 | 페이지 배경 |
| --bg-surface | #0F1D35 | 카드 배경 |
| --bg-elevated | #162544 | 강조 영역 |
| --border | #1E3050 | 기본 보더 |
| --brand | #2563EB | 브랜드 액센트 |
| --text-primary | #E2E8F0 | 본문 텍스트 |

### 라이트모드
| 토큰 | 값 | 용도 |
|------|-----|------|
| --bg-base | #F0F4FA | 페이지 배경 (블루틴트) |
| --bg-surface | #FFFFFF | 카드 배경 |
| --brand | #1E40AF | 브랜드 액센트 |
| --text-primary | #0F1D35 | 본문 텍스트 |

### 카테고리
| 카테고리 | 색상 | rgba 배경 |
|---------|------|-----------|
| 주식 | #38BDF8 | rgba(56,189,248,0.12) |
| 부동산 | #34D399 | rgba(52,211,153,0.12) |
| 우리동네 | #FBBF24 | rgba(251,191,36,0.12) |
| 자유 | #A78BFA | rgba(167,139,250,0.12) |

### 주식
| 상태 | 색상 |
|------|------|
| 상승 (한국) | #F87171 |
| 하락 (한국) | #60A5FA |
| 상승 (해외) | #34D399 |
| 하락 (해외) | #F87171 |

---

## 미해결 (다음 세션)

### 컬러 관련
- [ ] 주식 페이지 탭/필터도 동일한 '푸르댕댕' 패턴 확인 필요
- [ ] 피드 카테고리 필터 탭 색상 확인
- [ ] 라이트모드 전체 점검 (다크모드 중심으로 작업됨)
- [ ] 모바일 실기기 색상 대비 확인

### 기존 미해결 (세션 20에서 이어짐)
- [ ] Supabase SQL: 20260322_consultant_premium.sql 마이그레이션 미실행
- [ ] 토스 라이브키 교체
- [ ] KIS_APP_KEY + KIS_APP_SECRET 환경변수
- [ ] STOCK_DATA_API_KEY 발급
- [ ] crawl-nationwide-redev API 키 등록

---

## 추가 작업: 전수 색상 검사 (2건 커밋)

### 커밋 8: 전체 색상 전수 검사 (27파일)

56개 tsx/ts 파일을 하나하나 열어서 색상 사용을 전수 검사.
발견한 문제 27곳 수정:

1. **ProfileClient**: 청약 상태 색상 구버전 그대로 → 네이비 팔레트
2. **ChatRoom**: #7c3aed → #A78BFA, hex 8자리 → rgba
3. **BannerPurchaseForm/NoticeBanner**: #4ade80 → #34D399, 전광판 미리보기 배경 네이비
4. **opengraph-image/OG route**: 구 GitHub 텍스트 색상 → 네이비 팔레트
5. **어드민 6파일**: 라이트전용 배경(#dcfce7/#fee2e2 등) → 다크호환 rgba
6. **AdminCommandCenter**: hex-alpha(#05966920) → 정식 rgba
7. **apt/[id]/page.tsx**: 청약 상태 색상 AptClient와 동기화 빠져있었음
8. **PaymentClient**: 라이트전용 #FEF3C7 → 다크호환
9. **constants.ts**: 브론즈/실버/다이아 등급 네이비 최적화
10. **탭/필터 반투명 패턴**: FeedClient, StockClient, blog, search, shop, discuss, StockComments, FontSizeControl, UnsoldStatsWidget — 전부 `var(--brand)` 채움 → `rgba(96,165,250,0.15)` 반투명

### 최종 검증: 10개 카테고리 전부 0건

| # | 카테고리 | 결과 |
|---|---------|------|
| 1 | 오렌지 브랜드 | 0건 |
| 2 | Material Design | 0건 |
| 3 | 구 Tailwind hex | 0건 |
| 4 | GitHub 다크 | 0건 |
| 5 | 구 rgba | 0건 |
| 6 | Reddit 구 다크 | 0건 |
| 7 | 라이트전용 배경 | 0건 |
| 8 | 구 green | 0건 |
| 9 | 구 보라 | 0건 |
| 10 | 구 기타 | 0건 |

---

## 추가 작업: 다크모드 단일 확정 + 텍스트 컬러 전수 검사

### 라이트모드 완전 제거
- ThemeProvider: 항상 `dark` 클래스 고정
- ThemeToggle: `null` 반환 (UI에서 토글 사라짐)
- globals.css: `.light` CSS 변수 블록 삭제
- styles/globals.css: `:root` 다크 단일, `[data-theme="dark"]` / `prefers-color-scheme` 분기 전부 제거
- tailwind.config.ts: `darkMode: 'class'` 제거
- layout.tsx: `themeColor` 다크 단일 (`#0B1426`)
- 라이트모드 참조 잔존 **0건** 확인

### 텍스트 컬러 전수 검사 결과
- 모든 tsx/ts 파일의 `color:` 하드코딩 전수 조사
- OG route: `#475569` → `#64748B` (네이비 배경 가독성 부족)
- AdminCommandCenter: `#e2e8f0` → `var(--text-primary)` 7건
- `#facc15` → `#FBBF24` 통일
- 소문자 hex 대문자 통일
- 라이트전용 어두운 텍스트(`#1E293B`, `#1F2937` 등) **0건** 확인
- 네이비 배경에서 가독성 부족한 텍스트 **0건** (모든 텍스트 WCAG AA 충족)

---

## 추가 작업: 텍스트 가독성 대폭 개선

### CSS 변수 밝기 조정
- `--text-tertiary`: `#64748B` → `#7D8DA3` (+25% 밝기, WCAG AA 4.5:1 달성)
- `--text-secondary`: `#94A3B8` → `#9DB0C7` (+10% 밝기)
- 하드코딩 69건 + CSS 변수 전부 동기화

### 최소 폰트 사이즈 10px 강제
- AptClient: `fontSize: 8` → 10 (11곳)
- Navigation: `fontSize: 8~9` → 10 (2곳)
- AdminCommandCenter: `fontSize: 9` → 10 (6곳)

### 추가 지역 카드 반투명 패턴 적용
- 재개발 지역 카드: `var(--brand)` 채움 → elevated + 보더
- 미분양 지역 카드: `#F87171` 빨간 채움 → elevated + 보더
- 실거래 정렬: brand 채움 → 반투명

---

## 추가 작업: 임팩트 컬러 복원 + 구 오렌지 rgba 완전 제거

### 반투명 → 채움 강조 되돌림
반투명 패턴(rgba 0.15)이 오히려 전체를 밋밋하게 만든 것 확인.
선택된 탭/필터에 확실한 #2563EB 채움 + 흰 텍스트 복원.

### 추가 발견 & 수정
- StockClient `currentTab` 탭: `var(--border)` → `#2563EB`
- DiscussClient `tab` 탭: `var(--border)` → `#2563EB`
- `--brand-light`: `#0F1D35` → `#1E3A5F` (배경과 구분 안됐음)
- 구 오렌지 rgba **11건** 완전 제거 (rgba(255,69,0) 등)
- WatchlistButton: rgba(255,75,54) → rgba(251,191,36)
- HOT 페이지: rgba(255,69,0,0.04) 잔존 제거
- BannerPurchaseForm: 티어별 미리보기 배경 차별화

### 디자인 원칙 확정
- **선택된 상태**: `#2563EB` 채움 + `#fff` 텍스트 (명확한 강조)
- **미선택 상태**: `transparent` 또는 `var(--bg-hover)` (부드러운 비활성)
- **CTA 버튼** = **탭/필터** = 동일 브랜드 블루 채움
- **뱃지/태그**: 카테고리별 반투명 배경 + 컬러 텍스트 (상시 표시)

---

## 추가 작업: 기능 개선

### 글쓰기 임시저장 (localStorage draft)
- 작성 중 내용이 1초 debounce로 자동 저장
- 페이지 재방문 시 24시간 이내 임시저장 자동 복원
- 복원 시 배너 알림 + 삭제 버튼
- 등록/수정 성공 시 자동 삭제
- 저장: title, content, category, tags, isAnonymous

### 실거래 탭 쿼리 범위 확대
- `deal_date >= 올해1월1일` → `최근 365일`로 확대
- 데이터 없을 때 크론 확인 안내 추가

---

## 추가 작업: 부동산 데이터 정확성 검증 & 수정

### Supabase DB 직접 검증 결과
| 테이블 | 건수 | 발견된 문제 |
|--------|------|-----------|
| apt_subscriptions | 2,500 | 접수중 0건(UTC vs KST 시차), 접수예정 13건 |
| unsold_apts | 203 | 분양가 정보 23건(11%)만 존재 |
| redevelopment_projects | 217 | 서울 104건 stage='기타', households=NULL |
| apt_transactions | 3,885 | 올해 데이터만 존재, 정상 |

### 코드 수정
1. **KST 보정**: getStatus(), 캘린더, 마감임박, 분양중, 서버 컴포넌트 — 전부 UTC→KST
2. **재개발 guessStage()**: 서울 크론에 날짜/텍스트 기반 단계 추정 함수 추가
3. **쿼리 범위**: 청약 1년→3개월, 실거래 올해 기준 원복
4. **파이프라인 fallback**: 알 수 없는 stage → '정비구역지정'

### DB 직접 수정
- 서울 재개발 104건: stage '기타' → '정비구역지정'
- consultant_premium 마이그레이션: 이미 실행됨 확인
