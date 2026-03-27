import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const { admin } = auth;

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('site_id');
  const groupBy = searchParams.get('group_by');

  if (groupBy === 'site') {
    // 단지별 관심 수 집계
    const { data, error } = await admin.from('apt_site_interests')
      .select('id, site_id, is_member, apt_sites(name, slug, region, sigungu)')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const grouped: Record<string, { name: string; slug: string; region: string; sigungu: string; site_id: string; count: number; members: number; guests: number }> = {};
    for (const row of data || []) {
      const key = row.site_id;
      const site = row.apt_sites as any;
      if (!grouped[key]) {
        grouped[key] = {
          site_id: key,
          name: site?.name || '(알 수 없음)',
          slug: site?.slug || '',
          region: site?.region || '',
          sigungu: site?.sigungu || '',
          count: 0,
          members: 0,
          guests: 0,
        };
      }
      grouped[key].count++;
      if (row.is_member) grouped[key].members++;
      else grouped[key].guests++;
    }

    const result = Object.values(grouped).sort((a, b) => b.count - a.count);
    return NextResponse.json(result);
  }

  if (siteId) {
    // 특정 단지 관심 고객 목록
    const { data, error } = await admin.from('apt_site_interests')
      .select(`
        id, created_at, is_member, source,
        guest_name, guest_city, guest_district, guest_birth_date,
        guest_phone_last4, guest_phone,
        user_id, profiles(nickname, residence_city, residence_district, phone)
      `)
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  return NextResponse.json({ error: 'site_id or group_by=site required' }, { status: 400 });
}
