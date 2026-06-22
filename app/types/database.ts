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
      accounts: {
        Row: {
          became_client_at: string | null
          client_id: string
          created_at: string
          current_status: Database["public"]["Enums"]["account_status"]
          effectif: string | null
          id: string
          marche_public: boolean
          name: string
          secteur: string | null
          siret: string | null
        }
        Insert: {
          became_client_at?: string | null
          client_id: string
          created_at?: string
          current_status?: Database["public"]["Enums"]["account_status"]
          effectif?: string | null
          id?: string
          marche_public?: boolean
          name: string
          secteur?: string | null
          siret?: string | null
        }
        Update: {
          became_client_at?: string | null
          client_id?: string
          created_at?: string
          current_status?: Database["public"]["Enums"]["account_status"]
          effectif?: string | null
          id?: string
          marche_public?: boolean
          name?: string
          secteur?: string | null
          siret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
          settings: Json
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          settings?: Json
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          settings?: Json
          slug?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          account_id: string
          client_id: string
          created_at: string
          email: string | null
          fonction: string | null
          id: string
          lead_level: Database["public"]["Enums"]["lead_level"] | null
          nom: string | null
          prenom: string | null
          tel: string | null
        }
        Insert: {
          account_id: string
          client_id: string
          created_at?: string
          email?: string | null
          fonction?: string | null
          id?: string
          lead_level?: Database["public"]["Enums"]["lead_level"] | null
          nom?: string | null
          prenom?: string | null
          tel?: string | null
        }
        Update: {
          account_id?: string
          client_id?: string
          created_at?: string
          email?: string | null
          fonction?: string | null
          id?: string
          lead_level?: Database["public"]["Enums"]["lead_level"] | null
          nom?: string | null
          prenom?: string | null
          tel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_id: string
          created_at: string
          date: string | null
          id: string
          lieu: string | null
          name: string
          notes: string | null
          partnership_id: string | null
          type: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          date?: string | null
          id?: string
          lieu?: string | null
          name: string
          notes?: string | null
          partnership_id?: string | null
          type?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          date?: string | null
          id?: string
          lieu?: string | null
          name?: string
          notes?: string | null
          partnership_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_partnership_id_fkey"
            columns: ["partnership_id"]
            isOneToOne: false
            referencedRelation: "partnerships"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          client_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      participations: {
        Row: {
          account_id: string
          category: string | null
          client_id: string
          contact_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["direction"]
          entered_network_at: string | null
          event_id: string
          id: string
          notes: string | null
          status_at_entry: Database["public"]["Enums"]["account_status"] | null
        }
        Insert: {
          account_id: string
          category?: string | null
          client_id: string
          contact_id?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["direction"]
          entered_network_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          status_at_entry?: Database["public"]["Enums"]["account_status"] | null
        }
        Update: {
          account_id?: string
          category?: string | null
          client_id?: string
          contact_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["direction"]
          entered_network_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          status_at_entry?: Database["public"]["Enums"]["account_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "participations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      partnerships: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          type: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          type?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partnerships_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_imports: {
        Row: {
          client_id: string
          created_at: string
          filename: string
          id: string
          matched: number
          row_count: number
          status: string
          unmatched: number
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          filename: string
          id?: string
          matched?: number
          row_count?: number
          status?: string
          unmatched?: number
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          filename?: string
          id?: string
          matched?: number
          row_count?: number
          status?: string
          unmatched?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_imports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_lines: {
        Row: {
          account_id: string
          activity_line: Database["public"]["Enums"]["activity_line"]
          amount: number
          client_id: string
          created_at: string
          id: string
          import_id: string | null
          period: string
          source: Database["public"]["Enums"]["revenue_source"]
        }
        Insert: {
          account_id: string
          activity_line?: Database["public"]["Enums"]["activity_line"]
          amount: number
          client_id: string
          created_at?: string
          id?: string
          import_id?: string | null
          period: string
          source?: Database["public"]["Enums"]["revenue_source"]
        }
        Update: {
          account_id?: string
          activity_line?: Database["public"]["Enums"]["activity_line"]
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          import_id?: string | null
          period?: string
          source?: Database["public"]["Enums"]["revenue_source"]
        }
        Relationships: [
          {
            foreignKeyName: "revenue_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_lines_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "revenue_imports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_has_client_access: { Args: { target: string }; Returns: boolean }
    }
    Enums: {
      account_status: "suspect" | "prospect" | "client"
      activity_line: "talent" | "emploi" | "formation" | "autre"
      direction: "direct" | "indirect"
      lead_level: "reseau" | "patron" | "interne"
      member_role: "admin" | "member"
      revenue_source: "import" | "salesforce"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["suspect", "prospect", "client"],
      activity_line: ["talent", "emploi", "formation", "autre"],
      direction: ["direct", "indirect"],
      lead_level: ["reseau", "patron", "interne"],
      member_role: ["admin", "member"],
      revenue_source: ["import", "salesforce"],
    },
  },
} as const
