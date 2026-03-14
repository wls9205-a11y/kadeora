"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface ReportModalProps {
  targetType: "post" | "comment" | "chat";
  targetId: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  { value: "spam", label: "스팸/광고" },
  { value: "abuse", label: "욕설/비방" },
  { value: "defamation", label: "명예훼손" },
  { value: "misinformation", label: "허위 정보" },
  { value: "copyright", label: "저작권 침해" },
  { value: "privacy", label: "개인정보 노출" },
  { value: "other", label: "기타" },
];

// ✅ 법무팀 피드백: 콘텐츠 신고/삭제 프로세스 (정통망법 제44조)
export function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const supabase = createClient();

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("로그인이 필요합니다."); return; }

      await supabase.from("content_reports").insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason: `${reason}${detail ? `: ${detail}` : ""}`,
      });

      setSubmitted(true);
    } catch {
      alert("신고 접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111827", borderRadius: 16, border: "1px solid #1E293B",
          padding: 28, maxWidth: 440, width: "100%",
        }}
      >
        {submitted ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", margin: "0 0 8px" }}>
              신고가 접수되었습니다
            </h3>
            <p style={{ fontSize: 13, color: "#94A3B8", margin: "0 0 20px" }}>
              24시간 내 1차 검토 후 72시간 내 처리 결과를 안내드립니다.
            </p>
            <button
              onClick={onClose}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: "#3B82F6", color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              확인
            </button>
          </div>
        ) : (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#F1F5F9", margin: "0 0 16px" }}>
              🚨 콘텐츠 신고
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                    border: `1px solid ${reason === r.value ? "#3B82F6" : "#1E293B"}`,
                    background: reason === r.value ? "rgba(59,130,246,0.08)" : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ accentColor: "#3B82F6" }}
                  />
                  <span style={{ fontSize: 13, color: reason === r.value ? "#93C5FD" : "#94A3B8" }}>
                    {r.label}
                  </span>
                </label>
              ))}
            </div>

            <textarea
              placeholder="상세 내용 (선택사항)"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={500}
              rows={3}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                border: "1px solid #1E293B", background: "rgba(255,255,255,0.03)",
                color: "#CBD5E1", fontSize: 13, outline: "none", resize: "none", marginBottom: 16,
              }}
            />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px", borderRadius: 8, border: "1px solid #334155",
                  background: "transparent", color: "#94A3B8", fontSize: 13, cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                style={{
                  padding: "10px 20px", borderRadius: 8, border: "none",
                  background: reason ? "#EF4444" : "#334155",
                  color: "#FFF", fontSize: 13, fontWeight: 700,
                  cursor: reason ? "pointer" : "not-allowed",
                  opacity: reason ? 1 : 0.5,
                }}
              >
                {submitting ? "접수 중..." : "신고하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
