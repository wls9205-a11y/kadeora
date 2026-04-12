'use client';
import { useState, useMemo } from 'react';
import { calcAcquisitionTax, calcPricePerPyeong } from '@/lib/interest-utils';

interface TypeInfo {
  type: string;
  lttot_top_amount: number;
  lttot_min_amount?: number;
  lttot_avg_amount?: number;
  floor_prices?: { range: string; price: number }[];
  balcony_price?: number;
  supply?: number;
}

interface Props {
  types: TypeInfo[];
  options?: { name: string; price: number }[];
  siteName: string;
  priceSource?: string;
}

export default function CostSimulator({ types, options = [], siteName, priceSource }: Props) {
  const validTypes = types.filter(t => t.lttot_top_amount > 0 || (t.lttot_avg_amount && t.lttot_avg_amount > 0));
  const [selectedType, setSelectedType] = useState(0);
  const [selectedFloor, setSelectedFloor] = useState('avg');
  const [includeBalcony, setIncludeBalcony] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(new Set());

  if (validTypes.length === 0) return null;

  const t = validTypes[selectedType] || validTypes[0];
  const typeLabel = t.type || '기본';
  const exclusiveArea = parseFloat((t.type || '0').replace(/[A-Za-z]/g, ''));

  // 분양가 결정 (층 선택 기반)
  const basePrice = useMemo(() => {
    if (selectedFloor === 'min' && t.lttot_min_amount) return t.lttot_min_amount;
    if (selectedFloor === 'max') return t.lttot_top_amount;
    if (selectedFloor === 'avg' && t.lttot_avg_amount) return t.lttot_avg_amount;
    // floor_prices에서 선택
    if (t.floor_prices && t.floor_prices.length > 0) {
      const fpIdx = parseInt(selectedFloor);
      if (!isNaN(fpIdx) && t.floor_prices[fpIdx]) return t.floor_prices[fpIdx].price;
    }
    return t.lttot_avg_amount || t.lttot_top_amount;
  }, [selectedFloor, t]);

  const balconyPrice = includeBalcony && t.balcony_price ? t.balcony_price : 0;
  const optionsTotal = Array.from(selectedOptions).reduce((s, i) => s + (options[i]?.price || 0), 0);
  const taxResult = calcAcquisitionTax(basePrice, exclusiveArea);
  const totalCost = basePrice + balconyPrice + optionsTotal + taxResult.total;
  const ppyeong = calcPricePerPyeong(totalCost, exclusiveArea);

  // 층 선택 옵션 구성
  const floorOptions: { value: string; label: string }[] = [];
  if (t.lttot_min_amount) floorOptions.push({ value: 'min', label: '저층 (최저가)' });
  if (t.floor_prices && t.floor_prices.length > 0) {
    t.floor_prices.forEach((fp, i) => floorOptions.push({ value: String(i), label: fp.range }));
  } else {
    if (t.lttot_avg_amount) floorOptions.push({ value: 'avg', label: '중층 (평균)' });
  }
  floorOptions.push({ value: 'max', label: '고층 (최고가)' });
  // 중복 제거
  const seen = new Set<string>();
  const uniqueFloorOptions = floorOptions.filter(o => { if (seen.has(o.value)) return false; seen.add(o.value); return true; });

  return (
    <div style={{ padding: '16px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, marginBottom: 14, color: 'var(--text-primary)' }}>
        실입주 총비용 시뮬레이터
        {priceSource === 'estimated' && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontWeight: 600 }}>추정치 기반</span>}
      </div>

      {/* 선택 영역 */}
      <div style={{ display: 'grid', gridTemplateColumns: validTypes.length > 1 ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 14 }}>
        {validTypes.length > 1 && (
          <select
            value={selectedType}
            onChange={e => { setSelectedType(Number(e.target.value)); setSelectedFloor('avg'); }}
            style={{
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
            }}
          >
            {validTypes.map((vt, i) => (
              <option key={i} value={i}>{vt.type || `타입 ${i + 1}`}</option>
            ))}
          </select>
        )}
        {uniqueFloorOptions.length > 1 && (
          <select
            value={selectedFloor}
            onChange={e => setSelectedFloor(e.target.value)}
            style={{
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
            }}
          >
            {uniqueFloorOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* 옵션 체크 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {t.balcony_price && t.balcony_price > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={includeBalcony} onChange={e => setIncludeBalcony(e.target.checked)} />
            발코니 확장 ({t.balcony_price.toLocaleString()}만)
          </label>
        )}
        {options.map((opt, i) => (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selectedOptions.has(i)}
              onChange={e => {
                const next = new Set(selectedOptions);
                if (e.target.checked) next.add(i); else next.delete(i);
                setSelectedOptions(next);
              }}
            />
            {opt.name} ({opt.price.toLocaleString()}만)
          </label>
        ))}
      </div>

      {/* 비용 내역 */}
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span>분양가 ({typeLabel} {uniqueFloorOptions.find(o => o.value === selectedFloor)?.label || ''})</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{basePrice.toLocaleString()}만</span>
        </div>
        {balconyPrice > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span>발코니 확장비</span>
            <span>+ {balconyPrice.toLocaleString()}만</span>
          </div>
        )}
        {optionsTotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span>옵션 합계</span>
            <span>+ {optionsTotal.toLocaleString()}만</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
          <span>취득세 (1주택 기준)</span>
          <span>+ {taxResult.total.toLocaleString()}만</span>
        </div>

        {/* 총합 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px',
          borderTop: '1.5px solid var(--border)', marginTop: 6,
          fontSize: 15, fontWeight: 800, color: 'var(--text-primary)',
        }}>
          <span>예상 총비용</span>
          <span style={{ color: 'var(--brand)' }}>
            {totalCost.toLocaleString()}만
            {ppyeong > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginLeft: 6 }}>
              평당 {ppyeong.toLocaleString()}만
            </span>}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
        * 1주택 기준 취득세 추정치입니다. 정확한 세금은 세무 전문가 상담을 권장합니다.
      </div>
    </div>
  );
}
