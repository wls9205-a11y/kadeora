export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nickname: string
          avatar_url: string | null
          bio: string | null
          region: string | null
          interests: string[] | null
          influence: number
          grade: number
          is_premium: boolean
          points: number
          consecutive_attendance: number
          total_attendance: number
          follower_count: number
          following_count: number
          post_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nickname: string
          avatar_url?: string | null
          bio?: string | null
          region?: string | null
          interests?: string[] | null
          influence?: number
          grade?: number
          is_premium?: boolean
          points?: number
          consecutive_attendance?: number
          total_attendance?: number
          follower_count?: number
          following_count?: number
          post_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      posts: {
        Row: {
          id: string
          author_id: string
          category: 'hot' | 'local' | 'stock' | 'housing' | 'free'
          title: string
          content: string
          tags: string[] | null
          is_anonymous: boolean
          is_hot: boolean
          is_premium: boolean
          likes_count: number
          comments_count: number
          views_count: number
          region: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          author_id: string
          category: 'hot' | 'local' | 'stock' | 'housing' | 'free'
          title: string
          content: string
          tags?: string[] | null
          is_anonymous?: boolean
          is_hot?: boolean
          is_premium?: boolean
          likes_count?: number
          comments_count?: number
          views_count?: number
          region?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['posts']['Insert']>
      }
      comments: {
        Row: {
          id: string
          post_id: string
          author_id: string
          content: string
          is_anonymous: boolean
          likes_count: number
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          author_id: string
          content: string
          is_anonymous?: boolean
          likes_count?: number
          parent_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
      }
      post_likes: {
        Row: {
          id: string
          post_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['post_likes']['Insert']>
      }
      comment_likes: {
        Row: {
          id: string
          comment_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          comment_id: string
          user_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['comment_likes']['Insert']>
      }
      bookmarks: {
        Row: {
          id: string
          post_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['bookmarks']['Insert']>
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['follows']['Insert']>
      }
      discussion_rooms: {
        Row: {
          id: string
          name: string
          type: 'stock' | 'housing'
          code: string | null
          member_count: number
          last_message: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type: 'stock' | 'housing'
          code?: string | null
          member_count?: number
          last_message?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['discussion_rooms']['Insert']>
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
        Update: Partial<Database['public']['Tables']['discussion_messages']['Insert']>
      }
      room_subscriptions: {
        Row: {
          id: string
          room_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['room_subscriptions']['Insert']>
      }
      stock_quotes: {
        Row: {
          id: string
          code: string
          name: string
          market: 'KOSPI' | 'KOSDAQ'
          price: number
          change_percent: number
          volume: number
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          market: 'KOSPI' | 'KOSDAQ'
          price: number
          change_percent: number
          volume: number
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['stock_quotes']['Insert']>
      }
      apt_subscriptions: {
        Row: {
          id: string
          name: string
          location: string
          region: string
          units: number
          price_range: string
          start_date: string
          end_date: string
          d_day: number
          is_hot: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          location: string
          region: string
          units: number
          price_range: string
          start_date: string
          end_date: string
          d_day: number
          is_hot?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['apt_subscriptions']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'like' | 'comment' | 'follow' | 'grade' | 'system'
          title: string
          body: string
          icon: string
          is_read: boolean
          data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'like' | 'comment' | 'follow' | 'grade' | 'system'
          title: string
          body: string
          icon: string
          is_read?: boolean
          data?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      attendance: {
        Row: {
          id: string
          user_id: string
          attended_at: string
        }
        Insert: {
          id?: string
          user_id: string
          attended_at?: string
        }
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>
      }
      megaphones: {
        Row: {
          id: string
          post_id: string
          user_id: string
          type: 'basic' | 'urgent'
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          type: 'basic' | 'urgent'
          expires_at: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['megaphones']['Insert']>
      }
      pinned_posts: {
        Row: {
          id: string
          post_id: string
          user_id: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          expires_at: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['pinned_posts']['Insert']>
      }
      shop_products: {
        Row: {
          id: string
          name: string
          description: string
          price: number
          icon: string
          color: string
          is_active: boolean
        }
        Insert: {
          id: string
          name: string
          description: string
          price: number
          icon: string
          color: string
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['shop_products']['Insert']>
      }
      purchases: {
        Row: {
          id: string
          user_id: string
          product_id: string
          points_spent: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          points_spent: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['purchases']['Insert']>
      }
      point_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: 'earn' | 'spend' | 'purchase'
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          type: 'earn' | 'spend' | 'purchase'
          description: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['point_transactions']['Insert']>
      }
      share_logs: {
        Row: {
          id: string
          post_id: string
          user_id: string
          platform: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          platform: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['share_logs']['Insert']>
      }
      payment_orders: {
        Row: {
          id: string
          user_id: string
          order_id: string
          amount: number
          points: number
          status: 'pending' | 'completed' | 'failed' | 'cancelled'
          payment_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          order_id: string
          amount: number
          points: number
          status?: 'pending' | 'completed' | 'failed' | 'cancelled'
          payment_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['payment_orders']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_influence: {
        Args: { user_id: string; amount: number }
        Returns: void
      }
      check_and_update_grade: {
        Args: { user_id: string }
        Returns: number
      }
      daily_attendance: {
        Args: { user_id: string }
        Returns: { points_earned: number; is_bonus: boolean }
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Post = Database['public']['Tables']['posts']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type DiscussionRoom = Database['public']['Tables']['discussion_rooms']['Row']
export type DiscussionMessage = Database['public']['Tables']['discussion_messages']['Row']
export type StockQuote = Database['public']['Tables']['stock_quotes']['Row']
export type AptSubscription = Database['public']['Tables']['apt_subscriptions']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type ShopProduct = Database['public']['Tables']['shop_products']['Row']

export type Category = Post['category']
export type NotificationType = Notification['type']
