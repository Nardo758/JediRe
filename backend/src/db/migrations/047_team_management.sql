-- Migration 047: Deal Team Management Tables
-- Members, tasks, comments, notifications, activity, role templates

-- 1. Deal Team Members (extends team_members for deal-specific roles)
CREATE TABLE IF NOT EXISTS deal_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id TEXT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  role VARCHAR(100) NOT NULL DEFAULT 'member',
  title VARCHAR(255),
  company VARCHAR(255),
  avatar_url TEXT,
  permissions JSONB DEFAULT '{"read": true, "write": false, "admin": false}'::jsonb,
  status VARCHAR(50) DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Deal Tasks
CREATE TABLE IF NOT EXISTS deal_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES deal_team_members(id) ON DELETE SET NULL,
  assigned_to_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'medium',
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  tags TEXT[],
  created_by_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Deal Task Comments
CREATE TABLE IF NOT EXISTS deal_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES deal_tasks(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  author_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Deal Team Activity
CREATE TABLE IF NOT EXISTS deal_team_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  actor_name VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Role Templates
CREATE TABLE IF NOT EXISTS deal_role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{"read": true, "write": false, "admin": false}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_team_members_deal ON deal_team_members(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_team_members_status ON deal_team_members(status);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_deal ON deal_tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_status ON deal_tasks(status);
CREATE INDEX IF NOT EXISTS idx_deal_tasks_assigned ON deal_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deal_task_comments_task ON deal_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_deal_team_activity_deal ON deal_team_activity(deal_id);

-- Triggers
CREATE OR REPLACE FUNCTION update_deal_team_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deal_team_members_updated_at
  BEFORE UPDATE ON deal_team_members
  FOR EACH ROW EXECUTE FUNCTION update_deal_team_updated_at();

CREATE TRIGGER deal_tasks_updated_at
  BEFORE UPDATE ON deal_tasks
  FOR EACH ROW EXECUTE FUNCTION update_deal_team_updated_at();

-- Seed role templates
INSERT INTO deal_role_templates (name, description, permissions) VALUES
  ('Owner', 'Full control over the deal', '{"read": true, "write": true, "admin": true}'),
  ('Lead Analyst', 'Can edit analysis and financial data', '{"read": true, "write": true, "admin": false}'),
  ('Reviewer', 'Can view and comment', '{"read": true, "write": false, "admin": false}'),
  ('External Advisor', 'Limited view access', '{"read": true, "write": false, "admin": false}')
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE deal_team_members IS 'Team members assigned to specific deals';
COMMENT ON TABLE deal_tasks IS 'Tasks associated with deals';
COMMENT ON TABLE deal_task_comments IS 'Comments on deal tasks';
COMMENT ON TABLE deal_team_activity IS 'Activity log for deal team actions';
