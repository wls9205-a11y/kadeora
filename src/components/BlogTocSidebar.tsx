'use client';
import { useState, useEffect, useRef } from 'react';

interface TocItem {
  level: number;
  text: string;
  id: string;
}

export default function BlogTocSidebar({ toc }: { toc: TocItem[] }) {
  const [activeId, setActiveId] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [readProgress, setReadProgress] = useState(0);

  useEffect(() => {
    const headings = toc.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (!headings.length) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
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

  // Reading progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setReadProgress(Math.min(100, Math.round((scrollTop / docHeight) * 100)));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  const activeIndex = toc.findIndex(t => t.id === activeId);

  return (
    <nav
      aria-label="목차"
      style={{
        position: 'sticky',
        top: 80,
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border) transparent',
        width: 220,
        flexShrink: 0,
      }}
    >
      {/* 읽기 진행률 */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'var(--brand)', borderRadius: 2, width: `${readProgress}%`, transition: 'width 0.15s' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, flexShrink: 0 }}>{readProgress}%</span>
      </div>

      {/* 목차 제목 */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingLeft: 10 }}>
        목차
      </div>

      {/* 목차 항목들 */}
      <div style={{ position: 'relative' }}>
        {/* 세로 트랙 라인 */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--border)', borderRadius: 1 }} />

        {toc.map((item, i) => {
          const isActive = activeId === item.id;
          const isPast = activeIndex >= 0 && i < activeIndex;

          return (
            <button
              key={i}
              onClick={() => scrollTo(item.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '5px 8px 5px 10px',
                paddingLeft: item.level === 3 ? 18 : 10,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                lineHeight: 1.5,
                color: isActive ? 'var(--brand)' : isPast ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                fontWeight: isActive ? 700 : 400,
                borderLeft: `2px solid ${isActive ? 'var(--brand)' : 'transparent'}`,
                marginLeft: 0,
                transition: 'all 0.15s',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                position: 'relative',
              }}
            >
              {item.text.replace(/<[^>]+>/g, '')}
            </button>
          );
        })}
      </div>

      {/* 맨 위로 버튼 */}
      {readProgress > 20 && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            marginTop: 16,
            padding: '6px 0',
            width: '100%',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-tertiary)',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          ↑ 맨 위로
        </button>
      )}
    </nav>
  );
}
