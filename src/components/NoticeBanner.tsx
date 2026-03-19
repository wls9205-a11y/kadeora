'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Avatar from '@/components/Avatar';

interface NoticeData {
  id: number;
  content: string;
  is_active: boolean;
  is_paid: boolean;
  display_start: string | null;
  display_end: string | null;
  linked_post_id: string | null;
  author_id: string | null;
  author?: {
    id: string;
    nickname: string | null;
    avatar_url: string | null;
    grade_title: string | null;
  } | null;
}

export default function NoticeBanner() {
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('kd_notice_v2')) {
      setDismissed(true);
      return;
    }
    const sb = createSupabaseBrowser();

    sb.from('site_notices')
      .select('id, content, is_active, is_paid, display_start, display_end, linked_post_id, author_id, profiles:author_id(id, nickname, avatar_url, grade_title)')
      .eq('is_active', true)
      .order('id', { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) return;

        const valid = data.find((n: any) => {
          if (!n.is_paid) return true;
          const start = n.display_start ? new Date(n.display_start).getTime() : 0;
          const end = n.display_end ? new Date(n.display_end).getTime() : Infinity;
          const nowMs = Date.now();
          return nowMs >= start && nowMs <= end;
        });

        if (valid) {
          setNotice({
            ...valid,
            author: Array.isArray(valid.profiles) ? valid.profiles[0] : valid.profiles,
          } as NoticeData);
        }
      })
      .catch(() => {});
  }, []);

  if (!notice || dismissed) return null;

  return (
    <>
      <div
        style={{
          background: 'var(--bg-sunken)',
          borderBottom: '1px solid var(--border)',
          height: 45,
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 52,
          flexShrink: 0,
          cursor: 'pointer',
          padding: '6px 0',
        }}
        onClick={() => setShowSheet(true)}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 40,
            background: 'linear-gradient(to right, var(--bg-sunken), transparent)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 32,
            top: 0,
            bottom: 0,
            width: 40,
            background: 'linear-gradient(to left, var(--bg-sunken), transparent)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            animation: 'kd-marquee-v2 35s linear infinite',
            paddingLeft: '100%',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--success)',
            letterSpacing: '0.03em',
          }}
        >
          <span>📡&nbsp;{notice.content}</span>
          <span style={{ margin: '0 60px', color: 'var(--text-tertiary)', fontSize: 14 }}>◆</span>
          <span>📡&nbsp;{notice.content}</span>
          <span style={{ margin: '0 60px', color: 'var(--text-tertiary)', fontSize: 14 }}>◆</span>
          <span>📡&nbsp;{notice.content}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            sessionStorage.setItem('kd_notice_v2', '1');
            setDismissed(true);
          }}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            color: 'var(--success)',
            fontSize: 16,
            cursor: 'pointer',
            zIndex: 3,
            opacity: 0.7,
            padding: '4px 6px',
          }}
        >
          x
        </button>
        <style>{`@keyframes kd-marquee-v2 { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }`}</style>
      </div>

      {/* Bottom sheet */}
      {showSheet && (
        <>
          <div
            onClick={() => setShowSheet(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 9999,
            }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10000,
              background: 'var(--bg-surface)',
              borderRadius: '16px 16px 0 0',
              padding: '20px 16px',
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
            className="animate-modalIn"
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                📡 {notice.is_paid ? '전광판 광고' : '공지사항'}
              </span>
              <button
                onClick={() => setShowSheet(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                x
              </button>
            </div>

            {/* Author info (for paid notices) */}
            {notice.author && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'var(--bg-hover)',
                  borderRadius: 12,
                  marginBottom: 16,
                }}
              >
                <Avatar
                  src={notice.author.avatar_url}
                  nickname={notice.author.nickname}
                  size={40}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {notice.author.nickname ?? '사용자'}
                  </div>
                  {notice.author.grade_title && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        marginTop: 2,
                      }}
                    >
                      {notice.author.grade_title}
                    </div>
                  )}
                </div>
                <a
                  href={`/profile/${notice.author.id}`}
                  style={{
                    fontSize: 12,
                    color: 'var(--brand)',
                    textDecoration: 'none',
                    fontWeight: 600,
                    padding: '6px 12px',
                    border: '1px solid var(--brand)',
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                >
                  프로필 보기
                </a>
              </div>
            )}

            {/* Notice content */}
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-line',
                marginBottom: 16,
              }}
            >
              {notice.content}
            </div>

            {/* Linked post */}
            {notice.linked_post_id && (
              <a
                href={`/feed/${notice.linked_post_id}`}
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  textDecoration: 'none',
                  marginBottom: 16,
                  fontSize: 13,
                  color: 'var(--brand)',
                  fontWeight: 600,
                }}
              >
                관련 게시글 보기 →
              </a>
            )}

            {/* Paid badge */}
            {notice.is_paid && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                이 전광판은 유료 노출 상품으로 등록된 콘텐츠입니다
              </div>
            )}

            {/* Close button */}
            <button
              onClick={() => setShowSheet(false)}
              style={{
                width: '100%',
                padding: '12px 0',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg-hover)',
                color: 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </>
      )}
    </>
  );
}
