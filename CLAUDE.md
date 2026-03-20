# 카더라 4대 개선 — Claude Code 통합 작업 지시서

> 4가지를 효율적으로 한번에 진행. 각 항목 완료 시 커밋+빌드+푸시.

---

## TASK 1: 부동산 페이지 개선

### 소스 읽기
```bash
find src/app/(main)/apt -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
```

### 1-1. 청약 카드 간소화
```
현재 카드에 너무 많은 정보: 단지명, 주소 전체, 세대수, 날짜, 현장토론방, 청약홈, 상세보기

변경 → 카드에는 핵심만:
┌──────────────────────────────────┐
│ 🟢접수중  D-2         서울      │  ← 상태 + D-day + 지역 (1행)
│ 래미안 엘라비네                  │  ← 단지명 (font-semibold)
│ 강서구 방화동 · 272세대          │  ← 간략 주소 + 세대수 (1행)
│ 3/16 ~ 3/19                     │  ← 접수 기간
└──────────────────────────────────┘

제거: 주소 전체 → 구+동만, "현장토론방" 버튼, "상세보기 ▼" 텍스트
카드 클릭 시 → /apt/[id] 상세 페이지에서 전체 정보
```

### 1-2. 미분양 탭 추가
```
unsold_apts 35건 데이터가 있는데 페이지에 안 보임.

상태 필터에 "미분양" 탭 추가:
전체 | 접수중 | 예정 | 마감 | 미분양

미분양 카드:
┌──────────────────────────────────┐
│ 미분양  경기 평택시              │  ← 뱃지 + 지역
│ 평택 브레인시티 수자인            │  ← 단지명
│ 미분양 124세대 / 전체 842세대    │  ← 미분양 비율
│ 분양가 3.6억 ~ 5.2억             │  ← sale_price_min/max (만원 → 억 변환)
│ 준공 2025.06                     │  ← completion_ym
└──────────────────────────────────┘

DB 쿼리: SELECT * FROM unsold_apts WHERE is_active = true ORDER BY region_nm
분양가 변환: sale_price_min 36000 (만원) → "3.6억"
미분양 뱃지: bg-amber-500 text-white
```

### 1-3. 청약 상세 페이지 (/apt/[id]) 보강
```
현재 접기/펼치기 구조 → 전용 상세 페이지로

상세에 포함할 정보:
- 단지명, 전체 주소
- 세대수 (특별공급/일반공급 구분: special_supply_total, general_supply_total)
- 접수/당첨/계약 기간
- 경쟁률 (competition_rate_1st, competition_rate_2nd) — 있으면 표시
- 타입별 정보 (house_type_info JSONB) — 있으면 표시
- 입주 예정 (mvn_prearnge_ym)
- 청약홈 링크 (pblanc_url)
- 관련 피드 글 (posts에서 단지명 검색)
```

커밋: `feat: 부동산 카드 간소화 + 미분양 탭 + 상세 보강`

---

## TASK 2: 주식 종목 확대 + 모바일 접근성

### 소스 읽기
```bash
cat src/components/Navigation.tsx
cat src/app/(main)/stock/StockClient.tsx
cat src/app/api/stock-refresh/route.ts
```

### 2-1. 바텀네비에 주식 탭 추가
```
현재: 피드 / 부동산 / + / HOT / 토론 (5개, 주식 없음!)
변경: 피드 / 주식 / + / 부동산 / 토론 (HOT는 피드 내 탭으로 이동)

Navigation.tsx에서:
- 바텀네비 items 배열 수정
- /stock 추가, /hot 제거 (또는 /hot을 피드 사이드바로 이동)
- 아이콘: TrendingUp (주식)
```

