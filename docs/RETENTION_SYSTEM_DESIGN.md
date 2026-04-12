# 카더라 리텐션 시스템 완전 재설계안

> 작성일: 2026-04-12  
> 상태: 설계 승인 대기  
> 예상 총 작업: Phase 1 (3h) + Phase 2 (5h) + Phase 3 (8h)

---

## 1. 현황 진단 요약

### 1.1 잘 되어 있는 것
- Service Worker v2 (push 수신/클릭/재구독/오프라인)
- push-utils.ts 중앙화 (VAPID lazy init, 410/404 만료 구독 자동 정리)
- 크론 5개 (content-alert, daily-reminder, apt-deadline, check-price-alerts, blog-subscription-alert)
- 관심사/지역 기반 개인화 발송
- SmartPushPrompt 전 플랫폼 분기 (Android/iOS PWA/iOS Safari/Desktop)
- 중복 방지 (apt-deadline, daily-reminder)
- 알림 설정 원클릭 ON/OFF
- 출석 보상 시스템 (3/7/14/30일 연속 보너스)
- D+1/D+3 웰컴 넛지
- Resend 이메일 연동 (수동 admin API)

### 1.2 치명적 문제 (리텐션 직격)
| # | 문제 | 영향 |
|---|------|------|
| C1 | 소셜 인터랙션 실시간 푸시 0건 (댓글/좋아요/팔로우) | 커뮤니티 리텐션 루프 완전 단절 |
| C2 | 푸시 미허용 유저 60-80% → 도달 채널 0개 | 대다수 유저 이탈 방치 |
| C3 | /api/push/click API 없음 → SW 404 | 푸시 효과 측정 불가 |
| C4 | 앱 배지(setAppBadge) 미구현 | PWA 앱에 미읽음 수 안 뜸 |
| C5 | Quiet Hours DB에만 존재, 크론 0개 적용 | 새벽 푸시 → 거부 → 영구 이탈 |
| C6 | weekly-digest가 이메일 안 보냄 (notifications INSERT만) | 이메일 채널 사실상 작동 안 함 |
| C7 | 이탈 유저 자동 복귀 시퀀스 없음 | 7일+ 미접속 유저 방치 |

### 1.3 코드 중복/정리 필요
| 파일 | 문제 | 조치 |
|------|------|------|
| `PushPromptBanner.tsx` (56줄) | SmartPushPrompt와 기능 중복, blog/[slug]에서 동시 노출 | **삭제** |
| `PushSubscribeButton.tsx` (109줄) | Sidebar 전용, SmartPushPrompt와 역할 겹침 | **삭제** → Sidebar에 SmartPushPrompt 미니 버전 |
| `GuideInstallButton.tsx` (172줄) | /guide 페이지 전용, InstallBanner와 iOS 가이드 중복 | **유지** (가이드 페이지 전용) |
| 알림 INSERT 19곳 분산 | 각 API/크론에서 직접 `sb.from('notifications').insert()` | **중앙 함수** `createNotification()` 통합 |
| `push/send/route.ts` | admin 전용 broadcast, push-utils와 역할 겹침 | **유지** (admin 전용) |

---

## 2. 아키텍처 재설계

### 2.1 핵심 원칙: 중앙 알림 허브

**현재 (분산형):**
```
댓글 API → notifications INSERT (푸시 없음)
좋아요 API → DB 트리거 → notifications INSERT (푸시 없음)  
팔로우 API → notifications INSERT (푸시 없음)
크론 → notifications INSERT + sendPushToUsers (개별 구현)
```

**목표 (허브형):**
```
모든 알림 소스 → createNotification() 
  → 1. notifications 테이블 INSERT
  → 2. setAppBadge (SW 통해)
  → 3. 멀티채널 dispatch:
       ├─ 푸시 구독 있음 → 웹 푸시 발송
       ├─ 푸시 없음 + 카카오 동의 → 카카오 알림톡
       └─ 둘 다 없음 + 이메일 있음 → 이메일 발송
  → 4. Quiet Hours 체크 (새벽이면 예약 발송)
  → 5. 발송 로그 기록 (push_logs 확장)
```

### 2.2 새 파일 구조

```
src/lib/
  notification-hub.ts      ← NEW: 중앙 알림 생성/발송 허브
  push-utils.ts            ← 기존 유지 (웹 푸시 전용)
  kakao-alimtalk.ts        ← NEW: Solapi SDK 래퍼
  email-sender.ts          ← NEW: Resend 래퍼 (자동 크론용)
  email-templates.ts       ← 기존 확장 (템플릿 추가)
  notification-types.ts    ← NEW: 알림 타입/채널 상수

src/app/api/
  push/click/route.ts      ← NEW: 푸시 클릭 추적
  
src/app/api/cron/
  streak-alert/route.ts    ← NEW: 21:00 스트릭 위기 알림
  churn-prevention/route.ts ← NEW: D+3/D+7/D+14 이탈 방지
  email-digest/route.ts    ← NEW: 주간 이메일 다이제스트 (weekly-digest 대체)
```

### 2.3 삭제 대상
```
src/components/PushPromptBanner.tsx    ← 삭제
src/components/PushSubscribeButton.tsx ← 삭제
src/app/api/cron/weekly-digest/route.ts ← email-digest로 대체
```

---

## 3. DB 마이그레이션

### 3.1 notification_settings 확장

```sql
-- 알림톡/이메일 채널 설정 + Quiet Hours 보완
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS email_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS kakao_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS streak_alert boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS milestone_alert boolean DEFAULT true;

-- quiet_start/quiet_end 기본값 (현재 NULL)
UPDATE notification_settings 
SET quiet_start = '23:00', quiet_end = '07:00'
WHERE quiet_start IS NULL;
```

### 3.2 notification_dispatch_logs (신규)

