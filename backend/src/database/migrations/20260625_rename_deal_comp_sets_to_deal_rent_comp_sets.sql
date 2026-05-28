-- Rename deal_comp_sets to deal_rent_comp_sets to remove ambiguity.
-- This table stores rent comp curation data for a deal's workspace UI.
-- See: docs/architecture/comp-profiles-spec.md §5.1
ALTER TABLE deal_comp_sets RENAME TO deal_rent_comp_sets;
