interface Props {
  specialDate?: string;
  rank1Date?: string;
  rank2Date?: string;
  announceDate?: string;
}

function fmtDate(d: string): string {
  const s = String(d);
  if (s.length === 8 && /^\d+$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }
  return s;
}

function classifyStep(date: string | undefined, nextDate: string | undefined): 'done' | 'active' | 'pending' {
  if (!date) return 'pending';
  const now = Date.now();
  const dt = new Date(fmtDate(date)).getTime();
  if (isNaN(dt)) return 'pending';
  if (dt < now) {
    if (nextDate) {
      const ndt = new Date(fmtDate(nextDate)).getTime();
      if (!isNaN(ndt) && ndt >= now) return 'done';
      return 'done';
    }
    return 'done';
  }
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  if (dt >= startToday.getTime() && dt - startToday.getTime() < 86400000 * 7) return 'active';
  return 'pending';
}

export default function AptScheduleTimeline({ specialDate, rank1Date, rank2Date, announceDate }: Props) {
  if (!specialDate && !rank1Date && !rank2Date && !announceDate) return null;

  const steps = [
    { name: '특별', date: specialDate },
    { name: '1순위', date: rank1Date },
    { name: '2순위', date: rank2Date },
    { name: '발표', date: announceDate },
  ];

  return (
    <div className="apt-timeline" style={{ position: 'relative', padding: '16px 12px', margin: '12px 0', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <div className="apt-timeline-line" style={{ position: 'absolute', left: 22, top: 24, bottom: 24, width: 2, background: 'var(--border)' }} />
      {steps.map((s, i) => {
        const next = steps[i + 1]?.date;
        const state = classifyStep(s.date, next);
        const dotColor = state === 'done' ? 'var(--accent-green)' : state === 'active' ? 'var(--brand)' : 'var(--border)';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', position: 'relative' }}>
            <div
              className={`apt-timeline-dot ${state}`}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: dotColor,
                border: state === 'active' ? '3px solid var(--brand-bg)' : '2px solid var(--bg-card)',
                boxShadow: state === 'active' ? '0 0 0 3px var(--brand)' : 'none',
                zIndex: 1, marginLeft: 4,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.date ? fmtDate(s.date) : '미정'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
