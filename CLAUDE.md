# 카더라(kadeora.app) 전면 재구축 — Claude Code 작업 지시서 v2

> **이전 작업의 문제**: 소스코드를 충분히 읽지 않고 작업해서 좋아요/공유 등 기능이 깨짐
> **이번 작업의 원칙**: 반드시 전체 소스코드를 먼저 읽고 → 이해하고 → 그 다음 수정

---

## PHASE 0: 소스코드 완전 이해 (작업 시작 전 필수)

### 0-1. 반드시 읽어야 할 파일들 (순서대로)

**먼저 이 파일들을 전부 cat으로 읽어라. 읽기 전에 코드를 수정하지 마라.**

```bash
# 1. 프로젝트 구조 파악
find src -name "*.tsx" -o -name "*.ts" | head -80
ls src/app/api/
ls src/components/
ls src/lib/

# 2. 핵심 설정
cat src/lib/supabase-server.ts
cat src/lib/supabase-admin.ts
cat src/lib/supabase-browser.ts
cat src/lib/constants.ts
cat src/lib/api-response.ts
cat src/lib/avatar.ts
cat src/lib/admin-auth.ts

# 3. 미들웨어 (CSP, 세션)
cat src/middleware.ts

# 4. 피드 관련 전체
cat src/app/(main)/feed/page.tsx
cat src/app/(main)/feed/FeedClient.tsx
cat src/app/(main)/feed/[id]/page.tsx
cat src/components/shared/PostCard.tsx
cat src/components/shared/EmptyState.tsx

# 5. 주식 관련 전체
cat src/app/(main)/stock/page.tsx
cat src/app/(main)/stock/StockClient.tsx
cat src/app/(main)/stock/[symbol]/page.tsx
cat src/components/StockComments.tsx

# 6. 부동산 관련 전체
cat src/app/(main)/apt/page.tsx
# apt 관련 컴포넌트가 있으면 전부

# 7. HOT 관련 전체
cat src/app/(main)/hot/page.tsx

# 8. 라운지 관련 전체
cat src/app/(main)/discuss/page.tsx
# 채팅 관련 컴포넌트 전부

# 9. API 라우트 전부
cat src/app/api/likes/route.ts
cat src/app/api/comments/route.ts
cat src/app/api/posts/route.ts
cat src/app/api/follow/route.ts
cat src/app/api/attendance/route.ts
cat src/app/api/search/route.ts
# api 폴더 하위 모든 route.ts

# 10. 공유 관련
cat src/components/ShareButtons.tsx
cat src/components/KakaoInit.tsx

# 11. 인증/훅
cat src/hooks/useAuthGuard.ts
# hooks 폴더 전부

# 12. 어드민 전체
cat src/app/admin/layout.tsx
cat src/app/admin/page.tsx
# admin 폴더 하위 전부

# 13. 레이아웃
cat src/app/layout.tsx
cat src/app/(main)/layout.tsx

# 14. 글쓰기
cat src/app/(main)/write/WriteClient.tsx
```

### 0-2. 읽은 후 반드시 파악할 것

각 파일을 읽고 아래를 이해한 상태에서만 수정 시작:

1. **좋아요 전체 흐름**: PostCard에서 클릭 → API 호출 → DB 반영 → 낙관적 UI 업데이트 → 실패 시 롤백
2. **공유 전체 흐름**: ShareButtons → 카카오 SDK 초기화 → sendDefault → fallback 링크 복사
3. **댓글 전체 흐름**: 댓글 입력 → API POST → DB INSERT → 트리거 알림 → UI 업데이트
4. **북마크 전체 흐름**: 있으면 파악, 없으면 신규 구현
5. **인증 흐름**: middleware.ts 세션 갱신 → createSupabaseServer() → useAuthGuard 훅
6. **어드민 인증**: requireAdmin() vs 인라인 인증 → 어떤 API가 어떤 방식인지

---

## PHASE 1: 기능 수정 (디자인 전에 기능부터 확실히)

