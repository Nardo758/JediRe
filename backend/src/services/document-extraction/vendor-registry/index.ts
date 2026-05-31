/**
 * Vendor Registry — Public Entry Point
 *
 * Imports all vendor declarations and registers them with the singleton.
 * Import `vendorRegistry` from this module (not from `registry.ts` directly)
 * to ensure all vendors are registered before the first use.
 *
 * To add a new vendor:
 *   1. Create `<vendor-id>.vendor.ts` with a VendorDeclaration export.
 *   2. Import it here and call `vendorRegistry.register(...)`.
 *   3. No other files need to change.
 */

export { vendorRegistry } from './registry';
export type {
  VendorDeclaration,
  VendorFileType,
  VendorHeaderPattern,
  VendorFreshnessProfile,
  VendorLicensePosture,
  VendorWriteTargets,
  VendorClassificationMatch,
} from './types';

// ── Register all vendors ─────────────────────────────────────────────────────

import { vendorRegistry } from './registry';
import { COSTAR_VENDOR } from './costar.vendor';
import { YARDI_MATRIX_VENDOR } from './yardi-matrix.vendor';

vendorRegistry.register(COSTAR_VENDOR);
vendorRegistry.register(YARDI_MATRIX_VENDOR);

// ── Convenience helpers ───────────────────────────────────────────────────────

/**
 * Returns the flat list of accepted file-type descriptors across all registered
 * vendors. Each entry includes enough information for the frontend upload panel
 * to render an "Accepted Formats" list without hardcoding any vendor names.
 *
 * This is the canonical helper used by GET /api/v1/vendor-registry/file-types.
 * Adding a new vendor to this file (via `vendorRegistry.register(...)`) will
 * automatically include its file types in the output — no other changes needed.
 */
export interface VendorFileTypeSummary {
  vendorId: string;
  displayName: string;
  licensePosture: string;
  cadence: string;
  fileTypes: Array<{ documentType: string; label: string }>;
}

export function listVendorFileTypes(): VendorFileTypeSummary[] {
  return vendorRegistry.getAllVendors().map(v => ({
    vendorId:       v.vendorId,
    displayName:    v.displayName,
    licensePosture: v.licensePosture,
    cadence:        v.freshnessProfile.cadence,
    fileTypes: v.fileTypes.map(ft => ({
      documentType: ft.documentType,
      label:        ft.label,
    })),
  }));
}
