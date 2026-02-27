ALTER TABLE municipalities ADD COLUMN IF NOT EXISTS planning_url TEXT;

UPDATE municipalities SET planning_url = 'https://www.atlantaga.gov/government/departments/city-planning' WHERE id = 'atlanta-ga';
UPDATE municipalities SET planning_url = 'https://www.birminghamal.gov/planning' WHERE id = 'birmingham-al';
UPDATE municipalities SET planning_url = 'https://www.nashville.gov/departments/planning' WHERE id = 'nashville-tn';
UPDATE municipalities SET planning_url = 'https://www.charlottenc.gov/Growth-and-Development/Planning' WHERE id = 'charlotte-nc';
UPDATE municipalities SET planning_url = 'https://www.raleighnc.gov/planning' WHERE id = 'raleigh-nc';
UPDATE municipalities SET planning_url = 'https://www.austintexas.gov/department/planning' WHERE id = 'austin-tx';
UPDATE municipalities SET planning_url = 'https://www.dallascityhall.com/departments/sustainabledevelopment/planning' WHERE id = 'dallas-tx';
UPDATE municipalities SET planning_url = 'https://www.houstontx.gov/planning/' WHERE id = 'houston-tx';
UPDATE municipalities SET planning_url = 'https://www.sanantonio.gov/Planning' WHERE id = 'san-antonio-tx';
UPDATE municipalities SET planning_url = 'https://www.jacksonvillefl.gov/departments/planning-and-development' WHERE id = 'jacksonville-fl';
UPDATE municipalities SET planning_url = 'https://www.tampa.gov/planning' WHERE id = 'tampa-fl';
UPDATE municipalities SET planning_url = 'https://www.orlando.gov/Our-Government/Departments-Offices/Executive-Offices/Planning' WHERE id = 'orlando-fl';
UPDATE municipalities SET planning_url = 'https://www.miamigov.com/Government/Departments-Organizations/Planning' WHERE id = 'miami-fl';
