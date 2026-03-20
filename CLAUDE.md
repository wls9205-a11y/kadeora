# 카더라(kadeora.app) 전면 재구축 v3 — Claude Code 작업 지시서

> ⚠️ **절대 규칙**: 코드를 수정하기 전에 반드시 해당 파일을 cat으로 전부 읽어라.
> ⚠️ **이전 작업에서 좋아요/공유가 깨졌다.** 파일을 읽지 않고 수정해서 그렇다.
> ⚠️ **"이전에 했으니 넘어간다" 금지.** 모든 파일을 처음 보는 것처럼 읽고 이해해라.

---

## STEP 0: 전체 소스코드 읽기 (이 단계를 건너뛰면 안 됨)

### 0-1. 프로젝트 구조 파악
```bash
# 먼저 전체 구조를 본다
find src -type f -name "*.tsx" -o -name "*.ts" | sort
ls -la src/lib/
ls -la src/hooks/
ls -la src/components/
ls -la src/components/shared/
ls -la src/app/api/
ls -la src/app/(main)/
ls -la src/app/admin/
```

### 0-2. 핵심 라이브러리 전부 읽기
```bash
cat src/lib/supabase-server.ts
cat src/lib/supabase-admin.ts
cat src/lib/supabase-browser.ts
cat src/lib/constants.ts
cat src/lib/api-response.ts
cat src/lib/avatar.ts
cat src/lib/admin-auth.ts
# lib 폴더에 다른 파일이 있으면 그것도 전부 읽어라
```

### 0-3. 미들웨어 읽기
```bash
cat src/middleware.ts
# CSP, 세션 갱신, 리다이렉트 로직 전부 파악
```

### 0-4. 레이아웃 전부 읽기
```bash
cat src/app/layout.tsx
cat src/app/(main)/layout.tsx
cat src/app/admin/layout.tsx
```

### 0-5. 모든 API 라우트 읽기 (하나도 빠짐없이)
```bash
# likes — 좋아요가 안 되는 원인을 여기서 찾아야 함
cat src/app/api/likes/route.ts

# comments
cat src/app/api/comments/route.ts
# comments 하위에 [id] 폴더가 있으면 그것도
find src/app/api/comments -name "*.ts" -exec cat {} \;

# posts
cat src/app/api/posts/route.ts
find src/app/api/posts -name "*.ts" -exec cat {} \;

# bookmarks
find src/app/api/bookmarks -name "*.ts" -exec cat {} \;

# follow
cat src/app/api/follow/route.ts

# attendance
find src/app/api/attendance -name "*.ts" -exec cat {} \;

# search
find src/app/api/search -name "*.ts" -exec cat {} \;

# admin 전체
find src/app/api/admin -name "*.ts" -exec cat {} \;

# cron 전체
find src/app/api/cron -name "*.ts" -exec cat {} \;

# 나머지 전부
find src/app/api -name "route.ts" -exec echo "=== {} ===" \; -exec cat {} \;
```

### 0-6. 모든 페이지 컴포넌트 읽기
```bash
# 피드
cat src/app/(main)/feed/page.tsx
cat src/app/(main)/feed/FeedClient.tsx
cat src/app/(main)/feed/[id]/page.tsx

# 주식
cat src/app/(main)/stock/page.tsx
cat src/app/(main)/stock/StockClient.tsx
find src/app/(main)/stock -name "*.tsx" -exec cat {} \;

# 부동산
find src/app/(main)/apt -name "*.tsx" -exec cat {} \;

# HOT
find src/app/(main)/hot -name "*.tsx" -exec cat {} \;

# 라운지/토론
find src/app/(main)/discuss -name "*.tsx" -exec cat {} \;

# 글쓰기
find src/app/(main)/write -name "*.tsx" -exec cat {} \;

# 프로필
find src/app/(main)/profile -name "*.tsx" -exec cat {} \;

# 검색
find src/app/(main)/search -name "*.tsx" -exec cat {} \;

# 로그인
find src/app/(main)/login -name "*.tsx" -exec cat {} \;
```

