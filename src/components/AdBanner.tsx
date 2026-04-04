'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface AdItem {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  region: string;
  link: string;
  imageUrl?: string; // 투시도/사진 URL (300×200px 권장)
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
    setTimeout(() => {
      setIndex(i => (i + 1) % ads.length);
      setVisible(true);
    }, 250);
  }, [ads.length]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const id = setInterval(next, 4500);
    return () => clearInterval(id);
  }, [ads.length, next]);

  if (!ads.length) return null;
  const ad = ads[index];

  return (
    <div style={{ padding: '6px 8px 2px', maxWidth: 680, margin: '0 auto' }}>
      <Link href={ad.link} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{
          background: 'var(--bg-surface, #0F1D35)',
          borderRadius: 10,
          overflow: 'hidden',
          border: '0.5px solid var(--border, #1E293B)',
          opacity: visible ? 1 : 0.3,
          transform: visible ? 'translateY(0)' : 'translateY(3px)',
          transition: 'opacity 0.25s, transform 0.25s',
        }}>
          <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 80 }}>
            {/* 텍스트 영역 */}
            <div style={{
              flex: 1, padding: '10px 12px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              {/* 뱃지 + 지역 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                {ad.isPaid && (
                  <span style={{
                    fontSize: 8, color: '#FBBF24', background: '#78350F',
                    padding: '1px 5px', borderRadius: 3, fontWeight: 500,
                  }}>AD</span>
                )}
                <span style={{
                  fontSize: 8, fontWeight: 500, borderRadius: 3, padding: '1px 5px',
                  color: ad.badgeColor || '#60A5FA',
                  background: (ad.badgeColor || '#60A5FA') + '18',
                  border: `0.5px solid ${ad.badgeColor || '#60A5FA'}40`,
                }}>{ad.badge}</span>
                <span style={{ fontSize: 9, color: '#64748B' }}>{ad.region}</span>
              </div>

              {/* 제목 */}
              <p style={{
                fontSize: 13, fontWeight: 500, color: '#F1F5F9',
                margin: '0 0 4px', lineHeight: 1.35,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{ad.title}</p>

              {/* 서브 정보 (태그형) */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {ad.subtitle.split(' · ').map((s, i) => (
                  <span key={i} style={{
                    fontSize: 8, padding: '2px 6px', borderRadius: 6,
                    color: '#CBD5E1', background: '#1E293B',
                  }}>{s}</span>
                ))}
              </div>
            </div>

            {/* 이미지 영역 (300×200px 권장) */}
            <div style={{
              flexShrink: 0, width: 100,
              background: ad.imageUrl ? 'transparent' : 'linear-gradient(135deg, #0F2847, #1E3A5F)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {ad.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ad.imageUrl} alt={ad.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <svg width="56" height="52" viewBox="0 0 80 72" fill="none">
                  <rect x="8" y="28" width="20" height="36" rx="2" fill="#3B7BF6" opacity="0.5"/>
                  <rect x="32" y="14" width="20" height="50" rx="2" fill="#3B7BF6" opacity="0.7"/>
                  <rect x="56" y="22" width="16" height="42" rx="2" fill="#3B7BF6" opacity="0.6"/>
                  <rect x="12" y="34" width="3" height="3" rx="1" fill="#93C5FD" opacity="0.5"/>
                  <rect x="18" y="34" width="3" height="3" rx="1" fill="#93C5FD" opacity="0.5"/>
                  <rect x="12" y="42" width="3" height="3" rx="1" fill="#93C5FD" opacity="0.5"/>
                  <rect x="18" y="42" width="3" height="3" rx="1" fill="#93C5FD" opacity="0.5"/>
                  <rect x="36" y="20" width="3" height="3" rx="1" fill="#93C5FD" opacity="0.5"/>
                  <rect x="42" y="20" width="3" height="3" rx="1" fill="#93C5FD" opacity="0.5"/>
                  <rect x="36" y="28" width="3" height="3" rx="1" fill="#93C5FD" opacity="0.5"/>
                  <rect x="42" y="28" width="3" height="3" rx="1" fill="#93C5FD" opacity="0.5"/>
                  <rect x="36" y="36" width="3" height="3" rx="1" fill="#93C5FD" opacity="0.5"/>
                  <rect x="42" y="36" width="3" height="3" rx="1" fill="#93C5FD" opacity="0.5"/>
                </svg>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* 인디케이터 */}
      {ads.length > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 4, marginTop: 4,
        }}>
          {ads.map((_, i) => (
            <span key={i} style={{
              width: 4, height: 4, borderRadius: '50%',
              background: i === index ? '#3B7BF6' : '#1E293B',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
