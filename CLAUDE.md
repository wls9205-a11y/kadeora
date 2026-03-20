# 카더라 어드민 페이지 전면 개편 — Claude Code 작업 지시서

> 핵심 요구: "버튼 하나로 캐시 재생성 + 시드 콘텐츠 발생"
> 전체적으로 더 효율적이고 한눈에 파악 가능한 어드민

---

## 소스 읽기 (필수)
```bash
find src/app/admin -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
find src/app/api/admin -name "*.ts" -exec echo "=== {} ===" \; -exec cat {} \;
cat src/lib/admin-auth.ts
```

---

## 1. 대시보드 (/admin) — "원클릭 관리 센터"

### 1-1. 상단 원클릭 액션 버튼 패널
```
현재 어드민 대시보드에 다음 버튼들을 추가:

┌──────────────────────────────────────────────────┐
│ ⚡ 빠른 관리                                      │
│                                                    │
│ [🔄 전체 새로고침]  [📝 시드 생성]  [🗑 캐시 초기화] │
│                                                    │
│ 마지막 시드: 7:30 AM · 마지막 캐시: 7:00 AM       │
└──────────────────────────────────────────────────┘

버튼 동작:

1. "🔄 전체 새로고침" (원클릭 올인원):
   → 순서대로 실행:
   a. /api/cron/seed-posts (시드 게시글 1~3개 + 댓글/좋아요 생성)
   b. /api/admin/refresh-apt-cache (청약 데이터 갱신)
   c. /api/stock-refresh (주식 시세 갱신)
   → 각 단계 성공/실패 표시
   → 전체 완료 시 "✅ 전체 새로고침 완료" 토스트

2. "📝 시드 생성" (시드만):
   → /api/cron/seed-posts 호출
   → "게시글 N개 + 댓글 N개 생성됨" 결과 표시

3. "🗑 캐시 초기화":
   → /api/admin/refresh-apt-cache (청약 캐시)
   → revalidatePath('/feed'), revalidatePath('/stock'), revalidatePath('/apt')
   → "캐시 초기화 완료" 토스트

구현:
- POST /api/admin/refresh-all (새 API)
  - requireAdmin() 인증
  - 순서대로 3개 크론 호출
  - 각 결과 JSON 반환
- 프론트: 버튼 클릭 → loading 스피너 → 결과 토스트
```

### 1-2. KPI 카드 개선
```
현재 get_admin_dashboard_stats() 데이터:
total_users: 100, new_users_today: 0, total_posts: 3672, posts_today: 35
total_comments: 1518, total_likes: 2362, pending_reports: 0
stock_count: 150, apt_count: 106, push_subs: 1, pwa_installs: 27

개선:
- "총 회원" → "실제 11명 / 시드 89명" 구분 표시
- 오늘 시드 게시글 수 vs 실제 게시글 수 구분
- 삭제된 댓글 670건 표시 (is_deleted)
- 포인트 이상치 경고: "Ss: 81,437P (비정상)" 표시

KPI 카드 레이아웃 (2행 4열):
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 실제 유저 │ │ 오늘글   │ │ 오늘댓글 │ │ 신고대기 │
│ 11명     │ │ 35개     │ │ 22개     │ │ 0건      │
│ +시드 89 │ │ 시드 35  │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 종목     │ │ 청약     │ │ PWA      │ │ 상점구매 │
│ 150개    │ │ 106건    │ │ 27설치   │ │ 2건      │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### 1-3. 최근 활동 피드
```
대시보드 하단에:
- 최근 실제 유저 게시글 5개 (시드 제외)
- 최근 가입자 5명
- 최근 신고 (있으면)
- 크론 실행 이력 (마지막 시드 시간, 주식 갱신 시간)
```

---

## 2. 회원 관리 (/admin/users) 개선

```
현재 확인 필요사항:
- 실제 유저 vs 시드 유저 구분 뱃지
- 포인트 수동 조정 (award_points RPC)
- 정지/해제 기능
- 관리자 권한 토글

개선:
- 실제 유저 탭 | 시드 유저 탭 분리
- 포인트 이상치 하이라이트 (81,437P인 "Ss" 유저)
- 마지막 활동 시간 표시
- 벌크 선택 → 정지/포인트 초기화
```

---

## 3. 게시글 관리 (/admin/content) 개선

```
개선:
- 시드 게시글 필터 (author_id LIKE 'aaaaaaaa-%')
- 벌크 삭제/숨김
- "시드 전체 삭제" 버튼 (delete_seed_data RPC)
- 카테고리별 필터
- 검색
```

---

## 4. 시스템 (/admin/system) 개선

### 4-1. 크론 관리 패널
```
┌──────────────────────────────────────────────────┐
│ 크론 잡 관리                                      │
│                                                    │
│ 시드 게시글 (30분마다)                             │
│ 마지막: 7:30 AM  상태: ✅  [수동 실행]            │
│                                                    │
│ 주식 시세 (5분, 평일 장중)                         │
│ 마지막: 15:30  상태: ⚫ 장 마감  [수동 실행]      │
│                                                    │
│ 청약 갱신                                          │
│ 마지막: 05:56  상태: ✅  [수동 실행]              │
│                                                    │
│ 정리 (매일 3AM)                                    │
│ 마지막: 03:00  상태: ✅  [수동 실행]              │
│                                                    │
│ 페이지뷰 정리 (매주 일요일)                        │
│ 마지막: 일요일 03:00  상태: ✅                    │
└──────────────────────────────────────────────────┘

