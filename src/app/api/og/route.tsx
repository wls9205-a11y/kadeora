// ✅ v3.0 — Rand Fishkin 피드백: 동적 OG 이미지 생성
// 게시글별 맞춤 OG 이미지로 SNS 클릭률 향상

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const CATEGORY_COLORS: Record<string, string> = {
  stock: "#3B82F6",
  apt: "#10B981",
  community: "#8B5CF6",
  free: "#F59E0B",
  bug: "#EF4444",
};

const CATEGORY_LABELS: Record<string, string> = {
  stock: "주식",
  apt: "청약/부동산",
  community: "커뮤니티",
  free: "자유",
  bug: "버그 제보",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "카더라 KADEORA";
  const category = searchParams.get("category") || "free";
  const likes = searchParams.get("likes") || "0";
  const comments = searchParams.get("comments") || "0";

  const color = CATEGORY_COLORS[category] || "#64748B";
  const label = CATEGORY_LABELS[category] || "카더라";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0A0E17 0%, #111827 50%, #0F172A 100%)",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                padding: "6px 16px",
                borderRadius: "20px",
                background: `${color}22`,
                color: color,
                fontSize: "20px",
                fontWeight: 700,
                border: `2px solid ${color}44`,
              }}
            >
              {label}
            </span>
          </div>
          <h1
            style={{
              fontSize: title.length > 30 ? "42px" : "52px",
              fontWeight: 900,
              color: "#F1F5F9",
              lineHeight: 1.3,
              maxWidth: "900px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title.length > 60 ? title.slice(0, 57) + "..." : title}
          </h1>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", gap: "24px", fontSize: "22px", color: "#94A3B8" }}>
            <span>❤️ {likes}</span>
            <span>💬 {comments}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "32px", fontWeight: 900, color: "#3B82F6" }}>카더라</span>
            <span style={{ fontSize: "16px", color: "#64748B" }}>KADEORA</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
