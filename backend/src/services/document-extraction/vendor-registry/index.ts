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
