'use client';
import { useState, useEffect, useRef } from 'react';

interface TocItem {
  level: number;
  text: string;
  id: string;
}

export default function BlogToc({ toc }: { toc: TocItem[] }) {
  const [activeId, setActiveId] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const headings = toc.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (!headings.length) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // 화면에 보이는 헤딩 중 가장 위에 있는 것을 활성으로
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    headings.forEach(h => observerRef.current?.observe(h));
    return () => observerRef.current?.disconnect();
  }, [toc]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>목차</div>
      {toc.map((item, i) => (
        <button
          key={i}
          onClick={() => scrollTo(item.id)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '4px 0', paddingLeft: item.level === 3 ? 16 : 0,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 'var(--fs-sm)', lineHeight: 1.5,
            color: activeId === item.id ? 'var(--brand)' : 'var(--text-secondary)',
            fontWeight: activeId === item.id ? 700 : 400,
            borderLeft: activeId === item.id ? '2px solid var(--brand)' : '2px solid transparent',
            paddingLeft: activeId === item.id ? (item.level === 3 ? 14 : 6) : (item.level === 3 ? 16 : 8),
            transition: 'all 0.15s',
          }}
        >
          {item.text.replace(/<[^>]+>/g, '')}
        </button>
      ))}
    </div>
  );
}
