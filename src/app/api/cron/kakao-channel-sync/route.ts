import { NextRequest, NextResponse } from 'next/server';
import { withCronAuthFlex } from '@/lib/cron-auth';
import { withCronLogging } from '@/lib/cron-logger';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const maxDuration = 60;
export const runtime = 'nodejs';

async function handler(_req: NextRequest) {
  return NextResponse.json(
    await withCronLogging('kakao-channel-sync', async () => {
      const start = Date.now();
      const sb = getSupabaseAdmin();

      const { data: rows, error } = await (sb as any)
        .from('v_admin_kakao_funnel')
        .select('*')
        .eq('status', '✅ 발송가능');

      if (error) {
        return {
          processed: 0,
          failed: 1,
          metadata: { error: error.message || 'select failed', elapsed_ms: Date.now() - start },
        };
      }

      const targets = (rows as any[]) || [];
      const apiKey = process.env.KAKAO_REST_API_KEY;

      if (!apiKey) {
        return {
          processed: targets.length,
          metadata: {
            mock_skipped: true,
            target_count: targets.length,
            elapsed_ms: Date.now() - start,
          },
        };
      }

      let uploaded = 0;
      let failed = 0;
      const errors: Array<{ msg: string }> = [];

      try {
        const userIds = targets
          .map((r: any) => r.kakao_user_id || r.user_id || r.id)
          .filter((v: any) => v != null);

        const form = new FormData();
        const blob = new Blob([userIds.join('\n')], { type: 'text/plain' });
        form.append('file', blob, 'targets.txt');

        const res = await fetch(
          'https://kapi.kakao.com/v1/talkchannel/upload/target_user_file',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: form,
            signal: AbortSignal.timeout(30_000),
          },
        );

        if (res.ok) {
          uploaded = userIds.length;
        } else {
          failed = userIds.length;
          const txt = await res.text().catch(() => '');
          errors.push({ msg: `upload status ${res.status}: ${txt.slice(0, 200)}` });
        }
      } catch (e) {
        failed = targets.length;
        errors.push({ msg: (e as Error)?.message || 'fetch failed' });
      }

      return {
        processed: targets.length,
        created: uploaded,
        failed,
        metadata: {
          target_count: targets.length,
          uploaded,
          elapsed_ms: Date.now() - start,
          errors: errors.slice(0, 5),
        },
      };
    }),
  );
}

export const GET = withCronAuthFlex(handler);
export const POST = withCronAuthFlex(handler);
