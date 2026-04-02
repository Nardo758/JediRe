-- Fix Jaguar Redevelopment deal: project_type was incorrectly set to 'existing'
-- This is a development deal and needs project_type='development' so that
-- the 3D Design module (M03) and Development Capacity are visible.
UPDATE deals
SET project_type = 'development',
    updated_at = NOW()
WHERE id = '8aa4c42a-9f1f-47ba-b9d4-9def37b0b323'
  AND project_type = 'existing';
