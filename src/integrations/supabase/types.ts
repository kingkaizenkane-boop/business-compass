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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          business_id: string
          conversation_type: string
          created_at: string
          id: string
          model: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          business_id: string
          conversation_type: string
          created_at?: string
          id?: string
          model?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          business_id?: string
          conversation_type?: string
          created_at?: string
          id?: string
          model?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory: {
        Row: {
          business_id: string
          confidence: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          importance: number
          memory_type: string
          metadata: Json
          source_id: string | null
          source_table: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          confidence?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance?: number
          memory_type: string
          metadata?: Json
          source_id?: string | null
          source_table?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          confidence?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          importance?: number
          memory_type?: string
          metadata?: Json
          source_id?: string | null
          source_table?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          role: string
          structured_output: Json | null
          token_count: number | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          structured_output?: Json | null
          token_count?: number | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          structured_output?: Json | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_fact_evidence: {
        Row: {
          evidence_id: string
          fact_id: string
          relevance: number
        }
        Insert: {
          evidence_id: string
          fact_id: string
          relevance?: number
        }
        Update: {
          evidence_id?: string
          fact_id?: string
          relevance?: number
        }
        Relationships: [
          {
            foreignKeyName: "brain_fact_evidence_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_fact_evidence_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "brain_facts"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_fact_relationships: {
        Row: {
          business_id: string
          confidence: number
          created_at: string
          id: string
          relationship_type: string
          source_fact_id: string
          target_fact_id: string
        }
        Insert: {
          business_id: string
          confidence?: number
          created_at?: string
          id?: string
          relationship_type: string
          source_fact_id: string
          target_fact_id: string
        }
        Update: {
          business_id?: string
          confidence?: number
          created_at?: string
          id?: string
          relationship_type?: string
          source_fact_id?: string
          target_fact_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_fact_relationships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_fact_relationships_source_fact_id_fkey"
            columns: ["source_fact_id"]
            isOneToOne: false
            referencedRelation: "brain_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_fact_relationships_target_fact_id_fkey"
            columns: ["target_fact_id"]
            isOneToOne: false
            referencedRelation: "brain_facts"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_facts: {
        Row: {
          active: boolean
          business_id: string
          category: string
          confidence: number
          confidence_level: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          created_by: string | null
          fact_key: string
          fact_type: Database["public"]["Enums"]["fact_type"]
          id: string
          source_id: string | null
          source_type: Database["public"]["Enums"]["evidence_type"] | null
          subcategory: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          value_boolean: boolean | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
          verified: boolean
          version: number
        }
        Insert: {
          active?: boolean
          business_id: string
          category: string
          confidence?: number
          confidence_level?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          created_by?: string | null
          fact_key: string
          fact_type?: Database["public"]["Enums"]["fact_type"]
          id?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["evidence_type"] | null
          subcategory?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          value_boolean?: boolean | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
          verified?: boolean
          version?: number
        }
        Update: {
          active?: boolean
          business_id?: string
          category?: string
          confidence?: number
          confidence_level?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          created_by?: string | null
          fact_key?: string
          fact_type?: Database["public"]["Enums"]["fact_type"]
          id?: string
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["evidence_type"] | null
          subcategory?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          value_boolean?: boolean | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
          verified?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "brain_facts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_offers: {
        Row: {
          business_id: string
          created_at: string
          currency: string | null
          description: string | null
          guarantee: string | null
          id: string
          metadata: Json
          name: string
          offer_type: string | null
          price: number | null
          status: string
          target_customer: string | null
          transformation: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          guarantee?: string | null
          id?: string
          metadata?: Json
          name: string
          offer_type?: string | null
          price?: number | null
          status?: string
          target_customer?: string | null
          transformation?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          guarantee?: string | null
          id?: string
          metadata?: Json
          name?: string
          offer_type?: string | null
          price?: number | null
          status?: string
          target_customer?: string | null
          transformation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_offers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_services: {
        Row: {
          active: boolean
          business_id: string
          capacity: number | null
          cost_estimate: number | null
          created_at: string
          currency: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          metadata: Json
          name: string
          price: number | null
          pricing_model: string | null
          service_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          capacity?: number | null
          cost_estimate?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          metadata?: Json
          name: string
          price?: number | null
          pricing_model?: string | null
          service_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          capacity?: number | null
          cost_estimate?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          metadata?: Json
          name?: string
          price?: number | null
          pricing_model?: string | null
          service_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          business_model: string | null
          created_at: string
          customer_model: string | null
          description: string | null
          employee_count: number | null
          founded_year: number | null
          id: string
          industry: string | null
          legal_name: string | null
          metadata: Json
          name: string
          organization_id: string
          primary_location: Json | null
          service_area: Json | null
          slug: string
          status: string
          sub_industry: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          business_model?: string | null
          created_at?: string
          customer_model?: string | null
          description?: string | null
          employee_count?: number | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          legal_name?: string | null
          metadata?: Json
          name: string
          organization_id: string
          primary_location?: Json | null
          service_area?: Json | null
          slug: string
          status?: string
          sub_industry?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          business_model?: string | null
          created_at?: string
          customer_model?: string | null
          description?: string | null
          employee_count?: number | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          legal_name?: string | null
          metadata?: Json
          name?: string
          organization_id?: string
          primary_location?: Json | null
          service_area?: Json | null
          slug?: string
          status?: string
          sub_industry?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          business_id: string
          content_text: string | null
          created_at: string
          created_by: string | null
          description: string | null
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          id: string
          metadata: Json
          source_url: string | null
          storage_path: string | null
          title: string | null
          verified: boolean
        }
        Insert: {
          business_id: string
          content_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          id?: string
          metadata?: Json
          source_url?: string | null
          storage_path?: string | null
          title?: string | null
          verified?: boolean
        }
        Update: {
          business_id?: string
          content_text?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          id?: string
          metadata?: Json
          source_url?: string | null
          storage_path?: string | null
          title?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "evidence_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_questions: {
        Row: {
          ai_generated: boolean
          condition: Json | null
          extraction_schema: Json | null
          help_text: string | null
          id: string
          question_key: string
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          required: boolean
          sequence: number | null
          stage_id: string
          validation_rules: Json | null
        }
        Insert: {
          ai_generated?: boolean
          condition?: Json | null
          extraction_schema?: Json | null
          help_text?: string | null
          id?: string
          question_key: string
          question_text: string
          question_type: Database["public"]["Enums"]["question_type"]
          required?: boolean
          sequence?: number | null
          stage_id: string
          validation_rules?: Json | null
        }
        Update: {
          ai_generated?: boolean
          condition?: Json | null
          extraction_schema?: Json | null
          help_text?: string | null
          id?: string
          question_key?: string
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type"]
          required?: boolean
          sequence?: number | null
          stage_id?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "interview_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_responses: {
        Row: {
          answered_at: string
          confidence: number | null
          created_at: string
          id: string
          question_id: string | null
          question_key: string
          raw_response: string | null
          session_id: string
          status: Database["public"]["Enums"]["response_status"]
          structured_response: Json | null
          supersedes_response_id: string | null
        }
        Insert: {
          answered_at?: string
          confidence?: number | null
          created_at?: string
          id?: string
          question_id?: string | null
          question_key: string
          raw_response?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["response_status"]
          structured_response?: Json | null
          supersedes_response_id?: string | null
        }
        Update: {
          answered_at?: string
          confidence?: number | null
          created_at?: string
          id?: string
          question_id?: string | null
          question_key?: string
          raw_response?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["response_status"]
          structured_response?: Json | null
          supersedes_response_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "interview_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_responses_supersedes_response_id_fkey"
            columns: ["supersedes_response_id"]
            isOneToOne: false
            referencedRelation: "interview_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_sessions: {
        Row: {
          business_id: string
          completed_at: string | null
          coverage_score: number
          created_at: string
          current_question_key: string | null
          current_stage: string | null
          id: string
          last_activity_at: string | null
          paused_at: string | null
          progress_percent: number
          resume_context: Json
          started_at: string | null
          status: Database["public"]["Enums"]["interview_status"]
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          coverage_score?: number
          created_at?: string
          current_question_key?: string | null
          current_stage?: string | null
          id?: string
          last_activity_at?: string | null
          paused_at?: string | null
          progress_percent?: number
          resume_context?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          template_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          coverage_score?: number
          created_at?: string
          current_question_key?: string | null
          current_stage?: string | null
          id?: string
          last_activity_at?: string | null
          paused_at?: string | null
          progress_percent?: number
          resume_context?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "interview_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_stages: {
        Row: {
          completion_weight: number
          configuration: Json
          description: string | null
          id: string
          minimum_coverage: number
          name: string
          sequence: number
          stage_key: string
          template_id: string
        }
        Insert: {
          completion_weight?: number
          configuration?: Json
          description?: string | null
          id?: string
          minimum_coverage?: number
          name: string
          sequence: number
          stage_key: string
          template_id: string
        }
        Update: {
          completion_weight?: number
          configuration?: Json
          description?: string | null
          id?: string
          minimum_coverage?: number
          name?: string
          sequence?: number
          stage_key?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "interview_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_templates: {
        Row: {
          active: boolean
          configuration: Json
          created_at: string
          description: string | null
          id: string
          industry_code: string | null
          name: string
          version: number
        }
        Insert: {
          active?: boolean
          configuration?: Json
          created_at?: string
          description?: string | null
          id?: string
          industry_code?: string | null
          name: string
          version?: number
        }
        Update: {
          active?: boolean
          configuration?: Json
          created_at?: string
          description?: string | null
          id?: string
          industry_code?: string | null
          name?: string
          version?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          estimated_value: number | null
          first_name: string | null
          id: string
          last_name: string | null
          metadata: Json
          notes: string | null
          phone: string | null
          source: Database["public"]["Enums"]["source_type"] | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          estimated_value?: number | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["source_type"] | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          estimated_value?: number | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          source?: Database["public"]["Enums"]["source_type"] | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          name: string
          plan_code: string
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name: string
          plan_code?: string
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name?: string
          plan_code?: string
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          locale: string
          metadata: Json
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          metadata?: Json
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          metadata?: Json
          phone?: string | null
          timezone?: string
          updated_at?: string
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
      ai_job_status: "queued" | "running" | "completed" | "failed" | "cancelled"
      confidence_level: "very_low" | "low" | "medium" | "high" | "very_high"
      diagnosis_category:
        | "revenue"
        | "marketing"
        | "sales"
        | "conversion"
        | "retention"
        | "operations"
        | "time"
        | "people"
        | "finance"
        | "technology"
        | "automation"
        | "customer_experience"
        | "seo"
        | "growth"
        | "strategy"
      evidence_type:
        | "conversation"
        | "document"
        | "image"
        | "url"
        | "testimonial"
        | "review"
        | "analytics"
        | "financial_record"
        | "manual_entry"
        | "system_generated"
      fact_type:
        | "fact"
        | "claim"
        | "inference"
        | "assumption"
        | "goal"
        | "preference"
        | "metric"
        | "observation"
      interview_status:
        | "not_started"
        | "in_progress"
        | "paused"
        | "completed"
        | "abandoned"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "won"
        | "lost"
        | "archived"
      opportunity_status:
        | "identified"
        | "validated"
        | "planned"
        | "in_progress"
        | "completed"
        | "dismissed"
      organization_role: "owner" | "admin" | "manager" | "member" | "viewer"
      organization_status: "active" | "trial" | "suspended" | "cancelled"
      priority_level: "critical" | "high" | "medium" | "low"
      process_status: "draft" | "active" | "archived"
      question_type:
        | "text"
        | "long_text"
        | "single_select"
        | "multi_select"
        | "number"
        | "currency"
        | "percentage"
        | "boolean"
        | "date"
        | "url"
        | "file"
        | "location"
        | "rating"
      response_status:
        | "answered"
        | "skipped"
        | "needs_input"
        | "needs_verification"
        | "superseded"
      seo_page_status:
        | "draft"
        | "generating"
        | "published"
        | "paused"
        | "archived"
      source_type:
        | "website"
        | "seo"
        | "google"
        | "social"
        | "whatsapp"
        | "email"
        | "referral"
        | "advertising"
        | "direct"
        | "other"
      task_priority: "urgent" | "high" | "medium" | "low"
      task_status:
        | "todo"
        | "in_progress"
        | "blocked"
        | "completed"
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
      ai_job_status: ["queued", "running", "completed", "failed", "cancelled"],
      confidence_level: ["very_low", "low", "medium", "high", "very_high"],
      diagnosis_category: [
        "revenue",
        "marketing",
        "sales",
        "conversion",
        "retention",
        "operations",
        "time",
        "people",
        "finance",
        "technology",
        "automation",
        "customer_experience",
        "seo",
        "growth",
        "strategy",
      ],
      evidence_type: [
        "conversation",
        "document",
        "image",
        "url",
        "testimonial",
        "review",
        "analytics",
        "financial_record",
        "manual_entry",
        "system_generated",
      ],
      fact_type: [
        "fact",
        "claim",
        "inference",
        "assumption",
        "goal",
        "preference",
        "metric",
        "observation",
      ],
      interview_status: [
        "not_started",
        "in_progress",
        "paused",
        "completed",
        "abandoned",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "won",
        "lost",
        "archived",
      ],
      opportunity_status: [
        "identified",
        "validated",
        "planned",
        "in_progress",
        "completed",
        "dismissed",
      ],
      organization_role: ["owner", "admin", "manager", "member", "viewer"],
      organization_status: ["active", "trial", "suspended", "cancelled"],
      priority_level: ["critical", "high", "medium", "low"],
      process_status: ["draft", "active", "archived"],
      question_type: [
        "text",
        "long_text",
        "single_select",
        "multi_select",
        "number",
        "currency",
        "percentage",
        "boolean",
        "date",
        "url",
        "file",
        "location",
        "rating",
      ],
      response_status: [
        "answered",
        "skipped",
        "needs_input",
        "needs_verification",
        "superseded",
      ],
      seo_page_status: [
        "draft",
        "generating",
        "published",
        "paused",
        "archived",
      ],
      source_type: [
        "website",
        "seo",
        "google",
        "social",
        "whatsapp",
        "email",
        "referral",
        "advertising",
        "direct",
        "other",
      ],
      task_priority: ["urgent", "high", "medium", "low"],
      task_status: ["todo", "in_progress", "blocked", "completed", "cancelled"],
    },
  },
} as const
