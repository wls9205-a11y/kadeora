'use client';
import { useState, useEffect } from 'react';

const DB_LIMIT = 8 * 1024 * 1024 * 1024; // 8GB Pro plan

function DonutGauge({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const percent = Math.min(Math.round((value / max) * 100), 100);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const statusColor = percent > 80 ? '#F87171' : percent > 50 ? '#FBBF24' : color;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 128, height: 128 }}>
        <svg width="128" height="128" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#1E3050" strokeWidth="8" />
          <circle cx="60" cy="60" r={radius} fill="none" stroke={statusColor} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{percent}%</span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>사용중</span>
        </div>
      </div>
      <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginTop: 8, color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

function StatCard({ icon, value, label, bg }: { icon: string; value: string | number; label: string; bg: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, background: bg, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ fontSize: 'var(--fs-xl)', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function TableBar({ name, sizeBytes, maxBytes, size, rows }: { name: string; sizeBytes: number; maxBytes: number; size: string; rows: number }) {
  const percent = maxBytes > 0 ? Math.min((sizeBytes / maxBytes) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', marginBottom: 3 }}>
        <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{name}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>{(rows ?? 0).toLocaleString()}행 · {size}</span>
      </div>
      <div style={{ height: 6, background: '#162544', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: 'linear-gradient(90deg, #34D399, #34D399)',
          width: `${Math.max(percent, 2)}%`,
          transition: 'width 0.7s ease',
        }} />
      </div>
    </div>
  );
}

export default function InfraPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/infra-stats')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>로딩 중...</div>
  );
  if (!data || data.error) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--error)' }}>데이터를 가져올 수 없습니다</div>
  );

  const db = data.dbStats;
  const github = data.github;
  const vercel = data.vercel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🖥️ 인프라 모니터링</h1>
        <button onClick={() => window.location.reload()} style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 8,
          padding: '6px 12px', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', cursor: 'pointer',
        }}>🔄 새로고침</button>
      </div>

      {/* === Supabase === */}
      <div style={{
        padding: 24, borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(52,211,153,0.08) 0%, rgba(17,24,39,0.95) 100%)',
        border: '1px solid rgba(52,211,153,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xl)' }}>⚡</div>
          <div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>Supabase</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Pro Plan · Seoul Region</div>
          </div>
        </div>

        {db ? (
          <>
            {/* 도넛 게이지 + KPI */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
                <DonutGauge value={db.db_size_bytes} max={DB_LIMIT} label={`${db.db_size_pretty} / 8GB`} color="#34D399" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, flex: 1, minWidth: 200 }}>
                  <StatCard icon="🔌" value={db.active_connections ?? 0} label="활성 커넥션" bg="rgba(96,165,250,0.08)" />
                  <StatCard icon="⚡" value={`${db.cache_hit_ratio ?? 0}%`} label="캐시 히트율" bg="rgba(52,211,153,0.08)" />
                  <StatCard icon="📊" value={db.total_rows ?? 0} label="총 행 수" bg="rgba(167,139,250,0.08)" />
                  <StatCard icon="📁" value={db.index_size ?? '0'} label="인덱스" bg="rgba(251,146,60,0.08)" />
                </div>
              </div>
            </div>

            {/* 주간 활성 유저 */}
            <div style={{
              marginBottom: 20, padding: 16, borderRadius: 12,
              background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.12)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(251,191,36,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-2xl)' }}>👥</div>
              <div>
                <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{data.weeklyActive ?? 0}명</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>주간 활성 유저 (최근 7일, 실제 유저)</div>
              </div>
            </div>

            {/* 테이블별 막대 차트 */}
            <details>
              <summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', marginBottom: 12 }}>
                📊 테이블별 사용량 Top 15
              </summary>
              <div style={{ background: 'rgba(17,24,39,0.5)', borderRadius: 12, padding: 16 }}>
                {(db.tables ?? []).map((t: any) => (
                  <TableBar key={t.name} name={t.name} sizeBytes={t.size_bytes} maxBytes={db.tables[0]?.size_bytes || 1} size={t.size} rows={t.rows} />
                ))}
              </div>
            </details>
          </>
        ) : (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', textAlign: 'center', padding: 20 }}>DB 통계를 가져올 수 없습니다</div>
        )}
      </div>

      {/* === Vercel === */}
      <div style={{
        padding: 24, borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(17,24,39,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xl)' }}>▲</div>
          <div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>Vercel</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Pro Plan</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Bandwidth', value: '1TB', sub: '/ 월', barPct: 3, barColor: '#60A5FA' },
            { label: 'Serverless', value: '1,000h', sub: '/ 월', barPct: 5, barColor: '#34D399' },
            { label: 'Edge Requests', value: '∞', sub: '', barPct: 0, barColor: '' },
          ].map(item => (
            <div key={item.label} style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)' }}>{item.value}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginBottom: 6 }}>{item.label} {item.sub}</div>
              {item.barPct > 0 ? (
                <>
                  <div style={{ height: 5, background: '#162544', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: item.barColor, borderRadius: 3, width: `${item.barPct}%` }} />
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 3 }}>여유로움</div>
                </>
              ) : (
                <div style={{ fontSize: 'var(--fs-xs)', color: '#34D399', marginTop: 3 }}>무제한</div>
              )}
            </div>
          ))}
        </div>

        {vercel?.deployments ? (
          <details>
            <summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', marginBottom: 8 }}>🚀 최근 배포</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {vercel.deployments.map((d: any, i: number) => (
                <div key={d.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                    background: d.state === 'READY' ? '#34D399' : d.state === 'ERROR' ? '#F87171' : '#FBBF24',
                    boxShadow: d.state === 'READY' ? '0 0 6px rgba(52,211,153,0.4)' : d.state === 'ERROR' ? '0 0 6px rgba(248,113,113,0.4)' : 'none',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.meta || '배포'}</div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{d.created ? new Date(d.created).toLocaleString('ko-KR') : ''}</div>
                  </div>
                  <span style={{
                    fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                    background: d.state === 'READY' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                    color: d.state === 'READY' ? '#34D399' : '#F87171',
                  }}>{d.state}</span>
                </div>
              ))}
            </div>
          </details>
        ) : (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', marginBottom: 6 }}>배포 정보를 보려면 VERCEL_TOKEN이 필요합니다</div>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--fs-sm)', color: '#60A5FA', textDecoration: 'none' }}>→ Vercel 대시보드에서 확인</a>
          </div>
        )}
      </div>

      {/* === GitHub === */}
      <div style={{
        padding: 24, borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(167,139,250,0.08) 0%, rgba(17,24,39,0.95) 100%)',
        border: '1px solid rgba(167,139,250,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--fs-xl)' }}>🐙</div>
          <div>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--text-primary)' }}>GitHub</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>wls9205-a11y/kadeora</div>
          </div>
        </div>

        {github ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              <StatCard icon="💾" value={github.size_pretty} label="레포 크기" bg="rgba(167,139,250,0.08)" />
              <StatCard icon="🐛" value={github.open_issues} label="Open Issues" bg="rgba(251,191,36,0.08)" />
              <StatCard icon="🌿" value={github.default_branch} label="기본 브랜치" bg="rgba(52,211,153,0.08)" />
            </div>

            <details>
              <summary style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', marginBottom: 8 }}>📝 최근 커밋 5개</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(github.recent_commits ?? []).map((c: any, i: number) => (
                  <div key={c.sha || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)' }}>
                    <code style={{ fontSize: 'var(--fs-xs)', color: '#a78bfa', fontFamily: 'monospace', background: 'rgba(167,139,250,0.1)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>{c.sha}</code>
                    <div style={{ flex: 1, fontSize: 'var(--fs-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</div>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', flexShrink: 0 }}>{c.date ? new Date(c.date).toLocaleDateString('ko-KR') : ''}</span>
                  </div>
                ))}
              </div>
            </details>
          </>
        ) : (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', textAlign: 'center', padding: 16 }}>
            GitHub 데이터를 가져올 수 없습니다{' '}
            <a href="https://github.com/wls9205-a11y/kadeora" target="_blank" rel="noopener noreferrer" style={{ color: '#A78BFA', textDecoration: 'none' }}>→ GitHub</a>
          </div>
        )}
      </div>

      {/* === 바로가기 === */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {[
          { icon: '⚡', label: 'Supabase', sub: 'DB 대시보드', href: 'https://supabase.com/dashboard/project/tezftxakuwhsclarprlz', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.15)' },
          { icon: '▲', label: 'Vercel', sub: '배포 / Analytics', href: 'https://vercel.com/dashboard', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' },
          { icon: '🐙', label: 'GitHub', sub: '소스코드', href: 'https://github.com/wls9205-a11y/kadeora', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.15)' },
          { icon: '📊', label: 'GA4', sub: '트래픽 분석', href: 'https://analytics.google.com', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.15)' },
        ].map(link => (
          <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" style={{
            display: 'block', padding: 16, borderRadius: 12, textDecoration: 'none', textAlign: 'center',
            background: link.bg, border: `1px solid ${link.border}`,
            transition: 'transform 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div style={{ fontSize: 'var(--fs-2xl)', marginBottom: 6 }}>{link.icon}</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{link.label}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{link.sub}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
