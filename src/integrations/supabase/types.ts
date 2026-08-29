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
      ai_jobs: {
        Row: {
          attempts: number
          business_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string | null
          input_data: Json
          job_type: string
          last_error_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          organization_id: string | null
          output_data: Json | null
          priority: number
          progress: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ai_job_status"]
        }
        Insert: {
          attempts?: number
          business_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string | null
          input_data?: Json
          job_type: string
          last_error_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string | null
          output_data?: Json | null
          priority?: number
          progress?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ai_job_status"]
        }
        Update: {
          attempts?: number
          business_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          heartbeat_at?: string | null
          id?: string
          idempotency_key?: string | null
          input_data?: Json
          job_type?: string
          last_error_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string | null
          output_data?: Json | null
          priority?: number
          progress?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ai_job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      ai_usage: {
        Row: {
          business_id: string | null
          completion_tokens: number
          created_at: string
          estimated_cost_usd: number
          id: string
          job_id: string | null
          metadata: Json
          model: string
          operation: string
          organization_id: string
          prompt_tokens: number
          succeeded: boolean
          total_tokens: number
        }
        Insert: {
          business_id?: string | null
          completion_tokens?: number
          created_at?: string
          estimated_cost_usd?: number
          id?: string
          job_id?: string | null
          metadata?: Json
          model: string
          operation: string
          organization_id: string
          prompt_tokens?: number
          succeeded?: boolean
          total_tokens?: number
        }
        Update: {
          business_id?: string | null
          completion_tokens?: number
          created_at?: string
          estimated_cost_usd?: number
          id?: string
          job_id?: string | null
          metadata?: Json
          model?: string
          operation?: string
          organization_id?: string
          prompt_tokens?: number
          succeeded?: boolean
          total_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_type: string
          business_id: string | null
          created_at: string
          id: string
          metadata: Json
          new_data: Json | null
          old_data: Json | null
          organization_id: string | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_type: string
          business_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_type?: string
          business_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          source_response_id: string | null
          source_type: Database["public"]["Enums"]["evidence_type"] | null
          subcategory: string | null
          superseded_at: string | null
          superseded_by_fact_id: string | null
          supersedes_fact_id: string | null
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
          source_response_id?: string | null
          source_type?: Database["public"]["Enums"]["evidence_type"] | null
          subcategory?: string | null
          superseded_at?: string | null
          superseded_by_fact_id?: string | null
          supersedes_fact_id?: string | null
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
          source_response_id?: string | null
          source_type?: Database["public"]["Enums"]["evidence_type"] | null
          subcategory?: string | null
          superseded_at?: string | null
          superseded_by_fact_id?: string | null
          supersedes_fact_id?: string | null
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
          {
            foreignKeyName: "brain_facts_source_response_id_fkey"
            columns: ["source_response_id"]
            isOneToOne: false
            referencedRelation: "interview_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_facts_superseded_by_fact_id_fkey"
            columns: ["superseded_by_fact_id"]
            isOneToOne: false
            referencedRelation: "brain_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brain_facts_supersedes_fact_id_fkey"
            columns: ["supersedes_fact_id"]
            isOneToOne: false
            referencedRelation: "brain_facts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_blueprints: {
        Row: {
          acquisition_strategy: string | null
          blueprint_data: Json
          business_id: string
          core_problem: string | null
          created_at: string
          diagnosis_run_id: string | null
          differentiation: string | null
          executive_summary: string | null
          id: string
          ideal_customer: string | null
          methodology: string | null
          operating_model: string | null
          owner_role: string | null
          positioning: string | null
          pricing_strategy: string | null
          retention_strategy: string | null
          status: string
          transformation: string | null
          updated_at: string
          version: number
        }
        Insert: {
          acquisition_strategy?: string | null
          blueprint_data?: Json
          business_id: string
          core_problem?: string | null
          created_at?: string
          diagnosis_run_id?: string | null
          differentiation?: string | null
          executive_summary?: string | null
          id?: string
          ideal_customer?: string | null
          methodology?: string | null
          operating_model?: string | null
          owner_role?: string | null
          positioning?: string | null
          pricing_strategy?: string | null
          retention_strategy?: string | null
          status?: string
          transformation?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          acquisition_strategy?: string | null
          blueprint_data?: Json
          business_id?: string
          core_problem?: string | null
          created_at?: string
          diagnosis_run_id?: string | null
          differentiation?: string | null
          executive_summary?: string | null
          id?: string
          ideal_customer?: string | null
          methodology?: string | null
          operating_model?: string | null
          owner_role?: string | null
          positioning?: string | null
          pricing_strategy?: string | null
          retention_strategy?: string | null
          status?: string
          transformation?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_blueprints_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_blueprints_diagnosis_run_id_fkey"
            columns: ["diagnosis_run_id"]
            isOneToOne: false
            referencedRelation: "diagnosis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      business_goals: {
        Row: {
          business_id: string
          category: string | null
          created_at: string
          current_value: number | null
          description: string | null
          id: string
          name: string
          status: string
          target_date: string | null
          target_value: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          category?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          id?: string
          name: string
          status?: string
          target_date?: string | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          category?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          id?: string
          name?: string
          status?: string
          target_date?: string | null
          target_value?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_goals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_metrics: {
        Row: {
          business_id: string
          created_by: string | null
          id: string
          metadata: Json
          metric_id: string | null
          metric_key: string
          metric_name: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          recorded_at: string
          source: string | null
          unit: string | null
          value: number | null
        }
        Insert: {
          business_id: string
          created_by?: string | null
          id?: string
          metadata?: Json
          metric_id?: string | null
          metric_key: string
          metric_name: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          recorded_at?: string
          source?: string | null
          unit?: string | null
          value?: number | null
        }
        Update: {
          business_id?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          metric_id?: string | null
          metric_key?: string
          metric_name?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          recorded_at?: string
          source?: string | null
          unit?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_metrics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_metrics_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "metric_definitions"
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
      cron_job_config: {
        Row: {
          created_at: string
          enabled: boolean
          endpoint_url: string
          name: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          endpoint_url: string
          name: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          endpoint_url?: string
          name?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          business_id: string
          created_at: string
          customer_segment: string | null
          email: string | null
          first_name: string | null
          first_purchase_at: string | null
          id: string
          last_name: string | null
          last_purchase_at: string | null
          lead_id: string | null
          lifetime_value: number
          metadata: Json
          phone: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_segment?: string | null
          email?: string | null
          first_name?: string | null
          first_purchase_at?: string | null
          id?: string
          last_name?: string | null
          last_purchase_at?: string | null
          lead_id?: string | null
          lifetime_value?: number
          metadata?: Json
          phone?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_segment?: string | null
          email?: string | null
          first_name?: string | null
          first_purchase_at?: string | null
          id?: string
          last_name?: string | null
          last_purchase_at?: string | null
          lead_id?: string | null
          lifetime_value?: number
          metadata?: Json
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosis_items: {
        Row: {
          business_id: string
          category: Database["public"]["Enums"]["diagnosis_category"]
          confidence_score: number | null
          created_at: string
          description: string | null
          diagnosis_run_id: string
          effort_score: number | null
          evidence: Json
          id: string
          impact_score: number | null
          priority_level: Database["public"]["Enums"]["priority_level"] | null
          priority_score: number | null
          recommendation: string | null
          status: Database["public"]["Enums"]["opportunity_status"]
          title: string
          updated_at: string
          urgency_score: number | null
        }
        Insert: {
          business_id: string
          category: Database["public"]["Enums"]["diagnosis_category"]
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          diagnosis_run_id: string
          effort_score?: number | null
          evidence?: Json
          id?: string
          impact_score?: number | null
          priority_level?: Database["public"]["Enums"]["priority_level"] | null
          priority_score?: number | null
          recommendation?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          title: string
          updated_at?: string
          urgency_score?: number | null
        }
        Update: {
          business_id?: string
          category?: Database["public"]["Enums"]["diagnosis_category"]
          confidence_score?: number | null
          created_at?: string
          description?: string | null
          diagnosis_run_id?: string
          effort_score?: number | null
          evidence?: Json
          id?: string
          impact_score?: number | null
          priority_level?: Database["public"]["Enums"]["priority_level"] | null
          priority_score?: number | null
          recommendation?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          title?: string
          updated_at?: string
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnosis_items_diagnosis_run_id_fkey"
            columns: ["diagnosis_run_id"]
            isOneToOne: false
            referencedRelation: "diagnosis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosis_runs: {
        Row: {
          automation_score: number | null
          brain_version: number | null
          business_id: string
          created_at: string
          growth_score: number | null
          id: string
          marketing_score: number | null
          operations_score: number | null
          overall_score: number | null
          owner_dependency_score: number | null
          retention_score: number | null
          revenue_score: number | null
          sales_score: number | null
          summary: string | null
        }
        Insert: {
          automation_score?: number | null
          brain_version?: number | null
          business_id: string
          created_at?: string
          growth_score?: number | null
          id?: string
          marketing_score?: number | null
          operations_score?: number | null
          overall_score?: number | null
          owner_dependency_score?: number | null
          retention_score?: number | null
          revenue_score?: number | null
          sales_score?: number | null
          summary?: string | null
        }
        Update: {
          automation_score?: number | null
          brain_version?: number | null
          business_id?: string
          created_at?: string
          growth_score?: number | null
          id?: string
          marketing_score?: number | null
          operations_score?: number | null
          overall_score?: number | null
          owner_dependency_score?: number | null
          retention_score?: number | null
          revenue_score?: number | null
          sales_score?: number | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnosis_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      experiment_metrics: {
        Row: {
          created_at: string
          experiment_id: string
          id: string
          metric_id: string
          role: string
        }
        Insert: {
          created_at?: string
          experiment_id: string
          id?: string
          metric_id: string
          role?: string
        }
        Update: {
          created_at?: string
          experiment_id?: string
          id?: string
          metric_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_metrics_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_metrics_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "metric_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          absolute_change: number | null
          baseline_observation_id: string | null
          baseline_period_end: string | null
          baseline_period_start: string | null
          baseline_source: string | null
          baseline_value: number | null
          business_id: string
          cancelled_at: string | null
          comparison_definition: string | null
          completed_at: string | null
          conclusion: string | null
          confidence: number | null
          confidence_level:
            | Database["public"]["Enums"]["confidence_level"]
            | null
          created_at: string
          created_by: string | null
          definition_locked_at: string | null
          description: string | null
          end_date: string | null
          evidence: Json
          experiment_type: Database["public"]["Enums"]["experiment_type"]
          final_value: number | null
          hypothesis: string | null
          hypothesis_expected_change: string | null
          hypothesis_intervention: string | null
          hypothesis_rationale: string | null
          id: string
          intervention_summary: string | null
          learning: string | null
          learning_generated_at: string | null
          learning_status: Database["public"]["Enums"]["experiment_learning_status"]
          limitation: string | null
          metadata: Json
          name: string
          organization_id: string | null
          paused_at: string | null
          percent_change: number | null
          primary_metric_id: string | null
          process_execution_id: string | null
          process_id: string | null
          process_version: number | null
          rationale: string | null
          recommendation: string | null
          result_data: Json
          source_blueprint_id: string | null
          source_blueprint_version: number | null
          source_diagnosis_item_id: string | null
          source_diagnosis_run_id: string | null
          source_task_id: string | null
          start_date: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["experiment_status"]
          target_achieved: boolean | null
          target_value: number | null
          updated_at: string
        }
        Insert: {
          absolute_change?: number | null
          baseline_observation_id?: string | null
          baseline_period_end?: string | null
          baseline_period_start?: string | null
          baseline_source?: string | null
          baseline_value?: number | null
          business_id: string
          cancelled_at?: string | null
          comparison_definition?: string | null
          completed_at?: string | null
          conclusion?: string | null
          confidence?: number | null
          confidence_level?:
            | Database["public"]["Enums"]["confidence_level"]
            | null
          created_at?: string
          created_by?: string | null
          definition_locked_at?: string | null
          description?: string | null
          end_date?: string | null
          evidence?: Json
          experiment_type?: Database["public"]["Enums"]["experiment_type"]
          final_value?: number | null
          hypothesis?: string | null
          hypothesis_expected_change?: string | null
          hypothesis_intervention?: string | null
          hypothesis_rationale?: string | null
          id?: string
          intervention_summary?: string | null
          learning?: string | null
          learning_generated_at?: string | null
          learning_status?: Database["public"]["Enums"]["experiment_learning_status"]
          limitation?: string | null
          metadata?: Json
          name: string
          organization_id?: string | null
          paused_at?: string | null
          percent_change?: number | null
          primary_metric_id?: string | null
          process_execution_id?: string | null
          process_id?: string | null
          process_version?: number | null
          rationale?: string | null
          recommendation?: string | null
          result_data?: Json
          source_blueprint_id?: string | null
          source_blueprint_version?: number | null
          source_diagnosis_item_id?: string | null
          source_diagnosis_run_id?: string | null
          source_task_id?: string | null
          start_date?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["experiment_status"]
          target_achieved?: boolean | null
          target_value?: number | null
          updated_at?: string
        }
        Update: {
          absolute_change?: number | null
          baseline_observation_id?: string | null
          baseline_period_end?: string | null
          baseline_period_start?: string | null
          baseline_source?: string | null
          baseline_value?: number | null
          business_id?: string
          cancelled_at?: string | null
          comparison_definition?: string | null
          completed_at?: string | null
          conclusion?: string | null
          confidence?: number | null
          confidence_level?:
            | Database["public"]["Enums"]["confidence_level"]
            | null
          created_at?: string
          created_by?: string | null
          definition_locked_at?: string | null
          description?: string | null
          end_date?: string | null
          evidence?: Json
          experiment_type?: Database["public"]["Enums"]["experiment_type"]
          final_value?: number | null
          hypothesis?: string | null
          hypothesis_expected_change?: string | null
          hypothesis_intervention?: string | null
          hypothesis_rationale?: string | null
          id?: string
          intervention_summary?: string | null
          learning?: string | null
          learning_generated_at?: string | null
          learning_status?: Database["public"]["Enums"]["experiment_learning_status"]
          limitation?: string | null
          metadata?: Json
          name?: string
          organization_id?: string | null
          paused_at?: string | null
          percent_change?: number | null
          primary_metric_id?: string | null
          process_execution_id?: string | null
          process_id?: string | null
          process_version?: number | null
          rationale?: string | null
          recommendation?: string | null
          result_data?: Json
          source_blueprint_id?: string | null
          source_blueprint_version?: number | null
          source_diagnosis_item_id?: string | null
          source_diagnosis_run_id?: string | null
          source_task_id?: string | null
          start_date?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["experiment_status"]
          target_achieved?: boolean | null
          target_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_baseline_observation_id_fkey"
            columns: ["baseline_observation_id"]
            isOneToOne: false
            referencedRelation: "business_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_primary_metric_id_fkey"
            columns: ["primary_metric_id"]
            isOneToOne: false
            referencedRelation: "metric_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_process_execution_id_fkey"
            columns: ["process_execution_id"]
            isOneToOne: false
            referencedRelation: "process_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_source_blueprint_id_fkey"
            columns: ["source_blueprint_id"]
            isOneToOne: false
            referencedRelation: "business_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_source_diagnosis_item_id_fkey"
            columns: ["source_diagnosis_item_id"]
            isOneToOne: false
            referencedRelation: "diagnosis_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_source_diagnosis_run_id_fkey"
            columns: ["source_diagnosis_run_id"]
            isOneToOne: false
            referencedRelation: "diagnosis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_source_task_id_fkey"
            columns: ["source_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
      metric_definitions: {
        Row: {
          active: boolean
          baseline_at: string | null
          baseline_value: number | null
          business_id: string
          category: string | null
          created_at: string
          created_by: string | null
          current_recorded_at: string | null
          current_value: number | null
          description: string | null
          diagnosis_item_id: string | null
          direction: Database["public"]["Enums"]["metric_direction"]
          frequency: Database["public"]["Enums"]["metric_frequency"]
          goal_id: string | null
          hypothesis: string | null
          id: string
          intervention: string | null
          metadata: Json
          metric_key: string
          name: string
          organization_id: string | null
          process_execution_id: string | null
          process_id: string | null
          rationale: string | null
          source: Database["public"]["Enums"]["metric_source"]
          target_max: number | null
          target_min: number | null
          target_value: number | null
          task_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          baseline_at?: string | null
          baseline_value?: number | null
          business_id: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          current_recorded_at?: string | null
          current_value?: number | null
          description?: string | null
          diagnosis_item_id?: string | null
          direction?: Database["public"]["Enums"]["metric_direction"]
          frequency?: Database["public"]["Enums"]["metric_frequency"]
          goal_id?: string | null
          hypothesis?: string | null
          id?: string
          intervention?: string | null
          metadata?: Json
          metric_key: string
          name: string
          organization_id?: string | null
          process_execution_id?: string | null
          process_id?: string | null
          rationale?: string | null
          source?: Database["public"]["Enums"]["metric_source"]
          target_max?: number | null
          target_min?: number | null
          target_value?: number | null
          task_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          baseline_at?: string | null
          baseline_value?: number | null
          business_id?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          current_recorded_at?: string | null
          current_value?: number | null
          description?: string | null
          diagnosis_item_id?: string | null
          direction?: Database["public"]["Enums"]["metric_direction"]
          frequency?: Database["public"]["Enums"]["metric_frequency"]
          goal_id?: string | null
          hypothesis?: string | null
          id?: string
          intervention?: string | null
          metadata?: Json
          metric_key?: string
          name?: string
          organization_id?: string | null
          process_execution_id?: string | null
          process_id?: string | null
          rationale?: string | null
          source?: Database["public"]["Enums"]["metric_source"]
          target_max?: number | null
          target_min?: number | null
          target_value?: number | null
          task_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metric_definitions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_definitions_diagnosis_item_id_fkey"
            columns: ["diagnosis_item_id"]
            isOneToOne: false
            referencedRelation: "diagnosis_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_definitions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "business_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_definitions_process_execution_id_fkey"
            columns: ["process_execution_id"]
            isOneToOne: false
            referencedRelation: "process_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_definitions_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metric_definitions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_ai_limits: {
        Row: {
          created_at: string
          monthly_cost_limit_usd: number
          monthly_token_limit: number
          organization_id: string
          pause_reason: string | null
          paused: boolean
          paused_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          monthly_cost_limit_usd?: number
          monthly_token_limit?: number
          organization_id: string
          pause_reason?: string | null
          paused?: boolean
          paused_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          monthly_cost_limit_usd?: number
          monthly_token_limit?: number
          organization_id?: string
          pause_reason?: string | null
          paused?: boolean
          paused_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_ai_limits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
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
      process_approvals: {
        Row: {
          business_id: string
          created_at: string
          data_used: Json
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          execution_id: string
          external_effect: string | null
          id: string
          organization_id: string | null
          process_id: string
          status: Database["public"]["Enums"]["process_approval_status"]
          step_id: string | null
          step_sequence: number | null
          title: string
          updated_at: string
          what_will_happen: string | null
          why_recommended: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          data_used?: Json
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          execution_id: string
          external_effect?: string | null
          id?: string
          organization_id?: string | null
          process_id: string
          status?: Database["public"]["Enums"]["process_approval_status"]
          step_id?: string | null
          step_sequence?: number | null
          title: string
          updated_at?: string
          what_will_happen?: string | null
          why_recommended?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          data_used?: Json
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          execution_id?: string
          external_effect?: string | null
          id?: string
          organization_id?: string | null
          process_id?: string
          status?: Database["public"]["Enums"]["process_approval_status"]
          step_id?: string | null
          step_sequence?: number | null
          title?: string
          updated_at?: string
          what_will_happen?: string | null
          why_recommended?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_approvals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_approvals_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "process_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_approvals_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_approvals_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      process_executions: {
        Row: {
          business_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          current_step_id: string | null
          current_step_sequence: number | null
          duration_ms: number | null
          error: string | null
          failed: boolean
          id: string
          initiated_by: string | null
          metric_values: Json
          organization_id: string | null
          output: Json
          process_id: string
          process_version: number
          started_at: string | null
          status: Database["public"]["Enums"]["process_execution_status"]
          step_log: Json
          success: boolean | null
          trigger_payload: Json
          trigger_source: string
          updated_at: string
        }
        Insert: {
          business_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          current_step_sequence?: number | null
          duration_ms?: number | null
          error?: string | null
          failed?: boolean
          id?: string
          initiated_by?: string | null
          metric_values?: Json
          organization_id?: string | null
          output?: Json
          process_id: string
          process_version?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["process_execution_status"]
          step_log?: Json
          success?: boolean | null
          trigger_payload?: Json
          trigger_source?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_step_id?: string | null
          current_step_sequence?: number | null
          duration_ms?: number | null
          error?: string | null
          failed?: boolean
          id?: string
          initiated_by?: string | null
          metric_values?: Json
          organization_id?: string | null
          output?: Json
          process_id?: string
          process_version?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["process_execution_status"]
          step_log?: Json
          success?: boolean | null
          trigger_payload?: Json
          trigger_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_executions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_executions_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_executions_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_steps: {
        Row: {
          automation_type: string
          autonomy_level: number
          condition_definition: Json
          configuration: Json
          created_at: string
          depends_on_step_id: string | null
          description: string | null
          estimated_minutes: number | null
          id: string
          input_definition: Json
          name: string
          output_definition: Json
          owner_id: string | null
          owner_type: Database["public"]["Enums"]["process_owner_type"]
          process_id: string
          required: boolean
          responsible_role: string | null
          sequence: number
          step_type: Database["public"]["Enums"]["process_step_type"]
          updated_at: string
        }
        Insert: {
          automation_type?: string
          autonomy_level?: number
          condition_definition?: Json
          configuration?: Json
          created_at?: string
          depends_on_step_id?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          input_definition?: Json
          name: string
          output_definition?: Json
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["process_owner_type"]
          process_id: string
          required?: boolean
          responsible_role?: string | null
          sequence: number
          step_type?: Database["public"]["Enums"]["process_step_type"]
          updated_at?: string
        }
        Update: {
          automation_type?: string
          autonomy_level?: number
          condition_definition?: Json
          configuration?: Json
          created_at?: string
          depends_on_step_id?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          input_definition?: Json
          name?: string
          output_definition?: Json
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["process_owner_type"]
          process_id?: string
          required?: boolean
          responsible_role?: string | null
          sequence?: number
          step_type?: Database["public"]["Enums"]["process_step_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_steps_depends_on_step_id_fkey"
            columns: ["depends_on_step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_steps_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          automation_score: number | null
          autonomy_level: number
          business_id: string
          created_at: string
          created_from_action_id: string | null
          created_from_blueprint_version: number | null
          created_from_diagnosis_id: string | null
          description: string | null
          id: string
          metadata: Json
          name: string
          organization_id: string | null
          owner_dependency_score: number | null
          owner_id: string | null
          owner_type: Database["public"]["Enums"]["process_owner_type"]
          owner_user_id: string | null
          process_category: string | null
          purpose: string | null
          status: Database["public"]["Enums"]["process_status"]
          success_definition: string | null
          supersedes_process_id: string | null
          trigger_definition: Json
          trigger_type: Database["public"]["Enums"]["process_trigger_type"]
          updated_at: string
          version: number
        }
        Insert: {
          automation_score?: number | null
          autonomy_level?: number
          business_id: string
          created_at?: string
          created_from_action_id?: string | null
          created_from_blueprint_version?: number | null
          created_from_diagnosis_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          organization_id?: string | null
          owner_dependency_score?: number | null
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["process_owner_type"]
          owner_user_id?: string | null
          process_category?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          success_definition?: string | null
          supersedes_process_id?: string | null
          trigger_definition?: Json
          trigger_type?: Database["public"]["Enums"]["process_trigger_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          automation_score?: number | null
          autonomy_level?: number
          business_id?: string
          created_at?: string
          created_from_action_id?: string | null
          created_from_blueprint_version?: number | null
          created_from_diagnosis_id?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string | null
          owner_dependency_score?: number | null
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["process_owner_type"]
          owner_user_id?: string | null
          process_category?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["process_status"]
          success_definition?: string | null
          supersedes_process_id?: string | null
          trigger_definition?: Json
          trigger_type?: Database["public"]["Enums"]["process_trigger_type"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "processes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_created_from_action_id_fkey"
            columns: ["created_from_action_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_created_from_diagnosis_id_fkey"
            columns: ["created_from_diagnosis_id"]
            isOneToOne: false
            referencedRelation: "diagnosis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processes_supersedes_process_id_fkey"
            columns: ["supersedes_process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
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
      seo_opportunities: {
        Row: {
          business_fit_score: number | null
          business_id: string | null
          business_stage: string | null
          commercial_score: number | null
          competition_score: number | null
          content_value_score: number | null
          created_at: string
          decided_at: string | null
          geographic_modifier: string | null
          id: string
          industry: string | null
          keyword: string
          location: string | null
          metadata: Json
          opportunity_score: number | null
          organization_id: string | null
          problem: string | null
          reason: string | null
          recommended_page_type: string | null
          relevance_score: number | null
          search_intent: string | null
          seo_site_id: string
          service: string | null
          status: string
          topic: string | null
          topic_cluster: string | null
          updated_at: string
        }
        Insert: {
          business_fit_score?: number | null
          business_id?: string | null
          business_stage?: string | null
          commercial_score?: number | null
          competition_score?: number | null
          content_value_score?: number | null
          created_at?: string
          decided_at?: string | null
          geographic_modifier?: string | null
          id?: string
          industry?: string | null
          keyword: string
          location?: string | null
          metadata?: Json
          opportunity_score?: number | null
          organization_id?: string | null
          problem?: string | null
          reason?: string | null
          recommended_page_type?: string | null
          relevance_score?: number | null
          search_intent?: string | null
          seo_site_id: string
          service?: string | null
          status?: string
          topic?: string | null
          topic_cluster?: string | null
          updated_at?: string
        }
        Update: {
          business_fit_score?: number | null
          business_id?: string | null
          business_stage?: string | null
          commercial_score?: number | null
          competition_score?: number | null
          content_value_score?: number | null
          created_at?: string
          decided_at?: string | null
          geographic_modifier?: string | null
          id?: string
          industry?: string | null
          keyword?: string
          location?: string | null
          metadata?: Json
          opportunity_score?: number | null
          organization_id?: string | null
          problem?: string | null
          reason?: string | null
          recommended_page_type?: string | null
          relevance_score?: number | null
          search_intent?: string | null
          seo_site_id?: string
          service?: string | null
          status?: string
          topic?: string | null
          topic_cluster?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_opportunities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_opportunities_seo_site_id_fkey"
            columns: ["seo_site_id"]
            isOneToOne: false
            referencedRelation: "seo_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_page_measurements: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          metric_key: string
          note: string | null
          organization_id: string | null
          page_id: string
          period_end: string | null
          period_start: string | null
          recorded_by: string | null
          source: string
          value: number
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          metric_key: string
          note?: string | null
          organization_id?: string | null
          page_id: string
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          source?: string
          value: number
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          metric_key?: string
          note?: string | null
          organization_id?: string | null
          page_id?: string
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          source?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_page_measurements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_measurements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_measurements_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_page_templates: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          eligibility: Json
          id: string
          name: string
          page_type: string
          site_type: string
          template_config: Json
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          eligibility?: Json
          id?: string
          name: string
          page_type: string
          site_type?: string
          template_config: Json
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          eligibility?: Json
          id?: string
          name?: string
          page_type?: string
          site_type?: string
          template_config?: Json
          version?: number
        }
        Relationships: []
      }
      seo_page_versions: {
        Row: {
          business_id: string | null
          business_relevance_score: number | null
          canonical_url: string | null
          content: Json | null
          created_at: string
          created_by: string | null
          factual_confidence: number | null
          h1: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          organization_id: string | null
          originality_score: number | null
          page_id: string
          published_at: string | null
          quality_report: Json
          quality_score: number | null
          schema_json: Json | null
          slug: string | null
          status: string | null
          title: string | null
          version: number
        }
        Insert: {
          business_id?: string | null
          business_relevance_score?: number | null
          canonical_url?: string | null
          content?: Json | null
          created_at?: string
          created_by?: string | null
          factual_confidence?: number | null
          h1?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          organization_id?: string | null
          originality_score?: number | null
          page_id: string
          published_at?: string | null
          quality_report?: Json
          quality_score?: number | null
          schema_json?: Json | null
          slug?: string | null
          status?: string | null
          title?: string | null
          version: number
        }
        Update: {
          business_id?: string | null
          business_relevance_score?: number | null
          canonical_url?: string | null
          content?: Json | null
          created_at?: string
          created_by?: string | null
          factual_confidence?: number | null
          h1?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          organization_id?: string | null
          originality_score?: number | null
          page_id?: string
          published_at?: string | null
          quality_report?: Json
          quality_score?: number | null
          schema_json?: Json | null
          slug?: string | null
          status?: string | null
          title?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_page_versions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "seo_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_pages: {
        Row: {
          business_id: string | null
          business_relevance_score: number | null
          canonical_url: string | null
          content: Json | null
          content_fingerprint: string | null
          created_at: string
          evidence_fact_ids: string[]
          factual_confidence: number | null
          h1: string | null
          id: string
          indexable: boolean
          last_refreshed_at: string | null
          meta_description: string | null
          meta_title: string | null
          opportunity_id: string | null
          organization_id: string | null
          originality_score: number | null
          published_at: string | null
          quality_report: Json
          quality_score: number | null
          review_notes: string | null
          schema_json: Json | null
          seo_site_id: string
          slug: string
          status: Database["public"]["Enums"]["seo_page_status"]
          template_id: string | null
          title: string | null
          updated_at: string
          version: number
          word_count: number | null
        }
        Insert: {
          business_id?: string | null
          business_relevance_score?: number | null
          canonical_url?: string | null
          content?: Json | null
          content_fingerprint?: string | null
          created_at?: string
          evidence_fact_ids?: string[]
          factual_confidence?: number | null
          h1?: string | null
          id?: string
          indexable?: boolean
          last_refreshed_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          originality_score?: number | null
          published_at?: string | null
          quality_report?: Json
          quality_score?: number | null
          review_notes?: string | null
          schema_json?: Json | null
          seo_site_id: string
          slug: string
          status?: Database["public"]["Enums"]["seo_page_status"]
          template_id?: string | null
          title?: string | null
          updated_at?: string
          version?: number
          word_count?: number | null
        }
        Update: {
          business_id?: string | null
          business_relevance_score?: number | null
          canonical_url?: string | null
          content?: Json | null
          content_fingerprint?: string | null
          created_at?: string
          evidence_fact_ids?: string[]
          factual_confidence?: number | null
          h1?: string | null
          id?: string
          indexable?: boolean
          last_refreshed_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          opportunity_id?: string | null
          organization_id?: string | null
          originality_score?: number | null
          published_at?: string | null
          quality_report?: Json
          quality_score?: number | null
          review_notes?: string | null
          schema_json?: Json | null
          seo_site_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["seo_page_status"]
          template_id?: string | null
          title?: string | null
          updated_at?: string
          version?: number
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_pages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_pages_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "seo_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_pages_seo_site_id_fkey"
            columns: ["seo_site_id"]
            isOneToOne: false
            referencedRelation: "seo_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_pages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "seo_page_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_sites: {
        Row: {
          active: boolean
          business_id: string | null
          configuration: Json
          created_at: string
          domain: string | null
          id: string
          name: string | null
          organization_id: string | null
          robots_status: string
          site_type: string
          sitemap_status: string
          status: string
          subdomain: string | null
          updated_at: string
          url_pattern: string
        }
        Insert: {
          active?: boolean
          business_id?: string | null
          configuration?: Json
          created_at?: string
          domain?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          robots_status?: string
          site_type: string
          sitemap_status?: string
          status?: string
          subdomain?: string | null
          updated_at?: string
          url_pattern?: string
        }
        Update: {
          active?: boolean
          business_id?: string | null
          configuration?: Json
          created_at?: string
          domain?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          robots_status?: string
          site_type?: string
          sitemap_status?: string
          status?: string
          subdomain?: string | null
          updated_at?: string
          url_pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_sites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          business_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          metadata: Json
          priority: Database["public"]["Enums"]["task_priority"]
          process_id: string | null
          process_step_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          business_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          process_id?: string | null
          process_step_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          business_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          process_id?: string | null
          process_step_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_process_step_id_fkey"
            columns: ["process_step_id"]
            isOneToOne: false
            referencedRelation: "process_steps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_ai_job: {
        Args: { requested_job_types?: string[]; worker_id: string }
        Returns: {
          attempts: number
          business_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          heartbeat_at: string | null
          id: string
          idempotency_key: string | null
          input_data: Json
          job_type: string
          last_error_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          organization_id: string | null
          output_data: Json | null
          priority: number
          progress: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ai_job_status"]
        }
        SetofOptions: {
          from: "*"
          to: "ai_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_ai_job: {
        Args: { job_id: string; result: Json }
        Returns: undefined
      }
      fail_ai_job: {
        Args: { error_text: string; job_id: string }
        Returns: undefined
      }
      is_business_manager: {
        Args: { target_business: string }
        Returns: boolean
      }
      is_business_member: {
        Args: { target_business: string }
        Returns: boolean
      }
      is_org_admin: { Args: { target_org: string }; Returns: boolean }
      is_org_member: { Args: { target_org: string }; Returns: boolean }
      match_business_memory: {
        Args: {
          match_business_id: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          memory_type: string
          similarity: number
          title: string
        }[]
      }
      reclaim_stalled_ai_jobs: {
        Args: { stale_seconds?: number }
        Returns: number
      }
      update_interview_progress: {
        Args: {
          new_coverage: number
          new_progress: number
          new_question_key: string
          new_stage: string
          target_session: string
        }
        Returns: undefined
      }
      write_audit_log: {
        Args: {
          action_name: string
          actor?: string
          new_value: Json
          old_value: Json
          target_business: string
          target_record: string
          target_table: string
        }
        Returns: undefined
      }
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
      experiment_learning_status:
        | "pending"
        | "positive"
        | "negative"
        | "inconclusive"
      experiment_status:
        | "draft"
        | "planned"
        | "running"
        | "paused"
        | "completed"
        | "cancelled"
      experiment_type: "before_after" | "controlled" | "observational"
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
      metric_direction: "higher_is_better" | "lower_is_better" | "target_range"
      metric_frequency: "daily" | "weekly" | "monthly" | "quarterly" | "custom"
      metric_source:
        | "manual"
        | "process"
        | "integration"
        | "import"
        | "system"
        | "ai"
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
      process_approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "paused"
        | "expired"
      process_execution_status:
        | "queued"
        | "running"
        | "waiting"
        | "approval_required"
        | "completed"
        | "failed"
        | "cancelled"
      process_owner_type: "human" | "ai" | "hybrid" | "system"
      process_status: "draft" | "active" | "archived"
      process_step_type:
        | "action"
        | "decision"
        | "wait"
        | "approval"
        | "notification"
        | "data_capture"
        | "ai_generation"
        | "integration"
        | "end"
      process_trigger_type:
        | "manual"
        | "scheduled"
        | "event"
        | "inbound_lead"
        | "customer_action"
        | "metric_threshold"
        | "ai_recommendation"
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
        | "review"
        | "approved"
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
      experiment_learning_status: [
        "pending",
        "positive",
        "negative",
        "inconclusive",
      ],
      experiment_status: [
        "draft",
        "planned",
        "running",
        "paused",
        "completed",
        "cancelled",
      ],
      experiment_type: ["before_after", "controlled", "observational"],
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
      metric_direction: ["higher_is_better", "lower_is_better", "target_range"],
      metric_frequency: ["daily", "weekly", "monthly", "quarterly", "custom"],
      metric_source: [
        "manual",
        "process",
        "integration",
        "import",
        "system",
        "ai",
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
      process_approval_status: [
        "pending",
        "approved",
        "rejected",
        "paused",
        "expired",
      ],
      process_execution_status: [
        "queued",
        "running",
        "waiting",
        "approval_required",
        "completed",
        "failed",
        "cancelled",
      ],
      process_owner_type: ["human", "ai", "hybrid", "system"],
      process_status: ["draft", "active", "archived"],
      process_step_type: [
        "action",
        "decision",
        "wait",
        "approval",
        "notification",
        "data_capture",
        "ai_generation",
        "integration",
        "end",
      ],
      process_trigger_type: [
        "manual",
        "scheduled",
        "event",
        "inbound_lead",
        "customer_action",
        "metric_threshold",
        "ai_recommendation",
      ],
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
        "review",
        "approved",
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
