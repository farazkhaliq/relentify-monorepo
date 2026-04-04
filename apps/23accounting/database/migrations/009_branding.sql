ALTER TABLE entities
  ADD COLUMN logo_url     TEXT,
  ADD COLUMN brand_color  VARCHAR(7)  DEFAULT '#10b981',
  ADD COLUMN invoice_footer TEXT,
  ADD COLUMN phone        VARCHAR(50),
  ADD COLUMN website      VARCHAR(255);
