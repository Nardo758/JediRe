# 3D Studio — Integration Plan

## Goal
Replace the current Three.js box-massing in the Deal Capsule F7 tab with a real architectural editor that produces production-quality 3D models from deal parameters.

## Evaluation of Options

### Option A: text-to-cad (Claude + Build123d/CadQuery)
Cloned to workspace: `/home/ldixon/.openclaw/workspace/text-to-cad/`

- **What it does:** Claude writes Python CAD scripts → Build123d generates STEP/STL/GLB
- **Output:** Engineering-grade parametric CAD files
- **Pro:** Real BREP geometry, STEP export for contractors, version-controlled scripts
- **Con:** Not a live editor — generate, review, iterate. No interactive walls/rooms/zones.
- **Best for:** Generating site massings from deal params, not designing interiors
- **Effort:** 2-3 days to wire as a backend service

### Option B: pascalorg/editor (Full Architectural Editor)
Cloned to workspace: `/home/ldixon/.openclaw/workspace/editor/`

- **What it does:** React Three Fiber building editor with walls, slabs, roofs, zones, items
- **Output:** Interactive 3D building model → scene graph → GLB/screenshot
- **Pro:** Same tech stack (R3F, Zustand). Node hierarchy: Site → Building → Level → Wall/Item. Real CSG geometry (wall mitering, door/window cutouts). Undo/redo. WebGPU.
- **Con:** Three.js/R3F/zustand version gap. ~8 hours integration work. Still exports screenshots, not STEP files.
- **Best for:** Interactive architectural design in the Deal Capsule

### Option C: Onshape + FeatureScript (Adam AI Tools)
- **What it does:** Claude writes FeatureScript → Onshape cloud CAD executes
- **Output:** Real parametric CAD, manufacturing-ready
- **Pro:** No local infra, production-grade
- **Con:** Onshape account dependency, mechanical parts focus, not building-specific
- **Best for:** Custom parts/manufacturing — not building massing

### Option D: Fix Built-in AI Rendering
- **What it does:** Wire Replicate API (ControlNet/SDXL) → photorealistic overlay of massing
- **Output:** 2D photorealistic render from 3D massing
- **Pro:** Lowest effort (~1 day)
- **Con:** Still box geometry underneath, no editing capability
- **Best for:** Quick visualization improvement, not a replacement

### Option E: Blender Headless
- **What it does:** Backend Blender CLI, Python scripts generate building from params
- **Output:** Photorealistic renders, GLB for viewer, video flythroughs
- **Pro:** Free, open-source, Cycles rendering engine, huge ecosystem
- **Con:** Heavy infra (Blender install), no interactive editing
- **Best for:** Marketing materials, not design workflow

### Option F: 2D Plan Generator
- **What it does:** Floor plans, site plans, elevations from unit mix JSON → SVG/PDF
- **Output:** Scalable vector drawings, report-ready
- **Pro:** Fastest to ship (~2 days), most practical for underwriting docs
- **Con:** Not 3D, no interactive editing
- **Best for:** Immediate improvement to deal reporting

## Recommended Path
**Combine Option B + Option F for Phase 1, add Options A/E for Phase 2:**

