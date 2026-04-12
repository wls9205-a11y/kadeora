# 카더라 피드 리뉴얼 & 사용자 설정 시스템 설계안

> 작성일: 2026.04.13 | 버전: v1.0

---

## 1. 전체 아키텍처 변경 요약

### 1-1. 신규 DB 테이블

```sql
-- 사용자 설정/프로필 확장
ALTER TABLE profiles ADD COLUMN region TEXT;              -- 시/구 단위 (예: "부산 해운대구")
ALTER TABLE profiles ADD COLUMN region_code TEXT;          -- 법정동코드 앞 5자리
ALTER TABLE profiles ADD COLUMN interests TEXT[];          -- 관심사 배열 ['아파트','주식','ETF','재개발','청약']
ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN marketing_agreed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN marketing_agreed_at TIMESTAMPTZ;

-- 알림 설정 테이블
CREATE TABLE notification_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  push_enabled BOOLEAN DEFAULT true,
  kakao_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  -- 알림 유형별 on/off
  noti_comment BOOLEAN DEFAULT true,       -- 내 글에 댓글
  noti_like BOOLEAN DEFAULT true,          -- 좋아요
  noti_reply BOOLEAN DEFAULT true,         -- 대댓글
  noti_hot BOOLEAN DEFAULT true,           -- 내 글 HOT 선정
  noti_local BOOLEAN DEFAULT true,         -- 우리동네 새 글
  noti_poll_result BOOLEAN DEFAULT true,   -- 투표 결과
  noti_predict_result BOOLEAN DEFAULT true,-- 예측 적중
  noti_daily_report BOOLEAN DEFAULT true,  -- 데일리 리포트
  noti_point BOOLEAN DEFAULT true,         -- 포인트 적립
  noti_grade_up BOOLEAN DEFAULT true,      -- 등급 승급
  noti_marketing BOOLEAN DEFAULT false,    -- 마케팅/이벤트
  quiet_start TIME,                        -- 방해금지 시작
  quiet_end TIME,                          -- 방해금지 종료
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 게시글 타입 확장
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'short';     -- 한마디
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'poll';      -- 투표
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'vs';        -- VS 대결
ALTER TYPE post_type ADD VALUE IF NOT EXISTS 'predict';   -- 예측

-- 투표 시스템
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

CREATE TABLE poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)  -- 1인 1투표
);

-- VS 대결
CREATE TABLE vs_battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE vs_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID REFERENCES vs_battles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  choice TEXT CHECK (choice IN ('A', 'B')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(battle_id, user_id)
);

-- 예측
CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  target TEXT NOT NULL,           -- "삼성전자 90,000원"
  direction TEXT CHECK (direction IN ('up', 'down')),
  deadline DATE NOT NULL,
  resolved BOOLEAN DEFAULT false,
  result BOOLEAN,                 -- true=적중, false=미적중
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE prediction_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES predictions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  agree BOOLEAN NOT NULL,         -- true=동의, false=반대
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(prediction_id, user_id)
);
```

### 1-2. 포인트 연동 (point_reason enum 확장)

```sql
ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'poll_create';      -- 투표 생성 +10
ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'poll_vote';        -- 투표 참여 +5
ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'vs_create';        -- VS 생성 +10
ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'vs_vote';          -- VS 참여 +5
ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'predict_create';   -- 예측 생성 +10
ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'predict_vote';     -- 예측 참여 +5
ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'predict_hit';      -- 예측 적중 +50
ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'short_create';     -- 한마디 작성 +5
ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'local_post';       -- 우리동네 글 +10
ALTER TYPE point_reason ADD VALUE IF NOT EXISTS 'onboarding_complete'; -- 온보딩 완료 +100
```

---

## 2. 온보딩 플로우

### 2-1. 트리거 조건

카카오 OAuth 로그인 성공 후 `profiles.onboarding_completed === false`인 경우 온보딩 진입.

### 2-2. 온보딩 단계 (4단계, 스킵 가능)

