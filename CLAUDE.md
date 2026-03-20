# 카더라 5대 개선 — Claude Code 통합 작업 지시서

> 대충하지 말고 처음부터 끝까지 소스코드 다 읽고 개편

---

## 소스 읽기 (필수 — 전부 읽고 시작)
```bash
# 피드 + 글상세 (버튼 배치)
cat src/app/(main)/feed/FeedClient.tsx
cat src/app/(main)/feed/[id]/page.tsx
cat src/components/ShareButtons.tsx

# 프로필
find src/app/(main)/profile -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;

# 주식
cat src/app/(main)/stock/StockClient.tsx
cat src/app/api/stock-refresh/route.ts

# 상점
find src/app/(main)/shop -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
find src/app/api/shop -name "*.ts" -exec echo "=== {} ===" \; -exec cat {} \;

# 푸시
find src/app/api/push -name "*.ts" -exec echo "=== {} ===" \; -exec cat {} \;
```

---

## TASK 1: 상점 상품 개편안

### 현재 상품 (10개, 4개 활성)
활성: 닉변권 500P, 배지 1000P, 부스트 2000P, 전광판 3000P
비활성: 핀고정, 토론방개설, 5회전광판, 프리미엄멤버십, 지역왕, 긴급전광판

### 추가할 새 상품 (DB INSERT)
```sql
-- 1. 프로필 꾸미기 (저가, 진입장벽 낮음)
INSERT INTO shop_products (id, name, description, price_krw, point_price, icon, is_active, is_popular, purchase_type)
VALUES 
('custom_avatar_frame', '아바타 프레임', '프로필 아바타에 특별한 테두리 효과 (30일)', 0, 300, '🖼️', true, false, 'points'),
('profile_bg', '프로필 배경', '프로필 페이지에 특별 배경 색상 적용 (30일)', 0, 500, '🎨', true, false, 'points'),
('emoji_pack', '특별 이모지 팩', '댓글에 사용할 수 있는 특별 이모지 5종', 0, 200, '😎', true, true, 'points');

-- 2. 콘텐츠 강화 (중가)
INSERT INTO shop_products (id, name, description, price_krw, point_price, icon, is_active, is_popular, purchase_type)
VALUES
('double_points_24h', '포인트 2배 부스터', '24시간 동안 모든 활동 포인트 2배 적립', 0, 1500, '⚡', true, true, 'points'),
('anonymous_post', '익명 게시권 3회', '닉네임 대신 "익명"으로 글 작성 3회', 0, 800, '🕶️', true, false, 'points');

-- 3. 기존 비활성 상품 포인트 가격 설정 + 활성화
UPDATE shop_products SET point_price = 4000, purchase_type = 'points', is_active = true WHERE id = 'pin_post';
UPDATE shop_products SET point_price = 5000, purchase_type = 'points', is_active = true WHERE id = 'create_room';
```

### 상점 페이지 UI 개선
```
카테고리별 섹션:
- 🎨 꾸미기 (아바타 프레임 300P, 프로필 배경 500P, 이모지 팩 200P)
- ✏️ 활동 (닉변권 500P, 익명게시 800P, 배지 1000P)
- 📢 홍보 (부스트 2000P, 전광판 3000P, 핀고정 4000P)
- 🏠 커뮤니티 (토론방 개설 5000P)

각 상품 카드:
┌────────────────────┐
│ 🖼️                 │
│ 아바타 프레임       │
│ 프로필 테두리 효과  │
│ 300P               │
│ [교환하기]          │
└────────────────────┘
```

커밋: `feat: 상점 신규 상품 5종 + 카테고리 UI`

---

## TASK 2: 푸시 알림 계획안

### 소스 확인 후 구현할 푸시 알림 시나리오

