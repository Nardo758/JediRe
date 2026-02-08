-- Seed sample emails for testing (Fixed for UUID users)

-- First, get a valid user UUID (use the first user in the system)
DO $$
DECLARE
  test_user_id UUID;
  test_account_id INTEGER;
  deal_id_buckhead INTEGER;
BEGIN
  -- Get first user
  SELECT id INTO test_user_id FROM users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in database. Please create a user first.';
  END IF;

  -- Insert a test email account
  INSERT INTO email_accounts (user_id, email_address, provider, is_primary, sync_enabled)
  VALUES (test_user_id, 'user@jedire.com', 'gmail', TRUE, TRUE)
  ON CONFLICT DO NOTHING
  RETURNING id INTO test_account_id;
  
  -- Get the account ID if it already existed
  IF test_account_id IS NULL THEN
    SELECT id INTO test_account_id FROM email_accounts WHERE user_id = test_user_id LIMIT 1;
  END IF;

  -- Get Buckhead deal ID if it exists
  SELECT id INTO deal_id_buckhead FROM deals WHERE name ILIKE '%buckhead%' LIMIT 1;

  -- Insert sample emails
  INSERT INTO emails (
    email_account_id,
    user_id,
    external_id,
    subject,
    from_name,
    from_address,
    to_addresses,
    body_preview,
    body_text,
    is_read,
    is_flagged,
    has_attachments,
    deal_id,
    received_at
  ) VALUES
  (
    test_account_id,
    test_user_id,
    'email-001',
    'New Multifamily Property in Buckhead',
    'Sarah Johnson',
    'sarah@atlantarealty.com',
    ARRAY['user@jedire.com'],
    'Hi, I wanted to reach out about a great multifamily opportunity...',
    E'Hi,\n\nI wanted to reach out about a great multifamily opportunity in Buckhead. \n\n228-unit property at 3500 Peachtree Rd NE\nAsking: $68M\n92% occupancy\nYear built: 2015\nClass A property\n\nLet me know if you''d like to schedule a tour.\n\nBest,\nSarah',
    FALSE,
    TRUE,
    FALSE,
    deal_id_buckhead,
    NOW() - INTERVAL '2 hours'
  ),
  (
    test_account_id,
    test_user_id,
    'email-002',
    'RE: Phase I Environmental Report',
    'John Smith',
    'john@envirotech.com',
    ARRAY['user@jedire.com'],
    'Attached is the Phase I ESA for the Midtown site...',
    E'Hi,\n\nAttached is the Phase I Environmental Site Assessment for the Midtown site you requested.\n\nNo recognized environmental conditions identified.\nReport valid for 180 days.\n\nLet me know if you need any clarification.\n\nBest,\nJohn Smith\nEnviroTech Solutions',
    FALSE,
    FALSE,
    TRUE,
    deal_id_buckhead,
    NOW() - INTERVAL '4 hours'
  ),
  (
    test_account_id,
    test_user_id,
    'email-003',
    'Weekly Atlanta Market Update',
    'JEDI RE Insights',
    'insights@jedire.com',
    ARRAY['user@jedire.com'],
    'Your weekly market intelligence digest is ready...',
    E'Weekly Market Update - February 2026\n\nAtlanta Multifamily:\n- Average rent: $1,850 (+3.2% YoY)\n- Occupancy: 94.2%\n- New supply: 2,400 units in Q1\n\nTop submarkets:\n1. Midtown (96.1% occupancy)\n2. Buckhead (95.8% occupancy)\n3. Virginia Highland (95.2% occupancy)\n\nView full report in your dashboard.',
    TRUE,
    FALSE,
    FALSE,
    NULL,
    NOW() - INTERVAL '1 day'
  ),
  (
    test_account_id,
    test_user_id,
    'email-004',
    'Showing Scheduled: 789 Peachtree St',
    'Mike Davis',
    'mike@commercialpro.com',
    ARRAY['user@jedire.com'],
    'Confirmed for tomorrow at 2pm. See you there!',
    E'Hi,\n\nConfirmed for tomorrow (February 8th) at 2:00 PM.\n\nProperty: 789 Peachtree St NE\nMeet at main lobby entrance.\n\nProperty highlights:\n- 156 units\n- $42M asking\n- 88% occupied (value-add opportunity)\n- Built 2008, renovations needed\n\nBring your inspector if you''d like.\n\nSee you tomorrow!\nMike',
    FALSE,
    TRUE,
    FALSE,
    NULL,
    NOW() - INTERVAL '3 hours'
  ),
  (
    test_account_id,
    test_user_id,
    'email-005',
    'Deal Alert: 5 New Properties Match Your Criteria',
    'JEDI RE Alerts',
    'alerts@jedire.com',
    ARRAY['user@jedire.com'],
    '5 new properties in your target markets...',
    E'Deal Alert\n\n5 new properties match your acquisition criteria:\n\n1. Midtown Atlanta - 200 units, $58M\n2. Virginia Highland - 88 units, $24M\n3. Decatur - 124 units, $31M\n4. Sandy Springs - 180 units, $48M\n5. Roswell - 92 units, $22M\n\nView details in your dashboard or reply to this email for more info.',
    TRUE,
    FALSE,
    FALSE,
    NULL,
    NOW() - INTERVAL '2 days'
  ),
  (
    test_account_id,
    test_user_id,
    'email-006',
    'Loan Pre-Approval Update',
    'Emily Chen',
    'emily@capitalfunding.com',
    ARRAY['user@jedire.com'],
    'Your loan application has been approved. Terms attached...',
    E'Hi,\n\nGreat news! Your loan application has been approved.\n\nLoan Amount: $52M\nRate: 6.25%\nTerm: 10 years\nAmortization: 30 years\nLTV: 75%\n\nTerm sheet attached. Let me know if you have any questions.\n\nBest,\nEmily Chen\nCapital Funding Group',
    FALSE,
    TRUE,
    TRUE,
    deal_id_buckhead,
    NOW() - INTERVAL '5 hours'
  ),
  (
    test_account_id,
    test_user_id,
    'email-007',
    'Contract Review Complete',
    'David Wilson',
    'david@realestatelaw.com',
    ARRAY['user@jedire.com'],
    'I''ve reviewed the PSA. Here are my notes...',
    E'Hi,\n\nI''ve completed my review of the Purchase and Sale Agreement.\n\nOverall the contract is fair, with a few suggested modifications:\n\n1. Due diligence period - recommend extending to 45 days\n2. Financing contingency - add language for backup financing\n3. Seller representations - expand environmental warranties\n\nMarked-up version attached. Call me if you want to discuss.\n\nDavid Wilson, Esq.',
    TRUE,
    FALSE,
    TRUE,
    deal_id_buckhead,
    NOW() - INTERVAL '6 hours'
  )
  ON CONFLICT (external_id) DO NOTHING;

  -- Insert some attachments for emails that have them
  INSERT INTO email_attachments (email_id, filename, content_type, size_bytes, download_url)
  SELECT 
    e.id,
    'Phase_I_ESA_Midtown_Site.pdf',
    'application/pdf',
    2458624,
    '/attachments/phase-i-esa-midtown.pdf'
  FROM emails e
  WHERE e.external_id = 'email-002'
  ON CONFLICT DO NOTHING;

  INSERT INTO email_attachments (email_id, filename, content_type, size_bytes, download_url)
  SELECT 
    e.id,
    'Loan_Term_Sheet_52M.pdf',
    'application/pdf',
    156789,
    '/attachments/term-sheet-52m.pdf'
  FROM emails e
  WHERE e.external_id = 'email-006'
  ON CONFLICT DO NOTHING;

  INSERT INTO email_attachments (email_id, filename, content_type, size_bytes, download_url)
  SELECT 
    e.id,
    'PSA_Marked_Up_v2.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    89456,
    '/attachments/psa-marked-up.docx'
  FROM emails e
  WHERE e.external_id = 'email-007'
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Email seed data inserted successfully for user %', test_user_id;
END $$;
