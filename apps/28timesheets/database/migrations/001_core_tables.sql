-- 001_core_tables.sql
-- Creates all ts_* tables for Relentify Timesheets
-- Standalone database: no FK refs to users/entities (those live in relentify DB)
-- UUIDs stored for user_id, entity_id, worker_user_id — integrity enforced at application layer

-- ts_sites: Job locations with optional geofencing
CREATE TABLE IF NOT EXISTS ts_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  geofence_radius_metres INTEGER,
  require_photo_on_punch BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_workers: Per-worker timesheet config
CREATE TABLE IF NOT EXISTS ts_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  worker_user_id UUID NOT NULL,
  manager_user_id UUID,
  employee_number VARCHAR(50),
  hourly_rate DECIMAL,
  currency VARCHAR(10) DEFAULT 'GBP',
  employment_type VARCHAR(20) DEFAULT 'full_time',
  contracted_weekly_minutes INTEGER,
  default_site_id UUID REFERENCES ts_sites(id),
  can_work_overtime BOOLEAN DEFAULT true,
  overtime_rate_override DECIMAL,
  allowed_site_ids UUID[],
  require_photo_override BOOLEAN,
  gps_ping_override INTEGER,
  break_rule_overrides JSONB,
  overtime_rule_overrides JSONB,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entity_id, worker_user_id)
);

-- ts_shift_templates: Reusable shift patterns
CREATE TABLE IF NOT EXISTS ts_shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  site_id UUID REFERENCES ts_sites(id),
  name VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  is_paid_break BOOLEAN DEFAULT false,
  recurrence JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_shifts: Individual scheduled shifts
CREATE TABLE IF NOT EXISTS ts_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  template_id UUID REFERENCES ts_shift_templates(id),
  site_id UUID REFERENCES ts_sites(id),
  worker_user_id UUID NOT NULL,
  date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_entries: Core timesheet record — one per shift worked
CREATE TABLE IF NOT EXISTS ts_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  shift_id UUID REFERENCES ts_shifts(id),
  worker_user_id UUID NOT NULL,
  site_id UUID REFERENCES ts_sites(id),
  project_tag VARCHAR(255),
  clock_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out_at TIMESTAMPTZ,
  clock_in_latitude DECIMAL,
  clock_in_longitude DECIMAL,
  clock_out_latitude DECIMAL,
  clock_out_longitude DECIMAL,
  clock_in_ip VARCHAR(45),
  clock_out_ip VARCHAR(45),
  clock_in_device JSONB,
  clock_out_device JSONB,
  clock_in_photo_url VARCHAR(500),
  clock_out_photo_url VARCHAR(500),
  clock_in_photo_hash VARCHAR(64),
  clock_out_photo_hash VARCHAR(64),
  is_within_geofence_in BOOLEAN,
  is_within_geofence_out BOOLEAN,
  auto_clocked_out BOOLEAN DEFAULT false,
  deduction_minutes INTEGER DEFAULT 0,
  deduction_reason VARCHAR(255),
  total_break_minutes INTEGER DEFAULT 0,
  total_worked_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  trust_score INTEGER DEFAULT 0,
  gps_ping_count INTEGER DEFAULT 0,
  gps_pings_in_fence INTEGER DEFAULT 0,
  gps_verification_pct DECIMAL,
  idempotency_key VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_breaks: Break records — multiple per entry
CREATE TABLE IF NOT EXISTS ts_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES ts_entries(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_at TIMESTAMPTZ,
  break_type VARCHAR(10) NOT NULL DEFAULT 'unpaid',
  start_latitude DECIMAL,
  start_longitude DECIMAL,
  end_latitude DECIMAL,
  end_longitude DECIMAL,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_gps_pings: Periodic location checks during active shifts
CREATE TABLE IF NOT EXISTS ts_gps_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES ts_entries(id) ON DELETE CASCADE,
  latitude DECIMAL NOT NULL,
  longitude DECIMAL NOT NULL,
  accuracy_metres DECIMAL,
  is_within_geofence BOOLEAN,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(20) DEFAULT 'low_accuracy'
);

-- ts_overtime_rules: Configurable overtime rules per workspace
CREATE TABLE IF NOT EXISTS ts_overtime_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(20) NOT NULL,
  threshold_minutes INTEGER NOT NULL,
  multiplier DECIMAL NOT NULL DEFAULT 1.5,
  conditions JSONB,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_break_rules: Configurable break rules per workspace
