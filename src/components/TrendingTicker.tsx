'use client';
import { useState, useEffect } from 'react';

interface TrendingKeyword { keyword: string; rank: number }

export default function TrendingTicker() {
  const [keywords, setKeywords] = useState<TrendingKeyword[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetch('/api/trend').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setKeywords(d.slice(0, 10));
      else if (d.trending) setKeywords(d.trending.slice(0, 10));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!keywords.length) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % keywords.length);
        setVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(id);
  }, [keywords]);

  if (!keywords.length) return null;
  const current = keywords[index];

  return (
    <div style={{ background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', padding:'3px 0', overflow:'hidden' }}>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 14px', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        <span style={{ fontSize:10, fontWeight:800, color:'#fff', background:'var(--brand)', padding:'1px 6px', borderRadius:3, flexShrink:0 }}>실시간</span>
        <div style={{ flex:1, overflow:'hidden', height:20, position:'relative' }}>
          <a href={`/search?q=${encodeURIComponent(current?.keyword ?? '')}`}
            style={{
              position:'absolute', left:0, right:0,
              fontSize:12, fontWeight:600, color:'var(--text-primary)',
              textDecoration:'none', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-6px)',
              transition: 'opacity 0.25s, transform 0.25s',
            }}>
            <span style={{ color:'var(--brand)', marginRight:4, fontWeight:800 }}>{current?.rank ?? ''}</span>
            #{current?.keyword}
          </a>
        </div>
        <span style={{ fontSize: 'var(--fs-xs)', color:'var(--text-tertiary)', flexShrink:0 }}>{index + 1}/{keywords.length}</span>
      </div>
    </div>
  );
}
