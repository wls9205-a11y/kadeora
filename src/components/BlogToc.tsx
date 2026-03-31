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
  const isClickScrolling = useRef(false);

  // IntersectionObserver — 현재 읽는 섹션 감지
  useEffect(() => {
    const headings = toc.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 클릭 스크롤 중에는 Observer 무시 (충돌 방지)
        if (isClickScrolling.current) return;
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0.1 }
    );

    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [toc]);

  // 활성 칩만 가로 스크롤 (페이지 스크롤 건드리지 않음)
  useEffect(() => {
    if (!activeId || !scrollRef.current) return;
    const container = scrollRef.current;
    const activeEl = container.querySelector(`[data-toc-id="${activeId}"]`) as HTMLElement | null;
    if (!activeEl) return;

    // container 내에서만 가로 스크롤 — scrollIntoView 대신 scrollLeft 직접 제어
    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    const offset = elRect.left - containerRect.left - containerRect.width / 2 + elRect.width / 2;
    container.scrollBy({ left: offset, behavior: 'smooth' });
  }, [activeId]);

  // 클릭 → 해당 섹션으로 스크롤 (sticky 오프셋 보정)
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    isClickScrolling.current = true;
    setActiveId(id);

    // sticky 헤더(56px) + TOC 바(~40px) + 여유(12px) = 108px 오프셋
    const y = el.getBoundingClientRect().top + window.scrollY - 108;
    window.scrollTo({ top: y, behavior: 'smooth' });

    // 스크롤 완료 후 Observer 재활성화
    setTimeout(() => { isClickScrolling.current = false; }, 800);
  }, []);

  const h2Items = toc.filter(t => t.level === 2);
  if (h2Items.length < 2) return null;

  return (
    <nav
      aria-label="목차"
      style={{
        position: 'sticky', top: 56, zIndex: 10,
        background: 'var(--bg-base)', padding: '8px 0', marginBottom: 'var(--sp-lg)',
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
                padding: '6px 12px', borderRadius: 'var(--radius-xl)', fontSize: 11, fontWeight: isActive ? 700 : 500,
                background: isActive ? 'var(--brand)' : 'var(--bg-surface)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: isActive ? 'none' : '1px solid var(--border)',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 'var(--sp-xs)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.7 }}>{i + 1}</span>
              {cleanText.length > 14 ? cleanText.slice(0, 14) + '\u2026' : cleanText}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
