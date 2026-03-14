"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { sanitizePlainText } from "@/lib/sanitize";

const CATEGORIES = [
  { value: "stock", label: "주식", icon: "📈" },
  { value: "apt", label: "청약/부동산", icon: "🏢" },
  { value: "community", label: "커뮤니티", icon: "👥" },
  { value: "free", label: "자유", icon: "💭" },
  { value: "bug", label: "버그 제보", icon: "🐛" },
];

const MAX_TITLE = 100;
const MAX_CONTENT = 5000;
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB — 보안팀 피드백
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function WriteClient() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState("free");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setError(null);

    for (const file of files) {
      // ✅ 보안팀: 파일 유형 + 크기 검증
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("이미지 파일만 업로드 가능합니다 (JPG, PNG, GIF, WebP)");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setError("이미지 크기는 10MB 이하만 가능합니다");
        return;
      }
    }

    if (images.length + files.length > MAX_IMAGES) {
      setError(`이미지는 최대 ${MAX_IMAGES}장까지 첨부 가능합니다`);
      return;
    }

    setImages((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    const cleanTitle = sanitizePlainText(title).trim();
    const cleanContent = sanitizePlainText(content).trim();

    if (!cleanTitle) { setError("제목을 입력하세요"); return; }
    if (cleanTitle.length > MAX_TITLE) { setError(`제목은 ${MAX_TITLE}자 이하로 입력하세요`); return; }
    if (!cleanContent) { setError("내용을 입력하세요"); return; }
    if (cleanContent.length > MAX_CONTENT) { setError(`내용은 ${MAX_CONTENT}자 이하로 입력하세요`); return; }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Upload images
      const imageUrls: string[] = [];
      for (const image of images) {
        const ext = image.name.split(".").pop();
        const path = `posts/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("images").upload(path, image);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(path);
          imageUrls.push(publicUrl);
        }
      }

      // Insert post
      const { data, error: insertError } = await supabase.from("posts").insert({
        author_id: user.id,
        title: cleanTitle,
        content: cleanContent,
        category: category,
        region_id: "",
        images: imageUrls.length > 0 ? imageUrls : [],
      }).select("id").single();

      if (insertError) throw insertError;
      router.push(`/feed/${data.id}`);
    } catch (err) {
      setError("게시글 등록에 실패했습니다. 다시 시도해주세요.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, color: "#F1F5F9" }}>
        ✏️ 새 글 작성
      </h1>

      {/* Category */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", marginBottom: 8, display: "block" }}>
          카테고리
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              style={{
                padding: "8px 16px", borderRadius: 10,
                border: `1px solid ${category === cat.value ? "#3B82F6" : "#1E293B"}`,
                background: category === cat.value ? "rgba(59,130,246,0.12)" : "var(--kd-surface)",
                color: category === cat.value ? "#93C5FD" : "#94A3B8",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="제목을 입력하세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE}
          style={{
            width: "100%", padding: "14px 18px", borderRadius: 12,
            border: "1px solid var(--kd-border)", background: "var(--kd-surface)",
            color: "#F1F5F9", fontSize: 16, fontWeight: 700, outline: "none",
          }}
        />
        <div style={{ textAlign: "right", fontSize: 11, color: "#475569", marginTop: 4 }}>
          {title.length}/{MAX_TITLE}
        </div>
      </div>

      {/* Content */}
      <div style={{ marginBottom: 16 }}>
        <textarea
          placeholder="내용을 입력하세요..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={MAX_CONTENT}
          rows={12}
          style={{
            width: "100%", padding: "14px 18px", borderRadius: 12,
            border: "1px solid var(--kd-border)", background: "var(--kd-surface)",
            color: "#F1F5F9", fontSize: 14, lineHeight: 1.7, outline: "none",
            resize: "vertical", minHeight: 200,
          }}
        />
        <div style={{ textAlign: "right", fontSize: 11, color: "#475569", marginTop: 4 }}>
          {content.length}/{MAX_CONTENT}
        </div>
      </div>

      {/* Image Upload */}
      <div style={{ marginBottom: 20 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          multiple
          onChange={handleImageAdd}
          style={{ display: "none" }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= MAX_IMAGES}
          style={{
            padding: "10px 18px", borderRadius: 10,
            border: "1px dashed #334155", background: "transparent",
            color: "#64748B", fontSize: 13, cursor: "pointer",
          }}
        >
          📷 이미지 첨부 ({images.length}/{MAX_IMAGES})
        </button>

        {previews.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img
                  src={src}
                  alt={`미리보기 ${i + 1}`}
                  style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", border: "1px solid #1E293B" }}
                />
                <button
                  onClick={() => removeImage(i)}
                  style={{
                    position: "absolute", top: -6, right: -6,
                    width: 20, height: 20, borderRadius: "50%",
                    background: "#EF4444", border: "none", color: "#FFF",
                    fontSize: 10, cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 16,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#FCA5A5", fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting || !title.trim() || !content.trim()}
        style={{
          width: "100%", padding: "14px", borderRadius: 12, border: "none",
          background: submitting ? "#1E3A5F" : "#3B82F6",
          color: "#FFF", fontSize: 15, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer",
          opacity: !title.trim() || !content.trim() ? 0.5 : 1,
        }}
      >
        {submitting ? "등록 중..." : "게시하기"}
      </button>
    </div>
  );
}
