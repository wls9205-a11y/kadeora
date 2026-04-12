import { NextRequest, NextResponse } from 'next/server';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { sendPushToUsers, filterActiveUsers } from '@/lib/push-utils';

export const maxDuration = 60;

/**
 * churn-prevention — 매일 10:00 KST (0 1 * * *)
 * 
 * D+3: 푸시 "놓친 인기글 3개" (무료)
 * D+7: 푸시 + 이메일 re-engagement (무료)
 * D+14: 전 채널 "30일 미접속 시 휴면" (카카오는 Phase 3)
 * 
 * 각 단계 1회만 (중복 방지)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await withCronLogging('churn-prevention', async () => {
    const sb = getSupabaseAdmin();
    const now = Date.now();
    let d3Sent = 0, d7Sent = 0, d14Sent = 0;

    // 실유저 (시드/고스트/삭제 제외)
    const { data: users } = await sb.from('profiles')
      .select('id, nickname, last_active_at')
      .neq('is_seed', true).neq('is_ghost', true).neq('is_deleted', true)
      .not('last_active_at', 'is', null);

    if (!users?.length) return { processed: 0 };

    // 인기글 (알림 내용용)
    const weekAgo = new Date(now - 7 * 86400000).toISOString();
    const { data: hotPosts } = await sb.from('blog_posts')
      .select('title, slug')
      .eq('is_published', true)
      .gte('published_at', weekAgo)
      .order('view_count', { ascending: false })
      .limit(3);
    const hotTitle = hotPosts?.[0]?.title?.slice(0, 30) || '새 분석';

    // 단계별 유저 분류
    const d3Users: string[] = [];
    const d7Users: { id: string; nickname: string }[] = [];
    const d14Users: { id: string; nickname: string }[] = [];

    for (const u of users) {
      if (!u.last_active_at) continue;
      const daysSince = Math.floor((now - new Date(u.last_active_at).getTime()) / 86400000);
      if (daysSince >= 3 && daysSince < 5) d3Users.push(u.id);
      else if (daysSince >= 7 && daysSince < 9) d7Users.push({ id: u.id, nickname: u.nickname || '회원' });
      else if (daysSince >= 14 && daysSince < 16) d14Users.push({ id: u.id, nickname: u.nickname || '회원' });
    }

    // ═══ D+3: 푸시 알림 ═══
    if (d3Users.length > 0) {
      // 이미 D+3 알림 받은 유저 제외
      const { data: sent } = await (sb as any).from('notifications')
        .select('user_id').in('user_id', d3Users)
        .ilike('content', '%놓치셨어요%');
      const sentIds = new Set((sent || []).map((n: any) => n.user_id));
      const newD3 = d3Users.filter(id => !sentIds.has(id));

      if (newD3.length > 0) {
        const activeD3 = await filterActiveUsers(newD3, 'push_news');
        if (activeD3.length > 0) {
          await (sb as any).from('notifications').insert(
            activeD3.map(uid => ({
              user_id: uid, type: 'system',
              content: `📰 이번 주 인기글 ${hotPosts?.length || 0}개 놓치셨어요! "${hotTitle}..."`,
              link: '/blog', is_read: false,
            }))
          );
          const { sent: pushSent } = await sendPushToUsers(activeD3, {
            title: '📰 놓친 인기글이 있어요',
            body: `"${hotTitle}..." 외 ${(hotPosts?.length || 1) - 1}개`,
            url: '/blog', tag: 'churn-d3',
          });
          d3Sent = pushSent;
        }
      }
    }

    // ═══ D+7: 푸시 + 이메일 ═══
    if (d7Users.length > 0) {
      const d7Ids = d7Users.map(u => u.id);
      const { data: sent } = await (sb as any).from('notifications')
        .select('user_id').in('user_id', d7Ids)
        .ilike('content', '%보고 싶었어요%');
      const sentIds = new Set((sent || []).map((n: any) => n.user_id));
      const newD7 = d7Users.filter(u => !sentIds.has(u.id));

      if (newD7.length > 0) {
        // 알림
        await (sb as any).from('notifications').insert(
          newD7.map(u => ({
            user_id: u.id, type: 'system',
            content: `💌 ${u.nickname}님, 보고 싶었어요! 새 청약·종목 분석이 기다리고 있어요`,
            link: '/feed', is_read: false,
          }))
        );

        // 푸시
        const activeD7 = await filterActiveUsers(newD7.map(u => u.id), 'push_news');
        if (activeD7.length > 0) {
          await sendPushToUsers(activeD7, {
            title: '💌 카더라에서 새 소식이 있어요',
            body: '새 청약·종목 분석을 확인해보세요',
            url: '/feed', tag: 'churn-d7',
          });
        }

        // 이메일 (Resend)
        try {
          const { sendNotificationEmail } = await import('@/lib/email-sender');
          for (const u of newD7.slice(0, 20)) { // 일일 한도 고려, 최대 20명
            const { data: authUser } = await sb.auth.admin.getUserById(u.id);
            if (authUser?.user?.email) {
              await sendNotificationEmail(
                authUser.user.email,
                `${u.nickname}님, 놓치고 있는 투자 정보가 있어요 📊`,
                `<p style="font-size:14px;color:#E2E8F0;margin:0 0 16px;">${u.nickname}님, 안녕하세요! 👋</p>
                <p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.7;">카더라에 새로운 분석과 청약 정보가 기다리고 있어요.</p>
                <div style="text-align:center;margin:20px 0;">
                  <a href="https://kadeora.app/feed?utm_source=email&utm_medium=churn&utm_campaign=d7" style="display:inline-block;padding:12px 32px;border-radius:10px;background:#FEE500;color:#191919;font-size:14px;font-weight:800;text-decoration:none;">카더라 바로가기 →</a>
                </div>`
              );
              d7Sent++;
            }
          }
        } catch (e) { console.error('[churn-d7-email]', e); }
      }
    }

    // ═══ D+14: 전 채널 ═══
    if (d14Users.length > 0) {
      const d14Ids = d14Users.map(u => u.id);
      const { data: sent } = await (sb as any).from('notifications')
        .select('user_id').in('user_id', d14Ids)
        .ilike('content', '%휴면%');
      const sentIds = new Set((sent || []).map((n: any) => n.user_id));
      const newD14 = d14Users.filter(u => !sentIds.has(u.id));

      if (newD14.length > 0) {
        await (sb as any).from('notifications').insert(
          newD14.map(u => ({
            user_id: u.id, type: 'system',
            content: `⚠️ ${u.nickname}님, 30일 미접속 시 계정이 휴면 처리될 수 있어요. 지금 확인하세요!`,
            link: '/feed', is_read: false,
          }))
        );

        // 푸시 + 이메일 동시
        const activeD14 = await filterActiveUsers(newD14.map(u => u.id), 'push_news');
        if (activeD14.length > 0) {
          await sendPushToUsers(activeD14, {
            title: '⚠️ 계정 휴면 예정 안내',
            body: '30일 미접속 시 일부 기능이 제한됩니다',
            url: '/feed', tag: 'churn-d14', important: true,
          });
        }
        d14Sent = newD14.length;
      }
    }

    return {
      processed: d3Sent + d7Sent + d14Sent,
      metadata: {
        d3: { eligible: d3Users.length, sent: d3Sent },
        d7: { eligible: d7Users.length, sent: d7Sent },
        d14: { eligible: d14Users.length, sent: d14Sent },
      },
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
