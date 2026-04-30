/**
 * DesignTargets — The data contract between F3 Market (Programming tab) and F7 3D Design.
 *
 * Zoning (F2) sets the BUILDING ENVELOPE (max units, max GFA, max height, parking).
 * Programming (F3) sets the APPROVED PROGRAM (unit mix %, amenities, budget).
 * F7 consumes both to show target/progress bars in the DesignTargetsPanel sidebar.
 */

// ─── Unit Mix ───────────────────────────────────────────────────────────────

export interface UnitMixTarget {
  /** Percentage of total units, e.g. 35 means 35% */
  studio: number;
  oneBed: number;
  twoBed: number;
  threeBed: number;
}

// ─── Amenity List ───────────────────────────────────────────────────────────

export type AmenityCategory =
  | 'fitness'
  | 'pool'
  | 'coworking'
  | 'lounge'
  | 'pet'
  | 'concierge'
  | 'parking'
  | 'storage'
  | 'theatre'
  | 'outdoor'
  | 'security'
  | 'other';

export interface ApprovedAmenity {
  id: string;
  name: string;
  category: AmenityCategory;
  /** Estimated cost impact (total, $) */
  estimatedCost?: number;
  /** Square footage allocated */
  allocatedSf?: number;
}

// ─── Program Targets — the full payload ─────────────────────────────────────

export interface ProgramTargets {
  /** Target total unit count (from deal program, not zoning max) */
  targetUnits: number;
  /** Target GFA in sqft */
  targetGFA: number;
  /** Target FAR (GFA / lot area) */
  targetFAR: number;
  /** Target floor count (residential) */
  targetFloors: number;
  /** Parking spaces per unit ratio */
  targetParkingRatio: number;
  /** Target building height in feet */
  targetHeight: number;
  /** Unit mix % breakdown */
  unitMix?: UnitMixTarget;
  /** Approved amenities */
  approvedAmenities: ApprovedAmenity[];
  /** Construction budget (optional — from F3 or strategy) */
  budget?: {
    total: number;
    costPerSqft: number;
  };
}

// ─── Revenue target (optional, from F3 income assumptions) ──────────────────

export interface RevenueTarget {
  /** Effective rent per unit per month */
  effectiveRentPerUnit: number;
  /** Assumed stabilized occupancy (0-100) */
  stabilizedOccupancy: number;
  /** Other income per unit per month (parking, storage, etc.) */
  otherIncomePerUnit: number;
}

// ─── Full Design Targets (what F7 consumes) ─────────────────────────────────

export interface DesignTargets {
  /** Program targets from F3 Programming tab */
  program: ProgramTargets;
  /** Revenue targets from F3 income assumptions */
  revenue?: RevenueTarget;
  /** Zoning envelope from F2 (read-only, for reference) */
  zoningEnvelope?: {
    maxUnits: number;
    maxGFA: number;
    maxStories: number;
    maxHeight: number;
    maxFAR: number;
    bindingConstraint: string;
  };
}

// ─── Default fallback (shows placeholder data until F3 is wired) ────────────

export const DEFAULT_DESIGN_TARGETS: ProgramTargets = {
  targetUnits: 280,
  targetGFA: 300_000,
  targetFAR: 3.0,
  targetFloors: 8,
  targetParkingRatio: 1.5,
  targetHeight: 85,
  unitMix: { studio: 10, oneBed: 40, twoBed: 35, threeBed: 15 },
  approvedAmenities: [
    { id: 'pool', name: 'Pool & Sundeck', category: 'pool' },
    { id: 'fitness', name: 'Fitness Center', category: 'fitness' },
    { id: 'coworking', name: 'Co-Working Lounge', category: 'coworking' },
    { id: 'rooftop', name: 'Rooftop Lounge', category: 'lounge' },
    { id: 'pet', name: 'Pet Spa', category: 'pet' },
  ],
  budget: { total: 68_000_000, costPerSqft: 227 },
};
