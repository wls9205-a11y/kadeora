"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

export interface PostAuthor { id: string; nickname: string; avatar_url?: string | null; }
export interface Post {
  id: number | string; title: string; content: string; created_at: string;
  category?: string; likes_count: number; comments_count: number; view_count?: number;
  author?: PostAuthor; author_id?: string; is_liked?: boolean; images?: string[] | null;
  is_anonymous?: boolean; tag?: string | null; slug?: string | null;
  hashtags?: string[] | null;
}
export interface PostCardProps {
  post: Post;
  onLike?: (postId: number | string) => Promise<void>;
  variant?: "default" | "compact";
  showAuthor?: boolean;
}

const CATEGORY_LABEL: Record<string, string> = {
  stock: '주식', apt: '부동산', local: '우리동네', free: '자유',
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

function PostCard({ post, onLike, variant = "default", showAuthor = true }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.is_liked ?? false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isLiking, setIsLiking] = useState(false);
  const isCompact = variant === "compact";
  const thumbnail = post.images?.[0] ?? null;
  const MAX_VISIBLE_TAGS = 2;
  const extraTags = (post.hashtags?.length ?? 0) - MAX_VISIBLE_TAGS;

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (isLiking || !onLike) return;
    setIsLiking(true);
    setIsLiked(prev => !prev);
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
    try { await onLike(post.id); } catch {
      setIsLiked(prev => !prev);
      setLikesCount(prev => isLiked ? prev + 1 : prev - 1);
    } finally { setIsLiking(false); }
  }, [post.id, isLiked, isLiking, onLike]);

  const displayName = post.is_anonymous ? "익명" : post.author?.nickname || "사용자";

  return (
    <Link href={`/feed/${post.id}`} className="kd-post-card" style={{
      display: "flex", textDecoration: "none", color: "inherit",
      padding: isCompact ? "10px 14px" : "12px 16px",
      borderRadius: 4, backgroundColor: "var(--bg-surface)",
      marginBottom: 2, transition: "background-color 0.15s",
      gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{
          fontSize: isCompact ? "14px" : "15px", fontWeight: 600,
          margin: "0 0 4px", lineHeight: 1.4, color: "var(--text-primary)",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
          overflow: "hidden",
        }}>{post.title}</h3>

        {!isCompact && (
          <p style={{
            fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5,
            margin: "0 0 8px",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
            overflow: "hidden",
          }}>{post.content}</p>
        )}

        {/* Meta line: author, time, category, tags, engagement */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: "12px", color: "var(--text-tertiary)",
          flexWrap: "wrap", overflow: "hidden",
        }}>
          {showAuthor && <span style={{ fontWeight: 500 }}>{displayName}</span>}
          {showAuthor && <span>·</span>}
          <span>{timeAgo(post.created_at)}</span>

          {post.category && (
            <>
              <span>·</span>
              <span style={{
                fontSize: 11, fontWeight: 500, padding: "1px 6px", borderRadius: 3,
                backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)",
              }}>{CATEGORY_LABEL[post.category] || post.category}</span>
            </>
          )}

          {post.hashtags && post.hashtags.length > 0 && (
            <>
              {post.hashtags.slice(0, MAX_VISIBLE_TAGS).map((tag: string) => (
                <span key={tag} style={{
                  fontSize: 11, padding: "1px 6px", borderRadius: 8,
                  background: "var(--brand-light)", color: "var(--brand)", fontWeight: 600,
                }}>#{tag}</span>
              ))}
              {extraTags > 0 && (
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>+{extraTags}개</span>
              )}
            </>
          )}

          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={handleLike} disabled={isLiking || !onLike} style={{
              display: "flex", alignItems: "center", gap: 2, background: "none",
              border: "none", padding: 0, cursor: onLike ? "pointer" : "default",
              color: isLiked ? "var(--brand)" : "var(--text-tertiary)", fontSize: "12px",
            }} aria-label={isLiked ? "좋아요 취소" : "좋아요"}>
              <span style={{ fontSize: 13 }}>{isLiked ? "♥" : "♡"}</span>
              {likesCount > 0 && <span>{likesCount}</span>}
            </button>
            {post.comments_count > 0 && <span>💬 {post.comments_count}</span>}
            {(post.view_count ?? 0) > 0 && <span>조회수 {post.view_count}</span>}
          </span>
        </div>
      </div>

      {/* Thumbnail */}
      {thumbnail && !isCompact && (
        <div style={{ flexShrink: 0, width: 60, height: 60, borderRadius: 6, overflow: "hidden" }}>
          <Image src={thumbnail} alt="" width={60} height={60} style={{ objectFit: "cover", width: 60, height: 60 }} />
        </div>
      )}
    </Link>
  );
}

export default React.memo(PostCard);