```sql
-- 채널별 발송 이력 (push_logs 대체)
CREATE TABLE notification_dispatch_logs (
  id bigserial PRIMARY KEY,
  notification_id bigint REFERENCES notifications(id),
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('push', 'email', 'kakao', 'in_app')),
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'queued', 'skipped')),
  -- push 전용
  push_endpoint text,
  -- 카카오 전용  
  kakao_request_id text,
  -- 이메일 전용
  email_resend_id text,
  -- 공통
  error_message text,
  clicked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_dispatch_user_channel ON notification_dispatch_logs(user_id, channel);
CREATE INDEX idx_dispatch_created ON notification_dispatch_logs(created_at);
```

### 3.3 notifications 테이블 보강

```sql
-- 번들링 + 채널 추적용
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'system',  -- 'comment', 'like', 'follow', 'cron', 'system'
  ADD COLUMN IF NOT EXISTS ref_id text,                    -- 관련 리소스 ID (post_id, comment_id 등)
  ADD COLUMN IF NOT EXISTS bundle_key text,                -- 번들링 키 (같은 키 = 묶음)
  ADD COLUMN IF NOT EXISTS dispatched boolean DEFAULT false; -- 외부 채널 발송 완료 여부
```

---

## 4. 핵심 구현 상세

### 4.1 notification-hub.ts (중앙 허브)

```typescript
// src/lib/notification-hub.ts

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToUsers } from '@/lib/push-utils';
// import { sendKakaoAlimtalk } from '@/lib/kakao-alimtalk'; // Phase 3
// import { sendEmail } from '@/lib/email-sender';           // Phase 2

interface NotificationPayload {
  userId: string;
  type: string;           // 'comment' | 'like' | 'follow' | 'system' | 'price_alert' | ...
  content: string;        // 인앱 표시용 텍스트
  link?: string;          // 클릭 시 이동 경로
  source?: string;        // 발생 소스 (API명, 크론명)
  refId?: string;         // 관련 리소스 ID
  bundleKey?: string;     // 번들링 키
  push?: {                // 푸시 커스텀 (없으면 content에서 자동 생성)
    title: string;
    body: string;
    tag?: string;
    image?: string;
    important?: boolean;
  };
  skipPush?: boolean;      // 인앱만 (푸시 안 보냄)
  skipQuietCheck?: boolean; // Quiet Hours 무시 (긴급 알림)
}

export async function createNotification(payload: NotificationPayload): Promise<{ ok: boolean; notifId?: number }> {
  const sb = getSupabaseAdmin();
  
  try {
    // 1. 인앱 알림 INSERT
    const { data: notif, error } = await sb.from('notifications').insert({
      user_id: payload.userId,
      type: payload.type,
      content: payload.content,
      link: payload.link || '/feed',
      source: payload.source,
      ref_id: payload.refId,
      bundle_key: payload.bundleKey,
      is_read: false,
    }).select('id').single();

    if (error) { console.error('[notification-hub] INSERT failed:', error.message); return { ok: false }; }

    // 2. 외부 채널 발송 (비동기 — 실패해도 인앱은 이미 저장됨)
    if (!payload.skipPush) {
      dispatchToChannels(payload, notif.id).catch(e => 
        console.error('[notification-hub] dispatch error:', e)
      );
    }

    return { ok: true, notifId: notif.id };
  } catch (e) {
    console.error('[notification-hub]', e);
    return { ok: false };
  }
}

// 배치 생성 (크론용)
export async function createNotificationBatch(
  payloads: NotificationPayload[]
): Promise<{ ok: boolean; created: number }> {
  const sb = getSupabaseAdmin();
  
  const rows = payloads.map(p => ({
    user_id: p.userId,
    type: p.type,
    content: p.content,
    link: p.link || '/feed',
    source: p.source,
    ref_id: p.refId,
    bundle_key: p.bundleKey,
    is_read: false,
  }));

  const { data, error } = await sb.from('notifications').insert(rows).select('id, user_id');
  if (error) { console.error('[notification-hub] batch INSERT:', error.message); return { ok: false, created: 0 }; }

  // 외부 채널 발송 (푸시만 — 배치에서는 카카오/이메일 cascade 안 함)
  const userIds = [...new Set(payloads.filter(p => !p.skipPush).map(p => p.userId))];
  if (userIds.length > 0 && payloads[0].push) {
    sendPushToUsers(userIds, {
      title: payloads[0].push.title,
      body: payloads[0].push.body,
      url: payloads[0].link,
      tag: payloads[0].push.tag,
    }).catch(() => {});
  }

  return { ok: true, created: data?.length || 0 };
}

async function dispatchToChannels(payload: NotificationPayload, notifId: number) {
  const sb = getSupabaseAdmin();
  
  // Quiet Hours 체크
  if (!payload.skipQuietCheck) {
    const { data: settings } = await sb.from('notification_settings')
      .select('quiet_start, quiet_end')
      .eq('user_id', payload.userId)
      .maybeSingle();
    
    if (settings?.quiet_start && settings?.quiet_end) {
      const now = new Date();
      const kstHour = (now.getUTCHours() + 9) % 24;
      const quietStart = parseInt(settings.quiet_start.split(':')[0]);
      const quietEnd = parseInt(settings.quiet_end.split(':')[0]);
      
      const isQuiet = quietStart > quietEnd
        ? (kstHour >= quietStart || kstHour < quietEnd)   // 23:00~07:00
        : (kstHour >= quietStart && kstHour < quietEnd);  // 일반
      
      if (isQuiet) {
        await logDispatch(sb, notifId, payload.userId, 'push', 'skipped', 'quiet_hours');
        return; // Quiet Hours — 발송 안 함
      }
    }
  }

  // 옵트아웃 체크
  const { data: settings } = await sb.from('notification_settings')
    .select('*').eq('user_id', payload.userId).maybeSingle();
  
  const typeToSetting: Record<string, string> = {
    comment: 'push_comments', reply: 'push_comments',
    like: 'push_likes', post_like: 'push_likes', comment_like: 'push_likes',
    follow: 'push_follows',
    system: 'push_news',
    price_alert: 'push_stock_alert',
    apt_alert: 'push_apt_deadline',
  };
  
  const settingKey = typeToSetting[payload.type];
  if (settingKey && settings && (settings as any)[settingKey] === false) {
    await logDispatch(sb, notifId, payload.userId, 'push', 'skipped', 'opted_out');
    return;
  }

  // 채널 1: 웹 푸시
  const pushPayload = payload.push || {
    title: '카더라',
    body: payload.content.replace(/[\p{Emoji}]/gu, '').trim().slice(0, 80),
  };

  const { sent } = await sendPushToUsers([payload.userId], {
    title: pushPayload.title,
    body: pushPayload.body,
    url: payload.link || '/',
    tag: pushPayload.tag || `notif-${notifId}`,
    image: pushPayload.image,
    important: pushPayload.important,
  });

  if (sent > 0) {
    await logDispatch(sb, notifId, payload.userId, 'push', 'sent');
    return; // 푸시 성공 → cascade 중단
  }

  // 채널 2: 카카오 알림톡 (Phase 3에서 구현)
  // if (settings?.kakao_enabled !== false) {
  //   const kakaoResult = await sendKakaoAlimtalk(payload.userId, pushPayload);
  //   if (kakaoResult.ok) { await logDispatch(...); return; }
  // }

  // 채널 3: 이메일 (Phase 2에서 구현)
  // if (settings?.email_enabled !== false) {
  //   const emailResult = await sendNotificationEmail(payload.userId, pushPayload);
  //   if (emailResult.ok) { await logDispatch(...); return; }
  // }

  await logDispatch(sb, notifId, payload.userId, 'push', 'failed', 'no_subscription');
}

async function logDispatch(
  sb: any, notifId: number, userId: string,
  channel: string, status: string, error?: string
) {
  try {
    await (sb as any).from('notification_dispatch_logs').insert({
      notification_id: notifId, user_id: userId,
      channel, status, error_message: error || null,
    });
  } catch {} // 로그 실패는 무시
}
```

