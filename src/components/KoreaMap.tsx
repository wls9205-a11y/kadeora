'use client';
import { useState } from 'react';
import Link from 'next/link';

const REGIONS: Record<string, { cx: number; cy: number; label: string; short: string }> = {
  '서울': { cx: 126, cy: 74, label: '서울', short: '서울' },
  '경기': { cx: 138, cy: 85, label: '경기', short: '경기' },
  '인천': { cx: 112, cy: 80, label: '인천', short: '인천' },
  '강원': { cx: 175, cy: 60, label: '강원', short: '강원' },
  '충북': { cx: 158, cy: 108, label: '충북', short: '충북' },
  '충남': { cx: 120, cy: 115, label: '충남', short: '충남' },
  '대전': { cx: 142, cy: 120, label: '대전', short: '대전' },
  '세종': { cx: 134, cy: 110, label: '세종', short: '세종' },
  '전북': { cx: 125, cy: 145, label: '전북', short: '전북' },
  '전남': { cx: 115, cy: 180, label: '전남', short: '전남' },
  '광주': { cx: 108, cy: 168, label: '광주', short: '광주' },
  '경북': { cx: 185, cy: 110, label: '경북', short: '경북' },
  '경남': { cx: 170, cy: 160, label: '경남', short: '경남' },
  '대구': { cx: 180, cy: 130, label: '대구', short: '대구' },
  '울산': { cx: 200, cy: 140, label: '울산', short: '울산' },
  '부산': { cx: 195, cy: 160, label: '부산', short: '부산' },
  '제주': { cx: 110, cy: 220, label: '제주', short: '제주' },
};

interface Props {
  stats?: Record<string, number>;
  onSelect?: (region: string) => void;
}

export default function KoreaMap({ stats = {}, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const maxVal = Math.max(1, ...Object.values(stats));

  const getColor = (region: string) => {
    const val = stats[region] || 0;
    if (val === 0) return 'var(--bg-hover)';
    const intensity = Math.min(val / maxVal, 1);
    return `rgba(0,255,135,${0.15 + intensity * 0.55})`;
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>📍 지역별 현황</div>
      <svg viewBox="90 40 140 200" style={{ width: '100%', maxWidth: 320, margin: '0 auto', display: 'block' }}>
        {Object.entries(REGIONS).map(([name, { cx, cy }]) => {
          const isHover = hover === name;
          const count = stats[name] || 0;
          return (
            <g key={name}
              onClick={() => onSelect ? onSelect(name) : null}
              onMouseEnter={() => setHover(name)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={cx} cy={cy}
                r={isHover ? 14 : Math.max(8, Math.min(14, 6 + (count / maxVal) * 10))}
                fill={getColor(name)}
                stroke={isHover ? 'var(--brand)' : 'var(--border)'}
                strokeWidth={isHover ? 2 : 1}
                style={{ transition: 'all 0.15s' }}
              />
              <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: isHover ? 7 : 6, fontWeight: 700, fill: 'var(--text-primary)', pointerEvents: 'none' }}>
                {name.length > 2 ? name.slice(0, 2) : name}
              </text>
              {isHover && count > 0 && (
                <text x={cx} y={cy - 16} textAnchor="middle"
                  style={{ fontSize: 8, fontWeight: 800, fill: 'var(--brand)' }}>
                  {count}건
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          padding: '4px 12px', borderRadius: 8, background: 'var(--bg-elevated)',
          border: '1px solid var(--border)', fontSize: 12, fontWeight: 700,
          color: 'var(--text-primary)', whiteSpace: 'nowrap',
        }}>
          {hover} {stats[hover] ? `${stats[hover]}건` : '데이터 없음'}
        </div>
      )}
    </div>
  );
}