### Phase 1 (Now — ~8 hours)
**pascalorg/editor integration into Deal Capsule F7 tab:**
1. Install Pascal packages: `@pascal-app/core`, `@pascal-app/viewer`, `@pascal-app/editor`
2. Build the packages locally (they're `"*"` workspace-linked — need to build from source)
3. Create wrapper component `PascalEditorWrapper.tsx` in JediRe:
   - Wraps Pascal's `<Editor>` component
   - Passes deal parcel boundary as initial site polygon
   - Wires deal zoning envelope (FAR, height limit, setbacks) as overlay
   - Seeds initial building massing from deal unit mix
4. Upgrade `@react-three/fiber` v8 → v9 across JediRe
5. Test 5 existing Three.js components for regressions
6. Register F7 tab — opens Pascal Editor with default scene seeded from deal data
7. Save scene graph to `deal_files` as `3d_scene.json`
8. **Bonus:** Add 2D plan export (floor plans from scene levels → SVG)

### Phase 2 (Later — 3-5 days)
**text-to-cad backend + Blender for production renders:**
1. `backend/src/services/cad-generator.service.ts` — receives deal JSON, calls text-to-cad Python scripts
2. Generates STEP + GLB from deal parameters (unit count, FAR, height, site area)
3. Stores CAD files as deal attachments with `cad_model` category
4. **Export:** STEP → contractor use, GLB → browser viewer, PNG → marketing
5. **Blender render:** Headless Blender takes the massing → photorealistic with Cycles

## Files to Create/Modify

### New Files
- `frontend/src/components/design/PascalEditorWrapper.tsx` — Wraps Pascal's Editor with JediRed data binding
- `frontend/src/components/design/PlanExporter.tsx` — SVG floor plan generator from scene data
- `backend/src/services/cad-generator.service.ts` — Phase 2

### Modified Files
- `frontend/src/components/design/Building3DEditor.tsx` — Replace content with PascalEditorWrapper
- `frontend/src/pages/DealDetailPage.tsx` — May need F7 tab registration tweaks
- `frontend/package.json` — Add Pascal packages, update three/r3f/drei/zustand versions

### Pascal Editor Local Build
The Pascal packages are workspace-linked (`"@pascal-app/core": "*"`). Options:
1. **Local build:** `cd packages/core && npm run build && cd ../viewer && npm run build && cd ../editor && npm run build` — then copy dist/ into JediRe or symlink
2. **Publish to npm:** Pascal has publish scripts but requires npm access
3. **Monorepo merge:** Copy packages into JediRe as a `vendor/` directory (MIT license, OK)

Recommendation: **Option 3** — copy Pascal packages into `vendor/pascal-editor/` as a git submodule or direct copy. Keeps JediRe self-contained, no npm publishing needed, and you can modify the editor code.

## Version Risk Assessment

| Dep | JediRe | Pascal | Change Required | Risk |
|-----|--------|--------|-----------------|------|
| three | ^0.183.1 | ^0.184.0 | Minor bump | Low |
| @r3f/fiber | ^8.18.0 | ^9.5.0 | Major v8 → v9 | Medium |
| @r3f/drei | ^9.122.0 | ^10.7.7 | Major | Medium |
| zustand | ^4.x | ^5 | Major v4 → v5 | **High** (200+ stores) |
| three-mesh-bvh | — | ^0.9.8 | New dep | Low |
| three-bvh-csg | — | ^0.0.18 | New dep | Low |

**Mitigation for zustand:** Pascal's core package bundles zustand v5 internally. JediRed's existing v4 stores won't conflict. The editor scene store uses a separate Zustand context. No need to upgrade JediRed's zustand.

## User Interaction Model

### Overall Workflow

```
F3 Market ───┬── Programming Tab ──→ user approves/adjusts ──┐
              │                                               │
              └── Amenity Gaps Tab ──→ user ✓/✗ each item ──┼──→ F7 Design Requirements
                                                             │
F4 Zoning ───┬── FAR, height, setbacks ──────────────────────┘
              │
              └── Envelope drawn as transparent 3D wireframe volume
```

### The F7 Design Studio (3 modes)

The user doesn't just view a model — they design within a constrained space:

**Mode 1: Generate from Concept**
1. F7 opens with site boundary on the ground + zoning envelope as wireframe
2. Sidebar shows "Recommended Program" (from F3) and "Approved Amenities" (from F3)
3. User clicks "Generate Concept" → agent calls GPT-4o → 2-3 concept images appear
4. User picks one → TRELLIS.2 (Phase 3) generates textured GLB into scene
5. User can switch to Design mode to refine

**Mode 2: Design from Scratch (Pascal Editor)**
1. Site polygon pre-drawn (from F5 Site / GeoJSON)
2. Approved program shown as design targets in sidebar:
   - "Target: 232 units (220-260)"
   - "Target: 183,000 GFA"
   - "Amenities: Pool ✓, Co-working ✓, Dog Park ✗"
3. User draws walls / places zones
4. **Real-time feedback:** Unit count, GFA, FAR update instantly as user draws
5. Zoning envelope acts as a constraint — walls outside it highlight red
6. User can toggle: "Show comp buildings" (3D boxes from F6 Supply)

**Mode 3: Edit Existing Design**
1. Load previously saved scene from deal_files
2. Modify walls, levels, unit layout
3. Save as new scenario version

### Interaction Components (F7 Layout)

```
┌─────────────────────────────────────────────────────────────┐
│ [Generate] [Design] [Edit]        [Save] [Export] [Compare] │
├──────────────┬──────────────────────────────────────────────┤
│  SIDEBAR     │                                               │
│              │                                               │
│ 📋 Program   │       3D VIEWPORT (Pascal Editor)             │
│  Units: 232  │                                               │
│  GFA: 183K   │     Site polygon on ground                    │
│  FAR: 3.5    │     Zoning envelope (wireframe)               │
│              │     Building massing (user-designed)           │
│ 🎯 Targets   │     Context buildings (optional)              │
│  Within env: │                                               │
│  ✅ FAR      │                                               │
│  ✅ Height   │                                               │
│  ✅ Setbacks │                                               │
│              │                                               │
│ 🏗️ Amenities │                                               │
│  Pool        │                                               │
│  Co-working  │                                               │
│              │                                               │
│ 📊 Financial │                                               │
│  NOI: $3.0M  │                                               │
│  IRR: 12.4%  │                                               │
│  Cost: $48M  │                                               │
├──────────────┴──────────────────────────────────────────────┤
│ Scenarios: [v1: Base Case] [v2: +Amenity Deck] [+ New]      │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Between Upstream Tabs

Upstream tabs produce **recommendations, not raw data**. The user curates them before they reach F7.

```
┌──────────────────────────────────────────────────────────────┐
│                      DEAL CAPSULE DATA FLOW                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  F1 Overview                                                 │
│    → Deal type (existing / development / redevelopment)      │
│    → Determines if F7 is available                           │
│                                                              │
│  F2 Deal Info                                                │
│    → Address → GeoJSON parcel boundary (via GIS service)     │
│    → Sent to F7 as site polygon                              │
│                                                              │
│  F3 Market (upstream CRITICAL)                               │
│                                                              │
│    ┌──────────────────────────────────────┐                  │
│    │  Programming Tab                     │                  │
│    │                                      │                  │
│    │  Recommends:                         │                  │
│    │  • Unit mix (15/35/35/15%)           │                  │
│    │  • Unit sizes (550/750/1100/1400sf)  │                  │
│    │  • Rent PSF ($2.15 blended)          │                  │
│    │  • Density (25du/ac)                 │                  │
│    │  • Parking ratio (1.5/unit)          │                  │
│    │                                      │                  │
│    │  User: approves/adjusts each value ──┼──→               │
│    └──────────────────────────────────────┘   │              │
│                                                │              │
│    ┌──────────────────────────────────────┐   │              │
│    │  Amenity Gaps Tab                    │   │              │
│    │                                      │   │              │
│    │  Recommends (from comp analysis):    │   │              │
│    │  ✓ Pool (87% of comps)              │   │              │
│    │  ✓ Co-working (62%)                 │   │              │
│    │  ✗ Dog Park (23%)                   │   │              │
│    │  ✓ Rooftop Lounge (45%)             │   │              │
│    │  ✗ Concierge (30%)                  │   │              │
│    │                                      │   │              │
│    │  User: ✓/✗ each ───────────────────┼──→                │
│    └──────────────────────────────────────┘                 │
│                           ↓                                  │
│  F3 Output: Validated Program + Approved Amenities           │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  F7 Design Studio                                       ││
│  │                                                          ││
│  │  RECEIVES:                                                ││
│  │  • Site polygon (from F2)                                ││
│  │  • Zoning envelope (from F4)                             ││
│  │  • Validated program (from F3, user-approved)            ││
│  │  • Approved amenities (from F3, user-curated)            ││
│  │                                                          ││
│  │  Auto-seeds initial design:                              ││
│  │  • 8 levels × 29 units/floor = 232 units                 ││
│  │  • Amenity spaces at ground level (pool deck, etc.)     ││
│  │  • Parking count = 232 × 1.5 = 348 spaces                ││
│  │                                                          ││
│  │  User refines until design is complete.                  ││
│  │  Real-time GFA/FAR/cost feedback as they work.           ││
│  └──────────────────────────────────────────────────────────┘│
│                           ↓                                  │
│  F9 Pro Forma                                                │
│    → Receives final design: unit count, GFA, amenity SF      │
│    → Runs underwriting model                                 │
│    → Shows NOI, IRR, equity requirements                     │
│    → User can navigate back to F7, tweak, re-run             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Save Format

When design is complete, the scene is saved to `deal_files`:

```json
{
  "type": "3d_scene",
  "deal_id": "...",
  "name": "v2 - Rooftop Amenity Deck",
  "data": {
    "scene_graph": { /* Pascal Editor scene */ },
    "program": {
      "units": 232,
      "gfa": 183000,
      "floors": 8,
      "unit_mix": { "studio": 35, "oneBed": 81, "twoBed": 81, "threeBed": 35 },
      "amenities": ["pool", "co-working", "rooftop_lounge"]
    },
    "metrics": {
      "noi": 2999000,
      "irr": 0.124,
      "cost": 48000000,
      "cap_rate": 0.056
    }
  }
}
```

## Game-Changer: Microsoft TRELLIS.2 (2026-04-27)
Microsoft dropped a 4B parameter open-source model that turns a single image into a fully textured 3D asset in **3 seconds**. PBR textures (roughness, metallic, opacity) out of the box. No rough meshes, no placeholders — physically accurate models under any lighting.

Repo: `microsoft.github.io/TRELLIS`

### Impact on JediRe 3D Pipeline
This replaces the old image-to-3D pipeline entirely. Hunyuan3D, Tripo, Meshy are now 2023 tech.

### Full Integrated Stack (Updated)
```
Step 1: Deal Params → GPT-4o (30 sec) → Building concept image
Step 2: Concept image → TRELLIS.2 (3 sec) → PBR GLB, fully textured
Step 3: PBR GLB → Pascal Editor (interactive) → Walls, levels, site context
Step 4: Scene → text-to-cad/STEP (30 sec) → Production-ready CAD
Step 5: Scene → Blender Cycles (5 min) → Photorealistic + flythrough
```

### Phase 3 (New — When TRELLIS.2 is available)
Integrate TRELLIS.2 as the backend 3D generation engine:
1. `backend/src/services/trellis-client.ts` — Downloads model, runs inference
2. Deal concept → GPT-4o → TRELLIS.2 → initial GLB
3. GLB loads into Pascal Editor for refinement
4. Journal: Save generated models to `deal_files` as `trellis_mesh`
5. **Key advantage:** PBR materials mean the model looks production-ready immediately, no material authoring needed

### Comparison
| Tool | Time | Output | Quality | Open Source |
|------|------|--------|---------|-------------|
| TRELLIS.2 | 3 sec | PBR GLB, fully textured | Production | ✅ MIT |
| Hunyuan3D | 10-30 sec | Rough mesh | Placeholder | ✅ |
| Tripo | 30-60 sec | Clean mesh | Good | ❌ API |
| Meshy | 60-120 sec | Clean mesh + textures | Good | ❌ API |

## Status
**Phase 1:** Ready to begin

Updated: 2026-04-27