### 0-7. 모든 공유 컴포넌트 읽기
```bash
cat src/components/shared/PostCard.tsx
cat src/components/shared/EmptyState.tsx
cat src/components/ShareButtons.tsx
cat src/components/KakaoInit.tsx
cat src/components/StockComments.tsx
# components 폴더의 모든 .tsx 파일
find src/components -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
```

### 0-8. 모든 훅 읽기
```bash
find src/hooks -name "*.ts" -o -name "*.tsx" | xargs cat
```

### 0-9. 어드민 전체 읽기
```bash
find src/app/admin -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
```

### 0-10. 설정 파일 읽기
```bash
cat next.config.ts
cat tailwind.config.ts
cat package.json
cat vercel.json
cat tsconfig.json
```

**위 전부를 읽은 뒤, 다음을 머릿속에 정리하라:**

1. 좋아요 클릭 → 어떤 함수 → 어떤 API → 어떤 DB 동작? (전체 흐름)
2. 공유 버튼 클릭 → 어떤 컴포넌트 → 카카오 SDK 로드 여부 → 실행 함수?
3. 북마크 클릭 → API 존재 여부 → DB 테이블 → UI 반영?
4. 댓글 작성 → API → 포인트 적립 → 알림 트리거?
5. 각 페이지의 데이터 fetching 방식 (서버 컴포넌트 vs 클라이언트)?
6. 어드민 인증 방식 (requireAdmin vs 인라인)?

---

## STEP 1: 좋아요 + 공유 수정 (최우선)

### 좋아요가 안 되는 원인 찾기

STEP 0에서 읽은 코드를 기반으로 아래를 추적:

```
1. PostCard.tsx (또는 LikeButton.tsx)에서 좋아요 클릭 시 호출되는 함수는?
2. 그 함수가 fetch('/api/likes', ...) 를 호출하는가? 아니면 supabase.from('post_likes')를 직접 호출하는가?
3. /api/likes/route.ts의 POST 핸들러가 정상인가?
   - 인증: createSupabaseServer()로 유저 확인하는가?
   - INSERT: post_likes에 post_id + user_id INSERT하는가?
   - 에러 처리: try-catch 있는가?
4. RLS: post_likes의 INSERT 정책이 auth.uid() = user_id 인가?
5. 클라이언트에서 API 호출 시 credentials: 'include' 또는 쿠키가 전달되는가?

찾은 문제를 수정하라. 수정 후 npm run build 확인.
```

### 공유가 안 되는 원인 찾기

```
1. ShareButtons.tsx가 어디서 렌더링되는가? (PostCard? 글상세?)
2. 공유 버튼을 클릭하면 어떤 함수가 실행되는가?
3. 카카오 공유:
   - KakaoInit.tsx에서 SDK가 로드되는가?
   - window.Kakao 객체가 존재하는가?
   - Kakao.Share.sendDefault() 파라미터가 올바른가?
4. 링크 복사:
   - navigator.clipboard.writeText가 호출되는가?
   - 토스트/알림이 뜨는가?
5. CSP(middleware.ts):
   - script-src에 kakaocdn.net이 포함되어 있는가?
   - connect-src에 kakao.com이 포함되어 있는가?

찾은 문제를 수정하라. 수정 후 npm run build 확인.
```

**STEP 1 완료 기준: 로그인 상태에서 좋아요 토글 + 공유 버튼 4개(카카오/X/밴드/링크복사) 전부 동작**

커밋: `fix: 좋아요 + 공유 기능 완전 수정`

---

## STEP 2: 전체 디자인 전면 개편

### 디자인 방향

