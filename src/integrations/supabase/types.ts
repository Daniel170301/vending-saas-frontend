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
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profile: {
        Row: {
          address: string | null
          business_name: string
          business_type: string
          created_at: string
          currency: string
          doc_number: string | null
          doc_type: string | null
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_name: string
          business_type?: string
          created_at?: string
          currency?: string
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_name?: string
          business_type?: string
          created_at?: string
          currency?: string
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          active: boolean
          address: string | null
          company: string | null
          created_at: string
          doc_number: string | null
          doc_type: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          company?: string | null
          created_at?: string
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          address?: string | null
          company?: string | null
          created_at?: string
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string
          device_token: string
          id: string
          label: string | null
          last_seen_at: string | null
          machine_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_token: string
          id?: string
          label?: string | null
          last_seen_at?: string | null
          machine_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_token?: string
          id?: string
          label?: string | null
          last_seen_at?: string | null
          machine_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      machine_stock: {
        Row: {
          created_at: string
          id: string
          machine_id: string
          product_id: string
          quantity: number
          sale_price: number
          slot_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          machine_id: string
          product_id: string
          quantity?: number
          sale_price?: number
          slot_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          machine_id?: string
          product_id?: string
          quantity?: number
          sale_price?: number
          slot_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_stock_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          active: boolean
          bill_brand: string | null
          bill_enabled: boolean
          bill_model: string | null
          bill_plate: string | null
          brand: string | null
          code: string
          coin_base: number
          coin_brand: string | null
          coin_current: number
          coin_plate: string | null
          created_at: string
          id: string
          layout: Json | null
          location: string | null
          model: string | null
          name: string
          plate: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          bill_brand?: string | null
          bill_enabled?: boolean
          bill_model?: string | null
          bill_plate?: string | null
          brand?: string | null
          code: string
          coin_base?: number
          coin_brand?: string | null
          coin_current?: number
          coin_plate?: string | null
          created_at?: string
          id?: string
          layout?: Json | null
          location?: string | null
          model?: string | null
          name: string
          plate?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          bill_brand?: string | null
          bill_enabled?: boolean
          bill_model?: string | null
          bill_plate?: string | null
          brand?: string | null
          code?: string
          coin_base?: number
          coin_brand?: string | null
          coin_current?: number
          coin_plate?: string | null
          created_at?: string
          id?: string
          layout?: Json | null
          location?: string | null
          model?: string | null
          name?: string
          plate?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          min_stock: number
          name: string
          sale_price: number
          sku: string | null
          stock_warehouse: number
          subcategory: string | null
          unit_cost: number
          unit_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          sale_price?: number
          sku?: string | null
          stock_warehouse?: number
          subcategory?: string | null
          unit_cost?: number
          unit_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          sale_price?: number
          sku?: string | null
          stock_warehouse?: number
          subcategory?: string | null
          unit_cost?: number
          unit_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchased_at: string
          quantity: number
          supplier: string | null
          total: number
          transaction_id: string | null
          unit_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchased_at?: string
          quantity: number
          supplier?: string | null
          total: number
          transaction_id?: string | null
          unit_cost: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchased_at?: string
          quantity?: number
          supplier?: string | null
          total?: number
          transaction_id?: string | null
          unit_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          concept: string | null
          created_at: string
          id: string
          machine_id: string | null
          product_id: string | null
          quantity: number
          sold_at: string
          source: string
          total: number
          transaction_id: string | null
          unit_cost: number
          unit_price: number
          user_id: string
        }
        Insert: {
          concept?: string | null
          created_at?: string
          id?: string
          machine_id?: string | null
          product_id?: string | null
          quantity?: number
          sold_at?: string
          source?: string
          total: number
          transaction_id?: string | null
          unit_cost?: number
          unit_price: number
          user_id: string
        }
        Update: {
          concept?: string | null
          created_at?: string
          id?: string
          machine_id?: string | null
          product_id?: string | null
          quantity?: number
          sold_at?: string
          source?: string
          total?: number
          transaction_id?: string | null
          unit_cost?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          company: string | null
          created_at: string
          doc_number: string | null
          doc_type: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          company?: string | null
          created_at?: string
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          address?: string | null
          company?: string | null
          created_at?: string
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          concept: string | null
          created_at: string
          customer: string | null
          customer_company: string | null
          employee_id: string | null
          employee_name: string | null
          id: string
          kind: string
          notes: string | null
          number: number
          occurred_at: string
          payment_method: string | null
          profit: number
          subtotal: number
          total: number
          total_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          concept?: string | null
          created_at?: string
          customer?: string | null
          customer_company?: string | null
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          kind?: string
          notes?: string | null
          number: number
          occurred_at?: string
          payment_method?: string | null
          profit?: number
          subtotal?: number
          total?: number
          total_cost?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          concept?: string | null
          created_at?: string
          customer?: string | null
          customer_company?: string | null
          employee_id?: string | null
          employee_name?: string | null
          id?: string
          kind?: string
          notes?: string | null
          number?: number
          occurred_at?: string
          payment_method?: string | null
          profit?: number
          subtotal?: number
          total?: number
          total_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vending_consumptions: {
        Row: {
          consumed_at: string
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          machine_id: string
          notes: string | null
          product_id: string | null
          quantity: number
          sale_id: string | null
          slot_code: string | null
          status: string
          total: number
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          consumed_at?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          machine_id: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          sale_id?: string | null
          slot_code?: string | null
          status?: string
          total?: number
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          consumed_at?: string
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          machine_id?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          sale_id?: string | null
          slot_code?: string | null
          status?: string
          total?: number
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