CREATE TABLE IF NOT EXISTS ts_break_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  after_worked_minutes INTEGER NOT NULL,
  break_duration_minutes INTEGER NOT NULL,
  break_type VARCHAR(10) NOT NULL DEFAULT 'unpaid',
  auto_deduct BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_settings: Workspace-wide configuration
CREATE TABLE IF NOT EXISTS ts_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  require_gps BOOLEAN DEFAULT true,
  require_photo BOOLEAN DEFAULT false,
  gps_ping_interval_minutes INTEGER DEFAULT 30,
  auto_clock_out_enabled BOOLEAN DEFAULT true,
  auto_clock_out_after_minutes INTEGER DEFAULT 720,
  auto_clock_out_at_shift_end BOOLEAN DEFAULT true,
  deduction_mode VARCHAR(20) DEFAULT 'flag_for_review',
  deduction_type VARCHAR(10) DEFAULT 'dynamic',
  fixed_deduction_minutes INTEGER,
  project_tag_required BOOLEAN DEFAULT false,
  allow_early_clock_in_minutes INTEGER DEFAULT 15,
  allow_late_clock_out_minutes INTEGER DEFAULT 15,
  gps_retention_days INTEGER DEFAULT 90,
  photo_retention_days INTEGER DEFAULT 90,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entity_id)
);

-- ts_feed_events: Trigger-based materialised feed
CREATE TABLE IF NOT EXISTS ts_feed_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  worker_user_id UUID NOT NULL,
  event_type VARCHAR(30) NOT NULL,
  entry_id UUID,
  shift_id UUID,
  source_table VARCHAR(30) NOT NULL,
  source_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_comments: Comment threads on feed events
CREATE TABLE IF NOT EXISTS ts_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  entry_id UUID REFERENCES ts_entries(id),
  shift_id UUID REFERENCES ts_shifts(id),
  feed_event_type VARCHAR(30),
  feed_event_id VARCHAR(100),
  author_user_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_push_subscriptions: Web Push API subscriptions
CREATE TABLE IF NOT EXISTS ts_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  worker_user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_label VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- ts_audit_log: Audit trail
CREATE TABLE IF NOT EXISTS ts_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  actor_user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_photos: Photo metadata
CREATE TABLE IF NOT EXISTS ts_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES ts_entries(id) ON DELETE CASCADE,
  photo_type VARCHAR(10) NOT NULL,
  hash VARCHAR(64),
  size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_photo_data: Photo binary data (base64 pattern)
CREATE TABLE IF NOT EXISTS ts_photo_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES ts_photos(id) ON DELETE CASCADE,
  data BYTEA NOT NULL
);

-- ts_alert_rules: Smart alert configuration
CREATE TABLE IF NOT EXISTS ts_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  alert_type VARCHAR(30) NOT NULL,
  threshold_value INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_time_off_types: V2 — created empty
CREATE TABLE IF NOT EXISTS ts_time_off_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_paid BOOLEAN DEFAULT true,
  days_per_year DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_time_off_requests: V2 — created empty
CREATE TABLE IF NOT EXISTS ts_time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  worker_user_id UUID NOT NULL,
  type_id UUID REFERENCES ts_time_off_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ts_migration_history: Track applied migrations
CREATE TABLE IF NOT EXISTS ts_migration_history (
  filename VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ts_entries_worker_clock ON ts_entries(worker_user_id, clock_in_at);
CREATE INDEX IF NOT EXISTS idx_ts_entries_entity_status ON ts_entries(entity_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ts_entries_idempotency ON ts_entries(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ts_feed_events_entity_time ON ts_feed_events(entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ts_feed_events_worker ON ts_feed_events(worker_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ts_gps_pings_entry ON ts_gps_pings(entry_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_ts_shifts_worker_date ON ts_shifts(worker_user_id, date);
CREATE INDEX IF NOT EXISTS idx_ts_breaks_entry ON ts_breaks(entry_id);
CREATE INDEX IF NOT EXISTS idx_ts_comments_entry ON ts_comments(entry_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ts_sites_entity ON ts_sites(user_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_ts_workers_entity ON ts_workers(user_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_ts_audit_log_entity ON ts_audit_log(entity_id, created_at DESC);
