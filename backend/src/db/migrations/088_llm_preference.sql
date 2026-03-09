ALTER TABLE user_credit_balances
ADD COLUMN IF NOT EXISTS llm_preference VARCHAR(20) DEFAULT 'auto';
