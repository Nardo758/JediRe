-- Migration 016: Collaboration Change Proposals
-- Date: 2026-02-02
-- Purpose: Change proposal system where collaborators propose changes and map owners approve/reject

-- ============================================================================
-- Map Change Proposals
-- ============================================================================

CREATE TABLE IF NOT EXISTS map_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  
  -- Proposal details
  proposed_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposal_title text, -- Optional: "Updated 3 properties in Downtown ATL"
  proposal_description text, -- Optional: Detailed explanation
  
  -- Changes (array of change objects)
  changes jsonb NOT NULL DEFAULT '[]',
  /* Change object structure:
  [{
    "type": "add_pin",
    "data": {
      "property_name": "The Metropolitan",
      "address": "...",
      "coordinates": {...},
      "pin_type": "property",
      ...
    }
  }, {
    "type": "update_pin",
    "pin_id": "uuid",
    "changes": {
      "pipeline_stage_id": "new-uuid",
      "asking_price": 15000000
    }
  }, {
    "type": "delete_pin",
    "pin_id": "uuid"
  }, {
    "type": "add_deal_intel",
    "pin_id": "uuid",
    "data": {...}
  }]
  */
  
  -- Review/approval
  reviewed_by uuid REFERENCES users(id), -- Map owner
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'cancelled'
  review_notes text, -- Owner's feedback/reason for rejection
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  reviewed_at timestamp,
  
  -- Statistics
  changes_count integer GENERATED ALWAYS AS (jsonb_array_length(changes)) STORED,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposals_map_id ON map_change_proposals(map_id);
