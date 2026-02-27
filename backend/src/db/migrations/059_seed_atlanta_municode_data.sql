UPDATE municipalities
SET municode_url = 'https://library.municode.com/ga/atlanta/codes/code_of_ordinances',
    zoning_chapter_path = '?nodeId=PTIIICOOR_PT16LADECO'
WHERE id = 'atlanta-ga' AND (municode_url IS NULL OR municode_url = '');

UPDATE zoning_districts SET code_section = '16-06', municode_node_id = 'PTIIICOOR_PT16LADECO_CH6R-4TWREDIRE'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('R-4', 'R-4A', 'R-4B', 'R-4-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-07', municode_node_id = 'PTIIICOOR_PT16LADECO_CH7R-5TWREDIRE'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('R-5', 'R-5-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-08', municode_node_id = 'PTIIICOOR_PT16LADECO_CH8RGREGEDIRE'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('RG', 'RG-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-08A', municode_node_id = 'PTIIICOOR_PT16LADECO_CH8ARG-2REGEDIRE'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('RG-2', 'RG-2-C', 'RG-3', 'RG-3-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-12', municode_node_id = 'PTIIICOOR_PT16LADECO_CH12MR-1MULREDILODE'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('MR-1', 'MR-1-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-12A', municode_node_id = 'PTIIICOOR_PT16LADECO_CH12AMR-2MULREDILOMEDE'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('MR-2', 'MR-2-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-18A', municode_node_id = 'PTIIICOOR_PT16LADECO_CH18AMR-4AMULREDIHIDEDEA'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('MR-3', 'MR-3-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-18A', municode_node_id = 'PTIIICOOR_PT16LADECO_CH18AMR-4AMULREDIHIDEDEA'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('MR-4A', 'MR-4A-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-18B', municode_node_id = 'PTIIICOOR_PT16LADECO_CH18BMR-4BMULREDIHIDEDEB'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('MR-4B', 'MR-4B-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-19', municode_node_id = 'PTIIICOOR_PT16LADECO_CH19MRC-1MIRECOINLOIN'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('MRC-1', 'MRC-1-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-19A', municode_node_id = 'PTIIICOOR_PT16LADECO_CH19AMRC-2MIRECOMEININ'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('MRC-2', 'MRC-2-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-20', municode_node_id = 'PTIIICOOR_PT16LADECO_CH20MRC-3MIRECOHIININ'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('MRC-3', 'MRC-3-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-21', municode_node_id = 'PTIIICOOR_PT16LADECO_CH21C-1COBUDI'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('C-1', 'C-1-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-22', municode_node_id = 'PTIIICOOR_PT16LADECO_CH22C-2CODI'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('C-2', 'C-2-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-23', municode_node_id = 'PTIIICOOR_PT16LADECO_CH23C-3COREDI'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('C-3', 'C-3-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-24', municode_node_id = 'PTIIICOOR_PT16LADECO_CH24NC'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) LIKE 'NC-%'
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-28', municode_node_id = 'PTIIICOOR_PT16LADECO_CH28I-1LIINDI'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('I-1', 'I-1-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-28A', municode_node_id = 'PTIIICOOR_PT16LADECO_CH28AI-2HEINDI'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('I-2', 'I-2-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-28B', municode_node_id = 'PTIIICOOR_PT16LADECO_CH28BLWLIWODI'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) IN ('LW', 'LW-C')
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-18I.001', municode_node_id = 'PTIIICOOR_PT16LADECO_CH18ISPI_S16-18I.001SPI-1MISPINDIDINORE'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) = 'SPI-1'
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-18I.016', municode_node_id = 'PTIIICOOR_PT16LADECO_CH18ISPI_S16-18I.016SPI-16MIEXSPINDIDINORE'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) = 'SPI-16'
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-18I.021', municode_node_id = 'PTIIICOOR_PT16LADECO_CH18ISPI_S16-18I.021SPI-21BEOVDI'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) = 'SPI-21'
  AND (code_section IS NULL OR code_section = '');

UPDATE zoning_districts SET code_section = '16-03', municode_node_id = 'PTIIICOOR_PT16LADECO_CH3ZODIEN'
WHERE municipality_id = 'atlanta-ga' AND UPPER(COALESCE(zoning_code, district_code)) LIKE 'PD-%'
  AND (code_section IS NULL OR code_section = '');
