import { headers } from 'next/headers';

interface SendHistoryRow {
  id?: string | number;
  sent_at?: string;
  campaign?: string;
  segment?: string;
  attempted?: number;
  delivered?: number;
  blocked?: number;
  block_reasons?: Record<string, number> | string;
}

async function loadHistory(): Promise<{ rows: SendHistoryRow[]; err?: string }> {
  try {
    const h = await headers();
    const host = h.get('host') ?? 'localhost:3000';
    const proto = h.get('x-forwarded-proto') ?? 'http';
    const cookie = h.get('cookie') ?? '';
    const url = `${proto}://${host}/api/admin/marketing/kakao/history`;
    const r = await fetch(url, {
      cache: 'no-store',
      headers: cookie ? { cookie } : undefined,
    });
    if (!r.ok) return { rows: [], err: `http ${r.status}` };
    const j = await r.json();
    const rows: SendHistoryRow[] = Array.isArray(j) ? j : j?.items ?? [];
    return { rows };
  } catch (e) {
    return { rows: [], err: e instanceof Error ? e.message : String(e) };
  }
}

function fmtReasons(v: SendHistoryRow['block_reasons']): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return Object.entries(v)
    .map(([k, n]) => `${k}=${n}`)
    .join(', ');
}

export default async function SendHistory() {
  const { rows, err } = await loadHistory();

  return (
    <section
      style={{
        padding: 14,
        borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--bg-elevated, #1f2028)',
        border: '1px solid var(--border, #2a2b35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, margin: 0 }}>발송 이력</h2>
        {err && <span style={{ fontSize: 11, color: '#f87171' }}>로드 실패: {err}</span>}
      </div>
      {rows.length === 0 && !err && (
        <div style={{ fontSize: 12, color: 'var(--text-tertiary, #888)' }}>발송 이력이 없습니다.</div>
      )}
      {rows.length > 0 && (
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['일시', '캠페인', '세그먼트', '시도', '배달', '차단', '차단사유'].map((c) => (
                  <th
                    key={c}
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderBottom: '1px solid var(--border, #2a2b35)',
                      color: 'var(--text-tertiary, #888)',
                      fontWeight: 700,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? i}>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border, #2a2b35)' }}>
                    {r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border, #2a2b35)' }}>
                    {r.campaign ?? '—'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border, #2a2b35)' }}>
                    {r.segment ?? '—'}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border, #2a2b35)' }}>
                    {r.attempted ?? 0}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border, #2a2b35)' }}>
                    {r.delivered ?? 0}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border, #2a2b35)' }}>
                    {r.blocked ?? 0}
                  </td>
                  <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border, #2a2b35)', color: 'var(--text-tertiary, #888)' }}>
                    {fmtReasons(r.block_reasons)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
