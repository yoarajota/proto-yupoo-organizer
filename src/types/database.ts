export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      inquiries: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string | null
          price: number | null
          product_id: string
          status: Database["public"]["Enums"]["inquiry_status"]
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          price?: number | null
          product_id: string
          status?: Database["public"]["Enums"]["inquiry_status"]
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          price?: number | null
          product_id?: string
          status?: Database["public"]["Enums"]["inquiry_status"]
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_hashes: {
        Row: {
          alt_text: string
          created_at: string
          created_by: string
          id: string
          phash: string | null
          product_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          alt_text?: string
          created_at?: string
          created_by: string
          id?: string
          phash?: string | null
          product_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          created_by?: string
          id?: string
          phash?: string | null
          product_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_hashes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_hashes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          product_type_id: string | null
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          product_type_id?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          product_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      discovered_categories: {
        Row: {
          brand_signal: string | null
          category_path: string[]
          classification_confidence: number | null
          classification_method: string | null
          classification_status: string
          confidence: number
          created_at: string
          extracted_at: string
          id: string
          mission_id: string
          normalized_label: string | null
          preview_image_urls: string[]
          product_signal: string | null
          raw_label: string
          source_url: string
        }
        Insert: {
          brand_signal?: string | null
          category_path: string[]
          classification_confidence?: number | null
          classification_method?: string | null
          classification_status?: string
          confidence?: number
          created_at?: string
          extracted_at?: string
          id?: string
          mission_id: string
          normalized_label?: string | null
          preview_image_urls?: string[]
          product_signal?: string | null
          raw_label?: string
          source_url: string
        }
        Update: {
          brand_signal?: string | null
          category_path?: string[]
          classification_confidence?: number | null
          classification_method?: string | null
          classification_status?: string
          confidence?: number
          created_at?: string
          extracted_at?: string
          id?: string
          mission_id?: string
          normalized_label?: string | null
          preview_image_urls?: string[]
          product_signal?: string | null
          raw_label?: string
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovered_categories_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "sourcing_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      discovered_suppliers: {
        Row: {
          category_refs: string[]
          confidence: number
          created_at: string
          id: string
          last_seen_at: string
          mission_id: string
          normalized_category_refs: string[]
          source_url: string
          supplier_key: string
          updated_at: string
        }
        Insert: {
          category_refs?: string[]
          confidence?: number
          created_at?: string
          id?: string
          last_seen_at?: string
          mission_id: string
          normalized_category_refs?: string[]
          source_url: string
          supplier_key: string
          updated_at?: string
        }
        Update: {
          category_refs?: string[]
          confidence?: number
          created_at?: string
          id?: string
          last_seen_at?: string
          mission_id?: string
          normalized_category_refs?: string[]
          source_url?: string
          supplier_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovered_suppliers_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "sourcing_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_category_classifications: {
        Row: {
          canonical_brand: string | null
          canonical_product_type: string | null
          classification_confidence: number | null
          classification_method: string
          classification_status: string
          created_at: string
          display_label: string
          evidence: Json
          id: string
          mission_id: string
          source_category_id: string
          updated_at: string
        }
        Insert: {
          canonical_brand?: string | null
          canonical_product_type?: string | null
          classification_confidence?: number | null
          classification_method: string
          classification_status: string
          created_at?: string
          display_label: string
          evidence?: Json
          id?: string
          mission_id: string
          source_category_id: string
          updated_at?: string
        }
        Update: {
          canonical_brand?: string | null
          canonical_product_type?: string | null
          classification_confidence?: number | null
          classification_method?: string
          classification_status?: string
          created_at?: string
          display_label?: string
          evidence?: Json
          id?: string
          mission_id?: string
          source_category_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_category_classifications_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "sourcing_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_category_classifications_source_category_id_fkey"
            columns: ["source_category_id"]
            isOneToOne: false
            referencedRelation: "discovered_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_supplier_matches: {
        Row: {
          created_at: string
          id: string
          mission_id: string
          rank_reasons: Json
          rank_score: number
          supplier_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id: string
          rank_reasons?: Json
          rank_score: number
          supplier_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string
          rank_reasons?: Json
          rank_score?: number
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_supplier_matches_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "sourcing_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_supplier_matches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "discovered_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      similarity_matches: {
        Row: {
          created_at: string
          distance: number
          id: string
          is_dismissed: boolean
          matched_photo_hash_id: string
          source_photo_hash_id: string
        }
        Insert: {
          created_at?: string
          distance: number
          id?: string
          is_dismissed?: boolean
          matched_photo_hash_id: string
          source_photo_hash_id: string
        }
        Update: {
          created_at?: string
          distance?: number
          id?: string
          is_dismissed?: boolean
          matched_photo_hash_id?: string
          source_photo_hash_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "similarity_matches_matched_photo_hash_id_fkey"
            columns: ["matched_photo_hash_id"]
            isOneToOne: false
            referencedRelation: "photo_hashes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "similarity_matches_source_photo_hash_id_fkey"
            columns: ["source_photo_hash_id"]
            isOneToOne: false
            referencedRelation: "photo_hashes"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_mission_stage_metrics: {
        Row: {
          created_at: string
          duration_ms: number | null
          finished_at: string | null
          id: string
          mission_id: string
          stage_name: string
          started_at: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          mission_id: string
          stage_name: string
          started_at: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          mission_id?: string
          stage_name?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_mission_stage_metrics_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "sourcing_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      sourcing_missions: {
        Row: {
          constraints: Json
          created_at: string
          created_by: string
          destination_context: string | null
          first_suggestion_batch_at: string | null
          first_valid_quote_at: string | null
          id: string
          objective: string
          product_intent: string
          seed_url: string
          status: Database["public"]["Enums"]["sourcing_mission_status"]
          updated_at: string
        }
        Insert: {
          constraints?: Json
          created_at?: string
          created_by: string
          destination_context?: string | null
          first_suggestion_batch_at?: string | null
          first_valid_quote_at?: string | null
          id?: string
          objective?: string
          product_intent: string
          seed_url: string
          status?: Database["public"]["Enums"]["sourcing_mission_status"]
          updated_at?: string
        }
        Update: {
          constraints?: Json
          created_at?: string
          created_by?: string
          destination_context?: string | null
          first_suggestion_batch_at?: string | null
          first_valid_quote_at?: string | null
          id?: string
          objective?: string
          product_intent?: string
          seed_url?: string
          status?: Database["public"]["Enums"]["sourcing_mission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourcing_missions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          brands: string[] | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          notes: string | null
          platform: Database["public"]["Enums"]["platform_type"]
          updated_at: string
          url: string
        }
        Insert: {
          brands?: string[] | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          notes?: string | null
          platform: Database["public"]["Enums"]["platform_type"]
          updated_at?: string
          url: string
        }
        Update: {
          brands?: string[] | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          platform?: Database["public"]["Enums"]["platform_type"]
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_flagged: boolean
          name: string
          negotiation_final_price: number | null
          negotiation_opening_price: number | null
          red_flag_source: string | null
          trust_notes: string | null
          updated_at: string
          whatsapp_contact: string
          yupoo_url: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_flagged?: boolean
          name: string
          negotiation_final_price?: number | null
          negotiation_opening_price?: number | null
          red_flag_source?: string | null
          trust_notes?: string | null
          updated_at?: string
          whatsapp_contact: string
          yupoo_url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_flagged?: boolean
          name?: string
          negotiation_final_price?: number | null
          negotiation_opening_price?: number | null
          red_flag_source?: string | null
          trust_notes?: string | null
          updated_at?: string
          whatsapp_contact?: string
          yupoo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_brands: {
        Row: {
          brand_id: string
          created_at: string
          supplier_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          supplier_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_brands_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_brands_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_product_types: {
        Row: {
          created_at: string
          product_type_id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          product_type_id: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          product_type_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_product_types_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_product_types_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      inquiry_status:
        | "sent"
        | "price_received"
        | "negotiating"
        | "decided"
        | "ghosted"
      platform_type: "reddit" | "discord" | "whatsapp" | "other"
      sourcing_mission_status:
        | "created"
        | "scanning"
        | "classifying_categories"
        | "matching"
        | "suggestions_ready"
        | "awaiting_approval"
        | "approved_for_outreach"
        | "replies_received"
        | "offers_normalized"
        | "completed"
        | "blocked_needs_input"
        | "failed_retrying"
        | "failed_terminal"
      user_role: "admin" | "member"
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
      inquiry_status: [
        "sent",
        "price_received",
        "negotiating",
        "decided",
        "ghosted",
      ],
      platform_type: ["reddit", "discord", "whatsapp", "other"],
      sourcing_mission_status: [
        "created",
        "scanning",
        "classifying_categories",
        "matching",
        "suggestions_ready",
        "awaiting_approval",
        "approved_for_outreach",
        "replies_received",
        "offers_normalized",
        "completed",
        "blocked_needs_input",
        "failed_retrying",
        "failed_terminal",
      ],
      user_role: ["admin", "member"],
    },
  },
} as const
