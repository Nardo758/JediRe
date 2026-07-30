# JediRe Mapping Surface vs. Kimi K3 + Blender MCP (irinatoxi)

**Comparison Date:** 2026-07-29  
**Subject:** @irinatoxi's "Kimi K3 + Blender MCP" 3D scene workflow vs. JediRe Mapping Surface  
**Source:** https://x.com/irinatoxi/status/2080550212913725446

---

## 1. WHAT IRINA BUILT

### The Workflow

Irina's project is a **closed-loop AI 3D scene generation system** using Kimi K3 connected to Blender via MCP:

```
Natural Language Prompt
        │
        ▼
┌─────────────────────────────┐
│  Kimi K3 writes Blender     │
│  Python script              │
│  (cameras, lights,          │
│   materials, geometry)      │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Blender executes script    │
│  → Renders preview image    │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Kimi K3 "looks at" render  │
│  Critiques: lighting off?   │
│  Composition wrong?         │
│  Materials need work?       │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Writes corrected script    │
│  → Loop repeats until good  │
└─────────────────────────────┘
```

### Key Capabilities

| Capability | Description |
|---|---|
| **Natural language scene creation** | "Create a cinematic bedroom scene with morning light coming through sheer curtains" |
| **AI-authored Python** | Kimi K3 writes complete Blender Python scripts for geometry, materials, lighting rigs |
| **Iterative self-correction** | AI renders, critiques its own output, and rewrites code to fix issues |
| **Camera placement** | AI determines optimal camera angles based on scene description |
| **Material generation** | PBR materials, textures, shaders generated programmatically |
| **Lighting design** | Key light, fill light, rim light placement based on mood/time of day |
| **MCP integration** | Blender runs as an MCP server; Kimi K3 is the client driving it |

### Architecture

```
┌─────────────┐     MCP Protocol      ┌─────────────┐
│  Kimi K3    │ ◄──────────────────►  │   Blender   │
│  (Client)   │   - execute_script()  │  (Server)   │
│             │   - render_preview()  │             │
│             │   - get_scene_info()  │             │
└─────────────┘                       └─────────────┘
      │                                     │
      │ Vision capability                   │ Python API
      │ (looks at rendered image)           │ (bpy)
      ▼                                     ▼
┌─────────────┐                       ┌─────────────┐
│  Self-critique│                       │  3D Scene   │
│  + revision │                       │  + Render   │
└─────────────┘                       └─────────────┘
```

---

## 2. SIDE-BY-SIDE COMPARISON

| Dimension | Irina's Blender MCP | JediRe Mapping Surface (Current Plan) |
|---|---|---|
| **Primary Input** | Natural language description | Parcel boundary + manual tool interaction |
| **3D Engine** | Blender (desktop, C++/Python) | React Three Fiber (web, JavaScript/WebGPU) |
| **Creation Mode** | **AI-generative**: AI writes all code | **Interactive-parametric**: User draws walls/slabs |
| **Feedback Loop** | Render → AI critique → code revision | Real-time metric calculation (FAR, units, parking) |
| **Domain** | General 3D scenes (cinematic, product, archviz) | Constrained real estate development |
| **Platform** | Desktop app (Blender) | Web app (browser) |
| **User Skill Required** | Zero — just describe what you want | Moderate — must understand setbacks, FAR, unit mix |
| **Output** | Photorealistic renders, .blend files | Building geometry + financial metrics synced to ProForma |
| **Iteration Speed** | Slow (render + AI critique cycles) | Fast (real-time in browser) |
| **Precision** | Artistic/creative freedom | Regulatory precision (zoning setbacks, max height) |
| **Data Integration** | None — standalone 3D | Deep — parcel data, ownership, traffic, comps |
| **MCP Usage** | Yes — Blender as MCP server | No — not currently planned |

---

## 3. THE GAP: WHAT JEDIRE IS MISSING

### 3.1 No AI Generation Loop

JediRe's current plan is **purely manual**: the user draws walls, slabs, and zones. There's no AI that can:
- Generate an initial building massing from a text prompt
- Critique the design against market norms ("48 units on 2 acres is below market density")
- Suggest improvements ("Add a 5th floor — you have 20ft of height remaining")

Irina's workflow proves this is **technically feasible today** with Kimi K3.

### 3.2 No Rendered Feedback

JediRe shows wireframe/flat-shaded geometry in the browser. It does NOT:
- Produce photorealistic renders of the proposed building
- Allow AI to "look at" the render and suggest materials, landscaping, context
- Generate marketing imagery for investor presentations

Blender's Cycles/Eevee renderers could produce this if integrated.

### 3.3 No Natural Language Interface

A developer on JediRe must:
1. Know the parcel boundary
2. Understand zoning setbacks
3. Manually draw walls to the setback line
4. Calculate FAR themselves

