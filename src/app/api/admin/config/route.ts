/**
 * /api/admin/config — app_config 통합 GET/POST/DELETE
 *
 * GET ?namespace=naver_cafe : 해당 namespace 의 모든 키/값
 * GET (no params)            : 전체 namespace 트리
 * POST { namespace, key, value, description? } : 단일 설정 업서트
 * DELETE ?namespace=&key=    : 단일 설정 삭제 → 폴백값 사용으로 회귀
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { invalidateConfig, listConfig } from '@/lib/app-config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;

  const namespace = req.nextUrl.searchParams.get('namespace');
  const sb = getSupabaseAdmin();

  if (namespace) {
    const { data } = await (sb as any).from('app_config')
      .select('key, value, description, updated_at, updated_by')
      .eq('namespace', namespace)
      .order('key');
    const config: Record<string, any> = {};
    for (const row of data || []) {
      config[row.key] = {
        value: row.value,
        description: row.description,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
      };
    }
    return NextResponse.json({ namespace, config });
  }

  const all = await listConfig();
  return NextResponse.json({ all });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { namespace, key, value, description } = body;
  if (!namespace || !key || value === undefined) {
    return NextResponse.json({ error: 'namespace_key_value_required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  await (sb as any).from('app_config').upsert({
    namespace, key, value,
    description: description ?? undefined,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'namespace,key' });

  invalidateConfig(namespace);

  return NextResponse.json({ ok: true, namespace, key, value });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(); if ('error' in auth) return auth.error;

  const namespace = req.nextUrl.searchParams.get('namespace');
  const key = req.nextUrl.searchParams.get('key');
  if (!namespace || !key) {
    return NextResponse.json({ error: 'namespace_and_key_required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  await (sb as any).from('app_config').delete()
    .eq('namespace', namespace).eq('key', key);
  invalidateConfig(namespace);

  return NextResponse.json({ ok: true });
}
