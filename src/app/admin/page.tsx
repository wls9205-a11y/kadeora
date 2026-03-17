import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const metadata = { title: '관리자 대시보드 | 카더라' };

export default async function AdminDashboard() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/feed');

  const [usersR, todayUsersR, postsR, todayPostsR, paymentsR, pendingReportsR, recentUsersR, recentReportsR] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().slice(0, 10)),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().slice(0, 10)),
    supabase.from('payments').select('amount').eq('status', 'DONE'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('nickname, grade_title, created_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(5),
    supabase.from('reports').select('id, reason, content_type, created_at, status').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
  ]);

  const totalRevenue = paymentsR.data?.reduce((s: number, p: { amount: number }) => s + (p.amount || 0), 0) || 0;
  const pendingCount = pendingReportsR.count ?? 0;

  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 };
  const label = { fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 };
  const big = { fontSize: 24, fontWeight: 800 as const, color: 'var(--text-primary)' };
  const sub = { fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>📊 대시보드</h1>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={card}>
          <div style={label}>총 가입자</div>
          <div style={big}>{(usersR.count ?? 0).toLocaleString()}명</div>
          <div style={sub}>오늘 +{todayUsersR.count ?? 0}명</div>
        </div>
        <div style={card}>
          <div style={label}>총 게시글</div>
          <div style={big}>{(postsR.count ?? 0).toLocaleString()}개</div>
          <div style={sub}>오늘 +{todayPostsR.count ?? 0}개</div>
        </div>
        <div style={card}>
          <div style={label}>총 결제금액</div>
          <div style={big}>{totalRevenue.toLocaleString()}원</div>
        </div>
        <div style={{ ...card, borderLeft: pendingCount > 0 ? '3px solid var(--warning)' : '3px solid var(--success)' }}>
          <div style={label}>미처리 신고</div>
          <div style={{ ...big, color: pendingCount > 0 ? 'var(--warning)' : 'var(--success)' }}>{pendingCount}건</div>
        </div>
      </div>

      {/* Recent Signups */}
      <div style={{ ...card, marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>최근 가입자</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>닉네임</th>
              <th style={{ padding: '6px 8px' }}>등급</th>
              <th style={{ padding: '6px 8px' }}>가입일</th>
            </tr>
          </thead>
          <tbody>
            {(recentUsersR.data ?? []).map((u: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px', color: 'var(--text-primary)', fontWeight: 600 }}>{u.nickname || '미설정'}</td>
                <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{u.grade_title || '-'}</td>
                <td style={{ padding: '8px', color: 'var(--text-tertiary)' }}>{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Reports */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>미처리 신고</h2>
          <Link href="/admin/reports" style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none' }}>전체 보기 →</Link>
        </div>
        {(recentReportsR.data ?? []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>미처리 신고가 없습니다</div>
        ) : (
          (recentReportsR.data ?? []).map((r: any) => (
            <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-primary)' }}>[{r.content_type}] {r.reason}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
