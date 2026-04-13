import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendNotificationEmail } from '@/lib/email-sender';
import {
  welcomeBody,
  onboardingGuideBody,
  weeklyDigestBody,
  contentRecommendBody,
} from '@/lib/email-templates';

export const maxDuration = 120;

interface QueueItem {
  userId: string;
  email: string;
  nickname: string;
  campaign: string;
  subject: string;
  body: string;
  priority: number;
}

/**
 * email-scheduler — 매일 07:00 KST (0 22 * * *)
 * 
 * 통합 이메일 스케줄러: 우선순위 큐로 매일 100통 풀가동
 * 
 * P1: 청약 마감 D-3 알림
 * P2: 가입 환영 (D+0~1)
 * P3: D+3 기능 안내
 * P4: 주간 리포트 (월요일)
 * P5: 이탈 방지 D+7
 * P6: 이탈 방지 D+30
 * P9: 콘텐츠 추천 (잔여 한도 채우기)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('email-scheduler', async () => {
    const sb = getSupabaseAdmin();
    const now = Date.now();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    // ── 오늘 잔여 한도 ──
    const { count: sentToday } = await (sb as any).from('email_send_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart)
      .eq('status', 'sent');
    const dailyLimit = 95; // 100중 5통은 notification-hub 예비
    const remaining = dailyLimit - (sentToday || 0);
    if (remaining <= 0) {
      return { processed: 0, metadata: { reason: 'daily_limit_reached', sentToday } };
    }

    // ── 전체 실유저 + 이메일 조회 ──
    const { data: profiles } = await sb.from('profiles')
      .select('id, nickname, interests, created_at, last_active_at, marketing_agreed')
      .neq('is_seed', true).neq('is_deleted', true);
    if (!profiles?.length) return { processed: 0, metadata: { reason: 'no_users' } };

    // auth.users에서 이메일 매핑 (배치)
    const emailMap = new Map<string, string>();
    for (let page = 1; page <= 5; page++) {
      const { data: { users } } = await sb.auth.admin.listUsers({ page, perPage: 100 } as any);
      if (!users?.length) break;
      for (const u of users) if (u.email) emailMap.set(u.id, u.email);
      if (users.length < 100) break;
    }

    // ── 오늘 이미 발송한 campaign+email 조합 ──
    const { data: sentLogs } = await (sb as any).from('email_send_logs')
      .select('campaign, recipient_email')
      .gte('created_at', new Date(now - 7 * 86400000).toISOString())
      .eq('status', 'sent');
    const sentSet = new Set((sentLogs || []).map((l: any) => `${l.campaign}:${l.recipient_email}`));

    const queue: QueueItem[] = [];

    // ── P1: 청약 마감 D-3 알림 ──
    try {
      const d3 = new Date(now + 3 * 86400000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const { data: deadlines } = await (sb as any).from('apt_subscriptions')
        .select('house_nm, rcept_endde')
        .gte('rcept_endde', today).lte('rcept_endde', d3)
        .order('rcept_endde').limit(5);
      if (deadlines?.length) {
        const { data: watchUsers } = await (sb as any).from('apt_watchlist')
          .select('user_id').limit(50);
        const watchIds = new Set((watchUsers || []).map((w: any) => w.user_id));
        for (const p of profiles) {
          if (!watchIds.has(p.id)) continue;
          const email = emailMap.get(p.id);
          if (!email || sentSet.has(`apt-deadline:${email}`)) continue;
          const items = deadlines.map((d: any) => `${d.house_nm} (~${d.rcept_endde?.slice(5)})`).join(', ');
          queue.push({
            userId: p.id, email, nickname: p.nickname || '회원',
            campaign: 'apt-deadline', priority: 1,
            subject: `🏠 청약 마감 임박: ${deadlines[0].house_nm}`,
            body: `<p style="font-size:15px;color:#1E293B;margin:0 0 12px;">${p.nickname || '회원'}님, 관심 단지 청약이 곧 마감됩니다!</p>
              <p style="font-size:14px;color:#DC2626;font-weight:500;margin:0 0 16px;">마감 임박: ${items}</p>
              <div style="text-align:center;"><a href="https://kadeora.app/apt?utm_source=email&utm_medium=deadline" style="display:inline-block;padding:12px 36px;border-radius:10px;background:#3B7BF6;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">청약 일정 확인 →</a></div>`,
          });
        }
      }
    } catch {}

    // ── P2: 가입 환영 (24시간 이내 가입) ──
    const yesterday = new Date(now - 24 * 3600000).toISOString();
    const twoDaysAgo = new Date(now - 48 * 3600000).toISOString();
    for (const p of profiles) {
      if (p.created_at < twoDaysAgo || p.created_at > yesterday) continue; // D+1 (24~48h)
      const email = emailMap.get(p.id);
      if (!email || sentSet.has(`welcome:${email}`)) continue;
      queue.push({
        userId: p.id, email, nickname: p.nickname || '회원',
        campaign: 'welcome', priority: 2,
        subject: `${p.nickname || '회원'}님, 카더라에 오신 걸 환영합니다! 🎉`,
        body: welcomeBody({ nickname: p.nickname || '회원' }),
      });
    }

    // ── P3: D+3 기능 안내 ──
    const d3Start = new Date(now - 4 * 86400000).toISOString();
    const d3End = new Date(now - 3 * 86400000).toISOString();
    for (const p of profiles) {
      if (p.created_at < d3Start || p.created_at > d3End) continue;
      const email = emailMap.get(p.id);
      if (!email || sentSet.has(`onboarding-d3:${email}`)) continue;
      queue.push({
        userId: p.id, email, nickname: p.nickname || '회원',
        campaign: 'onboarding-d3', priority: 3,
        subject: `${p.nickname || '회원'}님, 이런 기능 써보셨나요? 💡`,
        body: onboardingGuideBody({ nickname: p.nickname || '회원', interests: p.interests || ['apt'] }),
      });
    }

    // ── P4: 주간 리포트 (월요일만) ──
    const dayOfWeek = new Date().getUTCDay(); // 0=Sun, UTC 22시 = KST 월요일 07시
    // UTC 기준 일요일 22시 = KST 월요일 07시
    const isMonday = dayOfWeek === 0; // GET 호출 시점 UTC 일요일 22시 = KST 월 7시
    if (isMonday) {
      try {
        const weekAgo = new Date(now - 7 * 86400000).toISOString();
        const [hotPosts, deadlines, newBlogs] = await Promise.all([
          sb.from('posts').select('title, slug, likes_count')
            .gte('created_at', weekAgo).order('likes_count', { ascending: false }).limit(3),
          (sb as any).from('apt_subscriptions').select('house_nm, rcept_endde')
            .gte('rcept_endde', new Date().toISOString().slice(0, 10))
            .lte('rcept_endde', new Date(now + 7 * 86400000).toISOString().slice(0, 10))
            .order('rcept_endde').limit(5),
          sb.from('blog_posts').select('title, slug, category')
            .eq('is_published', true).gte('published_at', weekAgo)
            .order('view_count', { ascending: false }).limit(3),
        ]);
        const body = weeklyDigestBody({
          hotPosts: (hotPosts.data || []) as any[],
          deadlines: (deadlines.data || []) as any[],
          newBlogs: (newBlogs.data || []) as any[],
        });
        for (const p of profiles) {
          const email = emailMap.get(p.id);
          if (!email || sentSet.has(`weekly-digest:${email}`)) continue;
          // 7일 내 활성 유저에게만 (30일+ 비활성은 제외)
          if (p.last_active_at && now - new Date(p.last_active_at).getTime() > 30 * 86400000) continue;
          queue.push({
            userId: p.id, email, nickname: p.nickname || '회원',
            campaign: 'weekly-digest', priority: 4,
            subject: `${p.nickname || '회원'}님의 주간 투자 리포트 📊`,
            body,
          });
        }
      } catch {}
    }

    // ── P5: 이탈 방지 D+7 ──
    for (const p of profiles) {
      if (!p.last_active_at) continue;
      const days = Math.floor((now - new Date(p.last_active_at).getTime()) / 86400000);
      if (days < 7 || days > 9) continue;
      const email = emailMap.get(p.id);
      if (!email || sentSet.has(`churn-d7:${email}`)) continue;
      queue.push({
        userId: p.id, email, nickname: p.nickname || '회원',
        campaign: 'churn-d7', priority: 5,
        subject: `${p.nickname || '회원'}님, 새 분석이 기다리고 있어요 📊`,
        body: `<p style="font-size:15px;color:#1E293B;margin:0 0 12px;">${p.nickname || '회원'}님, 안녕하세요!</p>
          <p style="font-size:14px;color:#64748B;line-height:1.7;margin:0 0 20px;">카더라에 새로운 분석과 청약 정보가 기다리고 있어요.</p>
          <div style="text-align:center;"><a href="https://kadeora.app/feed?utm_source=email&utm_medium=churn&utm_campaign=d7" style="display:inline-block;padding:12px 36px;border-radius:10px;background:#3B7BF6;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">카더라 바로가기 →</a></div>`,
      });
    }

    // ── P6: 이탈 방지 D+30 ──
    for (const p of profiles) {
      if (!p.last_active_at) continue;
      const days = Math.floor((now - new Date(p.last_active_at).getTime()) / 86400000);
      if (days < 30 || days > 32) continue;
      const email = emailMap.get(p.id);
      if (!email || sentSet.has(`churn-d30:${email}`)) continue;
      queue.push({
        userId: p.id, email, nickname: p.nickname || '회원',
        campaign: 'churn-d30', priority: 6,
        subject: `${p.nickname || '회원'}님, 혹시 놓치셨나요?`,
        body: `<p style="font-size:15px;color:#1E293B;margin:0 0 12px;">${p.nickname || '회원'}님, 오랜만이에요!</p>
          <p style="font-size:14px;color:#64748B;line-height:1.7;margin:0 0 20px;">그동안 카더라에 많은 변화가 있었어요. 새 청약 일정과 종목 분석을 확인해보세요.</p>
          <div style="text-align:center;"><a href="https://kadeora.app/feed?utm_source=email&utm_medium=churn&utm_campaign=d30" style="display:inline-block;padding:12px 36px;border-radius:10px;background:#3B7BF6;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">카더라 다시 방문 →</a></div>`,
      });
    }

    // ── P9: 콘텐츠 추천 (잔여 한도 채우기) ──
    const p1to8Count = queue.length;
    const p9Slots = Math.max(0, remaining - p1to8Count);
    if (p9Slots > 0) {
      // 이번 주 인기 블로그
      const weekAgo = new Date(now - 7 * 86400000).toISOString();
      const { data: hotBlogs } = await sb.from('blog_posts')
        .select('title, slug, category, view_count')
        .eq('is_published', true)
        .gte('published_at', weekAgo)
        .order('view_count', { ascending: false })
        .limit(10);

      // 7일 이내 content-recommend 안 보낸 유저
      const eligible = profiles.filter(p => {
        const email = emailMap.get(p.id);
        if (!email) return false;
        if (sentSet.has(`content-recommend:${email}`)) return false;
        // 이미 다른 캠페인에 포함된 유저 제외
        if (queue.some(q => q.userId === p.id)) return false;
        return true;
      });

      // 셔플해서 매일 다른 유저에게
      const shuffled = eligible.sort(() => Math.random() - 0.5);
      const aptPosts = (hotBlogs || []).filter((b: any) => b.category === 'apt').slice(0, 3);
      const stockPosts = (hotBlogs || []).filter((b: any) => b.category === 'stock' || b.category === 'finance').slice(0, 3);
      const allPosts = (hotBlogs || []).slice(0, 3);

      for (const p of shuffled.slice(0, p9Slots)) {
        const email = emailMap.get(p.id);
        if (!email) continue;
        const interests = p.interests || [];
        const posts = interests.includes('apt') ? (aptPosts.length ? aptPosts : allPosts)
          : interests.includes('stock') ? (stockPosts.length ? stockPosts : allPosts)
          : allPosts;
        if (!posts.length) continue;
        queue.push({
          userId: p.id, email, nickname: p.nickname || '회원',
          campaign: 'content-recommend', priority: 9,
          subject: `${p.nickname || '회원'}님을 위한 이번 주 추천 📌`,
          body: contentRecommendBody({ nickname: p.nickname || '회원', posts: posts as any }),
        });
      }
    }

    // ── 우선순위 정렬 + 100건 컷 ──
    queue.sort((a, b) => a.priority - b.priority);
    const toSend = queue.slice(0, remaining);

    // ── 순차 발송 (550ms 간격) ──
    let sent = 0, failed = 0;
    const results: Record<string, number> = {};

    for (const item of toSend) {
      try {
        const r = await sendNotificationEmail(item.email, item.subject, item.body);
        await (sb as any).from('email_send_logs').insert({
          campaign: item.campaign,
          recipient_email: item.email,
          user_id: item.userId,
          subject: item.subject,
          status: r.ok ? 'sent' : 'failed',
          resend_id: r.id || null,
          error_message: r.ok ? null : 'send_failed',
        }).catch(() => {});

        if (r.ok) {
          sent++;
          results[item.campaign] = (results[item.campaign] || 0) + 1;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      // Resend rate limit: 초당 2건 → 550ms 간격 (안전)
      await new Promise(r => setTimeout(r, 550));
    }

    return {
      processed: toSend.length,
      created: sent,
      failed,
      metadata: {
        sentToday: (sentToday || 0) + sent,
        remaining: remaining - sent,
        queueTotal: queue.length,
        p1to8: p1to8Count,
        p9: queue.length - p1to8Count,
        results,
      },
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
