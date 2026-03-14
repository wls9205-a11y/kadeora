import type { MetadataRoute } from "next";

// ✅ A-grade Rand Fishkin: 완전한 동적 사이트맵 (FAQ 포함)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://kadeora.vercel.app";

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/feed`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/stock`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/apt`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/discuss`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.7 },
    { url: `${base}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/shop/megaphone`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  // 동적 게시글 URL (프로덕션에서 Supabase 연동)
  // const supabase = createClient(URL, SERVICE_KEY);
  // const { data } = await supabase.from("posts").select("id, updated_at").limit(1000);
  // const postPages = (data || []).map(p => ({ url: `${base}/feed/${p.id}`, lastModified: new Date(p.updated_at) }));

  return [...staticPages];
}