CREATE INDEX IF NOT EXISTS idx_proposals_proposed_by ON map_change_proposals(proposed_by);
CREATE INDEX IF NOT EXISTS idx_proposals_reviewed_by ON map_change_proposals(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON map_change_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON map_change_proposals(created_at DESC);

-- GIN index for searching within changes JSONB
CREATE INDEX IF NOT EXISTS idx_proposals_changes ON map_change_proposals USING GIN(changes);

-- ============================================================================
-- Proposal Notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES map_change_proposals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification details
  notification_type text NOT NULL, -- 'new_proposal', 'proposal_accepted', 'proposal_rejected', 'proposal_cancelled'
  message text NOT NULL,
  
  -- Status
  is_read boolean DEFAULT false,
  read_at timestamp,
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  
  CONSTRAINT valid_notification_type CHECK (notification_type IN ('new_proposal', 'proposal_accepted', 'proposal_rejected', 'proposal_cancelled'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON proposal_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_proposal_id ON proposal_notifications(proposal_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON proposal_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON proposal_notifications(created_at DESC);

-- ============================================================================
-- Proposal Comments (Optional feedback/discussion)
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES map_change_proposals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Comment content
  comment_text text NOT NULL,
  
  -- Metadata
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_proposal_id ON proposal_comments(proposal_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON proposal_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON proposal_comments(created_at DESC);

-- ============================================================================
-- Functions
-- ============================================================================

-- Function: Create notification when proposal is created
CREATE OR REPLACE FUNCTION notify_map_owner_on_proposal()
RETURNS TRIGGER AS $$
DECLARE
  map_owner_id uuid;
  proposer_name text;
  map_name text;
BEGIN
  -- Get map owner
  SELECT owner_id INTO map_owner_id FROM maps WHERE id = NEW.map_id;
  
  -- Get proposer name
  SELECT full_name INTO proposer_name FROM users WHERE id = NEW.proposed_by;
  
  -- Get map name
  SELECT name INTO map_name FROM maps WHERE id = NEW.map_id;
  
  -- Don't notify if proposer is the owner
  IF map_owner_id != NEW.proposed_by THEN
    -- Create notification for map owner
    INSERT INTO proposal_notifications (
      proposal_id,
      user_id,
      notification_type,
      message
    ) VALUES (
      NEW.id,
      map_owner_id,
      'new_proposal',
      proposer_name || ' proposed ' || NEW.changes_count || ' change(s) to "' || map_name || '"'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_on_proposal
  AFTER INSERT ON map_change_proposals
  FOR EACH ROW
  EXECUTE FUNCTION notify_map_owner_on_proposal();

-- Function: Notify proposer when proposal is reviewed
CREATE OR REPLACE FUNCTION notify_proposer_on_review()
RETURNS TRIGGER AS $$
DECLARE
  reviewer_name text;
  map_name text;
BEGIN
  -- Only trigger if status changed to accepted or rejected
  IF NEW.status IN ('accepted', 'rejected') AND OLD.status = 'pending' THEN
    -- Get reviewer name
    SELECT full_name INTO reviewer_name FROM users WHERE id = NEW.reviewed_by;
    
    -- Get map name
    SELECT name INTO map_name FROM maps WHERE id = NEW.map_id;
    
    -- Create notification for proposer
    INSERT INTO proposal_notifications (
      proposal_id,
      user_id,
      notification_type,
      message
    ) VALUES (
      NEW.id,
      NEW.proposed_by,
      'proposal_' || NEW.status,
      reviewer_name || ' ' || NEW.status || ' your proposal for "' || map_name || '"'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_on_review
  AFTER UPDATE ON map_change_proposals
  FOR EACH ROW
  EXECUTE FUNCTION notify_proposer_on_review();

-- Function: Apply accepted proposal changes
CREATE OR REPLACE FUNCTION apply_proposal_changes(proposal_id_param uuid)
RETURNS jsonb AS $$
DECLARE
  proposal_record RECORD;
  change_obj jsonb;
  result jsonb := '{"applied": [], "failed": []}';
  new_pin_id uuid;
BEGIN
  -- Get proposal
  SELECT * INTO proposal_record FROM map_change_proposals WHERE id = proposal_id_param;
  
  IF proposal_record IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;
  
  IF proposal_record.status != 'accepted' THEN
    RAISE EXCEPTION 'Proposal must be accepted before applying changes';
  END IF;
  
  -- Loop through each change
  FOR change_obj IN SELECT * FROM jsonb_array_elements(proposal_record.changes)
  LOOP
    BEGIN
      CASE change_obj->>'type'
        
        -- Add new pin
        WHEN 'add_pin' THEN
          INSERT INTO map_pins (
            map_id,
            pin_type,
            property_name,
            address,
            coordinates,
            property_data
          ) VALUES (
            proposal_record.map_id,
            (change_obj->'data'->>'pin_type')::pin_type_enum,
            change_obj->'data'->>'property_name',
            change_obj->'data'->>'address',
            ST_SetSRID(ST_MakePoint(
              (change_obj->'data'->'coordinates'->>'lng')::float,
              (change_obj->'data'->'coordinates'->>'lat')::float
            ), 4326),
            change_obj->'data'
          ) RETURNING id INTO new_pin_id;
          
          result := jsonb_set(result, '{applied}', result->'applied' || jsonb_build_object('type', 'add_pin', 'pin_id', new_pin_id));
        
        -- Update existing pin
        WHEN 'update_pin' THEN
          UPDATE map_pins SET
            pipeline_stage_id = COALESCE((change_obj->'changes'->>'pipeline_stage_id')::uuid, pipeline_stage_id),
            property_data = property_data || (change_obj->'changes'),
            updated_at = now()
          WHERE id = (change_obj->>'pin_id')::uuid;
          
          result := jsonb_set(result, '{applied}', result->'applied' || change_obj);
        
        -- Delete pin
        WHEN 'delete_pin' THEN
          DELETE FROM map_pins WHERE id = (change_obj->>'pin_id')::uuid;
          result := jsonb_set(result, '{applied}', result->'applied' || change_obj);
        
        -- Add deal intel
        WHEN 'add_deal_intel' THEN
          INSERT INTO deal_intel (
            pin_id,
            intel_type,
            source,
            data
          ) VALUES (
            (change_obj->>'pin_id')::uuid,
            change_obj->'data'->>'intel_type',
            change_obj->'data'->>'source',
            change_obj->'data'
          );
          
          result := jsonb_set(result, '{applied}', result->'applied' || change_obj);
        
        ELSE
          result := jsonb_set(result, '{failed}', result->'failed' || jsonb_build_object('change', change_obj, 'reason', 'Unknown change type'));
      END CASE;
      
    EXCEPTION WHEN OTHERS THEN
      result := jsonb_set(result, '{failed}', result->'failed' || jsonb_build_object('change', change_obj, 'error', SQLERRM));
    END;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function: Update comment updated_at
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_updated_at
  BEFORE UPDATE ON proposal_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_updated_at();

-- ============================================================================
-- Views
-- ============================================================================

-- View: Pending proposals for map owners
CREATE OR REPLACE VIEW pending_proposals_for_owner AS
SELECT 
  p.id,
  p.map_id,
  m.name as map_name,
  p.proposed_by,
  u.full_name as proposer_name,
  u.email as proposer_email,
  p.proposal_title,
  p.proposal_description,
  p.changes_count,
  p.changes,
  p.created_at,
  m.owner_id
FROM map_change_proposals p
JOIN maps m ON p.map_id = m.id
JOIN users u ON p.proposed_by = u.id
WHERE p.status = 'pending'
ORDER BY p.created_at DESC;

-- View: My proposals (for collaborators to see their submitted proposals)
CREATE OR REPLACE VIEW my_proposals AS
SELECT 
  p.id,
  p.map_id,
  m.name as map_name,
  p.proposal_title,
  p.proposal_description,
  p.changes_count,
  p.status,
  p.review_notes,
  p.created_at,
  p.reviewed_at,
  r.full_name as reviewed_by_name
FROM map_change_proposals p
JOIN maps m ON p.map_id = m.id
LEFT JOIN users r ON p.reviewed_by = r.id
ORDER BY p.created_at DESC;

-- View: Unread notifications
CREATE OR REPLACE VIEW unread_notifications AS
SELECT 
  n.id,
  n.proposal_id,
  n.notification_type,
  n.message,
  n.created_at,
  p.map_id,
  m.name as map_name
FROM proposal_notifications n
JOIN map_change_proposals p ON n.proposal_id = p.id
JOIN maps m ON p.map_id = m.id
WHERE n.is_read = false
ORDER BY n.created_at DESC;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE map_change_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_comments ENABLE ROW LEVEL SECURITY;

-- Policies: Users can see proposals for maps they have access to
CREATE POLICY proposals_visibility ON map_change_proposals
  FOR SELECT
  USING (
    map_id IN (
      SELECT map_id FROM map_collaborators 
      WHERE user_id = current_setting('app.user_id')::uuid
    )
    OR proposed_by = current_setting('app.user_id')::uuid
    OR map_id IN (
      SELECT id FROM maps WHERE owner_id = current_setting('app.user_id')::uuid
    )
  );

-- Users can create proposals for maps they collaborate on
CREATE POLICY proposals_create ON map_change_proposals
  FOR INSERT
  WITH CHECK (
    map_id IN (
      SELECT map_id FROM map_collaborators 
      WHERE user_id = current_setting('app.user_id')::uuid
    )
    AND proposed_by = current_setting('app.user_id')::uuid
  );

-- Map owners can update proposals (accept/reject)
CREATE POLICY proposals_owner_update ON map_change_proposals
  FOR UPDATE
  USING (
    map_id IN (
      SELECT id FROM maps WHERE owner_id = current_setting('app.user_id')::uuid
    )
  );

-- Users can only see their own notifications
CREATE POLICY notifications_isolation ON proposal_notifications
  FOR ALL
  USING (user_id = current_setting('app.user_id')::uuid);

-- Users can see comments on proposals they have access to
CREATE POLICY comments_visibility ON proposal_comments
  FOR SELECT
  USING (
    proposal_id IN (
      SELECT id FROM map_change_proposals WHERE 
        map_id IN (
          SELECT map_id FROM map_collaborators 
          WHERE user_id = current_setting('app.user_id')::uuid
        )
        OR proposed_by = current_setting('app.user_id')::uuid
        OR map_id IN (
          SELECT id FROM maps WHERE owner_id = current_setting('app.user_id')::uuid
        )
    )
  );

-- Users can create comments on proposals they have access to
CREATE POLICY comments_create ON proposal_comments
  FOR INSERT
  WITH CHECK (
    proposal_id IN (
      SELECT id FROM map_change_proposals WHERE 
        map_id IN (
          SELECT map_id FROM map_collaborators 
          WHERE user_id = current_setting('app.user_id')::uuid
        )
        OR proposed_by = current_setting('app.user_id')::uuid
        OR map_id IN (
          SELECT id FROM maps WHERE owner_id = current_setting('app.user_id')::uuid
        )
    )
    AND user_id = current_setting('app.user_id')::uuid
  );

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

COMMENT ON TABLE map_change_proposals IS 'Change proposals from collaborators, reviewed by map owners';
COMMENT ON TABLE proposal_notifications IS 'Notifications about proposal status changes';
COMMENT ON TABLE proposal_comments IS 'Comments and discussion on proposals';
COMMENT ON FUNCTION apply_proposal_changes IS 'Apply all changes from an accepted proposal to the map';
