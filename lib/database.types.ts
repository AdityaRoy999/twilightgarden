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
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_dataset: {
        Row: {
          epoch: string
          id: boolean
        }
        Insert: {
          epoch?: string
          id?: boolean
        }
        Update: {
          epoch?: string
          id?: boolean
        }
        Relationships: []
      }
      app_updates: {
        Row: {
          apk_url: string
          changelog: string | null
          created_at: string | null
          force_update: boolean | null
          id: number
          message: string | null
          version_code: number
          version_name: string
        }
        Insert: {
          apk_url: string
          changelog?: string | null
          created_at?: string | null
          force_update?: boolean | null
          id?: number
          message?: string | null
          version_code: number
          version_name: string
        }
        Update: {
          apk_url?: string
          changelog?: string | null
          created_at?: string | null
          force_update?: boolean | null
          id?: number
          message?: string | null
          version_code?: number
          version_name?: string
        }
        Relationships: []
      }
      couples: {
        Row: {
          created_at: string
          id: string
          love_code: string | null
          love_unlocked: boolean | null
          pairing_code: string
          partner_1_id: string
          partner_1_role: string | null
          partner_2_id: string | null
          share_enabled: boolean | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          love_code?: string | null
          love_unlocked?: boolean | null
          pairing_code: string
          partner_1_id: string
          partner_1_role?: string | null
          partner_2_id?: string | null
          share_enabled?: boolean | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          love_code?: string | null
          love_unlocked?: boolean | null
          pairing_code?: string
          partner_1_id?: string
          partner_1_role?: string | null
          partner_2_id?: string | null
          share_enabled?: boolean | null
          status?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          created_at: string | null
          date: string
          encrypted_payload: string | null
          energy_level: string | null
          flow: string | null
          id: string
          is_period_start: boolean
          moods: string[] | null
          notes: string | null
          sleep_hours: number | null
          sleep_quality: string | null
          symptoms: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          encrypted_payload?: string | null
          energy_level?: string | null
          flow?: string | null
          id?: string
          is_period_start?: boolean
          moods?: string[] | null
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: string | null
          symptoms?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          encrypted_payload?: string | null
          energy_level?: string | null
          flow?: string | null
          id?: string
          is_period_start?: boolean
          moods?: string[] | null
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: string | null
          symptoms?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      desktop_updates: {
        Row: {
          changelog: string | null
          created_at: string | null
          force_update: boolean | null
          id: number
          installer_url: string
          signature: string
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string | null
          force_update?: boolean | null
          id?: number
          installer_url: string
          signature: string
          version: string
        }
        Update: {
          changelog?: string | null
          created_at?: string | null
          force_update?: boolean | null
          id?: number
          installer_url?: string
          signature?: string
          version?: string
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          board_state: Json
          couple_id: string
          created_at: string | null
          current_turn: string | null
          game_type: string
          id: string
          player_o: string | null
          player_x: string
          status: string
          winner: string | null
        }
        Insert: {
          board_state?: Json
          couple_id: string
          created_at?: string | null
          current_turn?: string | null
          game_type?: string
          id?: string
          player_o?: string | null
          player_x: string
          status?: string
          winner?: string | null
        }
        Update: {
          board_state?: Json
          couple_id?: string
          created_at?: string | null
          current_turn?: string | null
          game_type?: string
          id?: string
          player_o?: string | null
          player_x?: string
          status?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_sessions_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_backups: {
        Row: {
          backup_identity: string
          backup_salt: string
          created_at: string | null
          public_key: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          backup_identity: string
          backup_salt: string
          created_at?: string | null
          public_key?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          backup_identity?: string
          backup_salt?: string
          created_at?: string | null
          public_key?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          affected_services: string[] | null
          created_at: string
          description: string | null
          id: number
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          affected_services?: string[] | null
          created_at?: string
          description?: string | null
          id?: never
          resolved_at?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          affected_services?: string[] | null
          created_at?: string
          description?: string | null
          id?: never
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      note_keys: {
        Row: {
          created_at: string | null
          device_id: string
          encrypted_message_key: string
          note_id: string
          user_id: string
          v: number | null
        }
        Insert: {
          created_at?: string | null
          device_id: string
          encrypted_message_key: string
          note_id: string
          user_id: string
          v?: number | null
        }
        Update: {
          created_at?: string | null
          device_id?: string
          encrypted_message_key?: string
          note_id?: string
          user_id?: string
          v?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "note_keys_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "shared_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          dedupe_key: string | null
          encrypted_payload: string | null
          id: string
          is_read: boolean | null
          message: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          dedupe_key?: string | null
          encrypted_payload?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          dedupe_key?: string | null
          encrypted_payload?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          partner_nickname: string | null
          role: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          partner_nickname?: string | null
          role?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          partner_nickname?: string | null
          role?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      service_checks: {
        Row: {
          checked_at: string
          error_message: string | null
          id: number
          latency_ms: number | null
          service: string
          status: string
          status_code: number | null
        }
        Insert: {
          checked_at?: string
          error_message?: string | null
          id?: never
          latency_ms?: number | null
          service: string
          status: string
          status_code?: number | null
        }
        Update: {
          checked_at?: string
          error_message?: string | null
          id?: never
          latency_ms?: number | null
          service?: string
          status?: string
          status_code?: number | null
        }
        Relationships: []
      }
      shared_cards: {
        Row: {
          card_data: Json
          created_at: string | null
          expires_at: string | null
          id: string
          share_code: string
          user_id: string | null
        }
        Insert: {
          card_data: Json
          created_at?: string | null
          expires_at?: string | null
          id?: string
          share_code: string
          user_id?: string | null
        }
        Update: {
          card_data?: Json
          created_at?: string | null
          expires_at?: string | null
          id?: string
          share_code?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shared_notes: {
        Row: {
          content: string
          couple_id: string
          created_at: string
          deleted_by: Json | null
          id: string
          is_forwarded: boolean | null
          media_url: string | null
          pinned_by: Json | null
          reactions: Json | null
          recipient_public_key: string | null
          reply_content: string | null
          reply_to_id: string | null
          sender_device_id: string | null
          sender_id: string
          sender_public_key: string | null
          starred_by: Json | null
          status: string | null
          type: string | null
          v: number | null
        }
        Insert: {
          content: string
          couple_id: string
          created_at?: string
          deleted_by?: Json | null
          id?: string
          is_forwarded?: boolean | null
          media_url?: string | null
          pinned_by?: Json | null
          reactions?: Json | null
          recipient_public_key?: string | null
          reply_content?: string | null
          reply_to_id?: string | null
          sender_device_id?: string | null
          sender_id: string
          sender_public_key?: string | null
          starred_by?: Json | null
          status?: string | null
          type?: string | null
          v?: number | null
        }
        Update: {
          content?: string
          couple_id?: string
          created_at?: string
          deleted_by?: Json | null
          id?: string
          is_forwarded?: boolean | null
          media_url?: string | null
          pinned_by?: Json | null
          reactions?: Json | null
          recipient_public_key?: string | null
          reply_content?: string | null
          reply_to_id?: string | null
          sender_device_id?: string | null
          sender_id?: string
          sender_public_key?: string | null
          starred_by?: Json | null
          status?: string | null
          type?: string | null
          v?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_notes_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_notes_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "shared_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_sessions: {
        Row: {
          created_at: string | null
          encrypted_payload: string | null
          ephemeral_public_key: string
          id: string
          status: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_payload?: string | null
          ephemeral_public_key: string
          id?: string
          status?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_payload?: string | null
          ephemeral_public_key?: string
          id?: string
          status?: string | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      user_fcm_tokens: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_keys: {
        Row: {
          backup_identity: string | null
          backup_salt: string | null
          created_at: string
          device_id: string
          device_name: string | null
          last_active: string | null
          public_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_identity?: string | null
          backup_salt?: string | null
          created_at?: string
          device_id?: string
          device_name?: string | null
          last_active?: string | null
          public_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_identity?: string | null
          backup_salt?: string | null
          created_at?: string
          device_id?: string
          device_name?: string | null
          last_active?: string | null
          public_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          avg_cycle_length: number | null
          avg_period_length: number | null
          encrypted_payload: string | null
          irregular_cycle: boolean | null
          last_period_start: string | null
          notifications_enabled: boolean | null
          onboarding_completed: boolean | null
          period_notifications: boolean | null
          reminder_notifications: boolean | null
          time_zone: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_cycle_length?: number | null
          avg_period_length?: number | null
          encrypted_payload?: string | null
          irregular_cycle?: boolean | null
          last_period_start?: string | null
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          period_notifications?: boolean | null
          reminder_notifications?: boolean | null
          time_zone?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_cycle_length?: number | null
          avg_period_length?: number | null
          encrypted_payload?: string | null
          irregular_cycle?: boolean | null
          last_period_start?: string | null
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          period_notifications?: boolean | null
          reminder_notifications?: boolean | null
          time_zone?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_realtime_topic: { Args: never; Returns: boolean }
      choose_initial_account_role: {
        Args: { p_role: string }
        Returns: undefined
      }
      claim_reminder_delivery: {
        Args: { p_kind: string; p_local_date: string; p_user_id: string }
        Returns: boolean
      }
      complete_reminder_delivery: {
        Args: { p_kind: string; p_local_date: string; p_user_id: string }
        Returns: undefined
      }
      consume_request_budget: {
        Args: { p_action: string; p_limit: number; p_user_id: string }
        Returns: boolean
      }
      delete_old_notifications: { Args: never; Returns: undefined }
      ensure_own_profile: {
        Args: never
        Returns: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          partner_nickname: string | null
          role: string
          status: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_chat_public_key: { Args: { p_user_id: string }; Returns: string }
      get_data_epoch: { Args: never; Returns: string }
      get_partner_id: { Args: never; Returns: string }
      get_shared_card: { Args: { p_code: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      join_couple: { Args: { code_input: string }; Returns: Json }
      join_couple_love_lock: { Args: { code_input: string }; Returns: Json }
      run_reminder_job: { Args: never; Returns: number }
      save_cycle_settings: {
        Args: { p_encrypted?: string; p_values: Json }
        Returns: {
          avg_cycle_length: number | null
          avg_period_length: number | null
          encrypted_payload: string | null
          irregular_cycle: boolean | null
          last_period_start: string | null
          notifications_enabled: boolean | null
          onboarding_completed: boolean | null
          period_notifications: boolean | null
          reminder_notifications: boolean | null
          time_zone: string
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_daily_log: {
        Args: {
          p_date: string
          p_encrypted?: string
          p_period_start?: boolean
          p_values: Json
        }
        Returns: Json
      }
      send_chat_note: {
        Args: {
          p_content: string
          p_couple: string
          p_device?: string
          p_id: string
          p_media?: string
          p_recipient_key: string
          p_reply?: string
          p_sender_key: string
          p_type?: string
        }
        Returns: {
          content: string
          couple_id: string
          created_at: string
          deleted_by: Json | null
          id: string
          is_forwarded: boolean | null
          media_url: string | null
          pinned_by: Json | null
          reactions: Json | null
          recipient_public_key: string | null
          reply_content: string | null
          reply_to_id: string | null
          sender_device_id: string | null
          sender_id: string
          sender_public_key: string | null
          starred_by: Json | null
          status: string | null
          type: string | null
          v: number | null
        }
        SetofOptions: {
          from: "*"
          to: "shared_notes"
          isOneToOne: true
          isSetofReturn: false
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
