'use client';
import { useState } from 'react';
import type { AptSubscription } from '@/types/database';

const STATUS_CONFIG = {
  open:     { label: '접수중', color: 'var(--kd-success)', bg: 'var(--kd-success-dim)', icon: '✅' },
  upcoming: { label: '예정',   color: 'var(--kd-warning)', bg: 'var(--kd-warning-dim)', icon: '📅' },
  closed:   { label: '마감',   color: 'var(--kd-text-dim)', bg: 'rgba(100,116,139,0.15)', icon: '🔒' },
};

function fmtPrice(n: number | null) {
  if (!n) return '-';
  return (n / 10000).toFixed(0) + '억';
}

function daysLeft(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  const d = Math.ceil(diff / 86400000);
  if (d < 0) return null;
  if (d === 0) return '오늘 마감';
  return `D-${d}`;
}

export default function AptClient({ apts, isDemo }: { apts: AptSubscription[]; isDemo: boolean }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'upcoming' | 'closed'>('all');
  const [search, setSearch] = useState('');

  const filtered = apts
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => !search || a.name.includes(search) || a.location.includes(search));

  const counts = {
    all: apts.length,
    open: apts.filter(a => a.status === 'open').length,
    upcoming: apts.filter(a => a.status === 'upcoming').length,
    closed: apts.filter(a => a.status === 'closed').length,
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--kd-text)' }}>🏠 청약 정보</h1>
        {isDemo && (
          <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'var(--kd-primary-dim)', color: 'var(--kd-primary)', border: '1px solid rgba(59,130,246,0.3)' }}>
            💡 미리보기 데이터
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {(['open', 'upcoming', 'closed'] as const).map(s => {
          const c = STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setFilter(filter === s ? 'all' : s)}
              aria-pressed={filter === s}
              style={{
                background: filter === s ? c.bg : 'var(--kd-surface)',
                border: `1px solid ${filter === s ? c.color : 'var(--kd-border)'}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                transition: 'all 0.15s', textAlign: 'left',
              }}>
              <div style={{ fontSize: 11, color: c.color, fontWeight: 700, marginBottom: 4 }}>{c.icon} {c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--kd-text)' }}>{counts[s]}</div>
              <div style={{ fontSize: 11, color: 'var(--kd-text-dim)' }}>단지</div>
            </button>
          );
        })}
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="단지명 또는 지역 검색..."
          className="kd-input"
          style={{ maxWidth: 260 }}
        />
        <div style={{ display: 'flex', gap: 4, background: 'var(--kd-surface)', borderRadius: 10, padding: 4, border: '1px solid var(--kd-border)' }}>
          {([['all', '전체'], ['open', '접수중'], ['upcoming', '예정'], ['closed', '마감']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              style={{
                padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filter === key ? 'var(--kd-primary)' : 'transparent',
                color: filter === key ? 'white' : 'var(--kd-text-muted)',
                transition: 'all 0.15s',
              }}>{label}</button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--kd-text-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
            <div>조건에 맞는 청약이 없습니다</div>
          </div>
        ) : filtered.map(apt => {
          const s = STATUS_CONFIG[apt.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.closed;
          const dl = daysLeft(apt.application_end);
          return (
            <div key={apt.id} style={{
              background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 14, padding: '20px 22px',
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--kd-border-hover)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--kd-border)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--kd-text)' }}>{apt.name}</h3>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--kd-text-muted)' }}>📍 {apt.location} · {apt.total_units.toLocaleString()}세대 · {apt.subscription_type}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {dl && apt.status === 'open' && (
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--kd-danger)', background: 'var(--kd-danger-dim)', padding: '4px 10px', borderRadius: 8 }}>{dl}</div>
                  )}
                  {apt.competition_rate && (
                    <div style={{ fontSize: 12, color: 'var(--kd-warning)', marginTop: 4 }}>경쟁률 {apt.competition_rate}:1</div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
                {[
                  { label: '접수 시작', date: apt.application_start },
                  { label: '접수 마감', date: apt.application_end },
                  ...(apt.move_in_date ? [{ label: '입주 예정', date: apt.move_in_date }] : []),
                ].map((step, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--kd-text-dim)', marginBottom: 4, whiteSpace: 'nowrap' }}>{step.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--kd-text)', whiteSpace: 'nowrap' }}>
                        {new Date(step.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ width: 40, height: 1, background: 'var(--kd-border)', margin: '12px 8px 0', flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Price & action */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--kd-text-muted)' }}>
                  💰 분양가{' '}
                  <span style={{ color: 'var(--kd-text)', fontWeight: 700 }}>
                    {apt.min_price && apt.max_price
                      ? `${fmtPrice(apt.min_price)} ~ ${fmtPrice(apt.max_price)}`
                      : apt.min_price ? `${fmtPrice(apt.min_price)}~` : '미정'}
                  </span>
                </div>
                {apt.homepage_url && apt.status !== 'closed' && (
                  <a href={apt.homepage_url} target="_blank" rel="noopener noreferrer" style={{
                    padding: '7px 14px', borderRadius: 8,
                    background: apt.status === 'open' ? 'var(--kd-success)' : 'transparent',
                    border: `1px solid ${apt.status === 'open' ? 'var(--kd-success)' : 'var(--kd-border)'}`,
                    color: apt.status === 'open' ? 'white' : 'var(--kd-text-muted)',
                    textDecoration: 'none', fontSize: 13, fontWeight: 600,
                    transition: 'all 0.15s',
                  }}>
                    {apt.status === 'open' ? '청약 신청하기 →' : '청약 예약 보기 →'}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--kd-text-dim)', textAlign: 'right' }}>
        ※ 청약 일정은 변경될 수 있습니다. 반드시 청약홈에서 최종 확인 바랍니다.
      </p>
    </div>
  );
}