"use client";
import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkConsentStatus();
  }, []);

  const checkConsentStatus = useCallback(async () => {
    const sb = createSupabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      const localConsent = document.cookie.includes("kd_consent_checked=true");
      if (!localConsent) setVisible(true);
      return;
    }
    const { data: profile } = await sb
      .from("profiles")
      .select("consent_analytics")
      .eq("id", user.id)
      .single();
    if (profile?.consent_analytics === null || profile?.consent_analytics === undefined) {
      setVisible(true);
    }
  }, []);

  const handleConsent = async (accepted: boolean) => {
    setLoading(true);
    try {
      const sb = createSupabaseBrowser();
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        await sb.from("profiles").update({
          consent_analytics: accepted,
          consent_updated_at: new Date().toISOString(),
        }).eq("id", user.id);
      }
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
        background: "var(--bg-surface)", borderTop: "1px solid var(--border)",
        backdropFilter: "blur(16px)", padding: "18px 20px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ margin: "0 0 4px", fontSize: 'var(--fs-base)', fontWeight: 700, color: "var(--text-primary)" }}>
            개인정보 수집 및 이용 동의
          </p>
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: "var(--text-secondary)", lineHeight: 1.6 }}>
            카더라는 서비스 개선을 위해 검색어, 페이지 열람 기록 등 행태정보를 수집합니다.
            수집된 정보는 익명화 처리됩니다.{" "}
            <strong style={{ color: "var(--text-primary)" }}>거부하셔도 서비스 이용에 제한이 없습니다.</strong>{" "}
            <a href="/privacy" style={{ color: "var(--brand)", textDecoration: "underline" }}>개인정보처리방침</a>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => handleConsent(false)}
            disabled={loading}
            className="kd-btn kd-btn-ghost"
            style={{ fontSize: 'var(--fs-sm)' }}
          >
            거부
          </button>
          <button
            onClick={() => handleConsent(true)}
            disabled={loading}
            className="kd-btn kd-btn-primary"
            style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}
          >
            {loading ? "저장 중..." : "동의"}
          </button>
        </div>
      </div>
    </div>
  );
}