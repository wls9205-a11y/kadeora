import { NextRequest, NextResponse } from 'next/server';
import { sendPushBroadcast } from '@/lib/push-utils';

export const maxDuration = 30;

/**
 * 테스트 푸시 발송 — 관리자 전용
 * GET /api/admin/test-push?token=CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sent, failed } = await sendPushBroadcast({
      title: '🔔 카더라 알림 테스트',
      body: '푸시 알림이 정상 작동합니다!',
      url: '/notifications/settings',
      tag: 'test-push',
    });

    return NextResponse.json({ ok: true, sent, failed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
