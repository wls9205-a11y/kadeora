import Link from 'next/link';
import { CATEGORIES, CALC_REGISTRY, getCategoryLabel } from '@/lib/calc/registry';
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/constants';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  return CATEGORIES.map(c => ({ category: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const cat = CATEGORIES.find(c => c.id === category);
  if (!cat) return {};
  const label = cat.label;
  return {
    title: `${label} 계산기 모음 — 카더라`,
    description: `${label} 관련 무료 계산기. 2026년 최신 기준 반영.`,
    alternates: { canonical: `${SITE_URL}/calc/${category}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = CATEGORIES.find(c => c.id === category);
  if (!cat) notFound();
  const calcs = CALC_REGISTRY.filter(c => c.category === category);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 var(--sp-lg)' }}>
      <Link href="/calc" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>← 계산기 전체</Link>
      <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 900, margin: '8px 0 4px' }}>{cat.icon} {cat.label} 계산기</h1>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>{calcs.length}종 무료 제공</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {calcs.map(c => (
          <Link key={c.slug} href={`/calc/${c.category}/${c.slug}`} style={{
            display: 'block', padding: '14px 16px', borderRadius: 12, textDecoration: 'none',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{c.titleShort}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{c.description.slice(0, 60)}...</div>
          </Link>
        ))}
      </div>

      {/* 관련 카테고리 */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>다른 카테고리</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORIES.filter(c => c.id !== category).map(c => (
            <Link key={c.id} href={`/calc/${c.id}`} style={{
              padding: '6px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 600,
              background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
            }}>
              {c.icon} {c.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
