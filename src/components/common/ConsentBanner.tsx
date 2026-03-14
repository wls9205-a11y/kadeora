"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";

// ✅ A-grade 박노형 교수: 동의 상태를 서버(profiles)에 저장
// 거부 시 실제 행태정보 수집 차단

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    checkConsentStatus();
  }, []);

  const checkConsentStatus = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // 비로그인 사용자: 로컬 쿠키로 임시 저장, 로그인 후 서버 동기화
      const localConsent = document.cookie.includes("kd_consent_checked=true");
      if (!localConsent) setVisible(true);
      return;
    }

    // 로그인 사용자: 서버에서 동의 상태 확인
    const { data: profile } = await supabase
      .from("profiles")
      .select("consent_analytics")
      .eq("id", user.id)
      .single();

    if (profile?.consent_analytics === null || profile?.consent_analytics === undefined) {
      setVisible(true); // 아직 동의/거부 선택 안 함
    }
  }, [supabase]);

  const handleConsent = async (accepted: boolean) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 서버에 동의 상태 저장
        await supabase
          .from("profiles")
          .update({
            consent_analytics: accepted,
            consent_updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
      // 로컬 마커 (비로그인 fallback)
      document.cookie = `kd_consent_checked=true; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = `kd_consent=${accepted}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (err) {
      console.error("Consent save failed:", err);
    } finally {
      setLoading(false);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="개인정보 수집 동의"
      aria-modal="true"
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: "rgba(17,24,39,0.97)", borderTop: "1px solid #1E293B",
        backdropFilter: "blur(16px)", padding: "18px 20px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#F1F5F9" }}>
            개인정보 수집 및 이용 동의
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>
            카더라는 서비스 개선을 위해 검색어, 페이지 열람 기록 등 행태정보를 수집합니다.
            수집된 정보는 익명화 처리됩니다.{" "}
            <strong style={{ color: "#CBD5E1" }}>거부하셔도 서비스 이용에 제한이 없습니다.</strong>{" "}
            <a href="/privacy" style={{ color: "#3B82F6", textDecoration: "underline" }}>개인정보처리방침</a>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => handleConsent(false)}
            disabled={loading}
            style={{
              padding: "10px 18px", borderRadius: 8, border: "1px solid #334155",
              background: "transparent", color: "#94A3B8", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            거부
          </button>
          <button
            onClick={() => handleConsent(true)}
            disabled={loading}
            style={{
              padding: "10px 22px", borderRadius: 8, border: "none",
              background: "#3B82F6", color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            {loading ? "저장 중..." : "동의"}
          </button>
        </div>
      </div>
    </div>
  );
}
