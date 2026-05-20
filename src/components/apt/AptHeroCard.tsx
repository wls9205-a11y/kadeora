'use client';
// s269e V2.1: 컴팩트 Hero. 이미지 130→100px, padding 축소.

import Link from 'next/link';

export type HeroData = {
  id: string;
  section: string;
  title: string;
  region: string | null;
  dday: number | null;
  meta_primary: string | null;
  meta_secondary: string | null;
  image_url: string | null;
  href: string;
  is_urgent: boolean;
  is_new: boolean;
  urgency_score: number;
};

export default function AptHeroCard({ data }: { data: HeroData }) {
  return (
    <Link href={data.href} style={{
      display: 'block',
      margin: '4px 0 10px',
      borderRadius: 8,
      overflow: 'hidden',
      border: '0.5px solid var(--border-base, #E5E7EB)',
      background: 'var(--bg-surface, #FFFFFF)',
      textDecoration: 'none',
      color: 'inherit',
    }}>
      <div style={{
        position: 'relative',
        height: 100,
        background: data.image_url
          ? `url(${data.image_url}) center/cover, linear-gradient(135deg, #B5D4F4 0%, #378ADD 100%)`
          : 'linear-gradient(135deg, #B5D4F4 0%, #378ADD 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#042C53', fontSize: 32,
      }}>
        {!data.image_url && <span style={{ opacity: 0.55 }}>🏢</span>}
        <div style={{ position: 'absolute', top: 7, left: 7, display: 'flex', gap: 3 }}>
          <span style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 3, fontWeight: 500,
            background: 'rgba(255,255,255,0.92)', color: '#0C447C',
          }}>청약</span>
          {data.urgency_score >= 70 && (
            <span style={{
              fontSize: 9, padding: '2px 5px', borderRadius: 3, fontWeight: 500,
              background: '#E24B4A', color: 'white', letterSpacing: '0.3px',
            }}>HOT</span>
          )}
        </div>
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 24, height: 24, borderRadius: '50%',
          background: 'rgba(255,255,255,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#6B7280',
        }}>♡</div>
        {data.dday !== null && data.dday !== undefined && (
          <div style={{
            position: 'absolute', bottom: 7, right: 7,
            fontSize: 10, padding: '3px 7px', borderRadius: 4, fontWeight: 500,
            background: data.is_urgent ? '#E24B4A' : 'rgba(0,0,0,0.65)',
            color: 'white',
          }}>
            D-{data.dday}{data.is_urgent ? ' 마감임박' : ''}
          </div>
        )}
      </div>
      <div style={{ padding: '8px 11px 11px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: 3, gap: 8,
        }}>
          <div style={{
            fontSize: 13.5, fontWeight: 500, lineHeight: 1.25,
            color: 'var(--text-primary, #111827)',
          }}>{data.title}</div>
          {data.region && (
            <div style={{
              fontSize: 11, color: 'var(--text-secondary, #6B7280)', flexShrink: 0,
            }}>{data.region}</div>
          )}
        </div>
        {data.meta_primary && (
          <div style={{
            fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary, #111827)',
            marginTop: 2,
          }}>
            {data.meta_primary}
            {data.meta_secondary && (
              <span style={{
                color: 'var(--text-secondary, #6B7280)', fontWeight: 400, fontSize: 11,
              }}> · {data.meta_secondary}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