```
1. 새 댓글 알림 (이미 notifications 트리거 있음 → 푸시 연동)
   - 내 글에 댓글이 달리면 → "닉네임님이 댓글을 남겼어요"
   - 대상: 글 작성자
   
2. 좋아요 알림 (이미 트리거 있음)
   - 내 글에 좋아요 5개 도달 → "🔥 회원님의 글이 인기를 얻고 있어요!"
   - 대상: 글 작성자
   
3. 청약 마감 임박 알림 (신규)
   - D-1, D-0인 청약이 있으면 → "⏰ 래미안 엘라비네 접수 마감 D-1!"
   - 대상: 전체 유저 (또는 관심 지역 설정 유저)
   - 크론: 매일 09:00에 D-1, D-0 청약 확인 → 푸시
   
4. HOT 게시글 알림 (신규)
   - 이번 주 HOT 1위 바뀌면 → "🔥 이번 주 HOT 1위: 전세사기 걱정..."
   - 대상: 전체 유저
   - 크론: 매일 12:00에 HOT 변동 확인
   
5. 주식 급등/급락 알림 (신규)  
   - 등락률 ±5% 이상 종목 → "📈 삼성전자 +5.2% 급등!"
   - 대상: 전체 유저
   - 주식 크론(stock-refresh)에서 변동률 체크 후 발송
   
6. 출석 리마인더 (신규)
   - 오늘 출석 안 한 유저 → "📅 오늘 출석체크 잊지 마세요! +10P"
   - 크론: 매일 20:00에 미출석 유저에게 푸시

7. 시드 뉴스 알림 (신규)
   - 오전 경제 뉴스 시드 게시글 → "📰 [오늘의 경제 뉴스 3줄 요약]"
   - 크론: 매일 08:00 시드 생성 직후
```

### 구현 (Claude Code에서)
```
/api/push/send/route.ts 확인 후:
- 기존 푸시 발송 함수가 있으면 활용
- notifications 테이블에 INSERT 시 자동 푸시 발송하는 구조인지 확인
- 아니면 /api/push/send에서 직접 web-push 발송

신규 크론 추가:
- /api/cron/push-apt-deadline (매일 09:00) → D-1, D-0 청약 푸시
- /api/cron/push-daily-reminder (매일 20:00) → 출석 리마인더

vercel.json에 크론 등록
```

커밋: `feat: 청약 마감 + 출석 리마인더 푸시 알림`

---

## TASK 3: 좋아요/공유/저장 버튼 배치 개편

### 현재 문제 (스크린샷 기반)
- 글 상세 하단: "♡ 2 | 댓글 0 | 🔗공유 | 📄저장" → 4개가 일렬로 나열
- 피드: ♡ + 💬 + ↗ 3개

### 목표: 토스증권 스타일
```
글 상세 하단 고정 바:
┌──────────────────────────────────────┐
│ ♡ 2     💬 3          ↗ 공유   🔖   │
└──────────────────────────────────────┘

좌측: 좋아요(Heart + 숫자) + 댓글(MessageCircle + 숫자)
우측: 공유(Share2) + 저장(Bookmark)

구체적 스펙:
- 좌측 그룹: flex gap-4
  - Heart 20px + "2" (liked → fill-red-500)
  - MessageCircle 20px + "3" 
- 우측 그룹: flex gap-3 ml-auto
  - Share2 20px (클릭 → ShareButtons 바텀시트)
  - Bookmark 20px (bookmarked → fill)

피드 카드 인터랙션 바:
- 동일 구조이되 숫자 크기 작게 (text-xs)
- "공유" 텍스트 제거, 아이콘만

"🔗공유" "📄저장" 텍스트 → 아이콘만으로 변경 (깔끔)
```

커밋: `feat: 좋아요/공유/저장 버튼 배치 토스 스타일`

---

## TASK 4: 프로필 카카오톡 공유 개선

### 현재 문제
- 프로필 페이지에 카카오톡 공유 버튼이 잘 안 보임

### 수정
```
프로필 페이지에서:
1. "카카오톡으로 프로필 공유" 버튼을 눈에 띄게
   - 카카오 노란색(#FEE500) 배경 + 카카오 아이콘 + "프로필 공유"
   - 또는 프로필 상단에 Share2 아이콘 버튼 (눈에 띄는 위치)

2. 공유 시 OG 정보:
   - 제목: "닉네임님의 카더라 프로필"
   - 설명: "등급: 🌱새싹 | 포인트: 150P | 게시글 N개"
   - 이미지: /api/og?type=profile&nickname=닉네임

3. 초대 코드 공유와 연계:
   - "친구 초대하기" 버튼 (카카오 공유 + 초대 코드 포함)
   - invite_codes 테이블 활용
```

커밋: `feat: 프로필 카카오 공유 강화`

---

## TASK 5: 주식 페이지 — 코스피/코스닥 TOP 100

### 5-1. DB에 종목 추가 (KOSPI TOP 100, KOSDAQ TOP 100)

