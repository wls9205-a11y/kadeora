'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface AdItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeType: 'ad' | 'urgent' | 'upcoming';
  region: string;
  link: string;
  imageUrl?: string;
  isPaid?: boolean;
}

export default function AdBanner() {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetch('/api/ads')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.ads) && d.ads.length > 0) setAds(d.ads); })
      .catch(() => {});
  }, []);

  const next = useCallback(() => {
    if (ads.length <= 1) return;
    setVisible(false);
    setTimeout(() => { setIndex(i => (i + 1) % ads.length); setVisible(true); }, 250);
  }, [ads.length]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const id = setInterval(next, 8000);
    return () => clearInterval(id);
  }, [ads.length, next]);

  if (!ads.length) return null;
  const ad = ads[index];

  const badgeStyles: Record<string, { bg: string; color: string }> = {
    ad:       { bg: 'var(--bg-warning, #78350F)', color: 'var(--text-warning, #FBBF24)' },
    urgent:   { bg: 'var(--bg-danger, #7F1D1D)',  color: 'var(--text-danger, #FCA5A5)' },
    upcoming: { bg: 'var(--bg-info, #1E3A5F)',     color: 'var(--text-info, #60A5FA)' },
  };
  const bs = badgeStyles[ad.badgeType] || badgeStyles.upcoming;

  return (
    <div style={{ padding: '6px 8px 2px', maxWidth: 680, margin: '0 auto' }}>
      <Link href={ad.link} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 10, overflow: 'hidden',
          border: '1px solid var(--border)',
          opacity: visible ? 1 : 0.3,
          transform: visible ? 'translateY(0)' : 'translateY(3px)',
          transition: 'opacity 0.25s, transform 0.25s',
        }}>
          <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 80 }}>
            <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <span style={{
                  fontSize: 9, fontWeight: 600, borderRadius: 3, padding: '1px 6px', lineHeight: '15px',
                  color: bs.color, background: bs.bg,
                }}>{ad.badge}</span>
                {ad.region && (
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)' }}>{ad.region}</span>
                )}
              </div>
              <p style={{
                fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                margin: '0 0 5px', lineHeight: 1.35,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{ad.title}</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ad.subtitle.split(' · ').map((s, i) => (
                  <span key={i} style={{
                    fontSize: 9, padding: '2px 6px', borderRadius: 6, fontWeight: 500,
                    color: i === 0 ? 'var(--text-info)' : i === 1 ? 'var(--text-success)' : 'var(--text-tertiary)',
                    background: i === 0 ? 'var(--bg-info)' : i === 1 ? 'var(--bg-success)' : 'var(--bg-hover)',
                  }}>{s}</span>
                ))}
              </div>
            </div>
            <div style={{
              flexShrink: 0, width: 100,
              background: ad.imageUrl ? 'transparent' : 'var(--bg-hover)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              {ad.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ad.imageUrl} alt={ad.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="56" height="52" viewBox="0 0 80 72" fill="none">
                  <rect x="8" y="28" width="20" height="36" rx="2" fill="var(--brand)" opacity="0.35"/>
                  <rect x="32" y="14" width="20" height="50" rx="2" fill="var(--brand)" opacity="0.5"/>
                  <rect x="56" y="22" width="16" height="42" rx="2" fill="var(--brand)" opacity="0.4"/>
                  <rect x="12" y="34" width="3" height="3" rx="1" fill="var(--brand)" opacity="0.3"/>
                  <rect x="18" y="34" width="3" height="3" rx="1" fill="var(--brand)" opacity="0.3"/>
                  <rect x="12" y="42" width="3" height="3" rx="1" fill="var(--brand)" opacity="0.3"/>
                  <rect x="18" y="42" width="3" height="3" rx="1" fill="var(--brand)" opacity="0.3"/>
                  <rect x="36" y="20" width="3" height="3" rx="1" fill="var(--brand)" opacity="0.3"/>
                  <rect x="42" y="20" width="3" height="3" rx="1" fill="var(--brand)" opacity="0.3"/>
                  <rect x="36" y="28" width="3" height="3" rx="1" fill="var(--brand)" opacity="0.3"/>
                  <rect x="42" y="28" width="3" height="3" rx="1" fill="var(--brand)" opacity="0.3"/>
                  <rect x="36" y="36" width="3" height="3" rx="1" fill="var(--brand)" opacity="0.3"/>
                  <rect x="42" y="36" width="3" height="3" rx="1" fill="var(--brand)" opacity="0.3"/>
                </svg>
              )}
            </div>
          </div>
        </div>
      </Link>
      {ads.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 4 }}>
          {ads.map((_, i) => (
            <span key={i} style={{
              width: 4, height: 4, borderRadius: '50%',
              background: i === index ? 'var(--brand)' : 'var(--border)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
