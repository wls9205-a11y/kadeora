'use client';
import { useState } from 'react';
import Link from 'next/link';
import AdminPushNotification from '@/components/AdminPushNotification';

interface Stats { totalUsers: number; totalPosts: number; totalComments: number; }
interface Props {
  stats: Stats;
  recentUsers: Record<string, unknown>[];
  recentPosts: Record<string, unknown>[];
  reports: Record<string, unknown>[];
}

const TABS = ['대시보드', '공지발송', '최근 유저', '최근 게시글', '신고 목록'] as const;
type Tab = typeof TABS[number];

export default function AdminClient({ stats, recentUsers, recentPosts, reports }: Props) {
  const [tab, setTab] = useState<Tab>('대시보드');

  const tabStyle = (t: Tab) => ({
    padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 700,
    background: tab === t ? 'var(--brand)' : 'transparent',
    color: tab === t ? 'var(--text-inverse)' : 'var(--kd-text-muted)',
    transition: 'all 0.15s',
  });

  return (
    <div>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--kd-text)' }}>
          🛡 관리자 패널
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--kd-text-muted)' }}>
          카더라 운영 관리 센터
        </p>
      </div>

      {/* 탭 */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
        borderRadius: 4, padding: '8px 10px', marginBottom: 20,
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>{t}</button>
        ))}
      </div>

      {/* ── 대시보드 ── */}
      {tab === '대시보드' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: '총 유저', value: stats.totalUsers.toLocaleString(), icon: '👤', color: '#3B82F6' },
              { label: '총 게시글', value: stats.totalPosts.toLocaleString(), icon: '📝', color: '#10B981' },
              { label: '총 댓글', value: stats.totalComments.toLocaleString(), icon: '💬', color: '#8B5CF6' },
              { label: '신고 대기', value: reports.length.toString(), icon: '🚩', color: 'var(--brand)' },
            ].map(item => (
              <div key={item.label} style={{
                background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
                borderRadius: 8, padding: '16px 18px',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 13, color: 'var(--kd-text-muted)', marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
          {/* 빠른 링크 */}
          <div style={{
            background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
            borderRadius: 8, padding: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--kd-text)', marginBottom: 12 }}>빠른 작업</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: '공지 발송', tab: '공지발송' as Tab, icon: '📢' },
                { label: '신고 검토', tab: '신고 목록' as Tab, icon: '🚩' },
              ].map(item => (
                <button key={item.label} onClick={() => setTab(item.tab)} style={{
                  padding: '8px 16px', borderRadius: 20,
                  background: 'var(--kd-primary-dim)', border: '1px solid var(--kd-primary)',
                  color: 'var(--kd-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 공지 발송 ── */}
      {tab === '공지발송' && (
        <div>
          <div style={{
            background: 'var(--kd-surface)', border: '1px solid var(--kd-border)',
            borderRadius: 8, padding: 20, marginBottom: 16,
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: 'var(--kd-text)' }}>
              📢 공지 발송 시스템
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--kd-text-muted)' }}>
              전체 유저에게 앱 내 알림을 발송합니다. VAPID 키가 설정된 경우 브라우저 백그라운드 푸시도 전송됩니다.
            </p>
          </div>
          <AdminPushNotification />
        </div>
      )}

      {/* ── 최근 유저 ── */}
      {tab === '최근 유저' && (
        <div style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--kd-border)', fontSize: 14, fontWeight: 700, color: 'var(--kd-text)' }}>
            최근 가입 유저 ({recentUsers.length}명)
          </div>
          {recentUsers.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--kd-text-muted)' }}>데이터 없음</div>
          ) : recentUsers.map((u, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderBottom: '1px solid var(--kd-border)',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--text-inverse)', flexShrink: 0 }}>
                {String(u.nickname ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--kd-text)' }}>{String(u.nickname ?? '알 수 없음')}</div>
                <div style={{ fontSize: 12, color: 'var(--kd-text-muted)' }}>{String(u.provider ?? '')} · {u.created_at ? new Date(String(u.created_at)).toLocaleDateString('ko-KR') : ''}</div>
              </div>
              <Link href={`/profile/${u.id}`} style={{ fontSize: 12, color: 'var(--kd-primary)', fontWeight: 600 }}>프로필 →</Link>
            </div>
          ))}
        </div>
      )}

      {/* ── 최근 게시글 ── */}
      {tab === '최근 게시글' && (
        <div style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--kd-border)', fontSize: 14, fontWeight: 700, color: 'var(--kd-text)' }}>
            최근 게시글 ({recentPosts.length}건)
          </div>
          {recentPosts.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--kd-text-muted)' }}>데이터 없음</div>
          ) : recentPosts.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--kd-border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/feed/${p.id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--kd-text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(p.title ?? '')}
                </Link>
                <div style={{ fontSize: 12, color: 'var(--kd-text-muted)', marginTop: 2 }}>
                  {String(p.category ?? '')} · 좋아요 {Number(p.likes_count ?? 0)} · 댓글 {Number(p.comments_count ?? 0)}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--kd-text-dim)', flexShrink: 0 }}>
                {p.created_at ? new Date(String(p.created_at)).toLocaleDateString('ko-KR') : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 신고 목록 ── */}
      {tab === '신고 목록' && (
        <div style={{ background: 'var(--kd-surface)', border: '1px solid var(--kd-border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--kd-border)', fontSize: 14, fontWeight: 700, color: 'var(--kd-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            🚩 신고 대기 목록
            {reports.length > 0 && (
              <span style={{ padding: '2px 8px', borderRadius: 10, background: 'var(--kd-danger-dim)', color: 'var(--kd-danger)', fontSize: 12, fontWeight: 800 }}>{reports.length}</span>
            )}
          </div>
          {reports.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--kd-text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              처리할 신고가 없습니다
            </div>
          ) : reports.map((r, i) => (
            <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--kd-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--kd-text)', marginBottom: 4 }}>
                    <strong>사유:</strong> {String(r.reason ?? '기타')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--kd-text-muted)' }}>
                    게시글 ID: {String(r.post_id ?? '-')} · {r.created_at ? new Date(String(r.created_at)).toLocaleDateString('ko-KR') : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Link href={`/feed/${r.post_id}`} style={{ padding: '5px 12px', borderRadius: 16, border: '1px solid var(--kd-border)', color: 'var(--kd-text)', fontSize: 12, fontWeight: 600 }}>
                    게시글 보기
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}