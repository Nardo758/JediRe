/**
 * Vendor Market Data Registry
 *
 * Singleton registry of all market data vendors. Provides:
 *   - `register(declaration)` — called once per vendor at startup
 *   - `classifyByFilename(filename)` — returns vendor match or null
 *   - `classifyByHeaders(headerStr, headerSet)` — returns vendor match or null
 *   - `getVendorById(id)` — lookup by vendorId
 *   - `getVendorByDocType(docType)` — lookup by classified DocumentType
 *   - `getAllVendors()` — full list for iteration
 *
 * The classifier.ts calls `classifyByFilename` and `classifyByHeaders` BEFORE
 * any non-vendor pattern checks. Adding a new vendor to this registry requires
 * zero changes to classifier.ts.
 */

import type { DocumentType } from '../types';
import type {
  VendorDeclaration,
  VendorFileType,
  VendorHeaderPattern,
  VendorClassificationMatch,
} from './types';

// ── Registry class ───────────────────────────────────────────────────────────

class VendorRegistry {
  private readonly vendors = new Map<string, VendorDeclaration>();
  /** Fast lookup: DocumentType → { vendor, fileType } */
  private readonly docTypeIndex = new Map<
    DocumentType,
    { vendor: VendorDeclaration; fileType: VendorFileType }
  >();

  /**
   * Register a vendor declaration. Idempotent — re-registering the same
   * vendorId replaces the previous registration.
   */
  register(declaration: VendorDeclaration): void {
    this.vendors.set(declaration.vendorId, declaration);
    for (const ft of declaration.fileTypes) {
      this.docTypeIndex.set(ft.documentType, {
        vendor: declaration,
        fileType: ft,
      });
    }
  }

  // ── Filename classification ────────────────────────────────────────────────

  /**
   * Try to classify a filename against all registered vendor file-type
   * filename patterns.
   *
   * Returns the first match (vendors are checked in registration order,
   * file types in declaration order within each vendor).
   */
  classifyByFilename(
    filename: string,
  ): { match: VendorClassificationMatch; confidence: number; hints: string[] } | null {
    for (const vendor of this.vendors.values()) {
      for (const ft of vendor.fileTypes) {
        if (!ft.filenamePatterns?.length) continue;
        for (const pattern of ft.filenamePatterns) {
          if (pattern.test(filename)) {
            return {
              match: {
                vendorId: vendor.vendorId,
                displayName: vendor.displayName,
                fileType: ft,
                licensePosture: vendor.licensePosture,
                freshnessProfile: vendor.freshnessProfile,
              },
              confidence: ft.filenameConfidence ?? 0.6,
              hints: [
                `${vendor.displayName} filename pattern: "${pattern.source}" → ${ft.label}`,
              ],
            };
          }
        }
      }
    }
    return null;
  }

  // ── Header classification ─────────────────────────────────────────────────

  /**
   * Try to classify a document by its parsed headers.
   *
   * @param headerStr  lowercased, space-joined header string (for substring search)
   * @param _headerSet lowercased set of individual headers (reserved for future exact-match needs)
   */
  classifyByHeaders(
    headerStr: string,
    _headerSet?: Set<string>,
  ): { match: VendorClassificationMatch; confidence: number; hints: string[] } | null {
    for (const vendor of this.vendors.values()) {
      for (const ft of vendor.fileTypes) {
        if (!ft.headerPatterns?.length) continue;
        for (const pattern of ft.headerPatterns) {
          const result = this._testHeaderPattern(pattern, headerStr);
          if (result.matched) {
            return {
              match: {
                vendorId: vendor.vendorId,
                displayName: vendor.displayName,
                fileType: ft,
                licensePosture: vendor.licensePosture,
                freshnessProfile: vendor.freshnessProfile,
              },
              confidence: pattern.confidence,
              hints: [
                `${vendor.displayName} header pattern: ${pattern.description}`,
                ...result.matchedSignals.map(s => `  matched: "${s}"`),
              ],
            };
          }
        }
      }
    }
    return null;
  }

  // ── Lookup helpers ────────────────────────────────────────────────────────

  getVendorById(vendorId: string): VendorDeclaration | undefined {
    return this.vendors.get(vendorId);
  }

  getVendorByDocType(
    docType: DocumentType,
  ): { vendor: VendorDeclaration; fileType: VendorFileType } | undefined {
    return this.docTypeIndex.get(docType);
  }

  getAllVendors(): VendorDeclaration[] {
    return Array.from(this.vendors.values());
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _testHeaderPattern(
    pattern: VendorHeaderPattern,
    headerStr: string,
  ): { matched: boolean; matchedSignals: string[] } {
    const minMatches = pattern.minMatches ?? pattern.signals.length;
    const matchedSignals: string[] = [];

    // 1. Count signal matches
    for (const signal of pattern.signals) {
      if (headerStr.includes(signal)) {
        matchedSignals.push(signal);
      }
    }
    if (matchedSignals.length < minMatches) {
      return { matched: false, matchedSignals };
    }

    // 2. Require one from each group
    if (pattern.alsoRequireOneFromEach) {
      for (const group of pattern.alsoRequireOneFromEach) {
        const hit = group.find(s => headerStr.includes(s));
        if (!hit) return { matched: false, matchedSignals };
        matchedSignals.push(hit);
      }
    }

    // 3. Exclusions
    if (pattern.excluding) {
      for (const exc of pattern.excluding) {
        if (headerStr.includes(exc)) {
          return { matched: false, matchedSignals };
        }
      }
    }

    return { matched: true, matchedSignals };
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

export const vendorRegistry = new VendorRegistry();