각 "수동 실행" 버튼:
- /api/admin/trigger-cron POST { target: 'seed-posts' | 'stock-refresh' | ... }
- 실행 중 스피너 → 완료/실패 토스트
```

### 4-2. 환경변수 점검
```
현재 /api/admin/env-check 있음.
개선: 각 환경변수 존재 여부를 초록/빨강 뱃지로 표시
값은 마스킹 (***로 표시), 존재 여부만
```

### 4-3. 금지어 관리
```
- 현재 17개 등록
- CRUD UI: 추가/삭제 버튼
- 카테고리별 (profanity/adult/hate) 필터
- "테스트" 기능: 입력 텍스트에 금지어 포함 여부 실시간 체크
```

---

## 5. "전체 새로고침" API 구현

### /api/admin/refresh-all/route.ts
```typescript
// POST - requireAdmin 인증
// 순서대로 실행:
// 1. seed-posts: CRON_SECRET으로 /api/cron/seed-posts 호출
// 2. refresh-apt: /api/admin/refresh-apt-cache 호출  
// 3. stock-refresh: CRON_SECRET으로 /api/stock-refresh 호출
// 4. revalidate: 주요 경로 캐시 무효화

import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  const { admin } = await requireAdmin(req);
  
  const results = { seed: null, apt: null, stock: null, cache: null };
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://kadeora.app';
  const cronSecret = process.env.CRON_SECRET;
  
  // 1. 시드 생성
  try {
    const res = await fetch(`${baseUrl}/api/cron/seed-posts`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` }
    });
    results.seed = { ok: res.ok, status: res.status };
  } catch (e) { results.seed = { ok: false, error: e.message }; }
  
  // 2. 청약 캐시
  try {
    const res = await fetch(`${baseUrl}/api/admin/refresh-apt-cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}` }
    });
    results.apt = { ok: res.ok, status: res.status };
  } catch (e) { results.apt = { ok: false, error: e.message }; }
  
  // 3. 주식 시세
  try {
    const res = await fetch(`${baseUrl}/api/stock-refresh`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cronSecret}` }
    });
    results.stock = { ok: res.ok, status: res.status };
  } catch (e) { results.stock = { ok: false, error: e.message }; }
  
  // 4. 캐시 무효화
  try {
    revalidatePath('/feed');
    revalidatePath('/stock');
    revalidatePath('/apt');
    revalidatePath('/hot');
    results.cache = { ok: true };
  } catch (e) { results.cache = { ok: false, error: e.message }; }
  
  return Response.json({ results });
}
```

---

## 6. 사이드바 메뉴 정리

```
현재 어드민 라우트:
/admin (대시보드)
/admin/users (회원)
/admin/content (게시글)
/admin/comments (댓글)
/admin/reports (신고)
/admin/notifications (알림)
/admin/payments (결제)
/admin/system (시스템)

사이드바 메뉴 (lucide 아이콘):
- LayoutDashboard 대시보드
- Users 회원 관리
- FileText 게시글
- MessageSquare 댓글
- AlertTriangle 신고 (미처리 건수 뱃지)
- Bell 알림
- CreditCard 결제/상점
- Settings 시스템
```

---

## Claude Code 시작 프롬프트

```
어드민 페이지를 전부 읽어:
find src/app/admin -name "*.tsx" -exec echo "=== {} ===" \; -exec cat {} \;
find src/app/api/admin -name "*.ts" -exec echo "=== {} ===" \; -exec cat {} \;

읽은 다음:

1. /api/admin/refresh-all API 생성 (시드+청약+주식+캐시 원클릭)
2. 대시보드에 "빠른 관리" 버튼 패널 추가 (전체 새로고침 / 시드 생성 / 캐시 초기화)
3. KPI 카드에 실제/시드 유저 구분 + 포인트 이상치 경고
4. 크론 관리 패널 개선 (각 크론잡 상태 + 수동 실행 버튼)
5. 회원 관리에 실제/시드 탭 분리

각 단계 npm run build → 커밋 → push. 논스톱으로.
```