### 2-2. 인기 종목 추가 (DB)
```
현재 150종목. 아래 종목을 stock_quotes에 INSERT:

KOSDAQ 추가 (20개):
카카오게임즈, 셀트리온헬스케어, 에코프로비엠, 에코프로, HLB, 
레인보우로보틱스, 리가켐바이오, 알테오젠, 클래시스, 
파두, 두산로보틱스, 엔켐, 에스티팜, 씨앤씨, 
하이브, 카카오뱅크, 원익IPS, 솔브레인, JYP, SM
→ 이미 있는 종목은 제외

해외 ETF + 인기종목 추가 (15개):
SPY (S&P500 ETF), QQQ (나스닥100 ETF), ARKK, VOO, VTI,
SOFI, PLTR (이미 있으면 제외), ARM, SMCI, MSTR,
COIN (이미 있으면 제외), SNOW, CRWD, DDOG, NET

→ 총 약 180~200종목 목표
→ stock_quotes 테이블에 INSERT (name_ko, symbol, market, sector 등)
→ 크론이 자동으로 시세 갱신
```

### 2-3. 주식 페이지 개선
```
- 상단에 "오늘의 화제 종목" 3개 (등락률 절대값 상위)
- 검색바 강화 (종목명 + 티커 실시간 필터)
- 장 마감 시 모든 종목에 "전일종가" 라벨 확실히 표시
```

커밋: `feat: 바텀네비 주식 추가 + 종목 확대 + 검색 강화`

---

## TASK 3: 회원가입 유도 강화

### 소스 읽기
```bash
cat src/hooks/useAuthGuard.ts
cat src/app/(main)/login/page.tsx
find src -name "*.tsx" | xargs grep -l "useAuthGuard\|로그인\|회원가입" | head -10
```

### 3-1. 콘텐츠 게이팅 — 글 전문 보기 제한
```
비로그인 유저: 피드에서 글 클릭 → 글 상세 페이지
- 본문 첫 3줄만 보여주고 블러 처리
- 블러 위에: "전체 글을 보려면 로그인하세요" + 카카오 로그인 버튼
- 댓글은 완전히 숨김

로그인 유저: 전문 + 댓글 전부 공개

구현:
- feed/[id]/page.tsx에서 유저 세션 확인
- 비로그인: content를 slice(0, 200) + "..." + 블러 오버레이
- 로그인 버튼: /login으로 이동
```

### 3-2. 피드 중간 가입 유도 배너
```
피드 스크롤 시 5번째 카드 뒤에 가입 유도 카드 삽입 (비로그인만):

┌──────────────────────────────────┐
│ 🔔 카더라 회원이 되면             │
│                                  │
│ ✓ 관심 종목 알림                 │
│ ✓ 청약 마감 알림                 │
│ ✓ 글 전문 보기 + 댓글 참여       │
│ ✓ 매일 출석 포인트 적립          │
│                                  │
│ [카카오로 3초 가입]              │  ← CTA 버튼 (bg-yellow-400)
└──────────────────────────────────┘

FeedClient.tsx에서 posts 배열 5번째 뒤에 조건부 렌더링
```

### 3-3. 글 상세 하단 가입 유도
```
비로그인 상태에서 글 상세 페이지 하단 (댓글 영역):

┌──────────────────────────────────┐
│ 💬 이 글에 3개의 댓글이 있습니다 │
│                                  │
│ 댓글을 보려면 로그인하세요       │
│ [카카오로 로그인]                │
└──────────────────────────────────┘
```

### 3-4. 로그인 페이지 개선
```
현재 로그인 페이지 확인 후:
- "카카오로 3초 가입" 강조 (카카오 노란 버튼 크게)
- 가입 혜택 목록: 포인트 적립, 알림, 글 전문 보기
- "30초면 끝나요" 같은 안심 문구
```

커밋: `feat: 콘텐츠 게이팅 + 피드 가입 유도 + 로그인 페이지 개선`

---

## TASK 4: 상점 포인트 교환 시스템

### 소스 읽기
```bash
find src/app/(main)/shop -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
find src/app/api/shop -name "*.ts" -exec echo "=== {} ===" \; -exec cat {} \;
cat src/lib/constants.ts | grep -A 20 "shop\|SHOP\|product\|PRODUCT"
```

### 4-1. 포인트 교환 상품 활성화 (DB)
```sql
-- 닉네임 변경권: 포인트로 교환 가능하도록
UPDATE shop_products SET is_active = true WHERE id = 'nickname_change';

-- 프리미엄 배지: 포인트로 교환
UPDATE shop_products SET is_active = true WHERE id = 'premium_badge';

-- 가격 체계 추가: point_price 컬럼 (없으면 추가)
-- 닉네임 변경권: 500P
-- 프리미엄 배지: 1000P  
-- 게시글 부스트: 2000P
-- 전광판 2회: 3000P
```

