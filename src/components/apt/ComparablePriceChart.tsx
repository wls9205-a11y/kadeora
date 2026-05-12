// components/apt/ComparablePriceChart.tsx
'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface PricePoint {
  name: string;
  pricePerPyeong: number;
  isCurrent?: boolean;
}

export function ComparablePriceChart({
  current,
  comparables,
}: {
  current: { name: string; pricePerPyeong: number };
  comparables: Array<{ slug: string; name: string; price_per_pyeong?: number }>;
}) {
  const data = useMemo<PricePoint[]>(() => {
    const points: PricePoint[] = [
      { name: current.name, pricePerPyeong: current.pricePerPyeong, isCurrent: true },
      ...comparables
        .filter((c) => c.price_per_pyeong)
        .slice(0, 5)
        .map((c) => ({
          name: c.name.length > 8 ? c.name.slice(0, 7) + '…' : c.name,
          pricePerPyeong: c.price_per_pyeong || 0,
          isCurrent: false,
        })),
    ];
    return points;
  }, [current, comparables]);

  if (data.length < 2) return null;

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 16, left: 8 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `${(v / 100).toFixed(0)}백만`}
          />
          <Tooltip
            formatter={(v: any) => [`${v.toLocaleString('ko')}만원/평`, '평당가']}
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="pricePerPyeong" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.isCurrent ? '#EF4444' : '#94A3B8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
