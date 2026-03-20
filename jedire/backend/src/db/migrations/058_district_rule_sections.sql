ALTER TABLE zoning_districts
  ADD COLUMN IF NOT EXISTS dimensional_section VARCHAR(100),
  ADD COLUMN IF NOT EXISTS parking_section VARCHAR(100),
  ADD COLUMN IF NOT EXISTS density_section VARCHAR(100),
  ADD COLUMN IF NOT EXISTS height_section VARCHAR(100),
  ADD COLUMN IF NOT EXISTS setback_section VARCHAR(100),
  ADD COLUMN IF NOT EXISTS far_section VARCHAR(100);

UPDATE zoning_districts SET
  dimensional_section = CASE
    WHEN code_section = '16-06' THEN '16-06.007'
    WHEN code_section = '16-08' THEN '16-08.006'
    WHEN code_section = '16-18A' THEN '16-18A.007'
    ELSE code_section
  END,
  parking_section = CASE
    WHEN code_section = '16-06' THEN '16-06.008'
    WHEN code_section = '16-18A' THEN '16-18A.008'
    ELSE '16-28G.005'
  END,
  setback_section = CASE
    WHEN code_section = '16-06' THEN '16-06.007'
    WHEN code_section = '16-08' THEN '16-08.006'
    WHEN code_section = '16-18A' THEN '16-18A.007'
    ELSE code_section
  END,
  height_section = CASE
    WHEN code_section = '16-06' THEN '16-06.007'
    WHEN code_section = '16-08' THEN '16-08.006'
    WHEN code_section = '16-18A' THEN '16-18A.007'
    ELSE code_section
  END,
  density_section = CASE
    WHEN code_section = '16-06' THEN '16-06.007'
    WHEN code_section = '16-08' THEN '16-08.006'
    WHEN code_section = '16-18A' THEN '16-18A.007'
    ELSE code_section
  END,
  far_section = CASE
    WHEN code_section = '16-06' THEN '16-06.007'
    WHEN code_section = '16-08' THEN '16-08.006'
    WHEN code_section = '16-18A' THEN '16-18A.007'
    ELSE code_section
  END
WHERE municipality_id = 'atlanta-ga' AND code_section IS NOT NULL;
