import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/admin-auth';
import { errMsg } from '@/lib/error-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type FilterJson = {
  regions?: string[];
  marketing_required?: boolean;
  channel_required?: boolean;
  active_days?: number;
  message_type?: 'ad' | 'info';
  age_groups?: string[];
  genders?: string[];
};

const HEADER = ['앱유저아이디', '이름', '생년월일', '지역', '성별', '연령', '가입일', '최근접속일'];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function ymd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  try {
    const body = await req.json().catch(() => ({}));
    const filter: FilterJson = body?.filter_json ?? {};
    const segment_name: string = typeof body?.segment_name === 'string' && body.segment_name.trim() ? body.segment_name.trim() : 'unnamed';

    const sb: any = getSupabaseAdmin();

    const applyFilters = (q: any) => {
      q = q.eq('status', '✅ 발송가능');
      if (Array.isArray(filter.regions) && filter.regions.length) {
        q = q.in('region', filter.regions);
      }
      if (filter.marketing_required === true) {
        q = q.eq('marketing_consent', true);
      }
      if (filter.channel_required === true) {
        q = q.eq('channel_added', true);
      }
      if (typeof filter.active_days === 'number' && filter.active_days > 0) {
        const since = new Date(Date.now() - filter.active_days * 24 * 60 * 60 * 1000).toISOString();
        q = q.gte('last_active_at', since);
      }
      if (Array.isArray(filter.age_groups) && filter.age_groups.length) {
        q = q.in('age_group', filter.age_groups);
      }
      if (Array.isArray(filter.genders) && filter.genders.length) {
        q = q.in('gender', filter.genders);
      }
      return q;
    };

    const { data, error } = await applyFilters(sb.from('v_admin_kakao_funnel').select('*'));
    if (error) throw error;

    const rows: any[] = Array.isArray(data) ? data : [];
    const recipient_count = rows.length;

    const lines: string[] = [];
    lines.push(HEADER.map(csvEscape).join(','));
    for (const r of rows) {
      lines.push(
        [
          r.app_user_id ?? r.user_id ?? r.id ?? '',
          r.name ?? r.full_name ?? '',
          r.birth_date ?? r.birthday ?? '',
          r.region ?? '',
          r.gender ?? '',
          r.age_group ?? r.age ?? '',
          r.signup_at ?? r.created_at ?? '',
          r.last_active_at ?? '',
        ]
          .map(csvEscape)
          .join(',')
      );
    }
    const BOM = '﻿';
    const csv = BOM + lines.join('\r\n') + '\r\n';

    try {
      await sb.from('privacy_audit_log').insert({
        admin_id: auth.user.id,
        action: 'kakao_csv_export',
        recipient_count,
      });
    } catch {}

    const filename = `kadeora_kakao_${segment_name}_${ymd()}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errMsg(e) }, { status: 500 });
  }
}
