CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  role_title TEXT,
  whatsapp TEXT,
  consent BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  current_situation TEXT,
  objective TEXT NOT NULL,
  audience TEXT NOT NULL,
  presentation_context TEXT,
  presentation_location TEXT,
  duration_minutes INTEGER,
  success_metric TEXT,
  pain_level TEXT,
  urgency TEXT,
  current_material_stage TEXT,
  notes TEXT,
  uploaded_filename TEXT,
  uploaded_path TEXT,
  extracted_text TEXT,
  diagnostic_json JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS crm_stage TEXT NOT NULL DEFAULT 'lead_entrou';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS crm_last_contact_at TIMESTAMP;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS crm_owner TEXT;

CREATE TABLE IF NOT EXISTS crm_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
