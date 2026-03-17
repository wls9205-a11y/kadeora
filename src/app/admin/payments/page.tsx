import { createSupabaseServer } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export const metadata = {
  title: '결제 내역',
  robots: { index: false, follow: false },
};

export default async function AdminPaymentsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/feed');

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const all = payments ?? [];
  const done = all.filter((p: any) => p.status === 'DONE');
  const totalAmount = done.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthAmount = done.filter((p: any) => p.created_at?.startsWith(thisMonth)).reduce((s: number, p: any) => s + (p.amount || 0), 0);

  const card = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 };
  const statusColor = (s: string) => s === 'DONE' ? 'var(--success)' : s === 'CANCELED' ? 'var(--text-tertiary)' : 'var(--error)';

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 16 }}>💳 결제 내역</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>총 결제 건수</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{all.length}건</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>총 결제 금액</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{totalAmount.toLocaleString()}원</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>이번 달</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{monthAmount.toLocaleString()}원</div>
        </div>
      </div>

      <div style={{ ...card, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px' }}>결제일</th>
              <th style={{ padding: '10px 8px' }}>유저</th>
              <th style={{ padding: '10px 8px' }}>상품</th>
              <th style={{ padding: '10px 8px', textAlign: 'right' }}>금액</th>
              <th style={{ padding: '10px 8px' }}>주문번호</th>
              <th style={{ padding: '10px 8px' }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {all.map((p: any) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-tertiary)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{p.user_id?.slice(0, 8) || '-'}</td>
                <td style={{ padding: '10px 8px', color: 'var(--text-primary)' }}>{p.product_id || '-'}</td>
                <td style={{ padding: '10px 8px', color: 'var(--text-primary)', fontWeight: 700, textAlign: 'right' }}>{(p.amount || 0).toLocaleString()}원</td>
                <td style={{ padding: '10px 8px', color: 'var(--text-tertiary)', fontSize: 11 }}>{p.order_id || '-'}</td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: statusColor(p.status), color: 'var(--text-inverse)' }}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'center' }}>
        결제 취소는 토스페이먼츠 대시보드(dashboard.tosspayments.com)에서 처리하세요.
      </p>
    </div>
  );
}
