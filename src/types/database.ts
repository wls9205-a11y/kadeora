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
          username: string | null
          nickname: string | null
          bio: string | null
          avatar_url: string | null
          grade: string | null
          post_count: number
          comment_count: number
          like_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          nickname?: string | null
          bio?: string | null
          avatar_url?: string | null
          grade?: string | null
          post_count?: number
          comment_count?: number
          like_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          nickname?: string | null
          bio?: string | null
          avatar_url?: string | null
          grade?: string | null
          post_count?: number
          comment_count?: number
          like_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      posts: {
        Row: {
          id: number
          user_id: string | null
          category: string
          title: string
          content: string
          images: string[] | null
          view_count: number
          likes_count: number
          comments_count: number
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          category: string
          title: string
          content: string
          images?: string[] | null
          view_count?: number
          likes_count?: number
          comments_count?: number
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string | null
          category?: string
          title?: string
          content?: string
          images?: string[] | null
          view_count?: number
          likes_count?: number
          comments_count?: number
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: number
          post_id: number
          user_id: string
          content: string
          is_deleted: boolean
          created_at: string
        }
        Insert: {
          id?: number
          post_id: number
          user_id: string
          content: string
          is_deleted?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          post_id?: number
          user_id?: string
          content?: string
          is_deleted?: boolean
          created_at?: string
        }
      }
      post_likes: {
        Row: {
          id: number
          post_id: number
          user_id: string
          created_at: string
        }
        Insert: {
          id?: number
          post_id: number
          user_id: string
          created_at?: string
        }
        Update: {
          id?: number
          post_id?: number
          user_id?: string
          created_at?: string
        }
      }
      trending_keywords: {
        Row: {
          id: number
          keyword: string
          rank: number
          count: number
          created_at: string
        }
        Insert: {
          id?: number
          keyword: string
          rank: number
          count?: number
          created_at?: string
        }
        Update: {
          id?: number
          keyword?: string
          rank?: number
          count?: number
          created_at?: string
        }
      }
      stock_quotes: {
        Row: {
          id: number
          symbol: string
          name: string
          price: number
          change_amount: number
          change_rate: number
          volume: number
          market_cap: number | null
          updated_at: string
        }
        Insert: {
          id?: number
          symbol: string
          name: string
          price: number
          change_amount?: number
          change_rate?: number
          volume?: number
          market_cap?: number | null
          updated_at?: string
        }
        Update: {
          id?: number
          symbol?: string
          name?: string
          price?: number
          change_amount?: number
          change_rate?: number
          volume?: number
          market_cap?: number | null
          updated_at?: string
        }
      }
      discussion_rooms: {
        Row: {
          id: number
          title: string
          description: string | null
          category: string
          participants_count: number
          messages_count: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          title: string
          description?: string | null
          category: string
          participants_count?: number
          messages_count?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          title?: string
          description?: string | null
          category?: string
          participants_count?: number
          messages_count?: number
          is_active?: boolean
          created_at?: string
        }
      }
      discussion_messages: {
        Row: {
          id: number
          room_id: number
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: number
          room_id: number
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: number
          room_id?: number
          user_id?: string
          content?: string
          created_at?: string
        }
      }
      shop_products: {
        Row: {
          id: number
          name: string
          description: string | null
          price: number
          original_price: number | null
          category: string
          icon: string | null
          is_popular: boolean
          stock_count: number
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          description?: string | null
          price: number
          original_price?: number | null
          category?: string
          icon?: string | null
          is_popular?: boolean
          stock_count?: number
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          description?: string | null
          price?: number
          original_price?: number | null
          category?: string
          icon?: string | null
          is_popular?: boolean
          stock_count?: number
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: number
          user_id: string
          type: string
          title: string
          message: string
          is_read: boolean
          link: string | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          type: string
          title: string
          message: string
          is_read?: boolean
          link?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          type?: string
          title?: string
          message?: string
          is_read?: boolean
          link?: string | null
          created_at?: string
        }
      }
      grade_definitions: {
        Row: {
          id: number
          grade: string
          name: string
          min_score: number
          max_score: number
          icon: string
          color: string
          description: string | null
        }
        Insert: {
          id?: number
          grade: string
          name: string
          min_score: number
          max_score: number
          icon: string
          color: string
          description?: string | null
        }
        Update: {
          id?: number
          grade?: string
          name?: string
          min_score?: number
          max_score?: number
          icon?: string
          color?: string
          description?: string | null
        }
      }
      apt_subscriptions: {
        Row: {
          id: number
          name: string
          location: string
          total_units: number
          subscription_type: string
          application_start: string
          application_end: string
          move_in_date: string | null
          min_price: number | null
          max_price: number | null
          status: string
          competition_rate: number | null
          homepage_url: string | null
          created_at: string
        }
        Insert: {
          id?: number
          name: string
          location: string
          total_units: number
          subscription_type: string
          application_start: string
          application_end: string
          move_in_date?: string | null
          min_price?: number | null
          max_price?: number | null
          status: string
          competition_rate?: number | null
          homepage_url?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          name?: string
          location?: string
          total_units?: number
          subscription_type?: string
          application_start?: string
          application_end?: string
          move_in_date?: string | null
          min_price?: number | null
          max_price?: number | null
          status?: string
          competition_rate?: number | null
          homepage_url?: string | null
          created_at?: string
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
export type ShopProduct = Database['public']['Tables']['shop_products']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type GradeDefinition = Database['public']['Tables']['grade_definitions']['Row']
export type AptSubscription = Database['public']['Tables']['apt_subscriptions']['Row']

export type PostWithProfile = Post & {
  profiles: Pick<Profile, 'id' | 'nickname' | 'avatar_url' | 'grade'> | null
}

export type CommentWithProfile = Comment & {
  profiles: Pick<Profile, 'id' | 'nickname' | 'avatar_url'> | null
}

export type DiscussionMessageWithProfile = DiscussionMessage & {
  profiles: Pick<Profile, 'id' | 'nickname' | 'avatar_url'> | null
}
