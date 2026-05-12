// app/widget/apt/[slug]/page.tsx
import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase-server';
import { formatKoreanPrice, formatMargin } from '@/lib/apt-format';

export const revalidate = 600;
export const maxDuration = 10;

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return {
    title: `${decodeURIComponent(slug)} 위젯 | 카더라`,
    robots: { index: false, follow: true },
  };
}

export default async function AptWidget({ params }: Props) {
  const { slug } = await params;
  const sb = await createSupabaseServer();
  const { data } = await sb.rpc('get_apt_site_page' as any, { p_slug: decodeURIComponent(slug) });
  if (!data) {
    return (
      <div className="font-sans text-xs text-slate-500 p-4">
        카더라에서 단지 정보를 찾을 수 없습니다
      </div>
    );
  }
  const s = (data as any).site;
  const sub = (data as any).subscription;

  return (
    <div className="font-sans bg-white p-4 max-w-md text-slate-900">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500">카더라 분석 위젯</span>
        <Link href={`https://kadeora.app/apt/${encodeURIComponent(s.slug)}`} target="_top" className="text-[11px] text-blue-600 hover:underline">
          자세히 ▸
        </Link>
      </div>
      <h3 className="font-bold text-base mb-3 leading-tight">{s.name}</h3>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Cell label="분양가" value={s.price_min && s.price_max ? `${formatKoreanPrice(s.price_min)}~${formatKoreanPrice(s.price_max)}` : '—'} />
        <Cell label="안전마진" value={formatMargin(s.estimated_safe_margin)} color={s.estimated_safe_margin >= 0 ? 'text-emerald-600' : 'text-red-600'} />
        <Cell label="경쟁률 예상" value={sub?.expected_competition ? `${sub.expected_competition}:1` : '—'} />
        <Cell label="총 세대" value={s.total_units ? `${s.total_units}` : '—'} />
      </div>
      <div className="mt-3 text-[10px] text-slate-400">
        © 카더라 {sub?.house_manage_no && `· 공고 ${sub.house_manage_no}`}
      </div>
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-slate-500 text-[10px]">{label}</div>
      <div className={`font-bold text-sm ${color || ''}`}>{value}</div>
    </div>
  );
}
