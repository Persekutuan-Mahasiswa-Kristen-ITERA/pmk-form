// ==========================================
// Type Definitions — Generic Form Platform
//==========================================

// Field types supported by the generic form builder
export type FieldType =
  | 'text'
  | 'long_text'
  | 'short_text'
  | 'number'
  | 'email'
  | 'phone'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'datetime'
  | 'file_upload'
  | 'url'
  | 'address';

// Single field configuration (item inside forms.form_fields array)
export interface FieldConfig {
  id: string;              // Stable identifier: "field_name", "field_nim", etc.
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  helperText?: string;
  required?: boolean;
  requiredMessage?: string;
  options?: FieldOption[]; // For dropdown, radio, checkbox
  validation?: FieldValidation;
  defaultValue?: string | string[] | number | boolean | null;
  visible?: boolean;       // Conditional visibility
  visibleIf?: {            // Show this field only if another field matches
    fieldId: string;
    value: string | string[];
  };
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;        // Regex string
  patternMessage?: string;
  customMessage?: string;
}

// Form type enumeration
export type FormType = 'recruitment' | 'event' | 'survey' | 'presensi' | 'general';

// Settings stored in forms.settings jsonb
export interface FormSettings {
  allowed_angkatan?: number[];
  wa_group_link?: string;
  collect_identity?: boolean; // If true, collect NIM/email/name in answers
  max_responses?: number | null;
  require_login?: boolean;
  show_progress?: boolean;
  thank_you_message?: string;
  redirect_url?: string;
  [key: string]: unknown; // Allow extra settings
}

// Main form entity (maps to public.forms table)
export interface Form {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  form_type: FormType;
  is_open: boolean;
  open_date: string;
  close_date: string;
  form_fields: FieldConfig[];
  settings: FormSettings;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// FormResponse — maps to public.form_responses table
// NOTE: All identity data (NIM, email, name) lives inside `answers` jsonb
export interface FormResponse {
  id: string;
  form_id: string;
  answers: Record<string, unknown>; // Key = field id, Value = string | string[] | null
  files: string[];                  // Array of public URL strings
  respondent_id: string | null;
  submitted_at: string;
  updated_at: string;
}

// Input type for creating a new response (what the public form submits)
export interface FormResponseInput {
  form_id: string;
  answers: Record<string, unknown>;
  files?: string[];
  respondent_id?: string;
}

// Role definitions
export type UserRole = 'super_admin' | 'divisi_admin';

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  division: string | null;
  created_at: string;
}

// Permission check result
export interface PermissionCheck {
  canViewForms: boolean;
  canCreateForms: boolean;
  canEditForm: boolean;
  canDeleteForm: boolean;
  canViewResponses: boolean;
  canDeleteResponses: boolean;
  canExportResponses: boolean;
  division?: string | null;
}

// Reusable type for form field value
export type FieldValue = string | string[] | number | boolean | null | undefined;

// Type for form submission result
export interface FormSubmissionResult {
  success: boolean;
  responseId?: string;
  error?: string;
  duplicate?: boolean;
}