### 4.2 소셜 인터랙션 실시간 푸시 (Phase 1)

**comments API 수정** (DB 트리거가 알림 INSERT → 우리가 푸시만 추가):

```typescript
// src/app/api/comments/route.ts POST 핸들러 내부
// 기존 INSERT 후 추가:

// 댓글 알림은 DB 트리거(notify_on_comment)가 notifications INSERT 처리
// 여기서는 웹 푸시만 추가 발송
if (postAuthorId && postAuthorId !== user.id) {
  const { data: profile } = await admin.from('profiles')
    .select('nickname').eq('id', user.id).single();
  
  sendPushToUsers([postAuthorId], {
    title: `💬 ${profile?.nickname || '누군가'}님이 댓글을 남겼어요`,
    body: content.slice(0, 60),
    url: `/feed/${postId}`,
    tag: `comment-${postId}-${Date.now()}`,
  }).catch(() => {});
}
```

**좋아요 API 수정:**

```typescript
// src/app/api/likes/route.ts — INSERT 성공 후 추가:

// 좋아요 알림 + 푸시 (본인 글 아닐 때만)
const { data: post } = await admin.from('posts')
  .select('author_id, title').eq('id', postId).single();

if (post?.author_id && post.author_id !== user.id) {
  const { data: profile } = await admin.from('profiles')
    .select('nickname').eq('id', user.id).single();
  
  sendPushToUsers([post.author_id], {
    title: `❤️ ${profile?.nickname || '누군가'}님이 좋아요`,
    body: (post.title || '게시글').slice(0, 50),
    url: `/feed/${postId}`,
    tag: `like-${postId}`, // 같은 글 좋아요는 태그로 중복 방지
  }).catch(() => {});
}
```

**팔로우 API 수정:**

```typescript
// src/app/api/follow/route.ts — INSERT 성공 후, 기존 notifications INSERT 아래 추가:

sendPushToUsers([targetId], {
  title: `👤 ${profile?.nickname ?? '누군가'}님이 팔로우`,
  body: '프로필을 확인해보세요',
  url: `/profile/${user.id}`,
  tag: `follow-${user.id}`,
}).catch(() => {});
```

### 4.3 앱 배지 API (Phase 1)

**SW 수정 (public/sw.js):**

```javascript
// push 이벤트 핸들러에 추가:
self.addEventListener('push', e => {
  // ... 기존 코드 ...
  
  // 앱 배지 업데이트
  e.waitUntil(
    self.registration.showNotification(data.title || '카더라', options)
      .then(() => {
        if ('setAppBadge' in navigator) {
          // 미읽음 수를 payload에서 받거나, 현재 알림 수로 증가
          return navigator.setAppBadge(data.badge_count || undefined);
        }
      })
  );
});

// 알림 클릭 시 배지 리셋
self.addEventListener('notificationclick', e => {
  // ... 기존 코드 ...
  if ('clearAppBadge' in navigator) navigator.clearAppBadge();
});
```

**클라이언트 (알림 페이지 진입 시):**

```typescript
// src/app/(main)/notifications/page.tsx
// useEffect 내 알림 로드 후:
if ('clearAppBadge' in navigator) navigator.clearAppBadge();
```

### 4.4 /api/push/click (Phase 1)

