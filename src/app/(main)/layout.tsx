"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/feed", label: "피드", icon: "🏠" },
  { href: "/stock", label: "주식", icon: "📈" },
  { href: "/apt", label: "청약", icon: "🏢" },
  { href: "/discuss", label: "토론", icon: "💬" },
  { href: "/shop/megaphone", label: "상점", icon: "🛒" },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Header */}
      <header
        style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(10,14,23,0.85)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--kd-border)",
          padding: "0 20px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Link href="/feed" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#3B82F6", letterSpacing: "-0.03em" }}>카더라</span>
          <span style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>KADEORA</span>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: "flex", gap: 4 }} className="hidden md:flex">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "8px 14px", borderRadius: 8, textDecoration: "none",
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#F1F5F9" : "#64748B",
                  background: isActive ? "rgba(59,130,246,0.1)" : "transparent",
                  transition: "all 0.2s",
                }}
              >
                <span style={{ marginRight: 4 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/write"
            style={{
              padding: "7px 16px", borderRadius: 8, textDecoration: "none",
              background: "#3B82F6", color: "#FFF", fontSize: 12, fontWeight: 700,
            }}
          >
            ✏️ 글쓰기
          </Link>
          <Link
            href="/login"
            style={{
              padding: "7px 14px", borderRadius: 8, textDecoration: "none",
              border: "1px solid #334155", color: "#94A3B8", fontSize: 12, fontWeight: 600,
            }}
          >
            로그인
          </Link>
          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: "none", padding: 6, background: "none", border: "none",
              color: "#94A3B8", fontSize: 20, cursor: "pointer",
            }}
            className="md:hidden"
            aria-label="메뉴 열기"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, maxWidth: 960, width: "100%", margin: "0 auto", padding: "20px 16px" }}>
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "rgba(10,14,23,0.95)", backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--kd-border)",
          display: "flex", justifyContent: "space-around", padding: "8px 0 12px",
          zIndex: 100,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                textDecoration: "none", fontSize: 18, padding: "4px 12px",
              }}
            >
              <span>{item.icon}</span>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 700 : 500,
                color: isActive ? "#3B82F6" : "#64748B",
              }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
