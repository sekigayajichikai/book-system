ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS is_closure boolean DEFAULT false;