With an Irina-style interface, they could say:
> *"Design a 5-story wrap-style multifamily building with 72 units, surface parking, and a pool courtyard. Stay within zoning setbacks. Maximize the FAR."

And the AI generates the initial massing.

---

## 4. HYBRID RECOMMENDATION: "JediRe Design Agent"

The ideal JediRe 3D design surface is a **hybrid of both approaches**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    JEDIRe DESIGN AGENT (F7 Tab)                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  MODE SELECTOR: [AI Generate] [Manual Design] [Split]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ═══ AI GENERATE MODE (New — inspired by irinatoxi) ═══       │
│                                                                 │
│  Prompt: "Design a 5-story wrap-style garden apartment         │
│          with 72 units and a pool courtyard on this parcel"   │
│                                                                 │
│  [Generate] ──► Kimi K3 Agent:                                  │
│    1. Reads parcel boundary + zoning constraints               │
│    2. Generates Pascal Editor scene (walls, slabs, zones)      │
│    3. Calculates FAR, units, parking                           │
│    4. Renders preview (WebGPU or Blender MCP)                  │
│    5. Self-critiques: "FAR at 65% — recommend adding floor"    │
│    6. User approves or requests revision                       │
│                                                                 │
│  ═══ MANUAL DESIGN MODE (Existing — Pascal Editor) ═══        │
│                                                                 │
│  [Wall Tool] [Slab Tool] [Zone Tool] [Measure]                 │
│  Real-time: FAR 3.2/4.0 │ Units 48/72 │ Parking 52 req        │
│                                                                 │
│  ═══ RENDER & CRITIQUE (New — inspired by irinatoxi) ═══     │
│                                                                 │
│  [Render Photorealistic] ──► Blender MCP or WebGPU path       │
│    → AI critiques: materials, landscaping, neighborhood fit    │
│    → Suggests: "Add brick facade to match historic district"   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. WHAT TO ADOPT FROM IRINA'S APPROACH

### 5.1 AI Scene Generation Agent

**New Component:** `DesignAgent` — a Kimi K3-powered agent that:

- **Input:** Natural language prompt + `MapAgentContext` (parcel, zoning, traffic, comps)
- **Process:**
  1. Analyzes constraints (setbacks, max FAR, max height, parking ratio)
  2. Generates initial Pascal Editor scene JSON
  3. Places Building node, Level nodes, Wall nodes, Zone nodes
  4. Calculates if design fits within constraints
  5. Renders preview
  6. Self-critiques and revises if needed
- **Output:** Complete Pascal Editor scene ready for manual refinement

**Example Prompts:**

| User Prompt | AI Action |
|---|---|
| "Maximize density on this parcel" | Generates to max FAR, max units, min parking |
| "Garden style with courtyards" | Wrap building around central zone, surface parking |
| "Podium with tuck-under parking" | 2-story podium, residential above, parking below |
| "Match the neighborhood character" | Analyzes nearby comps → suggests materials, height, massing |

### 5.2 MCP Integration for Rendering

**Option A: Blender MCP (High Quality)**
- Export Pascal Editor scene → glTF/FBX
- Send to Blender via MCP
- Blender renders photorealistic image
- AI critiques render, suggests materials/lighting
- Use for investor presentations, marketing

**Option B: WebGPU Render (Fast)**
- Real-time shadows, PBR materials in browser
- Simpler but instant
- Good for design iteration

**Hybrid:** WebGPU for iteration, Blender MCP for final renders.

### 5.3 Self-Critique Loop

After any design change (AI-generated or manual), the system should auto-critique:

```
Design Change: Added 6th floor
        │
        ▼
┌─────────────────────────────┐
│  Constraint Check           │
│  ❌ Exceeds max height      │
│  ⚠️ Parking now insufficient│
│  ✅ FAR still under limit   │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Market Check               │
│  6 stories = elevator req   │
│  +$400k cost impact         │
│  Suggest: Stay at 5 stories │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│  Render Preview             │
│  [Image of 6-story building]│
│  AI: "Massing is bulky —    │
│   consider stepping back    │
│   top floor"                │
└─────────────────────────────┘
```

---

