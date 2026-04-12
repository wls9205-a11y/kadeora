'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TocItem { id: string; text: string; level: number; }
interface RelatedLink { title: string; href: string; }
interface Tool { label: string; sub: string; href: string; emoji: string; }

interface BlogSidebarProps {
  toc: TocItem[];
  category: string;
  relatedLinks?: RelatedLink[];
  tools?: Tool[];
  metrics?: { label: string; value: string }[];
}

const CATEGORY_TOOLS: Record<string, Tool[]> = {
  apt: [
    { label: '청약 가점 계산', sub: '내 당첨 확률은?', href: '/apt/diagnose', emoji: '🎯' },
    { label: '취득세 계산기', sub: '매매·전세 세금', href: '/calc/real-estate/acquisition-tax', emoji: '🧮' },
    { label: '중개수수료 계산', sub: '매매·전세 복비', href: '/calc/real-estate/brokerage-fee', emoji: '💰' },
  ],
  stock: [
    { label: '종합 시세', sub: '실시간 주가', href: '/stock', emoji: '📊' },
    { label: '종목 비교', sub: '나란히 비교', href: '/stock/compare', emoji: '⚖️' },
  ],
  unsold: [
    { label: '미분양 현황', sub: '전국 잔여세대', href: '/apt?tab=unsold', emoji: '🏗️' },
    { label: '청약 일정', sub: '접수중·예정', href: '/apt', emoji: '📅' },
  ],
  finance: [
    { label: '종합 시세', sub: '주식 실시간', href: '/stock', emoji: '📈' },
    { label: '부동산 정보', sub: '청약·시세', href: '/apt', emoji: '🏢' },
  ],
};

export default function BlogSidebar({ toc, category, relatedLinks, tools, metrics }: BlogSidebarProps) {
  const [activeId, setActiveId] = useState('');
  const categoryTools = tools || CATEGORY_TOOLS[category] || CATEGORY_TOOLS.finance;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );
    toc.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc]);

  return (
    <aside className="blog-sidebar" style={{
      position: 'sticky', top: 80, maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto', paddingBottom: 20,
      scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent',
    }}>
      {/* 목차 */}
      {toc.length >= 3 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            📌 목차
          </div>
          <nav>
            {toc.map(item => (
              <a key={item.id} href={`#${item.id}`}
                style={{
                  display: 'block', fontSize: 12, lineHeight: 1.5,
                  padding: '4px 0 4px ' + (item.level === 3 ? '16px' : '0'),
                  color: activeId === item.id ? 'var(--brand)' : 'var(--text-tertiary)',
                  fontWeight: activeId === item.id ? 600 : 400,
                  textDecoration: 'none',
                  borderLeft: activeId === item.id ? '2px solid var(--brand)' : '2px solid transparent',
                  paddingLeft: item.level === 3 ? 16 : 8,
                  transition: 'all 0.15s',
                }}
              >
                {item.text.slice(0, 30)}{item.text.length > 30 ? '...' : ''}
              </a>
            ))}
          </nav>
        </div>
      )}

      {/* 핵심 지표 */}
      {metrics && metrics.length > 0 && (
        <div style={{
          marginBottom: 20, padding: 12, borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            📊 핵심 지표
          </div>
          {metrics.map((m, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{m.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* 관련 단지/종목 */}
      {relatedLinks && relatedLinks.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            🔗 관련 {category === 'stock' ? '종목' : '단지'}
          </div>
          {relatedLinks.map((link, i) => (
            <Link key={i} href={link.href} style={{
              display: 'block', fontSize: 12, color: 'var(--text-secondary)',
              padding: '5px 0', textDecoration: 'none',
              borderBottom: i < relatedLinks.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              {link.title.slice(0, 25)}{link.title.length > 25 ? '...' : ''} →
            </Link>
          ))}
        </div>
      )}

      {/* 도구 */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          🧮 도구
        </div>
        {categoryTools.map((tool, i) => (
          <Link key={i} href={tool.href} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', marginBottom: 6, borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            textDecoration: 'none', color: 'inherit',
            transition: 'border-color 0.15s',
          }}>
            <span style={{ fontSize: 16 }}>{tool.emoji}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{tool.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{tool.sub}</div>
            </div>
          </Link>
        ))}
      </div>
    </aside>
  );
}
