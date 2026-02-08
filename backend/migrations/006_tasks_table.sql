-- Migration: Add Tasks Table
-- Created: 2026-02-07
-- Purpose: Global Tasks Module for JEDI RE

-- Create task_category enum
CREATE TYPE task_category AS ENUM (
  'due_diligence',
  'financing',
  'legal',
  'construction',
  'leasing',
  'property_management',
  'reporting',
  'communication',
  'analysis',
  'other'
);

-- Create task_priority enum
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create task_status enum
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done', 'cancelled');

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  
  -- Task details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category task_category NOT NULL,
  priority task_priority DEFAULT 'medium',
  status task_status DEFAULT 'todo',
  
  -- Relationships
  deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  property_id INTEGER, -- Reference to properties if needed
  email_id VARCHAR(100), -- Reference to email that created task
  
  -- Assignment
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Dates
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  source VARCHAR(50) DEFAULT 'manual', -- manual, email_ai, calendar, other
  blocked_reason TEXT, -- Why task is blocked
  tags TEXT[], -- Flexible tagging
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_tasks_category ON tasks(category);

-- Create updated_at trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create activity logging trigger
CREATE OR REPLACE FUNCTION log_task_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Log task creation
  IF TG_OP = 'INSERT' THEN
    INSERT INTO deal_activity (
      deal_id,
      user_id,
      activity_type,
      description,
      metadata
    ) VALUES (
      NEW.deal_id,
      NEW.created_by,
      'task_created',
      'Created task: ' || NEW.title,
      jsonb_build_object(
        'task_id', NEW.id,
        'category', NEW.category,
        'priority', NEW.priority,
        'due_date', NEW.due_date
      )
    );
  END IF;
  
  -- Log task status change
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO deal_activity (
      deal_id,
      user_id,
      activity_type,
      description,
      metadata
    ) VALUES (
      NEW.deal_id,
      NEW.assigned_to,
      'task_updated',
      'Task "' || NEW.title || '" moved to ' || NEW.status,
      jsonb_build_object(
        'task_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  
  -- Log task completion
  IF TG_OP = 'UPDATE' AND NEW.status = 'done' AND OLD.status != 'done' THEN
    UPDATE tasks SET completed_at = NOW() WHERE id = NEW.id;
    
    INSERT INTO deal_activity (
      deal_id,
      user_id,
      activity_type,
      description,
      metadata
    ) VALUES (
      NEW.deal_id,
      NEW.assigned_to,
      'task_completed',
      'Completed task: ' || NEW.title,
      jsonb_build_object(
        'task_id', NEW.id,
        'completed_at', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_activity_trigger
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_activity();

-- Seed some example data for testing
INSERT INTO tasks (
  title,
  description,
  category,
  priority,
  status,
  deal_id,
  assigned_to,
  created_by,
  due_date,
  source
) VALUES
  (
    'Review Phase I Environmental Report',
    'Review the Phase I Environmental Site Assessment for potential contamination issues',
    'due_diligence',
    'high',
    'todo',
    1,
    1,
    1,
    NOW() + INTERVAL '3 days',
    'manual'
  ),
  (
    'Submit Rent Roll to Lender',
    'Prepare and submit current rent roll to lender for financing review',
    'financing',
    'medium',
    'in_progress',
    1,
    1,
    1,
    NOW() + INTERVAL '5 days',
    'email_ai'
  ),
  (
    'Schedule Property Tour',
    'Coordinate with broker to schedule property walkthrough',
    'due_diligence',
    'medium',
    'todo',
    1,
    1,
    1,
    NOW() + INTERVAL '7 days',
    'manual'
  );

COMMENT ON TABLE tasks IS 'Global tasks module - tracks all action items across deals and properties';
COMMENT ON COLUMN tasks.source IS 'How task was created: manual, email_ai, calendar, other';
COMMENT ON COLUMN tasks.blocked_reason IS 'If status=blocked, reason why task cannot proceed';
COMMENT ON COLUMN tasks.email_id IS 'Reference to email that triggered task creation';
