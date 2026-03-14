import type { Metadata } from "next";

// ✅ v3.0 — Rand Fishkin 피드백: GEO 최적화용 FAQ 페이지
// AI 검색엔진(Perplexity, ChatGPT)이 인용하기 쉬운 Q&A 구조

export const metadata: Metadata = {
  title: "자주 묻는 질문 FAQ — 카더라 KADEORA",
  description: "카더라(KADEORA)에 대한 자주 묻는 질문. 주식 커뮤니티, 부동산 청약 정보, 실시간 토론방 등 서비스 안내.",
  other: {
    "script:ld+json": JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "카더라(KADEORA)는 어떤 서비스인가요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "카더라는 주식, 부동산, 청약 정보를 실시간으로 나누는 금융 특화 커뮤니티 웹앱입니다. 실시간 토론방, 인기 키워드, 지역별 맞춤 정보를 제공합니다.",
          },
        },
        {
          "@type": "Question",
          name: "2026년 서울 아파트 청약 정보를 어디서 볼 수 있나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "카더라 청약 섹션에서 전국 아파트 청약 일정, 경쟁률, 분양가를 확인할 수 있으며, 지역별 맞춤 알림을 받을 수 있습니다.",
          },
        },
        {
          "@type": "Question",
          name: "실시간 주식 토론방은 어떻게 이용하나요?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "카더라에 가입 후 토론 탭에서 관심 종목이나 주제별 실시간 토론방에 참여할 수 있습니다. 실시간 채팅과 투표 기능을 제공합니다.",
          },
        },
      ],
    }),
  },
};

const FAQS = [
  {
    q: "카더라(KADEORA)는 어떤 서비스인가요?",
    a: "카더라는 주식, 부동산, 청약 정보를 실시간으로 나누는 금융 특화 커뮤니티 웹앱입니다. 사용자들이 직접 정보를 공유하고, 실시간 토론방에서 의견을 나누며, 지역별 맞춤 정보를 받을 수 있습니다.",
  },
  {
    q: "2026년 서울 아파트 청약 정보를 어디서 볼 수 있나요?",
    a: "카더라 청약 섹션에서 전국 아파트 청약 일정, 경쟁률, 분양가 비교 정보를 확인할 수 있습니다. 관심 지역을 설정하면 새로운 청약 공고가 올라올 때 알림도 받을 수 있습니다.",
  },
  {
    q: "실시간 주식 토론방은 어떻게 이용하나요?",
    a: "카더라에 가입한 후 토론 탭에서 관심 종목이나 주제별 토론방에 참여할 수 있습니다. 실시간 채팅으로 다른 투자자들과 의견을 나눌 수 있으며, 커뮤니티에서 가장 뜨거운 토론방은 자동으로 상단에 노출됩니다.",
  },
  {
    q: "카더라는 무료인가요?",
    a: "기본 서비스(커뮤니티 게시판, 실시간 토론, 주식/청약 정보 열람)는 무료입니다. 향후 프리미엄 분석 리포트, 특별 배지 등 부가 서비스가 유료로 제공될 예정입니다.",
  },
  {
    q: "개인정보는 안전하게 보호되나요?",
    a: "카더라는 개인정보보호법을 준수하며, 모든 데이터는 서울 리전의 암호화된 서버에 저장됩니다. 행태정보 수집은 사용자의 명시적 동의를 받은 경우에만 이루어집니다.",
  },
  {
    q: "카더라에서 투자 조언을 받을 수 있나요?",
    a: "카더라는 사용자 간 정보 공유 커뮤니티이며, 전문 투자 조언 서비스가 아닙니다. 게시된 정보는 참고 목적이며, 투자 판단의 책임은 이용자에게 있습니다.",
  },
];

export default function FAQPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 100px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--kd-text, #F1F5F9)", marginBottom: 8 }}>
        자주 묻는 질문
      </h1>
      <p style={{ fontSize: 13, color: "#64748B", marginBottom: 32 }}>
        카더라(KADEORA) 서비스에 대한 궁금증을 해결해 드립니다.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {FAQS.map((faq, i) => (
          <details
            key={i}
            style={{
              borderRadius: 12,
              border: "1px solid #1E293B",
              background: "#111827",
              overflow: "hidden",
            }}
          >
            <summary
              style={{
                padding: "16px 20px",
                fontSize: 15,
                fontWeight: 700,
                color: "#F1F5F9",
                cursor: "pointer",
                listStyle: "none",
              }}
            >
              {faq.q}
            </summary>
            <div style={{
              padding: "0 20px 16px",
              fontSize: 14,
              color: "#94A3B8",
              lineHeight: 1.8,
            }}>
              {faq.a}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
