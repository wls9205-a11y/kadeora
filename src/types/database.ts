export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nickname: string | null
          full_name: string | null
          bio: string | null
          avatar_url: string | null
          provider: string | null
          grade: number | null
          grade_title: string | null
          posts_count: number
          likes_count: number
          points: number
          is_premium: boolean
          onboarded: boolean
          nickname_set: boolean
          is_deleted: boolean
          last_active_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nickname?: string | null
          full_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          provider?: string | null
          grade?: number | null
          grade_title?: string | null
          posts_count?: number
          likes_count?: number
          points?: number
          is_premium?: boolean
          onboarded?: boolean
          nickname_set?: boolean
          is_deleted?: boolean
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nickname?: string | null
          full_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          provider?: string | null
          grade?: number | null
          grade_title?: string | null
          posts_count?: number
          likes_count?: number
          points?: number
          is_premium?: boolean
          onboarded?: boolean
          nickname_set?: boolean
          is_deleted?: boolean
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      posts: {
        Row: {
          id: number
          author_id: string | null
          category: string
          region_id: string | null
          city: string | null
          title: string
          content: string
          is_anonymous: boolean
          images: string[] | null
          tag: string | null
          stock_tags: string[] | null
          apt_tags: string[] | null
          view_count: number
          likes_count: number
          comments_count: number
          downvotes_count: number
          is_deleted: boolean
          slug: string | null
          room_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          author_id?: string | null
          category: string
          region_id?: string | null
          city?: string | null
          title: string
          content: string
          is_anonymous?: boolean
          images?: string[] | null
          tag?: string | null
          stock_tags?: string[] | null
          apt_tags?: string[] | null
          view_count?: number
          likes_count?: number
          comments_count?: number
          downvotes_count?: number
          is_deleted?: boolean
          slug?: string | null
          room_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          author_id?: string | null
          category?: string
          region_id?: string | null
          city?: string | null
          title?: string
          content?: string
          is_anonymous?: boolean
          images?: string[] | null
          tag?: string | null
          stock_tags?: string[] | null
          apt_tags?: string[] | null
          view_count?: number
          likes_count?: number
          comments_count?: number
          downvotes_count?: number
          is_deleted?: boolean
          slug?: string | null
          room_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: number
          post_id: number
          author_id: string
          parent_id: number | null
          content: string
          is_anonymous: boolean
          likes_count: number
          is_deleted: boolean
          created_at: string
        }
        Insert: {
          id?: number
          post_id: number
          author_id: string
          parent_id?: number | null
          content: string
          is_anonymous?: boolean
          likes_count?: number
          is_deleted?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          post_id?: number
          author_id?: string
          parent_id?: number | null
          content?: string
          is_anonymous?: boolean
          likes_count?: number
          is_deleted?: boolean
          created_at?: string
        }
      }
      post_likes: {
        Row: {
          post_id: number
          user_id: string
          created_at: string
        }
        Insert: {
          post_id: number
          user_id: string
          created_at?: string
        }
        Update: {
          post_id?: number
          user_id?: string
          created_at?: string
        }
      }
      trending_keywords: {
        Row: {
          id: string
          keyword: string
          heat_score: number
          category: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          keyword: string
          heat_score?: number
          category?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          keyword?: string
          heat_score?: number
          category?: string | null
          updated_at?: string
        }
      }
      stock_quotes: {
        Row: {
          symbol: string
          name: string
          market: string | null
          price: number
          change_amt: number
          change_pct: number
          volume: number
          updated_at: string
        }
        Insert: {
          symbol: string
          name: string
          market?: string | null
          price: number
          change_amt?: number
          change_pct?: number
          volume?: number
          updated_at?: string
        }
        Update: {
          symbol?: string
          name?: string
          market?: string | null
          price?: number
          change_amt?: number
          change_pct?: number
          volume?: number
          updated_at?: string
        }
      }
      discussion_rooms: {
        Row: {
          id: string
          room_type: string
          room_key: string | null
          display_name: string
          description: string | null
          member_count: number
          post_count: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          room_type: string
          room_key?: string | null
          display_name: string
          description?: string | null
          member_count?: number
          post_count?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          room_type?: string
          room_key?: string | null
          display_name?: string
          description?: string | null
          member_count?: number
          post_count?: number
          is_active?: boolean
          created_at?: string
        }
      }
      discussion_messages: {
        Row: {
          id: string
          room_id: string
          author_id: string
          content: string
          is_anonymous: boolean
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          author_id: string
          content: string
          is_anonymous?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          author_id?: string
          content?: string
          is_anonymous?: boolean
          created_at?: string
        }
      }
      shop_products: {
        Row: {
          id: string
          name: string
          description: string | null
          price_krw: number
          icon: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price_krw: number
          icon?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price_krw?: number
          icon?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      shop_orders: {
        Row: {
          id: string
          user_id: string
          order_id: string
          payment_key: string | null
          amount: number
          status: string
          product_id: string | null
          approved_at: string | null
          method: string | null
          raw_response: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          order_id: string
          payment_key?: string | null
          amount: number
          status?: string
          product_id?: string | null
          approved_at?: string | null
          method?: string | null
          raw_response?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          order_id?: string
          payment_key?: string | null
          amount?: number
          status?: string
          product_id?: string | null
          approved_at?: string | null
          method?: string | null
          raw_response?: Json | null
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          content: string
          is_read: boolean
          post_id: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          content: string
          is_read?: boolean
          post_id?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          content?: string
          is_read?: boolean
          post_id?: number | null
          created_at?: string
        }
      }
      grade_definitions: {
        Row: {
          grade: number
          title: string
          emoji: string | null
          color_hex: string | null
          min_score: number
          description: string | null
        }
        Insert: {
          grade: number
          title: string
          emoji?: string | null
          color_hex?: string | null
          min_score: number
          description?: string | null
        }
        Update: {
          grade?: number
          title?: string
          emoji?: string | null
          color_hex?: string | null
          min_score?: number
          description?: string | null
        }
      }
      search_logs: {
        Row: {
          id: string
          user_id: string | null
          query: string
          results_count: number | null
          clicked_rank: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          query: string
          results_count?: number | null
          clicked_rank?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          query?: string
          results_count?: number | null
          clicked_rank?: number | null
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string | null
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          content?: string
          created_at?: string
        }
      }
      apt_cache: {
        Row: {
          id: string
          cache_type: string
          data: Json
          refreshed_at: string
          refreshed_by: string | null
        }
        Insert: {
          id?: string
          cache_type: string
          data: Json
          refreshed_at?: string
          refreshed_by?: string | null
        }
        Update: {
          id?: string
          cache_type?: string
          data?: Json
          refreshed_at?: string
          refreshed_by?: string | null
        }
      }
    }
  }
}

