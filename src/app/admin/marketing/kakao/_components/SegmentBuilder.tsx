'use client';
import { useEffect, useRef, useState } from 'react';

export type ActiveDays = 7 | 30 | 90 | 'all';
export type MessageType = 'ad' | 'info';

export interface SegmentFilter {
  regions: string[];
  marketing_required: boolean;
  channel_required: boolean;
  active_days: ActiveDays;
  message_type: MessageType;
  age_groups: string[];
  genders: string[];
}

const REGIONS = ['부산', '서울', '경남', '울산', '경기', '광주', '대구', '충북', '전북'];
const AGE_GROUPS = ['10대', '20대', '30대', '40대', '50대', '60대+'];
const GENDERS = ['남', '여'];
const ACTIVE_DAYS_OPTS: ActiveDays[] = [7, 30, 90, 'all'];

interface PreviewResp {
  count?: number;
  sample?: Array<Record<string, unknown>>;
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function SegmentBuilder({
  filter,
  onFilterChange,
  segmentName,
  onSegmentNameChange,
  onOpenSend,
}: {
  filter: SegmentFilter;
  onFilterChange: (f: SegmentFilter) => void;
  segmentName: string;
  onSegmentNameChange: (n: string) => void;
  onOpenSend: () => void;
}) {
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetch('/api/admin/marketing/kakao/segment/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filter),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(`http ${r.status}`);
          const j: PreviewResp = await r.json();
          setPreview(j);
          setErr(null);
        })
        .catch((e) => setErr(e?.message ?? 'preview failed'))
        .finally(() => setLoading(false));
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filter]);

  const update = <K extends keyof SegmentFilter>(k: K, v: SegmentFilter[K]) => {
    onFilterChange({ ...filter, [k]: v });
  };

  const onSave = async () => {
    const name = segmentName.trim() || prompt('세그먼트 이름?') || '';
    if (!name) return;
    onSegmentNameChange(name);
    try {
      const r = await fetch('/api/admin/marketing/kakao/segment/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filter_json: filter }),
      });
      if (!r.ok) throw new Error(`http ${r.status}`);
      alert('저장 완료');
    } catch (e) {
      alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const sample = preview?.sample ?? [];
  const sampleCols = sample.length > 0 ? Object.keys(sample[0]) : [];

  return (
    <section
      style={{
        padding: 14,
        borderRadius: 'var(--radius-md, 10px)',
        background: 'var(--bg-elevated, #1f2028)',
        border: '1px solid var(--border, #2a2b35)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, margin: 0 }}>세그먼트 빌더</h2>
        <input
          value={segmentName}
          onChange={(e) => onSegmentNameChange(e.target.value)}
          placeholder="세그먼트 이름"
          style={{
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'var(--bg-base, #0d0e14)',
            color: 'var(--text-primary, #fff)',
            border: '1px solid var(--border, #2a2b35)',
            width: 180,
          }}
        />
      </div>

      <Field label="지역">
        <ChipGroup
          options={REGIONS}
          selected={filter.regions}
          onToggle={(v) => update('regions', toggle(filter.regions, v))}
        />
      </Field>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Field label="마케팅 동의">
          <Toggle
            value={filter.marketing_required}
            onChange={(v) => update('marketing_required', v)}
            onLabel="✓필수"
            offLabel="무관"
          />
        </Field>
        <Field label="채널 친구">
          <Toggle
            value={filter.channel_required}
            onChange={(v) => update('channel_required', v)}
            onLabel="✓필수"
            offLabel="무관"
          />
        </Field>
      </div>

      <Field label="활성 기간">
        <ChipGroup
          options={ACTIVE_DAYS_OPTS.map((d) => String(d))}
          selected={[String(filter.active_days)]}
          onToggle={(v) => update('active_days', v === 'all' ? 'all' : (Number(v) as ActiveDays))}
          single
        />
      </Field>

      <Field label="메시지 유형">
        <ChipGroup
          options={['ad', 'info']}
          selected={[filter.message_type]}
          onToggle={(v) => update('message_type', v as MessageType)}
          single
        />
      </Field>

      <Field label="연령대">
        <ChipGroup
          options={AGE_GROUPS}
          selected={filter.age_groups}
          onToggle={(v) => update('age_groups', toggle(filter.age_groups, v))}
        />
      </Field>

      <Field label="성별">
        <ChipGroup
          options={GENDERS}
          selected={filter.genders}
          onToggle={(v) => update('genders', toggle(filter.genders, v))}
        />
      </Field>

      <div
        style={{
          marginTop: 4,
          padding: 10,
          borderRadius: 8,
          background: 'var(--bg-base, #0d0e14)',
          border: '1px solid var(--border, #2a2b35)',
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-tertiary, #888)', marginBottom: 6 }}>
          매칭 결과
          {loading && <span style={{ marginLeft: 8 }}>로드 중…</span>}
          {err && <span style={{ marginLeft: 8, color: '#f87171' }}>실패: {err}</span>}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>
          {preview?.count == null ? '—' : preview.count.toLocaleString()}명
        </div>
        {sample.length > 0 && (
          <div style={{ marginTop: 8, overflow: 'auto', maxHeight: 220 }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {sampleCols.map((c) => (
                    <th
                      key={c}
                      style={{
                        textAlign: 'left',
                        padding: '4px 6px',
                        borderBottom: '1px solid var(--border, #2a2b35)',
                        color: 'var(--text-tertiary, #888)',
                      }}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sample.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {sampleCols.map((c) => (
                      <td key={c} style={{ padding: '4px 6px', borderBottom: '1px solid var(--border, #2a2b35)' }}>
                        {String(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={onSave}
          style={btnStyle('primary')}
        >
          💾 세그먼트 저장
        </button>
        <button
          onClick={onOpenSend}
          style={btnStyle('default')}
        >
          📤 직접 발송
        </button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary, #888)' }}>{label}</span>
      {children}
    </div>
  );
}

function ChipGroup({
  options,
  selected,
  onToggle,
  single,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  single?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            style={{
              fontSize: 11,
              padding: '5px 10px',
              borderRadius: 999,
              cursor: 'pointer',
              background: on ? 'var(--accent, #3b82f6)' : 'transparent',
              color: on ? '#fff' : 'var(--text-secondary, #ccc)',
              border: `1px solid ${on ? 'var(--accent, #3b82f6)' : 'var(--border, #2a2b35)'}`,
            }}
          >
            {single && on ? '● ' : ''}
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  value,
  onChange,
  onLabel,
  offLabel,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          fontSize: 11,
          padding: '5px 10px',
          borderRadius: 999,
          cursor: 'pointer',
          background: value ? 'var(--accent, #3b82f6)' : 'transparent',
          color: value ? '#fff' : 'var(--text-secondary, #ccc)',
          border: `1px solid ${value ? 'var(--accent, #3b82f6)' : 'var(--border, #2a2b35)'}`,
        }}
      >
        {onLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          fontSize: 11,
          padding: '5px 10px',
          borderRadius: 999,
          cursor: 'pointer',
          background: !value ? 'var(--accent, #3b82f6)' : 'transparent',
          color: !value ? '#fff' : 'var(--text-secondary, #ccc)',
          border: `1px solid ${!value ? 'var(--accent, #3b82f6)' : 'var(--border, #2a2b35)'}`,
        }}
      >
        {offLabel}
      </button>
    </div>
  );
}

function btnStyle(variant: 'primary' | 'default'): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 700,
    padding: '8px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    background: variant === 'primary' ? 'var(--accent, #3b82f6)' : 'transparent',
    color: variant === 'primary' ? '#fff' : 'var(--text-secondary, #ccc)',
    border: `1px solid ${variant === 'primary' ? 'var(--accent, #3b82f6)' : 'var(--border, #2a2b35)'}`,
  };
}