### 1-1. 좋아요 기능 완전 점검

**현재 상태 파악 후 수정:**
```
확인할 것:
1. /api/likes/route.ts — POST/DELETE 로직, RLS 문제 없는지
2. PostCard.tsx — 좋아요 클릭 핸들러가 API를 정확히 호출하는지
3. FeedClient.tsx — 좋아요 상태가 올바르게 전파되는지
4. 글 상세 페이지 — 좋아요 동작하는지

수정 원칙:
- 낙관적 UI: 클릭 즉시 UI 변경, API 실패 시 롤백
- 비로그인: useAuthGuard로 로그인 유도, API 호출하지 않음
- 로그인: post_likes INSERT (좋아요) / DELETE (취소) 토글
- 알림: API에서 직접 INSERT 금지, DB 트리거(handle_post_like_insert)가 처리
- 에러: 네트워크 실패 시 토스트 메시지
```

### 1-2. 공유 기능 완전 점검

```
확인할 것:
1. ShareButtons.tsx — 카카오/X/밴드/링크복사 각각 동작하는지
2. KakaoInit.tsx — SDK 로드 + init() 정상인지
3. CSP(middleware.ts) — kakao 도메인 허용 확인

수정 원칙:
- 카카오: Kakao.Share.sendDefault() → 실패 시 링크 복사 fallback
- X(트위터): window.open으로 공유 URL
- 밴드: 밴드 공유 URL
- 링크 복사: navigator.clipboard.writeText + 토스트 "링크 복사됨"
- 바텀시트 UI: 모바일은 하단 슬라이드업, 데스크톱은 드롭다운
```

### 1-3. 북마크 기능 점검

```
확인할 것:
1. bookmarks 테이블 존재 여부 + 스키마
2. 북마크 API가 있는지 (/api/bookmarks)
3. PostCard/글상세에서 북마크 UI가 있는지

없으면 구현:
- API: /api/bookmarks POST(추가)/DELETE(제거)
- UI: Bookmark 아이콘, 클릭 토글, 낙관적 UI
- 프로필 페이지에 "내 북마크" 탭
```

### 1-4. 댓글 기능 점검

```
확인할 것:
1. /api/comments/route.ts — POST 로직, award_points RPC 호출 여부
2. 글 상세 페이지 댓글 UI
3. 댓글 작성 후 즉시 목록 반영되는지

수정 원칙:
- 포인트: award_points RPC (직접 UPDATE 금지)
- 알림: API에서 notifications INSERT 금지 (notify_on_comment 트리거만)
- UI: 작성 후 댓글 목록 즉시 갱신 (setComments 또는 router.refresh)
```

### 1-5. 팔로우 기능 점검

```
확인할 것:
1. /api/follow/route.ts — 이전 세션에서 전면 재작성됨, 정상인지
2. follows 테이블 스키마 (follower_id / followee_id)
3. 팔로우 알림 — API에서 직접 notifications INSERT (트리거 없음)
```

**PHASE 1 완료 기준: 좋아요/공유/북마크/댓글/팔로우가 전부 정상 동작하는 것을 npm run build로 확인**

---

## PHASE 2: 디자인 전면 재구축

### 디자인 철학
```
- 깔끔하지만 살아있는 느낌
- 모바일 퍼스트 (375px 기준으로 먼저 디자인)
- 카드 기반 UI, 충분한 여백
- 과한 장식 없이 정보 위계 명확하게
- 다크모드 완벽 지원
- lucide-react 아이콘 통일 (이모지 사용 금지 — 단, 유저가 작성한 콘텐츠 제외)
```

### 공통 스타일 토큰
```
배경: bg-white dark:bg-gray-950
카드: bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800
텍스트 1순위: text-gray-900 dark:text-gray-50
텍스트 2순위: text-gray-600 dark:text-gray-400
텍스트 3순위: text-gray-400 dark:text-gray-500
액센트: brand 컬러 (constants.ts에 정의된 것 사용)
카드 모서리: rounded-2xl
카드 그림자: shadow-sm hover:shadow-md transition-shadow
간격: 카드 간 gap-3 (모바일) gap-4 (데스크톱)
```

