-- Migration 113: Fix log_team_member_activity() trigger
-- The trigger on deal_team_members was using wrong column names.
-- deal_team_activity schema uses: actor_name, action (not activity_type), details (jsonb).

CREATE OR REPLACE FUNCTION log_team_member_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO deal_team_activity (deal_id, actor_name, action, target_type, details)
    VALUES (
      NEW.deal_id,
      COALESCE(NEW.name, 'Unknown'),
      'member_added',
      'team_member',
      jsonb_build_object('email', NEW.email, 'role', NEW.role, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO deal_team_activity (deal_id, actor_name, action, target_type, details)
    VALUES (
      NEW.deal_id,
      COALESCE(NEW.name, 'Unknown'),
      'member_updated',
      'team_member',
      jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role, 'status', NEW.status)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO deal_team_activity (deal_id, actor_name, action, target_type, details)
    VALUES (
      OLD.deal_id,
      COALESCE(OLD.name, 'Unknown'),
      'member_removed',
      'team_member',
      jsonb_build_object('email', OLD.email, 'role', OLD.role)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_team_member_activity ON deal_team_members;
CREATE TRIGGER trg_log_team_member_activity
  AFTER INSERT OR UPDATE OR DELETE ON deal_team_members
  FOR EACH ROW EXECUTE FUNCTION log_team_member_activity();
