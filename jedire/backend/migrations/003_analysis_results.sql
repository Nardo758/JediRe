-- Create analysis_results table for storing JEDI Score analysis

CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
  jedi_score INTEGER NOT NULL CHECK (jedi_score >= 0 AND jedi_score <= 100),
  verdict VARCHAR(50) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  analysis_data JSONB NOT NULL,
  analyzed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analysis_results_deal_id ON analysis_results(deal_id);
CREATE INDEX idx_analysis_results_jedi_score ON analysis_results(jedi_score);
CREATE INDEX idx_analysis_results_analyzed_at ON analysis_results(analyzed_at DESC);

-- Update trigger
DROP TRIGGER IF EXISTS update_analysis_results_updated_at ON analysis_results;
CREATE TRIGGER update_analysis_results_updated_at BEFORE UPDATE ON analysis_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
