export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_alerts: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          metadata: Json | null
          severity: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          metadata?: Json | null
          severity?: string
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          metadata?: Json | null
          severity?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: number
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: never
          target_id: string
          target_type?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: never
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      api_quotas: {
        Row: {
          api_name: string
          daily_limit: number | null
          daily_used: number | null
          expires_at: string | null
          id: string
          last_reset_at: string | null
          metadata: Json | null
          monthly_limit: number | null
          monthly_used: number | null
        }
        Insert: {
          api_name: string
          daily_limit?: number | null
          daily_used?: number | null
          expires_at?: string | null
          id?: string
          last_reset_at?: string | null
          metadata?: Json | null
          monthly_limit?: number | null
          monthly_used?: number | null
        }
        Update: {
          api_name?: string
          daily_limit?: number | null
          daily_used?: number | null
          expires_at?: string | null
          id?: string
          last_reset_at?: string | null
          metadata?: Json | null
          monthly_limit?: number | null
          monthly_used?: number | null
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      apt_alerts: {
        Row: {
          created_at: string | null
          house_manage_no: string
          house_nm: string | null
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          house_manage_no: string
          house_nm?: string | null
          id?: never
          user_id: string
        }
        Update: {
          created_at?: string | null
          house_manage_no?: string
          house_nm?: string | null
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apt_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      apt_bookmarks: {
        Row: {
          apt_id: number
          created_at: string | null
          id: string
          notify: boolean | null
          user_id: string
        }
        Insert: {
          apt_id: number
          created_at?: string | null
          id?: string
          notify?: boolean | null
          user_id: string
        }
        Update: {
          apt_id?: number
          created_at?: string | null
          id?: string
          notify?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      apt_cache: {
        Row: {
          cache_type: string
          data: Json
          id: string
          refreshed_at: string | null
          refreshed_by: string | null
        }
        Insert: {
          cache_type: string
          data?: Json
          id?: string
          refreshed_at?: string | null
          refreshed_by?: string | null
        }
        Update: {
          cache_type?: string
          data?: Json
          id?: string
          refreshed_at?: string | null
          refreshed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apt_cache_refreshed_by_fkey"
            columns: ["refreshed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      apt_comments: {
        Row: {
          author_id: string | null
          author_name: string
          content: string
          created_at: string | null
          house_key: string
          house_nm: string
          house_type: string
          id: number
          image_url: string | null
          is_deleted: boolean
          like_count: number
          parent_id: number | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          content: string
          created_at?: string | null
          house_key: string
          house_nm: string
          house_type: string
          id?: number
          image_url?: string | null
          is_deleted?: boolean
          like_count?: number
          parent_id?: number | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          content?: string
          created_at?: string | null
          house_key?: string
          house_nm?: string
          house_type?: string
          id?: number
          image_url?: string | null
          is_deleted?: boolean
          like_count?: number
          parent_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apt_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      apt_competition_rates: {
        Row: {
          applicant_count: number | null
          competition_rate: number | null
          house_name: string
          id: string
          metadata: Json | null
          recorded_at: string | null
          region: string | null
          subscription_id: number | null
          supply_count: number | null
          supply_type: string | null
        }
        Insert: {
          applicant_count?: number | null
          competition_rate?: number | null
          house_name: string
          id?: string
          metadata?: Json | null
          recorded_at?: string | null
          region?: string | null
          subscription_id?: number | null
          supply_count?: number | null
          supply_type?: string | null
        }
        Update: {
          applicant_count?: number | null
          competition_rate?: number | null
          house_name?: string
          id?: string
          metadata?: Json | null
          recorded_at?: string | null
          region?: string | null
          subscription_id?: number | null
          supply_count?: number | null
          supply_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apt_competition_rates_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "apt_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      apt_complex_profiles: {
        Row: {
          age_group: string | null
          apt_name: string
          avg_rating: number | null
          avg_sale_price_pyeong: number | null
          blog_post_count: number | null
          built_year: number | null
          created_at: string | null
          dong: string | null
          id: string
          jeonse_ratio: number | null
          latest_jeonse_price: number | null
          latest_monthly_deposit: number | null
          latest_monthly_rent: number | null
          latest_sale_date: string | null
          latest_sale_price: number | null
          latitude: number | null
          longitude: number | null
          price_change_1y: number | null
          region_nm: string
          rent_count_1y: number | null
          review_count: number | null
          sale_count_1y: number | null
          seo_description: string | null
          seo_title: string | null
          sigungu: string
          total_households: number | null
          updated_at: string | null
        }
        Insert: {
          age_group?: string | null
          apt_name: string
          avg_rating?: number | null
          avg_sale_price_pyeong?: number | null
          blog_post_count?: number | null
          built_year?: number | null
          created_at?: string | null
          dong?: string | null
          id?: string
          jeonse_ratio?: number | null
          latest_jeonse_price?: number | null
          latest_monthly_deposit?: number | null
          latest_monthly_rent?: number | null
          latest_sale_date?: string | null
          latest_sale_price?: number | null
          latitude?: number | null
          longitude?: number | null
          price_change_1y?: number | null
          region_nm: string
          rent_count_1y?: number | null
          review_count?: number | null
          sale_count_1y?: number | null
          seo_description?: string | null
          seo_title?: string | null
          sigungu: string
          total_households?: number | null
          updated_at?: string | null
        }
        Update: {
          age_group?: string | null
          apt_name?: string
          avg_rating?: number | null
          avg_sale_price_pyeong?: number | null
          blog_post_count?: number | null
          built_year?: number | null
          created_at?: string | null
          dong?: string | null
          id?: string
          jeonse_ratio?: number | null
          latest_jeonse_price?: number | null
          latest_monthly_deposit?: number | null
          latest_monthly_rent?: number | null
          latest_sale_date?: string | null
          latest_sale_price?: number | null
          latitude?: number | null
          longitude?: number | null
          price_change_1y?: number | null
          region_nm?: string
          rent_count_1y?: number | null
          review_count?: number | null
          sale_count_1y?: number | null
          seo_description?: string | null
          seo_title?: string | null
          sigungu?: string
          total_households?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      apt_notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          title: string
          user_id: string
          watchlist_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          title: string
          user_id: string
          watchlist_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          title?: string
          user_id?: string
          watchlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apt_notifications_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "apt_watchlist"
            referencedColumns: ["id"]
          },
        ]
      }
      apt_rent_transactions: {
        Row: {
          apt_name: string
          built_year: number | null
          contract_term: string | null
          created_at: string | null
          deal_date: string
          deposit: number | null
          dong: string | null
          exclusive_area: number | null
          floor: number | null
          id: string
          monthly_rent: number | null
          region_nm: string
          renewal_right: string | null
          rent_type: string
          sigungu: string
          source: string | null
        }
        Insert: {
          apt_name: string
          built_year?: number | null
          contract_term?: string | null
          created_at?: string | null
          deal_date: string
          deposit?: number | null
          dong?: string | null
          exclusive_area?: number | null
          floor?: number | null
          id?: string
          monthly_rent?: number | null
          region_nm: string
          renewal_right?: string | null
          rent_type: string
          sigungu: string
          source?: string | null
        }
        Update: {
          apt_name?: string
          built_year?: number | null
          contract_term?: string | null
          created_at?: string | null
          deal_date?: string
          deposit?: number | null
          dong?: string | null
          exclusive_area?: number | null
          floor?: number | null
          id?: string
          monthly_rent?: number | null
          region_nm?: string
          renewal_right?: string | null
          rent_type?: string
          sigungu?: string
          source?: string | null
        }
        Relationships: []
      }
      apt_resale_rights: {
        Row: {
          apt_name: string
          created_at: string | null
          deal_amount: number | null
          deal_date: string | null
          dong: string | null
          exclusive_area: number | null
          floor: number | null
          id: string
          region_nm: string | null
          sigungu: string | null
          source: string | null
        }
        Insert: {
          apt_name: string
          created_at?: string | null
          deal_amount?: number | null
          deal_date?: string | null
          dong?: string | null
          exclusive_area?: number | null
          floor?: number | null
          id?: string
          region_nm?: string | null
          sigungu?: string | null
          source?: string | null
        }
        Update: {
          apt_name?: string
          created_at?: string | null
          deal_amount?: number | null
          deal_date?: string | null
          dong?: string | null
          exclusive_area?: number | null
          floor?: number | null
          id?: string
          region_nm?: string | null
          sigungu?: string | null
          source?: string | null
        }
        Relationships: []
      }
      apt_review_likes: {
        Row: {
          created_at: string | null
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apt_review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "apt_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      apt_reviews: {
        Row: {
          apt_name: string
          cons: string | null
          content: string
          created_at: string | null
          id: string
          is_deleted: boolean | null
          is_resident: boolean | null
          likes_count: number | null
          living_years: number | null
          pros: string | null
          rating: number
          region_nm: string | null
          user_id: string
        }
        Insert: {
          apt_name: string
          cons?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_resident?: boolean | null
          likes_count?: number | null
          living_years?: number | null
          pros?: string | null
          rating: number
          region_nm?: string | null
          user_id: string
        }
        Update: {
          apt_name?: string
          cons?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_resident?: boolean | null
          likes_count?: number | null
          living_years?: number | null
          pros?: string | null
          rating?: number
          region_nm?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apt_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      apt_site_interests: {
        Row: {
          consent_id: number | null
          created_at: string | null
          guest_birth_date: string | null
          guest_city: string | null
          guest_district: string | null
          guest_name: string | null
          guest_phone: string | null
          guest_phone_hash: string | null
          guest_phone_last4: string | null
          id: number
          is_member: boolean | null
          notification_enabled: boolean | null
          site_id: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          consent_id?: number | null
          created_at?: string | null
          guest_birth_date?: string | null
          guest_city?: string | null
          guest_district?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guest_phone_hash?: string | null
          guest_phone_last4?: string | null
          id?: number
          is_member?: boolean | null
          notification_enabled?: boolean | null
          site_id: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          consent_id?: number | null
          created_at?: string | null
          guest_birth_date?: string | null
          guest_city?: string | null
          guest_district?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          guest_phone_hash?: string | null
          guest_phone_last4?: string | null
          id?: number
          is_member?: boolean | null
          notification_enabled?: boolean | null
          site_id?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apt_site_interests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "apt_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apt_site_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_interest_consent"
            columns: ["consent_id"]
            isOneToOne: false
            referencedRelation: "privacy_consents"
            referencedColumns: ["id"]
          },
        ]
      }
      apt_sites: {
        Row: {
          address: string | null
          analysis_generated_at: string | null
          analysis_text: string | null
          builder: string | null
          built_year: number | null
          comment_count: number
          content_score: number | null
          created_at: string | null
          data_quality_score: number | null
          description: string | null
          developer: string | null
          dong: string | null
          extension_cost: number | null
          faq_items: Json | null
          id: string
          images: Json | null
          interest_count: number | null
          is_active: boolean | null
          key_features: Json | null
          latitude: number | null
          longitude: number | null
          move_in_date: string | null
          name: string
          name_variants: Json | null
          nearby_facilities: Json | null
          nearby_station: string | null
          og_image_url: string | null
          option_costs: Json | null
          page_views: number | null
          payment_schedule: Json | null
          price_comparison: Json | null
          price_max: number | null
          price_min: number | null
          region: string | null
          satellite_image_url: string | null
          school_district: string | null
          search_trend: Json | null
          seo_description: string | null
          seo_title: string | null
          sigungu: string | null
          site_type: string
          sitemap_wave: number | null
          slug: string
          source_ids: Json | null
          status: string | null
          total_units: number | null
          transit_score: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          analysis_generated_at?: string | null
          analysis_text?: string | null
          builder?: string | null
          built_year?: number | null
          comment_count?: number
          content_score?: number | null
          created_at?: string | null
          data_quality_score?: number | null
          description?: string | null
          developer?: string | null
          dong?: string | null
          extension_cost?: number | null
          faq_items?: Json | null
          id?: string
          images?: Json | null
          interest_count?: number | null
          is_active?: boolean | null
          key_features?: Json | null
          latitude?: number | null
          longitude?: number | null
          move_in_date?: string | null
          name: string
          name_variants?: Json | null
          nearby_facilities?: Json | null
          nearby_station?: string | null
          og_image_url?: string | null
          option_costs?: Json | null
          page_views?: number | null
          payment_schedule?: Json | null
          price_comparison?: Json | null
          price_max?: number | null
          price_min?: number | null
          region?: string | null
          satellite_image_url?: string | null
          school_district?: string | null
          search_trend?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          sigungu?: string | null
          site_type?: string
          sitemap_wave?: number | null
          slug: string
          source_ids?: Json | null
          status?: string | null
          total_units?: number | null
          transit_score?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          analysis_generated_at?: string | null
          analysis_text?: string | null
          builder?: string | null
          built_year?: number | null
          comment_count?: number
          content_score?: number | null
          created_at?: string | null
          data_quality_score?: number | null
          description?: string | null
          developer?: string | null
          dong?: string | null
          extension_cost?: number | null
          faq_items?: Json | null
          id?: string
          images?: Json | null
          interest_count?: number | null
          is_active?: boolean | null
          key_features?: Json | null
          latitude?: number | null
          longitude?: number | null
          move_in_date?: string | null
          name?: string
          name_variants?: Json | null
          nearby_facilities?: Json | null
          nearby_station?: string | null
          og_image_url?: string | null
          option_costs?: Json | null
          page_views?: number | null
          payment_schedule?: Json | null
          price_comparison?: Json | null
          price_max?: number | null
          price_min?: number | null
          region?: string | null
          satellite_image_url?: string | null
          school_district?: string | null
          search_trend?: Json | null
          seo_description?: string | null
          seo_title?: string | null
          sigungu?: string | null
          site_type?: string
          sitemap_wave?: number | null
          slug?: string
          source_ids?: Json | null
          status?: string | null
          total_units?: number | null
          transit_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      apt_subscriptions: {
        Row: {
          acquisition_tax_est: number | null
          acquisition_tax_estimate: number | null
          ai_summary: string | null
          announcement_parsed_at: string | null
          announcement_pdf_url: string | null
          announcement_raw_text: string | null
          announcement_summary: Json | null
          architect: string | null
          balance_pct: number | null
          balcony_extension: boolean | null
          balcony_extension_cost: number | null
          balcony_price: number | null
          brand_name: string | null
          building_area: number | null
          building_coverage: number | null
          bus_routes: string[] | null
          business_approval_date: string | null
          ceiling_height: number | null
          cntrct_cncls_bgnde: string | null
          cntrct_cncls_endde: string | null
          community_facilities: string[] | null
          community_list: Json | null
          competition_rate_1st: number | null
          competition_rate_2nd: number | null
          competition_updated_at: string | null
          completion_date: string | null
          construction_start_date: string | null
          constructor_nm: string | null
          developer_nm: string | null
          down_payment_pct: number | null
          down_payment_schedule: Json | null
          elevator_count: number | null
          energy_grade: string | null
          entrance_type: string | null
          estimated_maintenance: number | null
          estimated_mgmt_fee: number | null
          exclusive_ratio: number | null
          extension_cost: number | null
          exterior_finish: string | null
          fetched_at: string
          floor_area_ratio: number | null
          general_supply_total: number | null
          has_daycare: boolean | null
          has_fitness: boolean | null
          heating_type: string | null
          house_manage_no: string
          house_nm: string
          house_type_info: Json | null
          hssply_adres: string | null
          id: number
          interim_count: number | null
          is_price_limit: boolean | null
          is_regulated_area: boolean | null
          is_speculative_zone: boolean | null
          land_area: number | null
          landscape_designer: string | null
          latitude: number | null
          loan_available: boolean | null
          loan_rate: string | null
          longitude: number | null
          max_floor: number | null
          mdatrgbn_nm: string | null
          min_floor: number | null
          model_house_addr: string | null
          move_in_month: string | null
          mvn_prearnge_ym: string | null
          nearby_facilities: Json | null
          nearest_school: string | null
          nearest_station: string | null
          option_costs: Json | null
          option_items: Json | null
          options_list: Json | null
          parking_co: number | null
          parking_ratio: number | null
          parking_total: number | null
          parse_fail_count: number | null
          payment_schedule: Json | null
          pblanc_url: string | null
          pdf_parse_version: number | null
          price_parsed_at: string | null
          price_per_pyeong: number | null
          price_per_pyeong_avg: number | null
          price_per_pyeong_max: number | null
          price_per_pyeong_min: number | null
          price_source: string | null
          priority_supply_area: string | null
          project_type: string | null
          przwner_presnatn_de: string | null
          qualification_summary: string | null
          rcept_bgnde: string | null
          rcept_endde: string | null
          region_cd: string | null
          region_nm: string | null
          resale_restriction_months: number | null
          residence_obligation: string | null
          residence_obligation_years: number | null
          rewin_limit_years: number | null
          savings_requirement: string | null
          school_district: string | null
          schools: Json | null
          special_features: string | null
          special_supply_detail: Json | null
          special_supply_total: number | null
          spsply_rcept_bgnde: string | null
          spsply_rcept_endde: string | null
          station_distance: string | null
          stations: Json | null
          status: string | null
          structure_type: string | null
          supply_addr: string | null
          supply_breakdown: Json | null
          supply_count: number | null
          supply_price_info: Json | null
          tot_supply_hshld_co: number | null
          total_apply_count: number | null
          total_cost_est: number | null
          total_dong_co: number | null
          total_dong_count: number | null
          total_households: number | null
          total_parking: number | null
          transfer_limit: string | null
          transfer_limit_years: number | null
          type_detail: Json | null
          updated_at: string
          view_count: number | null
          zero_energy_cert: string | null
        }
        Insert: {
          acquisition_tax_est?: number | null
          acquisition_tax_estimate?: number | null
          ai_summary?: string | null
          announcement_parsed_at?: string | null
          announcement_pdf_url?: string | null
          announcement_raw_text?: string | null
          announcement_summary?: Json | null
          architect?: string | null
          balance_pct?: number | null
          balcony_extension?: boolean | null
          balcony_extension_cost?: number | null
          balcony_price?: number | null
          brand_name?: string | null
          building_area?: number | null
          building_coverage?: number | null
          bus_routes?: string[] | null
          business_approval_date?: string | null
          ceiling_height?: number | null
          cntrct_cncls_bgnde?: string | null
          cntrct_cncls_endde?: string | null
          community_facilities?: string[] | null
          community_list?: Json | null
          competition_rate_1st?: number | null
          competition_rate_2nd?: number | null
          competition_updated_at?: string | null
          completion_date?: string | null
          construction_start_date?: string | null
          constructor_nm?: string | null
          developer_nm?: string | null
          down_payment_pct?: number | null
          down_payment_schedule?: Json | null
          elevator_count?: number | null
          energy_grade?: string | null
          entrance_type?: string | null
          estimated_maintenance?: number | null
          estimated_mgmt_fee?: number | null
          exclusive_ratio?: number | null
          extension_cost?: number | null
          exterior_finish?: string | null
          fetched_at?: string
          floor_area_ratio?: number | null
          general_supply_total?: number | null
          has_daycare?: boolean | null
          has_fitness?: boolean | null
          heating_type?: string | null
          house_manage_no: string
          house_nm: string
          house_type_info?: Json | null
          hssply_adres?: string | null
          id?: number
          interim_count?: number | null
          is_price_limit?: boolean | null
          is_regulated_area?: boolean | null
          is_speculative_zone?: boolean | null
          land_area?: number | null
          landscape_designer?: string | null
          latitude?: number | null
          loan_available?: boolean | null
          loan_rate?: string | null
          longitude?: number | null
          max_floor?: number | null
          mdatrgbn_nm?: string | null
          min_floor?: number | null
          model_house_addr?: string | null
          move_in_month?: string | null
          mvn_prearnge_ym?: string | null
          nearby_facilities?: Json | null
          nearest_school?: string | null
          nearest_station?: string | null
          option_costs?: Json | null
          option_items?: Json | null
          options_list?: Json | null
          parking_co?: number | null
          parking_ratio?: number | null
          parking_total?: number | null
          parse_fail_count?: number | null
          payment_schedule?: Json | null
          pblanc_url?: string | null
          pdf_parse_version?: number | null
          price_parsed_at?: string | null
          price_per_pyeong?: number | null
          price_per_pyeong_avg?: number | null
          price_per_pyeong_max?: number | null
          price_per_pyeong_min?: number | null
          price_source?: string | null
          priority_supply_area?: string | null
          project_type?: string | null
          przwner_presnatn_de?: string | null
          qualification_summary?: string | null
          rcept_bgnde?: string | null
          rcept_endde?: string | null
          region_cd?: string | null
          region_nm?: string | null
          resale_restriction_months?: number | null
          residence_obligation?: string | null
          residence_obligation_years?: number | null
          rewin_limit_years?: number | null
          savings_requirement?: string | null
          school_district?: string | null
          schools?: Json | null
          special_features?: string | null
          special_supply_detail?: Json | null
          special_supply_total?: number | null
          spsply_rcept_bgnde?: string | null
          spsply_rcept_endde?: string | null
          station_distance?: string | null
          stations?: Json | null
          status?: string | null
          structure_type?: string | null
          supply_addr?: string | null
          supply_breakdown?: Json | null
          supply_count?: number | null
          supply_price_info?: Json | null
          tot_supply_hshld_co?: number | null
          total_apply_count?: number | null
          total_cost_est?: number | null
          total_dong_co?: number | null
          total_dong_count?: number | null
          total_households?: number | null
          total_parking?: number | null
          transfer_limit?: string | null
          transfer_limit_years?: number | null
          type_detail?: Json | null
          updated_at?: string
          view_count?: number | null
          zero_energy_cert?: string | null
        }
        Update: {
          acquisition_tax_est?: number | null
          acquisition_tax_estimate?: number | null
          ai_summary?: string | null
          announcement_parsed_at?: string | null
          announcement_pdf_url?: string | null
          announcement_raw_text?: string | null
          announcement_summary?: Json | null
          architect?: string | null
          balance_pct?: number | null
          balcony_extension?: boolean | null
          balcony_extension_cost?: number | null
          balcony_price?: number | null
          brand_name?: string | null
          building_area?: number | null
          building_coverage?: number | null
          bus_routes?: string[] | null
          business_approval_date?: string | null
          ceiling_height?: number | null
          cntrct_cncls_bgnde?: string | null
          cntrct_cncls_endde?: string | null
          community_facilities?: string[] | null
          community_list?: Json | null
          competition_rate_1st?: number | null
          competition_rate_2nd?: number | null
          competition_updated_at?: string | null
          completion_date?: string | null
          construction_start_date?: string | null
          constructor_nm?: string | null
          developer_nm?: string | null
          down_payment_pct?: number | null
          down_payment_schedule?: Json | null
          elevator_count?: number | null
          energy_grade?: string | null
          entrance_type?: string | null
          estimated_maintenance?: number | null
          estimated_mgmt_fee?: number | null
          exclusive_ratio?: number | null
          extension_cost?: number | null
          exterior_finish?: string | null
          fetched_at?: string
          floor_area_ratio?: number | null
          general_supply_total?: number | null
          has_daycare?: boolean | null
          has_fitness?: boolean | null
          heating_type?: string | null
          house_manage_no?: string
          house_nm?: string
          house_type_info?: Json | null
          hssply_adres?: string | null
          id?: number
          interim_count?: number | null
          is_price_limit?: boolean | null
          is_regulated_area?: boolean | null
          is_speculative_zone?: boolean | null
          land_area?: number | null
          landscape_designer?: string | null
          latitude?: number | null
          loan_available?: boolean | null
          loan_rate?: string | null
          longitude?: number | null
          max_floor?: number | null
          mdatrgbn_nm?: string | null
          min_floor?: number | null
          model_house_addr?: string | null
          move_in_month?: string | null
          mvn_prearnge_ym?: string | null
          nearby_facilities?: Json | null
          nearest_school?: string | null
          nearest_station?: string | null
          option_costs?: Json | null
          option_items?: Json | null
          options_list?: Json | null
          parking_co?: number | null
          parking_ratio?: number | null
          parking_total?: number | null
          parse_fail_count?: number | null
          payment_schedule?: Json | null
          pblanc_url?: string | null
          pdf_parse_version?: number | null
          price_parsed_at?: string | null
          price_per_pyeong?: number | null
          price_per_pyeong_avg?: number | null
          price_per_pyeong_max?: number | null
          price_per_pyeong_min?: number | null
          price_source?: string | null
          priority_supply_area?: string | null
          project_type?: string | null
          przwner_presnatn_de?: string | null
          qualification_summary?: string | null
          rcept_bgnde?: string | null
          rcept_endde?: string | null
          region_cd?: string | null
          region_nm?: string | null
          resale_restriction_months?: number | null
          residence_obligation?: string | null
          residence_obligation_years?: number | null
          rewin_limit_years?: number | null
          savings_requirement?: string | null
          school_district?: string | null
          schools?: Json | null
          special_features?: string | null
          special_supply_detail?: Json | null
          special_supply_total?: number | null
          spsply_rcept_bgnde?: string | null
          spsply_rcept_endde?: string | null
          station_distance?: string | null
          stations?: Json | null
          status?: string | null
          structure_type?: string | null
          supply_addr?: string | null
          supply_breakdown?: Json | null
          supply_count?: number | null
          supply_price_info?: Json | null
          tot_supply_hshld_co?: number | null
          total_apply_count?: number | null
          total_cost_est?: number | null
          total_dong_co?: number | null
          total_dong_count?: number | null
          total_households?: number | null
          total_parking?: number | null
          transfer_limit?: string | null
          transfer_limit_years?: number | null
          type_detail?: Json | null
          updated_at?: string
          view_count?: number | null
          zero_energy_cert?: string | null
        }
        Relationships: []
      }
      apt_trade_monthly_stats: {
        Row: {
          avg_area: number | null
          avg_price: number | null
          avg_price_per_pyeong: number | null
          created_at: string | null
          id: string
          max_price: number | null
          metadata: Json | null
          min_price: number | null
          region: string
          stat_month: string
          trade_count: number | null
        }
        Insert: {
          avg_area?: number | null
          avg_price?: number | null
          avg_price_per_pyeong?: number | null
          created_at?: string | null
          id?: string
          max_price?: number | null
          metadata?: Json | null
          min_price?: number | null
          region: string
          stat_month: string
          trade_count?: number | null
        }
        Update: {
          avg_area?: number | null
          avg_price?: number | null
          avg_price_per_pyeong?: number | null
          created_at?: string | null
          id?: string
          max_price?: number | null
          metadata?: Json | null
          min_price?: number | null
          region?: string
          stat_month?: string
          trade_count?: number | null
        }
        Relationships: []
      }
      apt_transactions: {
        Row: {
          ai_summary: string | null
          apt_name: string
          built_year: number | null
          created_at: string | null
          deal_amount: number | null
          deal_date: string | null
          dong: string | null
          exclusive_area: number | null
          floor: number | null
          id: string
          latitude: number | null
          longitude: number | null
          nearest_station: string | null
          parking_ratio: number | null
          region_nm: string | null
          sigungu: string | null
          source: string | null
          total_dong: number | null
          total_households: number | null
          trade_type: string | null
        }
        Insert: {
          ai_summary?: string | null
          apt_name: string
          built_year?: number | null
          created_at?: string | null
          deal_amount?: number | null
          deal_date?: string | null
          dong?: string | null
          exclusive_area?: number | null
          floor?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nearest_station?: string | null
          parking_ratio?: number | null
          region_nm?: string | null
          sigungu?: string | null
          source?: string | null
          total_dong?: number | null
          total_households?: number | null
          trade_type?: string | null
        }
        Update: {
          ai_summary?: string | null
          apt_name?: string
          built_year?: number | null
          created_at?: string | null
          deal_amount?: number | null
          deal_date?: string | null
          dong?: string | null
          exclusive_area?: number | null
          floor?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nearest_station?: string | null
          parking_ratio?: number | null
          region_nm?: string | null
          sigungu?: string | null
          source?: string | null
          total_dong?: number | null
          total_households?: number | null
          trade_type?: string | null
        }
        Relationships: []
      }
      apt_watchlist: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          item_type: string
          memo: string | null
          notify_enabled: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          item_type: string
          memo?: string | null
          notify_enabled?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          item_type?: string
          memo?: string | null
          notify_enabled?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          last_date: string | null
          streak: number
          total_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          last_date?: string | null
          streak?: number
          total_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          last_date?: string | null
          streak?: number
          total_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_point_granted: {
        Row: {
          granted_at: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_point_granted_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banned_words: {
        Row: {
          category: string
          created_at: string | null
          id: number
          is_active: boolean
          word: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          id?: number
          is_active?: boolean
          word: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: number
          is_active?: boolean
          word?: string
        }
        Relationships: []
      }
      beta_testers: {
        Row: {
          age_group: string | null
          agreed_terms: boolean | null
          contact: string
          created_at: string | null
          id: number
          name: string
          referral: string | null
          region: string | null
          status: string | null
        }
        Insert: {
          age_group?: string | null
          agreed_terms?: boolean | null
          contact: string
          created_at?: string | null
          id?: number
          name: string
          referral?: string | null
          region?: string | null
          status?: string | null
        }
        Update: {
          age_group?: string | null
          agreed_terms?: boolean | null
          contact?: string
          created_at?: string | null
          id?: number
          name?: string
          referral?: string | null
          region?: string | null
          status?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_bookmarks: {
        Row: {
          blog_post_id: number | null
          created_at: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          blog_post_id?: number | null
          created_at?: string | null
          id?: number
          user_id?: string | null
        }
        Update: {
          blog_post_id?: number | null
          created_at?: string | null
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_bookmarks_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_builder_registry: {
        Row: {
          builder_name: string
          category: string
          created_at: string | null
          cron_schedule: string | null
          description: string
          example_call: string | null
          function_name: string
          id: number
          is_active: boolean | null
        }
        Insert: {
          builder_name: string
          category: string
          created_at?: string | null
          cron_schedule?: string | null
          description: string
          example_call?: string | null
          function_name: string
          id?: number
          is_active?: boolean | null
        }
        Update: {
          builder_name?: string
          category?: string
          created_at?: string | null
          cron_schedule?: string | null
          description?: string
          example_call?: string | null
          function_name?: string
          id?: number
          is_active?: boolean | null
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          author_id: string | null
          author_name: string | null
          blog_post_id: number
          content: string
          created_at: string | null
          id: number
          image_url: string | null
          is_seed: boolean | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          blog_post_id: number
          content: string
          created_at?: string | null
          id?: number
          image_url?: string | null
          is_seed?: boolean | null
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          blog_post_id?: number
          content?: string
          created_at?: string | null
          id?: number
          image_url?: string | null
          is_seed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_comments_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_helpful: {
        Row: {
          blog_post_id: number | null
          created_at: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          blog_post_id?: number | null
          created_at?: string | null
          id?: number
          user_id?: string | null
        }
        Update: {
          blog_post_id?: number | null
          created_at?: string | null
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_helpful_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_helpful_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_images: {
        Row: {
          alt_text: string
          caption: string | null
          created_at: string | null
          height: number | null
          id: number
          image_type: string
          image_url: string
          position: number
          post_id: number
          width: number | null
        }
        Insert: {
          alt_text?: string
          caption?: string | null
          created_at?: string | null
          height?: number | null
          id?: number
          image_type?: string
          image_url: string
          position?: number
          post_id: number
          width?: number | null
        }
        Update: {
          alt_text?: string
          caption?: string | null
          created_at?: string | null
          height?: number | null
          id?: number
          image_type?: string
          image_url?: string
          position?: number
          post_id?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string | null
          author_role: string | null
          category: string
          comment_count: number | null
          comments_count: number | null
          content: string
          cover_image: string | null
          created_at: string | null
          cron_type: string | null
          data_date: string | null
          excerpt: string | null
          fts: unknown
          helpful_count: number | null
          id: number
          image_alt: string | null
          indexed_at: string | null
          is_published: boolean | null
          meta_description: string | null
          meta_keywords: string | null
          metadata: Json | null
          published_at: string | null
          reading_time_min: number | null
          related_slugs: string[] | null
          rewritten_at: string | null
          seo_score: number | null
          seo_tier: string | null
          series_id: string | null
          series_order: number | null
          slug: string
          source_ref: string | null
          source_type: string | null
          sub_category: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_name?: string | null
          author_role?: string | null
          category?: string
          comment_count?: number | null
          comments_count?: number | null
          content: string
          cover_image?: string | null
          created_at?: string | null
          cron_type?: string | null
          data_date?: string | null
          excerpt?: string | null
          fts?: unknown
          helpful_count?: number | null
          id?: number
          image_alt?: string | null
          indexed_at?: string | null
          is_published?: boolean | null
          meta_description?: string | null
          meta_keywords?: string | null
          metadata?: Json | null
          published_at?: string | null
          reading_time_min?: number | null
          related_slugs?: string[] | null
          rewritten_at?: string | null
          seo_score?: number | null
          seo_tier?: string | null
          series_id?: string | null
          series_order?: number | null
          slug: string
          source_ref?: string | null
          source_type?: string | null
          sub_category?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_name?: string | null
          author_role?: string | null
          category?: string
          comment_count?: number | null
          comments_count?: number | null
          content?: string
          cover_image?: string | null
          created_at?: string | null
          cron_type?: string | null
          data_date?: string | null
          excerpt?: string | null
          fts?: unknown
          helpful_count?: number | null
          id?: number
          image_alt?: string | null
          indexed_at?: string | null
          is_published?: boolean | null
          meta_description?: string | null
          meta_keywords?: string | null
          metadata?: Json | null
          published_at?: string | null
          reading_time_min?: number | null
          related_slugs?: string[] | null
          rewritten_at?: string | null
          seo_score?: number | null
          seo_tier?: string | null
          series_id?: string | null
          series_order?: number | null
          slug?: string
          source_ref?: string | null
          source_type?: string | null
          sub_category?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      blog_publish_config: {
        Row: {
          auto_publish_blocked_categories: string[] | null
          auto_publish_enabled: boolean
          auto_publish_min_score: number | null
          daily_create_limit: number
          daily_publish_limit: number
          id: number
          min_content_length: number
          publish_hours: number[]
          title_similarity_threshold: number
          updated_at: string | null
        }
        Insert: {
          auto_publish_blocked_categories?: string[] | null
          auto_publish_enabled?: boolean
          auto_publish_min_score?: number | null
          daily_create_limit?: number
          daily_publish_limit?: number
          id?: number
          min_content_length?: number
          publish_hours?: number[]
          title_similarity_threshold?: number
          updated_at?: string | null
        }
        Update: {
          auto_publish_blocked_categories?: string[] | null
          auto_publish_enabled?: boolean
          auto_publish_min_score?: number | null
          daily_create_limit?: number
          daily_publish_limit?: number
          id?: number
          min_content_length?: number
          publish_hours?: number[]
          title_similarity_threshold?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      blog_quality_rules: {
        Row: {
          created_at: string | null
          description: string
          id: number
          is_active: boolean | null
          rule_code: string
          rule_name: string
          severity: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: number
          is_active?: boolean | null
          rule_code: string
          rule_name: string
          severity?: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: number
          is_active?: boolean | null
          rule_code?: string
          rule_name?: string
          severity?: string
        }
        Relationships: []
      }
      blog_series: {
        Row: {
          category: string | null
          cover_image: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          post_count: number | null
          slug: string
          title: string
        }
        Insert: {
          category?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          post_count?: number | null
          slug: string
          title: string
        }
        Update: {
          category?: string | null
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          post_count?: number | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          post_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_info: {
        Row: {
          address: string
          business_category: string | null
          business_number: string
          business_type: string | null
          company_name: string
          email: string | null
          id: number
          opened_at: string | null
          phone: string | null
          representative: string
          tax_type: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address: string
          business_category?: string | null
          business_number: string
          business_type?: string | null
          company_name: string
          email?: string | null
          id?: never
          opened_at?: string | null
          phone?: string | null
          representative: string
          tax_type?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string
          business_category?: string | null
          business_number?: string
          business_type?: string | null
          company_name?: string
          email?: string | null
          id?: never
          opened_at?: string | null
          phone?: string | null
          representative?: string
          tax_type?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      chat_message_likes: {
        Row: {
          created_at: string | null
          id: string
          message_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_likes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          room: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          room?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          room?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: number
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: number
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: number
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          comment_type: string | null
          content: string
          created_at: string
          id: number
          image_url: string | null
          is_anonymous: boolean
          is_deleted: boolean
          likes_count: number
          parent_id: number | null
          post_id: number
        }
        Insert: {
          author_id?: string | null
          comment_type?: string | null
          content: string
          created_at?: string
          id?: number
          image_url?: string | null
          is_anonymous?: boolean
          is_deleted?: boolean
          likes_count?: number
          parent_id?: number | null
          post_id: number
        }
        Update: {
          author_id?: string | null
          comment_type?: string | null
          content?: string
          created_at?: string
          id?: number
          image_url?: string | null
          is_anonymous?: boolean
          is_deleted?: boolean
          likes_count?: number
          parent_id?: number | null
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_leads: {
        Row: {
          consultant_id: string | null
          contacted_at: string | null
          converted_at: string | null
          created_at: string | null
          forwarded_at: string | null
          id: number
          interest_id: number
          notes: string | null
          site_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          consultant_id?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string | null
          forwarded_at?: string | null
          id?: number
          interest_id: number
          notes?: string | null
          site_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          consultant_id?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string | null
          forwarded_at?: string | null
          id?: number
          interest_id?: number
          notes?: string | null
          site_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_leads_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_leads_interest_id_fkey"
            columns: ["interest_id"]
            isOneToOne: false
            referencedRelation: "apt_site_interests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultant_leads_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "apt_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_profiles: {
        Row: {
          bio: string | null
          company: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          kakao_id: string | null
          license_no: string | null
          name: string
          phone: string
          profile_image: string | null
          regions: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          company?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          kakao_id?: string | null
          license_no?: string | null
          name: string
          phone: string
          profile_image?: string | null
          regions?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          company?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          kakao_id?: string | null
          license_no?: string | null
          name?: string
          phone?: string
          profile_image?: string | null
          regions?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          status: string | null
          target_id: number
          target_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          status?: string | null
          target_id: number
          target_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          status?: string | null
          target_id?: number
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_events: {
        Row: {
          category: string | null
          created_at: string | null
          cta_name: string
          event_type: string
          id: number
          page_path: string | null
          visitor_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          cta_name: string
          event_type: string
          id?: number
          page_path?: string | null
          visitor_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          cta_name?: string
          event_type?: string
          id?: number
          page_path?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      cron_logs: {
        Row: {
          created_at: string | null
          cron_name: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          metadata: Json | null
          records_created: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          cron_name: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          cron_name?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          created_at: string | null
          data: Json
          id: number
          issue_no: number
          region: string
          report_date: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: never
          issue_no: number
          region: string
          report_date: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: never
          issue_no?: number
          region?: string
          report_date?: string
        }
        Relationships: []
      }
      daily_stats: {
        Row: {
          apt_subscriptions_count: number | null
          apt_transactions_count: number | null
          created_at: string | null
          dau: number | null
          id: string
          metadata: Json | null
          new_blogs: number | null
          new_comments: number | null
          new_posts: number | null
          new_users: number | null
          redev_projects_count: number | null
          stat_date: string
          stock_quotes_count: number | null
          total_blogs: number | null
          total_comments: number | null
          total_page_views: number | null
          total_posts: number | null
          total_users: number | null
          unsold_apts_count: number | null
        }
        Insert: {
          apt_subscriptions_count?: number | null
          apt_transactions_count?: number | null
          created_at?: string | null
          dau?: number | null
          id?: string
          metadata?: Json | null
          new_blogs?: number | null
          new_comments?: number | null
          new_posts?: number | null
          new_users?: number | null
          redev_projects_count?: number | null
          stat_date?: string
          stock_quotes_count?: number | null
          total_blogs?: number | null
          total_comments?: number | null
          total_page_views?: number | null
          total_posts?: number | null
          total_users?: number | null
          unsold_apts_count?: number | null
        }
        Update: {
          apt_subscriptions_count?: number | null
          apt_transactions_count?: number | null
          created_at?: string | null
          dau?: number | null
          id?: string
          metadata?: Json | null
          new_blogs?: number | null
          new_comments?: number | null
          new_posts?: number | null
          new_users?: number | null
          redev_projects_count?: number | null
          stat_date?: string
          stock_quotes_count?: number | null
          total_blogs?: number | null
          total_comments?: number | null
          total_page_views?: number | null
          total_posts?: number | null
          total_users?: number | null
          unsold_apts_count?: number | null
        }
        Relationships: []
      }
      discussion_comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          id: number
          is_anonymous: boolean | null
          likes: number | null
          topic_id: number | null
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: number
          is_anonymous?: boolean | null
          likes?: number | null
          topic_id?: number | null
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: number
          is_anonymous?: boolean | null
          likes?: number | null
          topic_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_comments_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "discussion_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_messages: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: number
          is_anonymous: boolean | null
          is_deleted: boolean | null
          message_type: string | null
          room_id: number
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: never
          is_anonymous?: boolean | null
          is_deleted?: boolean | null
          message_type?: string | null
          room_id: number
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: never
          is_anonymous?: boolean | null
          is_deleted?: boolean | null
          message_type?: string | null
          room_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "discussion_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "discussion_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hot_discussion_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          id: number
          is_active: boolean
          is_premium: boolean | null
          member_count: number
          messages_count: number | null
          post_count: number
          requires_purchase: boolean | null
          room_key: string
          room_type: string
          source_ref: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: never
          is_active?: boolean
          is_premium?: boolean | null
          member_count?: number
          messages_count?: number | null
          post_count?: number
          requires_purchase?: boolean | null
          room_key: string
          room_type: string
          source_ref?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: never
          is_active?: boolean
          is_premium?: boolean | null
          member_count?: number
          messages_count?: number | null
          post_count?: number
          requires_purchase?: boolean | null
          room_key?: string
          room_type?: string
          source_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_topics: {
        Row: {
          author_id: string | null
          category: string
          comment_count: number | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: number
          is_hot: boolean | null
          is_pinned: boolean | null
          option_a: string | null
          option_b: string | null
          title: string
          topic_type: string
          view_count: number | null
          vote_a: number | null
          vote_b: number | null
        }
        Insert: {
          author_id?: string | null
          category?: string
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: number
          is_hot?: boolean | null
          is_pinned?: boolean | null
          option_a?: string | null
          option_b?: string | null
          title: string
          topic_type?: string
          view_count?: number | null
          vote_a?: number | null
          vote_b?: number | null
        }
        Update: {
          author_id?: string | null
          category?: string
          comment_count?: number | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: number
          is_hot?: boolean | null
          is_pinned?: boolean | null
          option_a?: string | null
          option_b?: string | null
          title?: string
          topic_type?: string
          view_count?: number | null
          vote_a?: number | null
          vote_b?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discussion_topics_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_votes: {
        Row: {
          author_id: string | null
          created_at: string | null
          id: number
          topic_id: number | null
          vote: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string | null
          id?: number
          topic_id?: number | null
          vote: string
        }
        Update: {
          author_id?: string | null
          created_at?: string | null
          id?: number
          topic_id?: number | null
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_votes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_votes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "discussion_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_logs: {
        Row: {
          campaign: string
          click_count: number | null
          clicked_at: string | null
          clicked_url: string | null
          created_at: string | null
          error_message: string | null
          id: string
          open_count: number | null
          opened_at: string | null
          recipient_email: string
          resend_id: string | null
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          campaign: string
          click_count?: number | null
          clicked_at?: string | null
          clicked_url?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          open_count?: number | null
          opened_at?: string | null
          recipient_email: string
          resend_id?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          campaign?: string
          click_count?: number | null
          clicked_at?: string | null
          clicked_url?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          open_count?: number | null
          opened_at?: string | null
          recipient_email?: string
          resend_id?: string | null
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_subscribers: {
        Row: {
          category: string | null
          consent: boolean | null
          created_at: string | null
          email: string
          id: number
          is_active: boolean | null
          subscribed_at: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          category?: string | null
          consent?: boolean | null
          created_at?: string | null
          email: string
          id?: number
          is_active?: boolean | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          category?: string | null
          consent?: boolean | null
          created_at?: string | null
          email?: string
          id?: number
          is_active?: boolean | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      exchange_rate_history: {
        Row: {
          currency_pair: string
          id: string
          rate: number
          recorded_at: string | null
        }
        Insert: {
          currency_pair?: string
          id?: string
          rate: number
          recorded_at?: string | null
        }
        Update: {
          currency_pair?: string
          id?: string
          rate?: number
          recorded_at?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          base_currency: string
          rates: Json
          updated_at: string | null
        }
        Insert: {
          base_currency: string
          rates: Json
          updated_at?: string | null
        }
        Update: {
          base_currency?: string
          rates?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean | null
          key: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fortune_views: {
        Row: {
          birth_year: number
          fortune_text: string | null
          id: number
          user_id: string | null
          view_date: string | null
          viewed_at: string | null
          zodiac_animal: string
        }
        Insert: {
          birth_year: number
          fortune_text?: string | null
          id?: number
          user_id?: string | null
          view_date?: string | null
          viewed_at?: string | null
          zodiac_animal: string
        }
        Update: {
          birth_year?: number
          fortune_text?: string | null
          id?: number
          user_id?: string | null
          view_date?: string | null
          viewed_at?: string | null
          zodiac_animal?: string
        }
        Relationships: []
      }
      grade_definitions: {
        Row: {
          color_hex: string
          description: string
          emoji: string
          grade: number
          min_score: number
          title: string
        }
        Insert: {
          color_hex: string
          description: string
          emoji: string
          grade: number
          min_score: number
          title: string
        }
        Update: {
          color_hex?: string
          description?: string
          emoji?: string
          grade?: number
          min_score?: number
          title?: string
        }
        Relationships: []
      }
      guide_seeds: {
        Row: {
          blog_generated: boolean | null
          category: string
          created_at: string | null
          id: number
          outline: string
          slug: string
          tags: string[] | null
          title: string
        }
        Insert: {
          blog_generated?: boolean | null
          category: string
          created_at?: string | null
          id?: number
          outline: string
          slug: string
          tags?: string[] | null
          title: string
        }
        Update: {
          blog_generated?: boolean | null
          category?: string
          created_at?: string | null
          id?: number
          outline?: string
          slug?: string
          tags?: string[] | null
          title?: string
        }
        Relationships: []
      }
      health_checks: {
        Row: {
          error_message: string | null
          id: string
          last_checked_at: string | null
          metadata: Json | null
          response_time_ms: number | null
          service_name: string
          status: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          last_checked_at?: string | null
          metadata?: Json | null
          response_time_ms?: number | null
          service_name: string
          status?: string
        }
        Update: {
          error_message?: string | null
          id?: string
          last_checked_at?: string | null
          metadata?: Json | null
          response_time_ms?: number | null
          service_name?: string
          status?: string
        }
        Relationships: []
      }
      invest_calendar: {
        Row: {
          country: string | null
          created_at: string | null
          description: string | null
          event_date: string
          event_type: string
          id: number
          importance: string | null
          title: string
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          description?: string | null
          event_date: string
          event_type?: string
          id?: number
          importance?: string | null
          title: string
        }
        Update: {
          country?: string | null
          created_at?: string | null
          description?: string | null
          event_date?: string
          event_type?: string
          id?: number
          importance?: string | null
          title?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string | null
          creator_id: string
          id: string
          is_used: boolean | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          creator_id: string
          id?: string
          is_used?: boolean | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          creator_id?: string
          id?: string
          is_used?: boolean | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_alerts: {
        Row: {
          base_score: number | null
          block_reason: string | null
          blog_post_id: number | null
          category: string
          competition_score: number | null
          created_at: string | null
          detected_at: string | null
          detected_keywords: string[] | null
          draft_content: string | null
          draft_keywords: string[] | null
          draft_slug: string | null
          draft_template: string | null
          draft_title: string | null
          effectiveness_score: number | null
          fact_check_details: Json | null
          fact_check_passed: boolean | null
          feed_post_id: string | null
          final_score: number | null
          id: string
          infographic_data: Json | null
          is_auto_publish: boolean | null
          is_processed: boolean | null
          is_published: boolean | null
          issue_type: string | null
          lifecycle_stage: string | null
          multiplier: number | null
          parent_issue_id: string | null
          penalty_rate: number | null
          post_24h_views: number | null
          post_7d_views: number | null
          post_signup_count: number | null
          processed_at: string | null
          publish_decision: string | null
          published_at: string | null
          raw_data: Json | null
          related_entities: string[] | null
          score_breakdown: Json | null
          source_type: string
          source_urls: string[] | null
          sub_category: string | null
          summary: string | null
          title: string
        }
        Insert: {
          base_score?: number | null
          block_reason?: string | null
          blog_post_id?: number | null
          category: string
          competition_score?: number | null
          created_at?: string | null
          detected_at?: string | null
          detected_keywords?: string[] | null
          draft_content?: string | null
          draft_keywords?: string[] | null
          draft_slug?: string | null
          draft_template?: string | null
          draft_title?: string | null
          effectiveness_score?: number | null
          fact_check_details?: Json | null
          fact_check_passed?: boolean | null
          feed_post_id?: string | null
          final_score?: number | null
          id?: string
          infographic_data?: Json | null
          is_auto_publish?: boolean | null
          is_processed?: boolean | null
          is_published?: boolean | null
          issue_type?: string | null
          lifecycle_stage?: string | null
          multiplier?: number | null
          parent_issue_id?: string | null
          penalty_rate?: number | null
          post_24h_views?: number | null
          post_7d_views?: number | null
          post_signup_count?: number | null
          processed_at?: string | null
          publish_decision?: string | null
          published_at?: string | null
          raw_data?: Json | null
          related_entities?: string[] | null
          score_breakdown?: Json | null
          source_type: string
          source_urls?: string[] | null
          sub_category?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          base_score?: number | null
          block_reason?: string | null
          blog_post_id?: number | null
          category?: string
          competition_score?: number | null
          created_at?: string | null
          detected_at?: string | null
          detected_keywords?: string[] | null
          draft_content?: string | null
          draft_keywords?: string[] | null
          draft_slug?: string | null
          draft_template?: string | null
          draft_title?: string | null
          effectiveness_score?: number | null
          fact_check_details?: Json | null
          fact_check_passed?: boolean | null
          feed_post_id?: string | null
          final_score?: number | null
          id?: string
          infographic_data?: Json | null
          is_auto_publish?: boolean | null
          is_processed?: boolean | null
          is_published?: boolean | null
          issue_type?: string | null
          lifecycle_stage?: string | null
          multiplier?: number | null
          parent_issue_id?: string | null
          penalty_rate?: number | null
          post_24h_views?: number | null
          post_7d_views?: number | null
          post_signup_count?: number | null
          processed_at?: string | null
          publish_decision?: string | null
          published_at?: string | null
          raw_data?: Json | null
          related_entities?: string[] | null
          score_breakdown?: Json | null
          source_type?: string
          source_urls?: string[] | null
          sub_category?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_alerts_parent_issue_id_fkey"
            columns: ["parent_issue_id"]
            isOneToOne: false
            referencedRelation: "issue_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      landmark_apts: {
        Row: {
          address: string | null
          area_m2: string | null
          avg_jeonse_100m: string | null
          avg_price_100m: string | null
          blog_generated: boolean | null
          blog_slug: string | null
          built_year: number | null
          created_at: string | null
          description: string | null
          district: string
          id: number
          image_url: string | null
          latitude: number | null
          longitude: number | null
          name: string
          nearby_station: string | null
          region: string
          school_district: string | null
          tags: string[] | null
          total_units: number | null
        }
        Insert: {
          address?: string | null
          area_m2?: string | null
          avg_jeonse_100m?: string | null
          avg_price_100m?: string | null
          blog_generated?: boolean | null
          blog_slug?: string | null
          built_year?: number | null
          created_at?: string | null
          description?: string | null
          district: string
          id?: number
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          nearby_station?: string | null
          region: string
          school_district?: string | null
          tags?: string[] | null
          total_units?: number | null
        }
        Update: {
          address?: string | null
          area_m2?: string | null
          avg_jeonse_100m?: string | null
          avg_price_100m?: string | null
          blog_generated?: boolean | null
          blog_slug?: string | null
          built_year?: number | null
          created_at?: string | null
          description?: string | null
          district?: string
          id?: number
          image_url?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          nearby_station?: string | null
          region?: string
          school_district?: string | null
          tags?: string[] | null
          total_units?: number | null
        }
        Relationships: []
      }
      marketing_publish_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          external_url: string | null
          id: number
          platform: string
          source_id: string | null
          source_type: string
          status: string
          title: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          external_url?: string | null
          id?: number
          platform: string
          source_id?: string | null
          source_type?: string
          status?: string
          title?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          external_url?: string | null
          id?: number
          platform?: string
          source_id?: string | null
          source_type?: string
          status?: string
          title?: string | null
        }
        Relationships: []
      }
      megaphones: {
        Row: {
          bg_color: string | null
          created_at: string
          ends_at: string | null
          exposure_count: number | null
          id: number
          is_active: boolean
          message: string
          nickname: string
          post_id: number | null
          purchase_id: number
          queue_position: number | null
          queue_status: string
          starts_at: string | null
          text_color: string | null
          tier: string
          used_count: number | null
          user_id: string
        }
        Insert: {
          bg_color?: string | null
          created_at?: string
          ends_at?: string | null
          exposure_count?: number | null
          id?: number
          is_active?: boolean
          message: string
          nickname: string
          post_id?: number | null
          purchase_id: number
          queue_position?: number | null
          queue_status?: string
          starts_at?: string | null
          text_color?: string | null
          tier?: string
          used_count?: number | null
          user_id: string
        }
        Update: {
          bg_color?: string | null
          created_at?: string
          ends_at?: string | null
          exposure_count?: number | null
          id?: number
          is_active?: boolean
          message?: string
          nickname?: string
          post_id?: number | null
          purchase_id?: number
          queue_position?: number | null
          queue_status?: string
          starts_at?: string | null
          text_color?: string | null
          tier?: string
          used_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "megaphones_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "megaphones_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "megaphones_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "megaphones_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "megaphones_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "megaphones_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "megaphones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      naver_syndication: {
        Row: {
          blog_post_id: number | null
          blog_slug: string
          blog_status: string | null
          cafe_article_id: string | null
          cafe_status: string | null
          category: string | null
          created_at: string | null
          id: number
          naver_html: string
          naver_tags: string[] | null
          naver_title: string
          original_title: string
          published_at: string | null
          target: string | null
        }
        Insert: {
          blog_post_id?: number | null
          blog_slug: string
          blog_status?: string | null
          cafe_article_id?: string | null
          cafe_status?: string | null
          category?: string | null
          created_at?: string | null
          id?: number
          naver_html: string
          naver_tags?: string[] | null
          naver_title: string
          original_title: string
          published_at?: string | null
          target?: string | null
        }
        Update: {
          blog_post_id?: number | null
          blog_slug?: string
          blog_status?: string | null
          cafe_article_id?: string | null
          cafe_status?: string | null
          category?: string | null
          created_at?: string | null
          id?: number
          naver_html?: string
          naver_tags?: string[] | null
          naver_title?: string
          original_title?: string
          published_at?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "naver_syndication_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          kakao_enabled: boolean | null
          push_apt_deadline: boolean | null
          push_attendance: boolean | null
          push_comments: boolean | null
          push_daily_digest: boolean | null
          push_follows: boolean | null
          push_grade_up: boolean | null
          push_hot_post: boolean | null
          push_likes: boolean | null
          push_local_new: boolean | null
          push_marketing: boolean | null
          push_news: boolean | null
          push_point: boolean | null
          push_poll_result: boolean | null
          push_predict_result: boolean | null
          push_stock_alert: boolean | null
          quiet_end: string | null
          quiet_start: string | null
          streak_alert: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          kakao_enabled?: boolean | null
          push_apt_deadline?: boolean | null
          push_attendance?: boolean | null
          push_comments?: boolean | null
          push_daily_digest?: boolean | null
          push_follows?: boolean | null
          push_grade_up?: boolean | null
          push_hot_post?: boolean | null
          push_likes?: boolean | null
          push_local_new?: boolean | null
          push_marketing?: boolean | null
          push_news?: boolean | null
          push_point?: boolean | null
          push_poll_result?: boolean | null
          push_predict_result?: boolean | null
          push_stock_alert?: boolean | null
          quiet_end?: string | null
          quiet_start?: string | null
          streak_alert?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          kakao_enabled?: boolean | null
          push_apt_deadline?: boolean | null
          push_attendance?: boolean | null
          push_comments?: boolean | null
          push_daily_digest?: boolean | null
          push_follows?: boolean | null
          push_grade_up?: boolean | null
          push_hot_post?: boolean | null
          push_likes?: boolean | null
          push_local_new?: boolean | null
          push_marketing?: boolean | null
          push_news?: boolean | null
          push_point?: boolean | null
          push_poll_result?: boolean | null
          push_predict_result?: boolean | null
          push_stock_alert?: boolean | null
          quiet_end?: string | null
          quiet_start?: string | null
          streak_alert?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string
          created_at: string
          id: number
          is_read: boolean
          link: string | null
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: number
          is_read?: boolean
          link?: string | null
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: number
          is_read?: boolean
          link?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string | null
          id: number
          path: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          path?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string | null
          id?: never
          path?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_policy: {
        Row: {
          id: number
          min_age: number | null
          privacy_officer: string
          privacy_officer_email: string
          refund_policy: string
          service_start_date: string
          updated_at: string | null
        }
        Insert: {
          id?: never
          min_age?: number | null
          privacy_officer: string
          privacy_officer_email: string
          refund_policy: string
          service_start_date: string
          updated_at?: string | null
        }
        Update: {
          id?: never
          min_age?: number | null
          privacy_officer?: string
          privacy_officer_email?: string
          refund_policy?: string
          service_start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          currency: string
          id: string
          metadata: Json | null
          order_id: string
          paid_at: string | null
          payment_key: string
          product_id: string
          provider: string
          status: string | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          order_id: string
          paid_at?: string | null
          payment_key: string
          product_id: string
          provider?: string
          status?: string | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string
          id?: string
          metadata?: Json | null
          order_id?: string
          paid_at?: string | null
          payment_key?: string
          product_id?: string
          provider?: string
          status?: string | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_posts: {
        Row: {
          created_at: string
          ends_at: string
          id: number
          is_active: boolean
          post_id: number
          purchase_id: number
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string
          id?: number
          is_active?: boolean
          post_id: number
          purchase_id: number
          starts_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: number
          is_active?: boolean
          post_id?: number
          purchase_id?: number
          starts_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_posts_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          badge_emoji: string | null
          created_at: string
          description: string | null
          features: Json
          id: string
          interval: string
          interval_count: number
          is_active: boolean
          name: string
          price: number
          price_krw: number
          slug: string
          sort_order: number
        }
        Insert: {
          badge_emoji?: string | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          interval_count?: number
          is_active?: boolean
          name: string
          price?: number
          price_krw?: number
          slug: string
          sort_order?: number
        }
        Update: {
          badge_emoji?: string | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          interval_count?: number
          is_active?: boolean
          name?: string
          price?: number
          price_krw?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      point_history: {
        Row: {
          amount: number
          created_at: string
          id: number
          meta: Json | null
          reason: Database["public"]["Enums"]["point_reason"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: number
          meta?: Json | null
          reason: Database["public"]["Enums"]["point_reason"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          meta?: Json | null
          reason?: Database["public"]["Enums"]["point_reason"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          id: number
          label: string
          poll_id: number
          sort_order: number | null
        }
        Insert: {
          id?: number
          label: string
          poll_id: number
          sort_order?: number | null
        }
        Update: {
          id?: number
          label?: string
          poll_id?: number
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "post_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string | null
          id: number
          option_id: number
          poll_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          option_id: number
          poll_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          option_id?: number
          poll_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "post_polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      popup_ads: {
        Row: {
          click_count: number | null
          content: string | null
          created_at: string | null
          current_impressions: number | null
          dismiss_duration_hours: number | null
          display_type: string | null
          end_date: string | null
          id: number
          image_url: string | null
          is_active: boolean | null
          link_label: string | null
          link_url: string | null
          max_impressions: number | null
          position: string | null
          priority: number | null
          start_date: string
          target_pages: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          click_count?: number | null
          content?: string | null
          created_at?: string | null
          current_impressions?: number | null
          dismiss_duration_hours?: number | null
          display_type?: string | null
          end_date?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          link_label?: string | null
          link_url?: string | null
          max_impressions?: number | null
          position?: string | null
          priority?: number | null
          start_date?: string
          target_pages?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          click_count?: number | null
          content?: string | null
          created_at?: string | null
          current_impressions?: number | null
          dismiss_duration_hours?: number | null
          display_type?: string | null
          end_date?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          link_label?: string | null
          link_url?: string | null
          max_impressions?: number | null
          position?: string | null
          priority?: number | null
          start_date?: string
          target_pages?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      portfolio_holdings: {
        Row: {
          buy_date: string | null
          buy_price: number
          created_at: string | null
          id: string
          memo: string | null
          quantity: number
          symbol: string
          user_id: string
        }
        Insert: {
          buy_date?: string | null
          buy_price: number
          created_at?: string | null
          id?: string
          memo?: string | null
          quantity?: number
          symbol: string
          user_id: string
        }
        Update: {
          buy_date?: string | null
          buy_price?: number
          created_at?: string | null
          id?: string
          memo?: string | null
          quantity?: number
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_holdings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          created_at: string | null
          holding_count: number
          id: string
          pnl_pct: number
          snapshot_date: string
          total_current: number
          total_invested: number
          total_pnl: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          holding_count?: number
          id?: string
          pnl_pct?: number
          snapshot_date?: string
          total_current?: number
          total_invested?: number
          total_pnl?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          holding_count?: number
          id?: string
          pnl_pct?: number
          snapshot_date?: string
          total_current?: number
          total_invested?: number
          total_pnl?: number
          user_id?: string
        }
        Relationships: []
      }
      post_downvotes: {
        Row: {
          created_at: string
          post_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_downvotes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_downvotes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_downvotes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_downvotes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_downvotes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_downvotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_poll_votes: {
        Row: {
          created_at: string
          id: number
          option_index: number
          poll_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          option_index: number
          poll_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          option_index?: number
          poll_id?: number
          user_id?: string
        }
        Relationships: []
      }
      post_polls: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: number
          post_id: number
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: number
          post_id: number
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: number
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string | null
          id: number
          post_id: number
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: never
          post_id: number
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: never
          post_id?: number
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          ai_summary: string | null
          apt_tags: string[]
          author_id: string | null
          bookmarks_count: number
          category: string
          city: string
          comments_count: number
          content: string
          created_at: string
          downvotes_count: number
          excerpt: string | null
          fts: unknown
          hashtags: string[] | null
          id: number
          images: string[]
          is_anonymous: boolean
          is_deleted: boolean
          is_hidden: boolean | null
          is_pinned: boolean
          likes_count: number
          post_type: string | null
          region_id: string
          report_count: number
          room_id: number | null
          slug: string | null
          stock_tags: string[]
          tag: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          ai_summary?: string | null
          apt_tags?: string[]
          author_id?: string | null
          bookmarks_count?: number
          category: string
          city?: string
          comments_count?: number
          content: string
          created_at?: string
          downvotes_count?: number
          excerpt?: string | null
          fts?: unknown
          hashtags?: string[] | null
          id?: number
          images?: string[]
          is_anonymous?: boolean
          is_deleted?: boolean
          is_hidden?: boolean | null
          is_pinned?: boolean
          likes_count?: number
          post_type?: string | null
          region_id: string
          report_count?: number
          room_id?: number | null
          slug?: string | null
          stock_tags?: string[]
          tag?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          ai_summary?: string | null
          apt_tags?: string[]
          author_id?: string | null
          bookmarks_count?: number
          category?: string
          city?: string
          comments_count?: number
          content?: string
          created_at?: string
          downvotes_count?: number
          excerpt?: string | null
          fts?: unknown
          hashtags?: string[] | null
          id?: number
          images?: string[]
          is_anonymous?: boolean
          is_deleted?: boolean
          is_hidden?: boolean | null
          is_pinned?: boolean
          likes_count?: number
          post_type?: string | null
          region_id?: string
          report_count?: number
          room_id?: number | null
          slug?: string | null
          stock_tags?: string[]
          tag?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "discussion_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hot_discussion_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_votes: {
        Row: {
          agree: boolean
          created_at: string | null
          id: number
          prediction_id: number
          user_id: string
        }
        Insert: {
          agree: boolean
          created_at?: string | null
          id?: number
          prediction_id: number
          user_id: string
        }
        Update: {
          agree?: boolean
          created_at?: string | null
          id?: number
          prediction_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_votes_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          created_at: string | null
          deadline: string
          direction: string
          id: number
          post_id: number
          resolved: boolean | null
          result: boolean | null
          target: string
        }
        Insert: {
          created_at?: string | null
          deadline: string
          direction: string
          id?: number
          post_id: number
          resolved?: boolean | null
          result?: boolean | null
          target: string
        }
        Update: {
          created_at?: string | null
          deadline?: string
          direction?: string
          id?: number
          post_id?: number
          resolved?: boolean | null
          result?: boolean | null
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_listings: {
        Row: {
          clicks: number | null
          consultant_id: string
          created_at: string | null
          cta_clicks: number | null
          cta_kakao: string | null
          cta_phone: string | null
          cta_text: string | null
          description: string | null
          expires_at: string
          house_nm: string | null
          id: string
          images: string[] | null
          impressions: number | null
          is_active: boolean | null
          listing_id: string
          listing_type: string
          payment_id: string | null
          phone_clicks: number | null
          price_paid: number | null
          region_nm: string | null
          starts_at: string
          tier: string
          updated_at: string | null
        }
        Insert: {
          clicks?: number | null
          consultant_id: string
          created_at?: string | null
          cta_clicks?: number | null
          cta_kakao?: string | null
          cta_phone?: string | null
          cta_text?: string | null
          description?: string | null
          expires_at: string
          house_nm?: string | null
          id?: string
          images?: string[] | null
          impressions?: number | null
          is_active?: boolean | null
          listing_id: string
          listing_type: string
          payment_id?: string | null
          phone_clicks?: number | null
          price_paid?: number | null
          region_nm?: string | null
          starts_at?: string
          tier?: string
          updated_at?: string | null
        }
        Update: {
          clicks?: number | null
          consultant_id?: string
          created_at?: string | null
          cta_clicks?: number | null
          cta_kakao?: string | null
          cta_phone?: string | null
          cta_text?: string | null
          description?: string | null
          expires_at?: string
          house_nm?: string | null
          id?: string
          images?: string[] | null
          impressions?: number | null
          is_active?: boolean | null
          listing_id?: string
          listing_type?: string
          payment_id?: string | null
          phone_clicks?: number | null
          price_paid?: number | null
          region_nm?: string | null
          starts_at?: string
          tier?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_listings_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultant_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_alerts: {
        Row: {
          alert_type: string
          condition: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_triggered: boolean | null
          last_checked_at: string | null
          target_apt_id: number | null
          target_symbol: string | null
          threshold: number | null
          triggered_at: string | null
          user_id: string
        }
        Insert: {
          alert_type: string
          condition: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_triggered?: boolean | null
          last_checked_at?: string | null
          target_apt_id?: number | null
          target_symbol?: string | null
          threshold?: number | null
          triggered_at?: string | null
          user_id: string
        }
        Update: {
          alert_type?: string
          condition?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_triggered?: boolean | null
          last_checked_at?: string | null
          target_apt_id?: number | null
          target_symbol?: string | null
          threshold?: number | null
          triggered_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string | null
          created_at: string | null
          detail: Json | null
          id: number
          ip_address: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string | null
          detail?: Json | null
          id?: number
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string | null
          detail?: Json | null
          id?: number
          ip_address?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_consents: {
        Row: {
          collected_items: string[] | null
          consent_text: string | null
          consent_type: string
          consent_version: string
          consented_at: string | null
          created_at: string | null
          guest_identifier: string | null
          id: number
          ip_address: string | null
          is_agreed: boolean
          purpose: string | null
          retention_period: string | null
          user_agent: string | null
          user_id: string | null
          withdrawn_at: string | null
        }
        Insert: {
          collected_items?: string[] | null
          consent_text?: string | null
          consent_type: string
          consent_version?: string
          consented_at?: string | null
          created_at?: string | null
          guest_identifier?: string | null
          id?: number
          ip_address?: string | null
          is_agreed: boolean
          purpose?: string | null
          retention_period?: string | null
          user_agent?: string | null
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          collected_items?: string[] | null
          consent_text?: string | null
          consent_type?: string
          consent_version?: string
          consented_at?: string | null
          created_at?: string | null
          guest_identifier?: string | null
          id?: number
          ip_address?: string | null
          is_agreed?: boolean
          purpose?: string | null
          retention_period?: string | null
          user_agent?: string | null
          user_id?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age_group: string | null
          age_verified: boolean | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          birth_year: number | null
          consent_analytics: boolean | null
          consent_updated_at: string | null
          created_at: string
          deleted_at: string | null
          first_mission_completed: boolean | null
          first_mission_progress: Json | null
          followers_count: number
          following_count: number
          font_size_preference: string | null
          full_name: string | null
          gender: string | null
          google_email: string | null
          grade: number
          grade_title: string
          id: string
          influence_score: number
          interests: string[] | null
          is_admin: boolean | null
          is_banned: boolean | null
          is_deleted: boolean | null
          is_ghost: boolean | null
          is_premium: boolean
          is_seed: boolean | null
          kakao_id: string | null
          last_active_at: string | null
          last_checked_date: string | null
          likes_count: number
          marketing_agreed: boolean | null
          marketing_agreed_at: string | null
          nickname: string
          nickname_change_count: number
          nickname_change_tickets: number
          nickname_set: boolean
          onboarded: boolean | null
          onboarding_method: string | null
          phone: string | null
          points: number
          posts_count: number
          premium_expires_at: string | null
          privacy_agreed_at: string | null
          profile_completed: boolean
          profile_completion_rewarded: boolean | null
          provider: string | null
          region_text: string | null
          residence_city: string | null
          residence_district: string | null
          signup_return_url: string | null
          signup_source: string | null
          streak_days: number
          terms_agreed_at: string | null
          updated_at: string
          zodiac_animal: string | null
        }
        Insert: {
          age_group?: string | null
          age_verified?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          birth_year?: number | null
          consent_analytics?: boolean | null
          consent_updated_at?: string | null
          created_at?: string
          deleted_at?: string | null
          first_mission_completed?: boolean | null
          first_mission_progress?: Json | null
          followers_count?: number
          following_count?: number
          font_size_preference?: string | null
          full_name?: string | null
          gender?: string | null
          google_email?: string | null
          grade?: number
          grade_title?: string
          id: string
          influence_score?: number
          interests?: string[] | null
          is_admin?: boolean | null
          is_banned?: boolean | null
          is_deleted?: boolean | null
          is_ghost?: boolean | null
          is_premium?: boolean
          is_seed?: boolean | null
          kakao_id?: string | null
          last_active_at?: string | null
          last_checked_date?: string | null
          likes_count?: number
          marketing_agreed?: boolean | null
          marketing_agreed_at?: string | null
          nickname: string
          nickname_change_count?: number
          nickname_change_tickets?: number
          nickname_set?: boolean
          onboarded?: boolean | null
          onboarding_method?: string | null
          phone?: string | null
          points?: number
          posts_count?: number
          premium_expires_at?: string | null
          privacy_agreed_at?: string | null
          profile_completed?: boolean
          profile_completion_rewarded?: boolean | null
          provider?: string | null
          region_text?: string | null
          residence_city?: string | null
          residence_district?: string | null
          signup_return_url?: string | null
          signup_source?: string | null
          streak_days?: number
          terms_agreed_at?: string | null
          updated_at?: string
          zodiac_animal?: string | null
        }
        Update: {
          age_group?: string | null
          age_verified?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          birth_year?: number | null
          consent_analytics?: boolean | null
          consent_updated_at?: string | null
          created_at?: string
          deleted_at?: string | null
          first_mission_completed?: boolean | null
          first_mission_progress?: Json | null
          followers_count?: number
          following_count?: number
          font_size_preference?: string | null
          full_name?: string | null
          gender?: string | null
          google_email?: string | null
          grade?: number
          grade_title?: string
          id?: string
          influence_score?: number
          interests?: string[] | null
          is_admin?: boolean | null
          is_banned?: boolean | null
          is_deleted?: boolean | null
          is_ghost?: boolean | null
          is_premium?: boolean
          is_seed?: boolean | null
          kakao_id?: string | null
          last_active_at?: string | null
          last_checked_date?: string | null
          likes_count?: number
          marketing_agreed?: boolean | null
          marketing_agreed_at?: string | null
          nickname?: string
          nickname_change_count?: number
          nickname_change_tickets?: number
          nickname_set?: boolean
          onboarded?: boolean | null
          onboarding_method?: string | null
          phone?: string | null
          points?: number
          posts_count?: number
          premium_expires_at?: string | null
          privacy_agreed_at?: string | null
          profile_completed?: boolean
          profile_completion_rewarded?: boolean | null
          provider?: string | null
          region_text?: string | null
          residence_city?: string | null
          residence_district?: string | null
          signup_return_url?: string | null
          signup_source?: string | null
          streak_days?: number
          terms_agreed_at?: string | null
          updated_at?: string
          zodiac_animal?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_krw: number
          created_at: string
          id: number
          meta: Json | null
          order_id: string | null
          payment_key: string | null
          product_id: string
          status: string
          updated_at: string | null
          used: boolean
          used_at: string | null
          user_id: string
        }
        Insert: {
          amount_krw: number
          created_at?: string
          id?: number
          meta?: Json | null
          order_id?: string | null
          payment_key?: string | null
          product_id: string
          status?: string
          updated_at?: string | null
          used?: boolean
          used_at?: string | null
          user_id: string
        }
        Update: {
          amount_krw?: number
          created_at?: string
          id?: number
          meta?: Json | null
          order_id?: string | null
          payment_key?: string | null
          product_id?: string
          status?: string
          updated_at?: string | null
          used?: boolean
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_logs: {
        Row: {
          body: string
          click_count: number | null
          created_at: string | null
          id: number
          sent_count: number | null
          target: string | null
          title: string
          url: string | null
        }
        Insert: {
          body: string
          click_count?: number | null
          created_at?: string | null
          id?: number
          sent_count?: number | null
          target?: string | null
          title: string
          url?: string | null
        }
        Update: {
          body?: string
          click_count?: number | null
          created_at?: string | null
          id?: number
          sent_count?: number | null
          target?: string | null
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string | null
          endpoint: string
          id: number
          p256dh: string | null
          updated_at: string | null
          user_id: string
          visitor_id: string | null
        }
        Insert: {
          auth?: string | null
          created_at?: string | null
          endpoint: string
          id?: number
          p256dh?: string | null
          updated_at?: string | null
          user_id: string
          visitor_id?: string | null
        }
        Update: {
          auth?: string | null
          created_at?: string | null
          endpoint?: string
          id?: number
          p256dh?: string | null
          updated_at?: string | null
          user_id?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      pwa_installs: {
        Row: {
          id: number
          installed_at: string | null
          platform: string | null
          region_text: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          id?: number
          installed_at?: string | null
          platform?: string | null
          region_text?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          id?: number
          installed_at?: string | null
          platform?: string | null
          region_text?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pwa_installs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      redevelopment_projects: {
        Row: {
          address: string | null
          ai_summary: string | null
          approval_date: string | null
          area_sqm: number | null
          building_coverage: number | null
          constructor: string | null
          created_at: string | null
          developer: string | null
          district_name: string
          estimated_move_in: string | null
          expected_completion: string | null
          floor_area_ratio: number | null
          id: number
          is_active: boolean | null
          key_features: string | null
          land_area: number | null
          latitude: number | null
          longitude: number | null
          max_floor: number | null
          nearest_school: string | null
          nearest_station: string | null
          notes: string | null
          project_type: string
          region: string
          sigungu: string | null
          source: string | null
          stage: string
          summary: string | null
          total_dong: number | null
          total_households: number | null
          transfer_limit: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          ai_summary?: string | null
          approval_date?: string | null
          area_sqm?: number | null
          building_coverage?: number | null
          constructor?: string | null
          created_at?: string | null
          developer?: string | null
          district_name: string
          estimated_move_in?: string | null
          expected_completion?: string | null
          floor_area_ratio?: number | null
          id?: never
          is_active?: boolean | null
          key_features?: string | null
          land_area?: number | null
          latitude?: number | null
          longitude?: number | null
          max_floor?: number | null
          nearest_school?: string | null
          nearest_station?: string | null
          notes?: string | null
          project_type: string
          region: string
          sigungu?: string | null
          source?: string | null
          stage: string
          summary?: string | null
          total_dong?: number | null
          total_households?: number | null
          transfer_limit?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          ai_summary?: string | null
          approval_date?: string | null
          area_sqm?: number | null
          building_coverage?: number | null
          constructor?: string | null
          created_at?: string | null
          developer?: string | null
          district_name?: string
          estimated_move_in?: string | null
          expected_completion?: string | null
          floor_area_ratio?: number | null
          id?: never
          is_active?: boolean | null
          key_features?: string | null
          land_area?: number | null
          latitude?: number | null
          longitude?: number | null
          max_floor?: number | null
          nearest_school?: string | null
          nearest_station?: string | null
          notes?: string | null
          project_type?: string
          region?: string
          sigungu?: string | null
          source?: string | null
          stage?: string
          summary?: string | null
          total_dong?: number | null
          total_households?: number | null
          transfer_limit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      redevelopment_zones: {
        Row: {
          blog_generated: boolean | null
          blog_slug: string | null
          contractors: string | null
          created_at: string | null
          description: string | null
          district: string
          estimated_contribution: string | null
          existing_units: number | null
          expected_completion: string | null
          id: number
          investment_point: string | null
          latitude: number | null
          longitude: number | null
          nearby_station: string | null
          original_complex: string | null
          planned_units: number | null
          progress_stage: string | null
          region: string
          tags: string[] | null
          zone_area_m2: number | null
          zone_name: string
          zone_type: string
        }
        Insert: {
          blog_generated?: boolean | null
          blog_slug?: string | null
          contractors?: string | null
          created_at?: string | null
          description?: string | null
          district: string
          estimated_contribution?: string | null
          existing_units?: number | null
          expected_completion?: string | null
          id?: number
          investment_point?: string | null
          latitude?: number | null
          longitude?: number | null
          nearby_station?: string | null
          original_complex?: string | null
          planned_units?: number | null
          progress_stage?: string | null
          region: string
          tags?: string[] | null
          zone_area_m2?: number | null
          zone_name: string
          zone_type: string
        }
        Update: {
          blog_generated?: boolean | null
          blog_slug?: string | null
          contractors?: string | null
          created_at?: string | null
          description?: string | null
          district?: string
          estimated_contribution?: string | null
          existing_units?: number | null
          expected_completion?: string | null
          id?: number
          investment_point?: string | null
          latitude?: number | null
          longitude?: number | null
          nearby_station?: string | null
          original_complex?: string | null
          planned_units?: number | null
          progress_stage?: string | null
          region?: string
          tags?: string[] | null
          zone_area_m2?: number | null
          zone_name?: string
          zone_type?: string
        }
        Relationships: []
      }
      report_logs: {
        Row: {
          created_at: string | null
          id: number
          reason: string | null
          reporter_id: string
          target_id: number
          target_type: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          reason?: string | null
          reporter_id: string
          target_id: number
          target_type: string
        }
        Update: {
          created_at?: string | null
          id?: number
          reason?: string | null
          reporter_id?: string
          target_id?: number
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_logs_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          auto_hidden: boolean | null
          comment_id: number | null
          content_type: string | null
          created_at: string
          details: string | null
          id: number
          message_id: number | null
          post_id: number | null
          reason: string | null
          reporter_id: string
          review_id: string | null
          status: string | null
        }
        Insert: {
          auto_hidden?: boolean | null
          comment_id?: number | null
          content_type?: string | null
          created_at?: string
          details?: string | null
          id?: number
          message_id?: number | null
          post_id?: number | null
          reason?: string | null
          reporter_id: string
          review_id?: string | null
          status?: string | null
        }
        Update: {
          auto_hidden?: boolean | null
          comment_id?: number | null
          content_type?: string | null
          created_at?: string
          details?: string | null
          id?: number
          message_id?: number | null
          post_id?: number | null
          reason?: string | null
          reporter_id?: string
          review_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "apt_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      rewrite_batches: {
        Row: {
          batch_id: string
          batch_size: number | null
          category: string | null
          completed_at: string | null
          cost_estimate: number | null
          created_at: string | null
          failed: number | null
          id: number
          post_ids: Json
          result_summary: Json | null
          status: string | null
          succeeded: number | null
        }
        Insert: {
          batch_id: string
          batch_size?: number | null
          category?: string | null
          completed_at?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          failed?: number | null
          id?: number
          post_ids?: Json
          result_summary?: Json | null
          status?: string | null
          succeeded?: number | null
        }
        Update: {
          batch_id?: string
          batch_size?: number | null
          category?: string | null
          completed_at?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          failed?: number | null
          id?: number
          post_ids?: Json
          result_summary?: Json | null
          status?: string | null
          succeeded?: number | null
        }
        Relationships: []
      }
      room_subscriptions: {
        Row: {
          created_at: string
          room_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          room_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          room_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_subscriptions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "discussion_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_subscriptions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hot_discussion_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_feed_posts: {
        Row: {
          created_at: string | null
          id: string
          is_published: boolean | null
          issue_id: string | null
          persona_type: string
          persona_user_id: string | null
          published_post_id: string | null
          scheduled_at: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          issue_id?: string | null
          persona_type: string
          persona_user_id?: string | null
          published_post_id?: string | null
          scheduled_at: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          issue_id?: string | null
          persona_type?: string
          persona_user_id?: string | null
          published_post_id?: string | null
          scheduled_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_feed_posts_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          clicked_rank: number | null
          created_at: string | null
          id: string
          query: string
          results_count: number | null
          user_id: string | null
        }
        Insert: {
          clicked_rank?: number | null
          created_at?: string | null
          id?: string
          query: string
          results_count?: number | null
          user_id?: string | null
        }
        Update: {
          clicked_rank?: number | null
          created_at?: string | null
          id?: string
          query?: string
          results_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_logs: {
        Row: {
          content_ref: string | null
          content_type: string | null
          created_at: string | null
          id: number
          platform: string
          post_id: number | null
          user_id: string | null
        }
        Insert: {
          content_ref?: string | null
          content_type?: string | null
          created_at?: string | null
          id?: never
          platform: string
          post_id?: number | null
          user_id?: string | null
        }
        Update: {
          content_ref?: string | null
          content_type?: string | null
          created_at?: string | null
          id?: never
          platform?: string
          post_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          amount: number
          approved_at: string | null
          created_at: string | null
          id: string
          method: string | null
          order_id: string
          payment_key: string | null
          product_id: string | null
          raw_response: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          created_at?: string | null
          id?: string
          method?: string | null
          order_id: string
          payment_key?: string | null
          product_id?: string | null
          raw_response?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          created_at?: string | null
          id?: string
          method?: string | null
          order_id?: string
          payment_key?: string | null
          product_id?: string | null
          raw_response?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_products: {
        Row: {
          category: string | null
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          is_popular: boolean | null
          name: string
          point_price: number | null
          price_krw: number
          purchase_type: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          icon?: string
          id: string
          is_active?: boolean
          is_popular?: boolean | null
          name: string
          point_price?: number | null
          price_krw: number
          purchase_type?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          is_popular?: boolean | null
          name?: string
          point_price?: number | null
          price_krw?: number
          purchase_type?: string | null
        }
        Relationships: []
      }
      signup_attempts: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: number
          ip_hash: string | null
          onboarding_skipped: boolean | null
          provider: string
          redirect_path: string | null
          source: string | null
          success: boolean | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: never
          ip_hash?: string | null
          onboarding_skipped?: boolean | null
          provider: string
          redirect_path?: string | null
          source?: string | null
          success?: boolean | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: never
          ip_hash?: string | null
          onboarding_skipped?: boolean | null
          provider?: string
          redirect_path?: string | null
          source?: string | null
          success?: boolean | null
          user_agent?: string | null
        }
        Relationships: []
      }
      site_notices: {
        Row: {
          author_id: string | null
          bg_color: string | null
          click_count: number | null
          content: string
          created_at: string | null
          display_end: string | null
          display_start: string | null
          id: number
          impression_count: number | null
          is_active: boolean | null
          is_paid: boolean | null
          link_url: string | null
          linked_post_id: number | null
          max_impressions: number | null
          priority: number | null
          purchase_id: number | null
          text_color: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          bg_color?: string | null
          click_count?: number | null
          content: string
          created_at?: string | null
          display_end?: string | null
          display_start?: string | null
          id?: number
          impression_count?: number | null
          is_active?: boolean | null
          is_paid?: boolean | null
          link_url?: string | null
          linked_post_id?: number | null
          max_impressions?: number | null
          priority?: number | null
          purchase_id?: number | null
          text_color?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          bg_color?: string | null
          click_count?: number | null
          content?: string
          created_at?: string | null
          display_end?: string | null
          display_start?: string | null
          id?: number
          impression_count?: number | null
          is_active?: boolean | null
          is_paid?: boolean | null
          link_url?: string | null
          linked_post_id?: number | null
          max_impressions?: number | null
          priority?: number | null
          purchase_id?: number | null
          text_color?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_notices_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ai_analysis: {
        Row: {
          analysis: Json
          created_at: string
          id: number
          stock_name: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          created_at?: string
          id?: number
          stock_name?: string | null
          symbol: string
          user_id: string
        }
        Update: {
          analysis?: Json
          created_at?: string
          id?: number
          stock_name?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_ai_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: number
          signal: string | null
          symbol: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: number
          signal?: string | null
          symbol: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: number
          signal?: string | null
          symbol?: string
        }
        Relationships: []
      }
      stock_comment_likes: {
        Row: {
          author_id: string | null
          comment_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          author_id?: string | null
          comment_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          author_id?: string | null
          comment_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "stock_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_comment_likes_user_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_comment_reactions: {
        Row: {
          author_id: string | null
          comment_id: string | null
          created_at: string | null
          emoji: string
          id: string
        }
        Insert: {
          author_id?: string | null
          comment_id?: string | null
          created_at?: string | null
          emoji: string
          id?: string
        }
        Update: {
          author_id?: string | null
          comment_id?: string | null
          created_at?: string | null
          emoji?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "stock_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_comment_reactions_user_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_comments: {
        Row: {
          author_id: string | null
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          parent_id: string | null
          replies_count: number | null
          symbol: string
        }
        Insert: {
          author_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          parent_id?: string | null
          replies_count?: number | null
          symbol: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          parent_id?: string | null
          replies_count?: number | null
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "stock_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_comments_user_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_comparisons: {
        Row: {
          author_id: string | null
          created_at: string | null
          id: number
          symbols: string[]
          title: string | null
        }
        Insert: {
          author_id?: string | null
          created_at?: string | null
          id?: number
          symbols: string[]
          title?: string | null
        }
        Update: {
          author_id?: string | null
          created_at?: string | null
          id?: number
          symbols?: string[]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_comparisons_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_daily_briefing: {
        Row: {
          briefing_date: string
          created_at: string | null
          id: string
          key_movers: Json | null
          market: string
          metadata: Json | null
          sector_analysis: Json | null
          sentiment: string | null
          summary: string
          title: string
        }
        Insert: {
          briefing_date?: string
          created_at?: string | null
          id?: string
          key_movers?: Json | null
          market?: string
          metadata?: Json | null
          sector_analysis?: Json | null
          sentiment?: string | null
          summary: string
          title: string
        }
        Update: {
          briefing_date?: string
          created_at?: string | null
          id?: string
          key_movers?: Json | null
          market?: string
          metadata?: Json | null
          sector_analysis?: Json | null
          sentiment?: string | null
          summary?: string
          title?: string
        }
        Relationships: []
      }
      stock_disclosures: {
        Row: {
          created_at: string | null
          disclosure_type: string | null
          id: number
          published_at: string | null
          source: string | null
          symbol: string
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          disclosure_type?: string | null
          id?: number
          published_at?: string | null
          source?: string | null
          symbol: string
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          disclosure_type?: string | null
          id?: number
          published_at?: string | null
          source?: string | null
          symbol?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      stock_investor_flow: {
        Row: {
          created_at: string | null
          date: string
          foreign_buy: number | null
          foreign_sell: number | null
          id: number
          inst_buy: number | null
          inst_sell: number | null
          retail_buy: number | null
          retail_sell: number | null
          symbol: string
        }
        Insert: {
          created_at?: string | null
          date: string
          foreign_buy?: number | null
          foreign_sell?: number | null
          id?: number
          inst_buy?: number | null
          inst_sell?: number | null
          retail_buy?: number | null
          retail_sell?: number | null
          symbol: string
        }
        Update: {
          created_at?: string | null
          date?: string
          foreign_buy?: number | null
          foreign_sell?: number | null
          id?: number
          inst_buy?: number | null
          inst_sell?: number | null
          retail_buy?: number | null
          retail_sell?: number | null
          symbol?: string
        }
        Relationships: []
      }
      stock_news: {
        Row: {
          ai_summary: string | null
          created_at: string | null
          id: number
          published_at: string | null
          sentiment: string | null
          sentiment_label: string | null
          sentiment_score: number | null
          source: string | null
          symbol: string
          title: string
          url: string | null
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string | null
          id?: number
          published_at?: string | null
          sentiment?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          source?: string | null
          symbol: string
          title: string
          url?: string | null
        }
        Update: {
          ai_summary?: string | null
          created_at?: string | null
          id?: number
          published_at?: string | null
          sentiment?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          source?: string | null
          symbol?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      stock_price_history: {
        Row: {
          change_pct: number | null
          close_price: number
          created_at: string | null
          date: string
          high_price: number | null
          id: number
          low_price: number | null
          open_price: number | null
          symbol: string
          volume: number | null
        }
        Insert: {
          change_pct?: number | null
          close_price: number
          created_at?: string | null
          date: string
          high_price?: number | null
          id?: number
          low_price?: number | null
          open_price?: number | null
          symbol: string
          volume?: number | null
        }
        Update: {
          change_pct?: number | null
          close_price?: number
          created_at?: string | null
          date?: string
          high_price?: number | null
          id?: number
          low_price?: number | null
          open_price?: number | null
          symbol?: string
          volume?: number | null
        }
        Relationships: []
      }
      stock_quotes: {
        Row: {
          analysis_generated_at: string | null
          analysis_text: string | null
          change_amt: number | null
          change_pct: number | null
          comment_count: number
          currency: string | null
          data_quality_score: number | null
          description: string | null
          dividend_yield: number | null
          eps: number | null
          fundamentals_updated_at: string | null
          high_52w: number | null
          is_active: boolean | null
          logo_url: string | null
          low_52w: number | null
          market: string
          market_cap: number | null
          name: string
          page_views: number
          pbr: number | null
          per: number | null
          price: number | null
          roe: number | null
          sector: string | null
          symbol: string
          ticker: string | null
          updated_at: string
          volume: number | null
          website: string | null
        }
        Insert: {
          analysis_generated_at?: string | null
          analysis_text?: string | null
          change_amt?: number | null
          change_pct?: number | null
          comment_count?: number
          currency?: string | null
          data_quality_score?: number | null
          description?: string | null
          dividend_yield?: number | null
          eps?: number | null
          fundamentals_updated_at?: string | null
          high_52w?: number | null
          is_active?: boolean | null
          logo_url?: string | null
          low_52w?: number | null
          market: string
          market_cap?: number | null
          name: string
          page_views?: number
          pbr?: number | null
          per?: number | null
          price?: number | null
          roe?: number | null
          sector?: string | null
          symbol: string
          ticker?: string | null
          updated_at?: string
          volume?: number | null
          website?: string | null
        }
        Update: {
          analysis_generated_at?: string | null
          analysis_text?: string | null
          change_amt?: number | null
          change_pct?: number | null
          comment_count?: number
          currency?: string | null
          data_quality_score?: number | null
          description?: string | null
          dividend_yield?: number | null
          eps?: number | null
          fundamentals_updated_at?: string | null
          high_52w?: number | null
          is_active?: boolean | null
          logo_url?: string | null
          low_52w?: number | null
          market?: string
          market_cap?: number | null
          name?: string
          page_views?: number
          pbr?: number | null
          per?: number | null
          price?: number | null
          roe?: number | null
          sector?: string | null
          symbol?: string
          ticker?: string | null
          updated_at?: string
          volume?: number | null
          website?: string | null
        }
        Relationships: []
      }
      stock_theme_history: {
        Row: {
          avg_change_rate: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          recorded_date: string
          theme_name: string
          top_stocks: Json | null
        }
        Insert: {
          avg_change_rate?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          recorded_date?: string
          theme_name: string
          top_stocks?: Json | null
        }
        Update: {
          avg_change_rate?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          recorded_date?: string
          theme_name?: string
          top_stocks?: Json | null
        }
        Relationships: []
      }
      stock_themes: {
        Row: {
          change_pct: number | null
          created_at: string | null
          date: string | null
          description: string | null
          id: number
          is_hot: boolean | null
          related_symbols: string[] | null
          theme_name: string
        }
        Insert: {
          change_pct?: number | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: number
          is_hot?: boolean | null
          related_symbols?: string[] | null
          theme_name: string
        }
        Update: {
          change_pct?: number | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: number
          is_hot?: boolean | null
          related_symbols?: string[] | null
          theme_name?: string
        }
        Relationships: []
      }
      stock_watchlist: {
        Row: {
          alert_threshold: number | null
          created_at: string | null
          id: number
          symbol: string
          user_id: string
        }
        Insert: {
          alert_threshold?: number | null
          created_at?: string | null
          id?: number
          symbol: string
          user_id: string
        }
        Update: {
          alert_threshold?: number | null
          created_at?: string | null
          id?: number
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_schedules: {
        Row: {
          announce_date: string | null
          apply_end: string | null
          apply_start: string | null
          apt_name: string
          city: string | null
          created_at: string
          district: string | null
          id: number
          is_hot: boolean
          location: string
          move_in_date: string | null
          price_range: string | null
          source_url: string | null
          special_supply_date: string | null
          supply_count: number | null
        }
        Insert: {
          announce_date?: string | null
          apply_end?: string | null
          apply_start?: string | null
          apt_name: string
          city?: string | null
          created_at?: string
          district?: string | null
          id?: never
          is_hot?: boolean
          location: string
          move_in_date?: string | null
          price_range?: string | null
          source_url?: string | null
          special_supply_date?: string | null
          supply_count?: number | null
        }
        Update: {
          announce_date?: string | null
          apply_end?: string | null
          apply_start?: string | null
          apt_name?: string
          city?: string | null
          created_at?: string
          district?: string | null
          id?: never
          is_hot?: boolean
          location?: string
          move_in_date?: string | null
          price_range?: string | null
          source_url?: string | null
          special_supply_date?: string | null
          supply_count?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end: string
          current_period_start?: string
          id?: string
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          id: number
          row_count: number | null
          synced_at: string
          target: string
        }
        Insert: {
          id?: number
          row_count?: number | null
          synced_at?: string
          target: string
        }
        Update: {
          id?: number
          row_count?: number | null
          synced_at?: string
          target?: string
        }
        Relationships: []
      }
      trending_keywords: {
        Row: {
          category: string | null
          heat_score: number | null
          id: string
          keyword: string
          rank: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          heat_score?: number | null
          id?: string
          keyword: string
          rank?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          heat_score?: number | null
          id?: string
          keyword?: string
          rank?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      unsold_apts: {
        Row: {
          ai_summary: string | null
          completion_ym: string | null
          constructor_nm: string | null
          contact_tel: string | null
          created_at: string | null
          developer_nm: string | null
          discount_info: string | null
          fetched_at: string | null
          house_nm: string
          id: number
          is_active: boolean | null
          key_features: string | null
          latitude: number | null
          longitude: number | null
          nearest_station: string | null
          pblanc_url: string | null
          price_per_pyeong: number | null
          region_nm: string
          sale_price_max: number | null
          sale_price_min: number | null
          sigungu_nm: string | null
          source: string | null
          supply_addr: string | null
          tot_supply_hshld_co: number | null
          tot_unsold_hshld_co: number | null
          updated_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          completion_ym?: string | null
          constructor_nm?: string | null
          contact_tel?: string | null
          created_at?: string | null
          developer_nm?: string | null
          discount_info?: string | null
          fetched_at?: string | null
          house_nm: string
          id?: number
          is_active?: boolean | null
          key_features?: string | null
          latitude?: number | null
          longitude?: number | null
          nearest_station?: string | null
          pblanc_url?: string | null
          price_per_pyeong?: number | null
          region_nm: string
          sale_price_max?: number | null
          sale_price_min?: number | null
          sigungu_nm?: string | null
          source?: string | null
          supply_addr?: string | null
          tot_supply_hshld_co?: number | null
          tot_unsold_hshld_co?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          completion_ym?: string | null
          constructor_nm?: string | null
          contact_tel?: string | null
          created_at?: string | null
          developer_nm?: string | null
          discount_info?: string | null
          fetched_at?: string | null
          house_nm?: string
          id?: number
          is_active?: boolean | null
          key_features?: string | null
          latitude?: number | null
          longitude?: number | null
          nearest_station?: string | null
          pblanc_url?: string | null
          price_per_pyeong?: number | null
          region_nm?: string
          sale_price_max?: number | null
          sale_price_min?: number | null
          sigungu_nm?: string | null
          source?: string | null
          supply_addr?: string | null
          tot_supply_hshld_co?: number | null
          tot_unsold_hshld_co?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      unsold_apts_history: {
        Row: {
          avg_price_max: number | null
          avg_price_min: number | null
          created_at: string | null
          id: number
          region_nm: string
          sigungu_nm: string | null
          snapshot_month: string
          total_supply: number | null
          total_unsold: number | null
        }
        Insert: {
          avg_price_max?: number | null
          avg_price_min?: number | null
          created_at?: string | null
          id?: never
          region_nm: string
          sigungu_nm?: string | null
          snapshot_month: string
          total_supply?: number | null
          total_unsold?: number | null
        }
        Update: {
          avg_price_max?: number | null
          avg_price_min?: number | null
          created_at?: string | null
          id?: never
          region_nm?: string
          sigungu_nm?: string | null
          snapshot_month?: string
          total_supply?: number | null
          total_unsold?: number | null
        }
        Relationships: []
      }
      unsold_monthly_stats: {
        Row: {
          after_completion: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          region: string
          stat_month: string
          total_unsold: number | null
        }
        Insert: {
          after_completion?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          region: string
          stat_month: string
          total_unsold?: number | null
        }
        Update: {
          after_completion?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          region?: string
          stat_month?: string
          total_unsold?: number | null
        }
        Relationships: []
      }
      upcoming_projects: {
        Row: {
          blog_post_id: number | null
          brand_name: string | null
          builder: string | null
          created_at: string | null
          dong: string | null
          estimated_launch_date: string | null
          estimated_price_pyeong: number | null
          facts: Json | null
          id: number
          interest_score: number | null
          location_full: string
          project_name: string
          region: string | null
          rendering_image_url: string | null
          rumors: Json | null
          scale: string | null
          sigungu: string | null
          source_urls: string[] | null
          status: string | null
          total_units: number | null
          updated_at: string | null
        }
        Insert: {
          blog_post_id?: number | null
          brand_name?: string | null
          builder?: string | null
          created_at?: string | null
          dong?: string | null
          estimated_launch_date?: string | null
          estimated_price_pyeong?: number | null
          facts?: Json | null
          id?: number
          interest_score?: number | null
          location_full: string
          project_name: string
          region?: string | null
          rendering_image_url?: string | null
          rumors?: Json | null
          scale?: string | null
          sigungu?: string | null
          source_urls?: string[] | null
          status?: string | null
          total_units?: number | null
          updated_at?: string | null
        }
        Update: {
          blog_post_id?: number | null
          brand_name?: string | null
          builder?: string | null
          created_at?: string | null
          dong?: string | null
          estimated_launch_date?: string | null
          estimated_price_pyeong?: number | null
          facts?: Json | null
          id?: number
          interest_score?: number | null
          location_full?: string
          project_name?: string
          region?: string | null
          rendering_image_url?: string | null
          rumors?: Json | null
          scale?: string | null
          sigungu?: string | null
          source_urls?: string[] | null
          status?: string | null
          total_units?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      usage_limits: {
        Row: {
          ai_analysis: number
          created_at: string
          daily_report_count: number
          export_count: number
          id: string
          period: string
          price_alerts: number
          updated_at: string
          user_id: string
          watchlist_apt: number
          watchlist_stock: number
        }
        Insert: {
          ai_analysis?: number
          created_at?: string
          daily_report_count?: number
          export_count?: number
          id?: string
          period: string
          price_alerts?: number
          updated_at?: string
          user_id: string
          watchlist_apt?: number
          watchlist_stock?: number
        }
        Update: {
          ai_analysis?: number
          created_at?: string
          daily_report_count?: number
          export_count?: number
          id?: string
          period?: string
          price_alerts?: number
          updated_at?: string
          user_id?: string
          watchlist_apt?: number
          watchlist_stock?: number
        }
        Relationships: []
      }
      user_daily_summary: {
        Row: {
          avg_scroll_depth: number | null
          clicks: number | null
          created_at: string | null
          cta_clicks: number | null
          cta_views: number | null
          engagement_score: number | null
          id: number
          page_views: number | null
          primary_device: string | null
          pv_apt: number | null
          pv_blog: number | null
          pv_calc: number | null
          pv_feed: number | null
          pv_stock: number | null
          searches: number | null
          sessions: number | null
          shares: number | null
          stat_date: string
          total_duration_sec: number | null
          unique_pages: number | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          avg_scroll_depth?: number | null
          clicks?: number | null
          created_at?: string | null
          cta_clicks?: number | null
          cta_views?: number | null
          engagement_score?: number | null
          id?: never
          page_views?: number | null
          primary_device?: string | null
          pv_apt?: number | null
          pv_blog?: number | null
          pv_calc?: number | null
          pv_feed?: number | null
          pv_stock?: number | null
          searches?: number | null
          sessions?: number | null
          shares?: number | null
          stat_date: string
          total_duration_sec?: number | null
          unique_pages?: number | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          avg_scroll_depth?: number | null
          clicks?: number | null
          created_at?: string | null
          cta_clicks?: number | null
          cta_views?: number | null
          engagement_score?: number | null
          id?: never
          page_views?: number | null
          primary_device?: string | null
          pv_apt?: number | null
          pv_blog?: number | null
          pv_calc?: number | null
          pv_feed?: number | null
          pv_stock?: number | null
          searches?: number | null
          sessions?: number | null
          shares?: number | null
          stat_date?: string
          total_duration_sec?: number | null
          unique_pages?: number | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      user_events: {
        Row: {
          created_at: string
          device_type: string | null
          duration_ms: number | null
          event_name: string
          event_type: string
          id: number
          page_category: string | null
          page_path: string | null
          properties: Json | null
          referrer: string | null
          screen_width: number | null
          session_id: string | null
          user_id: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          duration_ms?: number | null
          event_name: string
          event_type: string
          id?: never
          page_category?: string | null
          page_path?: string | null
          properties?: Json | null
          referrer?: string | null
          screen_width?: number | null
          session_id?: string | null
          user_id?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          duration_ms?: number | null
          event_name?: string
          event_type?: string
          id?: never
          page_category?: string | null
          page_path?: string | null
          properties?: Json | null
          referrer?: string | null
          screen_width?: number | null
          session_id?: string | null
          user_id?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          category: string | null
          created_at: string | null
          device: string | null
          id: number
          message: string
          page: string | null
          rating: number | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          device?: string | null
          id?: number
          message: string
          page?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          device?: string | null
          id?: number
          message?: string
          page?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_regions: {
        Row: {
          created_at: string
          id: number
          region_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          region_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          region_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_regions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          current_streak: number | null
          last_login_date: string
          longest_streak: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_streak?: number | null
          last_login_date?: string
          longest_streak?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_streak?: number | null
          last_login_date?: string
          longest_streak?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_watchlist: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: number
          item_id: string
          item_name: string
          item_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: never
          item_id: string
          item_name: string
          item_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: never
          item_id?: string
          item_name?: string
          item_type?: string
          user_id?: string
        }
        Relationships: []
      }
      view_logs: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          id: string
          post_id: number
          scroll_depth: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          post_id: number
          scroll_depth?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          post_id?: number
          scroll_depth?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "view_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_logs_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "view_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vs_battles: {
        Row: {
          created_at: string | null
          id: number
          option_a: string
          option_b: string
          post_id: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          option_a: string
          option_b: string
          post_id: number
        }
        Update: {
          created_at?: string | null
          id?: number
          option_a?: string
          option_b?: string
          post_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "vs_battles_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "hot_posts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vs_battles_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vs_battles_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vs_battles_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts_seo_full"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vs_battles_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts_seo_view"
            referencedColumns: ["id"]
          },
        ]
      }
      vs_votes: {
        Row: {
          battle_id: number
          choice: string
          created_at: string | null
          id: number
          user_id: string
        }
        Insert: {
          battle_id: number
          choice: string
          created_at?: string | null
          id?: number
          user_id: string
        }
        Update: {
          battle_id?: number
          choice?: string
          created_at?: string | null
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vs_votes_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "vs_battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vs_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_predictions: {
        Row: {
          actual_value: number | null
          created_at: string | null
          diff: number | null
          id: number
          points_awarded: number | null
          prediction: number
          rank: number | null
          user_id: string
          week_start: string
        }
        Insert: {
          actual_value?: number | null
          created_at?: string | null
          diff?: number | null
          id?: never
          points_awarded?: number | null
          prediction: number
          rank?: number | null
          user_id: string
          week_start: string
        }
        Update: {
          actual_value?: number | null
          created_at?: string | null
          diff?: number | null
          id?: never
          points_awarded?: number | null
          prediction?: number
          rank?: number | null
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      apt_alert_counts: {
        Row: {
          alert_count: number | null
          house_manage_no: string | null
        }
        Relationships: []
      }
      business_info_public: {
        Row: {
          business_category: string | null
          business_number: string | null
          business_type: string | null
          company_name: string | null
          email: string | null
          id: number | null
          opened_at: string | null
          representative: string | null
          tax_type: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          business_category?: string | null
          business_number?: string | null
          business_type?: string | null
          company_name?: string | null
          email?: string | null
          id?: number | null
          opened_at?: string | null
          representative?: string | null
          tax_type?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          business_category?: string | null
          business_number?: string | null
          business_type?: string | null
          company_name?: string | null
          email?: string | null
          id?: number | null
          opened_at?: string | null
          representative?: string | null
          tax_type?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      hot_discussion_rooms: {
        Row: {
          display_name: string | null
          id: number | null
          last_activity: string | null
          participant_count: number | null
          recent_messages: number | null
          room_key: string | null
          room_type: string | null
          source_ref: string | null
        }
        Relationships: []
      }
      hot_posts_v2: {
        Row: {
          apt_tags: string[] | null
          author_id: string | null
          avatar_url: string | null
          category: string | null
          city: string | null
          comments_count: number | null
          content: string | null
          created_at: string | null
          downvotes_count: number | null
          grade: number | null
          grade_title: string | null
          hot_score: number | null
          id: number | null
          images: string[] | null
          influence_score: number | null
          is_anonymous: boolean | null
          is_deleted: boolean | null
          likes_count: number | null
          net_score: number | null
          nickname: string | null
          region_id: string | null
          report_count: number | null
          room_id: number | null
          slug: string | null
          stock_tags: string[] | null
          tag: string | null
          title: string | null
          updated_at: string | null
          view_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "discussion_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hot_discussion_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_daily_leaderboard: {
        Row: {
          creator_id: string | null
          invite_count: number | null
          invite_date: string | null
          nickname: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_apt_overview: {
        Row: {
          closed_count: number | null
          open_count: number | null
          region: string | null
          subscription_count: number | null
          upcoming_count: number | null
        }
        Relationships: []
      }
      mv_apt_pulse: {
        Row: {
          data: Json | null
          refreshed_at: string | null
        }
        Relationships: []
      }
      mv_seo_portal_stats: {
        Row: {
          author_ok: number | null
          avg_content_len: number | null
          both_ok: number | null
          content_long_ok: number | null
          cover_image_ok: number | null
          excerpt_ok: number | null
          google: number | null
          image_alt_ok: number | null
          indexed_ok: number | null
          keywords_ok: number | null
          links_ok: number | null
          meta_ok: number | null
          naver: number | null
          refreshed_at: string | null
          rewritten_ok: number | null
          series_ok: number | null
          tags_ok: number | null
          tier_a: number | null
          tier_b: number | null
          tier_c: number | null
          title_ok: number | null
          total: number | null
        }
        Relationships: []
      }
      mv_trade_region_stats: {
        Row: {
          cnt: number | null
          region_nm: string | null
        }
        Relationships: []
      }
      mv_unsold_summary: {
        Row: {
          region: string | null
          total_unsold_households: number | null
          unsold_count: number | null
        }
        Relationships: []
      }
      posts_safe: {
        Row: {
          author_id: string | null
          category: string | null
          city: string | null
          comments_count: number | null
          content: string | null
          created_at: string | null
          id: number | null
          images: string[] | null
          is_anonymous: boolean | null
          is_deleted: boolean | null
          likes_count: number | null
          region_id: string | null
          report_count: number | null
          stock_tags: string[] | null
          tag: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          author_id?: never
          category?: string | null
          city?: string | null
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          id?: number | null
          images?: string[] | null
          is_anonymous?: boolean | null
          is_deleted?: boolean | null
          likes_count?: number | null
          region_id?: string | null
          report_count?: number | null
          stock_tags?: string[] | null
          tag?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          author_id?: never
          category?: string | null
          city?: string | null
          comments_count?: number | null
          content?: string | null
          created_at?: string | null
          id?: number | null
          images?: string[] | null
          is_anonymous?: boolean | null
          is_deleted?: boolean | null
          likes_count?: number | null
          region_id?: string | null
          report_count?: number | null
          stock_tags?: string[] | null
          tag?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      posts_seo_full: {
        Row: {
          apt_tags: string[] | null
          author_grade: string | null
          author_nickname: string | null
          canonical_url: string | null
          category: string | null
          city: string | null
          content: string | null
          created_at: string | null
          geo_city: string | null
          geo_region: string | null
          id: number | null
          likes_count: number | null
          region_id: string | null
          room_name: string | null
          room_type: string | null
          seo_description: string | null
          seo_title: string | null
          stock_tags: string[] | null
          title: string | null
          view_count: number | null
        }
        Relationships: []
      }
      posts_seo_view: {
        Row: {
          apt_tags: string[] | null
          author_name: string | null
          canonical_url: string | null
          category: string | null
          city: string | null
          comments_count: number | null
          created_at: string | null
          description: string | null
          id: number | null
          images: string[] | null
          likes_count: number | null
          region_id: string | null
          region_label: string | null
          stock_tags: string[] | null
          title: string | null
          updated_at: string | null
          view_count: number | null
        }
        Relationships: []
      }
      retention_cohort: {
        Row: {
          cohort_size: number | null
          cohort_week: string | null
          d30_retained: number | null
          d7_retained: number | null
          signup_source: string | null
        }
        Relationships: []
      }
      v_apt_price_trend: {
        Row: {
          apt_name: string | null
          avg_area: number | null
          avg_price: number | null
          deal_count: number | null
          deal_month: string | null
          max_price: number | null
          min_price: number | null
          region_nm: string | null
          sigungu: string | null
        }
        Relationships: []
      }
      v_complex_age_stats: {
        Row: {
          age_group: string | null
          avg_jeonse_ratio: number | null
          avg_sale_price: number | null
          profile_count: number | null
          total_rents: number | null
          total_sales: number | null
        }
        Relationships: []
      }
      v_complex_region_stats: {
        Row: {
          avg_sale_price: number | null
          profile_count: number | null
          region_nm: string | null
          with_jeonse: number | null
        }
        Relationships: []
      }
      v_region_trade_stats: {
        Row: {
          avg_price: number | null
          avg_price_per_m2: number | null
          deal_month: string | null
          region_nm: string | null
          total_deals: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_influence: {
        Args: { p_amount: number; p_reason?: string; p_user_id: string }
        Returns: undefined
      }
      add_map_to_apt_blogs: { Args: never; Returns: number }
      add_map_to_redev_blogs: { Args: never; Returns: number }
      add_map_to_sub_blogs: { Args: never; Returns: number }
      add_map_to_unsold_blogs: { Args: never; Returns: number }
      add_toc_and_source: { Args: { p_content: string }; Returns: string }
      admin_grade_stats: { Args: never; Returns: Json }
      admin_set_grade: {
        Args: { p_grade: number; p_grade_title: string; p_user_id: string }
        Returns: undefined
      }
      admin_toggle_admin: {
        Args: { p_user_id: string; p_value: boolean }
        Returns: undefined
      }
      aggregate_trade_monthly_stats: { Args: never; Returns: undefined }
      anonymize_deleted_user: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      award_points: {
        Args: {
          p_amount: number
          p_meta?: Json
          p_reason: string
          p_user_id: string
        }
        Returns: number
      }
      batch_generate_apt_trade_blogs: { Args: never; Returns: number }
      batch_generate_stock_blogs: { Args: never; Returns: number }
      batch_generate_stock_theme_blogs: { Args: never; Returns: number }
      batch_generate_unsold_blogs: { Args: never; Returns: number }
      blog_category_counts: {
        Args: never
        Returns: {
          category: string
          cnt: number
        }[]
      }
      blog_category_stats: {
        Args: never
        Returns: {
          category: string
          cnt: number
          rewrite_pct: number
          rewritten: number
        }[]
      }
      blog_category_views: {
        Args: never
        Returns: {
          category: string
          post_count: number
          total_views: number
        }[]
      }
      blog_popular_tags: {
        Args: { limit_count?: number }
        Returns: {
          cnt: number
          tag: string
        }[]
      }
      blog_publish_from_queue: { Args: never; Returns: Json }
      blog_queue_status: { Args: never; Returns: Json }
      build_stock_daily_blog: { Args: { p_date?: string }; Returns: number }
      build_subscription_blog: {
        Args: { p_house_manage_no: string }
        Returns: number
      }
      bulk_fill_excerpts: { Args: { batch_size?: number }; Returns: Json }
      bulk_fill_related_slugs: { Args: { batch_size?: number }; Returns: Json }
      calculate_hot_score: {
        Args: { p_created_at: string; p_downvotes: number; p_upvotes: number }
        Returns: number
      }
      calculate_site_content_score: {
        Args: { p_site_id: string }
        Returns: number
      }
      capture_daily_stats: { Args: never; Returns: undefined }
      check_attendance: { Args: { p_user_id: string }; Returns: Json }
      check_blog_similarity: {
        Args: { p_threshold?: number; p_title: string }
        Returns: {
          id: number
          similarity: number
          slug: string
          title: string
        }[]
      }
      check_in_attendance: { Args: never; Returns: Json }
      check_issue_similarity: {
        Args: { p_since?: string; p_threshold?: number; p_title: string }
        Returns: {
          id: string
          sim: number
          title: string
        }[]
      }
      check_nickname_available: {
        Args: { p_nickname: string }
        Returns: boolean
      }
      cleanup_expired_megaphones: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: number }
      complete_profile_and_reward: {
        Args: {
          p_full_name: string
          p_interests: string[]
          p_phone: string
          p_residence_city: string
          p_residence_district: string
          p_user_id: string
        }
        Returns: Json
      }
      confirm_purchase: {
        Args: { p_amount: number; p_order_id: string; p_payment_key: string }
        Returns: Json
      }
      count_unique_visitors_7d: { Args: never; Returns: number }
      create_notification: {
        Args: { p_content: string; p_type: string; p_user_id: string }
        Returns: undefined
      }
      deactivate_expired: { Args: never; Returns: undefined }
      deactivate_expired_banners: { Args: never; Returns: number }
      deactivate_expired_listings: { Args: never; Returns: number }
      decrement_likes: { Args: { row_id: number }; Returns: undefined }
      decrement_site_interest: {
        Args: { p_site_id: string }
        Returns: undefined
      }
      deduct_points: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      delete_seed_data: { Args: { target_type: string }; Returns: undefined }
      detect_point_anomaly: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      detect_unsold_surge: {
        Args: never
        Returns: {
          change_pct: number
          current_count: number
          prev_count: number
          region_nm: string
        }[]
      }
      fix_short_meta_descriptions: {
        Args: { batch_size?: number }
        Returns: Json
      }
      full_apt_blog: {
        Args: {
          p_chg1y: number
          p_dong: string
          p_jeonse: number
          p_jr: number
          p_name: string
          p_pyeong: number
          p_rc1y: number
          p_region: string
          p_sale: number
          p_sale_date: string
          p_sc1y: number
          p_sigungu: string
          p_tpl: number
          p_units: number
          p_year: number
        }
        Returns: string
      }
      full_stock_blog: {
        Args: {
          p_cap: number
          p_chg: number
          p_cur: string
          p_desc: string
          p_div: number
          p_h52: number
          p_l52: number
          p_mkt: string
          p_nm: string
          p_pbr: number
          p_per: number
          p_pr: number
          p_sec: string
          p_sym: string
          p_tpl: number
          p_vol: number
        }
        Returns: string
      }
      gen_investor_flow: { Args: { p_symbol: string }; Returns: string }
      gen_rent_table: { Args: { p_apt_name: string }; Returns: string }
      gen_site_info: { Args: { p_name: string }; Returns: string }
      gen_stock_history: { Args: { p_symbol: string }; Returns: string }
      gen_stock_news: { Args: { p_symbol: string }; Returns: string }
      gen_trade_table: {
        Args: { p_apt_name: string; p_sigungu?: string }
        Returns: string
      }
      generate_apt_compare_blog: {
        Args: { p_id1: number; p_id2: number }
        Returns: number
      }
      generate_apt_trade_blog: {
        Args: { p_apt_name: string; p_region: string }
        Returns: number
      }
      generate_apt_vs_apt_blog: {
        Args: {
          p_apt1: string
          p_apt2: string
          p_region: string
          p_sigungu: string
        }
        Returns: number
      }
      generate_area_analysis_blog: {
        Args: { p_region: string; p_sigungu: string }
        Returns: number
      }
      generate_built_year_blog: {
        Args: { p_region: string; p_sigungu: string }
        Returns: number
      }
      generate_dong_trade_blog: {
        Args: { p_dong: string; p_region: string; p_sigungu: string }
        Returns: number
      }
      generate_floor_analysis_blog: {
        Args: { p_apt_name: string; p_region: string }
        Returns: number
      }
      generate_landmark_region_blog: {
        Args: { p_region: string }
        Returns: number
      }
      generate_price_range_blog: {
        Args: { p_range_end: number; p_range_start: number; p_region: string }
        Returns: number
      }
      generate_redev_project_blog: { Args: { p_id: number }; Returns: number }
      generate_redev_region_blog: {
        Args: { p_region: string }
        Returns: number
      }
      generate_region_trade_blog: {
        Args: { p_region: string }
        Returns: number
      }
      generate_sigungu_trade_blog: {
        Args: { p_region: string; p_sigungu: string }
        Returns: number
      }
      generate_stock_analysis_blog: {
        Args: { p_symbol: string }
        Returns: number
      }
      generate_stock_blog: {
        Args: {
          p_cap: number
          p_chg: number
          p_cur: string
          p_desc: string
          p_div: number
          p_h52: number
          p_l52: number
          p_mkt: string
          p_nm: string
          p_pbr: number
          p_per: number
          p_pr: number
          p_sec: string
          p_sym: string
          p_tpl: number
          p_vol: number
        }
        Returns: string
      }
      generate_stock_compare_blog: {
        Args: { p_sym1: string; p_sym2: string }
        Returns: number
      }
      generate_stock_sector_blog: {
        Args: { p_sector: string }
        Returns: number
      }
      generate_stock_theme_blog: {
        Args: { p_theme_id: number }
        Returns: number
      }
      generate_subscription_blog: { Args: { p_id: number }; Returns: number }
      generate_subscription_region_blog: {
        Args: { p_region: string }
        Returns: number
      }
      generate_unsold_blog: { Args: { p_unsold_id: number }; Returns: number }
      generate_unsold_region_blog: {
        Args: { p_region: string }
        Returns: number
      }
      get_active_megaphones: {
        Args: never
        Returns: {
          bg_color: string
          ends_at: string
          id: number
          message: string
          nickname: string
          seconds_left: number
          text_color: string
          tier: string
        }[]
      }
      get_active_visitors: { Args: { minutes?: number }; Returns: number }
      get_admin_dashboard: { Args: never; Returns: Json }
      get_admin_dashboard_stats: { Args: never; Returns: Json }
      get_apt_dashboard: { Args: never; Returns: Json }
      get_apt_dashboard_stats: { Args: never; Returns: Json }
      get_apt_jeonse_trend: {
        Args: { p_apt_name: string; p_months?: number; p_sigungu?: string }
        Returns: {
          avg_jeonse: number
          avg_sale: number
          jeonse_ratio: number
          month: string
        }[]
      }
      get_apt_price_trend:
        | {
            Args: { p_apt_name: string; p_region?: string }
            Returns: {
              area: number
              deal_date: string
              price: number
              price_per_pyeong: number
            }[]
          }
        | {
            Args: { p_apt_name: string; p_months?: number; p_sigungu?: string }
            Returns: {
              avg_price: number
              deal_count: number
              max_price: number
              min_price: number
              month: string
            }[]
          }
      get_apt_pulse: { Args: never; Returns: Json }
      get_apt_rankings: {
        Args: { p_limit?: number; p_region?: string; p_type?: string }
        Returns: {
          apt_name: string
          avg_sale_price_pyeong: number
          built_year: number
          jeonse_ratio: number
          latest_jeonse_price: number
          latest_sale_price: number
          price_change_1y: number
          region_nm: string
          rent_count_1y: number
          sale_count_1y: number
          sigungu: string
          total_households: number
        }[]
      }
      get_best_comment: { Args: { p_post_id: number }; Returns: Json }
      get_blog_category_stats: { Args: never; Returns: Json }
      get_blog_pulse_7d: { Args: never; Returns: Json }
      get_blog_stats: {
        Args: never
        Returns: {
          blog_count: number
          total_views: number
        }[]
      }
      get_cron_summary: {
        Args: { p_hours?: number }
        Returns: {
          avg_duration_ms: number
          cron_name: string
          error_count: number
          last_run: string
          last_status: string
          success_count: number
          total_runs: number
        }[]
      }
      get_db_size: { Args: never; Returns: string }
      get_db_size_mb: { Args: never; Returns: number }
      get_db_stats: { Args: never; Returns: Json }
      get_exchange_rate_trend: {
        Args: { p_limit?: number }
        Returns: {
          rate: number
          recorded_date: string
        }[]
      }
      get_feed_pulse_7d: { Args: never; Returns: Json }
      get_hot_posts_by_region: {
        Args: { p_limit?: number; p_region?: string }
        Returns: {
          category: string
          city: string
          comments_count: number
          created_at: string
          id: number
          likes_count: number
          title: string
          view_count: number
        }[]
      }
      get_hot_topics: {
        Args: { p_limit?: number }
        Returns: {
          category: string
          comments_count: number
          id: number
          likes_count: number
          post_type: string
          title: string
        }[]
      }
      get_nearby_apt_compare: {
        Args: { p_apt_name: string; p_limit?: number; p_sigungu: string }
        Returns: {
          apt_name: string
          avg_sale_price_pyeong: number
          built_year: number
          jeonse_ratio: number
          latest_sale_price: number
          price_change_1y: number
          sale_count_1y: number
        }[]
      }
      get_next_blog_to_publish: {
        Args: { p_daily_limit?: number }
        Returns: {
          category: string
          id: number
          slug: string
          title: string
        }[]
      }
      get_poll_results: {
        Args: { p_poll_id: number }
        Returns: {
          label: string
          option_id: number
          vote_count: number
        }[]
      }
      get_portfolio_summary: {
        Args: { p_user_id: string }
        Returns: {
          buy_date: string
          buy_price: number
          change_pct: number
          currency: string
          current_price: number
          market: string
          memo: string
          name: string
          quantity: number
          symbol: string
        }[]
      }
      get_post_reactions: { Args: { p_post_id: number }; Returns: Json }
      get_post_seo: {
        Args: { p_id: number }
        Returns: {
          apt_tags: string[]
          author_name: string
          category: string
          city: string
          comments_count: number
          content: string
          created_at: string
          id: number
          images: string[]
          likes_count: number
          region_id: string
          stock_tags: string[]
          title: string
        }[]
      }
      get_prediction_results: {
        Args: { p_prediction_id: number }
        Returns: {
          agree_count: number
          disagree_count: number
        }[]
      }
      get_redev_count_by_region: {
        Args: never
        Returns: {
          redev_count: number
          region: string
        }[]
      }
      get_redev_no_coords: {
        Args: { lim?: number }
        Returns: {
          address: string
          district_name: string
          id: number
          region: string
          sigungu: string
        }[]
      }
      get_region_realestate_summary: {
        Args: { p_region: string }
        Returns: {
          avg_price: number
          ongoing_count: number
          redevelopment_count: number
          subscription_count: number
          transaction_count: number
          unsold_count: number
        }[]
      }
      get_rent_stats: {
        Args: { p_months?: number; p_region?: string }
        Returns: {
          avg_deposit: number
          avg_monthly_rent: number
          deal_count: number
          month: string
          region_nm: string
          rent_type: string
        }[]
      }
      get_seed_stats: {
        Args: never
        Returns: {
          seed_comments: number
          seed_likes: number
          seed_posts: number
          seed_users: number
        }[]
      }
      get_seed_users: {
        Args: never
        Returns: {
          age_group: string | null
          age_verified: boolean | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          birth_year: number | null
          consent_analytics: boolean | null
          consent_updated_at: string | null
          created_at: string
          deleted_at: string | null
          first_mission_completed: boolean | null
          first_mission_progress: Json | null
          followers_count: number
          following_count: number
          font_size_preference: string | null
          full_name: string | null
          gender: string | null
          google_email: string | null
          grade: number
          grade_title: string
          id: string
          influence_score: number
          interests: string[] | null
          is_admin: boolean | null
          is_banned: boolean | null
          is_deleted: boolean | null
          is_ghost: boolean | null
          is_premium: boolean
          is_seed: boolean | null
          kakao_id: string | null
          last_active_at: string | null
          last_checked_date: string | null
          likes_count: number
          marketing_agreed: boolean | null
          marketing_agreed_at: string | null
          nickname: string
          nickname_change_count: number
          nickname_change_tickets: number
          nickname_set: boolean
          onboarded: boolean | null
          onboarding_method: string | null
          phone: string | null
          points: number
          posts_count: number
          premium_expires_at: string | null
          privacy_agreed_at: string | null
          profile_completed: boolean
          profile_completion_rewarded: boolean | null
          provider: string | null
          region_text: string | null
          residence_city: string | null
          residence_district: string | null
          signup_return_url: string | null
          signup_source: string | null
          streak_days: number
          terms_agreed_at: string | null
          updated_at: string
          zodiac_animal: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_seo_portal_stats: { Args: never; Returns: Json }
      get_stock_52w_range: {
        Args: { p_symbol: string }
        Returns: {
          current_price: number
          from_high_pct: number
          from_low_pct: number
          high_date: string
          high_price: number
          low_date: string
          low_price: number
        }[]
      }
      get_stock_dashboard: { Args: never; Returns: Json }
      get_stock_ma: {
        Args: { p_days?: number; p_symbol: string }
        Returns: {
          close_price: number
          date: string
          ma20: number
          ma5: number
          ma60: number
          volume: number
        }[]
      }
      get_stock_market_summary: { Args: never; Returns: Json }
      get_stock_pulse: { Args: never; Returns: Json }
      get_thin_blog_posts: {
        Args: { lim?: number; max_len?: number }
        Returns: {
          category: string
          content: string
          id: number
          slug: string
          title: string
        }[]
      }
      get_today_blog_publish_count: { Args: never; Returns: number }
      get_trade_count_by_region: {
        Args: never
        Returns: {
          region: string
          trade_count: number
        }[]
      }
      get_trade_region_stats: {
        Args: never
        Returns: {
          cnt: number
          region_nm: string
        }[]
      }
      get_trade_sites_for_sync: {
        Args: { p_limit?: number }
        Returns: {
          dong: string
          id: string
          name: string
          region: string
          sigungu: string
          slug: string
        }[]
      }
      get_trending_searches: {
        Args: never
        Returns: {
          cnt: number
          keyword: string
        }[]
      }
      get_unsold_trend: {
        Args: { p_limit?: number; p_region?: string }
        Returns: {
          change_from_prev: number
          recorded_month: string
          region_nm: string
          total_unsold: number
        }[]
      }
      get_vs_results: {
        Args: { p_battle_id: number }
        Returns: {
          choice: string
          vote_count: number
        }[]
      }
      get_waiting_megaphones: {
        Args: never
        Returns: {
          estimated_wait_minutes: number
          id: number
          queue_position: number
          tier: string
          user_id: string
        }[]
      }
      get_weekly_active_users: { Args: never; Returns: number }
      increment_api_usage: {
        Args: { p_api_name: string; p_count?: number }
        Returns: undefined
      }
      increment_apt_view: {
        Args: { p_house_manage_no: string }
        Returns: undefined
      }
      increment_banner_click: {
        Args: { p_notice_id: number }
        Returns: undefined
      }
      increment_banner_impression: {
        Args: { p_notice_id: number }
        Returns: undefined
      }
      increment_blog_view: { Args: { p_blog_id: number }; Returns: undefined }
      increment_email_click: {
        Args: { p_resend_id: string }
        Returns: undefined
      }
      increment_email_open: {
        Args: { p_resend_id: string }
        Returns: undefined
      }
      increment_likes: { Args: { row_id: number }; Returns: undefined }
      increment_listing_click: {
        Args: { p_click_type?: string; p_listing_id: string }
        Returns: undefined
      }
      increment_listing_impression: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      increment_popup_click: { Args: { popup_id: number }; Returns: undefined }
      increment_popup_impression: {
        Args: { popup_id: number }
        Returns: undefined
      }
      increment_post_view: { Args: { p_post_id: number }; Returns: undefined }
      increment_push_click: { Args: { p_log_id: number }; Returns: undefined }
      increment_site_interest: {
        Args: { p_site_id: string }
        Returns: undefined
      }
      increment_site_view: { Args: { p_site_id: string }; Returns: undefined }
      increment_stock_view: { Args: { p_symbol: string }; Returns: undefined }
      increment_user_likes: {
        Args: { p_amount?: number; p_user_id: string }
        Returns: undefined
      }
      increment_view_count: {
        Args: { p_post_id: number; p_viewer_id?: string }
        Returns: undefined
      }
      mark_all_notifications_read: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      process_megaphone_queue: { Args: never; Returns: undefined }
      publish_blog_post: {
        Args: { p_daily_limit?: number; p_id: number }
        Returns: Json
      }
      recalc_price_change_1y: { Args: never; Returns: number }
      recalc_stock_quality_scores: { Args: never; Returns: undefined }
      refresh_all_site_scores: { Args: never; Returns: undefined }
      refresh_apt_overview: { Args: never; Returns: undefined }
      refresh_seo_stats: { Args: never; Returns: undefined }
      refresh_trending_keywords: { Args: never; Returns: undefined }
      reset_daily_api_usage: { Args: never; Returns: undefined }
      reset_monthly_api_usage: { Args: never; Returns: undefined }
      search_blogs_fts: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          category: string
          created_at: string
          excerpt: string
          id: number
          rank: number
          slug: string
          title: string
          view_count: number
        }[]
      }
      search_posts:
        | {
            Args: { p_limit?: number; p_query: string }
            Returns: {
              category: string
              city: string
              created_at: string
              id: number
              likes_count: number
              rank: number
              title: string
              view_count: number
            }[]
          }
        | {
            Args: {
              result_limit?: number
              result_offset?: number
              search_query: string
            }
            Returns: {
              author_id: string
              category: string
              comments_count: number
              content: string
              created_at: string
              id: number
              likes_count: number
              relevance: number
              title: string
            }[]
          }
      search_posts_fts: {
        Args: { p_limit?: number; p_offset?: number; p_query: string }
        Returns: {
          author_id: string
          category: string
          comments_count: number
          content: string
          created_at: string
          id: number
          likes_count: number
          rank: number
          title: string
        }[]
      }
      search_rent_transactions: {
        Args: {
          p_apt_name?: string
          p_limit?: number
          p_region?: string
          p_rent_type?: string
          p_sigungu?: string
        }
        Returns: {
          apt_name: string
          built_year: number
          deal_date: string
          deposit: number
          dong: string
          exclusive_area: number
          floor: number
          monthly_rent: number
          region_nm: string
          rent_type: string
          sigungu: string
        }[]
      }
      seed_all_blogs: { Args: never; Returns: Json }
      seed_apt_complex_blogs: { Args: never; Returns: Json }
      seed_apt_trade_blogs: { Args: never; Returns: Json }
      seed_finance_guide_blogs: { Args: never; Returns: Json }
      seed_redev_blogs: { Args: never; Returns: Json }
      seed_sector_comparison_blogs: { Args: never; Returns: Json }
      seed_stock_analysis_blogs: { Args: never; Returns: Json }
      seed_unsold_deep_blogs: { Args: never; Returns: Json }
      set_nickname: { Args: { p_nickname: string }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snapshot_daily_stock_prices: { Args: never; Returns: undefined }
      snapshot_monthly_unsold: { Args: never; Returns: undefined }
      sync_complex_profiles_full: { Args: never; Returns: Json }
      update_series_count: { Args: { p_series_id: string }; Returns: undefined }
      url_encode_korean: { Args: { p_text: string }; Returns: string }
      use_megaphone: {
        Args: { p_message: string; p_purchase_id: number }
        Returns: Json
      }
      use_megaphone_v2: {
        Args: {
          p_bg_color?: string
          p_message: string
          p_purchase_id: number
          p_text_color?: string
          p_tier?: string
        }
        Returns: Json
      }
      use_nickname_change: {
        Args: { p_new_nickname: string; p_purchase_id: number }
        Returns: Json
      }
      use_pin_post: {
        Args: { p_post_id: number; p_purchase_id: number }
        Returns: Json
      }
      use_post_boost: {
        Args: { p_post_id: number; p_purchase_id: number }
        Returns: Json
      }
      use_premium_badge: { Args: { p_purchase_id: number }; Returns: Json }
      use_premium_monthly: { Args: { p_purchase_id: number }; Returns: Json }
    }
    Enums: {
      point_reason:
        | "프로필완성"
        | "게시글작성"
        | "좋아요받음"
        | "출석체크"
        | "출석연속보너스"
        | "청약토론작성"
        | "친구초대"
        | "프로필사진등록"
        | "일일초대1등"
        | "댓글작성"
        | "구매"
        | "관리자조정"
        | "아바타등록"
        | "초대보상"
        | "공유"
        | "아파트리뷰작성"
        | "관심단지등록"
        | "채팅참여"
        | "가입보너스"
        | "코스피예측참여"
        | "투표생성"
        | "투표참여"
        | "VS생성"
        | "VS참여"
        | "예측생성"
        | "예측참여"
        | "예측적중"
        | "한마디작성"
        | "프로필완성보너스"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      point_reason: [
        "프로필완성",
        "게시글작성",
        "좋아요받음",
        "출석체크",
        "출석연속보너스",
        "청약토론작성",
        "친구초대",
        "프로필사진등록",
        "일일초대1등",
        "댓글작성",
        "구매",
        "관리자조정",
        "아바타등록",
        "초대보상",
        "공유",
        "아파트리뷰작성",
        "관심단지등록",
        "채팅참여",
        "가입보너스",
        "코스피예측참여",
        "투표생성",
        "투표참여",
        "VS생성",
        "VS참여",
        "예측생성",
        "예측참여",
        "예측적중",
        "한마디작성",
        "프로필완성보너스",
      ],
    },
  },
} as const
export type PostWithProfile = Database['public']['Tables']['posts']['Row'] & {
  profiles?: {
    id?: string;
    nickname: string | null;
    avatar_url: string | null;
    grade: number | null;
  } | null;
  // 세션 49 추가
  bookmarks_count?: number;
  is_pinned?: boolean;
  tags?: string[] | null;
  stock_tags?: string[];
  apt_tags?: string[];
  // 피드 리뉴얼: post_type (migration 후 DB 타입 재생성 전까지)
  post_type?: 'post' | 'short' | 'poll' | 'vs' | 'predict' | string;
};

export type CommentWithProfile = Database['public']['Tables']['comments']['Row'] & {
  profiles?: {
    id?: string;
    nickname: string | null;
    avatar_url: string | null;
    grade: number | null;
  } | null;
};

// Poll 타입 (post_polls 테이블 신설)
export interface PostPoll {
  id: number;
  post_id: number;
  question: string;
  options: string[];
  ends_at: string | null;
  created_at: string;
}

export interface PostPollVote {
  id: number;
  poll_id: number;
  user_id: string;
  option_index: number;
  created_at: string;
}

export interface PollResult extends PostPoll {
  counts: number[];
  total: number;
  myVote: number | null;
  expired: boolean;
}