// Convenient type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Post = Database['public']['Tables']['posts']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type PostLike = Database['public']['Tables']['post_likes']['Row']
export type TrendingKeyword = Database['public']['Tables']['trending_keywords']['Row']
export type StockQuote = Database['public']['Tables']['stock_quotes']['Row']
export type DiscussionRoom = Database['public']['Tables']['discussion_rooms']['Row']
export type DiscussionMessage = Database['public']['Tables']['discussion_messages']['Row']
export type MessageWithProfile = DiscussionMessage & {
  profiles: Pick<Profile, 'id' | 'nickname' | 'avatar_url'> | null
}
export type ShopProduct = Database['public']['Tables']['shop_products']['Row']
export type ShopOrder = Database['public']['Tables']['shop_orders']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type GradeDefinition = Database['public']['Tables']['grade_definitions']['Row']
export type SearchLog = Database['public']['Tables']['search_logs']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']
export type AptCache = Database['public']['Tables']['apt_cache']['Row']

export type PostWithProfile = Post & {
  profiles: Pick<Profile, 'id' | 'nickname' | 'avatar_url' | 'grade'> | null
}

export type CommentWithProfile = Comment & {
  profiles: Pick<Profile, 'id' | 'nickname' | 'avatar_url' | 'grade'> | null
}