-- 056_municode_section_map.sql
-- Section-level deep-linking to library.municode.com
-- Maps municipal code section numbers to Municode nodeIds for precise URL generation

CREATE TABLE IF NOT EXISTS municode_section_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id VARCHAR NOT NULL REFERENCES municipalities(id),
  section_number VARCHAR NOT NULL,
  node_id VARCHAR NOT NULL,
  title VARCHAR,
  parent_node_id VARCHAR,
  code_type VARCHAR DEFAULT 'zoning' CHECK (code_type IN ('zoning', 'subdivision', 'building', 'environmental', 'general')),
  last_verified TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_municode_section_muni_section
  ON municode_section_map(municipality_id, section_number);
CREATE INDEX IF NOT EXISTS idx_municode_section_node
  ON municode_section_map(node_id);
CREATE INDEX IF NOT EXISTS idx_municode_section_type
  ON municode_section_map(municipality_id, code_type);

ALTER TABLE zoning_districts ADD COLUMN IF NOT EXISTS municode_node_id VARCHAR;

-- ============================================================================
-- Seed: Atlanta, GA — Major zoning district code sections
-- Atlanta's zoning code is Part 16 of the City Code of Ordinances
-- Chapter 16-18A: Multi-family residential districts
-- Chapter 16-18B: Commercial districts
-- Chapter 16-18C: Mixed-use districts
-- Chapter 16-18I: SPI districts
-- ============================================================================

INSERT INTO municode_section_map (municipality_id, section_number, node_id, title, parent_node_id, code_type) VALUES
-- Part 16: Land Development Code root
('atlanta-ga', '16', 'PTIIICOOR_PT16LADECO', 'Part 16 - Land Development Code', NULL, 'zoning'),

