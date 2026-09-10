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
          created_at: string
          created_by: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          created_by: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          acceptance_date: string | null
          advance_info: string | null
          assignee_id: string | null
          contract_number: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          duration: string | null
          end_date: string | null
          guarantee_expiry: string | null
          guarantee_info: string | null
          id: string
          notes: string | null
          payment_terms: string | null
          project_id: string | null
          sign_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          tender_id: string | null
          title: string | null
          total_value: number
          updated_at: string
          updated_by: string | null
          value_before_vat: number | null
          vat_amount: number | null
          vat_rate: number | null
          warranty_expiry: string | null
          warranty_info: string | null
        }
        Insert: {
          acceptance_date?: string | null
          advance_info?: string | null
          assignee_id?: string | null
          contract_number: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          duration?: string | null
          end_date?: string | null
          guarantee_expiry?: string | null
          guarantee_info?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          project_id?: string | null
          sign_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tender_id?: string | null
          title?: string | null
          total_value?: number
          updated_at?: string
          updated_by?: string | null
          value_before_vat?: number | null
          vat_amount?: number | null
          vat_rate?: number | null
          warranty_expiry?: string | null
          warranty_info?: string | null
        }
        Update: {
          acceptance_date?: string | null
          advance_info?: string | null
          assignee_id?: string | null
          contract_number?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          duration?: string | null
          end_date?: string | null
          guarantee_expiry?: string | null
          guarantee_info?: string | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          project_id?: string | null
          sign_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tender_id?: string | null
          title?: string | null
          total_value?: number
          updated_at?: string
          updated_by?: string | null
          value_before_vat?: number | null
          vat_amount?: number | null
          vat_rate?: number | null
          warranty_expiry?: string | null
          warranty_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          representative: string | null
          representative_title: string | null
          tax_code: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          representative?: string | null
          representative_title?: string | null
          tax_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          representative?: string | null
          representative_title?: string | null
          tax_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      document_extractions: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          model: string | null
          needs_review: boolean
          overall_confidence: number | null
          raw_json: Json
          rejected_reason: string | null
          reviewed_json: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          model?: string | null
          needs_review?: boolean
          overall_confidence?: number | null
          raw_json?: Json
          rejected_reason?: string | null
          reviewed_json?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          model?: string | null
          needs_review?: boolean
          overall_confidence?: number | null
          raw_json?: Json
          rejected_reason?: string | null
          reviewed_json?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_fields: {
        Row: {
          bbox_height: number | null
          bbox_left: number | null
          bbox_top: number | null
          bbox_width: number | null
          confidence: number
          created_at: string
          created_by: string | null
          document_id: string
          field_key: string
          id: string
          label: string
          needs_review: boolean
          sort_order: number
          source_page: number | null
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          bbox_height?: number | null
          bbox_left?: number | null
          bbox_top?: number | null
          bbox_width?: number | null
          confidence?: number
          created_at?: string
          created_by?: string | null
          document_id: string
          field_key: string
          id?: string
          label: string
          needs_review?: boolean
          sort_order?: number
          source_page?: number | null
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          bbox_height?: number | null
          bbox_left?: number | null
          bbox_top?: number | null
          bbox_width?: number | null
          confidence?: number
          created_at?: string
          created_by?: string | null
          document_id?: string
          field_key?: string
          id?: string
          label?: string
          needs_review?: boolean
          sort_order?: number
          source_page?: number | null
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_fields_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          contract_id: string | null
          created_at: string
          created_by: string | null
          doc_type_code: string | null
          doc_type_confidence: number | null
          file_name: string
          file_size: number | null
          folder: string
          id: string
          mime_type: string | null
          notes: string | null
          ocr_error: string | null
          ocr_provider: string | null
          ocr_text: string | null
          page_count: number | null
          payment_id: string | null
          project_id: string | null
          replaces_id: string | null
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          tender_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_type_code?: string | null
          doc_type_confidence?: number | null
          file_name: string
          file_size?: number | null
          folder?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          ocr_error?: string | null
          ocr_provider?: string | null
          ocr_text?: string | null
          page_count?: number | null
          payment_id?: string | null
          project_id?: string | null
          replaces_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path: string
          tender_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_type_code?: string | null
          doc_type_confidence?: number | null
          file_name?: string
          file_size?: number | null
          folder?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          ocr_error?: string | null
          ocr_provider?: string | null
          ocr_text?: string | null
          page_count?: number | null
          payment_id?: string | null
          project_id?: string | null
          replaces_id?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string
          tender_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_replaces_id_fkey"
            columns: ["replaces_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tender_id_fkey"
            columns: ["tender_id"]
            isOneToOne: false
            referencedRelation: "tenders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          level: string
          read_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          level?: string
          read_at?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          level?: string
          read_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          assignee_id: string | null
          contract_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          installment_no: number
          notes: string | null
          override_reason: string | null
          paid_date: string | null
          request_date: string | null
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at: string
          updated_by: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          assignee_id?: string | null
          contract_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          installment_no?: number
          notes?: string | null
          override_reason?: string | null
          paid_date?: string | null
          request_date?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          assignee_id?: string | null
          contract_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          installment_no?: number
          notes?: string | null
          override_reason?: string | null
          paid_date?: string | null
          request_date?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          position: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          position?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          position?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          funding_source: string | null
          id: string
          location: string | null
          name: string
          owner_id: string | null
          project_type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          funding_source?: string | null
          id?: string
          location?: string | null
          name: string
          owner_id?: string | null
          project_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          funding_source?: string | null
          id?: string
          location?: string | null
          name?: string
          owner_id?: string | null
          project_type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      template_fields: {
        Row: {
          created_at: string
          created_by: string | null
          default_value: string | null
          format: string | null
          id: string
          label: string | null
          placeholder: string
          source_entity: string | null
          source_field: string | null
          template_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          format?: string | null
          id?: string
          label?: string | null
          placeholder: string
          source_entity?: string | null
          source_field?: string | null
          template_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_value?: string | null
          format?: string | null
          id?: string
          label?: string | null
          placeholder?: string
          source_entity?: string | null
          source_field?: string | null
          template_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          placeholder: string
          sort_order: number
          source_field: string | null
          template_id: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label: string
          placeholder: string
          sort_order?: number
          source_field?: string | null
          template_id: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          placeholder?: string
          sort_order?: number
          source_field?: string | null
          template_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_mappings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          body: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_name: string | null
          id: string
          is_default: boolean
          mime_type: string | null
          name: string
          parent_id: string | null
          storage_path: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string | null
          id?: string
          is_default?: boolean
          mime_type?: string | null
          name: string
          parent_id?: string | null
          storage_path?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_name?: string | null
          id?: string
          is_default?: boolean
          mime_type?: string | null
          name?: string
          parent_id?: string | null
          storage_path?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "templates_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tenders: {
        Row: {
          assignee_id: string | null
          bid_value: number | null
          code: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          duration: string | null
          funding_source: string | null
          id: string
          invited_by: string | null
          issue_date: string | null
          location: string | null
          name: string
          notes: string | null
          open_date: string | null
          package_value: number | null
          project_id: string | null
          result_date: string | null
          status: Database["public"]["Enums"]["tender_status"]
          submit_deadline: string | null
          tender_type: string | null
          updated_at: string
          updated_by: string | null
          won_value: number | null
        }
        Insert: {
          assignee_id?: string | null
          bid_value?: number | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          duration?: string | null
          funding_source?: string | null
          id?: string
          invited_by?: string | null
          issue_date?: string | null
          location?: string | null
          name: string
          notes?: string | null
          open_date?: string | null
          package_value?: number | null
          project_id?: string | null
          result_date?: string | null
          status?: Database["public"]["Enums"]["tender_status"]
          submit_deadline?: string | null
          tender_type?: string | null
          updated_at?: string
          updated_by?: string | null
          won_value?: number | null
        }
        Update: {
          assignee_id?: string | null
          bid_value?: number | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          duration?: string | null
          funding_source?: string | null
          id?: string
          invited_by?: string | null
          issue_date?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          open_date?: string | null
          package_value?: number | null
          project_id?: string | null
          result_date?: string | null
          status?: Database["public"]["Enums"]["tender_status"]
          submit_deadline?: string | null
          tender_type?: string | null
          updated_at?: string
          updated_by?: string | null
          won_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "commercial"
        | "contract"
        | "payment"
        | "viewer"
      contract_status:
        | "not_started"
        | "in_progress"
        | "expiring"
        | "expired"
        | "completed"
        | "liquidated"
      doc_status:
        | "new"
        | "ocr_done"
        | "extracted"
        | "pending_review"
        | "approved"
        | "rejected"
        | "archived"
      payment_status: "draft" | "pending" | "approved" | "rejected" | "paid"
      tender_status:
        | "preparing"
        | "submitted"
        | "evaluating"
        | "won"
        | "lost"
        | "cancelled"
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
  public: {
    Enums: {
      app_role: [
        "admin",
        "manager",
        "commercial",
        "contract",
        "payment",
        "viewer",
      ],
      contract_status: [
        "not_started",
        "in_progress",
        "expiring",
        "expired",
        "completed",
        "liquidated",
      ],
      doc_status: [
        "new",
        "ocr_done",
        "extracted",
        "pending_review",
        "approved",
        "rejected",
        "archived",
      ],
      payment_status: ["draft", "pending", "approved", "rejected", "paid"],
      tender_status: [
        "preparing",
        "submitted",
        "evaluating",
        "won",
        "lost",
        "cancelled",
      ],
    },
  },
} as const
