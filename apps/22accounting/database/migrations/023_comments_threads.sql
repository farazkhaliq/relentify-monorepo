-- 023_comments_threads.sql

CREATE TABLE IF NOT EXISTS acc_transaction_comments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id),
  actor_id        UUID        REFERENCES users(id),
  target_user_id  UUID        REFERENCES users(id),
  record_type     TEXT        NOT NULL
                              CHECK (record_type IN ('bill','invoice','expense','bank_transaction','journal')),
  record_id       UUID        NOT NULL,
  parent_id       UUID        REFERENCES acc_transaction_comments(id),
  body            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','resolved')),
  waiting_on      TEXT        CHECK (waiting_on IN ('client','accountant')),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tc_record  ON acc_transaction_comments (record_type, record_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tc_target  ON acc_transaction_comments (target_user_id, created_at DESC) WHERE target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tc_sender  ON acc_transaction_comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tc_parent  ON acc_transaction_comments (parent_id) WHERE parent_id IS NOT NULL;
