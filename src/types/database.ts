export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nickname: string
          bio: string | null
          avatar_url: string | null
          likes_count: number
          provider: string | null
          created_at: string
          updated_at: string
          followers_count: number
          following_count: number
          posts_count: number
          full_name: string | null
          phone: string | null
          interests: string[]
          region_text: string | null
          kakao_id: string | null
          google_email: string | null
          marketing_agreed: boolean
          onboarded: boolean
          residence_city: string | null
          residence_district: string | null
          points: number
          profile_completed: boolean
          streak_days: number
          last_checked_date: string | null
          nickname_set: boolean
          nickname_change_count: number
          nickname_change_tickets: number
          is_premium: boolean
          premium_expires_at: string | null
          gender: 'male' | 'female' | 'other' | null
          influence_score: number
          grade: number
          grade_title: string
        }
        Insert: {
          id: string
          nickname: string
          bio?: string | null
          avatar_url?: string | null
          likes_count?: number
          provider?: string | null
          created_at?: string
          updated_at?: string
          followers_count?: number
          following_count?: number
          posts_count?: number
          full_name?: string | null
          phone?: string | null
          interests?: string[]
          region_text?: string | null
          kakao_id?: string | null
          google_email?: string | null
          marketing_agreed?: boolean
          onboarded?: boolean
          residence_city?: string | null
          residence_district?: string | null
          points?: number
          profile_completed?: boolean
          streak_days?: number
          last_checked_date?: string | null
          nickname_set?: boolean
          nickname_change_count?: number
          nickname_change_tickets?: number
          is_premium?: boolean
          premium_expires_at?: string | null
          gender?: 'male' | 'female' | 'other' | null
          influence_score?: number
          grade?: number
          grade_title?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      posts: {
        Row: {
          id: number
          author_id: string | null
          category: string
          region_id: string
          city: string
          title: string
          content: string
          is_anonymous: boolean
          likes_count: number
          comments_count: number
          report_count: number
          tag: string | null
          stock_tags: string[]
          apt_tags: string[]
          images: string[]
          is_deleted: boolean
          created_at: string
          updated_at: string
          downvotes_count: number
          view_count: number
          room_id: number | null
          slug: string | null
        }
        Insert: {
          author_id?: string | null
          category: string
          region_id: string
          city?: string
          title: string
          content: string
          is_anonymous?: boolean
          likes_count?: number
          comments_count?: number
          report_count?: number
          tag?: string | null
          stock_tags?: string[]
          apt_tags?: string[]
          images?: string[]
          is_deleted?: boolean
          created_at?: string
          updated_at?: string
          downvotes_count?: number
          view_count?: number
          room_id?: number | null
          slug?: string | null
        }
        Update: Partial<Database['public']['Tables']['posts']['Insert']>
      }
      comments: {
        Row: {
          id: number
          post_id: number
          author_id: string | null
          parent_id: number | null
          content: string
          is_anonymous: boolean
          likes_count: number
          is_deleted: boolean
          created_at: string
        }
        Insert: {
          post_id: number
          author_id?: string | null
          parent_id?: number | null
          content: string
          is_anonymous?: boolean
          likes_count?: number
          is_deleted?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
      }
      post_likes: {
        Row: { post_id: number; user_id: string; created_at: string }
        Insert: { post_id: number; user_id: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['post_likes']['Insert']>
      }
      post_downvotes: {
        Row: { post_id: number; user_id: string; created_at: string }
        Insert: { post_id: number; user_id: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['post_downvotes']['Insert']>
      }
      comment_likes: {
        Row: { comment_id: number; user_id: string; created_at: string }
        Insert: { comment_id: number; user_id: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['comment_likes']['Insert']>
      }
      notifications: {
        Row: {
          id: number
          user_id: string
          type: 'post_like' | 'comment' | 'reply' | 'badge' | 'follow' | 'new_post' | 'comment_like' | 'system'
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          type: 'post_like' | 'comment' | 'reply' | 'badge' | 'follow' | 'new_post' | 'comment_like' | 'system'
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      bookmarks: {
        Row: { post_id: number; user_id: string; created_at: string }
        Insert: { post_id: number; user_id: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['bookmarks']['Insert']>
      }
      follows: {
        Row: { follower_id: string; followee_id: string; created_at: string }
        Insert: { follower_id: string; followee_id: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['follows']['Insert']>
      }
      blocks: {
        Row: { blocker_id: string; blocked_id: string; created_at: string }
        Insert: { blocker_id: string; blocked_id: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['blocks']['Insert']>
      }
      reports: {
        Row: {
          id: number
          reporter_id: string
          post_id: number | null
          comment_id: number | null
          reason: string | null
          created_at: string
        }
        Insert: {
          reporter_id: string
          post_id?: number | null
          comment_id?: number | null
          reason?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['reports']['Insert']>
      }
      attendance: {
        Row: { user_id: string; streak: number; last_date: string | null; total_days: number; updated_at: string }
        Insert: { user_id: string; streak?: number; last_date?: string | null; total_days?: number; updated_at?: string }
        Update: Partial<Database['public']['Tables']['attendance']['Insert']>
      }
      point_history: {
        Row: {
          id: number
          user_id: string
          amount: number
          reason: '프로필완성' | '게시글작성' | '좋아요받음' | '출석체크' | '출석연속보너스' | '청약토론작성'
          meta: Json | null
          created_at: string
        }
        Insert: {
          user_id: string
          amount: number
          reason: '프로필완성' | '게시글작성' | '좋아요받음' | '출석체크' | '출석연속보너스' | '청약토론작성'
          meta?: Json | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['point_history']['Insert']>
      }
      discussion_rooms: {
        Row: {
          id: number
          room_type: 'stock' | 'apt' | 'theme'
          room_key: string
          display_name: string
          description: string | null
          member_count: number
          post_count: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          room_type: 'stock' | 'apt' | 'theme'
          room_key: string
          display_name: string
          description?: string | null
          member_count?: number
          post_count?: number
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['discussion_rooms']['Insert']>
      }
      discussion_messages: {
        Row: {
          id: number
          room_id: number
          author_id: string
          content: string
          is_anonymous: boolean
          created_at: string
        }
        Insert: {
          room_id: number
          author_id: string
          content: string
          is_anonymous?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['discussion_messages']['Insert']>
      }
      room_subscriptions: {
        Row: { user_id: string; room_id: number; created_at: string }
        Insert: { user_id: string; room_id: number; created_at?: string }
        Update: Partial<Database['public']['Tables']['room_subscriptions']['Insert']>
      }
      stock_quotes: {
        Row: {
          symbol: string
          name: string
          market: 'KOSPI' | 'KOSDAQ'
          price: number | null
          change_amt: number | null
          change_pct: number | null
          volume: number | null
          updated_at: string
        }
        Insert: {
          symbol: string
          name: string
          market: 'KOSPI' | 'KOSDAQ'
          price?: number | null
          change_amt?: number | null
          change_pct?: number | null
          volume?: number | null
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['stock_quotes']['Insert']>
      }
      apt_subscriptions: {
        Row: {
          id: number
          house_manage_no: string
          house_nm: string
          region_cd: string | null
          region_nm: string | null
          supply_addr: string | null
          tot_supply_hshld_co: number | null
          rcept_bgnde: string | null
          rcept_endde: string | null
          spsply_rcept_bgnde: string | null
          spsply_rcept_endde: string | null
          przwner_presnatn_de: string | null
          cntrct_cncls_bgnde: string | null
          cntrct_cncls_endde: string | null
          mdatrgbn_nm: string | null
          hssply_adres: string | null
          mvn_prearnge_ym: string | null
          pblanc_url: string | null
          fetched_at: string
          updated_at: string
        }
        Insert: {
          house_manage_no: string
          house_nm: string
          region_cd?: string | null
          region_nm?: string | null
          supply_addr?: string | null
          tot_supply_hshld_co?: number | null
          rcept_bgnde?: string | null
          rcept_endde?: string | null
          spsply_rcept_bgnde?: string | null
          spsply_rcept_endde?: string | null
          przwner_presnatn_de?: string | null
          cntrct_cncls_bgnde?: string | null
          cntrct_cncls_endde?: string | null
          mdatrgbn_nm?: string | null
          hssply_adres?: string | null
          mvn_prearnge_ym?: string | null
          pblanc_url?: string | null
          fetched_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['apt_subscriptions']['Insert']>
      }
      shop_products: {
        Row: {
          id: string
          name: string
          description: string
          price_krw: number
          icon: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          name: string
          description: string
          price_krw: number
          icon?: string
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['shop_products']['Insert']>
      }
      purchases: {
        Row: {
          id: number
          user_id: string
          product_id: string
          amount_krw: number
          payment_key: string | null
          order_id: string | null
          status: string
          used: boolean
          used_at: string | null
          meta: Json | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          user_id: string
          product_id: string
          amount_krw: number
          payment_key?: string | null
          order_id?: string | null
          status?: string
          used?: boolean
          used_at?: string | null
          meta?: Json | null
          created_at?: string
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['purchases']['Insert']>
      }
      megaphones: {
        Row: {
          id: number
          user_id: string
          purchase_id: number
          message: string
          nickname: string
          starts_at: string | null
          ends_at: string | null
          is_active: boolean
          created_at: string
          tier: 'basic' | 'standard' | 'urgent'
          queue_status: 'waiting' | 'active' | 'done'
          queue_position: number | null
          text_color: string | null
          bg_color: string | null
        }
        Insert: {
          user_id: string
          purchase_id: number
          message: string
          nickname: string
          starts_at?: string | null
          ends_at?: string | null
          is_active?: boolean
          created_at?: string
          tier?: 'basic' | 'standard' | 'urgent'
          queue_status?: 'waiting' | 'active' | 'done'
          queue_position?: number | null
          text_color?: string | null
          bg_color?: string | null
        }
        Update: Partial<Database['public']['Tables']['megaphones']['Insert']>
      }
      pinned_posts: {
        Row: {
          id: number
          user_id: string
          post_id: number
          purchase_id: number
          starts_at: string
          ends_at: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          post_id: number
          purchase_id: number
          starts_at?: string
          ends_at?: string
          is_active?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['pinned_posts']['Insert']>
      }
      grade_definitions: {
        Row: {
          grade: number
          title: string
          emoji: string
          color_hex: string
          min_score: number
          description: string
        }
        Insert: {
          grade: number
          title: string
          emoji: string
          color_hex: string
          min_score: number
          description: string
        }
        Update: Partial<Database['public']['Tables']['grade_definitions']['Insert']>
      }
      user_regions: {
        Row: { id: number; user_id: string; region_id: string; created_at: string }
        Insert: { user_id: string; region_id: string; created_at?: string }
        Update: Partial<Database['public']['Tables']['user_regions']['Insert']>
      }
      share_logs: {
        Row: {
          id: number
          post_id: number
          user_id: string | null
          platform: 'kakao' | 'twitter' | 'facebook' | 'link' | 'other'
          created_at: string | null
        }
        Insert: {
          post_id: number
          user_id?: string | null
          platform: 'kakao' | 'twitter' | 'facebook' | 'link' | 'other'
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['share_logs']['Insert']>
      }
      sync_log: {
        Row: { id: number; target: string; synced_at: string; row_count: number | null }
        Insert: { target: string; synced_at?: string; row_count?: number | null }
        Update: Partial<Database['public']['Tables']['sync_log']['Insert']>
      }
      subscription_schedules: {
        Row: {
          id: number
          apt_name: string
          location: string
          city: string | null
          district: string | null
          supply_count: number | null
          apply_start: string | null
          apply_end: string | null
          announce_date: string | null
          move_in_date: string | null
          price_range: string | null
          special_supply_date: string | null
          source_url: string | null
          is_hot: boolean
          created_at: string
        }
        Insert: {
          apt_name: string
          location: string
          city?: string | null
          district?: string | null
          supply_count?: number | null
          apply_start?: string | null
          apply_end?: string | null
          announce_date?: string | null
          move_in_date?: string | null
          price_range?: string | null
          special_supply_date?: string | null
          source_url?: string | null
          is_hot?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['subscription_schedules']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_posts: {
        Args: { query: string; limit_count?: number }
        Returns: Database['public']['Tables']['posts']['Row'][]
      }
      get_hot_posts_by_region: {
        Args: { p_region_id: string; p_limit?: number }
        Returns: Database['public']['Tables']['posts']['Row'][]
      }
      get_post_seo: {
        Args: { p_post_id: number }
        Returns: { title: string; description: string; og_image: string; canonical_url: string }[]
      }
      check_in_attendance: {
        Args: { p_user_id: string }
        Returns: { streak: number; points_awarded: number; is_bonus: boolean }[]
      }
    }
    Enums: {
      point_reason: '프로필완성' | '게시글작성' | '좋아요받음' | '출석체크' | '출석연속보너스' | '청약토론작성'
    }
  }
}

// 편의 타입들
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Post = Database['public']['Tables']['posts']['Row']
export type Comment = Database['public']['Tables']['comments']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type DiscussionRoom = Database['public']['Tables']['discussion_rooms']['Row']
export type DiscussionMessage = Database['public']['Tables']['discussion_messages']['Row']
export type StockQuote = Database['public']['Tables']['stock_quotes']['Row']
export type AptSubscription = Database['public']['Tables']['apt_subscriptions']['Row']
export type ShopProduct = Database['public']['Tables']['shop_products']['Row']
export type Purchase = Database['public']['Tables']['purchases']['Row']
export type Megaphone = Database['public']['Tables']['megaphones']['Row']
export type GradeDefinition = Database['public']['Tables']['grade_definitions']['Row']
export type ShareLog = Database['public']['Tables']['share_logs']['Row']

// 확장 타입 (join 포함)
export type PostWithAuthor = Post & {
  profiles: Pick<Profile, 'id' | 'nickname' | 'avatar_url' | 'grade' | 'grade_title' | 'is_premium'> | null
}

export type CommentWithAuthor = Comment & {
  profiles: Pick<Profile, 'id' | 'nickname' | 'avatar_url' | 'grade' | 'grade_title'> | null
  replies?: CommentWithAuthor[]
}
