'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import LiveBar from '@/components/ui/LiveBar';

// (main) layout 에 한 번만 mount.
// /apt, /stock, /blog, /feed 4개 진입점에서만 실시간 텍스트를 fetch 해 LiveBar 로 노출한다.
// 외 경로에서는 null. fetch 실패/로딩 중 → skeleton (텍스트 없음).

const PAGES = [
  { match: /^\/apt(\/|$)/, page: 'apt' },
  { match: /^\/stock(\/|$)/, page: 'stock' },
  { match: /^\/blog(\/|$)/, page: 'blog' },
  { match: /^\/feed(\/|$)/, page: 'feed' },
] as const;

function pageOf(pathname: string | null): string | null {
  if (!pathname) return null;
  for (const p of PAGES) if (p.match.test(pathname)) return p.page;
  return null;
}

function Skeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      style={{
        height: 32,
        margin: '0 0 var(--kd-gap-md)',
        background: 'var(--kd-bg-soft)',
        border: '1px solid var(--kd-border)',
        borderRadius: 'var(--kd-radius)',
        animation: 'kd-shimmer 1.4s ease-in-out infinite',
        backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
        backgroundSize: '200% 100%',
      }}
    />
  );
}

export default function LiveBarChrome() {
  const pathname = usePathname();
  const page = pageOf(pathname);
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');

  useEffect(() => {
    if (!page) {
      setText(null);
      setState('idle');
      return;
    }
    let cancelled = false;
    setState('loading');
    setText(null);
    fetch(`/api/livebar?page=${page}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { text?: string }) => {
        if (cancelled) return;
        if (d?.text) { setText(d.text); setState('ok'); }
        else { setState('err'); }
      })
      .catch(() => { if (!cancelled) setState('err'); });
    return () => { cancelled = true; };
  }, [page]);

  if (!page) return null;
  if (state === 'ok' && text) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
        <LiveBar text={text} />
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <Skeleton />
    </div>
  );
}
