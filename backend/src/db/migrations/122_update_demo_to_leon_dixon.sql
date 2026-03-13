UPDATE users
SET email = 'm.dixon5030@gmail.com',
    first_name = 'Leon',
    last_name = 'Dixon',
    full_name = 'Leon Dixon',
    password_hash = '$2a$10$KvrZqasQ3W9xVaAJnEV7ReGJIelJm4G.KeBoR6cm0hPTEI8DjAdza',
    updated_at = NOW()
WHERE email = 'demo@jedire.com';
