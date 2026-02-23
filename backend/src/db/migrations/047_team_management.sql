-- Migration 047: Team Management Tables
-- Comprehensive team collaboration for development deals

-- 1. Team Members Table
CREATE TABLE IF NOT EXISTS deal_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID,
  
  -- Member Details
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  company VARCHAR(255),
  
  -- Role & Permissions
  role VARCHAR(100) NOT NULL, -- owner, partner, analyst, architect, engineer, contractor, etc.
  permissions JSONB DEFAULT '{
    "view": true,
    "edit": false,
    "delete": false,
    "invite": false,
    "financial": false,
    "documents": true
  }'::jsonb,
  
  -- Specialization
  specialization VARCHAR(255), -- "Financial Analysis", "Architectural Design", etc.
  bio TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, pending, removed
  invited_by UUID,
  invited_at TIMESTAMP,
  joined_at TIMESTAMP,
  last_active_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_deal_team_member UNIQUE (deal_id, email)
);

-- 2. Team Tasks Table
CREATE TABLE IF NOT EXISTS deal_team_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Task Details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- due-diligence, design, financial, legal, construction
  
  -- Assignment
  assigned_to_id UUID REFERENCES deal_team_members(id),
  assigned_to_name VARCHAR(255),
  assigned_by_id UUID,
  assigned_by_name VARCHAR(255),
  
  -- Priority & Status
  priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, urgent
  status VARCHAR(50) DEFAULT 'todo', -- todo, in-progress, review, completed, cancelled
  
  -- Timeline
  due_date DATE,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Dependencies
  depends_on UUID[], -- Array of task IDs
  blocks UUID[], -- Array of task IDs this blocks
  
  -- Progress
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  estimated_hours DECIMAL(10, 2),
  actual_hours DECIMAL(10, 2),
  
  -- Attachments & Links
  attachments JSONB DEFAULT '[]'::jsonb,
  linked_modules TEXT[], -- References to other deal modules
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Team Comments/Discussion Table
CREATE TABLE IF NOT EXISTS deal_team_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Comment Context
  context_type VARCHAR(100) NOT NULL, -- task, module, document, general
  context_id UUID, -- ID of task, document, etc.
  
  -- Comment Content
  author_id UUID,
  author_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  
  -- Threading
  parent_comment_id UUID REFERENCES deal_team_comments(id),
  
  -- Mentions & Reactions
  mentioned_user_ids UUID[],
  reactions JSONB DEFAULT '{}'::jsonb, -- {emoji: [user_ids]}
  
  -- Status
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Team Notifications Table
CREATE TABLE IF NOT EXISTS deal_team_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Notification Details
  recipient_id UUID NOT NULL,
  notification_type VARCHAR(100) NOT NULL, -- task_assigned, mention, comment, deadline, update
  title VARCHAR(500) NOT NULL,
  message TEXT,
  
  -- Context
  link_url TEXT, -- Deep link to specific module/task
  context_data JSONB, -- Additional data for rendering notification
  
  -- Status
  read_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Team Activity Log (separate from general deal activity)
CREATE TABLE IF NOT EXISTS deal_team_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  
  -- Activity Details
  user_id UUID,
  user_name VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL, -- joined, invited, completed_task, commented, etc.
  
  -- Context
  target_type VARCHAR(100), -- member, task, comment
  target_id UUID,
  
  -- Description
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Team Roles & Permissions Template (for quick setup)
CREATE TABLE IF NOT EXISTS team_role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Role Details
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Default Permissions
  permissions JSONB NOT NULL,
  
  -- Metadata
  is_system BOOLEAN DEFAULT TRUE, -- System roles vs custom roles
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default role templates
INSERT INTO team_role_templates (name, display_name, description, permissions, is_system) VALUES
('owner', 'Owner', 'Full access to everything', '{
  "view": true,
  "edit": true,
  "delete": true,
  "invite": true,
  "financial": true,
  "documents": true,
  "team_management": true
}'::jsonb, TRUE),
('partner', 'Partner/Co-Investor', 'Full access except team management', '{
  "view": true,
  "edit": true,
  "delete": false,
  "invite": false,
  "financial": true,
  "documents": true,
  "team_management": false
}'::jsonb, TRUE),
('analyst', 'Financial Analyst', 'View all, edit financial models', '{
  "view": true,
  "edit": false,
  "delete": false,
  "invite": false,
  "financial": true,
  "documents": true,
  "team_management": false
}'::jsonb, TRUE),
('architect', 'Architect/Designer', 'View all, edit design modules', '{
  "view": true,
  "edit": true,
  "delete": false,
  "invite": false,
  "financial": false,
  "documents": true,
  "team_management": false
}'::jsonb, TRUE),
('contractor', 'General Contractor', 'View construction-related only', '{
  "view": true,
  "edit": false,
  "delete": false,
  "invite": false,
  "financial": false,
  "documents": true,
  "team_management": false
}'::jsonb, TRUE),
('consultant', 'Consultant/Advisor', 'View only access', '{
  "view": true,
  "edit": false,
  "delete": false,
  "invite": false,
  "financial": false,
  "documents": true,
  "team_management": false
}'::jsonb, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Indexes
CREATE INDEX idx_team_members_deal_id ON deal_team_members(deal_id);
CREATE INDEX idx_team_members_user_id ON deal_team_members(user_id);
CREATE INDEX idx_team_members_status ON deal_team_members(status);