**레퍼런스**: 토스(toss) 앱의 깔끔함 + 당근마켓의 친근함 + 블라인드의 정보 밀도
**핵심 원칙**:
- 모바일 퍼스트 (375px 기준)
- 여백으로 숨쉬는 디자인 (cramped하지 않게)
- 정보 위계 명확 (제목 > 본문 > 메타)
- 터치 타겟 최소 44px
- 다크모드 완벽 지원
- lucide-react 아이콘 통일 (UI에서 이모지 사용 금지)

### 디자인 토큰 (globals.css 또는 tailwind.config에 적용)
```
/* 라이트 */
--bg-primary: #ffffff
--bg-secondary: #f8fafc (slate-50)
--bg-card: #ffffff
--border: #e2e8f0 (slate-200)
--text-primary: #0f172a (slate-900)
--text-secondary: #64748b (slate-500)
--text-tertiary: #94a3b8 (slate-400)
--accent: 카더라 브랜드 컬러 (constants.ts 확인)
--like-red: #ef4444
--up-red: #ef4444
--down-blue: #3b82f6

/* 다크 */
--bg-primary: #0f172a (slate-900)
--bg-secondary: #1e293b (slate-800)
--bg-card: #1e293b
--border: #334155 (slate-700)
--text-primary: #f1f5f9 (slate-100)
--text-secondary: #94a3b8 (slate-400)
--text-tertiary: #64748b (slate-500)

/* 공통 */
--radius-card: 16px (rounded-2xl)
--radius-pill: 9999px (rounded-full)
--radius-button: 12px (rounded-xl)
--shadow-card: 0 1px 3px rgba(0,0,0,0.06)
--shadow-card-hover: 0 4px 12px rgba(0,0,0,0.08)
```

### 2-1. 피드 (/feed) — 완전히 다시 만든다는 마음으로

**FeedClient.tsx 전면 리디자인:**

```
[모바일 375px]
┌─────────────────────────────┐
│  카더라              🔍  👤  │  ← 깔끔한 헤더, 로고는 텍스트
│─────────────────────────────│
│  전체  주식  부동산  자유     │  ← 카테고리 pill 탭
│─────────────────────────────│
│                              │
│  ┌───────────────────────┐  │
│  │ 🟢 닉네임 · 🌱 · 2h   │  │  ← 아바타(해시컬러) + 닉 + 등급 + 시간
│  │                       │  │
│  │ 제목 텍스트 (볼드)     │  │  ← text-[15px] font-semibold
│  │ 본문 미리보기 2줄까지  │  │  ← text-[14px] text-secondary 2줄 clamp
│  │ 본문 텍스트 두번째...  │  │
│  │                       │  │
│  │ 부동산               │  │  ← 카테고리 pill (작게, 좌측)
│  │                       │  │
│  │ ♡ 5    💬 3    ⤴      │  │  ← 좋아요(Heart) + 댓글(MessageCircle) + 공유(Share2)
│  └───────────────────────┘  │
│          구분선 1px          │
│  ┌───────────────────────┐  │
│  │ (다음 카드)            │  │
│  └───────────────────────┘  │
│                              │
│─────────────────────────────│
│ 🏠  📈  🏢  💬  👤        │  ← 바텀네비 (lucide 아이콘만!)
└─────────────────────────────┘

카드 스타일:
- 배경: bg-white dark:bg-slate-900
- 카드 간: border-b border-slate-100 dark:border-slate-800 (그림자 아닌 선으로 구분)
- 패딩: px-4 py-4
- 좋아요 liked 상태: Heart fill-red-500 text-red-500
- 좋아요 not liked: Heart stroke, text-slate-400
- 댓글 아이콘: MessageCircle text-slate-400
- 공유 아이콘: Share2 text-slate-400
- 인기 글 (likes >= 5): 좌측에 2px brand 보더
- 이미지 있는 글: 우측에 56x56 rounded-lg 썸네일
```

