#!/usr/bin/env python3
"""
W1-6b: Rename-and-migrate batch for LayeredValue consolidation.
Run in Replit: python3 scripts/w1-6b-rename-migrate.py

Phases:
  1. Rename domain-specific types (safe — pure mechanical)
  2. Migrate true duplicates to canonical (compiler-guided)

Rules:
  - Renames: traffic-calibration.ts LayeredValue -> TrafficCoefficientCascade
  - Renames: document-extraction/types.ts LayeredValue -> ExtractedFieldSources
  - Migrates: dealContext.ts, tax/types.ts, m08-strategies.ts, inflation/replacement-cost-v2.ts
    -> import canonical LayeredValue, extend or alias
  - Adds deprecation comments with Wave 3 pointer for TrafficCoefficientCascade
"""

import os
import re
import sys

BACKEND = "src"

def read_file(path):
    with open(path, "r") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w") as f:
        f.write(content)

def find_files(root, pattern):
    matches = []
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            if fn.endswith(".ts") and not fn.endswith(".test.ts"):
                path = os.path.join(dirpath, fn)
                content = read_file(path)
                if pattern in content:
                    matches.append(path)
    return matches

# ── Phase 1: Rename domain-specific types ───────────────────────────────────

def rename_type_in_file(filepath, old_name, new_name):
    content = read_file(filepath)
    # Replace interface/type definition
    content = re.sub(
        rf"(export\s+(?:interface|type)\s+){old_name}",
        rf"\1{new_name}",
        content,
    )
    # Replace usage in type annotations
    content = re.sub(
        rf"\b{old_name}\b",
        new_name,
        content,
    )
    write_file(filepath, content)
    return content != read_file(filepath)  # True if changed

print("=== W1-6b: LayeredValue Rename & Migrate ===\n")

# 1a. TrafficCoefficientCascade (traffic-calibration.types.ts)
print("Phase 1a: TrafficCoefficientCascade")
tc_file = os.path.join(BACKEND, "types", "traffic-calibration.types.ts")
if os.path.exists(tc_file):
    # Add deprecation comment before the interface
    content = read_file(tc_file)
    old_def = "export interface LayeredValue<T = number>"
    new_def = (
        "/** @deprecated Wave 3: the conversion registry will own these coefficients. "
        "This shape is interim; do not invest in it. */\n"
        "export interface TrafficCoefficientCascade<T = number>"
    )
    content = content.replace(old_def, new_def)
    content = content.replace("LayeredValue", "TrafficCoefficientCascade")
    write_file(tc_file, content)
    print(f"  ✓ Renamed in {tc_file}")
else:
    print(f"  ✗ File not found: {tc_file}")

# 1b. ExtractedFieldSources (document-extraction/types.ts)
print("\nPhase 1b: ExtractedFieldSources")
de_file = os.path.join(BACKEND, "services", "document-extraction", "types.ts")
if os.path.exists(de_file):
    content = read_file(de_file)
    old_def = "export interface LayeredValue<T = number>"
    new_def = (
        "/** Multi-source extraction record — each key is a doc-type that contributed a value. */\n"
        "export interface ExtractedFieldSources<T = number>"
    )
    content = content.replace(old_def, new_def)
    content = content.replace("LayeredValue", "ExtractedFieldSources")
    write_file(de_file, content)
    print(f"  ✓ Renamed in {de_file}")
else:
    print(f"  ✗ File not found: {de_file}")

# ── Phase 2: Migrate true duplicates to canonical ───────────────────────────
# These files define LayeredValue but are semantically the same concept.
# Strategy: replace local definition with import from canonical, extend if needed.

print("\nPhase 2: Migrate true duplicates to canonical LayeredValue")

