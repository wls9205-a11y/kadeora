'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

interface TocItem {
  level: number;
  text: string;
  id: string;
}

export default function BlogToc({ toc }: { toc: TocItem[] }) {
  const [activeId, setActiveId] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const headings = toc.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [toc]);

  // 활성 칩이 보이도록 스크롤
  useEffect(() => {
    if (!activeId || !scrollRef.current) return;
    const activeEl = scrollRef.current.querySelector(`[data-toc-id="${activeId}"]`);
    if (activeEl) {
      (activeEl as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeId]);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, []);

  // H2만 표시 (H3은 목차 칩에서 제외 — 공간 효율)
  const h2Items = toc.filter(t => t.level === 2);
  if (h2Items.length < 2) return null;

  return (
    <nav
      aria-label="목차"
      style={{
        position: 'sticky', top: 56, zIndex: 10,
        background: 'var(--bg-base)', padding: '8px 0', marginBottom: 16,
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        ref={scrollRef}
        className="apt-pill-scroll"
        style={{
          display: 'flex', gap: 5, overflowX: 'auto',
          scrollbarWidth: 'none', paddingBottom: 2,
        }}
      >
        {h2Items.map((item, i) => {
          const isActive = activeId === item.id;
          const cleanText = item.text.replace(/<[^>]+>/g, '').replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+\s*/u, '');
          return (
            <button
              key={item.id}
              data-toc-id={item.id}
              onClick={() => scrollTo(item.id)}
              style={{
                padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: isActive ? 700 : 500,
                background: isActive ? 'var(--brand)' : 'var(--bg-surface)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border)',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.7 }}>{i + 1}</span>
              {cleanText.length > 14 ? cleanText.slice(0, 14) + '…' : cleanText}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