```
[Step 1] 환영 + 닉네임 확인
├── 카카오에서 가져온 닉네임 표시
├── 수정 가능
└── "다음" 버튼

[Step 2] 관심사 선택 (multi-select, 최소 1개)
├── 🏠 아파트/분양     📈 국내주식     🌍 해외주식
├── 🏗️ 재개발/재건축    💰 ETF          🏦 청약
├── 📊 부동산 투자      🪙 가상자산     ☕ 자유/잡담
└── 선택한 관심사 기반으로 피드 개인화

[Step 3] 우리동네 설정 (선택)
├── 시/도 선택 → 구/군 선택 (2단계 드롭다운)
├── "우리동네 기능이란?" 툴팁 설명
├── ⚠️ "나중에 설정" 버튼 (스킵 가능)
└── 설정 시 → region, region_code 저장

[Step 4] 알림/마케팅 동의
├── 📱 푸시 알림 수신 동의 (기본 ON)
├── 💬 카카오 알림톡 수신 동의 (기본 ON)
├── 📧 이메일 수신 동의 (기본 OFF)
├── 📢 마케팅 정보 수신 동의 (기본 OFF, 별도 체크)
├── 약관 링크 (개인정보 처리방침, 마케팅 수신 동의)
└── "시작하기" 버튼 → onboarding_completed = true, +100P 지급
```

### 2-3. 온보딩 라우팅

```
경로: /onboarding
미들웨어: 로그인 상태 + onboarding_completed === false → /onboarding 리다이렉트
완료 후: /feed 로 이동
스킵: 각 단계에서 "건너뛰기" 가능, 마지막 단계에서 "시작하기" 누르면 완료 처리
```

### 2-4. 컴포넌트 구조

```
/app/onboarding/page.tsx
/components/onboarding/OnboardingShell.tsx    -- 프로그레스 바 + 단계 관리
/components/onboarding/StepNickname.tsx
/components/onboarding/StepInterests.tsx
/components/onboarding/StepRegion.tsx
/components/onboarding/StepNotifications.tsx
```

---

## 3. 피드 리뉴얼

### 3-1. 피드 라우트 구조

```
/feed                  -- 피드 메인 (전체 탭)
/feed?tab=local        -- 우리동네 탭
/feed?tab=apt          -- 부동산 탭
/feed?tab=stock        -- 주식 탭
/feed?tab=free         -- 자유 탭
```

### 3-2. 피드 카드 타입별 컴포넌트

```
/components/feed/FeedShell.tsx              -- 피드 레이아웃 (헤더+탭+FAB+하단네비)
/components/feed/QuickPostBar.tsx           -- 접힌 상태 "한마디 던져보세요"
/components/feed/QuickPostExpanded.tsx       -- 펼친 상태 (한마디/글쓰기/투표/예측 모드)
/components/feed/HotTopicBar.tsx            -- 실시간 핫토픽 가로 스크롤
/components/feed/OnlineIndicator.tsx        -- OO명 활동중
/components/feed/DailyReportCard.tsx        -- 데일리 리포트
/components/feed/LocalBanner.tsx            -- 우리동네 배너
/components/feed/FloatingActionButton.tsx   -- 플로팅 글쓰기 버튼

/components/feed/cards/
├── PostCard.tsx           -- 일반 커뮤니티 글
├── ShortCard.tsx          -- 한마디
├── BlogCard.tsx           -- AI 자동생성 블로그
├── PollCard.tsx           -- 투표
├── VSCard.tsx             -- VS 대결
├── PredictCard.tsx        -- 예측
├── LocalPostCard.tsx      -- 우리동네 글 (📍지역 태그)
└── ActionBar.tsx          -- 공통 좋아요/댓글/조회수/공유 바
```

### 3-3. 피드 데이터 로딩

