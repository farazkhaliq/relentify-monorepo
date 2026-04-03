-- 002_feed_triggers.sql
-- Trigger-based materialised feed for ts_entries, ts_breaks, ts_shifts

-- Generic trigger function for tables with user_id/entity_id/worker_user_id
CREATE OR REPLACE FUNCTION ts_create_feed_event() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ts_feed_events (
    id, user_id, entity_id, worker_user_id,
    event_type, entry_id, shift_id,
    source_table, source_id, created_at
  ) VALUES (
    gen_random_uuid(),
    NEW.user_id,
    NEW.entity_id,
    NEW.worker_user_id,
    TG_ARGV[0],
    CASE WHEN TG_TABLE_NAME = 'ts_entries' THEN NEW.id ELSE NULL END,
    CASE WHEN TG_TABLE_NAME = 'ts_shifts' THEN NEW.id ELSE NULL END,
    TG_TABLE_NAME,
    NEW.id,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Separate trigger function for ts_breaks (needs entry lookup for user_id/entity_id)
CREATE OR REPLACE FUNCTION ts_create_break_feed_event() RETURNS TRIGGER AS $$
DECLARE
  v_entry ts_entries%ROWTYPE;
BEGIN
  SELECT * INTO v_entry FROM ts_entries WHERE id = NEW.entry_id;
  INSERT INTO ts_feed_events (
    id, user_id, entity_id, worker_user_id,
    event_type, entry_id, shift_id,
    source_table, source_id, created_at
  ) VALUES (
    gen_random_uuid(),
    v_entry.user_id, v_entry.entity_id, v_entry.worker_user_id,
    TG_ARGV[0], NEW.entry_id, NULL,
    'ts_breaks', NEW.id, NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ts_entries triggers
CREATE TRIGGER trg_ts_entries_insert
  AFTER INSERT ON ts_entries FOR EACH ROW
  EXECUTE FUNCTION ts_create_feed_event('clock_in');

CREATE TRIGGER trg_ts_entries_clock_out
  AFTER UPDATE OF clock_out_at ON ts_entries FOR EACH ROW
  WHEN (OLD.clock_out_at IS NULL AND NEW.clock_out_at IS NOT NULL)
  EXECUTE FUNCTION ts_create_feed_event('clock_out');

CREATE TRIGGER trg_ts_entries_status_change
  AFTER UPDATE OF status ON ts_entries FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION ts_create_feed_event('status_change');

CREATE TRIGGER trg_ts_entries_auto_clock_out
  AFTER UPDATE OF auto_clocked_out ON ts_entries FOR EACH ROW
  WHEN (NEW.auto_clocked_out = true AND OLD.auto_clocked_out = false)
  EXECUTE FUNCTION ts_create_feed_event('auto_clock_out');

-- ts_breaks triggers
CREATE TRIGGER trg_ts_breaks_insert
  AFTER INSERT ON ts_breaks FOR EACH ROW
  EXECUTE FUNCTION ts_create_break_feed_event('break_start');

CREATE TRIGGER trg_ts_breaks_end
  AFTER UPDATE OF end_at ON ts_breaks FOR EACH ROW
  WHEN (OLD.end_at IS NULL AND NEW.end_at IS NOT NULL)
  EXECUTE FUNCTION ts_create_break_feed_event('break_end');

-- ts_shifts triggers
CREATE TRIGGER trg_ts_shifts_insert
  AFTER INSERT ON ts_shifts FOR EACH ROW
  EXECUTE FUNCTION ts_create_feed_event('shift_assigned');

CREATE TRIGGER trg_ts_shifts_cancelled
  AFTER UPDATE OF status ON ts_shifts FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
  EXECUTE FUNCTION ts_create_feed_event('shift_cancelled');
