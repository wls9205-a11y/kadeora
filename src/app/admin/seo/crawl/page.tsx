/**
 * 세션 146 — 봇 크롤 대시보드. admin only.
 * s218: PostgREST 1k cap 우회 (fetchBatched). 5000 limit 가 1k 만 받던 문제 해소.
 */
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { fetchBatched } from '@/lib/db/fetchBatched';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CrawlAdminPage() {
  const sb = getSupabaseAdmin();
  const { data: rows } = await (sb as any).rpc('admin_bot_crawl_summary').catch(() => ({ data: null }));
  // Fallback: aggregate directly
  let summary: any[] = [];
  if (Array.isArray(rows) && rows.length > 0) {
    summary = rows;
  } else {
    const raw = await fetchBatched<{ bot_type: string; path: string | null; created_at: string }>(
      (off, lim) => (sb as any)
        .from('page_views')
        .select('bot_type, path, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 3600_000).toISOString())
        .not('bot_type', 'is', null)
        .order('created_at', { ascending: false })
        .range(off, off + lim - 1),
      50000,
    );
    const acc = new Map<string, { bot: string; day: string; count: number; paths: Set<string> }>();
    raw.forEach((r) => {
      const day = String(r.created_at).slice(0, 10);
      const key = `${r.bot_type}|${day}`;
      if (!acc.has(key)) acc.set(key, { bot: r.bot_type, day, count: 0, paths: new Set() });
      const e = acc.get(key)!;
      e.count++;
      if (r.path) e.paths.add(r.path);
    });
    summary = Array.from(acc.values())
      .map((e) => ({ bot_type: e.bot, day: e.day, hits: e.count, unique_paths: e.paths.size }))
      .sort((a, b) => (a.day < b.day ? 1 : -1));
  }

  return (
    <div style={{ padding: 24, color: 'var(--text-primary)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>봇 크롤 대시보드 (최근 7일)</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-hover)' }}>
            <th style={{ padding: 8, textAlign: 'left' }}>날짜</th>
            <th style={{ padding: 8, textAlign: 'left' }}>봇</th>
            <th style={{ padding: 8, textAlign: 'right' }}>hits</th>
            <th style={{ padding: 8, textAlign: 'right' }}>unique paths</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((r: any, i: number) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: 8 }}>{r.day}</td>
              <td style={{ padding: 8 }}>{r.bot_type}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{r.hits}</td>
              <td style={{ padding: 8, textAlign: 'right' }}>{r.unique_paths}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
