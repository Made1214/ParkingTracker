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
      activity_proposals: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_id: string
          group_id: string
          id: string
          status: Database["public"]["Enums"]["proposal_status"]
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id: string
          group_id: string
          id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_id?: string
          group_id?: string
          id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ap_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "event_expense_summary"
            referencedColumns: ["event_id", "group_id"]
          },
          {
            foreignKeyName: "ap_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          event_id: string
          group_id: string
          id: string
          is_reply: boolean | null
          parent_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          event_id: string
          group_id: string
          id?: string
          is_reply?: never
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          event_id?: string
          group_id?: string
          id?: string
          is_reply?: never
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "c_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "event_expense_summary"
            referencedColumns: ["event_id", "group_id"]
          },
          {
            foreignKeyName: "c_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "c_parent_fk"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendance: {
        Row: {
          event_id: string
          group_id: string
          id: string
          responded_at: string
          status: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        ComputedFields: never
        Insert: {
          event_id: string
          group_id: string
          id?: string
          responded_at?: string
          status: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Update: {
          event_id?: string
          group_id?: string
          id?: string
          responded_at?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ea_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "event_expense_summary"
            referencedColumns: ["event_id", "group_id"]
          },
          {
            foreignKeyName: "ea_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "event_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          cover_public_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          group_id: string
          id: string
          location: string | null
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          cover_public_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          group_id: string
          id?: string
          location?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          title: string
          updated_at?: string
        }
        Update: {
          cover_public_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          group_id?: string
          id?: string
          location?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          expense_id: string
          group_id: string
          id: string
          settled: boolean
          settled_at: string | null
          share_amount: number
          user_id: string
        }
        ComputedFields: never
        Insert: {
          expense_id: string
          group_id: string
          id?: string
          settled?: boolean
          settled_at?: string | null
          share_amount: number
          user_id: string
        }
        Update: {
          expense_id?: string
          group_id?: string
          id?: string
          settled?: boolean
          settled_at?: string | null
          share_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "es_expense_fk"
            columns: ["expense_id", "group_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "expense_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          event_id: string
          group_id: string
          id: string
          idempotency_key: string | null
          paid_by: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          event_id: string
          group_id: string
          id?: string
          idempotency_key?: string | null
          paid_by: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          event_id?: string
          group_id?: string
          id?: string
          idempotency_key?: string | null
          paid_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exp_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "event_expense_summary"
            referencedColumns: ["event_id", "group_id"]
          },
          {
            foreignKeyName: "exp_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        ComputedFields: never
        Insert: {
          group_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_storage_usage: {
        Row: {
          bytes_quota: number
          bytes_used: number
          group_id: string
        }
        ComputedFields: never
        Insert: {
          bytes_quota?: number
          bytes_used?: number
          group_id: string
        }
        Update: {
          bytes_quota?: number
          bytes_used?: number
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_storage_usage_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_public_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          invite_code: string
          name: string
          photo_url: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          avatar_public_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invite_code: string
          name: string
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          avatar_public_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          bytes: number
          cloudinary_public_id: string
          cloudinary_version: string | null
          created_at: string
          event_id: string
          group_id: string
          height: number | null
          id: string
          uploaded_by: string | null
          width: number | null
        }
        ComputedFields: never
        Insert: {
          bytes: number
          cloudinary_public_id: string
          cloudinary_version?: string | null
          created_at?: string
          event_id: string
          group_id: string
          height?: number | null
          id?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          bytes?: number
          cloudinary_public_id?: string
          cloudinary_version?: string | null
          created_at?: string
          event_id?: string
          group_id?: string
          height?: number | null
          id?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "event_expense_summary"
            referencedColumns: ["event_id", "group_id"]
          },
          {
            foreignKeyName: "photos_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "group_id"]
          },
          {
            foreignKeyName: "photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          group_id: string
          id: string
          label: string
          poll_id: string
          position: number
        }
        ComputedFields: never
        Insert: {
          group_id: string
          id?: string
          label: string
          poll_id: string
          position?: number
        }
        Update: {
          group_id?: string
          id?: string
          label?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_poll_fk"
            columns: ["poll_id", "group_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          group_id: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pv_option_fk"
            columns: ["option_id", "poll_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id", "poll_id"]
          },
          {
            foreignKeyName: "pv_poll_fk"
            columns: ["poll_id", "group_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
      polls: {
        Row: {
          allow_multiple: boolean
          closes_at: string | null
          created_at: string
          created_by: string | null
          event_id: string
          group_id: string
          id: string
          question: string
          status: Database["public"]["Enums"]["poll_status"]
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          allow_multiple?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          event_id: string
          group_id: string
          id?: string
          question: string
          status?: Database["public"]["Enums"]["poll_status"]
          updated_at?: string
        }
        Update: {
          allow_multiple?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string
          group_id?: string
          id?: string
          question?: string
          status?: Database["public"]["Enums"]["poll_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "event_expense_summary"
            referencedColumns: ["event_id", "group_id"]
          },
          {
            foreignKeyName: "polls_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_public_id: string | null
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
          username: string | null
        }
        ComputedFields: never
        Insert: {
          avatar_public_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_public_id?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      schedule_items: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_id: string
          group_id: string
          id: string
          position: number
          proposal_id: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_id: string
          group_id: string
          id?: string
          position?: number
          proposal_id?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_id?: string
          group_id?: string
          id?: string
          position?: number
          proposal_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "si_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "event_expense_summary"
            referencedColumns: ["event_id", "group_id"]
          },
          {
            foreignKeyName: "si_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          event_id: string
          group_id: string
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          event_id: string
          group_id: string
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          event_id?: string
          group_id?: string
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "event_expense_summary"
            referencedColumns: ["event_id", "group_id"]
          },
          {
            foreignKeyName: "tasks_event_fk"
            columns: ["event_id", "group_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "group_id"]
          },
        ]
      }
    }
    Views: {
      event_expense_summary: {
        Row: {
          event_id: string
          expense_count: number | null
          group_id: string
          participant_count: number | null
          settled_amount: number | null
          starts_at: string
          title: string
          total_amount: number | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      member_participation: {
        Row: {
          attendance_pct: number | null
          display_name: string
          events_attended: number | null
          events_declined: number | null
          events_invited: number | null
          events_maybe: number | null
          group_id: string
          user_id: string
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cast_vote: {
        Args: { p_option_ids: string[]; p_poll_id: string }
        Returns: undefined
      }
      close_poll: { Args: { p_poll_id: string }; Returns: undefined }
      create_activity_proposal: {
        Args: { p_description: string; p_event_id: string; p_title: string }
        Returns: undefined
      }
      create_group: {
        Args: { p_name: string; p_photo_url?: string }
        Returns: {
          avatar_public_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          invite_code: string
          name: string
          photo_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_poll: {
        Args: {
          p_allow_multiple: boolean
          p_closes_at?: string
          p_event_id: string
          p_options: string[]
          p_question: string
        }
        Returns: string
      }
      create_expense: {
        Args: {
          p_amount: number
          p_category: string
          p_description: string
          p_event_id: string
          p_paid_by: string
          p_shares: Json
          p_idempotency_key?: string | null
        }
        Returns: string
      }
      delete_group: {
        Args: { p_group_id: string }
        Returns: string[]
      }
      delete_my_account: {
        Args: never
        Returns: {
          deleted_avatar_public_id: string | null
          deleted_event_covers: string[]
          deleted_group_avatars: string[]
          deleted_photos: string[]
        }[]
      }
      get_event_balances: {
        Args: { p_event_id: string }
        Returns: {
          net_amount: number
          user_id: string
        }[]
      }
      get_event_debts: {
        Args: { p_event_id: string }
        Returns: {
          amount: number
          creditor: string
          debtor: string
        }[]
      }
      get_group_balances: {
        Args: { p_group_id: string }
        Returns: {
          net_amount: number
          user_id: string
        }[]
      }
      get_poll_results: {
        Args: { p_poll_id: string }
        Returns: {
          is_winner: boolean
          label: string
          option_id: string
          votes: number
        }[]
      }
      join_group_by_invite: {
        Args: { p_code: string }
        Returns: {
          avatar_public_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          invite_code: string
          name: string
          photo_url: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_activity_proposal: {
        Args: {
          p_proposal_id: string
          p_status: Database["public"]["Enums"]["proposal_status"]
        }
        Returns: undefined
      }
      settle_event_debt: {
        Args: { p_creditor: string; p_debtor: string; p_event_id: string }
        Returns: number
      }
      suggest_settlements: {
        Args: { p_group_id: string }
        Returns: {
          amount: number
          from_user: string
          to_user: string
        }[]
      }
    }
    Enums: {
      attendance_status: "going" | "maybe" | "declined"
      event_status: "draft" | "published" | "cancelled" | "finished"
      member_role: "admin" | "member"
      poll_status: "open" | "closed"
      proposal_status: "open" | "accepted" | "rejected"
      task_status: "pending" | "in_progress" | "done"
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
  public: {
    Enums: {
      attendance_status: ["going", "maybe", "declined"],
      event_status: ["draft", "published", "cancelled", "finished"],
      member_role: ["admin", "member"],
      poll_status: ["open", "closed"],
      proposal_status: ["open", "accepted", "rejected"],
      task_status: ["pending", "in_progress", "done"],
    },
  },
} as const
