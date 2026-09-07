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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          active: boolean
          button_text: string | null
          created_at: string
          duration_seconds: number
          id: string
          link_url: string | null
          media_type: string
          media_url: string
          overlay_text: string | null
          page: string
          placement: string
          ribbon_color: string | null
          ribbon_position: string
          ribbon_text: string | null
          sort_order: number
          subtitle_text: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          button_text?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          link_url?: string | null
          media_type: string
          media_url: string
          overlay_text?: string | null
          page: string
          placement?: string
          ribbon_color?: string | null
          ribbon_position?: string
          ribbon_text?: string | null
          sort_order?: number
          subtitle_text?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          button_text?: string | null
          created_at?: string
          duration_seconds?: number
          id?: string
          link_url?: string | null
          media_type?: string
          media_url?: string
          overlay_text?: string | null
          page?: string
          placement?: string
          ribbon_color?: string | null
          ribbon_position?: string
          ribbon_text?: string | null
          sort_order?: number
          subtitle_text?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          business_city: string | null
          business_country: string | null
          business_email: string | null
          business_hours: string | null
          business_maps_url: string | null
          business_name: string | null
          business_phone: string | null
          business_state: string | null
          business_street: string | null
          business_zip: string | null
          default_description: string | null
          default_og_image: string | null
          default_title: string | null
          facebook_domain_verification: string | null
          facebook_page_url: string | null
          facebook_pixel_id: string | null
          ga4_measurement_id: string | null
          google_ads_conversion_id: string | null
          google_site_verification: string | null
          gtm_container_id: string | null
          id: string
          site_name: string
          site_url: string | null
          updated_at: string
        }
        Insert: {
          business_city?: string | null
          business_country?: string | null
          business_email?: string | null
          business_hours?: string | null
          business_maps_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_state?: string | null
          business_street?: string | null
          business_zip?: string | null
          default_description?: string | null
          default_og_image?: string | null
          default_title?: string | null
          facebook_domain_verification?: string | null
          facebook_page_url?: string | null
          facebook_pixel_id?: string | null
          ga4_measurement_id?: string | null
          google_ads_conversion_id?: string | null
          google_site_verification?: string | null
          gtm_container_id?: string | null
          id?: string
          site_name?: string
          site_url?: string | null
          updated_at?: string
        }
        Update: {
          business_city?: string | null
          business_country?: string | null
          business_email?: string | null
          business_hours?: string | null
          business_maps_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_state?: string | null
          business_street?: string | null
          business_zip?: string | null
          default_description?: string | null
          default_og_image?: string | null
          default_title?: string | null
          facebook_domain_verification?: string | null
          facebook_page_url?: string | null
          facebook_pixel_id?: string | null
          ga4_measurement_id?: string | null
          google_ads_conversion_id?: string | null
          google_site_verification?: string | null
          gtm_container_id?: string | null
          id?: string
          site_name?: string
          site_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      page_seo: {
        Row: {
          description: string | null
          id: string
          noindex: boolean
          og_image: string | null
          page_key: string
          title: string | null
          updated_at: string
        }
        Insert: {
          description?: string | null
          id?: string
          noindex?: boolean
          og_image?: string | null
          page_key: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          description?: string | null
          id?: string
          noindex?: boolean
          og_image?: string | null
          page_key?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_seo: {
        Row: {
          description: string | null
          noindex: boolean
          og_image: string | null
          product_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          description?: string | null
          noindex?: boolean
          og_image?: string | null
          product_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          description?: string | null
          noindex?: boolean
          og_image?: string | null
          product_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          canal_principal: string | null
          contato_responsavel: string | null
          created_at: string
          email: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_estado: string | null
          endereco_pais: string | null
          endereco_rua: string | null
          id: string
          nome_razao: string
          observacoes: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["client_type"]
          updated_at: string
        }
        Insert: {
          canal_principal?: string | null
          contato_responsavel?: string | null
          created_at?: string
          email?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_estado?: string | null
          endereco_pais?: string | null
          endereco_rua?: string | null
          id?: string
          nome_razao: string
          observacoes?: string | null
          telefone?: string | null
          tipo: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Update: {
          canal_principal?: string | null
          contato_responsavel?: string | null
          created_at?: string
          email?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_estado?: string | null
          endereco_pais?: string | null
          endereco_rua?: string | null
          id?: string
          nome_razao?: string
          observacoes?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          stripe_coupon_id: string | null
          stripe_promotion_code_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          stripe_coupon_id?: string | null
          stripe_promotion_code_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expired_products: {
        Row: {
          created_at: string
          data_identificacao: string
          destino: string | null
          id: string
          observacoes: string | null
          product_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          data_identificacao?: string
          destino?: string | null
          id?: string
          observacoes?: string | null
          product_id: string
          quantidade: number
        }
        Update: {
          created_at?: string
          data_identificacao?: string
          destino?: string | null
          id?: string
          observacoes?: string | null
          product_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "expired_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          categoria: string
          comprovante_url: string | null
          created_at: string
          data: string
          descricao: string
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria: string
          comprovante_url?: string | null
          created_at?: string
          data?: string
          descricao: string
          id?: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          comprovante_url?: string | null
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          asin: string | null
          created_at: string
          custo_unitario: number
          ebay_line_item_id: string | null
          frete_unitario: number
          id: string
          imposto_unitario: number
          order_id: string
          preco_unitario: number
          product_id: string | null
          quantidade: number
          sku: string | null
        }
        Insert: {
          asin?: string | null
          created_at?: string
          custo_unitario?: number
          ebay_line_item_id?: string | null
          frete_unitario?: number
          id?: string
          imposto_unitario?: number
          order_id: string
          preco_unitario: number
          product_id?: string | null
          quantidade: number
          sku?: string | null
        }
        Update: {
          asin?: string | null
          created_at?: string
          custo_unitario?: number
          ebay_line_item_id?: string | null
          frete_unitario?: number
          id?: string
          imposto_unitario?: number
          order_id?: string
          preco_unitario?: number
          product_id?: string | null
          quantidade?: number
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          canal: Database["public"]["Enums"]["sales_channel"]
          carrier: string | null
          client_id: string | null
          comissao_ebay: number | null
          created_at: string
          custo_total_shipping: number | null
          data_pedido: string
          descontos: number
          diferente: number
          estoque_devolvido: boolean
          forma_pagamento: string | null
          frete_total: number
          id: string
          impostos: number
          numero_pedido_canal: string | null
          observacoes: string | null
          promoted_listings: number | null
          shipping_tracking: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
        }
        Insert: {
          canal?: Database["public"]["Enums"]["sales_channel"]
          carrier?: string | null
          client_id?: string | null
          comissao_ebay?: number | null
          created_at?: string
          custo_total_shipping?: number | null
          data_pedido?: string
          descontos?: number
          diferente?: number
          estoque_devolvido?: boolean
          forma_pagamento?: string | null
          frete_total?: number
          id?: string
          impostos?: number
          numero_pedido_canal?: string | null
          observacoes?: string | null
          promoted_listings?: number | null
          shipping_tracking?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Update: {
          canal?: Database["public"]["Enums"]["sales_channel"]
          carrier?: string | null
          client_id?: string | null
          comissao_ebay?: number | null
          created_at?: string
          custo_total_shipping?: number | null
          data_pedido?: string
          descontos?: number
          diferente?: number
          estoque_devolvido?: boolean
          forma_pagamento?: string | null
          frete_total?: number
          id?: string
          impostos?: number
          numero_pedido_canal?: string | null
          observacoes?: string | null
          promoted_listings?: number | null
          shipping_tracking?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          "Custo por unidade (Minimo)": string | null
          "Frete (Unidade)": string | null
          id: string
          image_url: string | null
          "Informacoes dos produtos / descricao": string | null
          "Linha do produto": string | null
          "Lucro sobre produt (Revendedor)": string | null
          "Lucro sobre produto (Cabeleireira)": string | null
          "Lucro sobre produto (Online)": string | null
          Marca: string | null
          "Margem Lucro (Cabeleireira)": string | null
          "Margem Lucro (Online)": string | null
          "Margem Lucro (Revendedor)": string | null
          "Produto Nome": string | null
          "Qtd. Vendida por caixa": string | null
          "Quantidade no Estoque": string | null
          SKU: string | null
          ASIN: string | null
          UPC: string | null
          EAN: string | null
          "Valor de venda (Cabeleireira Salao)": string | null
          "Valor de venda (Online)": string | null
          "Valor de venda (Revendedor)": string | null
          Volume: string | null
          store_visible: boolean
          store_category: string | null
          gallery_urls: Json
          drive_link: string | null
          details: Json
          store_categories: Json
          ribbon_text: string | null
          ribbon_color: string | null
          sale_price: string | null
        }
        Insert: {
          "Custo por unidade (Minimo)"?: string | null
          "Frete (Unidade)"?: string | null
          id?: string
          image_url?: string | null
          "Informacoes dos produtos / descricao"?: string | null
          "Linha do produto"?: string | null
          "Lucro sobre produt (Revendedor)"?: string | null
          "Lucro sobre produto (Cabeleireira)"?: string | null
          "Lucro sobre produto (Online)"?: string | null
          Marca?: string | null
          "Margem Lucro (Cabeleireira)"?: string | null
          "Margem Lucro (Online)"?: string | null
          "Margem Lucro (Revendedor)"?: string | null
          "Produto Nome"?: string | null
          "Qtd. Vendida por caixa"?: string | null
          "Quantidade no Estoque"?: string | null
          SKU?: string | null
          ASIN?: string | null
          UPC?: string | null
          EAN?: string | null
          "Valor de venda (Cabeleireira Salao)"?: string | null
          "Valor de venda (Online)"?: string | null
          "Valor de venda (Revendedor)"?: string | null
          Volume?: string | null
          store_visible?: boolean
          store_category?: string | null
          gallery_urls?: Json
          drive_link?: string | null
          details?: Json
          store_categories?: Json
          ribbon_text?: string | null
          ribbon_color?: string | null
          sale_price?: string | null
        }
        Update: {
          "Custo por unidade (Minimo)"?: string | null
          "Frete (Unidade)"?: string | null
          id?: string
          image_url?: string | null
          "Informacoes dos produtos / descricao"?: string | null
          "Linha do produto"?: string | null
          "Lucro sobre produt (Revendedor)"?: string | null
          "Lucro sobre produto (Cabeleireira)"?: string | null
          "Lucro sobre produto (Online)"?: string | null
          Marca?: string | null
          "Margem Lucro (Cabeleireira)"?: string | null
          "Margem Lucro (Online)"?: string | null
          "Margem Lucro (Revendedor)"?: string | null
          "Produto Nome"?: string | null
          "Qtd. Vendida por caixa"?: string | null
          "Quantidade no Estoque"?: string | null
          SKU?: string | null
          ASIN?: string | null
          UPC?: string | null
          EAN?: string | null
          "Valor de venda (Cabeleireira Salao)"?: string | null
          "Valor de venda (Online)"?: string | null
          "Valor de venda (Revendedor)"?: string | null
          Volume?: string | null
          store_visible?: boolean
          store_category?: string | null
          gallery_urls?: Json
          drive_link?: string | null
          details?: Json
          store_categories?: Json
          ribbon_text?: string | null
          ribbon_color?: string | null
          sale_price?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      calculate_margin_online: {
        Args: {
          p_custo: number
          p_frete: number
          p_imposto: number
          p_preco: number
        }
        Returns: number
      }
      calculate_margin_revendedor: {
        Args: {
          p_custo: number
          p_frete: number
          p_imposto: number
          p_preco: number
        }
        Returns: number
      }
      calculate_margin_salao: {
        Args: {
          p_custo: number
          p_frete: number
          p_imposto: number
          p_preco: number
        }
        Returns: number
      }
      calculate_order_totals: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      calculate_validity_status: {
        Args: { p_data_validade: string }
        Returns: Database["public"]["Enums"]["validity_status"]
      }
      ensure_profile: {
        Args: never
        Returns: {
          created_at: string
          display_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      restore_stock_for_cancelled_order: {
        Args: {
          p_order_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "operador" | "leitura"
      client_type:
        | "Salão/Cabeleireira"
        | "Revendedor"
        | "Online/Marketplace"
        | "Cliente Final"
      order_status: "Orçado" | "Pago" | "Enviado" | "Entregue" | "Cancelado"
      product_brand:
        | "Sorali"
        | "Just Sofistic"
        | "Argilo Detox"
        | "Daily Therapy"
      sales_channel:
        | "Presencial"
        | "Amazon"
        | "eBay"
        | "Etsy"
        | "TikTok"
        | "Vertex Rental Cars"
        | "Credit Card"
        | "Zelle"
        | "Online"
        | "WhatsApp"
        | "Outro"
      validity_status: "Válido" | "Vencendo em 60 dias" | "Vencido"
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
      app_role: ["admin", "operador", "leitura"],
      client_type: [
        "Salão/Cabeleireira",
        "Revendedor",
        "Online/Marketplace",
        "Cliente Final",
      ],
      order_status: ["Orçado", "Pago", "Enviado", "Entregue", "Cancelado"],
      product_brand: [
        "Sorali",
        "Just Sofistic",
        "Argilo Detox",
        "Daily Therapy",
      ],
      sales_channel: [
        "Presencial",
        "Amazon",
        "eBay",
        "Etsy",
        "TikTok",
        "Vertex Rental Cars",
        "Credit Card",
        "Zelle",
        "Online",
        "WhatsApp",
        "Outro",
      ],
      validity_status: ["Válido", "Vencendo em 60 dias", "Vencido"],
    },
  },
} as const
