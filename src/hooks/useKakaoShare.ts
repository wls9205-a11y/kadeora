"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (params: Record<string, unknown>) => void;
      };
    };
  }
}

interface ShareParams {
  title: string;
  description: string;
  imageUrl?: string;
  linkUrl: string;
  postId?: string;
}

// ✅ 마케팅팀 피드백: 카카오 공유 바이럴화
export function useKakaoShare() {
  const supabase = createClient();

  const share = useCallback(async (params: ShareParams) => {
    const { title, description, imageUrl, linkUrl, postId } = params;

    // Kakao SDK 초기화
    if (window.Kakao && !window.Kakao.isInitialized()) {
      window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY || "");
    }

    if (!window.Kakao?.isInitialized()) {
      // Fallback: 클립보드 복사
      await navigator.clipboard.writeText(linkUrl);
      alert("링크가 복사되었습니다!");
      return;
    }

    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description,
        imageUrl: imageUrl || "https://kadeora.app/og-image.png",
        link: { webUrl: linkUrl, mobileWebUrl: linkUrl },
      },
      buttons: [
        { title: "카더라에서 보기", link: { webUrl: linkUrl, mobileWebUrl: linkUrl } },
      ],
    });

    // ✅ 전략기획팀: 공유 로그 기록
    if (postId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("share_logs").insert({
          user_id: user.id,
          post_id: postId,
          platform: "kakao" as const,
        });
      }
    }
  }, [supabase]);

  return { share };
}
