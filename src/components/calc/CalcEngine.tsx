'use client';
import { useState, useMemo, useCallback } from 'react';
import type { CalcMeta, CalcInput } from '@/lib/calc/registry';
import { FORMULAS, type CalcResult } from '@/lib/calc/formulas';

const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 14 };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 };
const hint: React.CSSProperties = { fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 };

function InputField({ input, value, onChange, values }: { input: CalcInput; value: number | string; onChange: (v: number | string) => void; values: Record<string, number | string> }) {
  // 조건부 표시
  if (input.condition) {
    const [field, expected] = input.condition.split('=');
    if (String(values[field]) !== expected) return null;
  }

  switch (input.type) {
    case 'currency':
      return (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>{input.label}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="text" inputMode="numeric" value={Number(value).toLocaleString('ko-KR')}
              onChange={e => onChange(Number(e.target.value.replace(/[^0-9-]/g, '')) || 0)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }} />
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>{input.unit || '원'}</span>
          </div>
          {input.hint && <div style={hint}>{input.hint}</div>}
        </div>
      );
    case 'number':
    case 'percent':
      return (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>{input.label}</label>
          <input type="number" inputMode="decimal" value={value} min={input.min} max={input.max} step={input.step || 1}
            onChange={e => onChange(Number(e.target.value))}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }} />
          {input.hint && <div style={hint}>{input.hint}</div>}
        </div>
      );
    case 'range':
      return (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>{input.label}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="range" min={input.min || 0} max={input.max || 100} step={input.step || 1} value={value}
              onChange={e => onChange(Number(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--brand)' }} />
            <span style={{ fontSize: 16, fontWeight: 800, minWidth: 50, textAlign: 'right', color: 'var(--text-primary)' }}>{value}{input.unit || ''}</span>
          </div>
        </div>
      );
    case 'radio':
      return (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>{input.label}</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {input.options?.map(opt => (
              <button key={String(opt.value)} onClick={() => onChange(opt.value)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  background: value === opt.value ? 'var(--brand)' : 'var(--bg-hover)',
                  color: value === opt.value ? 'var(--text-inverse, #fff)' : 'var(--text-secondary)' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      );
    case 'select':
      return (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>{input.label}</label>
          <select value={String(value)} onChange={e => onChange(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 14 }}>
            {input.options?.map(opt => <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>)}
          </select>
        </div>
      );
    case 'stepper':
      return (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>{input.label}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => onChange(Math.max(input.min || 0, Number(value) - 1))}
              style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 18 }}>−</button>
            <span style={{ fontSize: 18, fontWeight: 800, minWidth: 30, textAlign: 'center' }}>{value}</span>
            <button onClick={() => onChange(Math.min(input.max || 99, Number(value) + 1))}
              style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 18 }}>+</button>
          </div>
        </div>
      );
    case 'date':
      return (
        <div style={{ marginBottom: 16 }}>
          <label style={label}>{input.label}</label>
          <input type="date" value={String(value)} onChange={e => onChange(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 14 }} />
        </div>
      );
    default:
      return null;
  }
}

export default function CalcEngine({ calc }: { calc: CalcMeta }) {
  const [values, setValues] = useState<Record<string, number | string>>(() => {
    const init: Record<string, number | string> = {};
    for (const input of calc.inputs) init[input.id] = input.default;
    return init;
  });

  const setValue = useCallback((id: string, v: number | string) => {
    setValues(prev => ({ ...prev, [id]: v }));
  }, []);

  const result = useMemo<CalcResult | null>(() => {
    const fn = FORMULAS[calc.formula];
    if (!fn) return null;
    try { return fn(values); } catch { return null; }
  }, [values, calc.formula]);

  return (
    <div>
      {/* 입력 영역 */}
      <div style={card}>
        {calc.inputs.map(input => (
          <InputField key={input.id} input={input} value={values[input.id]} onChange={v => setValue(input.id, v)} values={values} />
        ))}
      </div>

      {/* 결과 영역 */}
      {result && (
        <div style={{ ...card, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{result.main.label}</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: result.main.color || 'var(--brand)', lineHeight: 1.2, wordBreak: 'break-all' }}>
            {result.main.value}
          </div>

          {result.details.length > 0 && (
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              {result.details.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < result.details.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* 공유 버튼 */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button onClick={() => {
              const text = `${calc.titleShort} 결과: ${result.main.value}\n${result.details.map(d => `${d.label}: ${d.value}`).join('\n')}\n\n카더라에서 계산해보기`;
              const url = `https://kadeora.app/calc/${calc.category}/${calc.slug}`;
              if (navigator.share) navigator.share({ title: calc.titleShort, text, url }).catch(() => {});
              else navigator.clipboard.writeText(text + '\n' + url).then(() => alert('복사되었습니다!'));
            }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              결과 공유
            </button>
            <button onClick={() => {
              const text = `${result.main.label}: ${result.main.value}`;
              navigator.clipboard.writeText(text).then(() => alert('복사되었습니다!'));
            }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--bg-hover)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>
              결과 복사
            </button>
          </div>
        </div>
      )}

      {/* 면책 */}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6, marginTop: 8, padding: '0 8px' }}>
        본 계산기는 참고용이며 법적 효력이 없습니다.
        {calc.legalBasis && <> 기준: {calc.legalBasis}.</>}
        {' '}v{calc.version} ({calc.lastUpdated})
      </div>
    </div>
  );
}