현재: KOSPI 82개, KOSDAQ 19개
목표: KOSPI 100개, KOSDAQ 100개

```
KOSPI 추가 필요 (~18개):
DB에 없는 KOSPI 시총 상위 종목을 INSERT.
현재 최소 시총이 삼아알미늄 2000억이므로, 시총 1조~2조 사이 종목들:
GS, 한화, CJ, GS건설, 효성, 롯데칠성, 한국전력, 동서, 
삼성증권, NH투자증권, GS리테일, 현대백화점, BGF리테일,
호텔신라, 오리온, 코웨이, 풍산, 한국앤컴퍼니

KOSDAQ 추가 필요 (~81개):
현재 19개뿐. 시총 상위 KOSDAQ 종목들:
HLB, 리가켐바이오, 레인보우로보틱스, 파두, 두산로보틱스,
엔켐, 에스티팜, 레이크머티리얼즈, 성일하이텍, 에이피알,
피엔에이치테크, 테크윙, 하나마이크론, 주성엔지니어링,
리노공업, 새틀리, 네오위즈, 씨젠, 메디톡스, 원텍,
카페24, 케이카, 컴투스, 덕산네오룩스, 제이시스메디칼,
동국제약, 나무기술, 인크로스, 코미팜, 넥스틴,
디앤씨미디어, 와이지플러스, 쿠콘, 하이비전시스템, 
티씨케이, 아이패밀리에스씨, 비에이치, 피에스케이,
심텍, 이녹스첨단소재, 칩스앤미디어, 티에스이,
... (시총 기준 상위 100개까지)
```

### 5-2. 기본 정렬: 코스피 시총순 → 코스닥 시총순

```
StockClient.tsx 수정:
- 기본 탭: "전체" (현재 유지)
- 기본 정렬: 시가총액 내림차순 (현재 유지)
- 표시 순서: KOSPI 먼저 → KOSDAQ → NYSE → NASDAQ
  (또는 시총 통합 정렬 유지)

탭별 기본:
- 코스피 탭: KOSPI만, 시총 내림차순
- 코스닥 탭: KOSDAQ만, 시총 내림차순
- 전체 탭: 시총 내림차순 (시장 구분 없이)
```

### 5-3. 종목 추가 방법 (Claude Code에서 Supabase SQL 실행)
```
종목 추가 INSERT 형식:
INSERT INTO stock_quotes (symbol, name, market, ticker, currency, sector, market_cap)
VALUES ('005930', '삼성전자', 'KOSPI', '005930.KS', 'KRW', '반도체', 330000000000000);

- ticker: Yahoo Finance 형식 (KOSPI: .KS, KOSDAQ: .KQ)
- currency: KRW (국내) / USD (해외)
- price, change_amt 등은 크론이 자동 갱신
```

커밋: `feat: KOSPI/KOSDAQ TOP 100 종목 + 기본 정렬`

---

## 작업 순서

```
TASK 3 (버튼 배치) → TASK 4 (프로필 공유) → TASK 5 (주식 종목) → TASK 1 (상점) → TASK 2 (푸시)
```
버튼 배치가 가장 즉각적인 UX 개선이라 먼저.

---

## Claude Code 시작 프롬프트

```
소스코드를 전부 읽어:
cat src/app/(main)/feed/FeedClient.tsx
cat src/app/(main)/feed/[id]/page.tsx
cat src/components/ShareButtons.tsx
find src/app/(main)/profile -name "*.tsx" -exec cat {} \;
cat src/app/(main)/stock/StockClient.tsx
find src/app/(main)/shop -name "*.tsx" -exec cat {} \;

읽은 다음 5가지 작업을 순서대로:

1. 글상세 하단 바: 좌측(♡숫자+💬숫자) 우측(공유아이콘+저장아이콘) — 텍스트 제거, 아이콘만
2. 프로필 카카오 공유 버튼 눈에 띄게 + "친구 초대" 버튼 추가
3. 주식: KOSPI TOP 100 + KOSDAQ TOP 100 종목 DB INSERT (Supabase MCP execute_sql)
4. 상점: 신규 상품 5종 DB INSERT + 카테고리별 UI
5. 푸시: 청약 마감 D-1 알림 크론 + 출석 리마인더 크론

각 단계 npm run build → 커밋 → push. 논스톱으로 끝까지.
```
