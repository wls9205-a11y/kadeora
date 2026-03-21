'use client';
import { useState, useEffect } from 'react';

const DB_LIMIT = 8 * 1024 * 1024 * 1024; // 8GB Pro plan

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
  const dbUsagePercent = db ? Math.round((db.db_size_bytes / DB_LIMIT) * 100) : 0;

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 16 };
  const kpiBox: React.CSSProperties = { background: 'var(--bg-hover)', borderRadius: 10, padding: 14, textAlign: 'center' };
  const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>🖥️ 인프라 모니터링</h1>
        <button onClick={() => window.location.reload()} style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 8,
          padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
        }}>🔄 새로고침</button>
      </div>

      {/* === Supabase === */}
      <div style={card}>
        <div style={sectionTitle}><span style={{ color: '#22c55e' }}>⚡</span> Supabase (Pro)</div>

        {db && (
          <>
            {/* DB 사이즈 게이지 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, color: 'var(--text-secondary)' }}>
                <span>DB 사용량</span>
                <span>{db.db_size_pretty} / 8GB ({dbUsagePercent}%)</span>
              </div>
              <div style={{ height: 14, background: 'var(--bg-hover)', borderRadius: 7, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 7, transition: 'width 0.5s',
                  background: dbUsagePercent > 80 ? '#ef4444' : dbUsagePercent > 50 ? '#eab308' : '#22c55e',
                  width: `${Math.min(dbUsagePercent, 100)}%`,
                }} />
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
              <div style={kpiBox}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{db.active_connections ?? 0}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>활성 커넥션</div>
              </div>
              <div style={kpiBox}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{db.cache_hit_ratio ?? 0}%</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>캐시 히트율</div>
              </div>
              <div style={kpiBox}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{(db.total_rows ?? 0).toLocaleString()}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>총 행 수</div>
              </div>
              <div style={kpiBox}>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{db.index_size ?? '0'}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>인덱스 크기</div>
              </div>
              <div style={kpiBox}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{data.weeklyActive ?? 0}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>주간 활성 유저</div>
              </div>
            </div>

            {/* 테이블별 사용량 */}
            <details>
              <summary style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', marginBottom: 8 }}>
                테이블별 사용량 Top 15
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(db.tables ?? []).map((t: any) => (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: 11 }}>{t.name}</span>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{(t.rows ?? 0).toLocaleString()}행</span>
                      <span style={{ fontWeight: 600, width: 60, textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>{t.size}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
        {!db && <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>DB 통계를 가져올 수 없습니다</div>}
      </div>

      {/* === Vercel === */}
      <div style={card}>
        <div style={sectionTitle}><span>▲</span> Vercel (Pro)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 12 }}>
          {[['Bandwidth', '1TB/월'], ['Serverless', '1,000시간/월'], ['Edge', '무제한']].map(([l, v]) => (
            <div key={l} style={kpiBox}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>{l} 한도</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{v}</div>
            </div>
          ))}
        </div>
        {vercel?.deployments ? (
          <details>
            <summary style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', marginBottom: 8 }}>최근 배포</summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {vercel.deployments.map((d: any) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-hover)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.state === 'READY' ? '#22c55e' : d.state === 'ERROR' ? '#ef4444' : '#eab308' }} />
                    <span style={{ color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{d.meta || d.id}</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{d.created ? new Date(d.created).toLocaleDateString('ko-KR') : ''}</span>
                </div>
              ))}
            </div>
          </details>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {vercel?.message || 'Vercel 대시보드에서 확인하세요'}{' '}
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>→ Vercel</a>
          </div>
        )}
      </div>

      {/* === GitHub === */}
      <div style={card}>
        <div style={sectionTitle}><span>🐙</span> GitHub</div>
        {github ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 12 }}>
              <div style={kpiBox}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{github.size_pretty}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>레포 크기</div>
              </div>
              <div style={kpiBox}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{github.open_issues}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Open Issues</div>
              </div>
              <div style={kpiBox}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{github.default_branch}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>기본 브랜치</div>
              </div>
            </div>
            <details>
              <summary style={{ fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)', marginBottom: 8 }}>최근 커밋 5개</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(github.recent_commits ?? []).map((c: any) => (
                  <div key={c.sha} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-hover)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <code style={{ fontSize: 10, color: '#8b5cf6' }}>{c.sha}</code>
                      <span style={{ color: 'var(--text-primary)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{c.message}</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{c.date ? new Date(c.date).toLocaleDateString('ko-KR') : ''}</span>
                  </div>
                ))}
              </div>
            </details>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            GitHub 데이터를 가져올 수 없습니다{' '}
            <a href="https://github.com/wls9205-a11y/kadeora" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)' }}>→ GitHub</a>
          </div>
        )}
      </div>

      {/* === 바로가기 === */}
      <div style={card}>
        <div style={sectionTitle}>🔗 상세 대시보드 바로가기</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          {[
            { label: 'Supabase', sub: 'DB 대시보드', href: 'https://supabase.com/dashboard/project/tezftxakuwhsclarprlz', color: '#22c55e' },
            { label: 'Vercel', sub: '배포/Analytics', href: 'https://vercel.com/dashboard', color: '#fff' },
            { label: 'GitHub', sub: '소스코드', href: 'https://github.com/wls9205-a11y/kadeora', color: '#8b5cf6' },
            { label: 'GA4', sub: '트래픽 분석', href: 'https://analytics.google.com', color: '#eab308' },
          ].map(link => (
            <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" style={{
              display: 'block', padding: 12, borderRadius: 10, textDecoration: 'none', textAlign: 'center',
              background: `${link.color}10`, border: `1px solid ${link.color}25`,
              transition: 'background 0.15s',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{link.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{link.sub}</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