### 2-1. 피드 (`/feed`) 전면 재디자인

```
[모바일 레이아웃]
┌─────────────────────────────┐
│ 카더라              🔍 👤   │ ← 헤더: 로고 + 검색 + 프로필
├─────────────────────────────┤
│ 전체 | 주식 | 부동산 | 자유  │ ← 카테고리 탭 (가로 스크롤)
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 🔥 지금 뜨는 소문        │ │ ← 하이라이트 (좋아요 상위 3개)
│ │ [카드1] [카드2] [카드3]  │ │    가로 스크롤
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 🟢 아바타  닉네임 · 2시간│ │ ← PostCard
│ │ 제목 (볼드, 1줄)        │ │
│ │ 본문 미리보기 (2줄)  [썸]│ │    이미지 있으면 우측 썸네일
│ │ 카테고리pill             │ │
│ │ ❤ 5  💬 3  🔖  ↗       │ │ ← 좋아요/댓글/북마크/공유
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ (다음 카드...)           │ │
│ └─────────────────────────┘ │
│      · · · 무한스크롤       │
├─────────────────────────────┤
│ 🏠  📈  🏢  💬  👤        │ ← 바텀 네비 (lucide 아이콘)
└─────────────────────────────┘

[데스크톱 레이아웃]
좌측: 피드 카드 리스트 (max-w-2xl)
우측 사이드바: 
  - 이번 주 HOT 3개
  - 오늘 마감 임박 청약
  - 화제 종목 3개
```

PostCard 세부 스펙:
```
- 아바타: 해시 컬러 원형, 닉네임 첫 글자
- 닉네임 옆: 등급 이모지 (GRADE_EMOJI from constants.ts)
- 시간: · 구분자 + "2시간 전" 상대 시간
- 제목: font-semibold text-base, 1줄 말줄임
- 본문: text-sm text-gray-600, 2줄 말줄임
- 카테고리: 작은 pill (각 카테고리 고유 색상, constants.ts CATEGORY_STYLES)
- 이미지: 있으면 우측 64x64 rounded-xl 썸네일
- 인터랙션 바:
  - 좋아요: Heart 아이콘 (liked면 fill-red-500, 아니면 outline)
  - 댓글: MessageCircle + 댓글 수
  - 북마크: Bookmark (bookmarked면 fill)
  - 공유: Share2 → ShareButtons 바텀시트 열기
- 인기 글 (likes >= 5): 좌측 brand 보더 2px
- NEW (1시간 이내): 작은 빨간 dot
```

### 2-2. 글 상세 (`/feed/[id]`) 재디자인

```
┌─────────────────────────────┐
│ ← 뒤로  글 상세       ⋮    │
├─────────────────────────────┤
│ 카테고리 pill               │
│ 제목 (text-xl font-bold)    │
│                             │
│ 🟢 닉네임 · 등급 · 3시간 전 │
│                             │
│ 본문 내용...                │
│ (이미지 있으면 전체 폭)      │
│                             │
│ 투자 면책 (주식/부동산만)    │
├─────────────────────────────┤
│ 💬 댓글 12개                │
│ ┌─────────────────────────┐│
│ │ 닉네임 · 1시간 전        ││
│ │ 댓글 내용                ││
│ └─────────────────────────┘│
│ (댓글 리스트...)            │
├─────────────────────────────┤
│ [댓글 입력...]      [전송]  │ ← 하단 고정
├─────────────────────────────┤
│ ❤ 5  💬 12  🔖  ↗         │ ← 하단 고정 액션바 (댓글 입력 위)
└─────────────────────────────┘
```

### 2-3. 주식 (`/stock`) 재디자인

