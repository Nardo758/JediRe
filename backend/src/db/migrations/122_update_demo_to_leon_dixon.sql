UPDATE users
SET email = 'm.dixon5030@gmail.com',
    first_name = 'Leon',
    last_name = 'Dixon',
    full_name = 'Leon Dixon',
    password_hash = '$2a$10$JrqwPK7UWDVKHdFTtM912elS10.ePQdypJNs6OnKifqZlbX3qZ4EW',
    updated_at = NOW()
WHERE id = '6253ba3f-d40d-4597-86ab-270c8397a857'
  AND email = 'demo@jedire.com';
