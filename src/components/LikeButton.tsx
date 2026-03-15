"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
export function LikeButton({ postId, initialCount }: { postId: number; initialCount: number }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const handleLike = async () => {
    if (loading) return; setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLiked(!liked); setCount((p) => liked ? p-1 : p+1); setLoading(false); return; }
      if (liked) { await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id); setLiked(false); setCount((p) => p-1); }
      else { await supabase.from("post_likes").upsert({ post_id: postId, user_id: user.id }); setLiked(true); setCount((p) => p+1); }
    } catch {} finally { setLoading(false); }
  };
  return <button onClick={handleLike} disabled={loading} className={`flex items-center gap-1 text-sm border-none bg-transparent cursor-pointer transition-all ${liked ? "text-[#EF4444] scale-110" : "text-[#64748B] hover:text-[#EF4444]"}`}>{liked ? "❤️" : "🤍"} {count}</button>;
}
