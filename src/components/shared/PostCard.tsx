"use client";

import React from "react";
import Link from "next/link";
import { getAvatarColor } from "@/lib/avatar";
import { CATEGORY_STYLES } from "@/lib/constants";

export interface PostAuthor { id: string; nickname: string; avatar_url?: string | null; grade?: number; }
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
const GRADE_EMOJI: Record<number,string> = {1:'🌱',2:'📡',3:'🏘',4:'🏠',5:'⚡',6:'🦁',7:'🏆',8:'👑',9:'🌟',10:'⚡'};

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
  const catInfo = CATEGORY_STYLES[post.category ?? ''] ?? null;
  const gradeEmoji = GRADE_EMOJI[post.author?.grade ?? 1] ?? '🌱';
  const avatarColor = getAvatarColor(displayName);
  const href = post.slug ? `/feed/${post.slug}` : `/feed/${post.id}`;

  return (
    <Link href={href} aria-label={post.title} role="article" style={{
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
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            background: avatarColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff",
          }}>
            {displayName[0].toUpperCase()}
          </div>
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{displayName}</span>
          <span>{gradeEmoji}</span>
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
        <span>🤍 {post.likes_count}</span>
        <span>💬 {post.comments_count}</span>
        {(post.view_count ?? 0) > 0 && <span>조회 {post.view_count}</span>}
      </div>
    </Link>
  );
}

export default React.memo(PostCard);