```typescript
// src/app/api/push/click/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { log_id } = await req.json();
    if (!log_id) return NextResponse.json({ ok: false });

    const sb = getSupabaseAdmin();
    
    // push_logs 클릭 카운트 증가
    await sb.rpc('increment_push_click', { p_log_id: log_id });
    
    // dispatch_logs에도 기록 (Phase 2)
    // await sb.from('notification_dispatch_logs')
    //   .update({ clicked_at: new Date().toISOString() })
    //   .eq('notification_id', log_id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // 클릭 추적 실패해도 200
  }
}

// Supabase RPC:
// CREATE OR REPLACE FUNCTION increment_push_click(p_log_id bigint)
// RETURNS void AS $$
//   UPDATE push_logs SET click_count = COALESCE(click_count, 0) + 1 WHERE id = p_log_id;
// $$ LANGUAGE sql;
```

### 4.5 Quiet Hours 적용 (Phase 1)

```typescript
// src/lib/push-utils.ts 에 추가:

export async function isQuietHours(userId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('notification_settings')
    .select('quiet_start, quiet_end')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (!data?.quiet_start || !data?.quiet_end) return false;
  
  const kstHour = (new Date().getUTCHours() + 9) % 24;
  const start = parseInt(data.quiet_start.split(':')[0]);
  const end = parseInt(data.quiet_end.split(':')[0]);
  
  return start > end
    ? (kstHour >= start || kstHour < end)
    : (kstHour >= start && kstHour < end);
}
```

**각 크론에서 유저별 체크** (배치 발송이므로 유저 리스트에서 필터):

```typescript
// push-content-alert, push-daily-reminder 등에서:
import { isQuietHours } from '@/lib/push-utils';

// 발송 전 quiet 유저 필터링
const quietChecks = await Promise.all(
  userIds.map(async id => ({ id, quiet: await isQuietHours(id) }))
);
const activeUserIds = quietChecks.filter(u => !u.quiet).map(u => u.id);
```

---

## 5. 카카오 알림톡 설계 (Phase 3)

### 5.1 Solapi 연동 구조

**사전 요구사항:**
1. Solapi 회원가입 (https://solapi.com)
2. 카카오 비즈니스 채널 개설 (카카오비즈니스 센터)
3. 알림톡 템플릿 심사 (카카오 승인 필요, 3-5영업일)
4. Solapi에서 API Key 발급

**비용:** 알림톡 건당 8.4원 (VAT 별도). 100명에게 하루 1건씩 = 월 ~25,200원.

**환경변수 (Vercel에 등록):**
```
SOLAPI_API_KEY=NCSFB9M1Y0XRUS4X
SOLAPI_API_SECRET=FMPHKQZJKLKC6BZEIEHFMA6K4R0ZOLJ3
SOLAPI_SENDER_PHONE=01012345678  ← 발신번호 등록 필요
KAKAO_CHANNEL_ID=@카더라         ← 카카오 비즈 채널 개설 후
```

### 5.2 알림톡 템플릿 (카카오 심사 필요)

```
[TPL-001] 댓글 알림
#{닉네임}님, 게시글에 새 댓글이 달렸어요.
"#{댓글내용}"
👉 지금 확인하기: #{링크}

[TPL-002] 스트릭 위기
#{닉네임}님, #{일수}일 연속 출석이 끊어질 수 있어요!
오늘 출석 체크하고 보너스를 유지하세요.
👉 출석하기: #{링크}

[TPL-003] 주간 다이제스트
#{닉네임}님의 주간 투자 리포트
- 인기글 #{인기글수}개
- 청약 마감 #{마감수}건
👉 확인하기: #{링크}

[TPL-004] 이탈 방지 (D+7)
#{닉네임}님, 카더라에서 새 소식이 있어요!
놓친 인기글 #{인기글수}개, 새 청약 #{신규수}건
👉 바로가기: #{링크}
```

### 5.3 kakao-alimtalk.ts

```typescript
// src/lib/kakao-alimtalk.ts

interface AlimtalkPayload {
  phone: string;           // 수신자 전화번호 (01012345678)
  templateId: string;       // TPL-001 등
  variables: Record<string, string>;
}

export async function sendKakaoAlimtalk(payload: AlimtalkPayload): Promise<{ ok: boolean; requestId?: string }> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  if (!apiKey || !apiSecret) return { ok: false };

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${new Date().toISOString()}, salt=..., signature=...`,
      },
      body: JSON.stringify({
        message: {
          to: payload.phone,
          from: process.env.SOLAPI_SENDER_PHONE,
          kakaoOptions: {
            pfId: process.env.KAKAO_CHANNEL_ID,
            templateId: payload.templateId,
            variables: payload.variables,
          },
        },
      }),
    });

    const data = await res.json();
    return { ok: res.ok, requestId: data.groupId };
  } catch (e) {
    console.error('[kakao-alimtalk]', e);
    return { ok: false };
  }
}
```

### 5.4 전화번호 수집 전략

**현재 상태:** profiles.phone 컬럼 존재하나 대부분 NULL (카카오 OAuth가 전화번호 안 줌)

**수집 방법 (우선순위):**

1. **온보딩에서 선택적 입력** — "청약 마감 알림을 카카오톡으로 받으시겠어요?" + 전화번호 입력 필드. 마케팅 동의 + 전화번호 동시 수집
2. **알림 설정 페이지** — "카카오 알림톡 받기" 토글 + 전화번호 입력
3. **PWA 설치 불가 시 대안 제시** — iOS Safari에서 "알림을 받으려면 앱 설치 필요" 대신 "카카오톡으로 받기" 옵션

**리스크:** 전화번호 입력 거부율 높음. 초기에는 이메일 cascade에 집중하고, 카카오는 opt-in 유저만.

---

## 6. 이메일 자동화 설계 (Phase 2)

### 6.1 현재 상태
- Resend 연동 완료 (RESEND_API_KEY)
- 무료 한도: 100통/일, 3,000통/월
- 수동 admin API만 있고 자동 크론 없음
- weekly-digest 크론 있으나 이메일 안 보냄 (notifications INSERT만)

### 6.2 이메일 발송 크론 설계

**email-digest 크론 (weekly-digest 대체):**
```
스케줄: 매주 월요일 09:00 KST (0 0 * * 1)
대상: marketing_agreed = true + email_subscribers.is_active = true
내용: 주간 인기글 3개 + 청약 마감 + 종목 등락 요약
발송: Resend API (배치 10통씩, 1초 딜레이)
```

**churn-prevention 크론:**
```
스케줄: 매일 10:00 KST (0 1 * * *)
로직:
  D+3 미접속: 푸시 "놓친 인기글 3개" (푸시 구독자만)
  D+7 미접속: 이메일 re-engagement (이메일 있는 유저)
  D+14 미접속: 카카오 알림톡 (Phase 3, 전화번호 있는 유저)
  D+30 미접속: 최종 이메일 "계정 휴면 예정"
