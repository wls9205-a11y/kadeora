import type { MetadataRoute } from "next";

// ✅ 마케팅팀 피드백: robots.txt 구현 (관리자 페이지 제외)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/payment/", "/callback/"],
      },
    ],
    sitemap: "https://kadeora.vercel.app/sitemap.xml",
  };
}