```typescript
// /api/feed/route.ts
// 쿼리 파라미터: tab, cursor, limit

// tab별 필터링 로직:
// all    → 모든 카테고리 + 블로그 혼합 (블로그는 3개당 1개 비율로 삽입)
// local  → region_code 일치하는 글만 (설정 안 된 유저 → 설정 유도 UI)
// apt    → category = 'apt' 필터
// stock  → category = 'stock' 필터
// free   → category = 'free' 필터

// 정렬: 최신순 기본, 핫 뱃지는 최근 1시간 내 (좋아요+댓글) 급상승 기준
// 커서 기반 페이지네이션: created_at 기준
```

### 3-4. 우리동네 탭 접근 제어

```
우리동네 탭 클릭 시:
├── profiles.region 존재 → 정상 진입
└── profiles.region 없음 → 지역 설정 유도 바텀시트
    ├── "우리동네 기능을 사용하려면 지역 설정이 필요해요"
    ├── 시/도 → 구/군 2단계 선택
    ├── "설정하고 시작하기" 버튼
    └── 설정 완료 → 바로 우리동네 피드 로드
```

### 3-5. 하단 네비게이션

```
탭 구조 (고정):
💬 피드  |  📈 주식  |  🏠 부동산  |  📰 블로그  |  ☰ 더보기

라우팅:
피드     → /feed
주식     → /stock
부동산   → /apt
블로그   → /blog
더보기   → /more (바텀시트 또는 페이지)
```

### 3-6. 플로팅 액션 버튼 (FAB)

```
위치: 우측 하단 (하단 네비 위 16px)
크기: 48x48
아이콘: ✏️
동작: 탭 → 4개 메뉴 팝업 (배경 딤)
  ├── 💬 한마디  → QuickPost mode="text"로 열기
  ├── 📝 글쓰기  → /write (기존 글쓰기 페이지)
  ├── 📊 투표    → QuickPost mode="poll"로 열기
  └── 🔮 예측    → QuickPost mode="predict"로 열기

VS 대결은 "글쓰기" 진입 후 타입 선택으로 접근
```

---

## 4. 더보기 메뉴 (설정)

### 4-1. 더보기 페이지 구조

```
/more (또는 바텀시트)

[사용자 프로필 영역]
├── 아바타 + 닉네임 + 등급 뱃지
├── 포인트 잔액 표시
└── 프로필 수정 버튼

[메뉴 리스트]
├── 📍 우리동네 설정           → /settings/region
├── 💡 관심사 설정             → /settings/interests
├── 🔔 알림 설정               → /settings/notifications
├── 📢 마케팅 수신 동의 관리    → /settings/marketing
├── ─────────────────────
├── 💰 포인트 내역             → /points
├── ⭐ 스크랩/북마크            → /bookmarks
├── ✏️ 내가 쓴 글              → /my-posts
├── 💬 내가 쓴 댓글            → /my-comments
├── ─────────────────────
├── 📋 공지사항                → /notice
├── ❓ 자주 묻는 질문           → /faq
├── 💌 문의하기                → /contact
├── 📜 이용약관               → /terms
├── 🔒 개인정보 처리방침       → /privacy
├── ─────────────────────
├── 🔤 글꼴 크기 설정          → (기존 font-size 토글)
├── 🌙 다크모드 (기본)         → (현재 다크 고정, 추후 확장)
└── 🚪 로그아웃
```

### 4-2. 컴포넌트 구조

```
/app/more/page.tsx                          -- 더보기 메인
/app/settings/region/page.tsx               -- 지역 설정
/app/settings/interests/page.tsx            -- 관심사 설정
/app/settings/notifications/page.tsx        -- 알림 설정
/app/settings/marketing/page.tsx            -- 마케팅 동의
```

---

## 5. 설정 상세

### 5-1. 우리동네 설정 (`/settings/region`)