```

### 6.3 email-sender.ts

```typescript
// src/lib/email-sender.ts
import { Resend } from 'resend';

let resendInstance: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendInstance) resendInstance = new Resend(process.env.RESEND_API_KEY);
  return resendInstance;
}

export async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; id?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false };

  try {
    const { data, error } = await resend.emails.send({
      from: '카더라 <noreply@kadeora.app>',
      to,
      subject,
      html,
    });
    return { ok: !error, id: data?.id };
  } catch (e) {
    console.error('[email-sender]', e);
    return { ok: false };
  }
}
```

### 6.4 이메일 템플릿 추가

```typescript
// src/lib/email-templates.ts에 추가:

export function weeklyDigestEmail(params: {
  nickname: string;
  email: string;
  hotPosts: { title: string; slug: string }[];
  deadlines: { name: string; endDate: string }[];
  stockMovers: { name: string; change: string }[];
}): string { /* HTML 템플릿 */ }

export function streakBreakEmail(params: {
  nickname: string;
  email: string;
  streak: number;
}): string { /* HTML 템플릿 */ }

export function churnPreventionEmail(params: {
  nickname: string;
  email: string;
  daysSinceActive: number;
  hotPosts: { title: string; slug: string }[];
}): string { /* HTML 템플릿 */ }
```

---

## 7. 추가 리텐션 크론 설계 (Phase 2)

### 7.1 streak-alert (스트릭 위기 알림)

```
스케줄: 매일 21:00 KST (0 12 * * *)
대상: 오늘 출석 안 한 유저 중 streak >= 3
내용: "🔥 {streak}일 연속 출석이 끊어질 수 있어요!"
채널: 웹 푸시 (→ Phase 3에서 카카오 cascade)
중복 방지: 오늘 이미 streak-alert 보낸 유저 제외
```

### 7.2 churn-prevention (이탈 방지)

```
스케줄: 매일 10:00 KST (0 1 * * *)
로직:
  1. profiles에서 last_active_at 기준 D+3/D+7/D+14/D+30 유저 조회
  2. 이미 해당 단계 알림 받은 유저 제외 (notification_dispatch_logs)
  3. 단계별 차등 발송:
     D+3: 푸시만 → "이번 주 인기글 3개 놓치셨어요"
     D+7: 푸시 + 이메일 → re-engagement 이메일
     D+14: 푸시 + 이메일 + 카카오(P3) → "30일 미접속 시 휴면"
     D+30: 이메일만 → 최종 안내
  4. is_seed, is_ghost, is_deleted, is_banned 제외
```

### 7.3 milestone-alert (마일스톤 알림)

```
트리거: API 레벨 (크론 아님 — 조회수/좋아요 변경 시 체크)
조건:
  - 내 글 조회수 50/100/500/1000 돌파
  - 내 글 좋아요 10/50/100 돌파
  - 팔로워 10/50/100 돌파
  - 포인트 1000/5000/10000 달성
