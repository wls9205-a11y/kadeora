import Link from 'next/link';

interface Props {
  basePath: string;
  page: number;
  totalPages: number;
  query?: Record<string, string | undefined>;
}

function buildHref(basePath: string, page: number, query?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) params.set(k, v);
    }
  }
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export default function Pagination({ basePath, page, totalPages, query }: Props) {
  if (totalPages <= 1) return null;

  const cur = Math.max(1, Math.min(page, totalPages));
  const prev = cur > 1 ? buildHref(basePath, cur - 1, query) : null;
  const next = cur < totalPages ? buildHref(basePath, cur + 1, query) : null;

  const window: number[] = [];
  const start = Math.max(1, cur - 2);
  const end = Math.min(totalPages, cur + 2);
  for (let i = start; i <= end; i++) window.push(i);

  const btn = (active: boolean): React.CSSProperties => ({
    minWidth: 32, padding: '6px 10px', borderRadius: 8,
    border: '0.5px solid var(--border, #2a2b35)',
    background: active ? 'var(--text-primary, #fff)' : 'transparent',
    color: active ? 'var(--bg-base, #0d0e14)' : 'var(--text-primary, #fff)',
    fontSize: 12, fontWeight: active ? 800 : 600,
    textDecoration: 'none', textAlign: 'center',
  });

  return (
    <nav aria-label="페이지 네비게이션" style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
      {prev ? (
        <Link href={prev} style={btn(false)}>이전</Link>
      ) : (
        <span style={{ ...btn(false), opacity: 0.3 }}>이전</span>
      )}
      {start > 1 && (
        <>
          <Link href={buildHref(basePath, 1, query)} style={btn(false)}>1</Link>
          {start > 2 && <span style={{ ...btn(false), border: 'none' }}>…</span>}
        </>
      )}
      {window.map((p) => (
        p === cur
          ? <span key={p} style={btn(true)}>{p}</span>
          : <Link key={p} href={buildHref(basePath, p, query)} style={btn(false)}>{p}</Link>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span style={{ ...btn(false), border: 'none' }}>…</span>}
          <Link href={buildHref(basePath, totalPages, query)} style={btn(false)}>{totalPages}</Link>
        </>
      )}
      {next ? (
        <Link href={next} style={btn(false)}>다음</Link>
      ) : (
        <span style={{ ...btn(false), opacity: 0.3 }}>다음</span>
      )}
    </nav>
  );
}
