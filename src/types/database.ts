export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      inquiries: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          notes: string | null;
          price: number | null;
          product_id: string;
          status: Database["public"]["Enums"]["inquiry_status"];
          supplier_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          notes?: string | null;
          price?: number | null;
          product_id: string;
          status?: Database["public"]["Enums"]["inquiry_status"];
          supplier_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          notes?: string | null;
          price?: number | null;
          product_id?: string;
          status?: Database["public"]["Enums"]["inquiry_status"];
          supplier_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiries_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      photo_hashes: {
        Row: {
          alt_text: string;
          created_at: string;
          created_by: string;
          id: string;
          phash: string | null;
          product_id: string;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          alt_text?: string;
          created_at?: string;
          created_by: string;
          id?: string;
          phash?: string | null;
          product_id: string;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          alt_text?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          phash?: string | null;
          product_id?: string;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "photo_hashes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      similarity_matches: {
        Row: {
          created_at: string;
          distance: number;
          id: string;
          is_dismissed: boolean;
          matched_photo_hash_id: string;
          source_photo_hash_id: string;
        };
        Insert: {
          created_at?: string;
          distance: number;
          id?: string;
          is_dismissed?: boolean;
          matched_photo_hash_id: string;
          source_photo_hash_id: string;
        };
        Update: {
          created_at?: string;
          distance?: number;
          id?: string;
          is_dismissed?: boolean;
          matched_photo_hash_id?: string;
          source_photo_hash_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "similarity_matches_matched_photo_hash_id_fkey";
            columns: ["matched_photo_hash_id"];
            isOneToOne: false;
            referencedRelation: "photo_hashes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "similarity_matches_source_photo_hash_id_fkey";
            columns: ["source_photo_hash_id"];
            isOneToOne: false;
            referencedRelation: "photo_hashes";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          invited_by: string | null;
          is_active: boolean;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          invited_by?: string | null;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          brands: string[];
          created_at: string;
          created_by: string;
          id: string;
          is_flagged: boolean;
          name: string;
          negotiation_final_price: number | null;
          negotiation_opening_price: number | null;
          red_flag_source: string | null;
          trust_notes: string | null;
          updated_at: string;
          whatsapp_contact: string;
          yupoo_url: string;
        };
        Insert: {
          brands?: string[];
          created_at?: string;
          created_by: string;
          id?: string;
          is_flagged?: boolean;
          name: string;
          negotiation_final_price?: number | null;
          negotiation_opening_price?: number | null;
          red_flag_source?: string | null;
          trust_notes?: string | null;
          updated_at?: string;
          whatsapp_contact: string;
          yupoo_url: string;
        };
        Update: {
          brands?: string[];
          created_at?: string;
          created_by?: string;
          id?: string;
          is_flagged?: boolean;
          name?: string;
          negotiation_final_price?: number | null;
          negotiation_opening_price?: number | null;
          red_flag_source?: string | null;
          trust_notes?: string | null;
          updated_at?: string;
          whatsapp_contact?: string;
          yupoo_url?: string;
        };
        Relationships: [];
      };
      sources: {
        Row: {
          brands: string[];
          created_at: string;
          created_by: string;
          id: string;
          is_active: boolean;
          notes: string | null;
          platform: Database["public"]["Enums"]["platform_type"];
          updated_at: string;
          url: string;
        };
        Insert: {
          brands?: string[];
          created_at?: string;
          created_by: string;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          platform: Database["public"]["Enums"]["platform_type"];
          updated_at?: string;
          url: string;
        };
        Update: {
          brands?: string[];
          created_at?: string;
          created_by?: string;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          platform?: Database["public"]["Enums"]["platform_type"];
          updated_at?: string;
          url?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      inquiry_status:
        | "sent"
        | "price_received"
        | "negotiating"
        | "decided"
        | "ghosted";
      platform_type: "reddit" | "discord" | "whatsapp" | "other";
      user_role: "admin" | "member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
      user_role: ["admin", "member"],
    },
  },
} as const;
