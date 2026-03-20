"use client";

import React from "react";
import Link from "next/link";

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

const CAT_COLORS: Record<string, {bg: string; color: string; label: string}> = {
  apt: { bg: '#3b82f620', color: '#3b82f6', label: '부동산' },
  stock: { bg: '#ef444420', color: '#ef4444', label: '주식' },
  local: { bg: '#10b98120', color: '#10b981', label: '우리동네' },
  free: { bg: '#8b5cf620', color: '#8b5cf6', label: '자유' },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

function PostCard({ post, variant = "default", showAuthor = true }: PostCardProps) {
  const displayName = post.is_anonymous ? "익명" : post.author?.nickname || "사용자";
  const catInfo = CAT_COLORS[post.category ?? ''] ?? null;

  return (
    <Link href={`/feed/${post.id}`} style={{
      display: "block", textDecoration: "none", color: "inherit",
      padding: "14px 0",
      borderBottom: "1px solid var(--border)",
    }}>
      {/* Header row */}
      {showAuthor && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, marginBottom: 6,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: "var(--brand)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "var(--text-inverse, #fff)",
          }}>
            {displayName[0].toUpperCase()}
          </div>
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{displayName}</span>
          {catInfo && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
              background: catInfo.bg, color: catInfo.color,
            }}>{catInfo.label}</span>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>
            {timeAgo(post.created_at)}
          </span>
        </div>
      )}

      {/* Title */}
      <h3 style={{
        fontSize: 16, fontWeight: 700,
        margin: "0 0 5px", lineHeight: 1.4, color: "var(--text-primary)",
      }}>{post.title}</h3>

      {/* Content preview */}
      {variant !== "compact" && (
        <p style={{
          fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6,
          margin: "0 0 10px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
          overflow: "hidden",
        }}>{post.content}</p>
      )}

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        fontSize: 12, color: "var(--text-tertiary)",
      }}>
        <span>♡ {post.likes_count}</span>
        <span>💬 {post.comments_count}</span>
        {(post.view_count ?? 0) > 0 && <span>조회 {post.view_count}</span>}
      </div>
    </Link>
  );
}

export default React.memo(PostCard);
