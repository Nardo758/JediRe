/**
 * Vendor Registry REST endpoints
 *
 *   GET  /api/v1/vendor-registry/file-types
 *        Returns all registered vendors and their accepted file-type labels.
 *        Used by the Market Data upload panel to render the "What we accept"
 *        list without any hardcoded vendor names in the frontend.
 *
 *   GET  /api/v1/vendor-registry/classify?filename=<name>
 *        Quick filename-based classification used for pre-upload hints.
 *        Returns the matched vendor + document type, or matched=false.
 */

import { Router } from 'express';
import { vendorRegistry } from '../../services/document-extraction/vendor-registry';

const router = Router();

// ── GET /api/v1/vendor-registry/file-types ───────────────────────────────────

router.get('/file-types', (_req, res) => {
  const vendors = vendorRegistry.getAllVendors().map(v => ({
    vendorId:       v.vendorId,
    displayName:    v.displayName,
    licensePosture: v.licensePosture,
    cadence:        v.freshnessProfile.cadence,
    fileTypes: v.fileTypes.map(ft => ({
      documentType: ft.documentType,
      label:        ft.label,
    })),
  }));

  res.json({ vendors });
});

// ── GET /api/v1/vendor-registry/classify ─────────────────────────────────────

router.get('/classify', (req, res) => {
  const filename = String(req.query.filename ?? '').trim();
  if (!filename) {
    return res.json({ matched: false });
  }

  const result = vendorRegistry.classifyByFilename(filename);
  if (!result) {
    return res.json({ matched: false });
  }

  return res.json({
    matched:      true,
    confidence:   result.confidence,
    vendorId:     result.match.vendorId,
    displayName:  result.match.displayName,
    documentType: result.match.fileType.documentType,
    label:        result.match.fileType.label,
  });
});

export default router;
