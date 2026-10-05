/** Shared read-only Site Finder contract. District codes are authority-scoped. */
export const SITE_COUNTIES = ['Miami-Dade', 'Broward', 'Palm Beach'] as const;
export type SiteCounty = typeof SITE_COUNTIES[number];
export interface SiteCriteria {
  counties: SiteCounty[];
  municipality?: string;
  propertyType?: string;
  typeSemantics?: 'current' | 'proposed';
  intendedUse?: string;
  zoning?: { code: string; jurisdiction: string };
  area?: { unit: 'acres' | 'sqft'; min?: number; max?: number; minInclusive: boolean; maxInclusive: boolean };
  addressText?: string;
  limit: number;
}
export interface SiteInterpretation { criteria: SiteCriteria; issues: string[]; interpretation: string[] }
export interface SiteEvidence { section: string; excerpt: string; url: string; checkedAt: string }
export type SitePermission = 'by-right' | 'conditional' | 'prohibited' | 'unverified' | 'not-requested';
export interface SiteReview {
  status: SitePermission;
  requestedUse?: string;
  legalUse?: string;
  districtName?: string;
  evidence: SiteEvidence[];
  conditions: string[];
  standards: { name: string; value: string; evidence: SiteEvidence }[];
  limitations: string[];
  checkedAt: string;
}
export interface SiteParcel {
  key: string;
  county: SiteCounty;
  parcelId: string;
  address: string | null;
  currentPropertyType: string | null;
  currentLandUse: string | null;
  classificationSourceUrl?: string;
  areaSqft: number;
  acres: number;
  jurisdiction: string | null;
  district: string | null;
  geometry?: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
  sourceUrl: string;
  areaSourceUrl: string;
  jurisdictionSourceUrl?: string;
  zoningSourceUrl?: string;
  sourceUpdatedAt?: string;
  retrievedAt: string;
  warnings: string[];
  review: SiteReview;
}
export interface SiteSourceHealth {
  county: SiteCounty;
  status: 'pending' | 'working' | 'complete' | 'partial' | 'error';
  sourceUrl: string;
  checkedAt?: string;
  finishedAt?: string;
  scanned: number;
  matched: number;
  limited: boolean;
  messages: string[];
}
export interface SiteRun {
  id: string;
  criteria: SiteCriteria;
  status: 'queued' | 'running' | 'complete' | 'partial' | 'error';
  createdAt: string;
  updatedAt: string;
  results: SiteParcel[];
  sources: SiteSourceHealth[];
  warnings: string[];
}

export interface SiteInstruction {
  id: string;
  text: string;
  status: 'queued' | 'understanding' | 'clarification' | 'searching' | 'error';
  message?: string;
  runId?: string;
  criteria?: SiteCriteria;
  summary?: string[];
  clarificationOf?: string;
}