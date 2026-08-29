// src/app/admin/ads/page.tsx — U-3층 ⑥ 깔때기(광고면)
//
// ⚠️ 게이트를 새로 만들지 않는다. `/admin/*` 은 이미 미들웨어(로그인+is_admin)와
//    admin/layout.tsx 의 robots{index:false} 뒤에 있다 — 이미 도는 게이트 뒤에 둔다.
//
// ⛔ 이 화면이 «하지 않는» 것: 입찰·상태 변경. 그건 P4(9/11) 소관이고 여기엔 버튼이 없다.
//
// ⚠️ 두 가지를 «숨기지 않고 라벨로» 드러낸다 —
//    ① low_sample(리드 n<5): 단가가 숫자로 나오지만 통계적 의미가 없다.
//       확정처럼 보이게 하면 그 숫자가 9/11 자동 입찰의 근거가 된다(§7-1 의 내부판).
//    ② unsynced: ad_keywords 가 캠페인 1/11 의 부분 스냅샷이라 이름이 없는 행이 뜬다.
//       이름이 없다고 «지출이 없는» 게 아니다. 「미동기 키워드」로 표시하고 남긴다.
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import EmptyState from '@/components/ds/EmptyState';

export const dynamic = 'force-dynamic';
export const revalidate = 60;
export const maxDuration = 10;

export const metadata = {
  title: '광고 단위경제 — Admin',
  robots: { index: false, follow: false },
};

type Row = {
  keyword_id: string;
  keyword: string | null;
  site_slug: string | null;
  adgroup_name: string | null;
  unsynced: boolean;
  spend: number;
  clicks: number;
  imps: number;
  since_date: string | null;
  until_date: string | null;
  leads: number;
  cost_per_lead: number | null;
  cpc_actual: number | null;
  low_sample: boolean;
};

const won = (n: number | null) => (n === null ? '—' : `${Math.round(n).toLocaleString()}원`);
const num = (n: number) => n.toLocaleString();

export default async function AdminAds() {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_lead_unit_economics')
    .select('*')
    .order('spend', { ascending: false })
    .limit(200);

  const rows: Row[] = (data ?? []) as Row[];
  const totalSpend = rows.reduce((a, r) => a + Number(r.spend || 0), 0);
  const totalLeads = rows.reduce((a, r) => a + Number(r.leads || 0), 0);
  const totalClicks = rows.reduce((a, r) => a + Number(r.clicks || 0), 0);
  const unsynced = rows.filter((r) => r.unsynced).length;
  const withLeads = rows.filter((r) => r.leads > 0);
  const range = rows.length
    ? `${rows.map((r) => r.since_date).filter(Boolean).sort()[0]} ~ ${rows.map((r) => r.until_date).filter(Boolean).sort().at(-1)}`
    : '—';

  return (
    <main style={{ padding: 'var(--sp-4, 16px)', display: 'grid', gap: 'var(--sp-4, 16px)' }}>
      <header>
        <h1 style={{ fontSize: 'var(--fs-lg, 18px)', fontWeight: 600, margin: 0 }}>광고 단위경제</h1>
        <p style={{ fontSize: 'var(--fs-sm, 13px)', color: 'var(--text-muted, #6b7280)', margin: '4px 0 0' }}>
          키워드별 지출 ÷ 리드. 집계 기간 {range} · 지출 상위 200
        </p>
      </header>

      {error ? (
        <EmptyState kind="error" title="단가 표를 불러오지 못했다" hint={String(error.message ?? error)} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="아직 적재된 광고 실적이 없다"
          hint="ad-stats-sync 크론이 하루 1회 최근 3일을 재수집한다. 첫 적재 전이거나 그 기간에 노출이 없었다."
        />
      ) : (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--sp-3, 12px)',
            }}
          >
            {[
              ['지출', won(totalSpend)],
              ['클릭', num(totalClicks)],
              ['리드', num(totalLeads)],
              ['평균 리드단가', totalLeads > 0 ? won(totalSpend / totalLeads) : '—'],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: '1px solid var(--border, #e5e7eb)',
                  borderRadius: 'var(--radius-md, 12px)',
                  padding: 'var(--sp-3, 12px)',
                  background: 'var(--bg-surface, #fff)',
                }}
              >
                <div style={{ fontSize: 'var(--fs-xs, 12px)', color: 'var(--text-muted, #6b7280)' }}>{label}</div>
                <div style={{ fontSize: 'var(--fs-lg, 18px)', fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </section>

          {/* ⚠️ 표본이 얇다는 사실을 «맨 위에» 둔다. 표를 다 본 뒤에 알면 늦다. */}
          {withLeads.length < 5 && (
            <div
              role="note"
              style={{
                border: '1px solid var(--warn-border, #fde68a)',
                background: 'var(--warn-bg, #fffbeb)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: 'var(--sp-3, 12px)',
                fontSize: 'var(--fs-sm, 13px)',
              }}
            >
              <strong>표본 부족.</strong> 리드가 붙은 키워드가 {withLeads.length}개뿐이다. 여기 나오는 리드단가는
              아직 «통계적 의미가 없다» — P4 자동 입찰의 근거로 쓰기 전에 최소 1주 누적이 필요하다.
            </div>
          )}
          {unsynced > 0 && (
            <div
              role="note"
              style={{
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: 'var(--radius-md, 12px)',
                padding: 'var(--sp-3, 12px)',
                fontSize: 'var(--fs-sm, 13px)',
                color: 'var(--text-muted, #6b7280)',
              }}
            >
              <strong>미동기 키워드 {unsynced}개.</strong> 지출은 수집됐는데 이름이 없다 — `ad_keywords` 가
              캠페인 1/11 의 부분 스냅샷이라 그렇다. 이름 동기화는 후속 커밋(①) 몫이고, 지출 수치 자체는 정확하다.
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm, 13px)' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                  {['키워드', '현장', '노출', '클릭', '지출', '리드', '리드단가', '실 CPC'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 6px', whiteSpace: 'nowrap', textAlign: i >= 2 ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.keyword_id} style={{ borderBottom: '1px solid var(--border-subtle, #f3f4f6)' }}>
                    <td style={{ padding: '8px 6px', maxWidth: 260 }}>
                      {r.keyword ?? (
                        <span style={{ color: 'var(--text-muted, #6b7280)' }}>
                          미동기 키워드 <code style={{ fontSize: 11 }}>{r.keyword_id.slice(-12)}</code>
                        </span>
                      )}
                      {r.adgroup_name && (
                        <div style={{ fontSize: 'var(--fs-xs, 12px)', color: 'var(--text-muted, #6b7280)' }}>
                          {r.adgroup_name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 6px', color: 'var(--text-muted, #6b7280)' }}>{r.site_slug ?? '—'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{num(r.imps)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{num(r.clicks)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>{won(r.spend)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{num(r.leads)}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      {r.cost_per_lead === null ? (
                        '—'
                      ) : (
                        <>
                          {won(r.cost_per_lead)}
                          {r.low_sample && (
                            <span
                              title="리드 n<5 — 통계적 의미 없음"
                              style={{ marginLeft: 4, fontSize: 11, color: 'var(--text-muted, #6b7280)' }}
                            >
                              표본부족
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>{won(r.cpc_actual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