중복 방지: 각 마일스톤별 1회만 (notifications에서 bundle_key 체크)
```

---

## 8. 코드 정리 상세 계획

### 8.1 삭제

| 파일 | 이유 | 영향 범위 |
|------|------|-----------|
| `src/components/PushPromptBanner.tsx` | SmartPushPrompt가 동일 기능 + 더 많은 플랫폼 지원 | `blog/[slug]/page.tsx`에서 import 제거 |
| `src/components/PushSubscribeButton.tsx` | Sidebar 전용이었으나 SmartPushPrompt로 대체 | `Sidebar.tsx`에서 import 제거 |

### 8.2 통합/리팩토링

| 대상 | 현재 | 목표 |
|------|------|------|
| 알림 INSERT 19곳 | 직접 `sb.from('notifications').insert()` | `createNotification()` 호출로 통일 |
| push-content-alert 옵트아웃 | 체크 안 함 | `notification_settings.push_hot_post` 체크 추가 |
| weekly-digest | notifications INSERT만 | Resend 실제 이메일 발송 |
| blog-subscription-alert | 블로그 생성만, 푸시 없음 | 생성 후 `sendPushBroadcast()` 추가 |
| 출석 알림 | link 컬럼 없음 | `link: '/attendance'` 추가 |

### 8.3 마이그레이션 순서 (19곳 → createNotification)

**Phase 1에서 변경 (소셜 인터랙션 — 가장 임팩트 큼):**
- `src/app/api/follow/route.ts` — notifications INSERT + 푸시 추가
- `src/app/api/likes/route.ts` — 푸시 추가 (알림은 DB 트리거)
- `src/app/api/comments/route.ts` — 푸시 추가 (알림은 DB 트리거)

**Phase 2에서 변경 (크론 — 기존 동작 유지하면서 통합):**
- `src/app/api/cron/push-content-alert/route.ts` — 옵트아웃 체크 추가
- `src/app/api/cron/push-daily-reminder/route.ts` — Quiet Hours 체크 추가
- `src/app/api/cron/push-apt-deadline/route.ts` — Quiet Hours 체크 추가
- `src/app/api/cron/weekly-digest/route.ts` → email-digest로 대체
- `src/app/api/cron/welcome-nudge/route.ts` — 푸시 발송 추가
- `src/app/api/attendance/route.ts` — link 추가

**Phase 3에서 변경 (전체 통합):**
- 나머지 14곳 → `createNotification()` 호출로 전환
- cascade 로직 활성화 (카카오 알림톡)

---

## 9. 리스크 분석

### 9.1 기술 리스크

| 리스크 | 확률 | 영향 | 완화 전략 |
|--------|------|------|-----------|
| 소셜 푸시 추가 후 알림 폭탄 | 높음 | 유저 거부 → 구독 취소 | 쓰로틀링: 같은 유저에게 5분 내 중복 푸시 안 보냄. 좋아요는 SW tag로 중복 병합 |
| Quiet Hours 로직 버그 → 알림 전면 차단 | 중간 | 모든 알림 안 감 | 기본값 NULL = 체크 안 함 (기존 동작 유지). 설정한 유저만 적용 |
| createNotification 전환 중 알림 누락 | 중간 | 일부 알림 안 감 | Phase별 점진 전환. 각 단계 테스트 후 다음 단계 |
| Resend 무료 한도 초과 (100통/일) | 낮음 (현재 유저 수 기준) | 이메일 발송 중단 | 유저 100명 넘으면 Pro ($20/월) 전환. 현재는 무료로 충분 |
| 카카오 알림톡 템플릿 반려 | 중간 | 카카오 채널 지연 | 템플릿 사전 검토, 카카오 가이드라인 준수. 반려 시 수정 후 재심사 |
| SW 캐시 문제로 구버전 유지 | 높음 | 새 기능 (배지 등) 미적용 | CACHE_VERSION 업데이트, skipWaiting + clients.claim |

### 9.2 비즈니스 리스크

| 리스크 | 영향 | 완화 전략 |
|--------|------|-----------|
| 알림 과다 → 앱 삭제/구독취소 | 이탈 가속 | 일 최대 푸시 3건 제한. Quiet Hours 기본 적용. 옵트아웃 존중 |
| 전화번호 수집 → 개인정보 이슈 | 법적 리스크 | 개인정보처리방침 업데이트. 마케팅 동의 별도 수집. 암호화 저장 |
| 카카오 알림톡 비용 증가 | 월 비용 증가 | 초기 opt-in 유저만. 하루 1건 제한. 월 예산 상한 설정 |

### 9.3 롤백 계획

| Phase | 롤백 방법 |
|-------|-----------|
| Phase 1 (소셜 푸시) | `sendPushToUsers` 호출 제거만 하면 됨 (기존 알림 INSERT는 유지) |
| Phase 1 (앱 배지) | SW의 setAppBadge 호출 제거 (기능 없던 상태로 복원) |
| Phase 2 (이메일 크론) | vercel.json에서 크론 비활성화 |
| Phase 3 (카카오) | SOLAPI_API_KEY 환경변수 제거 → sendKakaoAlimtalk()가 즉시 return |

---

## 10. 비용 분석

### 10.1 월 비용 추정 (유저 100명 기준)

| 항목 | 비용 | 비고 |
|------|------|------|
| 웹 푸시 (3건/일) | ₩0 | VAPID 자체 인프라 (무료, 무제한) |
| Resend 이메일 (1건/일) | ₩0 | 무료 (100통/일 × 30일 = 3,000통 한도 내) |
| Solapi 알림톡 (1건/일) | ~₩2,500/월 | 100명 × 1회/일 × 30일 × 8.4원 × 30% cascade 비율 |
| Vercel 크론 | ₩0 | Pro 플랜 포함 (이미 사용 중) |
| **합계** | **~₩2,500/월** | 카카오는 푸시 실패 시에만 cascade → 실제 30% 이하 |

### 10.2 유저 1,000명 도달 시

| 항목 | 비용 |
|------|------|
| 웹 푸시 | ₩0 |
| Resend Pro (100통/일 초과 시) | $20/월 (~₩27,000) |
| Solapi 알림톡 | ~₩25,000/월 (1,000명 × 30% cascade × 8.4원) |
| **합계** | **~₩52,000/월** |

---

## 11. 테스트 계획

### 11.1 Phase 1 테스트

```
[ ] 댓글 작성 → 글 작성자에게 웹 푸시 도착 확인
[ ] 좋아요 → 글 작성자에게 웹 푸시 도착 확인
[ ] 같은 글 좋아요 반복 → 푸시 1건만 (SW tag 중복 방지)
[ ] 팔로우 → 대상자에게 웹 푸시 도착 확인
[ ] 본인 글에 댓글/좋아요 → 푸시 안 감 확인
[ ] 앱 배지: 푸시 수신 → PWA 아이콘에 배지 표시
[ ] 앱 배지: 알림 페이지 방문 → 배지 클리어
[ ] /api/push/click: SW 클릭 → 200 응답 + push_logs.click_count 증가
[ ] Quiet Hours: 23:00~07:00 설정 유저 → 새벽 크론에서 푸시 안 감
[ ] PushPromptBanner 삭제 후 blog/[slug] 정상 렌더링
[ ] push-content-alert: notification_settings.push_hot_post=false 유저 제외 확인
```

### 11.2 Phase 2 테스트

```
[ ] streak-alert: 21:00 크론 → streak≥3 + 오늘 출석 안 한 유저에게 푸시
[ ] churn-prevention D+3: 3일 미접속 유저 → 푸시
[ ] churn-prevention D+7: 7일 미접속 유저 → 이메일 발송
[ ] email-digest: 월요일 09:00 → 마케팅 동의 유저에게 이메일
[ ] 이메일 수신거부 링크 정상 동작
[ ] Resend 일일 한도 100통 근처 → 배치 딜레이 확인
```

### 11.3 Phase 3 테스트

```
[ ] Solapi API 연결 테스트 (테스트 전화번호)
[ ] 알림톡 템플릿 변수 치환 확인
[ ] 푸시 실패 → 카카오 cascade 동작
[ ] 전화번호 미등록 유저 → 이메일 cascade
[ ] 일일 알림톡 발송량 제한 확인
```

---

## 12. 실행 타임라인

### Phase 1 — 즉시 (3.5시간)
1. **소셜 실시간 알림 + 번들링 설계** — comments/likes/follow API에서 notifications INSERT 시 `bundle_key` + `skipPush` 적용 (30분)
2. **pending-notification-dispatch 크론** — 2분마다 번들링 + 푸시 발송 (45분)
3. **앱 배지 API** — SW + 알림 페이지 수정 (20분)
4. **/api/push/click** 엔드포인트 생성 + RPC (15분)
5. **Quiet Hours** — push-utils에 체크 함수 + 3개 크론 적용 (30분)
6. **일일 푸시 상한 5건** — dispatch 전 카운트 체크 (10분)
7. **push-content-alert** 옵트아웃 + 이미지 추가 (15분)
8. **PushPromptBanner 삭제** + blog/[slug] import 정리 (10분)
9. **출석 알림 link 추가 + blog-subscription-alert 푸시 추가** (15분)
10. **테스트 + 커밋 + 배포** (30분)

### Phase 2 — 이번 주 (5.5시간)
0. **[선행] Resend 도메인 DNS 인증** — SPF/DKIM/DMARC 레코드 등록 (Hostinger DNS) (15분)
1. **DB 마이그레이션** — notification_settings 확장 + dispatch_logs + notifications 보강 (30분)
2. **notification-hub.ts** 생성 (cascade 레벨 분기 포함) (1시간)
3. **streak-alert 크론** 생성 (45분)
4. **churn-prevention 크론** 생성 (D+3 푸시 / D+7 이메일 / D+14 전채널) (1시간)
5. **email-digest 크론** (weekly-digest 대체 + Resend 실제 발송) (45분)
6. **email-templates.ts** 템플릿 3종 추가 + 수신거부 링크 포함 (30분)
7. **테스트 + 배포** (30분)

### Phase 3 — 다음 주 (8.5시간)
0. **[선행] 개인정보처리방침 업데이트** — 전화번호 수집 항목/목적/보유기간 추가 (30분)
1. **Solapi 회원가입 + API 키 발급** (30분)
2. **카카오 비즈 채널 개설 + 알림톡 템플릿 4종 심사 제출** (1시간)
3. **kakao-alimtalk.ts** 구현 + 카카오 수신거부 API (1시간)
4. **전화번호 수집 UI** — 알림 설정 페이지 + iOS Safari 대체 제안 (1.5시간)
5. **notification-hub cascade 로직** 활성화 (urgent/routine/critical 분기) (1시간)
6. **19곳 알림 INSERT → createNotification 전환** (1.5시간)
7. **PushSubscribeButton 삭제** + Sidebar 정리 (15분)
8. **전체 테스트 + 배포** (1시간)

---

## 13. 설계안 보완 — 초판에서 빠진 것들

### 13.1 좋아요 번들링 (알림 폭탄 방지)

**문제:** 인기글에 좋아요 50개 → 현재 설계(SW tag)는 마지막 1건만 표시. "OO님 외 49명" 번들링이 없음.

**해결 — 2단계 접근:**

```
[즉시] API에서 notifications INSERT (기존 DB 트리거 유지)
       + 푸시는 즉시 안 보냄 (skipPush: true)

