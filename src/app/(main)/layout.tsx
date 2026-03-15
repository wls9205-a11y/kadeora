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
    <div className="min-h-screen flex flex-col bg-[var(--kd-bg)]">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-[rgba(10,14,23,0.85)] backdrop-blur-xl border-b border-[var(--kd-border)] px-5 h-14 flex items-center justify-between">
        <Link href="/feed" className="no-underline flex items-center gap-2">
          <span className="text-xl font-black text-[#3B82F6] tracking-tight">카더라</span>
          <span className="text-[10px] text-[#64748B] font-semibold">KADEORA</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-2 rounded-lg no-underline text-[13px] transition-all ${
                  isActive
                    ? "font-bold text-[#F1F5F9] bg-[rgba(59,130,246,0.1)]"
                    : "font-medium text-[#64748B] hover:text-[#94A3B8] hover:bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href="/write"
            className="px-4 py-1.5 rounded-lg no-underline bg-[#3B82F6] text-white text-xs font-bold hover:bg-[#2563EB] transition-colors"
          >
            ✏️ 글쓰기
          </Link>
          <Link
            href="/login"
            className="px-3.5 py-1.5 rounded-lg no-underline border border-[#334155] text-[#94A3B8] text-xs font-semibold hover:border-[#475569] hover:text-[#CBD5E1] transition-colors"
          >
            로그인
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 bg-transparent border-none text-[#94A3B8] text-xl cursor-pointer"
            aria-label="메뉴 열기"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[var(--kd-surface)] border-b border-[var(--kd-border)] px-5 py-3 flex flex-wrap gap-2 z-40">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-3 py-1.5 rounded-lg no-underline text-sm ${
                  isActive
                    ? "font-bold text-[#93C5FD] bg-[rgba(59,130,246,0.1)] border border-[#3B82F6]"
                    : "font-medium text-[#64748B] border border-[#1E293B]"
                }`}
              >
                {item.icon} {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Content */}
      <main className="flex-1 w-full max-w-[960px] mx-auto px-4 py-5">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[rgba(10,14,23,0.95)] backdrop-blur-xl border-t border-[var(--kd-border)] flex justify-around py-2 pb-3 z-50">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 no-underline text-lg px-3 py-1"
            >
              <span>{item.icon}</span>
              <span className={`text-[10px] ${
                isActive ? "font-bold text-[#3B82F6]" : "font-medium text-[#64748B]"
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