**PostCard.tsx 핵심 수정사항:**
```
1. 좋아요 버튼: 반드시 /api/likes API를 호출 (직접 DB 호출 금지)
   - 클릭 → 즉시 UI 변경(낙관적) → API 호출 → 실패 시 롤백
   - 비로그인 시: useAuthGuard로 로그인 유도
2. 공유 버튼: Share2 아이콘 클릭 → ShareButtons 바텀시트 열기
3. 북마크: 있으면 유지, 없으면 이번에 추가하지 않아도 됨
4. 아바타: getAvatarColor(author_id) 해시 컬러 원형
5. 등급: GRADE_EMOJI[grade] from constants.ts
6. 시간: formatDistanceToNow 또는 직접 구현 ("방금 전", "3분 전", "2시간 전", "3일 전")
```

**데스크톱 (768px+):**
```
2컬럼 레이아웃
좌측(flex-1 max-w-2xl): 피드 카드 리스트
우측(w-80): 사이드바
  - "이번 주 HOT" 3개 (제목 + 좋아요 수)
  - "마감 임박 청약" 2개 (D-day + 단지명)
```

### 2-2. 글 상세 (/feed/[id]) — 읽기 경험 최적화

```
[모바일]
┌─────────────────────────────┐
│  ←  글 상세                  │
│─────────────────────────────│
│                              │
│  부동산                      │  ← 카테고리 pill
│                              │
│  제목 텍스트                 │  ← text-xl font-bold
│                              │
│  🟢 닉네임 · 🌱 · 3시간 전  │  ← 작성자 정보
│                              │
│  본문 내용이 여기에...       │  ← text-[15px] leading-relaxed
│  본문 내용 계속...           │
│                              │
│  (이미지 있으면 전폭 표시)    │
│                              │
│  ⚠️ 투자 면책 (주식/부동산)  │  ← 해당 카테고리만
│─────────────────────────────│
│  💬 댓글 12개                │
│─────────────────────────────│
│  🟢 닉네임 · 1시간 전       │
│  댓글 내용                   │
│  ─────────────────────────  │
│  🔵 닉네임2 · 30분 전       │
│  댓글 내용2                  │
│─────────────────────────────│
│  ♡ 5    💬 12    🔖    ⤴    │  ← 하단 고정 액션바
│─────────────────────────────│
│  [댓글 입력...]      [전송]  │  ← 하단 고정 댓글 입력
└─────────────────────────────┘
```

### 2-3. 주식 (/stock) — 카드형 + 장 상태

```
[모바일]
┌─────────────────────────────┐
│  주식시세       ⚫ 장 마감   │  ← 장 상태 뱃지
│─────────────────────────────│
│  [종목명/티커 검색]          │  ← 검색바
│  전체 KOSPI KOSDAQ NYSE ...  │  ← 시장 필터
│  시총순 ▾  등락률순  인기순   │  ← 정렬
│─────────────────────────────│
│  ┌───────────────────────┐  │
│  │ 삼성전자     KOSPI     │  │
│  │ ₩193,900              │  │  ← text-xl font-bold
│  │ – 0.00%  전일종가      │  │  ← 장 마감이면 "전일종가" 표시
│  │ 시총 330.0조           │  │
│  │ 💬 한줄평 3개          │  │  ← 클릭 시 /stock/삼성전자
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 테슬라      NASDAQ     │  │
│  │ $395.56               │  │
│  │ – 0.00%  전일종가      │  │
│  │ 시총 $780.0B           │  │
│  └───────────────────────┘  │
└─────────────────────────────┘

등락 색상:
- 양수: text-red-500 "▲ 1.2%"
- 음수: text-blue-500 "▼ 0.8%"  
- 0 또는 장마감: text-slate-400 "– 0.00%" + "전일종가" 라벨

장 상태 로직:
- KST 평일 09:00-15:30 → "🟢 장 중"
- 그 외 → "⚫ 장 마감 (3/21 15:30 기준)"
```

