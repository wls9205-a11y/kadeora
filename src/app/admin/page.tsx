import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AdminLineChart, AdminDonutChart } from './AdminCharts';
import TrafficStats from './TrafficStats';
import DashboardPWACard from './DashboardPWACard';
import AptCacheRefreshButton from './AptCacheRefreshButton';

export const metadata = {
  title: '관리자 대시보드',
  robots: { index: false, follow: false },
};

export default async function AdminDashboard() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/feed');

  const seedCount = 10;

  const [
    usersR, todayUsersR, postsR, todayPostsR,
    commentsR, pushSubsR, pwaStatsR,
    signupRawR, postRawR, catRawR,
    todayAttR, totalAttR, topAttR,
    recentUsersR, recentReportsR,
    pendingReportsR,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().slice(0, 10)),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().slice(0, 10)),
    supabase.from('comments').select('id', { count: 'exact', head: true }),
    supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
    supabase.from('pwa_installs').select('platform, installed_at, region_text').order('installed_at', { ascending: false }).limit(100),
    supabase.from('profiles').select('created_at').gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()).eq('is_deleted', false),
    supabase.from('posts').select('created_at, category').gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()).eq('is_deleted', false),
    supabase.from('posts').select('category').eq('is_deleted', false),
    supabase.from('attendance').select('user_id', { count: 'exact', head: true }).eq('last_date', new Date().toISOString().slice(0, 10)),
    supabase.from('attendance').select('user_id', { count: 'exact', head: true }),
    supabase.from('attendance').select('user_id, streak, total_days, last_date, profiles(nickname)').order('streak', { ascending: false }).limit(5),
    supabase.from('profiles').select('nickname, grade_title, created_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(5),
    supabase.from('reports').select('id, reason, content_type, created_at, status').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const totalUsers = usersR.count ?? 0;
  const totalPosts = postsR.count ?? 0;
  const totalComments = commentsR.count ?? 0;
  const pushSubs = pushSubsR.count ?? 0;
  const pwaStats = pwaStatsR.data ?? [];
  const pwaTotal = pwaStats.length;
  const pwaAndroid = pwaStats.filter((p: any) => p.platform === 'android').length;
  const pwaIOS = pwaStats.filter((p: any) => p.platform === 'ios').length;
  const pwaDesktop = pwaStats.filter((p: any) => p.platform === 'desktop').length;

  const pendingCount = pendingReportsR.count ?? 0;
  const todayAtt = todayAttR.count ?? 0;
  const totalAtt = totalAttR.count ?? 0;
  const topAtt = topAttR.data ?? [];

  const signupRaw = signupRawR.data ?? [];
  const postRaw = postRawR.data ?? [];
  const catRaw = catRawR.data ?? [];

  const days14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d.toISOString().slice(0, 10); });
  const signupByDay = days14.map(date => ({ date, count: signupRaw.filter((r: any) => r.created_at?.slice(0, 10) === date).length }));
  const postByDay = days14.map(date => ({ date, count: postRaw.filter((r: any) => r.created_at?.slice(0, 10) === date).length }));
  const CAT_C: Record<string, { label: string; color: string }> = { stock: { label: '주식', color: '#3b82f6' }, apt: { label: '부동산', color: '#10b981' }, local: { label: '우리동네', color: '#f59e0b' }, free: { label: '자유', color: '#8b5cf6' } };
  const catStats = Object.entries(catRaw.reduce((a: any, r: any) => { const k = r.category || 'free'; a[k] = (a[k] || 0) + 1; return a; }, {} as Record<string, number>)).map(([key, count]) => ({ key, count: count as number, label: CAT_C[key]?.label || key, color: CAT_C[key]?.color || '#888' }));

  const cardStyle: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 };
  const headerStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>📊 대시보드</h1>

      {/* KPI Cards - 2 rows of 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>총 가입자</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{totalUsers.toLocaleString()}명</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>시드 {seedCount}명 포함 · 오늘 +{todayUsersR.count ?? 0}명</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>오늘 방문자</div>
          <TrafficStats variant="kpi" />
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>게시글 수</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{totalPosts.toLocaleString()}개</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>오늘 +{todayPostsR.count ?? 0}개</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>댓글 수</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{totalComments.toLocaleString()}개</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>푸시 구독 수</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{pushSubs.toLocaleString()}명</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>홈화면 추가 (PWA)</div>
          <DashboardPWACard total={pwaTotal} android={pwaAndroid} ios={pwaIOS} desktop={pwaDesktop} />
        </div>
      </div>

      {/* 미처리 신고 배너 */}
      {pendingCount > 0 && (
        <div style={{ ...cardStyle, marginBottom: 16, borderLeft: '3px solid var(--warning)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warning)' }}>미처리 신고 {pendingCount}건</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>확인이 필요합니다</div>
          </div>
          <Link href="/admin/reports" style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>처리하기 →</Link>
        </div>
      )}

      {/* 최근 가입자 */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h2 style={headerStyle}>👥 최근 가입자</h2>
        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>닉네임</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>등급</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>가입일</th>
              </tr>
            </thead>
            <tbody>
              {(recentUsersR.data ?? []).map((u: any, i: number) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-hover)' }}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>{u.nickname || '미설정'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{u.grade_title || '-'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)' }}>{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 미처리 신고 */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ ...headerStyle, marginBottom: 0 }}>🚨 미처리 신고</h2>
          <Link href="/admin/reports" style={{ fontSize: 12, color: 'var(--brand)', textDecoration: 'none' }}>전체 보기 →</Link>
        </div>
        {(recentReportsR.data ?? []).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>미처리 신고가 없습니다</div>
        ) : (
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-sunken)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>유형</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>사유</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>날짜</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {(recentReportsR.data ?? []).map((r: any, i: number) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-hover)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{r.content_type}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{r.reason}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)' }}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: 'var(--warning)', color: 'var(--text-inverse)' }}>대기</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 트래픽 현황 */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <TrafficStats variant="full" />
      </div>

      {/* 출석체크 현황 */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h2 style={headerStyle}>📅 출석체크 현황</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {[
            { label: '오늘 출석', value: todayAtt, icon: '✅' },
            { label: '전체 출석 유저', value: totalAtt, icon: '👥' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 10, padding: 14, textAlign: 'center' as const }}>
              <div style={{ fontSize: 20 }}>{s.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)', margin: '4px 0' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>연속 출석 TOP 5</div>
        {topAtt.map((a: any, i: number) => (
          <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <span style={{ color: 'var(--text-tertiary)', width: 20 }}>{i + 1}</span>
            <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600 }}>{(a.profiles as any)?.nickname || '(알 수 없음)'}</span>
            <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{a.streak}일 연속</span>
            <span style={{ color: 'var(--text-tertiary)', marginLeft: 12 }}>누적 {a.total_days}일</span>
          </div>
        ))}
      </div>

      {/* 부동산 데이터 갱신 */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <AptCacheRefreshButton hasKey={!!process.env.APT_DATA_API_KEY} />
      </div>

      {/* 데이터 차트 */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <h2 style={headerStyle}>📈 데이터 현황</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <AdminLineChart data={signupByDay} label="일별 신규 가입자 (14일)" />
          <AdminLineChart data={postByDay} label="일별 게시글 수 (14일)" color="var(--success)" />
          <AdminDonutChart data={catStats} label="카테고리별 게시글 분포" />
        </div>
      </div>
    </div>
  );
}