```
┌─────────────────────────────┐
│ 📈 주식시세                 │
│ 🟢 장 중 / ⚫ 장 마감       │ ← 장 상태 표시
├─────────────────────────────┤
│ [검색바: 종목명/티커 검색]   │
├─────────────────────────────┤
│ 전체|KOSPI|KOSDAQ|NYSE|NASDAQ│
├─────────────────────────────┤
│ 정렬: 시총 | 등락률 | 인기   │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 삼성전자      KOSPI     │ │
│ │ ₩193,900                │ │ ← 큰 글씨
│ │ ▲ 1.2% (+2,300)        │ │ ← 빨강/파랑
│ │ 시총 330조  반도체       │ │
│ │ "한줄평 미리보기..."     │ │ ← stock_comments 최신 1개
│ │ 💬 12                   │ │
│ └─────────────────────────┘ │
│ (다음 종목...)              │
└─────────────────────────────┘

시세 표시 규칙:
- 장 마감이면: "전일 종가" 라벨 + 마감 시간 표시
- 등락률 0.00% + 거래량 0: "시세 없음" 대신 "전일 종가 기준" 표시
- 양수: text-red-500 ▲
- 음수: text-blue-500 ▼
- 0: text-gray-400 –
```

### 2-4. 부동산/청약 (`/apt`) 재디자인

```
┌─────────────────────────────┐
│ 🏠 청약 정보                │
├─────────────────────────────┤
│ 지역: 전체|서울|경기|...     │ ← 가로 스크롤
├─────────────────────────────┤
│ 접수중 | 예정 | 마감 | 미분양 │ ← 미분양 탭 신규
│                    총 N건    │ ← 필터 결과 카운트
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │🟢접수중   D-2  서울     │ │ ← 상태뱃지 + D-day + 지역
│ │ 래미안 엘라비네          │ │ ← 단지명 (볼드)
│ │ 서울 강서구 방화동       │ │ ← 주소
│ │ 272세대                  │ │ ← 세대수 강조
│ │ 📅 3/16 ~ 3/19          │ │
│ │ [청약홈] [소문 보기]     │ │ ← 소문 보기 = 피드에서 관련 글
│ └─────────────────────────┘ │

D-day 색상:
- D-0 오늘 마감: bg-red-100 text-red-700 animate-pulse
- D-1~2: bg-red-50 text-red-600 font-bold
- D-3~6: bg-amber-50 text-amber-600
- D-7+: bg-gray-50 text-gray-600
- 접수중: 좌측 보더 emerald
- 예정: 좌측 보더 blue
- 마감: 좌측 보더 gray, opacity-60
```

### 2-5. HOT (`/hot`) 재디자인

```
┌─────────────────────────────┐
│ 🔥 HOT                     │
├─────────────────────────────┤
│ 오늘 | 이번 주 | 이번 달    │ ← 기간 필터
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 🥇 1위                  │ │ ← 1위: 크게, 배경 그라데이션
│ │ "전세사기 걱정..."       │ │
│ │ ❤ 9  💬 12  ▲3          │ │ ← 순위 변동
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 🥈 2위  "AI 버블..."    │ │ ← 2위: 중간
│ └─────────────────────────┘ │
│ │ 3. 제목...    ❤ 9  ▲NEW │ │ ← 3~5위: 리스트형
│ │ 4. 제목...    ❤ 8  ▼2   │ │
│ │ 5. 제목...    ❤ 7  –    │ │
├─────────────────────────────┤
│ 📊 주식 HOT                │ ← 카테고리별 HOT
│ 🏠 부동산 HOT               │
│ 💬 자유 HOT                 │
├─────────────────────────────┤
│ 📍 내 지역 HOT (부산)       │ ← 지역별 (유저 위치 기반)
│ 📍 서울 HOT                 │
│ 📍 경기 HOT                 │
└─────────────────────────────┘
```

### 2-6. 라운지/토론 (`/discuss`) 재디자인

