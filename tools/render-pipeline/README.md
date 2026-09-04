# JediRe Render Pipeline
## Hyper3D + Blender — AI 3D Generation → Photorealistic Render

Takes real estate deal parameters (levels, units, SF, facade type) and produces a
photorealistic architectural render using Hyper3D Rodin for 3D generation and
Blender Cycles for rendering.

---

## Architecture

```
Deal Parameters
      │
      ▼
┌─────────────────┐
│ Prompt Builder  │  ──► Converts real estate specs into detailed AI prompts
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Hyper3D Rodin   │  ──► Generates 3D building mesh from text prompt
│   (AI API)      │
└────────┬────────┘
         │  .glb / .obj
         ▼
┌─────────────────┐
│ Blender Cycles  │  ──► Ray-traced photorealistic rendering
│   (Renderer)    │     Materials, lighting, camera, environment
└────────┬────────┘
         │  .png
         ▼
    ┌─────────┐
    │ Render  │  ──► Deal gallery asset
    └─────────┘
```

---

## Prerequisites

### 1. Python 3.10+
```bash
python3 --version
```

### 2. Install Dependencies
```bash
cd tools/render-pipeline
pip install -r requirements.txt
```

### 3. Install Blender
Download from [blender.org](https://www.blender.org/download/)

Verify:
```bash
blender --version
```

If Blender isn't in your PATH, set:
```bash
export BLENDER_PATH="/Applications/Blender.app/Contents/MacOS/Blender"
```

### 4. Get Hyper3D API Key
1. Sign up at [hyper3d.ai](https://hyper3d.ai)
2. Generate an API key from your dashboard
3. Set as environment variable:
```bash
export HYPER3D_API_KEY="your-key-here"
```

---

## Quick Start

### Test Mode (No API Key)
```bash
python pipeline.py --levels 4 --units 32 --sf 45000 --facade brick --mock
```

This runs the full pipeline with a mock Hyper3D step. It will create a proxy
building in Blender and render it.

### Full Pipeline (With API Key)
```bash
export HYPER3D_API_KEY="your-key"

python pipeline.py \
  --name "The Pascal" \
  --levels 5 \
  --units 32 \
  --sf 45000 \
  --facade brick \
  --style modern \
  --context urban \
  --time golden_hour \
  --camera street_level \
  --output renders/the_pascal.png \
  --samples 256
```

---

## Deal Parameters

| Flag | Description | Options |
|------|-------------|---------|
| `--levels` | Number of stories | Any integer |
| `--units` | Total residential units | Any integer |
| `--sf` | Total square footage | Any integer |
| `--facade` | Primary exterior material | `brick`, `glass`, `concrete`, `wood_panel`, `stucco`, `mixed` |
| `--style` | Architectural style | `modern`, `traditional`, `industrial`, `luxury`, `transitional` |
| `--context` | Site context | `urban`, `suburban`, `downtown`, `waterfront` |
| `--time` | Lighting condition | `golden_hour`, `midday`, `dusk`, `overcast` |
| `--camera` | Camera angle | `street_level`, `aerial`, `corner`, `courtyard` |

---

## Render Quality

| Samples | Time | Quality | Use Case |
|---------|------|---------|----------|
| 64 | ~30s | Draft | Quick preview |
| 128 | ~1-2m | Good | Internal review |
| 256 | ~3-5m | High | Investor presentation |
| 512 | ~8-15m | Ultra | Marketing material |

---

## Output

Rendered images are saved as PNG with:
- 1920×1080 default resolution (configurable)
- Transparent background disabled (ground plane included)
- Denoising enabled
- Filmic color management

---

## Troubleshooting

### "Blender not found"
Set the path manually:
```bash
export BLENDER_PATH="/path/to/blender"
```

### "HYPER3D_API_KEY not set"
Run in mock mode for testing:
```bash
python pipeline.py --mock ...
```

Or set your key:
```bash
export HYPER3D_API_KEY="your-key"
```

### "Hyper3D generation failed"
- Check your API key is valid
- Check your account has generation credits
- Try reducing `--effort` (not yet exposed in CLI)

### Render is too dark/too bright
Adjust lighting in `BLENDER_SCRIPT` inside `pipeline.py`:
- `sun_data.energy` — Sun brightness
- `sun_data.color` — Sun warmth
- `fill_data.energy` — Fill light brightness

---

## Cost Estimate

| Component | Cost | Notes |
|-----------|------|-------|
| Hyper3D Rodin | ~$0.50-2.00/render | Depends on effort level |
| Blender | Free | Open source |
| Compute | Your machine | GPU rendering recommended |

---

## Next Steps

1. **Integrate with JediRe backend** — API endpoint that accepts deal JSON and queues render jobs
2. **Add material presets** — Brick, glass, concrete PBR materials in Blender
3. **Environment presets** — Urban street, suburban landscape, waterfront contexts
4. **Batch rendering** — Generate multiple views (street, aerial, dusk, day) in one job
5. **Animation** — Create flythrough videos for walkthrough experience
