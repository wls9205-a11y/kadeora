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
}
export interface PostCardProps {
  post: Post;
  onLike?: (postId: number | string) => Promise<void>;
  variant?: "default" | "compact";
  showAuthor?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "\u2026";
}

function PostCard({ post, onLike, variant = "default", showAuthor = true }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(post.is_liked ?? false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isLiking, setIsLiking] = useState(false);
  const isCompact = variant === "compact";

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

  const displayName = post.is_anonymous ? "\uC775\uBA85" : post.author?.nickname || "\uC0AC\uC6A9\uC790";

  return (
    <Link href={`/feed/${post.id}`} className="kd-post-card" style={{ display: "block", textDecoration: "none", color: "inherit", padding: isCompact ? "12px 16px" : "16px 20px", borderRadius: "4px", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", marginBottom: "8px", transition: "background-color 0.15s, box-shadow 0.15s, border-color 0.15s" }}>
      {showAuthor && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          {post.author?.avatar_url && !post.is_anonymous ? (
            <Image src={post.author.avatar_url} alt="" width={24} height={24} style={{ borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 500, color: "var(--text-inverse, #fff)" }}>
              {displayName[0]}
            </div>
          )}
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{displayName}</span>
          <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>{timeAgo(post.created_at)}</span>
        </div>
      )}
      {post.category && <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "4px", backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)", marginBottom: "6px" }}>{post.category}</span>}
      <h3 style={{ fontSize: isCompact ? "14px" : "16px", fontWeight: 600, margin: "0 0 4px", lineHeight: 1.4, color: "var(--text-primary)" }}>{truncate(post.title, isCompact ? 40 : 80)}</h3>
      {!isCompact && <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 12px" }}>{truncate(post.content, 120)}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "13px", color: "var(--text-tertiary)" }}>
        <button onClick={handleLike} disabled={isLiking || !onLike} style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", padding: 0, cursor: onLike ? "pointer" : "default", color: isLiked ? "var(--brand)" : "var(--text-tertiary)", fontSize: "13px" }} aria-label={isLiked ? "\uC88B\uC544\uC694 \uCDE8\uC18C" : "\uC88B\uC544\uC694"}>
          <span style={{ fontSize: "15px" }}>{isLiked ? "\u2665" : "\u2661"}</span>
          {likesCount > 0 && <span>{likesCount}</span>}
        </button>
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ fontSize: "14px" }}>{"\uD83D\uDCAC"}</span>{post.comments_count > 0 && <span>{post.comments_count}</span>}</span>
        {(post.view_count ?? 0) > 0 && <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ fontSize: "14px" }}>{"\uD83D\uDC41"}</span><span>{post.view_count}</span></span>}
      </div>
    </Link>
  );
}

export default React.memo(PostCard);