## 6. UPDATED ARCHITECTURE: AI-Powered Design Surface

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         JEDIRe DESIGN AGENT (F7)                            │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     INPUT LAYER                                       │  │
│  │  • Natural language prompt                                           │  │
│  │  • Parcel boundary (from assessor)                                   │  │
│  │  • Zoning constraints (from M02)                                     │  │
│  │  • Market comps (from M05/M27)                                       │  │
│  │  • User's manual adjustments                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 AI GENERATION ENGINE (Kimi K3)                        │  │
│  │                                                                       │  │
│  │  Prompt → Constraint Analysis → Scene Generation → Self-Critique     │  │
│  │                                                                       │  │
│  │  Tools available to agent:                                           │  │
│  │  • create_wall(start, end, height)                                   │  │
│  │  • create_slab(polygon, elevation)                                   │  │
│  │  • create_zone(polygon, unit_type)                                   │  │
│  │  • calculate_far()                                                   │  │
│  │  • render_preview()                                                  │  │
│  │  • critique_design()                                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 SCENE LAYER (Pascal Editor)                           │  │
│  │                                                                       │  │
│  │  Site → Building → Level → Wall/Slab/Zone (from AI or manual)        │  │
│  │  Zustand store with undo/redo                                        │  │
│  │  Real-time metric calculation                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────┬──────────────────────────────────────────┐  │
│  │    WEBGPU VIEWER         │         BLENDER MCP (Optional)           │  │
│  │    (Real-time)           │         (Photorealistic)                 │  │
│  │                          │                                          │  │
│  │  • Shadows               │  • Export glTF → Blender                 │  │
│  │  • PBR materials         │  • AI places cameras, lights             │  │
│  │  • Parcel context        │  • Render final image                    │  │
│  │  • Fast iteration        │  • AI critiques render                   │  │
│  └──────────────────────────┴──────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                 SYNC LAYER                                            │  │
│  │                                                                       │  │
│  │  Design metrics → ProForma (F9)                                      │  │
│  │  Unit mix → Unit Mix Intelligence (M29)                              │  │
│  │  Scene state → Deal store (save/restore)                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. IMPACT ON THE BUILD PLAN

### What Changes

| Original Plan | Updated Plan (Post-Irina) | Rationale |
|---|---|---|
| Manual-only 3D design | **AI Generate + Manual** hybrid | Irina proved NL→3D works; speed matters |
| WebGPU only | **WebGPU + Blender MCP** | WebGPU for iteration, Blender for final quality |
| No render critique | **AI self-critique loop** | Catch constraint violations + market mismatches |
| Pascal Editor as-is | **Pascal Editor + AI tools** | Add agent-accessible tool API to scene store |

### What Stays The Same

| Element | Why Unchanged |
|---|---|
| **F7 placement** | Still the right module slot |
| **2D map first** | Parcel context is still foundational |
| **Assessor integration** | Parcel data is the anchor for everything |
| **Traffic/demographics layers** | Context data is independent of design mode |
| **Bidirectional ProForma sync** | Financial link is the core value prop |

### Revised Phase 3 (3D Design)

| Week | Original | Updated |
|---|---|---|
| 7 | Fork Pascal Editor | Fork Pascal Editor + add agent tool API |
| 8 | Parcel→Site adapter | Parcel→Site adapter + **DesignAgent prompt engineering** |
| 9 | FAR calculator | FAR calculator + **constraint critique engine** |
| 10 | Deal sync | Deal sync + **Blender MCP render pipeline** |
| **+11** | — | **AI generate mode MVP** — 5 prompt types working |
| **+12** | — | **Render critique loop** — AI critiques its own renders |

---

## 8. BOTTOM LINE

### What Irina Proved

1. **Kimi K3 can drive complex 3D software** via MCP (Blender Python scripts)
2. **Visual feedback loops work** — AI can render, critique, and self-correct
3. **Natural language is a viable 3D interface** — no CAD expertise required
4. **The loop is fast enough** for practical iteration

### What JediRe Should Adopt

| Adoption | Effort | Impact |
|---|---|---|
| **AI generate mode** — NL prompt → initial scene | Medium | 🎯 Massive — removes barrier for non-technical users |
| **Constraint critique engine** — auto-check zoning + market fit | Low | High — catches errors before they propagate to ProForma |
| **Blender MCP render** — photorealistic output for presentations | Medium | Medium — nice-to-have for pitches, not core workflow |
| **Self-critique loop** — AI reviews its own design | Medium | Medium — improves AI-generated quality |

### What JediRe Should NOT Adopt

| Rejection | Reason |
|---|---|
| **Pure AI-generated workflow** | Real estate has hard constraints (setbacks, FAR, parking ratios) that require precision; AI can *suggest* but user must *approve* |
| **Blender as primary engine** | Web-based delivery is core to JediRe; Blender is desktop-only |
| **Remove manual tools** | Power users need precise control; AI is for acceleration, not replacement |

---

## 9. THE KILLER FEATURE

The combination of both approaches produces something neither achieves alone:

> **"Design me a 72-unit building that maximizes yield on this parcel"**
>
> → AI reads parcel boundary, zoning code, traffic data  
> → AI generates 3 massing options (wrap, podium, courtyard)  
> → Each auto-synced to ProForma for instant ROI comparison  
> → User picks one, tweaks in Pascal Editor  
> → Final render generated via Blender MCP for investor deck  

**This is the JediRe Design Agent. It's what Irina's workflow would look like if it were purpose-built for real estate development instead of general 3D scene creation.**

---

**Saved to:** `JEDIRE_IRINA_COMPARISON.md`
