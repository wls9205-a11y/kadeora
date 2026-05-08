// s259: 미분양 목록 페이지 — v_apt_card_unsold view + AptCardCompact
// path: src/app/(main)/apt/unsold/page.tsx (kadeora convention)
// 의존: getSupabaseAdmin (@/lib/supabase-admin) — kadeora 표준
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import AptListSorter from '@/components/apt/AptListSorter';
import { applySort } from '@/lib/apt/card-sort';
import { AptCardGrid } from '@/components/apt/AptCardCompact';
import type { AptSortKey } from '@/lib/apt/card-types';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export default async function UnsoldPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; region?: string }>;
}) {
  const sp = await searchParams;
  const sort = (sp.sort as AptSortKey) ?? 'newest';
  const supabase = getSupabaseAdmin();
  let query = (supabase as any).from('v_apt_card_unsold').select('*').limit(60);
  query = applySort(query, sort);
  if (sp.region) query = query.eq('region', sp.region);
  const { data: cards } = await query;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">미분양 ({cards?.length ?? 0})</h2>
        <AptListSorter category="unsold" defaultSort="newest" />
      </div>
      <AptCardGrid cards={(cards ?? []) as any} category="unsold" />
    </div>
  );
}
