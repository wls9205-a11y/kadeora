"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

interface PaymentProduct {
  id: string;
  name: string;
  price: number;
  description: string | null;
}

export function PaymentClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const productId = searchParams.get("product");

  const [product, setProduct] = useState<PaymentProduct | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!productId) {
      router.push("/shop/megaphone");
      return;
    }
    loadProduct(productId);
  }, [productId]);

  async function loadProduct(id: string) {
    const { data, error } = await supabase
      .from("shop_products")
      .select("id, name, price, description")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      setErrorMsg("상품을 찾을 수 없습니다.");
      setStatus("error");
      return;
    }
    setProduct(data);
    setStatus("ready");
  }

  async function handlePayment() {
    if (!product) return;
    setStatus("processing");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const orderId = `KD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // ✅ 법무팀 피드백: 결제 전 개인정보 처리 안내
      const confirmed = window.confirm(
        `${product.name} (${product.price.toLocaleString()}원)\n\n` +
        "결제를 진행하시겠습니까?\n\n" +
        "※ 결제 정보는 토스페이먼츠를 통해 안전하게 처리됩니다.\n" +
        "※ 환불 정책은 서비스 이용약관을 참고해주세요."
      );
      if (!confirmed) { setStatus("ready"); return; }

      // Toss Payments 연동 — Edge Function 호출
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          orderId,
          amount: product.price,
          orderName: product.name,
        }),
      });

      if (!response.ok) throw new Error("결제 생성 실패");

      const { paymentUrl } = await response.json();
      if (paymentUrl) {
        window.location.href = paymentUrl;
      }
    } catch (err) {
      setErrorMsg("결제 처리 중 오류가 발생했습니다.");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#64748B" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        상품 정보를 불러오는 중...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{
        maxWidth: 480, margin: "40px auto", textAlign: "center", padding: 40,
        background: "var(--kd-surface)", borderRadius: 16, border: "1px solid var(--kd-border)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <p style={{ color: "#FCA5A5", fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>{errorMsg}</p>
        <button
          onClick={() => router.push("/shop/megaphone")}
          style={{
            padding: "10px 24px", borderRadius: 8, border: "1px solid #334155",
            background: "transparent", color: "#94A3B8", fontSize: 13, cursor: "pointer",
          }}
        >
          상점으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9", marginBottom: 24 }}>💳 결제</h1>

      {product && (
        <div style={{
          background: "var(--kd-surface)", borderRadius: 16,
          border: "1px solid var(--kd-border)", padding: 24, marginBottom: 20,
        }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#F1F5F9" }}>
            {product.name}
          </h2>
          {product.description && (
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#94A3B8" }}>{product.description}</p>
          )}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0", borderTop: "1px solid var(--kd-border)",
          }}>
            <span style={{ fontSize: 14, color: "#94A3B8" }}>결제 금액</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: "#3B82F6" }}>
              {product.price.toLocaleString()}원
            </span>
          </div>
        </div>
      )}

      {/* ✅ 법무팀: 결제 관련 법적 안내 */}
      <div style={{
        padding: "14px 16px", borderRadius: 10, marginBottom: 20,
        background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)",
        fontSize: 11, color: "#94A3B8", lineHeight: 1.7,
      }}>
        <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#93C5FD" }}>결제 안내</p>
        • 결제는 토스페이먼츠를 통해 안전하게 처리됩니다.<br />
        • 디지털 콘텐츠 특성상 구매 후 즉시 사용 시 환불이 제한될 수 있습니다.<br />
        • 자세한 환불 정책은 <a href="/terms" style={{ color: "#3B82F6" }}>이용약관</a>을 참고하세요.
      </div>

      <button
        onClick={handlePayment}
        disabled={status === "processing"}
        style={{
          width: "100%", padding: "16px", borderRadius: 12, border: "none",
          background: status === "processing" ? "#1E3A5F" : "#3B82F6",
          color: "#FFF", fontSize: 16, fontWeight: 800, cursor: status === "processing" ? "not-allowed" : "pointer",
        }}
      >
        {status === "processing" ? "결제 진행 중..." : "결제하기"}
      </button>
    </div>
  );
}
