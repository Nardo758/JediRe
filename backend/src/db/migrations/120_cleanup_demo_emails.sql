-- Migration 120: Remove known demo seed emails
-- Only deletes emails that were created by the demo seed script (migration 106)
-- Identified by having email_account_id from the demo seed account AND
-- no external_id (demo seeds don't set external_id)

DELETE FROM emails
WHERE external_id IS NULL
  AND from_address IN (
    'sarah.chen@blackstone.com',
    'michael.torres@cbre.com',
    'jennifer.walsh@eastdilsecured.com',
    'david.park@cushwake.com',
    'notifications@jedire.com',
    'alerts@jedire.com',
    'system@jedire.com'
  );
