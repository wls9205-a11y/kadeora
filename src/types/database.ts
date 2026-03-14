// ✅ 개발팀 피드백: Supabase CLI로 자동 생성해야 하는 타입
// 명령어: npx supabase gen types typescript --project-id tezftxakuwhsclarprlz --schema public > src/types/database.ts
// 아래는 보고서 기반 추정 스키마. 실제 배포 시 반드시 CLI로 재생성할 것.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          nickname: string | null;
          avatar_url: string | null;
          region: string | null;
          interests: string[] | null;
          grade_id: number;
          points: number;
          streak_days: number;
          last_active_at: string | null;
          is_ghost: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          content: string;
          category: "stock" | "apt" | "community" | "bug" | "free";
          image_urls: string[] | null;
          view_count: number;
          like_count: number;
          comment_count: number;
          share_count: number;
          is_pinned: boolean;
          is_megaphone: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["posts"]["Row"], "id" | "view_count" | "like_count" | "comment_count" | "share_count" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          content: string;
          parent_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["comments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
      };
      post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["post_likes"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["post_likes"]["Insert"]>;
      };
      discussion_rooms: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          category: string;
          creator_id: string;
          participant_count: number;
          is_premium: boolean;
          heat_score: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["discussion_rooms"]["Row"], "id" | "participant_count" | "heat_score" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["discussion_rooms"]["Insert"]>;
      };
      discussion_messages: {
        Row: {
          id: string;
          room_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["discussion_messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["discussion_messages"]["Insert"]>;
      };
      stock_quotes: {
        Row: {
          id: string;
          symbol: string;
          name: string;
          price: number;
          change_percent: number;
          volume: number;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["stock_quotes"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["stock_quotes"]["Insert"]>;
      };
      apt_subscriptions: {
        Row: {
          id: string;
          name: string;
          region: string;
          status: string;
          start_date: string;
          end_date: string;
          total_units: number;
          competition_rate: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["apt_subscriptions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["apt_subscriptions"]["Insert"]>;
      };
      shop_products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          price: number;
          category: "badge" | "megaphone" | "profile_effect" | "nickname_color";
          image_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["shop_products"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["shop_products"]["Insert"]>;
      };
      grade_definitions: {
        Row: {
          id: number;
          name: string;
          min_points: number;
          badge_url: string | null;
          perks: Json;
        };
        Insert: Database["public"]["Tables"]["grade_definitions"]["Row"];
        Update: Partial<Database["public"]["Tables"]["grade_definitions"]["Insert"]>;
      };
      // ✅ 전략기획팀 요청: 데이터 수집 인프라 신규 테이블
      search_logs: {
        Row: {
          id: string;
          user_id: string | null;
          query: string;
          results_count: number;
          clicked_rank: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["search_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["search_logs"]["Insert"]>;
      };
      view_logs: {
        Row: {
          id: string;
          user_id: string | null;
          post_id: string;
          duration_seconds: number;
          scroll_depth: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["view_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["view_logs"]["Insert"]>;
      };
      share_logs: {
        Row: {
          id: string;
          user_id: string;
          post_id: string;
          platform: "kakao" | "link" | "other";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["share_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["share_logs"]["Insert"]>;
      };
      trending_keywords: {
        Row: {
          id: string;
          keyword: string;
          heat_score: number;
          category: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["trending_keywords"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["trending_keywords"]["Insert"]>;
      };
      user_streaks: {
        Row: {
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_login_date: string;
          updated_at: string;
        };
        Insert: Database["public"]["Tables"]["user_streaks"]["Row"];
        Update: Partial<Database["public"]["Tables"]["user_streaks"]["Insert"]>;
      };
      content_reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: "post" | "comment" | "chat";
          target_id: string;
          reason: string;
          status: "pending" | "reviewed" | "resolved" | "dismissed";
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["content_reports"]["Row"], "id" | "status" | "reviewed_at" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["content_reports"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          amount: number;
          payment_key: string;
          order_id: string;
          status: "pending" | "completed" | "failed" | "refunded";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
    };
    Functions: {
      get_trending_keywords: {
        Args: { limit_count: number };
        Returns: Database["public"]["Tables"]["trending_keywords"]["Row"][];
      };
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
