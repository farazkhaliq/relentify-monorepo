CREATE TABLE workspace_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_email    VARCHAR(255) NOT NULL,
  permissions      JSONB NOT NULL DEFAULT '{}',
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',
  invite_token     VARCHAR(255) UNIQUE,
  invited_at       TIMESTAMPTZ DEFAULT NOW(),
  accepted_at      TIMESTAMPTZ,
  UNIQUE(owner_user_id, invited_email)
);
CREATE INDEX idx_workspace_members_owner  ON workspace_members(owner_user_id);
CREATE INDEX idx_workspace_members_member ON workspace_members(member_user_id);
CREATE INDEX idx_workspace_members_token  ON workspace_members(invite_token);
