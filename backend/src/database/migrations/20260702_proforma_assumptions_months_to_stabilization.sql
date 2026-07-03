-- W-B Phase 2: months_to_stabilization traffic-engine output column.
-- Written by TrafficToProFormaService.persistPlatformLayer when a lease-up
-- timeline exists (null for already-stabilized properties). Read by the
-- proforma seeder's stabilization resolution chain (traffic_engine layer).
ALTER TABLE proforma_assumptions
  ADD COLUMN IF NOT EXISTS months_to_stabilization INTEGER;
