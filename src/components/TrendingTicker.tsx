'use client';
import { useState, useEffect } from 'react';
import { isTossMode } from '@/lib/toss-mode';

interface TrendingKeyword { keyword: string; rank?: number }

export default function TrendingTicker() {
  const [keywords, setKeywords] = useState<TrendingKeyword[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (isTossMode()) return;
    fetch('/api/search/trending').then(r => r.json()).then(d => {
      const kw = d?.keywords || d || [];
      if (Array.isArray(kw) && kw.length > 0) {
        setKeywords(kw.slice(0, 8).map((k: any, i: number) => ({
          keyword: k.keyword || k,
          rank: i + 1,
        })));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!keywords.length) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % keywords.length);
        setVisible(true);
      }, 300);
    }, 3500);
    return () => clearInterval(id);
  }, [keywords]);

  if (!keywords.length) return null;
  const current = keywords[index];

  return (
    <div style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', padding:'2px 0', overflow:'hidden' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 14px', display:'flex', alignItems:'center', justifyContent:'center', gap:6, height: 22 }}>
        <span style={{ fontSize:9, fontWeight:800, color:'var(--brand)', padding:'1px 5px', borderRadius:3, border:'1px solid var(--brand)', flexShrink:0, letterSpacing:'0.5px' }}>인기</span>
        <div style={{ flex:1, overflow:'hidden', height:18, position:'relative' }}>
          <a href={`/search?q=${encodeURIComponent(current?.keyword ?? '')}`}
            style={{
              position:'absolute', left:0, right:0,
              fontSize:11, fontWeight:600, color:'var(--text-primary)',
              textDecoration:'none', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-4px)',
              transition: 'opacity 0.2s, transform 0.2s',
              lineHeight: '18px',
            }}>
            <span style={{ color:'var(--brand)', marginRight:4, fontWeight:800, fontSize:10 }}>{current?.rank ?? ''}</span>
            {current?.keyword}
          </a>
        </div>
        <a href="/search" style={{ fontSize:9, color:'var(--text-tertiary)', flexShrink:0, textDecoration:'none' }}>{index + 1}/{keywords.length}</a>
      </div>
    </div>
  );
}
