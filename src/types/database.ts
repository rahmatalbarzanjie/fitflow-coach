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
      ai_requests: {
        Row: {
          created_at: string
          id: string
          prompt: string
          response: string | null
          type: Database["public"]["Enums"]["ai_request_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prompt: string
          response?: string | null
          type: Database["public"]["Enums"]["ai_request_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prompt?: string
          response?: string | null
          type?: Database["public"]["Enums"]["ai_request_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          amount_paid: number
          created_at: string | null
          id: string
          member_id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          session_id: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string | null
          id?: string
          member_id: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          session_id: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "today_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      broadcast_recipients: {
        Row: {
          broadcast_id: string
          created_at: string | null
          id: string
          member_id: string | null
          name: string
          phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          broadcast_id: string
          created_at?: string | null
          id?: string
          member_id?: string | null
          name: string
          phone: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          broadcast_id?: string
          created_at?: string | null
          id?: string
          member_id?: string | null
          name?: string
          phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_recipients_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_recipients_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_schedules: {
        Row: {
          broadcast_id: string
          id: string
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["broadcast_send_status"]
        }
        Insert: {
          broadcast_id: string
          id?: string
          scheduled_at: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["broadcast_send_status"]
        }
        Update: {
          broadcast_id?: string
          id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["broadcast_send_status"]
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          recipient_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["broadcast_status"]
          target_audience: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          recipient_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["broadcast_status"]
          target_audience?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          recipient_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["broadcast_status"]
          target_audience?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      class_schedules: {
        Row: {
          class_id: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          start_time: string
        }
        Insert: {
          class_id: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          start_time: string
        }
        Update: {
          class_id?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          start_time?: string
        }
        Relationships: []
      }
      class_sessions: {
        Row: {
          class_id: string
          created_at: string
          end_time: string
          id: string
          notes: string | null
          session_date: string
          start_time: string
        }
        Insert: {
          class_id: string
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          session_date: string
          start_time: string
        }
        Update: {
          class_id?: string
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          session_date?: string
          start_time?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          capacity: number | null
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          location: string | null
          name: string
          start_time: string
          type: Database["public"]["Enums"]["class_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          start_time: string
          type?: Database["public"]["Enums"]["class_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          start_time?: string
          type?: Database["public"]["Enums"]["class_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          amount_paid: number
          attended: boolean
          confirmed_at: string | null
          event_id: string
          id: string
          invited_to_join_at: string | null
          joined_as_member_at: string | null
          member_id: string | null
          proof_url: string
          registered_at: string
          registrant_name: string
          registrant_phone: string
          rejection_note: string | null
        }
        Insert: {
          amount_paid: number
          attended?: boolean
          confirmed_at?: string | null
          event_id: string
          id?: string
          invited_to_join_at?: string | null
          joined_as_member_at?: string | null
          member_id?: string | null
          proof_url: string
          registered_at?: string
          registrant_name: string
          registrant_phone: string
          rejection_note?: string | null
        }
        Update: {
          amount_paid?: number
          attended?: boolean
          confirmed_at?: string | null
          event_id?: string
          id?: string
          invited_to_join_at?: string | null
          joined_as_member_at?: string | null
          member_id?: string | null
          proof_url?: string
          registered_at?: string
          registrant_name?: string
          registrant_phone?: string
          rejection_note?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          early_bird_deadline: string | null
          early_bird_price: number
          early_bird_quota: number | null
          end_time: string | null
          event_date: string
          id: string
          location: string | null
          max_capacity: number | null
          ots_price: number
          slug: string
          start_time: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          early_bird_deadline?: string | null
          early_bird_price?: number
          early_bird_quota?: number | null
          end_time?: string | null
          event_date: string
          id?: string
          location?: string | null
          max_capacity?: number | null
          ots_price?: number
          slug: string
          start_time: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          early_bird_deadline?: string | null
          early_bird_price?: number
          early_bird_quota?: number | null
          end_time?: string | null
          event_date?: string
          id?: string
          location?: string | null
          max_capacity?: number | null
          ots_price?: number
          slug?: string
          start_time?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string | null
          id: string
          last_attended_at: string | null
          name: string
          notes: string | null
          phone: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_attended_at?: string | null
          name: string
          notes?: string | null
          phone: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_attended_at?: string | null
          name?: string
          notes?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          ref_id: string | null
          ref_type: Database["public"]["Enums"]["notification_ref_type"] | null
          scheduled_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          ref_id?: string | null
          ref_type?: Database["public"]["Enums"]["notification_ref_type"] | null
          scheduled_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          ref_id?: string | null
          ref_type?: Database["public"]["Enums"]["notification_ref_type"] | null
          scheduled_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      page_settings: {
        Row: {
          bio_text: string | null
          ig_url: string | null
          is_published: boolean
          page_slug: string
          profile_photo_url: string | null
          show_schedule: boolean
          user_id: string
        }
        Insert: {
          bio_text?: string | null
          ig_url?: string | null
          is_published?: boolean
          page_slug: string
          profile_photo_url?: string | null
          show_schedule?: boolean
          user_id: string
        }
        Update: {
          bio_text?: string | null
          ig_url?: string | null
          is_published?: boolean
          page_slug?: string
          profile_photo_url?: string | null
          show_schedule?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_name: string | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string | null
          id: string
          name: string
          phone?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_name?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      registrations: {
        Row: {
          amount_paid: number
          attended: boolean
          confirmed_at: string | null
          event_id: string
          id: string
          invited_to_join_at: string | null
          joined_as_member_at: string | null
          member_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          proof_url: string | null
          registered_at: string | null
          registrant_name: string
          registrant_phone: string
          rejection_note: string | null
          tier: Database["public"]["Enums"]["registration_tier"]
          user_id: string
        }
        Insert: {
          amount_paid?: number
          attended?: boolean
          confirmed_at?: string | null
          event_id: string
          id?: string
          invited_to_join_at?: string | null
          joined_as_member_at?: string | null
          member_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          proof_url?: string | null
          registered_at?: string | null
          registrant_name: string
          registrant_phone: string
          rejection_note?: string | null
          tier?: Database["public"]["Enums"]["registration_tier"]
          user_id: string
        }
        Update: {
          amount_paid?: number
          attended?: boolean
          confirmed_at?: string | null
          event_id?: string
          id?: string
          invited_to_join_at?: string | null
          joined_as_member_at?: string | null
          member_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          proof_url?: string | null
          registered_at?: string | null
          registrant_name?: string
          registrant_phone?: string
          rejection_note?: string | null
          tier?: Database["public"]["Enums"]["registration_tier"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          class_id: string
          created_at: string | null
          end_time: string
          id: string
          notes: string | null
          session_date: string
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string | null
          end_time: string
          id?: string
          notes?: string | null
          session_date: string
          start_time: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          session_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          chatbot_enabled: boolean
          daily_notif_enabled: boolean
          notif_time: string
          timezone: string
          user_id: string
          wa_number: string | null
        }
        Insert: {
          chatbot_enabled?: boolean
          daily_notif_enabled?: boolean
          notif_time?: string
          timezone?: string
          user_id: string
          wa_number?: string | null
        }
        Update: {
          chatbot_enabled?: boolean
          daily_notif_enabled?: boolean
          notif_time?: string
          timezone?: string
          user_id?: string
          wa_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          business_name: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      event_registration_summary: {
        Row: {
          amount_paid: number | null
          attended: boolean | null
          can_invite_to_join: boolean | null
          confirmed_at: string | null
          event_date: string | null
          event_id: string | null
          event_title: string | null
          id: string | null
          invited_to_join_at: string | null
          is_member: boolean | null
          joined_as_member_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          proof_url: string | null
          registered_at: string | null
          registrant_name: string | null
          registrant_phone: string | null
          rejection_note: string | null
          tier: Database["public"]["Enums"]["registration_tier"] | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      member_summary: {
        Row: {
          attended_this_month: number | null
          created_at: string | null
          id: string | null
          last_attended_at: string | null
          name: string | null
          phone: string | null
          status: Database["public"]["Enums"]["member_status"] | null
          total_attended: number | null
          total_revenue: number | null
          user_id: string | null
        }
        Relationships: []
      }
      today_sessions: {
        Row: {
          attended_count: number | null
          capacity: number | null
          class_id: string | null
          class_name: string | null
          class_type: Database["public"]["Enums"]["class_type"] | null
          end_time: string | null
          location: string | null
          session_date: string | null
          session_id: string | null
          session_revenue: number | null
          start_time: string | null
          status: Database["public"]["Enums"]["session_status"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      confirm_registration: {
        Args: { p_registration_id: string }
        Returns: undefined
      }
      generate_sessions_for_class: {
        Args: { p_class_id: string; p_days_ahead?: number }
        Returns: number
      }
      invite_registrant_to_join: {
        Args: { p_member_id?: string; p_registration_id: string }
        Returns: undefined
      }
      refresh_member_statuses: { Args: { p_user_id?: string }; Returns: number }
    }
    Enums: {
      ai_request_type:
        | "draft_broadcast"
        | "daily_summary"
        | "chat"
        | "suggest_followup"
        | "draft_rejection"
      attendance_payment_mode: "free" | "drop_in" | "prepaid" | "debt"
      broadcast_send_status: "pending" | "sent" | "failed"
      broadcast_status: "draft" | "sent" | "scheduled"
      broadcast_target: "all" | "active" | "at_risk" | "inactive" | "custom"
      class_type:
        | "zumba"
        | "yoga"
        | "pilates"
        | "poundfit"
        | "aerobic"
        | "barre"
        | "other"
      event_status: "draft" | "published" | "completed" | "cancelled"
      member_status: "new" | "active" | "at_risk" | "inactive"
      notification_ref_type: "member" | "event" | "session" | "broadcast"
      notification_type:
        | "daily_summary"
        | "payment_followup"
        | "inactive_member"
        | "event_reminder"
        | "broadcast_sent"
        | "new_registration"
        | "member_joined"
      payment_method: "cash" | "transfer"
      payment_method_type: "cash" | "transfer"
      payment_mode: "free" | "drop_in" | "prepaid" | "debt"
      payment_status: "pending" | "confirmed" | "rejected"
      registration_tier: "early_bird" | "ots"
      session_status: "scheduled" | "ongoing" | "completed" | "cancelled"
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
      ai_request_type: [
        "draft_broadcast",
        "daily_summary",
        "chat",
        "suggest_followup",
        "draft_rejection",
      ],
      attendance_payment_mode: ["free", "drop_in", "prepaid", "debt"],
      broadcast_send_status: ["pending", "sent", "failed"],
      broadcast_status: ["draft", "sent", "scheduled"],
      broadcast_target: ["all", "active", "at_risk", "inactive", "custom"],
      class_type: [
        "zumba",
        "yoga",
        "pilates",
        "poundfit",
        "aerobic",
        "barre",
        "other",
      ],
      event_status: ["draft", "published", "completed", "cancelled"],
      member_status: ["new", "active", "at_risk", "inactive"],
      notification_ref_type: ["member", "event", "session", "broadcast"],
      notification_type: [
        "daily_summary",
        "payment_followup",
        "inactive_member",
        "event_reminder",
        "broadcast_sent",
        "new_registration",
        "member_joined",
      ],
      payment_method: ["cash", "transfer"],
      payment_method_type: ["cash", "transfer"],
      payment_mode: ["free", "drop_in", "prepaid", "debt"],
      payment_status: ["pending", "confirmed", "rejected"],
      registration_tier: ["early_bird", "ots"],
      session_status: ["scheduled", "ongoing", "completed", "cancelled"],
    },
  },
} as const
