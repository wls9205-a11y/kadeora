"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/feed";
  const supabase = createClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (provider: "kakao" | "google") => {
    setLoading(provider);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0E17] p-5">
      <div className="max-w-[400px] w-full bg-[#111827] rounded-[20px] border border-[#1E293B] p-10 text-center">
        <h1 className="text-[28px] font-black text-[#3B82F6] m-0 mb-1">카더라</h1>
        <p className="text-xs text-[#64748B] m-0 mb-8">진짜 정보가 오가는 금융 커뮤니티</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#FCA5A5] text-[13px]">
            ⚠️ {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleOAuth("kakao")}
            disabled={loading !== null}
            className="w-full py-3.5 rounded-xl border-none cursor-pointer bg-[#FEE500] text-[#000] text-sm font-bold disabled:opacity-50 hover:bg-[#F5DC00] transition-colors"
          >
            {loading === "kakao" ? "연결 중..." : "🗨️ 카카오로 시작하기"}
          </button>
          <button
            onClick={() => handleOAuth("google")}
            disabled={loading !== null}
            className="w-full py-3.5 rounded-xl border border-[#334155] cursor-pointer bg-transparent text-[#E2E8F0] text-sm font-bold disabled:opacity-50 hover:bg-[rgba(255,255,255,0.03)] hover:border-[#475569] transition-colors"
          >
            {loading === "google" ? "연결 중..." : "G 구글로 시작하기"}
          </button>
        </div>

        <p className="text-[11px] text-[#475569] mt-6 leading-relaxed">
          시작하면{" "}
          <Link href="/terms" className="text-[#3B82F6] hover:underline">이용약관</Link> 및{" "}
          <Link href="/privacy" className="text-[#3B82F6] hover:underline">개인정보처리방침</Link>에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}