### 4-2. 상점 메인 페이지 (/shop) 리디자인
```
현재: /shop/megaphone만 있음
변경: /shop 메인에서 전체 상품 보기

┌──────────────────────────────────┐
│ 🛒 상점                          │
│ 내 포인트: 150P                  │  ← 현재 포인트 표시
├──────────────────────────────────┤
│ 💰 포인트로 교환                 │  ← 섹션
│ ┌────────────┐ ┌────────────┐  │
│ │ ✏️ 닉변권   │ │ ✨ 배지     │  │  ← 2열 그리드
│ │ 500P       │ │ 1,000P     │  │
│ │ [교환하기] │ │ [교환하기] │  │
│ └────────────┘ └────────────┘  │
├──────────────────────────────────┤
│ 💳 프리미엄 (결제 준비 중)       │  ← 토스 결제 연동 전
│ ┌────────────┐ ┌────────────┐  │
│ │ 🚀 부스트   │ │ 📢 전광판   │  │
│ │ ₩3,900     │ │ ₩4,900     │  │
│ │ [준비 중]  │ │ [준비 중]  │  │
│ └────────────┘ └────────────┘  │
└──────────────────────────────────┘

포인트 교환 API:
POST /api/shop/exchange
body: { product_id: 'nickname_change' }
→ 포인트 확인 → deduct_points RPC → 상품 적용
```

### 4-3. 포인트 교환 API 구현
```
/api/shop/exchange/route.ts:

1. getUser()로 인증 확인
2. product_id로 상품 조회 (is_active = true 확인)
3. 유저 포인트 확인 (profiles.points >= point_price)
4. deduct_points RPC로 포인트 차감
5. 상품 적용:
   - nickname_change: use_nickname_change RPC 호출 (이미 있음)
   - premium_badge: use_premium_badge RPC 호출 (이미 있음)
   - post_boost: use_post_boost RPC 호출 (이미 있음)
6. purchases 테이블에 기록
```

### 4-4. 내 포인트 + 교환 내역 표시
```
프로필 페이지 또는 상점 페이지에:
- "내 포인트: 150P"
- "이 상품까지 350P 더 모아야 해요" 진행 바
- 최근 교환 내역 (purchases 테이블)
```

커밋: `feat: 상점 포인트 교환 시스템 + 상점 리디자인`

---

## DB 마이그레이션 (필요시)

```sql
-- shop_products에 point_price 컬럼 추가
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS point_price integer DEFAULT 0;
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS purchase_type text DEFAULT 'cash'; 
-- purchase_type: 'cash' | 'points' | 'both'

-- 포인트 가격 설정
UPDATE shop_products SET point_price = 500, purchase_type = 'points', is_active = true WHERE id = 'nickname_change';
UPDATE shop_products SET point_price = 1000, purchase_type = 'points', is_active = true WHERE id = 'premium_badge';
UPDATE shop_products SET point_price = 2000, purchase_type = 'points', is_active = true WHERE id = 'post_boost';
UPDATE shop_products SET point_price = 3000, purchase_type = 'points', is_active = true WHERE id = 'megaphone';
```

---

## 작업 순서

```
TASK 2 (바텀네비 주식) → TASK 1 (부동산) → TASK 3 (가입 유도) → TASK 4 (상점)
```
바텀네비가 가장 긴급하고 간단해서 먼저.

---

## Claude Code 시작 프롬프트

```
CLAUDE.md를 읽고, 아래 4가지 작업을 순서대로 진행해:

1. 바텀네비에 주식 탭 추가 (Navigation.tsx) — HOT 제거하고 주식 추가
2. 부동산 카드 간소화 + 미분양 탭 추가
3. 비로그인 글 전문 블러 + 피드 5번째 카드 뒤 가입 유도 배너 + 댓글 로그인 유도
4. 상점 포인트 교환 시스템 (DB 마이그레이션 + API + UI)

각 파일을 반드시 cat으로 읽고 수정. 
각 TASK 완료 시 npm run build → 커밋 → push.
논스톱으로 끝까지.
```
