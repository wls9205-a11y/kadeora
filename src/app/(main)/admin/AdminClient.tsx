'use client';
import Link from 'next/link';

interface Stats { totalUsers: number; totalPosts: number; totalComments: number; }
interface Props {
  stats: Stats;
  recentUsers: Record<string, unknown>[];
  recentPosts: Record<string, unknown>[];
  reports: Record<string, unknown>[];
}

export default function AdminClient({ stats, recentUsers, recentPosts, reports }: Props) {
  const statCards = [
    { label: '총 가입자', value: stats.totalUsers, icon: '👥', color: 'var(--kd-primary)' },
    { label: '총 게시글', value: stats.totalPosts, icon: '📝', color: 'var(--kd-success)' },
    { label: '총 댓글', value: stats.totalComments, icon: '💬', color: 'var(--kd-purple)' },
    { label: '신고 건수', value: reports.length, icon: '🚨', color: reports.length > 0 ? 'var(--kd-danger)' : 'var(--kd-text-dim)' },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--kd-text)' }}>🛡️ 관리자 대시보드</h1>
        <span style={{ fontSize: 12, color: 'var(--kd-text-dim)', padding: '4px 10px', borderRadius: 999, background: 'var(--kd-surface-2)', border: '1px solid var(--kd-border)' }}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: 'var(--kd-text-dim)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* 최근 가입자 */}
        <div style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 14, padding: '20px 20px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--kd-text)' }}>👥 최근 가입자</h2>
          {recentUsers.map((u: Record<string, unknown>, i) => (
            <div key={String(u.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < recentUsers.length-1 ? '1px solid var(--kd-border)' : 'none' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--kd-text)' }}>{String(u.nickname ?? '-')}</span>
                <span style={{ fontSize: 11, color: 'var(--kd-text-dim)', marginLeft: 8 }}>{String(u.provider ?? 'email')}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--kd-text-dim)' }}>
                Lv.{String(u.grade ?? 1)} · {Number(u.points ?? 0)}pts
              </div>
            </div>
          ))}
        </div>

        {/* 최근 게시글 */}
        <div style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 14, padding: '20px 20px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--kd-text)' }}>📝 최근 게시글</h2>
          {recentPosts.map((p: Record<string, unknown>, i) => (
            <div key={String(p.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < recentPosts.length-1 ? '1px solid var(--kd-border)' : 'none' }}>
              <Link href={`/feed/${p.id}`} style={{ flex: 1, fontSize: 13, color: 'var(--kd-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(p.title ?? '')}
              </Link>
              <div style={{ fontSize: 11, color: 'var(--kd-text-dim)', flexShrink: 0, marginLeft: 8 }}>
                👁{String(p.view_count ?? 0)} ❤️{String(p.likes_count ?? 0)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 신고 목록 */}
      {reports.length > 0 && (
        <div style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-danger)', borderRadius: 14, padding: '20px 20px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--kd-danger)' }}>🚨 미처리 신고 ({reports.length}건)</h2>
          {reports.map((r: Record<string, unknown>, i) => (
            <div key={String(r.id)} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < reports.length-1 ? '1px solid var(--kd-border)' : 'none', alignItems: 'center' }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--kd-danger-dim)', color: 'var(--kd-danger)', fontWeight: 600, flexShrink: 0 }}>{String(r.target_type ?? '')}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--kd-text)' }}>{String(r.reason ?? '')}</span>
              <span style={{ fontSize: 11, color: 'var(--kd-text-dim)', flexShrink: 0 }}>{new Date(String(r.created_at ?? '')).toLocaleDateString('ko-KR')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}