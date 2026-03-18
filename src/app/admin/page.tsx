import { createSupabaseServer } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PushBroadcast from './PushBroadcast';
import NoticeManager from './NoticeManager';
import { AdminLineChart, AdminDonutChart } from './AdminCharts';
import SeedDataManager from './SeedDataManager';
import UnsoldFetchButton from './UnsoldFetchButton';

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

  const [usersR, todayUsersR, postsR, todayPostsR, paymentsR, pendingReportsR, recentUsersR, recentReportsR, pwaStatsR, signupRawR, postRawR, catRawR, todayAttR, totalAttR, topAttR, unsoldCountR] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().slice(0, 10)),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
    supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().slice(0, 10)),
    supabase.from('payments').select('amount').eq('status', 'DONE'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('nickname, grade_title, created_at').eq('is_deleted', false).order('created_at', { ascending: false }).limit(5),
    supabase.from('reports').select('id, reason, content_type, created_at, status').eq('status', 'pending').order('created_at', { ascending: false }).limit(3),
    supabase.from('pwa_installs').select('platform, installed_at, region_text').order('installed_at', { ascending: false }).limit(30),
    supabase.from('profiles').select('created_at').gte('created_at', new Date(Date.now() - 14*24*60*60*1000).toISOString()).eq('is_deleted', false),
    supabase.from('posts').select('created_at, category').gte('created_at', new Date(Date.now() - 14*24*60*60*1000).toISOString()).eq('is_deleted', false),
    supabase.from('posts').select('category').eq('is_deleted', false),
    supabase.from('attendance').select('user_id', { count: 'exact', head: true }).eq('last_date', new Date().toISOString().slice(0, 10)),
    supabase.from('attendance').select('user_id', { count: 'exact', head: true }),
    supabase.from('attendance').select('user_id, streak, total_days, last_date, profiles(nickname)').order('streak', { ascending: false }).limit(5),
    supabase.from('unsold_apts').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  const pwaStats = pwaStatsR.data ?? [];
  const signupRaw = signupRawR.data ?? [];
  const postRaw = postRawR.data ?? [];
  const catRaw = catRawR.data ?? [];

  const days14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d.toISOString().slice(0, 10); });
  const signupByDay = days14.map(date => ({ date, count: signupRaw.filter((r: any) => r.created_at?.slice(0, 10) === date).length }));
  const postByDay = days14.map(date => ({ date, count: postRaw.filter((r: any) => r.created_at?.slice(0, 10) === date).length }));
  const CAT_C: Record<string, { label: string; color: string }> = { stock: { label: '주식', color: '#3b82f6' }, apt: { label: '부동산', color: '#10b981' }, local: { label: '우리동네', color: '#f59e0b' }, free: { label: '자유', color: '#8b5cf6' } };
  const catStats = Object.entries(catRaw.reduce((a: any, r: any) => { const k = r.category || 'free'; a[k] = (a[k] || 0) + 1; return a; }, {} as Record<string, number>)).map(([key, count]) => ({ key, count: count as number, label: CAT_C[key]?.label || key, color: CAT_C[key]?.color || '#888' }));
  const pwaTotal = pwaStats.length;
  const pwaDesktop = pwaStats.filter((p: any) => p.platform === 'desktop').length;

  const todayAtt = todayAttR.count ?? 0;
  const totalAtt = totalAttR.count ?? 0;
  const topAtt = topAttR.data ?? [];
  const pwaAndroid = pwaStats.filter((p: any) => p.platform === 'android').length;
  const pwaIOS = pwaStats.filter((p: any) => p.platform === 'ios').length;

  // 소셜 가입 통계
  let providerStats: Record<string, number> = {};
  try {
    const adminSb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: ps } = await adminSb.from('social_provider_stats').select('provider, count');
    (ps || []).forEach((p: any) => { providerStats[p.provider || 'email'] = Number(p.count) || 0; });
  } catch {}

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
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 16, fontWeight: 600, background: 'rgba(247,191,0,0.15)', color: '#b8860b', border: '1px solid rgba(247,191,0,0.3)' }}>카카오 {providerStats['kakao'] ?? 0}명</span>
            <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 16, fontWeight: 600, background: 'rgba(66,133,244,0.15)', color: '#4285f4', border: '1px solid rgba(66,133,244,0.3)' }}>구글 {providerStats['google'] ?? 0}명</span>
            <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 16, fontWeight: 600, background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>이메일 {providerStats['email'] ?? 0}명</span>
          </div>
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
      {/* PWA 설치 현황 */}
      <div style={{ ...card, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📲 홈화면 추가 현황</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {[
            { label: '전체', value: pwaTotal, icon: '📱' },
            { label: 'Android', value: pwaAndroid, icon: '🤖' },
            { label: 'iOS', value: pwaIOS, icon: '🍎' },
            { label: '데스크탑', value: pwaDesktop, icon: '💻' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'var(--bg-hover)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 출석체크 현황 */}
      <div style={{ ...card, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📅 출석체크 현황</h2>
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
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>🔥 연속 출석 TOP 5</div>
        {topAtt.map((a: any, i: number) => (
          <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <span style={{ color: 'var(--text-tertiary)', width: 20 }}>{i + 1}</span>
            <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600 }}>{(a.profiles as any)?.nickname || '(알 수 없음)'}</span>
            <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{a.streak}일 연속</span>
            <span style={{ color: 'var(--text-tertiary)', marginLeft: 12 }}>누적 {a.total_days}일</span>
          </div>
        ))}
      </div>

      {/* 데이터 차트 */}
      <div style={{ ...card, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>📈 데이터 현황</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <AdminLineChart data={signupByDay} label="일별 신규 가입자 (14일)" />
          <AdminLineChart data={postByDay} label="일별 게시글 수 (14일)" color="var(--success)" />
          <AdminDonutChart data={catStats} label="카테고리별 게시글 분포" />
        </div>
      </div>

      {/* 공지 전광판 */}
      <div style={{ ...card, marginTop: 16 }}>
        <NoticeManager />
      </div>

      {/* Push Broadcast */}
      <div style={{ ...card, marginTop: 16 }}>
        <PushBroadcast />
      </div>

      {/* 미분양 데이터 수집 */}
      <div style={{ ...card, marginTop: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🏗️ 미분양 데이터 수집</h2>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>현재 unsold_apts: <strong>{unsoldCountR.count ?? 0}건</strong></div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12, lineHeight: 1.6 }}>
          data.go.kr에서 미분양주택현황 API 키 발급 후 Vercel 환경변수 UNSOLD_API_KEY에 등록하면 전국 미분양 데이터를 자동 수집합니다
        </div>
        <UnsoldFetchButton hasKey={!!process.env.UNSOLD_API_KEY} />
      </div>

      {/* 시드 데이터 관리 */}
      <div style={{ ...card, marginTop: 16 }}>
        <SeedDataManager />
      </div>
    </div>
  );
}
