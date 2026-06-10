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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          telegram_chat_id: string | null
          telegram_webhook_secret: string | null
          telegram_webhook_url: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          telegram_chat_id?: string | null
          telegram_webhook_secret?: string | null
          telegram_webhook_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          telegram_chat_id?: string | null
          telegram_webhook_secret?: string | null
          telegram_webhook_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          listing_id: string
          status: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          id?: string
          listing_id: string
          status?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          code: string
          created_at: string
          group_en: string
          group_km: string
          id: string
          is_active: boolean
          name_en: string
          name_km: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          group_en: string
          group_km: string
          id?: string
          is_active?: boolean
          name_en: string
          name_km: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          group_en?: string
          group_km?: string
          id?: string
          is_active?: boolean
          name_en?: string
          name_km?: string
          sort_order?: number
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_availability: {
        Row: {
          available: boolean
          created_at: string
          date: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          available: boolean
          created_at?: string
          date?: string
          id?: string
          status: string
          user_id: string
        }
        Update: {
          available?: boolean
          created_at?: string
          date?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      invite_clicks: {
        Row: {
          code: string
          created_at: string
          id: string
          inviter_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          inviter_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          inviter_id?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      invite_joins: {
        Row: {
          code: string
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
        }
        Relationships: []
      }
      invite_rewards: {
        Row: {
          created_at: string
          id: string
          sent_at: string | null
          status: string
          tier: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sent_at?: string | null
          status?: string
          tier: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sent_at?: string | null
          status?: string
          tier?: number
          user_id?: string
        }
        Relationships: []
      }
      listing_categories: {
        Row: {
          category_id: string
          id: string
          listing_id: string
        }
        Insert: {
          category_id: string
          id?: string
          listing_id: string
        }
        Update: {
          category_id?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_categories_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          photo_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          photo_url: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          budget: number | null
          created_at: string
          description: string | null
          id: string
          location: string | null
          rejected_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          rejected_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          rejected_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_draws: {
        Row: {
          created_at: string
          draw_date: string
          draw_type: string
          drawn_at: string | null
          id: string
          prize_description: string | null
          prize_image_url: string | null
          prize_title: string
          published_at: string | null
          status: string
          winner_user_id: string | null
          winning_ticket_id: string | null
        }
        Insert: {
          created_at?: string
          draw_date: string
          draw_type: string
          drawn_at?: string | null
          id?: string
          prize_description?: string | null
          prize_image_url?: string | null
          prize_title: string
          published_at?: string | null
          status?: string
          winner_user_id?: string | null
          winning_ticket_id?: string | null
        }
        Update: {
          created_at?: string
          draw_date?: string
          draw_type?: string
          drawn_at?: string | null
          id?: string
          prize_description?: string | null
          prize_image_url?: string | null
          prize_title?: string
          published_at?: string | null
          status?: string
          winner_user_id?: string | null
          winning_ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lottery_draws_winning_ticket_id_fkey"
            columns: ["winning_ticket_id"]
            isOneToOne: false
            referencedRelation: "lottery_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      lottery_tickets: {
        Row: {
          created_at: string
          draw_period_start: string
          id: string
          source: string
          status: string
          ticket_number: number | null
          ticket_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draw_period_start: string
          id?: string
          source?: string
          status?: string
          ticket_number?: number | null
          ticket_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          draw_period_start?: string
          id?: string
          source?: string
          status?: string
          ticket_number?: number | null
          ticket_type?: string
          user_id?: string
        }
        Relationships: []
      }
      material_request_photos: {
        Row: {
          created_at: string
          id: string
          photo_url: string
          request_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url: string
          request_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string
          request_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_request_photos_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_request_responses: {
        Row: {
          created_at: string
          id: string
          request_id: string
          response: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_id: string
          response: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_id?: string
          response?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          category: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          location_filter: string
          note: string | null
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_filter?: string
          note?: string | null
          quantity: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_filter?: string
          note?: string | null
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_threads: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string
          participant_a: string
          participant_b: string
          pinned_post_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          participant_a: string
          participant_b: string
          pinned_post_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          participant_a?: string
          participant_b?: string
          pinned_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_participant_a_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_participant_b_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_pinned_post_id_fkey"
            columns: ["pinned_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          related_listing_id: string | null
          related_post_id: string | null
          related_project_id: string | null
          related_user_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          related_listing_id?: string | null
          related_post_id?: string | null
          related_project_id?: string | null
          related_user_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          related_listing_id?: string | null
          related_post_id?: string | null
          related_project_id?: string | null
          related_user_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_listing_id_fkey"
            columns: ["related_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          last_sent_at: string
          phone_digits: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          last_sent_at?: string
          phone_digits: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_sent_at?: string
          phone_digits?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      portfolio_photos: {
        Row: {
          created_at: string
          id: string
          photo_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
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
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_photos: {
        Row: {
          created_at: string
          id: string
          photo_url: string
          post_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url: string
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_photos_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string | null
          created_at: string
          currency: string
          discount_price: number | null
          id: string
          post_type: string
          price: number | null
          rejected_at: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          view_count: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          currency?: string
          discount_price?: number | null
          id?: string
          post_type?: string
          price?: number | null
          rejected_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          view_count?: number
        }
        Update: {
          content?: string | null
          created_at?: string
          currency?: string
          discount_price?: number | null
          id?: string
          post_type?: string
          price?: number | null
          rejected_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prize_claims: {
        Row: {
          claimed_at: string | null
          created_at: string
          draw_id: string
          expires_at: string
          id: string
          status: string
          winner_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          draw_id: string
          expires_at: string
          id?: string
          status?: string
          winner_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          draw_id?: string
          expires_at?: string
          id?: string
          status?: string
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prize_claims_draw_id_fkey"
            columns: ["draw_id"]
            isOneToOne: false
            referencedRelation: "lottery_draws"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about_me: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_admin: boolean
          is_client: boolean
          is_coordinator: boolean
          is_featured: boolean
          is_organization: boolean
          is_provider: boolean
          is_recruiter: boolean
          is_specialist: boolean
          is_super_user: boolean
          is_supplier: boolean
          is_verified: boolean
          language: string
          master_account_id: string | null
          member_number: number | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          about_me?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_admin?: boolean
          is_client?: boolean
          is_coordinator?: boolean
          is_featured?: boolean
          is_organization?: boolean
          is_provider?: boolean
          is_recruiter?: boolean
          is_specialist?: boolean
          is_super_user?: boolean
          is_supplier?: boolean
          is_verified?: boolean
          language?: string
          master_account_id?: string | null
          member_number?: number | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          about_me?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
          is_client?: boolean
          is_coordinator?: boolean
          is_featured?: boolean
          is_organization?: boolean
          is_provider?: boolean
          is_recruiter?: boolean
          is_specialist?: boolean
          is_super_user?: boolean
          is_supplier?: boolean
          is_verified?: boolean
          language?: string
          master_account_id?: string | null
          member_number?: number | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_master_account_id_fkey"
            columns: ["master_account_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_logs: {
        Row: {
          created_at: string
          id: string
          log_type: string
          photo_url: string | null
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          log_type: string
          photo_url?: string | null
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          log_type?: string
          photo_url?: string | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          project_id: string
          rated_id: string
          rater_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          project_id: string
          rated_id: string
          rater_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          project_id?: string
          rated_id?: string
          rater_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_ratings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          agreed_price: number | null
          checkin_required: boolean
          checkout_required: boolean
          completion_requested_by: string | null
          created_at: string
          duration: string | null
          id: string
          owner_id: string
          photo_frequency: string | null
          setup_completed: boolean
          start_date: string | null
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          agreed_price?: number | null
          checkin_required?: boolean
          checkout_required?: boolean
          completion_requested_by?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          owner_id: string
          photo_frequency?: string | null
          setup_completed?: boolean
          start_date?: string | null
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          agreed_price?: number | null
          checkin_required?: boolean
          checkout_required?: boolean
          completion_requested_by?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          owner_id?: string
          photo_frequency?: string | null
          setup_completed?: boolean
          start_date?: string | null
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
      rental_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "rental_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          rental_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          rental_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          rental_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "rental_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_comments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rental_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_likes: {
        Row: {
          created_at: string
          id: string
          rental_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rental_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rental_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_likes_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rental_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_listings: {
        Row: {
          availability: string
          available_from: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          location: string
          min_days: number
          price_per_day: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: string
          available_from?: string | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          location: string
          min_days?: number
          price_per_day: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: string
          available_from?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string
          min_days?: number
          price_per_day?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_photos: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          photo_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          photo_url: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "rental_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_requests: {
        Row: {
          budget_per_day: number | null
          category: string
          created_at: string
          description: string | null
          id: string
          location: string
          needed_from: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_per_day?: number | null
          category: string
          created_at?: string
          description?: string | null
          id?: string
          location: string
          needed_from?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_per_day?: number | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          location?: string
          needed_from?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
          status: string
          target_id: string
          target_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
          status?: string
          target_id: string
          target_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
          status?: string
          target_id?: string
          target_kind?: string
          updated_at?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          rejected_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url: string
          rejected_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          rejected_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          created_at: string
          id: string
          story_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_tracker: {
        Row: {
          current_streak: number
          last_check_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_check_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_check_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      super_user_identities: {
        Row: {
          avatar_shape: string
          badges: string[]
          created_at: string
          description: string | null
          display_order: number
          id: string
          identity_user_id: string
          is_official: boolean
          master_user_id: string
        }
        Insert: {
          avatar_shape?: string
          badges?: string[]
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          identity_user_id: string
          is_official?: boolean
          master_user_id: string
        }
        Update: {
          avatar_shape?: string
          badges?: string[]
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          identity_user_id?: string
          is_official?: boolean
          master_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_user_identities_identity_user_id_fkey"
            columns: ["identity_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_user_identities_master_user_id_fkey"
            columns: ["master_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_en: string
          name_km: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_en: string
          name_km: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_en?: string
          name_km?: string
          sort_order?: number
        }
        Relationships: []
      }
      supplier_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          note: string | null
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          note?: string | null
          token: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      supplier_settings: {
        Row: {
          categories: string[]
          id: string
          min_quantity: number
          supplier_id: string
          updated_at: string
        }
        Insert: {
          categories?: string[]
          id?: string
          min_quantity?: number
          supplier_id: string
          updated_at?: string
        }
        Update: {
          categories?: string[]
          id?: string
          min_quantity?: number
          supplier_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_store_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          store_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          store_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_store_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "supplier_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_store_categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "supplier_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_store_photos: {
        Row: {
          created_at: string
          id: string
          photo_url: string
          sort_order: number
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url: string
          sort_order?: number
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string
          sort_order?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_store_photos_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "supplier_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_stores: {
        Row: {
          contact_count: number
          created_at: string
          description: string | null
          id: string
          location: string | null
          logo_url: string | null
          name: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          contact_count?: number
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          contact_count?: number
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      app_settings_public: {
        Row: {
          id: number | null
          telegram_chat_id: string | null
          telegram_webhook_url: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number | null
          telegram_chat_id?: string | null
          telegram_webhook_url?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number | null
          telegram_chat_id?: string | null
          telegram_webhook_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_run_due_draws: { Args: never; Returns: Json }
      consume_supplier_invite: { Args: { _token: string }; Returns: string }
      current_master_user_id: { Args: never; Returns: string }
      current_month_start: { Args: never; Returns: string }
      current_week_start: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_scheduled_draws: { Args: never; Returns: undefined }
      expire_overdue_claims: { Args: never; Returns: number }
      generate_random_ticket_number: {
        Args: { _draw_period_start: string; _ticket_type: string }
        Returns: number
      }
      get_supplier_invite_by_token: {
        Args: { _token: string }
        Returns: {
          expires_at: string
          id: string
          used_by: string
        }[]
      }
      get_supplier_store_phone: { Args: { _store_id: string }; Returns: string }
      get_user_phone: { Args: { _uid: string }; Returns: string }
      increment_post_view: { Args: { _post_id: string }; Returns: undefined }
      increment_supplier_contact: {
        Args: { _store_id: string }
        Returns: undefined
      }
      increment_supplier_view: {
        Args: { _store_id: string }
        Returns: undefined
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_project_participant: {
        Args: { _pid: string; _uid: string }
        Returns: boolean
      }
      issue_daily_ticket_if_missing: { Args: never; Returns: Json }
      mark_daily_availability: { Args: { _status: string }; Returns: Json }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_telegram: {
        Args: { _kind: string; _payload: Json }
        Returns: undefined
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_invite_click: { Args: { _code: string }; Returns: undefined }
      record_invite_join: { Args: { _code: string }; Returns: string }
      resolve_invite_code: { Args: { _code: string }; Returns: string }
      run_lottery_draw: { Args: { _draw_id: string }; Returns: Json }
      start_material_chat: {
        Args: { _request_id: string; _supplier_id: string }
        Returns: string
      }
      start_product_chat: {
        Args: { _post_id: string; _supplier_id: string }
        Returns: string
      }
      supplier_can_see_request: {
        Args: { _req_id: string; _uid: string }
        Returns: boolean
      }
      update_my_role_flags: {
        Args: {
          _is_client: boolean
          _is_coordinator: boolean
          _is_organization: boolean
          _is_provider: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