[2분 후] pending-notification-dispatch 크론 (매 2분)
         → 같은 bundle_key를 가진 알림 그룹핑
         → "OO님 외 N명이 좋아요를 눌렀어요" 1건으로 합쳐서 푸시
         → dispatched = true 마킹
```

**bundle_key 규칙:**
```
좋아요: like:{postId}:{날짜}
댓글:   comment:{postId}:{날짜}  
팔로우: follow:{userId}:{날짜}
```

**크론:**
```
이름: pending-notification-dispatch
스케줄: */2 * * * * (2분마다)
로직:
  1. dispatched=false인 알림 조회 (2분 이상 경과)
  2. bundle_key 기준 그룹핑
  3. 그룹 크기 1 → 단건 푸시
  4. 그룹 크기 2+ → "OO님 외 N명" 번들 푸시
  5. dispatched=true로 업데이트
maxDuration: 15
```

**이 방식의 장점:**
- API 레이턴시 증가 없음 (푸시를 API에서 안 보냄)
- 자연스러운 번들링 (2분 윈도우)
- 19곳 API 수정 최소화 (skipPush만 추가)

### 13.2 일일 푸시 빈도 상한

**문제:** 유저가 하루에 푸시 10개 이상 받으면 "성가시다" → 구독 취소

**해결:**
```typescript
// notification-hub.ts dispatchToChannels() 최상단에 추가:

// 채널별 일일 상한: 웹 푸시 3건(무료), 카카오 1건(유료), 이메일 1건(무료)
const MAX_DAILY_PUSH = 3;
const todayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';
const { count } = await sb.from('notification_dispatch_logs')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', payload.userId)
  .eq('channel', 'push')
  .eq('status', 'sent')
  .gte('created_at', todayStart);

if ((count ?? 0) >= MAX_DAILY_PUSH) {
  await logDispatch(sb, notifId, userId, 'push', 'skipped', 'daily_limit');
  return; // 이메일/카카오로 cascade하지 않음 — 하루 초과는 내일 인앱에서 확인
}
```

### 13.3 이메일 deliverability (DNS 인증)

**문제:** Resend에서 noreply@kadeora.app으로 보내려면 DNS에 SPF/DKIM/DMARC 레코드 필수. 없으면 Gmail/Naver에서 스팸 처리.

**Phase 2 사전 작업 (필수):**
```
1. Resend 대시보드 → Domains → kadeora.app 추가
2. 제공되는 DNS 레코드 3개를 Hostinger DNS에 등록:
   - SPF:   TXT  v=spf1 include:amazonses.com ~all
   - DKIM:  CNAME  resend._domainkey → 제공값
   - DMARC: TXT  v=DMARC1; p=none; rua=mailto:...