-- Chapter 16-02: Definitions
('atlanta-ga', '16-02', 'PTIIICOOR_PT16LADECO_CH2DE', 'Chapter 2 - Definitions', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-03: Zoning Districts Established
('atlanta-ga', '16-03', 'PTIIICOOR_PT16LADECO_CH3ZODIEN', 'Chapter 3 - Zoning Districts Established', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-06: R-4 Two-Family Residential
('atlanta-ga', '16-06', 'PTIIICOOR_PT16LADECO_CH6R-4TWREDIRE', 'Chapter 6 - R-4 Two-Family Residential District', 'PTIIICOOR_PT16LADECO', 'zoning'),
('atlanta-ga', '16-06.007', 'PTIIICOOR_PT16LADECO_CH6R-4TWREDIRE_S16-06.007MIREDEAM', 'Sec. 16-06.007 - Minimum Development Standards', 'PTIIICOOR_PT16LADECO_CH6R-4TWREDIRE', 'zoning'),
('atlanta-ga', '16-06.008', 'PTIIICOOR_PT16LADECO_CH6R-4TWREDIRE_S16-06.008MIOFPARE', 'Sec. 16-06.008 - Off-Street Parking', 'PTIIICOOR_PT16LADECO_CH6R-4TWREDIRE', 'zoning'),

-- Chapter 16-07: R-5 Two-Family Residential
('atlanta-ga', '16-07', 'PTIIICOOR_PT16LADECO_CH7R-5TWREDIRE', 'Chapter 7 - R-5 Two-Family Residential District', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-08: RG (Residential General)
('atlanta-ga', '16-08', 'PTIIICOOR_PT16LADECO_CH8RGREGEDIRE', 'Chapter 8 - RG Residential General District', 'PTIIICOOR_PT16LADECO', 'zoning'),
('atlanta-ga', '16-08.006', 'PTIIICOOR_PT16LADECO_CH8RGREGEDIRE_S16-08.006MIREDEAM', 'Sec. 16-08.006 - Minimum Development Standards', 'PTIIICOOR_PT16LADECO_CH8RGREGEDIRE', 'zoning'),

-- Chapter 16-08A: RG-2 Residential General
('atlanta-ga', '16-08A', 'PTIIICOOR_PT16LADECO_CH8ARG-2REGEDIRE', 'Chapter 8A - RG-2 Residential General District', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-12: MR-1 Multi-Family Residential
('atlanta-ga', '16-12', 'PTIIICOOR_PT16LADECO_CH12MR-1MULREDILODE', 'Chapter 12 - MR-1 Multi-Family Residential (Low Density)', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-12A: MR-2 Multi-Family Residential
('atlanta-ga', '16-12A', 'PTIIICOOR_PT16LADECO_CH12AMR-2MULREDILOMEDE', 'Chapter 12A - MR-2 Multi-Family Residential (Low-Medium Density)', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-18A: MR-4A Multi-Family High Density
('atlanta-ga', '16-18A', 'PTIIICOOR_PT16LADECO_CH18AMR-4AMULREDIHIDEDEA', 'Chapter 18A - MR-4A Multi-Family Residential (High Density A)', 'PTIIICOOR_PT16LADECO', 'zoning'),
('atlanta-ga', '16-18A.007', 'PTIIICOOR_PT16LADECO_CH18AMR-4AMULREDIHIDEDEA_S16-18A.007MIDEAM', 'Sec. 16-18A.007 - Minimum Development Standards', 'PTIIICOOR_PT16LADECO_CH18AMR-4AMULREDIHIDEDEA', 'zoning'),
('atlanta-ga', '16-18A.008', 'PTIIICOOR_PT16LADECO_CH18AMR-4AMULREDIHIDEDEA_S16-18A.008MIOFPARE', 'Sec. 16-18A.008 - Off-Street Parking', 'PTIIICOOR_PT16LADECO_CH18AMR-4AMULREDIHIDEDEA', 'zoning'),
('atlanta-ga', '16-18A.009', 'PTIIICOOR_PT16LADECO_CH18AMR-4AMULREDIHIDEDEA_S16-18A.009MIOP', 'Sec. 16-18A.009 - Minimum Open Space', 'PTIIICOOR_PT16LADECO_CH18AMR-4AMULREDIHIDEDEA', 'zoning'),

-- Chapter 16-18B: MR-4B Multi-Family High Density
('atlanta-ga', '16-18B', 'PTIIICOOR_PT16LADECO_CH18BMR-4BMULREDIHIDEDEB', 'Chapter 18B - MR-4B Multi-Family Residential (High Density B)', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-19: MRC-1 Mixed Residential Commercial
('atlanta-ga', '16-19', 'PTIIICOOR_PT16LADECO_CH19MRC-1MIRECOINLOIN', 'Chapter 19 - MRC-1 Mixed Residential Commercial (Low Intensity)', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-19A: MRC-2 Mixed Residential Commercial
('atlanta-ga', '16-19A', 'PTIIICOOR_PT16LADECO_CH19AMRC-2MIRECOMEININ', 'Chapter 19A - MRC-2 Mixed Residential Commercial (Medium Intensity)', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-20: MRC-3 Mixed Residential Commercial High Intensity
('atlanta-ga', '16-20', 'PTIIICOOR_PT16LADECO_CH20MRC-3MIRECOHIININ', 'Chapter 20 - MRC-3 Mixed Residential Commercial (High Intensity)', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-21: C-1 Community Business
('atlanta-ga', '16-21', 'PTIIICOOR_PT16LADECO_CH21C-1COBUDI', 'Chapter 21 - C-1 Community Business District', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-22: C-2 Commercial
('atlanta-ga', '16-22', 'PTIIICOOR_PT16LADECO_CH22C-2CODI', 'Chapter 22 - C-2 Commercial District', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-23: C-3 Commercial Residential
('atlanta-ga', '16-23', 'PTIIICOOR_PT16LADECO_CH23C-3COREDI', 'Chapter 23 - C-3 Commercial Residential District', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-28: I-1 Light Industrial
('atlanta-ga', '16-28', 'PTIIICOOR_PT16LADECO_CH28I-1LIINDI', 'Chapter 28 - I-1 Light Industrial District', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-28A: I-2 Heavy Industrial
('atlanta-ga', '16-28A', 'PTIIICOOR_PT16LADECO_CH28AI-2HEINDI', 'Chapter 28A - I-2 Heavy Industrial District', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-28B: LW Live-Work
('atlanta-ga', '16-28B', 'PTIIICOOR_PT16LADECO_CH28BLWLIWODI', 'Chapter 28B - LW Live-Work District', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- SPI Districts
('atlanta-ga', '16-18I', 'PTIIICOOR_PT16LADECO_CH18ISPI', 'Chapter 18I - Special Public Interest Districts', 'PTIIICOOR_PT16LADECO', 'zoning'),
('atlanta-ga', '16-18I.001', 'PTIIICOOR_PT16LADECO_CH18ISPI_S16-18I.001SPI-1MISPINDIDINORE', 'Sec. 16-18I.001 - SPI-1 Midtown District', 'PTIIICOOR_PT16LADECO_CH18ISPI', 'zoning'),
('atlanta-ga', '16-18I.016', 'PTIIICOOR_PT16LADECO_CH18ISPI_S16-18I.016SPI-16MIEXSPINDIDINORE', 'Sec. 16-18I.016 - SPI-16 Midtown Extended District', 'PTIIICOOR_PT16LADECO_CH18ISPI', 'zoning'),
('atlanta-ga', '16-18I.021', 'PTIIICOOR_PT16LADECO_CH18ISPI_S16-18I.021SPI-21BEOVDI', 'Sec. 16-18I.021 - SPI-21 BeltLine Overlay District', 'PTIIICOOR_PT16LADECO_CH18ISPI', 'zoning'),

-- Neighborhood Commercial Districts
('atlanta-ga', '16-24', 'PTIIICOOR_PT16LADECO_CH24NC', 'Chapter 24 - Neighborhood Commercial Districts', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-28G: General development standards
('atlanta-ga', '16-28G', 'PTIIICOOR_PT16LADECO_CH28GGEDEST', 'Chapter 28G - General Development Standards', 'PTIIICOOR_PT16LADECO', 'zoning'),
('atlanta-ga', '16-28G.005', 'PTIIICOOR_PT16LADECO_CH28GGEDEST_S16-28G.005OFPARE', 'Sec. 16-28G.005 - Off-Street Parking Requirements', 'PTIIICOOR_PT16LADECO_CH28GGEDEST', 'zoning'),
('atlanta-ga', '16-28G.007', 'PTIIICOOR_PT16LADECO_CH28GGEDEST_S16-28G.007BURE', 'Sec. 16-28G.007 - Buffer Requirements', 'PTIIICOOR_PT16LADECO_CH28GGEDEST', 'zoning'),

-- Chapter 16-29: Variances and Special Exceptions
('atlanta-ga', '16-29', 'PTIIICOOR_PT16LADECO_CH29VASPEX', 'Chapter 29 - Variances and Special Exceptions', 'PTIIICOOR_PT16LADECO', 'zoning'),

-- Chapter 16-30: Amendments and Rezonings
('atlanta-ga', '16-30', 'PTIIICOOR_PT16LADECO_CH30AMRE', 'Chapter 30 - Amendments and Rezonings', 'PTIIICOOR_PT16LADECO', 'zoning')

ON CONFLICT (municipality_id, section_number) DO UPDATE SET
  node_id = EXCLUDED.node_id,
  title = EXCLUDED.title,
  parent_node_id = EXCLUDED.parent_node_id,
  last_verified = NOW();

-- Update zoning_districts with municode_node_id for Atlanta districts
UPDATE zoning_districts SET municode_node_id = msm.node_id
FROM municode_section_map msm
WHERE zoning_districts.municipality_id = 'atlanta-ga'
  AND msm.municipality_id = 'atlanta-ga'
  AND msm.section_number = zoning_districts.code_section;