```
[현재 설정: 부산 해운대구]    ← region 있으면 표시

시/도 선택
├── 서울특별시, 부산광역시, 대구광역시, 인천광역시, ...

구/군 선택 (시/도 선택 후 활성화)
├── 해운대구, 수영구, 동래구, 부산진구, ...

[저장하기] 버튼

참고: 지역 데이터는 행정안전부 법정동코드 기반
     region = "부산 해운대구"
     region_code = "26350"  (시/도 2자리 + 구/군 3자리)
```

### 5-2. 관심사 설정 (`/settings/interests`)

```
내 관심사를 선택하세요 (1개 이상)

[🏠 아파트/분양]  [📈 국내주식]  [🌍 해외주식]
[🏗️ 재개발]      [💰 ETF]      [🏦 청약]
[📊 부동산투자]   [🪙 가상자산]  [☕ 자유/잡담]

선택된 관심사는 피드 개인화에 사용됩니다.
관심사 기반으로 블로그 추천, 핫토픽 필터링에 반영.

[저장하기]
```

### 5-3. 알림 설정 (`/settings/notifications`)

```
[알림 채널]
├── 📱 앱 푸시 알림          [ON/OFF 토글]
├── 💬 카카오 알림톡          [ON/OFF 토글]  (일 1회 제한)
└── 📧 이메일 알림            [ON/OFF 토글]  (일 1회 제한)

[알림 유형]
활동 알림
├── 내 글에 댓글              [ON/OFF]
├── 내 댓글에 답글            [ON/OFF]
├── 좋아요                    [ON/OFF]
├── 내 글 HOT 선정            [ON/OFF]

참여 알림
├── 투표 결과 알림            [ON/OFF]
├── 예측 적중 알림            [ON/OFF]
├── 포인트 적립               [ON/OFF]
├── 등급 승급                 [ON/OFF]

콘텐츠 알림
├── 우리동네 새 글            [ON/OFF]  (지역 설정 시만 활성)
├── 데일리 리포트             [ON/OFF]

[방해금지 시간]
├── 시작: [22:00] 종료: [08:00]
└── 이 시간에는 푸시 알림을 보내지 않습니다

[마케팅 정보 수신]
├── 이벤트/프로모션 알림      [ON/OFF]
├── 마케팅 수신 동의일: 2026.04.13
└── ⚠️ 동의 철회 시 이벤트 혜택을 받을 수 없습니다
```

### 5-4. 마케팅 수신 동의 (`/settings/marketing`)

```
📢 마케팅 정보 수신 동의

카더라에서 제공하는 이벤트, 프로모션, 신규 기능 안내를
받아보시겠습니까?

수신 채널:
├── 📱 푸시 알림     [ON/OFF]
├── 💬 카카오톡      [ON/OFF]
└── 📧 이메일       [ON/OFF]

현재 상태: [동의함 / 동의하지 않음]
동의일: 2026.04.13
철회일: -

⚠️ 전자적 전송매체를 이용한 광고성 정보 전송에 대한
   수신 동의/철회는 정보통신망법 제50조에 따릅니다.

[동의 변경하기]
```

---

## 6. API 엔드포인트

### 6-1. 피드 관련

```
GET    /api/feed?tab=all&cursor=xxx&limit=20     -- 피드 목록
POST   /api/feed/short                            -- 한마디 작성
POST   /api/feed/poll                             -- 투표 생성
POST   /api/feed/poll/vote                        -- 투표 참여
POST   /api/feed/vs                               -- VS 생성
POST   /api/feed/vs/vote                          -- VS 투표
POST   /api/feed/predict                          -- 예측 생성
POST   /api/feed/predict/vote                     -- 예측 참여
GET    /api/feed/hot-topics                       -- 핫토픽 (캐시 1분)
GET    /api/feed/online-count                     -- 활동중 인원
GET    /api/feed/daily-report                     -- 데일리 리포트
```

### 6-2. 설정 관련

```
GET    /api/settings/profile                      -- 내 프로필+설정 조회
PATCH  /api/settings/region                       -- 지역 설정
PATCH  /api/settings/interests                    -- 관심사 설정
GET    /api/settings/notifications                -- 알림 설정 조회
PATCH  /api/settings/notifications                -- 알림 설정 변경
PATCH  /api/settings/marketing                    -- 마케팅 동의 변경
```