### 2-4. 부동산/청약 (/apt)

```
현재 구조가 나쁘지 않으니 디자인만 정리:

1. D-day 긴급도 색상:
   - D-0: bg-red-100 text-red-700 "⏰ 오늘 마감!" animate-pulse
   - D-1~2: bg-red-50 text-red-600 font-bold
   - D-3~6: bg-amber-50 text-amber-600
   - D-7+: bg-slate-100 text-slate-600
   
2. 카드 좌측 보더:
   - 접수중: border-l-4 border-emerald-500
   - 예정: border-l-4 border-blue-500
   - 마감: border-l-4 border-slate-300 opacity-70

3. 필터 결과 카운트: "총 N건" 표시

4. 미분양 탭: unsold_apts 데이터 노출 (별도 탭)

5. 카드 디자인 통일: 피드와 같은 폰트 크기, 여백 규칙
```

### 2-5. HOT (/hot)

```
1. 기간 필터: 오늘 | 이번 주(기본) | 이번 달
2. TOP 1~3 강조: 
   - 1위: 큰 카드, 그라데이션 배경
   - 2~3위: 중간 카드
   - 4~5위: 리스트형
3. 카테고리별 HOT (주식/부동산/자유 각 3개)
4. 지역별 HOT (현재 유지하되 디자인 정리)
5. slug URL 사용 (숫자 ID 아닌 slug)
```

### 2-6. 라운지/토론 (/discuss)

```
현재 4개 빈 방(0개 메시지) → 피드 기반 토론 허브로 전환

상단: "🔥 뜨거운 토론" — 댓글 많은 피드 글 5개
중단: 카테고리별 토론 (주식/부동산/자유 — 댓글 활발한 글 3개씩)
하단: "실시간 라운지" — 기존 채팅방 (축소 배치)
     "0개 메시지" → "첫 대화를 시작해보세요!" 로 변경
```

### 2-7. 공통 컴포넌트

**바텀 네비게이션:**
```
- SSR부터 lucide 아이콘 사용 (이모지 잔존 제거)
- 아이콘: Home / TrendingUp / Building2 / MessageCircle / User
- 현재 페이지: brand 컬러 + font-semibold
- 나머지: text-slate-400
- 높이: h-16, safe-area-inset-bottom 대응
```

**헤더:**
```
- 데스크톱: 상단 네비 (피드|주식|부동산|토론|HOT)
- 모바일: 페이지 제목 + 검색/프로필 아이콘
- backdrop-blur-lg bg-white/80 dark:bg-slate-900/80
```

**커밋 단위:**
```
feat: 피드 + 글상세 디자인 전면 개편
feat: 주식 페이지 디자인 개편
feat: 부동산 + HOT 디자인 개편
feat: 라운지 + 공통 컴포넌트 개편
```

---

## STEP 3: 어드민 전면 개편

### 어드민 소스를 먼저 전부 읽어라
```bash
find src/app/admin -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
find src/app/api/admin -name "*.ts" -exec echo "=== {} ===" \; -exec cat {} \;
```

### 어드민 기능 체크리스트

```
대시보드 (/admin):
□ 총 회원 수 (실제 vs 시드 구분 — UUID aaaaaaaa- prefix)
□ 오늘 가입자 / 오늘 활성 유저
□ 총 게시글 / 오늘 게시글
□ 총 댓글 / 오늘 댓글  
□ 미처리 신고 수
□ 크론 마지막 실행 시간
□ 최근 게시글 5개 / 최근 가입자 5명

회원 관리 (/admin/users):
□ 회원 목록 + 검색 + 페이지네이션
□ 실제/시드 구분 표시
□ 포인트 수동 조정 (award_points RPC — 직접 UPDATE 금지!)
□ 관리자 권한 토글 (admin_toggle_admin RPC)
□ 정지/해제
□ 벌크 액션

게시글 관리 (/admin/posts):
□ 게시글 목록 + 카테고리 필터 + 검색 + 페이지네이션
□ 숨김/삭제
□ 벌크 액션
□ 시드 수동 트리거

댓글 관리 (/admin/comments):
□ 댓글 목록 + 검색 + 페이지네이션
□ 원본 게시글 표시
□ 숨김/삭제

신고 관리 (/admin/reports):
□ 신고 목록 (카드형)
□ 처리: 승인(콘텐츠 숨김) / 무시(허위 신고)

시스템 (/admin/system):
□ 금지어 CRUD
□ 크론 수동 실행
□ 환경변수 존재 여부 확인 (값 마스킹)

→ 위 목록에서 이미 구현된 것은 유지, 없는 것만 추가
→ 모든 어드민 API는 requireAdmin() 사용 (인라인 인증 금지)
```

