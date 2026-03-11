UPDATE deals SET acres = 4.81 
WHERE id = 'e044db04-439b-4442-82df-b36a840f2fd8' AND acres > 30;

UPDATE properties SET 
  city = 'Atlanta',
  state_code = 'GA',
  zip = '30324',
  lat = 33.7896,
  lng = -84.3658,
  lot_size_acres = 4.81,
  parcel_id = '14-0087-0001',
  zoning_code = 'MRC-2-C'
WHERE id = 'f5617d88-0aaa-4f3e-8407-25fe591ba40b' AND (city = 'Georgia 30324' OR lot_size_acres IS NULL);
