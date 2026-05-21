/**
 * Terminal F-key navigation registry tests.
 *
 * These tests guard against the class of silent-drift bugs where a tab is
 * added to TABS_META but the corresponding render entry or keyboard mapping
 * is forgotten, or where slug ↔ key round-trips break.
 *
 * Run: cd frontend && npx vitest run src/pages/__tests__/terminalNav.test.ts
 */
import { describe, it, expect } from "vitest";
import {
  TABS_META,
  FKEY_SLUG,
  SLUG_FKEY,
  RENDER_MAP_KEYS,
  FKEY_KBD_MAP,
} from "../TerminalPage";

describe("TABS_META registry — structural invariants", () => {
  it("has no duplicate keys", () => {
    const keys = TABS_META.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has no duplicate slugs (each slug resolves to exactly one canonical key)", () => {
    const slugs = TABS_META.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has no empty keys, slugs, or labels", () => {
    for (const t of TABS_META) {
      expect(t.key.trim(),  `empty key on tab "${t.label}"`).not.toBe("");
      expect(t.slug.trim(), `empty slug on tab "${t.label}"`).not.toBe("");
      expect(t.label.trim(),`empty label on tab "${t.key}"`).not.toBe("");
    }
  });
});

describe("FKEY_SLUG — forward lookup", () => {
  it("maps every TABS_META key to its declared slug", () => {
    for (const t of TABS_META) {
      expect(FKEY_SLUG[t.key]).toBe(t.slug);
    }
  });

  it("contains no extra keys beyond TABS_META", () => {
    const metaKeys = new Set(TABS_META.map((t) => t.key));
    for (const k of Object.keys(FKEY_SLUG)) {
      expect(metaKeys.has(k), `FKEY_SLUG has extra key "${k}" not in TABS_META`).toBe(true);
    }
  });
});

describe("SLUG_FKEY — reverse lookup", () => {
  it("maps every TABS_META slug back to a valid key", () => {
    for (const t of TABS_META) {
      const resolved = SLUG_FKEY[t.slug];
      expect(resolved, `SLUG_FKEY["${t.slug}"] is undefined`).toBeDefined();
      expect(FKEY_SLUG[resolved]).toBe(t.slug);
    }
  });
});

describe("RENDER_MAP_KEYS — renderer coverage", () => {
  it("contains a render entry for every TABS_META key", () => {
    for (const t of TABS_META) {
      expect(
        RENDER_MAP_KEYS.has(t.key),
        `RENDER_MAP_KEYS is missing key "${t.key}" (tab "${t.label}"). ` +
        `Add an entry to RENDER_MAP inside TerminalPage and to RENDER_MAP_KEYS.`
      ).toBe(true);
    }
  });

  it("has no extra keys beyond TABS_META", () => {
    const metaKeys = new Set(TABS_META.map((t) => t.key));
    for (const k of RENDER_MAP_KEYS) {
      expect(
        metaKeys.has(k),
        `RENDER_MAP_KEYS has extra key "${k}" not in TABS_META. ` +
        `Remove the RENDER_MAP entry or add a matching TABS_META row.`
      ).toBe(true);
    }
  });
});

describe("FKEY_KBD_MAP — keyboard handler", () => {
  it("maps every TABS_META key to itself or a valid alias", () => {
    for (const t of TABS_META) {
      const target = FKEY_KBD_MAP[t.key];
      expect(target, `FKEY_KBD_MAP missing entry for "${t.key}"`).toBeDefined();
      expect(
        RENDER_MAP_KEYS.has(target),
        `FKEY_KBD_MAP["${t.key}"] = "${target}" which has no render entry`
      ).toBe(true);
    }
  });

  it("F5 aliases F4 (Markets keyboard shortcut)", () => {
    expect(FKEY_KBD_MAP["F5"]).toBe("F4");
  });

  it("all canonical TABS_META keys are reachable via keyboard", () => {
    const reachable = new Set(Object.values(FKEY_KBD_MAP));
    for (const t of TABS_META) {
      expect(
        reachable.has(t.key),
        `Tab "${t.label}" (${t.key}) is unreachable from keyboard`
      ).toBe(true);
    }
  });
});
