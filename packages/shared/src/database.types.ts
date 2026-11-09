
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_permissions": {
                  Row: {
                    "category": string,"description": string,"key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"description": string,"key": string
                  }
                  Update: {
                    "category"?: string,"description"?: string,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"admin_role_permissions": {
                  Row: {
                    "permission_key": string,"role_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "permission_key": string,"role_id": string
                  }
                  Update: {
                    "permission_key"?: string,"role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_role_permissions_permission_key_fkey"
      columns: ["permission_key"]
isOneToOne: false
      referencedRelation: "admin_permissions"
      referencedColumns: ["key"]
    },{
      foreignKeyName: "admin_role_permissions_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "admin_roles"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_roles": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_system": boolean,"key": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_system"?: boolean,"key": string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_system"?: boolean,"key"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"admin_users": {
                  Row: {
                    "created_at": string,"created_by": string | null,"display_name": string,"is_active": boolean,"last_login_at": string | null,"mfa_required": boolean,"role_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"display_name": string,"is_active"?: boolean,"last_login_at"?: string | null,"mfa_required"?: boolean,"role_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"display_name"?: string,"is_active"?: boolean,"last_login_at"?: string | null,"mfa_required"?: boolean,"role_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_users_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "admin_roles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_feature_configs": {
                  Row: {
                    "daily_user_limit": number | null,"effort": string | null,"enabled": boolean,"feature": string,"max_tokens": number,"model": string,"prompt_key": string | null,"provider": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "daily_user_limit"?: number | null,"effort"?: string | null,"enabled"?: boolean,"feature": string,"max_tokens"?: number,"model": string,"prompt_key"?: string | null,"provider"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "daily_user_limit"?: number | null,"effort"?: string | null,"enabled"?: boolean,"feature"?: string,"max_tokens"?: number,"model"?: string,"prompt_key"?: string | null,"provider"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_feedback": {
                  Row: {
                    "comment": string | null,"created_at": string,"feature": string,"id": string,"rating": number,"reference_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"created_at"?: string,"feature": string,"id"?: string,"rating": number,"reference_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "comment"?: string | null,"created_at"?: string,"feature"?: string,"id"?: string,"rating"?: number,"reference_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_feedback_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_prompts": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"key": string,"notes": string | null,"system_prompt": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"key": string,"notes"?: string | null,"system_prompt": string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"key"?: string,"notes"?: string | null,"system_prompt"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ai_thread_messages": {
                  Row: {
                    "content": string,"created_at": string,"id": string,"role": string,"structured": Json | null,"thread_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"id"?: string,"role": string,"structured"?: Json | null,"thread_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"id"?: string,"role"?: string,"structured"?: Json | null,"thread_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_thread_messages_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "ai_threads"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_threads": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"last_filters": Json | null,"profile_id": string,"title": string | null,"topic": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"last_filters"?: Json | null,"profile_id": string,"title"?: string | null,"topic"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"last_filters"?: Json | null,"profile_id"?: string,"title"?: string | null,"topic"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_threads_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_threads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage_logs": {
                  Row: {
                    "cache_read_tokens": number,"cache_write_tokens": number,"cost_usd_micros": number,"created_at": string,"error_code": string | null,"feature": string,"id": number,"input_tokens": number,"latency_ms": number | null,"model": string,"output_tokens": number,"prompt_key": string | null,"prompt_version": number | null,"provider": string,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cache_read_tokens"?: number,"cache_write_tokens"?: number,"cost_usd_micros"?: number,"created_at"?: string,"error_code"?: string | null,"feature": string,"id"?: never,"input_tokens"?: number,"latency_ms"?: number | null,"model": string,"output_tokens"?: number,"prompt_key"?: string | null,"prompt_version"?: number | null,"provider": string,"status": string,"user_id"?: string | null
                  }
                  Update: {
                    "cache_read_tokens"?: number,"cache_write_tokens"?: number,"cost_usd_micros"?: number,"created_at"?: string,"error_code"?: string | null,"feature"?: string,"id"?: never,"input_tokens"?: number,"latency_ms"?: number | null,"model"?: string,"output_tokens"?: number,"prompt_key"?: string | null,"prompt_version"?: number | null,"provider"?: string,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"analytics_events": {
                  Row: {
                    "created_at": string,"event": string,"id": number,"platform": string | null,"properties": NonNullable<Json>,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event": string,"id"?: never,"platform"?: string | null,"properties"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event"?: string,"id"?: never,"platform"?: string | null,"properties"?: NonNullable<Json>,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "analytics_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"app_users": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"deletion_requested_at": string | null,"email": string | null,"full_name": string | null,"id": string,"last_active_at": string | null,"onboarding_completed_at": string | null,"phone": string | null,"preferred_locale": string,"signup_ip": unknown,"signup_user_agent": string | null,"status": string,"suspended_reason": string | null,"suspended_until": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"deletion_requested_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"id": string,"last_active_at"?: string | null,"onboarding_completed_at"?: string | null,"phone"?: string | null,"preferred_locale"?: string,"signup_ip"?: unknown,"signup_user_agent"?: string | null,"status"?: string,"suspended_reason"?: string | null,"suspended_until"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"deletion_requested_at"?: string | null,"email"?: string | null,"full_name"?: string | null,"id"?: string,"last_active_at"?: string | null,"onboarding_completed_at"?: string | null,"phone"?: string | null,"preferred_locale"?: string,"signup_ip"?: unknown,"signup_user_agent"?: string | null,"status"?: string,"suspended_reason"?: string | null,"suspended_until"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_type": string,"actor_user_id": string | null,"after_data": Json | null,"before_data": Json | null,"created_at": string,"entity_id": string | null,"entity_type": string,"id": number,"ip": unknown,"metadata": NonNullable<Json>,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_type"?: string,"actor_user_id"?: string | null,"after_data"?: Json | null,"before_data"?: Json | null,"created_at"?: string,"entity_id"?: string | null,"entity_type": string,"id"?: never,"ip"?: unknown,"metadata"?: NonNullable<Json>,"user_agent"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_type"?: string,"actor_user_id"?: string | null,"after_data"?: Json | null,"before_data"?: Json | null,"created_at"?: string,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"ip"?: unknown,"metadata"?: NonNullable<Json>,"user_agent"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"blocks": {
                  Row: {
                    "blocked_profile_id": string,"blocker_profile_id": string,"created_at": string,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_profile_id": string,"blocker_profile_id": string,"created_at"?: string,"reason"?: string | null
                  }
                  Update: {
                    "blocked_profile_id"?: string,"blocker_profile_id"?: string,"created_at"?: string,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_profile_id_fkey"
      columns: ["blocked_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_profile_id_fkey"
      columns: ["blocker_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"cms_entries": {
                  Row: {
                    "body": string,"consent_reference": string | null,"id": string,"is_published": boolean,"kind": string,"locale": string,"metadata": NonNullable<Json>,"slug": string,"sort_order": number,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"consent_reference"?: string | null,"id"?: string,"is_published"?: boolean,"kind": string,"locale"?: string,"metadata"?: NonNullable<Json>,"slug": string,"sort_order"?: number,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "body"?: string,"consent_reference"?: string | null,"id"?: string,"is_published"?: boolean,"kind"?: string,"locale"?: string,"metadata"?: NonNullable<Json>,"slug"?: string,"sort_order"?: number,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"connection_insights": {
                  Row: {
                    "connection_id": string,"content": NonNullable<Json>,"created_at": string,"generator": string,"id": string,"kind": string,"model": string | null,"prompt_version": number | null,"requested_by_profile_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id": string,"content": NonNullable<Json>,"created_at"?: string,"generator": string,"id"?: string,"kind": string,"model"?: string | null,"prompt_version"?: number | null,"requested_by_profile_id"?: string | null
                  }
                  Update: {
                    "connection_id"?: string,"content"?: NonNullable<Json>,"created_at"?: string,"generator"?: string,"id"?: string,"kind"?: string,"model"?: string | null,"prompt_version"?: number | null,"requested_by_profile_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_insights_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connection_insights_requested_by_profile_id_fkey"
      columns: ["requested_by_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"connection_journal": {
                  Row: {
                    "author_profile_id": string,"connection_id": string,"content": string,"created_at": string,"id": string,"kind": string,"resolved": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_profile_id": string,"connection_id": string,"content": string,"created_at"?: string,"id"?: string,"kind": string,"resolved"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "author_profile_id"?: string,"connection_id"?: string,"content"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"resolved"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_journal_author_profile_id_fkey"
      columns: ["author_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connection_journal_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                },"connections": {
                  Row: {
                    "closed_at": string | null,"closed_by_profile_id": string | null,"closed_reason": string | null,"created_at": string,"id": string,"origin_interest_id": string | null,"profile_a": string,"profile_b": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"closed_by_profile_id"?: string | null,"closed_reason"?: string | null,"created_at"?: string,"id"?: string,"origin_interest_id"?: string | null,"profile_a": string,"profile_b": string,"status"?: string
                  }
                  Update: {
                    "closed_at"?: string | null,"closed_by_profile_id"?: string | null,"closed_reason"?: string | null,"created_at"?: string,"id"?: string,"origin_interest_id"?: string | null,"profile_a"?: string,"profile_b"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connections_closed_by_profile_id_fkey"
      columns: ["closed_by_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connections_origin_interest_id_fkey"
      columns: ["origin_interest_id"]
isOneToOne: false
      referencedRelation: "interests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connections_profile_a_fkey"
      columns: ["profile_a"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connections_profile_b_fkey"
      columns: ["profile_b"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"consent_records": {
                  Row: {
                    "consent_type": string,"created_at": string,"granted": boolean,"id": string,"ip": unknown,"policy_version": string,"source": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_type": string,"created_at"?: string,"granted": boolean,"id"?: string,"ip"?: unknown,"policy_version": string,"source"?: string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "consent_type"?: string,"created_at"?: string,"granted"?: boolean,"id"?: string,"ip"?: unknown,"policy_version"?: string,"source"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_records_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_participants": {
                  Row: {
                    "archived": boolean,"conversation_id": string,"joined_at": string,"last_read_at": string | null,"muted": boolean,"profile_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived"?: boolean,"conversation_id": string,"joined_at"?: string,"last_read_at"?: string | null,"muted"?: boolean,"profile_id": string,"user_id": string
                  }
                  Update: {
                    "archived"?: boolean,"conversation_id"?: string,"joined_at"?: string,"last_read_at"?: string | null,"muted"?: boolean,"profile_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_participants_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "connection_id": string,"created_at": string,"id": string,"is_locked": boolean,"last_message_at": string | null,"last_message_preview": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id": string,"created_at"?: string,"id"?: string,"is_locked"?: boolean,"last_message_at"?: string | null,"last_message_preview"?: string | null
                  }
                  Update: {
                    "connection_id"?: string,"created_at"?: string,"id"?: string,"is_locked"?: boolean,"last_message_at"?: string | null,"last_message_preview"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: true
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                },"coupon_redemptions": {
                  Row: {
                    "coupon_id": string,"created_at": string,"id": string,"payment_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "coupon_id": string,"created_at"?: string,"id"?: string,"payment_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "coupon_id"?: string,"created_at"?: string,"id"?: string,"payment_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupon_redemptions_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "coupon_redemptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"description": string | null,"discount_type": string,"discount_value": number,"id": string,"is_active": boolean,"max_redemptions": number | null,"per_user_limit": number,"plan_codes": (string)[],"redeemed_count": number,"valid_from": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"discount_type": string,"discount_value": number,"id"?: string,"is_active"?: boolean,"max_redemptions"?: number | null,"per_user_limit"?: number,"plan_codes"?: (string)[],"redeemed_count"?: number,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"discount_type"?: string,"discount_value"?: number,"id"?: string,"is_active"?: boolean,"max_redemptions"?: number | null,"per_user_limit"?: number,"plan_codes"?: (string)[],"redeemed_count"?: number,"valid_from"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"data_requests": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"kind": string,"notes": string | null,"result_path": string | null,"scheduled_for": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"notes"?: string | null,"result_path"?: string | null,"scheduled_for"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"notes"?: string | null,"result_path"?: string | null,"scheduled_for"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "data_requests_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"family_discussions": {
                  Row: {
                    "author_user_id": string,"body": string,"created_at": string,"id": string,"profile_id": string,"target_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_user_id": string,"body": string,"created_at"?: string,"id"?: string,"profile_id": string,"target_profile_id": string
                  }
                  Update: {
                    "author_user_id"?: string,"body"?: string,"created_at"?: string,"id"?: string,"profile_id"?: string,"target_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_discussions_author_user_id_fkey"
      columns: ["author_user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_discussions_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_discussions_target_profile_id_fkey"
      columns: ["target_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"family_members": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"display_name": string | null,"id": string,"invite_expires_at": string | null,"invite_token_hash": string | null,"invited_contact": string,"member_user_id": string | null,"permissions": (string)[],"profile_id": string,"relation": string,"revoked_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"invite_expires_at"?: string | null,"invite_token_hash"?: string | null,"invited_contact": string,"member_user_id"?: string | null,"permissions"?: (string)[],"profile_id": string,"relation": string,"revoked_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"display_name"?: string | null,"id"?: string,"invite_expires_at"?: string | null,"invite_token_hash"?: string | null,"invited_contact"?: string,"member_user_id"?: string | null,"permissions"?: (string)[],"profile_id"?: string,"relation"?: string,"revoked_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_member_user_id_fkey"
      columns: ["member_user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"family_suggestions": {
                  Row: {
                    "created_at": string,"family_member_id": string,"id": string,"note": string | null,"profile_id": string,"status": string,"target_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family_member_id": string,"id"?: string,"note"?: string | null,"profile_id": string,"status"?: string,"target_profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"family_member_id"?: string,"id"?: string,"note"?: string | null,"profile_id"?: string,"status"?: string,"target_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_suggestions_family_member_id_fkey"
      columns: ["family_member_id"]
isOneToOne: false
      referencedRelation: "family_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_suggestions_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_suggestions_target_profile_id_fkey"
      columns: ["target_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"feature_flags": {
                  Row: {
                    "audience": NonNullable<Json>,"description": string,"enabled": boolean,"key": string,"rollout_percent": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: NonNullable<Json>,"description": string,"enabled"?: boolean,"key": string,"rollout_percent"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "audience"?: NonNullable<Json>,"description"?: string,"enabled"?: boolean,"key"?: string,"rollout_percent"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"interests": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"message": string | null,"receiver_profile_id": string,"responded_at": string | null,"sender_profile_id": string,"sent_by_user_id": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"message"?: string | null,"receiver_profile_id": string,"responded_at"?: string | null,"sender_profile_id": string,"sent_by_user_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"message"?: string | null,"receiver_profile_id"?: string,"responded_at"?: string | null,"sender_profile_id"?: string,"sent_by_user_id"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interests_receiver_profile_id_fkey"
      columns: ["receiver_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "interests_sender_profile_id_fkey"
      columns: ["sender_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invoice_counters": {
                  Row: {
                    "financial_year": string,"last_number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "financial_year": string,"last_number"?: number
                  }
                  Update: {
                    "financial_year"?: string,"last_number"?: number
                  }
                  Relationships: [
                    
                  ]
                },"invoices": {
                  Row: {
                    "billing_email": string | null,"billing_name": string,"billing_phone": string | null,"billing_state": string | null,"cgst_paise": number,"customer_gstin": string | null,"hsn_sac": string,"id": string,"igst_paise": number,"invoice_number": string,"issued_at": string,"line_items": NonNullable<Json>,"payment_id": string,"seller_gstin": string | null,"seller_state": string | null,"sgst_paise": number,"taxable_paise": number,"total_paise": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "billing_email"?: string | null,"billing_name": string,"billing_phone"?: string | null,"billing_state"?: string | null,"cgst_paise"?: number,"customer_gstin"?: string | null,"hsn_sac"?: string,"id"?: string,"igst_paise"?: number,"invoice_number": string,"issued_at"?: string,"line_items": NonNullable<Json>,"payment_id": string,"seller_gstin"?: string | null,"seller_state"?: string | null,"sgst_paise"?: number,"taxable_paise": number,"total_paise": number,"user_id": string
                  }
                  Update: {
                    "billing_email"?: string | null,"billing_name"?: string,"billing_phone"?: string | null,"billing_state"?: string | null,"cgst_paise"?: number,"customer_gstin"?: string | null,"hsn_sac"?: string,"id"?: string,"igst_paise"?: number,"invoice_number"?: string,"issued_at"?: string,"line_items"?: NonNullable<Json>,"payment_id"?: string,"seller_gstin"?: string | null,"seller_state"?: string | null,"sgst_paise"?: number,"taxable_paise"?: number,"total_paise"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: true
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"languages": {
                  Row: {
                    "ai_supported": boolean,"code": string,"is_enabled": boolean,"name": string,"native_name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_supported"?: boolean,"code": string,"is_enabled"?: boolean,"name": string,"native_name": string,"sort_order"?: number
                  }
                  Update: {
                    "ai_supported"?: boolean,"code"?: string,"is_enabled"?: boolean,"name"?: string,"native_name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"match_explanations": {
                  Row: {
                    "candidate_profile_id": string,"content": NonNullable<Json>,"created_at": string,"generator": string,"id": string,"model": string | null,"prompt_version": string | null,"score_computed_at": string,"viewer_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_profile_id": string,"content": NonNullable<Json>,"created_at"?: string,"generator": string,"id"?: string,"model"?: string | null,"prompt_version"?: string | null,"score_computed_at": string,"viewer_profile_id": string
                  }
                  Update: {
                    "candidate_profile_id"?: string,"content"?: NonNullable<Json>,"created_at"?: string,"generator"?: string,"id"?: string,"model"?: string | null,"prompt_version"?: string | null,"score_computed_at"?: string,"viewer_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_explanations_candidate_profile_id_fkey"
      columns: ["candidate_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_explanations_viewer_profile_id_fkey"
      columns: ["viewer_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"match_feedback": {
                  Row: {
                    "candidate_profile_id": string,"comment": string | null,"config_version": number | null,"created_at": string,"id": string,"mutual_score_at_time": number | null,"profile_id": string,"rating": number,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_profile_id": string,"comment"?: string | null,"config_version"?: number | null,"created_at"?: string,"id"?: string,"mutual_score_at_time"?: number | null,"profile_id": string,"rating": number,"reason"?: string | null
                  }
                  Update: {
                    "candidate_profile_id"?: string,"comment"?: string | null,"config_version"?: number | null,"created_at"?: string,"id"?: string,"mutual_score_at_time"?: number | null,"profile_id"?: string,"rating"?: number,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_feedback_candidate_profile_id_fkey"
      columns: ["candidate_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_feedback_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"match_scores": {
                  Row: {
                    "a_to_b": number,"b_to_a": number,"computed_at": string,"confidence": number,"config_version": number,"dealbreakers": NonNullable<Json>,"dimensions": NonNullable<Json>,"mutual": number,"profile_a": string,"profile_b": string
                  }
                  ComputedFields: never
                  Insert: {
                    "a_to_b": number,"b_to_a": number,"computed_at"?: string,"confidence": number,"config_version": number,"dealbreakers"?: NonNullable<Json>,"dimensions": NonNullable<Json>,"mutual": number,"profile_a": string,"profile_b": string
                  }
                  Update: {
                    "a_to_b"?: number,"b_to_a"?: number,"computed_at"?: string,"confidence"?: number,"config_version"?: number,"dealbreakers"?: NonNullable<Json>,"dimensions"?: NonNullable<Json>,"mutual"?: number,"profile_a"?: string,"profile_b"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_scores_profile_a_fkey"
      columns: ["profile_a"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_scores_profile_b_fkey"
      columns: ["profile_b"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"matching_configs": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"notes": string | null,"region": string,"thresholds": NonNullable<Json>,"version": number,"weights": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"notes"?: string | null,"region"?: string,"thresholds": NonNullable<Json>,"version": number,"weights": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"notes"?: string | null,"region"?: string,"thresholds"?: NonNullable<Json>,"version"?: number,"weights"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"meeting_plans": {
                  Row: {
                    "connection_id": string,"created_at": string,"id": string,"location_text": string | null,"notes": string | null,"proposed_at": string,"proposed_by_user_id": string,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id": string,"created_at"?: string,"id"?: string,"location_text"?: string | null,"notes"?: string | null,"proposed_at": string,"proposed_by_user_id": string,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "connection_id"?: string,"created_at"?: string,"id"?: string,"location_text"?: string | null,"notes"?: string | null,"proposed_at"?: string,"proposed_by_user_id"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meeting_plans_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "meeting_plans_proposed_by_user_id_fkey"
      columns: ["proposed_by_user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string | null,"client_id": string | null,"conversation_id": string,"created_at": string,"deleted_at": string | null,"flagged": boolean,"id": string,"kind": string,"media_path": string | null,"sender_profile_id": string | null,"sender_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"client_id"?: string | null,"conversation_id": string,"created_at"?: string,"deleted_at"?: string | null,"flagged"?: boolean,"id"?: string,"kind"?: string,"media_path"?: string | null,"sender_profile_id"?: string | null,"sender_user_id"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"client_id"?: string | null,"conversation_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"flagged"?: boolean,"id"?: string,"kind"?: string,"media_path"?: string | null,"sender_profile_id"?: string | null,"sender_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_profile_id_fkey"
      columns: ["sender_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_user_id_fkey"
      columns: ["sender_user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_actions": {
                  Row: {
                    "action": string,"admin_user_id": string,"created_at": string,"expires_at": string | null,"id": string,"reason": string,"report_id": string | null,"target_profile_id": string | null,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"admin_user_id": string,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"reason": string,"report_id"?: string | null,"target_profile_id"?: string | null,"target_user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"admin_user_id"?: string,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"reason"?: string,"report_id"?: string | null,"target_profile_id"?: string | null,"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_actions_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_actions_target_profile_id_fkey"
      columns: ["target_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_actions_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_deliveries": {
                  Row: {
                    "channel": string,"created_at": string,"error": string | null,"id": string,"notification_id": string | null,"provider": string | null,"provider_message_id": string | null,"status": string,"template_key": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel": string,"created_at"?: string,"error"?: string | null,"id"?: string,"notification_id"?: string | null,"provider"?: string | null,"provider_message_id"?: string | null,"status": string,"template_key"?: string | null,"user_id": string
                  }
                  Update: {
                    "channel"?: string,"created_at"?: string,"error"?: string | null,"id"?: string,"notification_id"?: string | null,"provider"?: string | null,"provider_message_id"?: string | null,"status"?: string,"template_key"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_deliveries_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: false
      referencedRelation: "notifications"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_deliveries_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "category": string,"channel": string,"enabled": boolean,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"channel": string,"enabled": boolean,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "category"?: string,"channel"?: string,"enabled"?: boolean,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_templates": {
                  Row: {
                    "body": string,"channel": string,"id": string,"is_active": boolean,"key": string,"locale": string,"provider_template_id": string | null,"subject": string | null,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"channel": string,"id"?: string,"is_active"?: boolean,"key": string,"locale"?: string,"provider_template_id"?: string | null,"subject"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "body"?: string,"channel"?: string,"id"?: string,"is_active"?: boolean,"key"?: string,"locale"?: string,"provider_template_id"?: string | null,"subject"?: string | null,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"data": NonNullable<Json>,"id": string,"read_at": string | null,"title": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"read_at"?: string | null,"title": string,"type": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: string,"read_at"?: string | null,"title"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"onboarding_questions": {
                  Row: {
                    "help_text": string | null,"id": string,"input_type": string,"is_active": boolean,"is_required": boolean,"key": string,"maps_to": string | null,"options": NonNullable<Json>,"prompt": string,"section": string,"sort_order": number,"translations": NonNullable<Json>,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "help_text"?: string | null,"id"?: string,"input_type": string,"is_active"?: boolean,"is_required"?: boolean,"key": string,"maps_to"?: string | null,"options"?: NonNullable<Json>,"prompt": string,"section": string,"sort_order"?: number,"translations"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "help_text"?: string | null,"id"?: string,"input_type"?: string,"is_active"?: boolean,"is_required"?: boolean,"key"?: string,"maps_to"?: string | null,"options"?: NonNullable<Json>,"prompt"?: string,"section"?: string,"sort_order"?: number,"translations"?: NonNullable<Json>,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"partner_preferences": {
                  Row: {
                    "age_max": number | null,"age_min": number | null,"children_preferences": (string)[],"cities": (string)[],"core_values": (string)[],"countries": (string)[],"diets": (string)[],"drinking_ok": (string)[],"education_levels": (string)[],"family_values": (string)[],"free_text": string | null,"height_max_cm": number | null,"height_min_cm": number | null,"living_arrangements": (string)[],"marital_statuses": (string)[],"min_income_range": string | null,"mother_tongues": (string)[],"non_negotiables": (string)[],"open_to_relocate_partner": boolean | null,"personality_traits": (string)[],"professions": (string)[],"profile_id": string,"religions": (string)[],"seeking_genders": (string)[],"smoking_ok": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "age_max"?: number | null,"age_min"?: number | null,"children_preferences"?: (string)[],"cities"?: (string)[],"core_values"?: (string)[],"countries"?: (string)[],"diets"?: (string)[],"drinking_ok"?: (string)[],"education_levels"?: (string)[],"family_values"?: (string)[],"free_text"?: string | null,"height_max_cm"?: number | null,"height_min_cm"?: number | null,"living_arrangements"?: (string)[],"marital_statuses"?: (string)[],"min_income_range"?: string | null,"mother_tongues"?: (string)[],"non_negotiables"?: (string)[],"open_to_relocate_partner"?: boolean | null,"personality_traits"?: (string)[],"professions"?: (string)[],"profile_id": string,"religions"?: (string)[],"seeking_genders"?: (string)[],"smoking_ok"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "age_max"?: number | null,"age_min"?: number | null,"children_preferences"?: (string)[],"cities"?: (string)[],"core_values"?: (string)[],"countries"?: (string)[],"diets"?: (string)[],"drinking_ok"?: (string)[],"education_levels"?: (string)[],"family_values"?: (string)[],"free_text"?: string | null,"height_max_cm"?: number | null,"height_min_cm"?: number | null,"living_arrangements"?: (string)[],"marital_statuses"?: (string)[],"min_income_range"?: string | null,"mother_tongues"?: (string)[],"non_negotiables"?: (string)[],"open_to_relocate_partner"?: boolean | null,"personality_traits"?: (string)[],"professions"?: (string)[],"profile_id"?: string,"religions"?: (string)[],"seeking_genders"?: (string)[],"smoking_ok"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "partner_preferences_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"passes": {
                  Row: {
                    "created_at": string,"profile_id": string,"target_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"profile_id": string,"target_profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"profile_id"?: string,"target_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "passes_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "passes_target_profile_id_fkey"
      columns: ["target_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_webhook_events": {
                  Row: {
                    "error": string | null,"event_type": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"event_type": string,"id": string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"received_at"?: string
                  }
                  Update: {
                    "error"?: string | null,"event_type"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"billing_email": string | null,"billing_name": string | null,"billing_phone": string | null,"billing_state": string | null,"cgst_paise": number,"coupon_id": string | null,"created_at": string,"currency": string,"customer_gstin": string | null,"discount_paise": number,"failure_reason": string | null,"gst_paise": number,"id": string,"igst_paise": number,"interval": string | null,"list_amount_paise": number,"method": string | null,"paid_at": string | null,"plan_id": string | null,"price_id": string | null,"razorpay_order_id": string | null,"razorpay_payment_id": string | null,"refunded_paise": number,"sgst_paise": number,"status": string,"subscription_id": string | null,"taxable_paise": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"billing_email"?: string | null,"billing_name"?: string | null,"billing_phone"?: string | null,"billing_state"?: string | null,"cgst_paise"?: number,"coupon_id"?: string | null,"created_at"?: string,"currency"?: string,"customer_gstin"?: string | null,"discount_paise"?: number,"failure_reason"?: string | null,"gst_paise": number,"id"?: string,"igst_paise"?: number,"interval"?: string | null,"list_amount_paise": number,"method"?: string | null,"paid_at"?: string | null,"plan_id"?: string | null,"price_id"?: string | null,"razorpay_order_id"?: string | null,"razorpay_payment_id"?: string | null,"refunded_paise"?: number,"sgst_paise"?: number,"status"?: string,"subscription_id"?: string | null,"taxable_paise": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "amount_paise"?: number,"billing_email"?: string | null,"billing_name"?: string | null,"billing_phone"?: string | null,"billing_state"?: string | null,"cgst_paise"?: number,"coupon_id"?: string | null,"created_at"?: string,"currency"?: string,"customer_gstin"?: string | null,"discount_paise"?: number,"failure_reason"?: string | null,"gst_paise"?: number,"id"?: string,"igst_paise"?: number,"interval"?: string | null,"list_amount_paise"?: number,"method"?: string | null,"paid_at"?: string | null,"plan_id"?: string | null,"price_id"?: string | null,"razorpay_order_id"?: string | null,"razorpay_payment_id"?: string | null,"refunded_paise"?: number,"sgst_paise"?: number,"status"?: string,"subscription_id"?: string | null,"taxable_paise"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_price_id_fkey"
      columns: ["price_id"]
isOneToOne: false
      referencedRelation: "plan_prices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscriptions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_entitlements": {
                  Row: {
                    "key": string,"plan_id": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"plan_id": string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"plan_id"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_entitlements_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_prices": {
                  Row: {
                    "amount_paise": number,"created_at": string,"currency": string,"id": string,"interval": string,"is_active": boolean,"plan_id": string,"razorpay_plan_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"created_at"?: string,"currency"?: string,"id"?: string,"interval": string,"is_active"?: boolean,"plan_id": string,"razorpay_plan_id"?: string | null
                  }
                  Update: {
                    "amount_paise"?: number,"created_at"?: string,"currency"?: string,"id"?: string,"interval"?: string,"is_active"?: boolean,"plan_id"?: string,"razorpay_plan_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_prices_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"plans": {
                  Row: {
                    "code": string,"created_at": string,"description": string | null,"id": string,"is_active": boolean,"is_public": boolean,"name": string,"sort_order": number,"tagline": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_public"?: boolean,"name": string,"sort_order"?: number,"tagline"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"is_active"?: boolean,"is_public"?: boolean,"name"?: string,"sort_order"?: number,"tagline"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_settings": {
                  Row: {
                    "description": string | null,"is_public": boolean,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"is_public"?: boolean,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"is_public"?: boolean,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"profile_career": {
                  Row: {
                    "company": string | null,"designation": string | null,"employment_type": string | null,"income_range": string | null,"income_visibility": string,"profession": string | null,"profile_id": string,"relocation_willingness": string | null,"updated_at": string,"work_city": string | null,"work_country": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "company"?: string | null,"designation"?: string | null,"employment_type"?: string | null,"income_range"?: string | null,"income_visibility"?: string,"profession"?: string | null,"profile_id": string,"relocation_willingness"?: string | null,"updated_at"?: string,"work_city"?: string | null,"work_country"?: string | null
                  }
                  Update: {
                    "company"?: string | null,"designation"?: string | null,"employment_type"?: string | null,"income_range"?: string | null,"income_visibility"?: string,"profession"?: string | null,"profile_id"?: string,"relocation_willingness"?: string | null,"updated_at"?: string,"work_city"?: string | null,"work_country"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_career_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_education": {
                  Row: {
                    "created_at": string,"graduation_year": number | null,"id": string,"institution": string | null,"is_highest": boolean,"level": string,"profile_id": string,"qualification": string,"specialization": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"graduation_year"?: number | null,"id"?: string,"institution"?: string | null,"is_highest"?: boolean,"level": string,"profile_id": string,"qualification": string,"specialization"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"graduation_year"?: number | null,"id"?: string,"institution"?: string | null,"is_highest"?: boolean,"level"?: string,"profile_id"?: string,"qualification"?: string,"specialization"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_education_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_family": {
                  Row: {
                    "brothers": number | null,"family_background": string | null,"family_location": string | null,"family_native_place": string | null,"family_structure": string | null,"family_values": string | null,"father_occupation": string | null,"mother_occupation": string | null,"profile_id": string,"siblings_details": string | null,"sisters": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brothers"?: number | null,"family_background"?: string | null,"family_location"?: string | null,"family_native_place"?: string | null,"family_structure"?: string | null,"family_values"?: string | null,"father_occupation"?: string | null,"mother_occupation"?: string | null,"profile_id": string,"siblings_details"?: string | null,"sisters"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "brothers"?: number | null,"family_background"?: string | null,"family_location"?: string | null,"family_native_place"?: string | null,"family_structure"?: string | null,"family_values"?: string | null,"father_occupation"?: string | null,"mother_occupation"?: string | null,"profile_id"?: string,"siblings_details"?: string | null,"sisters"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_family_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_lifestyle": {
                  Row: {
                    "diet": string | null,"drinking": string | null,"fitness": string | null,"hobbies": (string)[],"interests": (string)[],"profile_id": string,"smoking": string | null,"travel": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "diet"?: string | null,"drinking"?: string | null,"fitness"?: string | null,"hobbies"?: (string)[],"interests"?: (string)[],"profile_id": string,"smoking"?: string | null,"travel"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "diet"?: string | null,"drinking"?: string | null,"fitness"?: string | null,"hobbies"?: (string)[],"interests"?: (string)[],"profile_id"?: string,"smoking"?: string | null,"travel"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_lifestyle_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_photos": {
                  Row: {
                    "created_at": string,"height": number | null,"id": string,"is_primary": boolean,"moderated_at": string | null,"moderated_by": string | null,"moderation_reason": string | null,"moderation_status": string,"profile_id": string,"sort_order": number,"storage_path": string,"visibility": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"height"?: number | null,"id"?: string,"is_primary"?: boolean,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation_reason"?: string | null,"moderation_status"?: string,"profile_id": string,"sort_order"?: number,"storage_path": string,"visibility"?: string,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"height"?: number | null,"id"?: string,"is_primary"?: boolean,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation_reason"?: string | null,"moderation_status"?: string,"profile_id"?: string,"sort_order"?: number,"storage_path"?: string,"visibility"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_photos_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_values": {
                  Row: {
                    "career_ambitions": string | null,"children_preference": string | null,"communication_style": string | null,"conflict_style": string | null,"emotional_expectations": string | null,"family_responsibilities": string | null,"financial_philosophy": string | null,"future_goals": string | null,"household_split": string | null,"independence_level": string | null,"living_arrangement": string | null,"profile_id": string,"relationship_expectations": string | null,"settle_preference": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "career_ambitions"?: string | null,"children_preference"?: string | null,"communication_style"?: string | null,"conflict_style"?: string | null,"emotional_expectations"?: string | null,"family_responsibilities"?: string | null,"financial_philosophy"?: string | null,"future_goals"?: string | null,"household_split"?: string | null,"independence_level"?: string | null,"living_arrangement"?: string | null,"profile_id": string,"relationship_expectations"?: string | null,"settle_preference"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "career_ambitions"?: string | null,"children_preference"?: string | null,"communication_style"?: string | null,"conflict_style"?: string | null,"emotional_expectations"?: string | null,"family_responsibilities"?: string | null,"financial_philosophy"?: string | null,"future_goals"?: string | null,"household_split"?: string | null,"independence_level"?: string | null,"living_arrangement"?: string | null,"profile_id"?: string,"relationship_expectations"?: string | null,"settle_preference"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_values_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_videos": {
                  Row: {
                    "created_at": string,"duration_seconds": number | null,"id": string,"moderated_at": string | null,"moderated_by": string | null,"moderation_reason": string | null,"moderation_status": string,"profile_id": string,"storage_path": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_seconds"?: number | null,"id"?: string,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation_reason"?: string | null,"moderation_status"?: string,"profile_id": string,"storage_path": string,"visibility"?: string
                  }
                  Update: {
                    "created_at"?: string,"duration_seconds"?: number | null,"id"?: string,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation_reason"?: string | null,"moderation_status"?: string,"profile_id"?: string,"storage_path"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_videos_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_views": {
                  Row: {
                    "created_at": string,"id": number,"source": string | null,"viewed_profile_id": string,"viewer_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"source"?: string | null,"viewed_profile_id": string,"viewer_profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"source"?: string | null,"viewed_profile_id"?: string,"viewer_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_views_viewed_profile_id_fkey"
      columns: ["viewed_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_views_viewer_profile_id_fkey"
      columns: ["viewer_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "about": string | null,"activated_at": string | null,"community": string | null,"completion_pct": number,"core_values": (string)[],"created_at": string,"created_for": string,"current_city": string | null,"current_country": string | null,"current_state": string | null,"date_of_birth": string | null,"embedding": string | null,"embedding_model": string | null,"embedding_updated_at": string | null,"first_name": string | null,"gender": string | null,"has_children": boolean | null,"height_cm": number | null,"id": string,"is_identity_verified": boolean,"is_photo_verified": boolean,"languages": (string)[],"last_active_at": string | null,"last_name": string | null,"managed_by_relation": string | null,"marital_status": string | null,"messaging_policy": string,"mother_tongue": string | null,"name_visibility": string,"nationality": string | null,"native_place": string | null,"onboarding_step": string | null,"owner_user_id": string,"personality_traits": (string)[],"photo_visibility": string,"profile_code": string,"religion": string | null,"review_note": string | null,"review_submitted_at": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"search_text": string | null,"search_tsv": unknown,"sensitive_fields_visibility": string,"status": string,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "about"?: string | null,"activated_at"?: string | null,"community"?: string | null,"completion_pct"?: number,"core_values"?: (string)[],"created_at"?: string,"created_for"?: string,"current_city"?: string | null,"current_country"?: string | null,"current_state"?: string | null,"date_of_birth"?: string | null,"embedding"?: string | null,"embedding_model"?: string | null,"embedding_updated_at"?: string | null,"first_name"?: string | null,"gender"?: string | null,"has_children"?: boolean | null,"height_cm"?: number | null,"id"?: string,"is_identity_verified"?: boolean,"is_photo_verified"?: boolean,"languages"?: (string)[],"last_active_at"?: string | null,"last_name"?: string | null,"managed_by_relation"?: string | null,"marital_status"?: string | null,"messaging_policy"?: string,"mother_tongue"?: string | null,"name_visibility"?: string,"nationality"?: string | null,"native_place"?: string | null,"onboarding_step"?: string | null,"owner_user_id": string,"personality_traits"?: (string)[],"photo_visibility"?: string,"profile_code"?: string,"religion"?: string | null,"review_note"?: string | null,"review_submitted_at"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"search_text"?: string | null,"search_tsv"?: never,"sensitive_fields_visibility"?: string,"status"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "about"?: string | null,"activated_at"?: string | null,"community"?: string | null,"completion_pct"?: number,"core_values"?: (string)[],"created_at"?: string,"created_for"?: string,"current_city"?: string | null,"current_country"?: string | null,"current_state"?: string | null,"date_of_birth"?: string | null,"embedding"?: string | null,"embedding_model"?: string | null,"embedding_updated_at"?: string | null,"first_name"?: string | null,"gender"?: string | null,"has_children"?: boolean | null,"height_cm"?: number | null,"id"?: string,"is_identity_verified"?: boolean,"is_photo_verified"?: boolean,"languages"?: (string)[],"last_active_at"?: string | null,"last_name"?: string | null,"managed_by_relation"?: string | null,"marital_status"?: string | null,"messaging_policy"?: string,"mother_tongue"?: string | null,"name_visibility"?: string,"nationality"?: string | null,"native_place"?: string | null,"onboarding_step"?: string | null,"owner_user_id"?: string,"personality_traits"?: (string)[],"photo_visibility"?: string,"profile_code"?: string,"religion"?: string | null,"review_note"?: string | null,"review_submitted_at"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"search_text"?: string | null,"search_tsv"?: never,"sensitive_fields_visibility"?: string,"status"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_owner_user_id_fkey"
      columns: ["owner_user_id"]
isOneToOne: true
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"question_responses": {
                  Row: {
                    "answer": NonNullable<Json>,"answered_at": string,"profile_id": string,"question_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": NonNullable<Json>,"answered_at"?: string,"profile_id": string,"question_key": string
                  }
                  Update: {
                    "answer"?: NonNullable<Json>,"answered_at"?: string,"profile_id"?: string,"question_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "question_responses_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limit_counters": {
                  Row: {
                    "bucket": string,"count": number,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"count"?: number,"window_start": string
                  }
                  Update: {
                    "bucket"?: string,"count"?: number,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"readiness_notes": {
                  Row: {
                    "explored_at": string | null,"my_view": string | null,"profile_id": string,"questions_to_ask": (string)[],"topic": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "explored_at"?: string | null,"my_view"?: string | null,"profile_id": string,"questions_to_ask"?: (string)[],"topic": string,"updated_at"?: string
                  }
                  Update: {
                    "explored_at"?: string | null,"my_view"?: string | null,"profile_id"?: string,"questions_to_ask"?: (string)[],"topic"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "readiness_notes_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"recommendations": {
                  Row: {
                    "batch_date": string,"candidate_profile_id": string,"created_at": string,"created_by": string | null,"id": string,"profile_id": string,"reason": string | null,"score": number,"source": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_date"?: string,"candidate_profile_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"profile_id": string,"reason"?: string | null,"score": number,"source"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "batch_date"?: string,"candidate_profile_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"profile_id"?: string,"reason"?: string | null,"score"?: number,"source"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recommendations_candidate_profile_id_fkey"
      columns: ["candidate_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recommendations_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount_paise": number,"approved_by": string | null,"created_at": string,"id": string,"notes": string | null,"payment_id": string,"razorpay_refund_id": string | null,"reason": string,"requested_by": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"approved_by"?: string | null,"created_at"?: string,"id"?: string,"notes"?: string | null,"payment_id": string,"razorpay_refund_id"?: string | null,"reason": string,"requested_by"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "amount_paise"?: number,"approved_by"?: string | null,"created_at"?: string,"id"?: string,"notes"?: string | null,"payment_id"?: string,"razorpay_refund_id"?: string | null,"reason"?: string,"requested_by"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"regions": {
                  Row: {
                    "code": string,"country_code": string,"is_enabled": boolean,"matching_config_region": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"country_code": string,"is_enabled"?: boolean,"matching_config_region"?: string,"name": string
                  }
                  Update: {
                    "code"?: string,"country_code"?: string,"is_enabled"?: boolean,"matching_config_region"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"relationship_dna": {
                  Row: {
                    "confirmed_at": string | null,"dimension": string,"flexible": boolean,"importance": number,"partner_target": number | null,"profile_id": string,"self_score": number,"source": string,"statement": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_at"?: string | null,"dimension": string,"flexible"?: boolean,"importance"?: number,"partner_target"?: number | null,"profile_id": string,"self_score": number,"source"?: string,"statement"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "confirmed_at"?: string | null,"dimension"?: string,"flexible"?: boolean,"importance"?: number,"partner_target"?: number | null,"profile_id"?: string,"self_score"?: number,"source"?: string,"statement"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "relationship_dna_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "assigned_to": string | null,"created_at": string,"details": string | null,"id": string,"priority": string,"reason": string,"reporter_profile_id": string | null,"reporter_user_id": string | null,"resolution": string | null,"resolved_at": string | null,"status": string,"target_message_id": string | null,"target_photo_id": string | null,"target_profile_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"created_at"?: string,"details"?: string | null,"id"?: string,"priority"?: string,"reason": string,"reporter_profile_id"?: string | null,"reporter_user_id"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"status"?: string,"target_message_id"?: string | null,"target_photo_id"?: string | null,"target_profile_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"created_at"?: string,"details"?: string | null,"id"?: string,"priority"?: string,"reason"?: string,"reporter_profile_id"?: string | null,"reporter_user_id"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"status"?: string,"target_message_id"?: string | null,"target_photo_id"?: string | null,"target_profile_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_profile_id_fkey"
      columns: ["reporter_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_user_id_fkey"
      columns: ["reporter_user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_message_id_fkey"
      columns: ["target_message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_photo_id_fkey"
      columns: ["target_photo_id"]
isOneToOne: false
      referencedRelation: "profile_photos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_profile_id_fkey"
      columns: ["target_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"risk_signals": {
                  Row: {
                    "created_at": string,"details": NonNullable<Json>,"id": string,"kind": string,"profile_id": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"severity": number,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"kind": string,"profile_id"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"severity": number,"status"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"details"?: NonNullable<Json>,"id"?: string,"kind"?: string,"profile_id"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"severity"?: number,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "risk_signals_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "risk_signals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"shortlists": {
                  Row: {
                    "added_by_user_id": string | null,"created_at": string,"note": string | null,"owner_profile_id": string,"target_profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by_user_id"?: string | null,"created_at"?: string,"note"?: string | null,"owner_profile_id": string,"target_profile_id": string
                  }
                  Update: {
                    "added_by_user_id"?: string | null,"created_at"?: string,"note"?: string | null,"owner_profile_id"?: string,"target_profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shortlists_owner_profile_id_fkey"
      columns: ["owner_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shortlists_target_profile_id_fkey"
      columns: ["target_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "auto_renew": boolean,"cancel_at_period_end": boolean,"cancelled_at": string | null,"created_at": string,"current_period_end": string | null,"current_period_start": string | null,"granted_by_admin": string | null,"id": string,"plan_id": string,"price_id": string | null,"razorpay_order_id": string | null,"razorpay_subscription_id": string | null,"reminder_1d_sent_at": string | null,"reminder_7d_sent_at": string | null,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_renew"?: boolean,"cancel_at_period_end"?: boolean,"cancelled_at"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"granted_by_admin"?: string | null,"id"?: string,"plan_id": string,"price_id"?: string | null,"razorpay_order_id"?: string | null,"razorpay_subscription_id"?: string | null,"reminder_1d_sent_at"?: string | null,"reminder_7d_sent_at"?: string | null,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "auto_renew"?: boolean,"cancel_at_period_end"?: boolean,"cancelled_at"?: string | null,"created_at"?: string,"current_period_end"?: string | null,"current_period_start"?: string | null,"granted_by_admin"?: string | null,"id"?: string,"plan_id"?: string,"price_id"?: string | null,"razorpay_order_id"?: string | null,"razorpay_subscription_id"?: string | null,"reminder_1d_sent_at"?: string | null,"reminder_7d_sent_at"?: string | null,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_price_id_fkey"
      columns: ["price_id"]
isOneToOne: false
      referencedRelation: "plan_prices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"support_messages": {
                  Row: {
                    "author_user_id": string | null,"body": string,"created_at": string,"id": string,"is_internal_note": boolean,"is_staff": boolean,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_user_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"is_internal_note"?: boolean,"is_staff"?: boolean,"ticket_id": string
                  }
                  Update: {
                    "author_user_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"is_internal_note"?: boolean,"is_staff"?: boolean,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_messages_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "support_tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"support_tickets": {
                  Row: {
                    "assigned_to": string | null,"category": string,"contact_email": string | null,"created_at": string,"id": string,"priority": string,"status": string,"subject": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"category": string,"contact_email"?: string | null,"created_at"?: string,"id"?: string,"priority"?: string,"status"?: string,"subject": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "assigned_to"?: string | null,"category"?: string,"contact_email"?: string | null,"created_at"?: string,"id"?: string,"priority"?: string,"status"?: string,"subject"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_tickets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"usage_counters": {
                  Row: {
                    "count": number,"key": string,"period_start": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"period_start": string,"user_id": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"period_start"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_counters_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"user_devices": {
                  Row: {
                    "app_version": string | null,"created_at": string,"device_name": string | null,"id": string,"last_seen_at": string,"platform": string,"push_provider": string | null,"push_token": string | null,"revoked_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_version"?: string | null,"created_at"?: string,"device_name"?: string | null,"id"?: string,"last_seen_at"?: string,"platform": string,"push_provider"?: string | null,"push_token"?: string | null,"revoked_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "app_version"?: string | null,"created_at"?: string,"device_name"?: string | null,"id"?: string,"last_seen_at"?: string,"platform"?: string,"push_provider"?: string | null,"push_token"?: string | null,"revoked_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_devices_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                },"verification_events": {
                  Row: {
                    "actor_user_id": string | null,"created_at": string,"from_status": string | null,"id": number,"note": string | null,"to_status": string,"verification_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user_id"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: never,"note"?: string | null,"to_status": string,"verification_id": string
                  }
                  Update: {
                    "actor_user_id"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: never,"note"?: string | null,"to_status"?: string,"verification_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verification_events_verification_id_fkey"
      columns: ["verification_id"]
isOneToOne: false
      referencedRelation: "verifications"
      referencedColumns: ["id"]
    }
                  ]
                },"verifications": {
                  Row: {
                    "attempt": number,"created_at": string,"document_paths": (string)[],"document_type": string | null,"expires_at": string | null,"id": string,"kind": string,"profile_id": string,"provider": string,"provider_reference": string | null,"rejection_reason": string | null,"reviewed_at": string | null,"reviewer_id": string | null,"status": string,"submitted_data": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt"?: number,"created_at"?: string,"document_paths"?: (string)[],"document_type"?: string | null,"expires_at"?: string | null,"id"?: string,"kind": string,"profile_id": string,"provider"?: string,"provider_reference"?: string | null,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewer_id"?: string | null,"status"?: string,"submitted_data"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "attempt"?: number,"created_at"?: string,"document_paths"?: (string)[],"document_type"?: string | null,"expires_at"?: string | null,"id"?: string,"kind"?: string,"profile_id"?: string,"provider"?: string,"provider_reference"?: string | null,"rejection_reason"?: string | null,"reviewed_at"?: string | null,"reviewer_id"?: string | null,"status"?: string,"submitted_data"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "verifications_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"vision_board_items": {
                  Row: {
                    "author_profile_id": string,"category": string,"connection_id": string,"content": string,"created_at": string,"id": string,"is_shared": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_profile_id": string,"category": string,"connection_id": string,"content": string,"created_at"?: string,"id"?: string,"is_shared"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "author_profile_id"?: string,"category"?: string,"connection_id"?: string,"content"?: string,"created_at"?: string,"id"?: string,"is_shared"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vision_board_items_author_profile_id_fkey"
      columns: ["author_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vision_board_items_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "current_consents": {
                  Row: {
                    "consent_type": string,"created_at": string,"granted": boolean,"policy_version": string,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "consent_records_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "app_users"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_ai_usage":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "cache_read_tokens": number,"cache_write_tokens": number,"cost_usd_micros": number,"errors": number,"feature": string,"input_tokens": number,"model": string,"output_tokens": number,"p50_latency_ms": number,"p95_latency_ms": number,"provider": string,"refusals": number,"requests": number
            }[]
                           },
"admin_completion_distribution":
{ Args: Record<PropertyKey, never>; Returns: {
              "bucket": number,"profiles": number
            }[]
                           },
"admin_engagement":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"admin_matching_stats":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"admin_onboarding_funnel":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "step": string,"step_order": number,"users": number
            }[]
                           },
"admin_overview_metrics":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"admin_timeseries":
{ Args: { "p_from": string,"p_metric": string,"p_to": string }; Returns: {
              "day": string,"value": number
            }[]
                           },
"billing_activate_payment":
{ Args: { "p_method": string,"p_paid_at"?: string,"p_payment_id": string,"p_razorpay_payment_id": string }; Returns: Json
                           },
"conversation_not_blocked":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"family_can":
{ Args: { "p_permission": string,"p_profile_id": string }; Returns: boolean
                           },
"has_permission":
{ Args: { "p_permission": string }; Returns: boolean
                           },
"increment_usage":
{ Args: { "p_key": string,"p_limit": number,"p_period": string,"p_user": string }; Returns: number
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_blocked_between":
{ Args: { "p1": string,"p2": string }; Returns: boolean
                           },
"is_connection_member":
{ Args: { "p_connection_id": string }; Returns: boolean
                           },
"is_conversation_participant":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"my_profile_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"next_invoice_number":
{ Args: { "p_fy": string }; Returns: string
                           },
"owns_profile":
{ Args: { "p_profile_id": string }; Returns: boolean
                           },
"rate_limit_hit":
{ Args: { "p_bucket": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"recommendation_candidates":
{ Args: { "p_age_max": number,"p_age_min": number,"p_limit"?: number,"p_seeking": (string)[],"p_viewer": string }; Returns: {
              "profile_id": string
            }[]
                           },
"search_profile_ids":
{ Args: { "p_embedding"?: string,"p_exclude_passed"?: boolean,"p_filters": Json,"p_limit"?: number,"p_offset"?: number,"p_text"?: string,"p_viewer": string }; Returns: {
              "activated_at": string,"last_active_at": string,"profile_id": string,"text_rank": number,"vector_similarity": number
            }[]
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