### 6-3. 온보딩

```
POST   /api/onboarding/complete                   -- 온보딩 완료 처리
       body: { nickname, region?, region_code?, interests[], marketing_agreed, notification_settings }
```

---

## 7. 구현 우선순위

### Phase 1 — 핵심 인프라 (1주)

```
1. DB 마이그레이션 (테이블, enum 확장)
2. notification_settings 테이블 + RPC
3. profiles 컬럼 추가 (region, interests, onboarding 관련)
4. 피드 API 기본 틀 (/api/feed)
```

### Phase 2 — 피드 UI (1주)

```
1. FeedShell + 하단 네비 (피드/주식/부동산/블로그/더보기)
2. 카드 컴포넌트 (PostCard, ShortCard, BlogCard)
3. QuickPostBar + QuickPostExpanded (한마디 모드만 먼저)
4. FAB 구현
5. HotTopicBar + OnlineIndicator + DailyReportCard
6. ActionBar (좋아요/댓글/조회수/공유)
```

### Phase 3 — 참여형 콘텐츠 (1주)

```
1. PollCard + 투표 API + 포인트 연동
2. VSCard + VS API + 포인트 연동
3. PredictCard + 예측 API + 포인트 연동
4. QuickPost 투표/예측 모드 구현
```

### Phase 4 — 우리동네 + 온보딩 (1주)

```
1. 온보딩 4단계 UI (/onboarding)
2. 온보딩 미들웨어 (미완료 시 리다이렉트)
3. 우리동네 탭 + 지역 미설정 시 바텀시트
4. LocalBanner + LocalPostCard
5. 지역 설정 페이지 (/settings/region)
```

### Phase 5 — 더보기 + 설정 (1주)

```
1. 더보기 메뉴 페이지 (/more)
2. 관심사 설정 (/settings/interests)
3. 알림 설정 (/settings/notifications)
4. 마케팅 동의 관리 (/settings/marketing)
5. 기존 알림 시스템(Solapi)과 notification_settings 연동
```

---

## 8. 기존 시스템 연동 주의사항

```
1. award_points RPC 사용 필수 — 직접 UPDATE 금지
   새 point_reason enum 값들 ALTER 먼저 배포 후 코드 배포

2. update_user_grade() 트리거 주의
   새 post_type (short, poll, vs, predict) 삽입 시에도
   트리거가 points를 덮어쓰지 않도록 확인

3. 온보딩 미들웨어는 /api, /blog, /_next 등 제외
   middleware.ts에 matcher 패턴 추가

4. 우리동네 피드 쿼리 성능
   region_code 컬럼에 인덱스 필수:
   CREATE INDEX idx_posts_region ON posts(region_code) WHERE region_code IS NOT NULL;

5. 활동중 인원은 Supabase Realtime Presence 또는
   Redis 카운터 (현재 인프라에 맞게 선택)

6. 데일리 리포트는 cron으로 매일 06:00 생성 → 캐시
   /api/feed/daily-report는 캐시된 데이터 반환

7. FAB z-index 하단네비(150)보다 위(200)로 설정

8. 글쓰기 시 category 외에 post_type 필드 추가 저장
   category: apt/stock/free/local
   post_type: post/short/poll/vs/predict
```

---

## 9. 데이터 모델 관계도

```
profiles
├── region, region_code, interests[], onboarding_completed
├── 1:1 → notification_settings
│
posts
├── post_type: post | short | poll | vs | predict
├── category: apt | stock | free | local
├── region_code (우리동네 글)
│
├── 1:1 → polls → 1:N poll_options
│                 → 1:N poll_votes (user당 1개)
│
├── 1:1 → vs_battles → 1:N vs_votes (user당 1개)
│
└── 1:1 → predictions → 1:N prediction_votes (user당 1개)
```
