"use client";

import React from "react";
import Link from "next/link";
import { Heart, MessageCircle, Eye } from 'lucide-react';
import { getAvatarColor } from "@/lib/avatar";
import { gradeEmoji as getGradeEmoji, gradeColor, gradeTitle } from "@/lib/constants";

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
function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

function PostCard({ post, variant = "default", showAuthor = true }: PostCardProps) {
  const displayName = post.is_anonymous ? "익명" : post.author?.nickname || "사용자";
  const gradeEm = getGradeEmoji(post.author?.grade ?? 1);
  const gradeCol = gradeColor(post.author?.grade ?? 1);
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
          fontSize: 'var(--fs-sm)', marginBottom: 6,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            background: avatarColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: "#fff",
          }}>
            {displayName[0].toUpperCase()}
          </div>
          <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{displayName}</span>
          <span style={{ fontSize: 'var(--fs-sm)', color: gradeCol }}>{gradeEm}</span>
          <span style={{ fontSize: 'var(--fs-xs)', color: gradeCol, fontWeight: 600 }}>{gradeTitle(post.author?.grade ?? 1)}</span>
          <span style={{ marginLeft: "auto", fontSize: 'var(--fs-sm)', color: "var(--text-tertiary)" }}>
            {timeAgo(post.created_at)}
          </span>
        </div>
      )}

      {/* Title */}
      <h3 style={{
        fontSize: 'var(--fs-md)', fontWeight: 700,
        margin: "0 0 5px", lineHeight: 1.4, color: "var(--text-primary)",
      }}>{post.title}</h3>

      {/* Content preview */}
      {variant !== "compact" && (
        <p style={{
          fontSize: 'var(--fs-sm)', color: "var(--text-tertiary)", lineHeight: 1.6,
          margin: "0 0 10px",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
          overflow: "hidden",
        }}>{post.content}</p>
      )}

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        fontSize: 'var(--fs-sm)', color: "var(--text-tertiary)",
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Heart size={14} /> {post.likes_count}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MessageCircle size={14} /> {post.comments_count}</span>
        {(post.view_count ?? 0) > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Eye size={14} /> {post.view_count}</span>}
      </div>
    </Link>
  );
}

export default React.memo(PostCard);