### 어드민 디자인
```
사이드바: w-60 bg-slate-950 text-white
  - lucide 아이콘 + 메뉴명
  - 현재 페이지: bg-slate-800 border-l-2 border-brand
모바일: 상단 탭 또는 햄버거

카드: bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6
테이블: 깔끔한 그리드, hover:bg-slate-50
버튼: rounded-lg, primary=brand, danger=red-500
```

커밋: `feat: 어드민 전면 개편`

---

## DB 규칙 (절대 어기지 말 것)

```
1. profiles.points 직접 UPDATE → 금지 (prevent_privilege_escalation 트리거)
   → award_points / deduct_points RPC만 사용

2. profiles.is_admin 직접 UPDATE → 금지
   → admin_toggle_admin RPC만 사용

3. 알림 INSERT:
   - 댓글 알림 → DB 트리거 notify_on_comment가 처리 (API에서 INSERT 금지)
   - 좋아요 알림 → DB 트리거 handle_post_like_insert가 처리 (API에서 INSERT 금지)
   - 팔로우 알림 → API에서 직접 INSERT (트리거 없음)

4. 컬럼명:
   - nickname (not username)
   - author_id (not user_id) — posts/comments 테이블
   - follower_id / followee_id (not from_id/to_id)
   - price_krw (not price)
   - 예외: stock_comments.user_id는 user_id 맞음

5. CSP → middleware.ts에서만 (next.config.ts에 넣지 말 것)

6. 캐싱: feed 60s, 상세 120s, stock 300s, apt 3600s
```

---

## 작업 순서 요약

```
STEP 0: 전체 소스코드 읽기 (건너뛰기 금지)
  ↓
STEP 1: 좋아요 + 공유 수정 → 커밋 + 빌드 확인 + 푸시
  ↓
STEP 2-1: 피드 + 글상세 디자인 → 커밋 + 빌드 확인 + 푸시
STEP 2-2: 주식 디자인 → 커밋 + 빌드 확인 + 푸시
STEP 2-3: 부동산 + HOT 디자인 → 커밋 + 빌드 확인 + 푸시
STEP 2-4: 라운지 + 공통 디자인 → 커밋 + 빌드 확인 + 푸시
  ↓
STEP 3: 어드민 개편 → 커밋 + 빌드 확인 + 푸시
```

**각 커밋 후 반드시 npm run build로 에러 없는지 확인하라.**
**빌드 실패하면 수정하고 다시 빌드해라.**

---

## Claude Code 시작 프롬프트

```
CLAUDE.md를 읽어. 그 다음 STEP 0의 모든 파일을 전부 읽어. 
하나도 빠짐없이 읽고, 특히 좋아요(/api/likes + PostCard)와 공유(ShareButtons + KakaoInit) 흐름을 완벽히 파악해.
파악 완료하면 STEP 1 → STEP 2 → STEP 3 순서로 논스톱 작업.
각 커밋 후 npm run build 확인하고 git push origin main.
이전에 작업했다고 대충 넘어가지 마. 모든 파일을 처음 보는 것처럼 읽고 수정해.
```
