/**
 * [NOTIFY-BELL] 세션 140 — 앱 내 벨 알림 서비스 (Solapi 대체)
 *
 * push(): notification_bell 테이블에 row INSERT
 * 서버에서만 호출 (service role). target_user_id는 기본 Node 관리자.
 *
 * NOTE: Solapi API는 그대로 유지하지만, 4개 호출 지점에서 이 서비스를 우선 호출.
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type BellType =
  | 'big_event_news'
  | 'draft_ready'
  | 'stage_transition'
  | 'fact_alert'
  | 'cron_failure'
  | 'generic';

export interface BellPayload {
  type: BellType;
  title: string;
  body?: string;
  url?: string;
  data?: Record<string, any>;
  targetUserId?: string; // 기본: NODE_ADMIN_USER_ID
}

async function resolveNodeUserId(): Promise<string | null> {
  const envId = process.env.NODE_ADMIN_USER_ID;
  if (envId) return envId;
  // fallback: profiles.is_admin=true 첫 row
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from('profiles').select('id').eq('is_admin', true).limit(1).maybeSingle();
    return (data as any)?.id || null;
  } catch {
    return null;
  }
}

export async function pushBell(payload: BellPayload): Promise<{ ok: boolean; id?: number; error?: string }> {
  try {
    const sb = getSupabaseAdmin();
    const targetId = payload.targetUserId || (await resolveNodeUserId());
    if (!targetId) return { ok: false, error: 'no_target_user' };

    const { data, error } = await (sb as any)
      .from('notification_bell')
      .insert({
        target_user_id: targetId,
        type: payload.type,
        title: payload.title.slice(0, 200),
        body: payload.body ? String(payload.body).slice(0, 2000) : null,
        url: payload.url ? String(payload.url).slice(0, 500) : null,
        data: payload.data || {},
      })
      .select('id')
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: (data as any)?.id };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'exception' };
  }
}

/**
 * NotificationBellService — Solapi 발송 지점에서 간편 호출용.
 * 4가지 프리셋 제공.
 */
export const NotificationBellService = {
  async pushBigEventNews(params: { eventName: string; title: string; url: string; critical?: boolean }) {
    return pushBell({
      type: 'big_event_news',
      title: `[뉴스] ${params.eventName}${params.critical ? ' · ⚠ 중요' : ''}`,
      body: params.title,
      url: params.url,
      data: { event_name: params.eventName, critical: !!params.critical },
    });
  },

  async pushDraftReady(params: { name: string; phase: string; region: string; slug: string }) {
    return pushBell({
      type: 'draft_ready',
      title: `[Draft] ${params.phase} · ${params.name}`,
      body: `${params.region} · 검수 대기 (slug: ${params.slug})`,
      url: `/admin?tab=blog&slug=${encodeURIComponent(params.slug)}`,
      data: params as any,
    });
  },

  async pushStageTransition(params: { eventName: string; oldStage: number; newStage: number }) {
    return pushBell({
      type: 'stage_transition',
      title: `[Stage] ${params.eventName} ${params.oldStage} → ${params.newStage}`,
      body: `재건축 진행 단계 전환 감지`,
      url: `/apt/big-events`,
      data: params as any,
    });
  },

  async pushFactAlert(params: { eventName: string; oldScore: number; newScore: number; reason: string }) {
    return pushBell({
      type: 'fact_alert',
      title: `[Fact↓] ${params.eventName} ${params.oldScore}→${params.newScore}`,
      body: params.reason.slice(0, 240),
      url: `/apt/big-events`,
      data: params as any,
    });
  },

  async pushCronFailure(params: { cronName: string; error: string }) {
    return pushBell({
      type: 'cron_failure',
      title: `[크론 실패] ${params.cronName}`,
      body: (params.error || '').slice(0, 240),
      url: `/admin`,
      data: params as any,
    });
  },
};
