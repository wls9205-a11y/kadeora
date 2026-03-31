'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { C, KPI, Pill, ago } from '../admin-shared';

export default function AnalyticsSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7d');
  const [view, setView] = useState<'visitors' | 'insights'>('visitors');

  const load = useCallback((r: string) => {
    setLoading(true);
    fetch(`/api/admin/analytics?range=${r}`).then(res => res.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: C.textSec }}>방문자 데이터 로딩 중...</div>;
  if (!data || data.error) return <div style={{ textAlign: 'center', padding: 60, color: C.red }}>데이터 로드 실패: {data?.error || '알 수 없음'}</div>;

  const { kpi, topPages, referrers, hourly, daily, devices, recentViews } = data;
  const maxHour = Math.max(...(hourly || []).map((h: Record<string, any>) => h.count), 1);
  const maxDaily = Math.max(...(daily || []).map((d: Record<string, any>) => d.views), 1);
  const totalDevices = (devices?.mobile || 0) + (devices?.desktop || 0) + (devices?.bot || 0);

  return (
    <div>
      {/* View selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-lg)' }}>
        <Pill active={view === 'visitors'} onClick={() => setView('visitors')}>📈 방문자</Pill>
        <Pill active={view === 'insights'} onClick={() => setView('insights')}>💡 인사이트</Pill>
      </div>

      {view === 'insights' && <InsightsPanel />}
      {view !== 'insights' && <>
      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--sp-lg)' }}>
        {[['1d', '오늘'], ['7d', '7일'], ['30d', '30일']].map(([k, l]) => (
          <Pill key={k} active={range === k} onClick={() => setRange(k)}>{l}</Pill>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="mc-g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 'var(--sp-lg)' }}>
        {[
          { label: '총 조회수', value: kpi.totalViews.toLocaleString(), color: C.brand, icon: '👁️' },
          { label: '순 방문자', value: kpi.uniqueVisitors.toLocaleString(), color: C.green, icon: '👤' },
          { label: '로그인 사용자', value: kpi.withUser.toLocaleString(), color: C.purple, icon: '🔑' },
          { label: '평균 조회/방문자', value: kpi.avgViewsPerVisitor, color: C.cyan, icon: '📊' },
        ].map(item => (
          <div key={item.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 'var(--card-p) var(--sp-lg)' }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 'var(--sp-xs)' }}>{item.icon} {item.label}</div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Daily trend chart */}
      {daily && daily.length > 1 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 'var(--sp-lg)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 'var(--sp-md)' }}>일별 추이</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 100 }}>
            {daily.map((d: any, i: number) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 9, color: C.textDim }}>{d.views}</div>
                <div style={{ width: '100%', borderRadius: 3, background: `linear-gradient(to top, ${C.brand}, ${C.brandDim})`, height: `${(d.views / maxDaily) * 80}px`, minHeight: 2, transition: 'height .3s' }} />
                <div style={{ fontSize: 9, color: C.textDim }}>{d.date}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-md)', marginTop: 'var(--sp-sm)', fontSize: 11, color: C.textSec }}>
            <span>🔵 조회수</span>
            <span>평균 {daily.length > 0 ? Math.round(daily.reduce((s: number, d: any) => s + d.views, 0) / daily.length) : 0}/일</span>
          </div>
        </div>
      )}

      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
        {/* Top pages */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>인기 페이지</div>
          {(topPages || []).slice(0, 10).map((p: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < 9 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.textDim, minWidth: 16 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.brand, flexShrink: 0 }}>{p.count}</span>
              <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0, minWidth: 32 }}>{p.pct}%</span>
            </div>
          ))}
        </div>

        {/* Referrers */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>유입 경로</div>
          {(referrers || []).map((r: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: i < referrers.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <span style={{ flex: 1, fontSize: 12, color: C.text }}>{r.source}</span>
              <div style={{ width: 60, height: 6, background: C.surface, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${Math.min(parseFloat(r.pct), 100)}%`, height: '100%', background: r.source === 'Google' ? '#4285F4' : r.source === 'Naver' ? '#03C75A' : r.source.includes('Kakao') ? '#FEE500' : r.source === 'Facebook' ? '#1877F2' : C.brand, borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec, flexShrink: 0, minWidth: 28 }}>{r.count}</span>
              <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0, minWidth: 32 }}>{r.pct}%</span>
            </div>
          ))}
          {(!referrers || referrers.length === 0) && <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: 20 }}>유입 데이터 없음</div>}
        </div>
      </div>

      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
        {/* Hourly heatmap */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>시간대별 분포 (KST)</div>
          <div className="mc-hour-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
            {(hourly || []).map((h: Record<string, any>) => {
              const intensity = maxHour > 0 ? h.count / maxHour : 0;
              return (
                <div key={h.hour} style={{ textAlign: 'center' }}>
                  <div style={{
                    height: 28, borderRadius: 4,
                    background: intensity > 0.7 ? C.brand : intensity > 0.3 ? C.brandDim : intensity > 0 ? `${C.brand}30` : C.surface,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 600, color: intensity > 0.3 ? '#fff' : C.textDim,
                  }}>{h.count > 0 ? h.count : ''}</div>
                  <div style={{ fontSize: 8, color: C.textDim, marginTop: 2 }}>{h.hour}</div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 'var(--sp-sm)' }}>0시~23시 · 진할수록 방문 많음</div>
        </div>

        {/* Device breakdown */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>디바이스</div>
          {totalDevices > 0 ? (
            <>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 'var(--sp-md)' }}>
                <div style={{ width: `${(devices.mobile / totalDevices) * 100}%`, background: C.brand }} />
                <div style={{ width: `${(devices.desktop / totalDevices) * 100}%`, background: C.green }} />
                <div style={{ width: `${(devices.bot / totalDevices) * 100}%`, background: C.yellow }} />
              </div>
              {[
                { label: '📱 모바일', count: devices.mobile, color: C.brand },
                { label: '🖥️ 데스크톱', count: devices.desktop, color: C.green },
                { label: '🤖 봇/크롤러', count: devices.bot, color: C.yellow },
              ].map(d => (
                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 12, color: C.text }}>{d.label}</span>
                  <div style={{ display: 'flex', gap: 'var(--sp-sm)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{d.count.toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>{totalDevices > 0 ? ((d.count / totalDevices) * 100).toFixed(0) : 0}%</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center', padding: 20 }}>데이터 없음</div>
          )}
        </div>
      </div>

      {/* Recent views log */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>최근 방문 로그</div>
        <div style={{ overflowX: 'auto' }}>
          <div className="admin-table-wrap" style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.textDim, fontWeight: 600 }}>시간</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.textDim, fontWeight: 600 }}>페이지</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: C.textDim, fontWeight: 600 }}>유입</th>
                <th style={{ textAlign: 'center', padding: '6px 8px', color: C.textDim, fontWeight: 600 }}>기기</th>
              </tr>
            </thead>
            <tbody>
              {(recentViews || []).map((v: Record<string, any>, i: number) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '5px 8px', color: C.textSec, whiteSpace: 'nowrap' }}>{ago(v.time)}</td>
                  <td style={{ padding: '5px 8px', color: C.text, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.path}</td>
                  <td style={{ padding: '5px 8px', color: v.referrer === '직접' ? C.textDim : C.brand }}>{v.referrer}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>{v.device === 'M' ? '📱' : '🖥️'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </>}
    </div>
  );
}

// ══════════════════════════════════════
// 📊 인사이트 (검색어+공유+피드백+초대)
// ══════════════════════════════════════
export function InsightsPanel() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard?section=insights').then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: C.textSec }}>인사이트 로딩...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 40, color: C.red }}>로드 실패</div>;

  const { topSearches, noResults, sharePlatforms, topShared, feedback, inviteStats } = data;
  const totalShares = (sharePlatforms || []).reduce((s: number, p: any) => s + p.count, 0);

  return (
    <div>
      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
        {/* 인기 검색어 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🔍 인기 검색어 (24h)</div>
          {(topSearches || []).map((s: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}08` }}>
              <span style={{ fontSize: 12, color: C.text }}><span style={{ color: C.textDim, marginRight: 6 }}>{i + 1}</span>{s.query}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.brand }}>{s.count}</span>
            </div>
          ))}
          {(!topSearches || topSearches.length === 0) && <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center', padding: 16 }}>검색 데이터 없음</div>}
        </div>

        {/* 결과 없음 (콘텐츠 갭) */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🚫 결과 없음 검색 (7d)</div>
          {(noResults || []).map((s: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}08` }}>
              <span style={{ fontSize: 12, color: C.yellow }}>{s.query}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>{s.count}</span>
            </div>
          ))}
          {(!noResults || noResults.length === 0) && <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center', padding: 16 }}>데이터 없음</div>}
        </div>
      </div>

      <div className="mc-g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-md)', marginBottom: 'var(--sp-lg)' }}>
        {/* 공유 플랫폼 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>📤 공유 플랫폼 (7d) — 총 {totalShares}회</div>
          {(sharePlatforms || []).map((s: any, i: number) => {
            const pct = totalShares > 0 ? Math.round((s.count / totalShares) * 100) : 0;
            const platformColors: Record<string, string> = { kakao: '#FEE500', twitter: '#1DA1F2', facebook: '#1877F2', copy: C.green, link: C.cyan };
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-sm)', padding: '5px 0' }}>
                <span style={{ fontSize: 12, color: C.text, minWidth: 60 }}>{s.platform}</span>
                <div style={{ flex: 1, height: 8, background: C.surface, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: platformColors[s.platform] || C.brand, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec, minWidth: 32 }}>{s.count}</span>
                <span style={{ fontSize: 10, color: C.textDim }}>{pct}%</span>
              </div>
            );
          })}
          {(!sharePlatforms || sharePlatforms.length === 0) && <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center', padding: 16 }}>공유 데이터 없음</div>}
        </div>

        {/* 초대 현황 */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>🎟️ 초대 현황</div>
          <div style={{ display: 'flex', gap: 'var(--sp-md)', marginBottom: 'var(--sp-md)' }}>
            <div><div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: C.brand }}>{inviteStats?.total || 0}</div><div style={{ fontSize: 10, color: C.textDim }}>총 초대</div></div>
            <div><div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: C.green }}>{inviteStats?.used || 0}</div><div style={{ fontSize: 10, color: C.textDim }}>사용됨</div></div>
          </div>
          {inviteStats?.topInviters?.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 'var(--sp-xs)' }}>초대왕 Top 5</div>
              {inviteStats.topInviters.map((t: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 }}>
                  <span style={{ color: C.text, fontFamily: 'monospace' }}>{t.creator_id.slice(0, 8)}</span>
                  <span style={{ fontWeight: 700, color: C.green }}>{t.count}명</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 최근 피드백 */}
      {feedback && feedback.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 'var(--radius-md)', padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>💬 최근 유저 피드백</div>
          {feedback.slice(0, 10).map((f: any, i: number) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}08` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: C.textDim }}>{f.category || '일반'} {f.rating ? `⭐${f.rating}` : ''}</span>
                <span style={{ fontSize: 10, color: C.textDim }}>{ago(f.created_at)}</span>
              </div>
              <div style={{ fontSize: 12, color: C.text }}>{f.message?.slice(0, 100)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// 🔍 SEO · 점수
// ══════════════════════════════════════
