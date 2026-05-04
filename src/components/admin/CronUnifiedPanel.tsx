// s224 — vercel.json crons + pg_cron 통합 뷰 (Architecture Rule #18 가시화)
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import fs from 'fs/promises';
import path from 'path';

interface PgCronRow {
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
  cron_name: string;
  category: string;
}

function categorize(name: string): string {
  if (/^(blog|issue|seo|indexnow|faq|backlink|naver|gsc|og|programmatic|image-relevance|unsplash|kakao-place|batch-rewrite|batch-poll|feed-buzz)/.test(name)) return 'blog';
  if (/^(stock|kr-stock|us-stock|us-closing|us-premarket|exchange|dart|analysis|invest-calendar|macro-event|price-change)/.test(name)) return 'stock';
  if (/^(apt|redev|unsold|molit|builder|crawl|aggregate-trade|auto-verify|collect-complex|collect-site|batch-cluster|batch-analysis)/.test(name)) return 'apt';
  return 'system';
}

export default async function CronUnifiedPanel() {
  const sb = getSupabaseAdmin();

  // 1) vercel.json crons
  let vercelCrons: { path: string; schedule: string; category: string }[] = [];
  try {
    const v = JSON.parse(await fs.readFile(path.join(process.cwd(), 'vercel.json'), 'utf-8'));
    vercelCrons = ((v.crons ?? []) as { path: string; schedule: string }[]).map(c => {
      const name = c.path.replace('/api/cron/', '');
      return { path: c.path, schedule: c.schedule, category: categorize(name) };
    });
  } catch { /* ignore */ }

  // 2) pg_cron jobs
  let pgCrons: PgCronRow[] = [];
  try {
    const { data } = await (sb as any).from('v_admin_pg_cron_jobs').select('*');
    pgCrons = (data ?? []) as PgCronRow[];
  } catch { /* ignore */ }

  const totals = {
    vercel: vercelCrons.length,
    pgcron: pgCrons.length,
    total: vercelCrons.length + pgCrons.length,
  };
  const byCategory: Record<string, number> = {};
  vercelCrons.forEach(c => { byCategory[c.category] = (byCategory[c.category] ?? 0) + 1; });
  pgCrons.forEach(c => { byCategory[c.category] = (byCategory[c.category] ?? 0) + 1; });

  return (
    <details
      style={{
        padding: '12px 14px', borderRadius: 10,
        background: 'var(--bg-elevated, #1f2028)', border: '1px solid var(--border, #2a2b35)',
        marginTop: 12,
      }}
    >
      <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 800, color: 'var(--text-primary, #fff)', wordBreak: 'keep-all' }}>
        ⏱️ Cron 통합 뷰 — vercel {totals.vercel} + pg_cron {totals.pgcron} = {totals.total}
        <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary, #888)' }}>
          ({Object.entries(byCategory).map(([k, v]) => `${k} ${v}`).join(' · ')})
        </span>
      </summary>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #888)', margin: '0 0 6px' }}>
            VERCEL.JSON ({totals.vercel})
          </h3>
          <div style={{ maxHeight: 300, overflowY: 'auto', fontSize: 11 }}>
            {vercelCrons.map(c => (
              <div key={c.path} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border, #2a2b35)', gap: 8 }}>
                <code style={{ color: 'var(--text-secondary, #ccc)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.path.replace('/api/cron/', '')}</code>
                <span style={{ color: 'var(--text-tertiary, #888)', fontSize: 10, whiteSpace: 'nowrap' }}>{c.schedule}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary, #888)', margin: '0 0 6px' }}>
            PG_CRON ({totals.pgcron}) <span style={{ color: '#fbbf24' }}>← 외부 호출!</span>
          </h3>
          <div style={{ maxHeight: 300, overflowY: 'auto', fontSize: 11 }}>
            {pgCrons.map(c => (
              <div key={c.jobname} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border, #2a2b35)', gap: 8 }}>
                <code style={{ color: 'var(--text-secondary, #ccc)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cron_name}</code>
                <span style={{ color: 'var(--text-tertiary, #888)', fontSize: 10, whiteSpace: 'nowrap' }}>{c.schedule}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-tertiary, #888)' }}>
        📌 Architecture Rule #18: cron 삭제 전 양쪽 다 확인 필수
      </div>
    </details>
  );
}
