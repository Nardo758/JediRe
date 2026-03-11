-- Migration: Building 3D Design Storage
-- Purpose: Persist user-created 3D building designs for each development scenario
-- Dependencies: development_scenarios table (must exist)

-- Create building_designs_3d table
CREATE TABLE IF NOT EXISTS building_designs_3d (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES development_scenarios(id) ON DELETE SET NULL,
  
  -- Building sections (array of 3D masses)
  building_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example structure:
  -- [
  --   {
  --     "id": "parking-podium",
  --     "name": "Parking Structure",
  --     "geometry": {
  --       "footprint": {"points": [{"x": 0, "z": 0}, {"x": 100, "z": 0}, ...]},
  --       "height": 40,
  --       "floors": 2
  --     },
  --     "position": {"x": 0, "z": 0},
  --     "units": 0,
  --     "visible": true
  --   },
  --   {
  --     "id": "residential-tower",
  --     "name": "Residential Tower",
  --     "geometry": {...},
  --     "position": {"x": 0, "z": 40},
  --     "units": 300,
  --     "visible": true
  --   }
  -- ]
  
  -- Calculated metrics (auto-computed from building_sections)
  total_units INTEGER DEFAULT 0,
  total_gfa DECIMAL(12, 2) DEFAULT 0,
  total_parking_spaces INTEGER DEFAULT 0,
  building_height_ft DECIMAL(8, 2) DEFAULT 0,
  stories INTEGER DEFAULT 0,
  lot_coverage_percent DECIMAL(5, 2) DEFAULT 0,
  far DECIMAL(5, 2) DEFAULT 0,
  efficiency_percent DECIMAL(5, 2) DEFAULT 85,
  
  -- Viewport camera state (preserve user's view)
  camera_state JSONB,
  -- {"position": {"x": 0, "y": 100, "z": 200}, "target": {"x": 0, "y": 0, "z": 0}}
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  
  -- Ensure one design per deal/scenario combo
  UNIQUE(deal_id, scenario_id)
);

-- Index for fast lookups by deal
CREATE INDEX idx_building_designs_3d_deal ON building_designs_3d(deal_id);

-- Index for scenario-based queries
CREATE INDEX idx_building_designs_3d_scenario ON building_designs_3d(scenario_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_building_designs_3d_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER building_designs_3d_updated_at
  BEFORE UPDATE ON building_designs_3d
  FOR EACH ROW
  EXECUTE FUNCTION update_building_designs_3d_timestamp();

-- Comments for documentation
COMMENT ON TABLE building_designs_3d IS 'Stores 3D building massing designs created in the Building3DEditor';
COMMENT ON COLUMN building_designs_3d.building_sections IS 'Array of 3D building masses with geometry, position, and metadata';
COMMENT ON COLUMN building_designs_3d.total_gfa IS 'Total Gross Floor Area in square feet';
COMMENT ON COLUMN building_designs_3d.far IS 'Floor Area Ratio (GFA / parcel area)';
COMMENT ON COLUMN building_designs_3d.efficiency_percent IS 'Building efficiency: (Net Rentable Area / GFA) * 100';
