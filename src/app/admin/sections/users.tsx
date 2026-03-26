'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, C, DataTable, DetailGrid, DetailSection, GRADE_EMOJI, PROVIDER_LABEL, Pill, Spinner, UserRow, ago, dateStr, fmt } from '../admin-shared';

export default function UsersSection() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [userDetail, setUserDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const searchTimeout = useRef<any>(null);

  const load = useCallback((p = 1, s = search, f = filter) => {
    setLoading(true);
    fetch(`/api/admin/dashboard?section=users&page=${p}&search=${encodeURIComponent(s)}&filter=${f}`)
      .then(r => r.json()).then(d => { setUsers(d.users ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [search, filter]);

  useEffect(() => { load(1); }, [filter]); // eslint-disable-line

  const doSearch = (val: string) => {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setPage(1); load(1, val, filter); }, 400);
  };

  const selectUser = (user: UserRow) => {
    setSelected(user);
    setDetailLoading(true);
    setUserDetail(null);
    fetch(`/api/admin/dashboard?section=user-detail&id=${user.id}`)
      .then(r => r.json()).then(setUserDetail).finally(() => setDetailLoading(false));
  };

  const userAction = async (id: string, action: string) => {
    const msg = action === 'ban' ? '정지하시겠습니까?' : action === 'unban' ? '정지 해제하시겠습니까?' : action === 'makeAdmin' ? '관리자로 변경하시겠습니까?' : '삭제하시겠습니까?';
    if (!confirm(msg)) return;
    await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    load(page);
    if (selected?.id === id) setSelected(null);
  };

  const setPoints = async (id: string, current: number) => {
    const val = prompt('새 포인트 값', String(current));
    if (val === null) return;
    await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setPoints', points: parseInt(val) }) });
    load(page);
  };

  const filters = [
    { key: 'all', label: '전체' }, { key: 'real', label: '실유저' }, { key: 'seed', label: '시드' },
    { key: 'premium', label: '프리미엄' }, { key: 'banned', label: '정지' }, { key: 'admin', label: '관리자' },
  ];

  return (
    <div style={{ animation: 'fadeIn .4s ease' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, margin: '0 0 20px' }}>👤 유저 관리 <span style={{ fontSize: 14, color: C.textDim, fontWeight: 400 }}>({fmt(total)}명)</span></h1>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => doSearch(e.target.value)} placeholder="닉네임 / 이름 검색..."
          style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, width: 240, fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 4 }}>
          {filters.map(f => <Pill key={f.key} active={filter === f.key} onClick={() => { setFilter(f.key); setPage(1); }}>{f.label}</Pill>)}
        </div>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ display: 'flex', gap: 16 }}>
          {/* User List */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <DataTable
              headers={['', '닉네임', '등급', '가입경로', '연령대', '지역', '포인트', '게시글', '가입일', '최근활동', '상태']}
              rows={users.map(u => [
                GRADE_EMOJI[u.grade] || '🌱',
                <span key="n" style={{ fontWeight: 600 }}>{u.nickname}</span>,
                u.grade_title,
                <Badge key="p" color={u.provider === 'kakao' ? C.yellow : u.provider === 'google' ? C.green : C.brand}>{PROVIDER_LABEL[u.provider || ''] || u.provider || '—'}</Badge>,
                u.age_group ? <Badge key="ag" color={C.cyan}>{u.age_group}</Badge> : <span key="ag" style={{ color: C.textDim }}>—</span>,
                u.region_text || u.residence_city || '—',
                <span key="pt" style={{ color: C.yellow, fontWeight: 600 }}>{fmt(u.points)}</span>,
                u.posts_count,
                dateStr(u.created_at),
                ago(u.last_active_at),
                u.is_banned ? <Badge key="b" color={C.red}>정지</Badge> : u.is_seed ? <Badge key="s" color={C.textDim}>시드</Badge> : u.is_premium ? <Badge key="pr" color={C.purple}>프리미엄</Badge> : <Badge key="a" color={C.green}>활성</Badge>,
              ])}
              onRowClick={(i) => selectUser(users[i])}
            />
            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>← 이전</button>
              <span style={{ padding: '6px 14px', color: C.textSec, fontSize: 13 }}>{page} / {Math.ceil(total / 50) || 1}</span>
              <button disabled={page * 50 >= total} onClick={() => { setPage(page + 1); load(page + 1); }}
                style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, color: C.text, cursor: page * 50 >= total ? 'not-allowed' : 'pointer', opacity: page * 50 >= total ? 0.4 : 1 }}>다음 →</button>
            </div>
          </div>

          {/* User Detail Panel */}
          {selected && (
            <div style={{ width: 370, flexShrink: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, alignSelf: 'flex-start', position: 'sticky', top: 20, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{GRADE_EMOJI[selected.grade]} {selected.nickname}</h3>
                <button onClick={() => { setSelected(null); setUserDetail(null); }} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>

              {/* ── 기본 정보 ── */}
              <DetailSection title="🪪 기본 정보">
                <DetailGrid items={[
                  ['ID', selected.id.slice(0, 8) + '...'],
                  ['실명', selected.full_name || '—'],
                  ['등급', `${selected.grade_title} (Lv.${selected.grade})`],
                  ['가입경로', PROVIDER_LABEL[selected.provider || ''] || '—'],
                  ['카카오ID', selected.kakao_id || '—'],
                  ['구글', selected.google_email || '—'],
                  ['전화번호', selected.phone || '—'],
                  ['지역', selected.region_text || selected.residence_city || '—'],
                  ['성별', selected.gender === 'male' ? '👨 남성' : selected.gender === 'female' ? '👩 여성' : '—'],
                  ['연령대', selected.age_group || '—'],
                  ['가입일', dateStr(selected.created_at)],
                  ['최근활동', ago(selected.last_active_at)],
                ]} />
              </DetailSection>

              {/* ── 활동 지표 ── */}
              <DetailSection title="📊 활동 지표">
                <DetailGrid items={[
                  ['포인트', `${fmt(selected.points)}P`],
                  ['영향력', String(selected.influence_score)],
                  ['게시글', String(selected.posts_count)],
                  ['좋아요', String(selected.likes_count)],
                  ['팔로워', String(selected.followers_count)],
                  ['팔로잉', String(selected.following_count)],
                  ['연속출석', `${selected.streak_days}일`],
                  ['닉변횟수', String(selected.nickname_change_count)],
                ]} />
              </DetailSection>

              {/* ── 확장 정보 (API에서 로드) ── */}
              {detailLoading ? (
                <div style={{ padding: 16, textAlign: 'center' }}><Spinner /></div>
              ) : userDetail ? (
                <>
                  {/* 출석 */}
                  {userDetail.attendance && (
                    <DetailSection title="📅 출석">
                      <DetailGrid items={[
                        ['총 출석', `${userDetail.attendance.total_days}일`],
                        ['연속', `${userDetail.attendance.streak}일`],
                        ['마지막', dateStr(userDetail.attendance.last_date)],
                      ]} />
                    </DetailSection>
                  )}

                  {/* 관심 활동 */}
                  <DetailSection title="❤️ 관심 활동">
                    <DetailGrid items={[
                      ['관심종목', `${userDetail.counts?.watchlist ?? 0}개`],
                      ['청약북마크', `${userDetail.counts?.bookmarks ?? 0}개`],
                      ['가격알림', `${userDetail.counts?.priceAlerts ?? 0}개`],
                    ]} />
                  </DetailSection>

                  {/* 알림 설정 */}
                  <DetailSection title="🔔 알림 설정">
                    {userDetail.notifications ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {[
                          ['댓글', userDetail.notifications.push_comments],
                          ['좋아요', userDetail.notifications.push_likes],
                          ['팔로우', userDetail.notifications.push_follows],
                          ['인기글', userDetail.notifications.push_hot_post],
                          ['뉴스', userDetail.notifications.push_news],
                          ['주식알림', userDetail.notifications.push_stock_alert],
                          ['청약마감', userDetail.notifications.push_apt_deadline],
                          ['일일요약', userDetail.notifications.push_daily_digest],
                          ['출석', userDetail.notifications.push_attendance],
                        ].map(([label, on]) => (
                          <Badge key={label as string} color={on ? C.green : C.textDim}>
                            {on ? '✓' : '✗'} {label}
                          </Badge>
                        ))}
                        {userDetail.notifications.quiet_start && (
                          <div style={{ width: '100%', fontSize: 11, color: C.textDim, marginTop: 4 }}>
                            🌙 방해금지: {userDetail.notifications.quiet_start} ~ {userDetail.notifications.quiet_end}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: C.textDim }}>알림 설정 없음 (기본값)</div>
                    )}
                  </DetailSection>

                  {/* 푸시 & 앱 설치 */}
                  <DetailSection title="📱 푸시 & 앱">
                    <DetailGrid items={[
                      ['푸시 등록', userDetail.pushSubscriptions > 0 ? `✅ ${userDetail.pushSubscriptions}대` : '❌ 미등록'],
                      ['PWA 설치', userDetail.pwaInstalls?.length > 0 ? '✅ 설치됨' : '❌ 미설치'],
                    ]} />
                    {userDetail.pushDevices?.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        {userDetail.pushDevices.map((d: Record<string, any>) => (
                          <div key={d.id} style={{ fontSize: 11, color: C.textSec, padding: '2px 0' }}>
                            📍 {d.browser} · {ago(d.created_at)}
                          </div>
                        ))}
                      </div>
                    )}
                    {userDetail.pwaInstalls?.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {userDetail.pwaInstalls.map((p: any, i: number) => (
                          <div key={i} style={{ fontSize: 11, color: C.textSec, padding: '2px 0' }}>
                            📱 {p.platform || 'unknown'} · {p.browser} · {ago(p.installed_at)}
                          </div>
                        ))}
                      </div>
                    )}
                  </DetailSection>

                  {/* 동의 현황 */}
                  <DetailSection title="📋 동의 현황">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      <Badge color={selected.profile_completed ? C.green : C.textDim}>{selected.profile_completed ? '✓' : '✗'} 프로필완성</Badge>
                      <Badge color={selected.onboarded ? C.green : C.textDim}>{selected.onboarded ? '✓' : '✗'} 온보딩</Badge>
                      <Badge color={selected.marketing_agreed ? C.green : C.textDim}>{selected.marketing_agreed ? '✓' : '✗'} 마케팅</Badge>
                      <Badge color={selected.consent_analytics ? C.green : C.textDim}>{selected.consent_analytics ? '✓' : '✗'} 분석</Badge>
                      <Badge color={selected.is_premium ? C.purple : C.textDim}>
                        {selected.is_premium ? `✓ 프리미엄 (~${dateStr(selected.premium_expires_at)})` : '✗ 프리미엄'}
                      </Badge>
                    </div>
                  </DetailSection>
                </>
              ) : null}

              {selected.bio && <div style={{ marginTop: 12, padding: 10, background: C.surface, borderRadius: 8, fontSize: 12, color: C.textSec }}>{selected.bio}</div>}
              {selected.interests && selected.interests.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {selected.interests.map(i => <Badge key={i} color={C.brand}>{i}</Badge>)}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
                <button onClick={() => setPoints(selected.id, selected.points)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: C.yellow, color: C.textInv, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>포인트 변경</button>
                {selected.is_banned
                  ? <button onClick={() => userAction(selected.id, 'unban')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: C.green, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>정지 해제</button>
                  : <button onClick={() => userAction(selected.id, 'ban')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: C.red, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>정지</button>
                }
                {!selected.is_admin && <button onClick={() => userAction(selected.id, 'makeAdmin')} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: C.purple, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>관리자 부여</button>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
// 📝 CONTENT
// ══════════════════════════════════════