```
기존 4개 빈 방 → 피드 기반 토론 허브로 전환

┌─────────────────────────────┐
│ 💬 토론                     │
├─────────────────────────────┤
│ 🔥 지금 뜨거운 토론          │
│ ┌─────────────────────────┐ │
│ │ "전세사기 걱정..."       │ │ ← 댓글 많은 글 TOP 5
│ │ 💬 12  · 9명 참여  · 2h │ │
│ └─────────────────────────┘ │
│ (토론 카드 리스트)           │
├─────────────────────────────┤
│ 📊 주식 토론                │ ← 카테고리별 댓글 활발한 글
│ 🏠 부동산 토론               │
│ 💬 자유 토론                 │
├─────────────────────────────┤
│ ⚡ 실시간 라운지             │ ← 기존 채팅방 (하단 배치)
│ 국내주식 | 해외주식 | 부동산  │
│ 최근 메시지 미리보기         │
│ [입장하기]                   │
└─────────────────────────────┘
```

**PHASE 2 완료 기준: 모든 페이지 디자인 통일, 다크모드 정상, 모바일 반응형 정상, npm run build 성공**

---

## PHASE 3: 어드민 페이지 전면 개편

### 파일 위치
```
src/app/admin/
├── layout.tsx          ← 사이드바
├── page.tsx            ← 대시보드
├── users/              ← 회원 관리
├── posts/              ← 게시글 관리
├── comments/           ← 댓글 관리
├── reports/            ← 신고 관리
├── notices/            ← 공지/전광판
└── system/             ← 시스템 (금지어/크론/피드백)
```

### 3-1. 대시보드 (`/admin`)

```
KPI 카드 (실시간):
- 총 회원 수 (실제 유저 / 시드 유저 구분)
- 오늘 가입자
- 오늘 활성 유저 (24h 이내 활동)
- 총 게시글 / 오늘 게시글
- 총 댓글 / 오늘 댓글
- 미처리 신고
- 크론 상태 (마지막 시드 시간, 성공/실패)
- 서버 헬스 (/api/health 호출)

차트:
- 7일간 가입자 추이 (간단한 bar chart)
- 7일간 게시글/댓글 추이

최근 활동:
- 최근 게시글 5개
- 최근 가입자 5명
- 최근 신고 3개
```

### 3-2. 회원 관리 (`/admin/users`)

```
기능:
- 회원 목록 (페이지네이션, 검색)
- 실제 유저 / 시드 유저 구분 표시 (UUID aaaaaaaa- prefix)
- 개별 유저:
  - 프로필 보기 (닉네임, 이메일, 등급, 포인트, 가입일)
  - 포인트 수동 조정 (award_points / deduct_points RPC)
  - 등급 수동 변경
  - 관리자 권한 토글 (admin_toggle_admin RPC)
  - 정지 (ban) / 해제 (unban)
  - 해당 유저의 게시글/댓글 목록
- 벌크 액션: 선택 → 정지 / 삭제
```

### 3-3. 게시글 관리 (`/admin/posts`)

```
기능:
- 게시글 목록 (페이지네이션, 카테고리 필터, 검색)
- 시드 게시글 구분 (작성자 UUID aaaaaaaa- prefix)
- 개별 게시글:
  - 내용 미리보기
  - 숨김 처리 (is_deleted = true)
  - 카테고리 변경
  - 슬러그 수정
- 벌크 액션: 선택 → 숨김 / 삭제 / 카테고리 변경
- 시드 게시글 수동 생성 (어드민에서 바로 시드 트리거)
```

### 3-4. 댓글 관리 (`/admin/comments`)

```
기능:
- 댓글 목록 (페이지네이션, 검색)
- 원본 게시글 제목 표시
- 개별 댓글: 숨김 / 삭제
- 벌크 액션: 선택 → 숨김 / 삭제
```

### 3-5. 신고 관리 (`/admin/reports`)

```
기능:
- 신고 목록 (카드형)
- 신고 대상 (게시글/댓글) 미리보기
- 처리 상태: 대기 / 처리완료 / 무시
- 처리 액션: 
  - 게시글 숨김 + 신고 처리완료
  - 댓글 삭제 + 신고 처리완료
  - 신고 무시 (허위 신고)
  - 신고자/피신고자에게 포인트 차감
```