3. Resend에서 도메인 검증 완료 확인
4. 검증 전까지 이메일 발송 하면 안 됨 (스팸 평판 손상)
```

**이거 안 하면 Phase 2 이메일 자동화 전체가 무의미.** 스팸함으로 가는 이메일은 없는 것보다 나쁨 (도메인 평판 하락).

### 13.4 Cascade 순서 최적화

**초판 설계:** Push → Kakao → Email (고정)

**수정 — 상황별 분기:**
```
[긴급/소셜] 댓글, 좋아요, 팔로우, 스트릭 위기, 가격 알림
  → Push → Kakao(8.4원) → Email
  이유: 즉시 반응이 중요. 카카오 오픈율 60-80% >> 이메일 15-20%

[루틴] 주간 다이제스트, 콘텐츠 추천, 마케팅
  → Push → Email → (Kakao 안 보냄)
  이유: 긴급하지 않고, 이메일이 무료. 카카오 비용 절약

[위험] D+7 이탈 방지, D+14 최종 경고
  → Push → Kakao → Email (전 채널)
  이유: 유저 복귀가 비용보다 가치 있음
```

**구현:**
```typescript
type CascadeLevel = 'urgent' | 'routine' | 'critical';

// notification-hub.ts
const NOTIFICATION_CASCADE: Record<string, CascadeLevel> = {
  comment: 'urgent', like: 'urgent', follow: 'urgent',
  price_alert: 'urgent', streak_alert: 'urgent',
  system: 'routine', weekly_digest: 'routine',
  churn_d7: 'critical', churn_d14: 'critical',
};
```

### 13.5 Supabase DB Webhook 대안 검토

**현재 설계:** 19곳 API에서 createNotification() 직접 호출
**대안:** notifications INSERT 트리거 → DB Webhook → /api/notification-dispatch

| 항목 | API 직접 호출 (현재) | DB Webhook |
|------|---------------------|------------|
| API 수정 | 19곳 | 0곳 |
| DB 트리거 알림 커버 | ❌ 별도 처리 필요 | ✅ 자동 커버 |
| 푸시 payload 커스텀 | ✅ 자유 | ⚠️ notifications 컬럼에 의존 |
| 안정성 | ✅ 동기적 | ⚠️ Webhook 실패 시 재시도 불확실 |
| 디버깅 | ✅ API 로그에서 추적 | ⚠️ Webhook 로그 별도 확인 |
| 레이턴시 | ⚠️ API 응답 약간 느려짐 | ✅ 비동기 (API 영향 없음) |

**결론:** 현재 규모(유저 100명)에서는 **API 직접 호출이 안전**. DB Webhook은 유저 1,000명+ 이후 마이그레이션 고려. 단, 번들링 크론(pending-notification-dispatch) 도입하면 API에서 푸시 안 보내므로 레이턴시 문제 해소.

### 13.6 푸시 이미지 활용

**현재:** SW가 `data.image` 지원하지만 어떤 크론도 이미지 안 보냄.

**개선 (Phase 2):**
```typescript
// push-content-alert에서 블로그 추천 시:
sendPushToUsers(userIds, {
  title: `📈 ${topPost.title}`.slice(0, 60),
  body: '새 분석이 올라왔어요',
  url: `/blog/${topPost.slug}`,
  image: `https://kadeora.app/api/og?title=${encodeURIComponent(topPost.title)}&category=${topPost.category}&design=2`,
  tag: 'content-alert',
});
```

Android/Desktop에서 이미지 포함 푸시의 CTR이 이미지 없는 것 대비 **2-3배** 높음.

### 13.7 개인정보보호법 준수 체크리스트

**전화번호 수집 시 (Phase 3):**
```
[ ] 개인정보처리방침에 "전화번호" 수집 항목 추가
[ ] 수집 목적: "카카오 알림톡 발송" 명시
[ ] 보유 기간 명시
[ ] marketing_agreed 별도 동의 (정보통신망법 제50조)
[ ] 이메일/알림톡에 수신거부 링크 필수 포함
[ ] 야간 마케팅(21:00~08:00) 별도 동의 또는 발송 금지
```

**현재 /api/unsubscribe가 이메일만 처리** → 카카오 수신거부도 추가 필요.

### 13.8 FCM 전환 불필요 판단 근거

| 항목 | Web Push (현재) | FCM |
|------|----------------|-----|
| 비용 | 무료 | 무료 |
| Android 배달 보장 | ⚠️ 간헐적 누락 | ✅ Google 인프라 |
| iOS 지원 | PWA 필수 (16.4+) | APNs 브릿지 (네이티브) |
| 전환 비용 | - | SW + 구독 전체 재작성 (2-3일) |
| 유지보수 | 자체 관리 | Firebase 의존 |

**결론:** 현재 규모에서 FCM 전환은 ROI 없음. 유저 5,000명+ 이후 Android 배달 누락이 눈에 보이면 재검토.

---

## 14. 성공 지표

| 지표 | 현재 | Phase 1 목표 | Phase 3 목표 |
|------|------|-------------|-------------|
| 푸시 클릭률 (CTR) | 측정 불가 | 5%+ | 8%+ |
| D7 리텐션 | 측정 중 | +10%p | +25%p |
| 알림 채널 도달률 | ~20% (푸시만) | ~25% | ~80% (멀티채널) |
| 일일 재방문율 | 측정 중 | +15% | +30% |
| 출석 스트릭 유지율 | 측정 중 | +20% (streak alert) | +35% |
