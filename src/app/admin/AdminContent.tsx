'use client';
import { useState, useEffect } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import NoticeManager from './NoticeManager';

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  borderRadius: 12,
  padding: 20,
  border: '1px solid var(--border)',
};

interface Report {
  id: number;
  reason: string | null;
  details: string | null;
  content_type: string | null;
  status: string | null;
  auto_hidden: boolean | null;
  created_at: string;
  post_id: number | null;
  comment_id: number | null;
  message_id: number | null;
  reporter?: { nickname: string } | null;
}

export default function AdminContent() {
  const [blogStats, setBlogStats] = useState<any>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportFilter, setReportFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const sb = createSupabaseBrowser();
    const [blogTotal, blogWeek, reportsRes] = await Promise.all([
      sb.from('blog_posts').select('id', { count: 'exact', head: true }),
      sb.from('blog_posts').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      sb.from('reports').select('id, reason, details, content_type, status, auto_hidden, created_at, post_id, comment_id, message_id, reporter:profiles!reports_reporter_id_fkey(nickname)').order('created_at', { ascending: false }).limit(50),
    ]);
    setBlogStats({
      total: blogTotal.count || 0,
      thisWeek: blogWeek.count || 0,
    });
    setReports(reportsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleReport = async (id: number, act: string) => {
    await fetch(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act }),
    });
    load();
  };

  const filteredReports = reports.filter(r => reportFilter === 'all' || r.status === reportFilter);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>로딩 중...</div>;

  return (
    <div>
      {/* Blog Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: '블로그 총 글', value: blogStats?.total || 0, icon: '📰' },
          { label: '이번주 발행', value: blogStats?.thisWeek || 0, icon: '📅' },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--fs-xl)' }}>{s.icon}</div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0' }}>{s.value.toLocaleString()}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* SEO Card */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>SEO 스코어카드</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <div>sitemap: <a href="/sitemap.xml" target="_blank" style={{ color: 'var(--accent-blue)' }}>/sitemap.xml</a></div>
          <div>robots: <a href="/robots.txt" target="_blank" style={{ color: 'var(--accent-blue)' }}>/robots.txt</a></div>
          <div>OG 이미지: /api/og 엔드포인트 활성</div>
        </div>
      </div>

      {/* Reports */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--text-primary)' }}>신고 처리</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'pending', 'resolved', 'dismissed'].map(f => (
              <button key={f} onClick={() => setReportFilter(f)} style={{
                padding: '4px 12px', borderRadius: 16, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 700,
                background: reportFilter === f ? 'var(--brand)' : 'var(--bg-hover)',
                color: reportFilter === f ? '#fff' : 'var(--text-secondary)',
              }}>{{ all: '전체', pending: '미처리', resolved: '처리됨', dismissed: '기각' }[f]}</button>
            ))}
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>신고 내역이 없습니다</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredReports.map(r => (
              <div key={r.id} style={{
                padding: '12px 14px', borderRadius: 8,
                background: r.status === 'pending' ? 'rgba(251,191,36,0.08)' : 'var(--bg-base)',
                border: `1px solid ${r.status === 'pending' ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                    background: r.content_type === 'post' ? 'var(--brand)' : r.content_type === 'comment' ? 'var(--accent-yellow)' : 'var(--accent-purple)',
                    color: '#fff',
                  }}>{{ post: '게시글', comment: '댓글', chat: '채팅' }[r.content_type ?? ''] || r.content_type}</span>
                  <span style={{
                    fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                    background: r.status === 'pending' ? 'rgba(251,191,36,0.3)' : r.status === 'resolved' ? 'rgba(52,211,153,0.12)' : 'rgba(148,163,184,0.15)',
                    color: r.status === 'pending' ? 'var(--accent-yellow)' : r.status === 'resolved' ? 'var(--accent-green)' : '#7D8DA3',
                  }}>{{ pending: '미처리', resolved: '처리됨', dismissed: '기각' }[r.status ?? ''] || r.status}</span>
                  {r.auto_hidden && <span style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)' }}>자동숨김</span>}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{r.reason}</div>
                {r.details && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>{r.details}</div>}
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {r.reporter?.nickname ? `신고자: ${r.reporter.nickname}` : ''} · {new Date(r.created_at).toLocaleDateString('ko-KR')}
                </div>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => handleReport(r.id, 'resolve')} style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px', borderRadius: 6, border: '1px solid #2EE8A5', background: 'transparent', color: 'var(--accent-green)', cursor: 'pointer', fontWeight: 700 }}>처리완료</button>
                    <button onClick={() => handleReport(r.id, 'dismiss')} style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px', borderRadius: 6, border: '1px solid #94A8C4', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontWeight: 700 }}>기각</button>
                    {(r.post_id || r.comment_id) && (
                      <button onClick={() => handleReport(r.id, 'hide_content')} style={{ fontSize: 'var(--fs-xs)', padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--accent-red)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>숨기기</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notice Manager */}
      <div style={cardStyle}>
        <NoticeManager />
      </div>
    </div>
  );
}