CREATE INDEX idx_team_tasks_deal_id ON deal_team_tasks(deal_id);
CREATE INDEX idx_team_tasks_assigned_to ON deal_team_tasks(assigned_to_id);
CREATE INDEX idx_team_tasks_status ON deal_team_tasks(status);
CREATE INDEX idx_team_tasks_priority ON deal_team_tasks(priority);
CREATE INDEX idx_team_tasks_due_date ON deal_team_tasks(due_date);

CREATE INDEX idx_team_comments_deal_id ON deal_team_comments(deal_id);
CREATE INDEX idx_team_comments_context ON deal_team_comments(context_type, context_id);
CREATE INDEX idx_team_comments_author ON deal_team_comments(author_id);

CREATE INDEX idx_team_notifications_recipient ON deal_team_notifications(recipient_id);
CREATE INDEX idx_team_notifications_read ON deal_team_notifications(read_at);

CREATE INDEX idx_team_activity_deal_id ON deal_team_activity(deal_id);
CREATE INDEX idx_team_activity_user ON deal_team_activity(user_id);

-- Updated timestamp triggers
CREATE OR REPLACE FUNCTION update_team_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON deal_team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_timestamp();

CREATE TRIGGER team_tasks_updated_at
  BEFORE UPDATE ON deal_team_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_team_timestamp();

-- Function to get team stats
CREATE OR REPLACE FUNCTION get_team_stats(p_deal_id UUID)
RETURNS TABLE(
  total_members INTEGER,
  active_members INTEGER,
  total_tasks INTEGER,
  completed_tasks INTEGER,
  overdue_tasks INTEGER,
  unread_comments INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM deal_team_members WHERE deal_id = p_deal_id) as total_members,
    (SELECT COUNT(*)::INTEGER FROM deal_team_members WHERE deal_id = p_deal_id AND status = 'active') as active_members,
    (SELECT COUNT(*)::INTEGER FROM deal_team_tasks WHERE deal_id = p_deal_id) as total_tasks,
    (SELECT COUNT(*)::INTEGER FROM deal_team_tasks WHERE deal_id = p_deal_id AND status = 'completed') as completed_tasks,
    (SELECT COUNT(*)::INTEGER FROM deal_team_tasks WHERE deal_id = p_deal_id AND due_date < CURRENT_DATE AND status NOT IN ('completed', 'cancelled')) as overdue_tasks,
    (SELECT COUNT(*)::INTEGER FROM deal_team_comments WHERE deal_id = p_deal_id AND deleted_at IS NULL) as unread_comments;
END;
$$ LANGUAGE plpgsql;

-- Function to notify team members
CREATE OR REPLACE FUNCTION notify_team_member(
  p_deal_id UUID,
  p_recipient_id UUID,
  p_type VARCHAR,
  p_title VARCHAR,
  p_message TEXT,
  p_link_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO deal_team_notifications (
    deal_id, recipient_id, notification_type, title, message, link_url
  ) VALUES (
    p_deal_id, p_recipient_id, p_type, p_title, p_message, p_link_url
  )
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-log team activity on member join
CREATE OR REPLACE FUNCTION log_team_member_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO deal_team_activity (
      deal_id, user_id, user_name, action, target_type, target_id, title
    ) VALUES (
      NEW.deal_id, NEW.user_id, NEW.name, 'joined', 'member', NEW.id,
      format('%s joined the team as %s', NEW.name, NEW.role)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'removed' THEN
      INSERT INTO deal_team_activity (
        deal_id, user_id, user_name, action, target_type, target_id, title
      ) VALUES (
        NEW.deal_id, NEW.user_id, NEW.name, 'removed', 'member', NEW.id,
        format('%s was removed from the team', NEW.name)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER team_member_activity_log
  AFTER INSERT OR UPDATE ON deal_team_members
  FOR EACH ROW
  EXECUTE FUNCTION log_team_member_activity();

-- Auto-log task completion
CREATE OR REPLACE FUNCTION log_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
    INSERT INTO deal_team_activity (
      deal_id, user_id, user_name, action, target_type, target_id, title
    ) VALUES (
      NEW.deal_id, NEW.assigned_to_id, NEW.assigned_to_name, 'completed_task', 'task', NEW.id,
      format('Task completed: %s', NEW.title)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_completion_activity_log
  AFTER UPDATE ON deal_team_tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_completion();

COMMENT ON TABLE deal_team_members IS 'Team members with roles and permissions for deals';
COMMENT ON TABLE deal_team_tasks IS 'Task management for deal team collaboration';
COMMENT ON TABLE deal_team_comments IS 'Discussion threads for tasks and modules';
COMMENT ON TABLE deal_team_notifications IS 'In-app notifications for team members';
COMMENT ON TABLE deal_team_activity IS 'Team-specific activity log (separate from deal activity)';
COMMENT ON TABLE team_role_templates IS 'Pre-defined role templates with permission sets';
