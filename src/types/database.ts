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
        Insert: {
          id: string;
          username: string;
          nickname?: string | null;
          avatar_url?: string | null;
          region?: string | null;
          interests?: string[] | null;
          grade_id: number;
          points: number;
          streak_days: number;
          last_active_at?: string | null;
          is_ghost: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          nickname?: string | null;
          avatar_url?: string | null;
          region?: string | null;
          interests?: string[] | null;
          grade_id?: number;
          points?: number;
          streak_days?: number;
          last_active_at?: string | null;
          is_ghost?: boolean;
          created_at?: string;
          updated_at?: string;
        };
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
        Insert: {
          author_id: string;
          title: string;
          content: string;
          category: "stock" | "apt" | "community" | "bug" | "free";
          image_urls?: string[] | null;
          is_pinned?: boolean;
          is_megaphone?: boolean;
        };
        Update: {
          author_id?: string;
          title?: string;
          content?: string;
          category?: "stock" | "apt" | "community" | "bug" | "free";
          image_urls?: string[] | null;
          view_count?: number;
          like_count?: number;
          comment_count?: number;
          share_count?: number;
          is_pinned?: boolean;
          is_megaphone?: boolean;
        };
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
        Insert: {
          post_id: string;
          author_id: string;
          content: string;
          parent_id?: string | null;
        };
        Update: {
          post_id?: string;
          author_id?: string;
          content?: string;
          parent_id?: string | null;
        };
      };
      post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
        };
        Update: {
          post_id?: string;
          user_id?: string;
        };
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
        Insert: {
          title: string;
          description?: string | null;
          category: string;
          creator_id: string;
          is_premium?: boolean;
        };
        Update: {
          title?: string;
          description?: string | null;
          category?: string;
          creator_id?: string;
          participant_count?: number;
          is_premium?: boolean;
          heat_score?: number;
        };
      };
      discussion_messages: {
        Row: {
          id: string;
          room_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          room_id: string;
          sender_id: string;
          content: string;
        };
        Update: {
          room_id?: string;
          sender_id?: string;
          content?: string;
        };
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
        Insert: {
          symbol: string;
          name: string;
          price: number;
          change_percent: number;
          volume: number;
        };
        Update: {
          symbol?: string;
          name?: string;
          price?: number;
          change_percent?: number;
          volume?: number;
        };
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
        Insert: {
          name: string;
          region: string;
          status: string;
          start_date: string;
          end_date: string;
          total_units: number;
          competition_rate?: number | null;
        };
        Update: {
          name?: string;
          region?: string;
          status?: string;
          start_date?: string;
          end_date?: string;
          total_units?: number;
          competition_rate?: number | null;
        };
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
        Insert: {
          name: string;
          description?: string | null;
          price: number;
          category: "badge" | "megaphone" | "profile_effect" | "nickname_color";
          image_url?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          description?: string | null;
          price?: number;
          category?: "badge" | "megaphone" | "profile_effect" | "nickname_color";
          image_url?: string | null;
          is_active?: boolean;
        };
      };
      grade_definitions: {
        Row: {
          id: number;
          name: string;
          min_points: number;
          badge_url: string | null;
          perks: Json;
        };
        Insert: {
          id: number;
          name: string;
          min_points: number;
          badge_url?: string | null;
          perks: Json;
        };
        Update: {
          id?: number;
          name?: string;
          min_points?: number;
          badge_url?: string | null;
          perks?: Json;
        };
      };
      search_logs: {
        Row: {
          id: string;
          user_id: string | null;
          query: string;
          results_count: number;
          clicked_rank: number | null;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          query: string;
          results_count: number;
          clicked_rank?: number | null;
        };
        Update: {
          user_id?: string | null;
          query?: string;
          results_count?: number;
          clicked_rank?: number | null;
        };
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
        Insert: {
          user_id?: string | null;
          post_id: string;
          duration_seconds: number;
          scroll_depth: number;
        };
        Update: {
          user_id?: string | null;
          post_id?: string;
          duration_seconds?: number;
          scroll_depth?: number;
        };
      };
      share_logs: {
        Row: {
          id: string;
          user_id: string;
          post_id: string;
          platform: "kakao" | "link" | "other";
          created_at: string;
        };
        Insert: {
          user_id: string;
          post_id: string;
          platform: "kakao" | "link" | "other";
        };
        Update: {
          user_id?: string;
          post_id?: string;
          platform?: "kakao" | "link" | "other";
        };
      };
      trending_keywords: {
        Row: {
          id: string;
          keyword: string;
          heat_score: number;
          category: string | null;
          updated_at: string;
        };
        Insert: {
          keyword: string;
          heat_score: number;
          category?: string | null;
        };
        Update: {
          keyword?: string;
          heat_score?: number;
          category?: string | null;
        };
      };
      user_streaks: {
        Row: {
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_login_date: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_login_date: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          current_streak?: number;
          longest_streak?: number;
          last_login_date?: string;
          updated_at?: string;
        };
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
        Insert: {
          reporter_id: string;
          target_type: "post" | "comment" | "chat";
          target_id: string;
          reason: string;
        };
        Update: {
          reporter_id?: string;
          target_type?: "post" | "comment" | "chat";
          target_id?: string;
          reason?: string;
          status?: "pending" | "reviewed" | "resolved" | "dismissed";
          reviewed_at?: string | null;
        };
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
        Insert: {
          user_id: string;
          product_id: string;
          amount: number;
          payment_key: string;
          order_id: string;
          status?: "pending" | "completed" | "failed" | "refunded";
        };
        Update: {
          user_id?: string;
          product_id?: string;
          amount?: number;
          payment_key?: string;
          order_id?: string;
          status?: "pending" | "completed" | "failed" | "refunded";
        };
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