# 2a. dealContext.ts — subset of canonical (resolvedFrom, updatedAt -> resolvedAt)
print("\n  2a. dealContext.ts")
dc_file = os.path.join(BACKEND, "types", "dealContext.ts")
if os.path.exists(dc_file):
    content = read_file(dc_file)
    # Remove the local LayeredValue definition
    old_block = """export interface LayeredValue<T> {
  value: T;
  source: LayeredValueSource | DataSourceLayer;
  resolvedFrom: 'broker' | 'platform' | 'user';
  updatedAt: string;
  confidence: number;
}"""
    new_block = "// LayeredValue -> imported from canonical (backend/src/types/layered-value.ts)"
    content = content.replace(old_block, new_block)
    # Add import if not present
    if "from '../../types/layered-value'" not in content and "from '../types/layered-value'" not in content:
        # Find a good place to add import
        import_idx = content.find("import ")
        if import_idx >= 0:
            line_start = content.rfind("\n", 0, import_idx) + 1
            content = (
                content[:line_start]
                + "import type { LayeredValue } from './layered-value';\n"
                + content[line_start:]
            )
    write_file(dc_file, content)
    print(f"    ✓ Migrated {dc_file}")
else:
    print(f"    ✗ File not found: {dc_file}")

# 2b. m08-strategies.service.ts — has 'layer' instead of 'source', plus sourceRef
print("\n  2b. m08-strategies.service.ts")
m08_file = os.path.join(BACKEND, "services", "m08-strategies.service.ts")
if os.path.exists(m08_file):
    content = read_file(m08_file)
    # This one is NOT a true duplicate — 'layer' is a different concept from 'source'
    # Rename to StrategyLayeredValue to avoid collision, don't migrate to canonical
    old_def = "export interface LayeredValue<T>"
    new_def = (
        "/** Strategy-specific value with layer and sourceRef. "
        "Kept separate from canonical LayeredValue because 'layer' is a different axis. */\n"
        "export interface StrategyLayeredValue<T>"
    )
    content = content.replace(old_def, new_def)
    content = content.replace("LayeredValue", "StrategyLayeredValue")
    write_file(m08_file, content)
    print(f"    ✓ Renamed to StrategyLayeredValue in {m08_file}")
else:
    print(f"    ✗ File not found: {m08_file}")

# 2c. inflation/replacement-cost-v2.service.ts — has confidence, asOf, provenance
print("\n  2c. inflation/replacement-cost-v2.service.ts")
inf_file = os.path.join(BACKEND, "services", "inflation", "replacement-cost-v2.service.ts")
if os.path.exists(inf_file):
    content = read_file(inf_file)
    # This is also NOT a true duplicate — has provenance array, asOf Date, confidence enum
    old_def = "export interface LayeredValue<T>"
    new_def = (
        "/** Inflation-adjusted cost value with provenance chain. "
        "Distinct from canonical LayeredValue because it carries temporal and provenance metadata. */\n"
        "export interface InflationCostValue<T>"
    )
    content = content.replace(old_def, new_def)
    content = content.replace("LayeredValue", "InflationCostValue")
    write_file(inf_file, content)
    print(f"    ✓ Renamed to InflationCostValue in {inf_file}")
else:
    print(f"    ✗ File not found: {inf_file}")

# 2d. tax/types.ts — tax-specific source values
print("\n  2d. tax/types.ts")
tax_file = os.path.join(BACKEND, "services", "tax", "types.ts")
if os.path.exists(tax_file):
    content = read_file(tax_file)
    # Tax-specific source values ('tax_bill_pdf', etc.) — subset + special sources
    # Migrate to canonical: source field is string, so tax sources fit
    old_block = """export interface LayeredValue<T> {
  /** The computed or fetched value. Mirrors the corresponding raw field on TaxForecast. */
  value: T;
  /**
   * Origin of the value:
   *   'tax_bill_pdf'        — parsed from an uploaded tax bill PDF (highest trust)"""
    # Find the full block — tricky because it's long
    # Just add import and comment out the local definition
    import_marker = "import { z } from 'zod';"
    if import_marker in content:
        content = content.replace(
            import_marker,
            "import { z } from 'zod';\nimport type { LayeredValue } from '../../types/layered-value';",
        )
    # Comment out the local definition (replace with a comment)
    content = re.sub(
        r"export interface LayeredValue<T> \{.*?^\}",
        "// Tax LayeredValue -> imported from canonical (source string accepts tax_bill_pdf etc.)",
        content,
        flags=re.DOTALL | re.MULTILINE,
    )
    write_file(tax_file, content)
    print(f"    ✓ Migrated {tax_file}")
else:
    print(f"    ✗ File not found: {tax_file}")

print("\n=== Phase 2 complete ===")
print("Next: run 'npx tsc --noEmit --skipLibCheck' to see compiler errors.")
print("Fix any remaining consumers that reference the old names.")
