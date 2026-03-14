// ============================================================
// KADEORA v4.0 — 실제 Supabase DB 스키마 기반 타입
// 실제 배포 시: npx supabase gen types typescript --project-id tezftxakuwhsclarprlz --schema public > src/types/database.ts
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nickname: string;
          bio: string | null;
          avatar_url: string | null;
          likes_count: number;
          provider: string | null;
          created_at: string;
          updated_at: string;
          followers_count: number;
          following_count: number;
          posts_count: number;
          full_name: string | null;
          phone: string | null;
          interests: string[] | null;
          region_text: string | null;
          kakao_id: string | null;
          google_email: string | null;
          marketing_agreed: boolean | null;
          onboarded: boolean | null;
          residence_city: string | null;
          residence_district: string | null;
          points: number;
          profile_completed: boolean;
          streak_days: number;
          last_checked_date: string | null;
          nickname_set: boolean;
          nickname_change_count: number;
          nickname_change_tickets: number;
          is_premium: boolean;
          premium_expires_at: string | null;
          gender: string | null;
          influence_score: number;
          grade: number;
          grade_title: string;
          // v4.0 추가 컬럼
          consent_analytics: boolean;
          consent_updated_at: string | null;
          birth_date: string | null;
          is_ghost: boolean;
          deleted_at: string | null;
          is_deleted: boolean;
          last_active_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; nickname: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      posts: {
        Row: {
          id: number; // bigint
          author_id: string | null;
          category: string;
          region_id: string;
          city: string;
          title: string;
          content: string;
          is_anonymous: boolean;
          likes_count: number;
          comments_count: number;
          report_count: number;
          tag: string | null;
          stock_tags: string[];
          images: string[];
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
          apt_tags: string[];
          downvotes_count: number;
          view_count: number;
          room_id: number | null;
          slug: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["posts"]["Row"]> & { title: string; content: string; category: string };
        Update: Partial<Database["public"]["Tables"]["posts"]["Row"]>;
      };
      comments: {
        Row: {
          id: number; // bigint
          post_id: number;
          author_id: string | null;
          parent_id: number | null;
          content: string;
          is_anonymous: boolean;
          likes_count: number;
          is_deleted: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["comments"]["Row"]> & { post_id: number; content: string };
        Update: Partial<Database["public"]["Tables"]["comments"]["Row"]>;
      };
      post_likes: {
        Row: { post_id: number; user_id: string; created_at: string };
        Insert: { post_id: number; user_id: string };
        Update: Partial<Database["public"]["Tables"]["post_likes"]["Row"]>;
      };
      discussion_rooms: {
        Row: {
          id: number;
          room_type: string;
          room_key: string;
          display_name: string;
          description: string | null;
          member_count: number;
          post_count: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["discussion_rooms"]["Row"]> & { room_type: string; room_key: string; display_name: string };
        Update: Partial<Database["public"]["Tables"]["discussion_rooms"]["Row"]>;
      };
      discussion_messages: {
        Row: {
          id: number;
          room_id: number;
          author_id: string;
          content: string;
          is_anonymous: boolean | null;
          created_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["discussion_messages"]["Row"]> & { room_id: number; author_id: string; content: string };
        Update: Partial<Database["public"]["Tables"]["discussion_messages"]["Row"]>;
      };
      stock_quotes: {
        Row: {
          symbol: string; // PK
          name: string;
          market: string;
          price: number | null;
          change_amt: number | null;
          change_pct: number | null;
          volume: number | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["stock_quotes"]["Row"]> & { symbol: string; name: string; market: string };
        Update: Partial<Database["public"]["Tables"]["stock_quotes"]["Row"]>;
      };
      shop_products: {
        Row: {
          id: string; // text PK
          name: string;
          description: string;
          price_krw: number;
          icon: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: Database["public"]["Tables"]["shop_products"]["Row"];
        Update: Partial<Database["public"]["Tables"]["shop_products"]["Row"]>;
      };
      grade_definitions: {
        Row: {
          grade: number;
          title: string;
          emoji: string;
          color_hex: string;
          min_score: number;
          description: string;
        };
        Insert: Database["public"]["Tables"]["grade_definitions"]["Row"];
        Update: Partial<Database["public"]["Tables"]["grade_definitions"]["Row"]>;
      };
      // v4.0 신규 테이블
      search_logs: {
        Row: { id: string; user_id: string | null; query: string; results_count: number; clicked_rank: number | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["search_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["search_logs"]["Insert"]>;
      };
      view_logs: {
        Row: { id: string; user_id: string | null; post_id: number; duration_seconds: number; scroll_depth: number; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["view_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["view_logs"]["Insert"]>;
      };
      share_logs: {
        Row: { id: number; post_id: number; user_id: string | null; platform: string; created_at: string | null };
        Insert: Partial<Database["public"]["Tables"]["share_logs"]["Row"]> & { post_id: number; platform: string };
        Update: Partial<Database["public"]["Tables"]["share_logs"]["Row"]>;
      };
      trending_keywords: {
        Row: { id: string; keyword: string; heat_score: number; category: string | null; updated_at: string };
        Insert: Omit<Database["public"]["Tables"]["trending_keywords"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["trending_keywords"]["Insert"]>;
      };
      user_streaks: {
        Row: { user_id: string; current_streak: number; longest_streak: number; last_login_date: string; updated_at: string };
        Insert: Database["public"]["Tables"]["user_streaks"]["Row"];
        Update: Partial<Database["public"]["Tables"]["user_streaks"]["Row"]>;
      };
      content_reports: {
        Row: { id: string; reporter_id: string; target_type: string; target_id: number; reason: string; status: string; reviewed_at: string | null; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["content_reports"]["Row"], "id" | "status" | "reviewed_at" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["content_reports"]["Insert"]>;
      };
      payments: {
        Row: { id: string; user_id: string; product_id: string; amount: number; payment_key: string; order_id: string; status: string; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      invite_codes: {
        Row: { id: string; code: string; creator_id: string; used_by: string | null; is_used: boolean; created_at: string; used_at: string | null };
        Insert: Omit<Database["public"]["Tables"]["invite_codes"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["invite_codes"]["Insert"]>;
      };
    };
    Functions: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
