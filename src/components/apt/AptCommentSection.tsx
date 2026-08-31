'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { useAuth } from '@/components/AuthProvider';
// B8-1 — 우하단 「현장 댓글」 플로팅이 이 두 id 로 찾아온다. 바꾸면 그쪽이 조용히 죽는다.
import { APT_COMMENT_INPUT_ID, APT_COMMENT_SECTION_ID } from '@/lib/apt/detail-anchors';

interface Comment {
  id: number;
  author_name: string;
  content: string;
  like_count: number;
  created_at: string;
  parent_id: number | null;
  author_id: string | null;
}

/**
 * 현장 댓글이 «어느 계보» 에 붙는가. apt_comments.house_type 이 이 값을 든다.
 * ⚠️ 어휘를 새로 만들지 않는다 — AptCommentSheet 의 Props 가 이미 이 셋으로 확립했다.
 *    셋 중 어디에도 정확히 안 맞는 현장(기축 landmark 등)은 'redev' 로 묶인다.
 *    지금 이 열을 «읽는» 코드는 없고, 정밀도보다 「NOT NULL 을 채운다」가 요건이다.
 */
export type AptCommentHouseType = 'sub' | 'unsold' | 'redev';

export default function AptCommentSection({ slug, siteName, houseType }: { slug: string; siteName: string; houseType: AptCommentHouseType }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  /* ⛔ 침묵 실패를 없앤다(P0-B ⑤ · V4-D P0-A 와 같은 계열). 아래 submit 참조. */
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { userId } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const sb = createSupabaseBrowser();
  const loginUrl = `/login?redirect=${encodeURIComponent(pathname || `/apt/${slug}`)}&source=apt_comment`;

  const load = useCallback(async () => {
    const { data } = await (sb as any).from('apt_comments')
      .select('id, author_name, content, like_count, created_at, parent_id, author_id')
      .eq('house_key', slug)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(50);
    setComments(data || []);
    setLoading(false);
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!input.trim() || input.trim().length < 2 || submitting) return;
    if (!userId) { router.push(loginUrl); return; }
    setSubmitting(true);
    setSubmitError(null);
    const { data: profile } = await sb.from('profiles').select('nickname').eq('id', userId).maybeSingle();
    /* ⛔⛔ house_type 을 «반드시» 싣는다 — NOT NULL 이고 DB 기본값이 없다.
       이것이 빠져 있어서 **이 화면의 댓글 등록이 100% 실패하고 있었다**(2026-08-31 실측:
       apt_comments 실사용자 행 «역사상 0건», 유일한 1행은 다른 경로가 넣은 것).
       그리고 아래 error 를 안 보고 있어서 화면은 «성공한 것처럼» 굴었다 —
       입력창이 비워지고 목록만 그대로였다. 그것이 「눌러도 아무 일도 없다」의 정체다. */
    const { error: insertErr } = await (sb as any).from('apt_comments').insert({
      house_key: slug,
      house_nm: siteName,
      house_type: houseType,
      author_id: userId,
      author_name: profile?.nickname || '익명',
      content: input.trim(),
    });
    setSubmitting(false);
    if (insertErr) {
      console.error('[apt-comment] 등록 실패', insertErr);
      /* ⛔ 입력을 지우지 않는다 — 실패한 마당에 쓴 글까지 잃게 하지 않는다.
         ⛔ 「죄송합니다」로 뭉개지 않는다(DS_RULES §2-5). 다음 행동을 말한다. */
      setSubmitError('댓글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setInput('');
    load();
  };

  const like = async (commentId: number) => {
    if (!userId) { router.push(loginUrl); return; }
    await (sb as any).from('apt_comments')
      .update({ like_count: comments.find(c => c.id === commentId)!.like_count + 1 })
      .eq('id', commentId);
    load();
  };

  const ago = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const dy = Math.floor(h / 24);
    if (dy < 30) return `${dy}일 전`;
    return `${Math.floor(dy / 30)}개월 전`;
  };

  const top = comments.filter(c => !c.parent_id);
  const display = showAll ? top : top.slice(0, 3);

  return (
    <div className="apt-card" id={APT_COMMENT_SECTION_ID} style={{ scrollMarginTop: 60 }}>
      <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        💬 댓글 <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--accent-blue)', fontWeight: 600 }}>{top.length}</span>
      </h2>

      {/* 입력 — 비로그인 시 로그인 유도 */}
      {userId ? (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <input
            id={APT_COMMENT_INPUT_ID}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="이 현장에 대한 의견을 남겨주세요"
            maxLength={500}
            aria-invalid={submitError ? true : undefined}
            aria-describedby={submitError ? 'kd-apt-comment-error' : undefined}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-hover)',
              fontSize: 'var(--fs-xs)', color: 'var(--text-primary)', outline: 'none',
            }}
          />
          <button
            onClick={submit}
            disabled={submitting || input.trim().length < 2}
            style={{
              padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--brand)', color: '#fff', fontSize: 'var(--fs-xs)',
              fontWeight: 500, cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting || input.trim().length < 2 ? 0.5 : 1,
            }}
          >등록</button>
        </div>
      ) : (
        <a href={loginUrl} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px 12px', marginBottom: 14, borderRadius: 'var(--radius-sm)',
          border: '1px dashed var(--border)', background: 'var(--bg-hover)',
          textDecoration: 'none', color: 'var(--brand)', fontSize: 'var(--fs-xs)', fontWeight: 600,
        }}>
          💬 로그인하고 댓글 남기기 (+5P)
        </a>
      )}

      {/* ⚠️ 색만으로 의미를 전달하지 않는다(DS_RULES §2-6) — 문장 + role="alert". */}
      {submitError && (
        <p
          id="kd-apt-comment-error"
          role="alert"
          style={{
            margin: '-8px 0 12px', fontSize: 'var(--fs-xs)',
            color: 'var(--accent-red)', lineHeight: 1.5, wordBreak: 'keep-all',
          }}
        >{submitError}</p>
      )}

      {/* 댓글 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>불러오는 중...</div>
      ) : display.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
          아직 댓글이 없습니다. 첫 번째 의견을 남겨보세요!
        </div>
      ) : (
        display.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(59,123,246,0.12)', color: 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
            }}>{c.author_name.slice(0, 1)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>{c.author_name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{ago(c.created_at)}</span>
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 3 }}>{c.content}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                <span
                  onClick={() => like(c.id)}
                  style={{ fontSize: 10, color: c.like_count > 0 ? '#FF6B6B' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}
                >👍 {c.like_count > 0 ? c.like_count : ''}</span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>답글</span>
              </div>
            </div>
          </div>
        ))
      )}

      {/* 더보기 */}
      {top.length > 3 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            width: '100%', padding: 10, marginTop: 8,
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-secondary)',
            fontSize: 'var(--fs-xs)', cursor: 'pointer',
          }}
        >댓글 {top.length - 3}개 더보기</button>
      )}

      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
        댓글은 로그인 후 작성 가능합니다. 욕설·광고는 삭제될 수 있습니다.
      </div>
    </div>
  );
}