### 3-6. 공지/전광판 (`/admin/notices`)

```
기능:
- site_notices CRUD
- megaphones CRUD
- 전광판 ON/OFF 토글
- 공지 순서 변경 (드래그 또는 순서 번호)
```

### 3-7. 시스템 (`/admin/system`)

```
금지어 관리:
- banned_words CRUD
- 금지어 매칭 테스트 (입력하면 실시간 매칭)

크론 관리:
- 각 크론잡 마지막 실행 시간 + 상태
- 수동 실행 버튼 (seed-posts, stock-refresh, cleanup 등)
- seed-posts 설정: 빈도, 카테고리 비율

환경 점검:
- 환경변수 존재 여부 확인 (값은 마스킹)
- /api/health 호출 결과 표시
- Supabase 연결 상태
- 최근 에러 로그 (Sentry 대시보드 링크)

데이터 통계:
- 테이블별 행 수
- DB 용량
- 스토리지 사용량
```

### 3-8. 어드민 디자인

```
사이드바: 240px, bg-gray-950, lucide 아이콘
- 대시보드 (LayoutDashboard)
- 회원 관리 (Users)
- 게시글 관리 (FileText)
- 댓글 관리 (MessageSquare)
- 신고 관리 (AlertTriangle)
- 공지/전광판 (Megaphone)
- 시스템 (Settings)

모바일: 상단 탭 또는 햄버거 메뉴

인증: 모든 어드민 API에 requireAdmin() 통일
```

**PHASE 3 완료 기준: 어드민에서 모든 데이터를 조회/수정/삭제 가능, requireAdmin 통일**

---

## 작업 규칙 (반드시 지킬 것)

### DB 규칙
1. `profiles.points` 직접 UPDATE 절대 금지 → `award_points` / `deduct_points` RPC
2. `profiles.is_admin` 직접 UPDATE 금지 → `admin_toggle_admin` RPC
3. 알림은 DB 트리거가 처리 (댓글: notify_on_comment, 좋아요: handle_post_like_insert)
4. 팔로우 알림만 API에서 직접 INSERT

### 컬럼명
- nickname (not username)
- author_id (not user_id, in posts/comments)
- follower_id / followee_id (not from_id / to_id)
- price_krw (not price)
- 예외: stock_comments.user_id는 user_id 맞음

### CSP
- middleware.ts에서만 관리
- next.config.ts에 CSP 넣지 말 것

### 캐싱
- feed: revalidate=60
- 글 상세: revalidate=120
- stock: revalidate=300
- apt: revalidate=3600

### 커밋 단위
```
1. PHASE 1 완료 → 커밋: "fix: 좋아요/공유/북마크/댓글/팔로우 기능 완전 점검"
2. PHASE 2 피드+글상세 → 커밋: "feat: 피드+글상세 디자인 재구축"
3. PHASE 2 주식 → 커밋: "feat: 주식 페이지 디자인 재구축"
4. PHASE 2 부동산+HOT → 커밋: "feat: 부동산+HOT 디자인 재구축"
5. PHASE 2 라운지+공통 → 커밋: "feat: 라운지+공통 디자인 재구축"
6. PHASE 3 어드민 → 커밋: "feat: 어드민 전면 개편"
7. 각 커밋 후 npm run build 확인
```

---

## 작업 시작 프롬프트

Claude Code에 아래를 입력:

```
CLAUDE.md와 docs/ 폴더의 핸드오프, 서머리를 읽어.
그 다음 PHASE 0에 나열된 모든 소스 파일을 전부 읽어.
전부 읽고 이해했으면 PHASE 1(기능 수정)부터 PHASE 3(어드민)까지 순서대로 논스톱 작업 시작.
각 PHASE 완료 시 npm run build로 확인하고, 빌드 성공하면 커밋+푸시 후 다음 PHASE로.
```
