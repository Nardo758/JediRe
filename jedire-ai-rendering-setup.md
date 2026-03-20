# AI Rendering Integration - Setup Guide

## Overview

The 3D Design Module now includes **AI-powered photorealistic rendering** that converts simple massing studies into market-quality architectural visualizations using ControlNet + Stable Diffusion XL.

## Architecture

**Frontend → Backend → Replicate API → ControlNet/SDXL → Photorealistic Image**

### Technology Stack
- **Model:** ControlNet + Stable Diffusion XL
- **API Provider:** Replicate (replicate.com)
- **Backend:** Node.js service (`ai-rendering.service.ts`)
- **Frontend:** React component (`AIRenderingPanel.tsx`)

### Workflow
1. User generates 3D massing in Building3DEditor
2. Click "🎨 AI Render" button in toolbar
3. Select style, time of day, weather, context
4. System captures Three.js canvas screenshot
5. Screenshot sent to backend → Replicate API
6. ControlNet preserves massing structure, SDXL adds materials/lighting/details
7. Photorealistic rendering returned in ~15-30 seconds

---

## Setup Instructions

### 1. Get Replicate API Key

**Option A: Free Tier (Trial)**
1. Go to https://replicate.com
2. Sign up for account (GitHub/Google)
3. Navigate to **Account Settings** → **API tokens**
4. Copy API token

**Option B: Paid Plan (Production)**
- **Hobby Plan:** $25/month + $0.001-$0.05 per inference
- **Pro Plan:** Custom pricing for high volume

### 2. Configure Environment Variable

Add to `.env` file in `backend/` directory:

```bash
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Replit Users:**
1. Open **Secrets** panel (🔒 icon in sidebar)
2. Add new secret:
   - Key: `REPLICATE_API_TOKEN`
   - Value: Your token

### 3. Install Dependencies

Backend package already installed (`npm install replicate` in commit), but if starting fresh:

```bash
cd backend
npm install replicate
```

### 4. Verify Setup

Check API status endpoint:

```bash
curl http://localhost:3001/api/v1/ai/render/status
```

Expected response:
```json
{
  "configured": true,
  "service": "Replicate API (ControlNet + SDXL)",
  "message": "AI rendering service is ready"
}
```

---

## Usage

### From 3D Editor UI

1. **Generate Building:**
   - Click "🏗️ Generate" → Select template → Create massing

2. **Create Rendering:**
   - Click "🎨 AI Render" in toolbar
   - Select architectural style:
     - 🏢 Modern Glass
     - 🧱 Brick Traditional
     - 🏙️ Mixed-Use Urban
     - 🏭 Industrial Loft
     - 🌆 Luxury High-Rise
   - Select time of day: 🌅 Golden Hour / ☀️ Midday / 🌇 Dusk / 🌃 Night
   - Select weather: ☀️ Sunny / ☁️ Overcast / 🌧️ Rainy
   - Add geographic context (e.g., "Atlanta urban")
   - Click "🎨 Generate Rendering"

3. **Download Result:**
   - Wait 15-30 seconds
   - Download PNG

### Programmatic API

**Endpoint:** `POST /api/v1/ai/render`

**Request:**
```json
{
  "imageBase64": "data:image/png;base64,iVBORw0KG...",
  "style": "modern-glass",
  "timeOfDay": "golden-hour",
  "weather": "sunny",
  "context": "Atlanta urban context"
}
```

**Response:**
```json
{
  "success": true,
  "imageUrl": "https://replicate.delivery/pbxt/...",
  "localPath": "/tmp/jedire-renderings/render-uuid.png",
  "processingTime": 18742
}
```

**Available Styles:**
- `modern-glass`
- `brick-traditional`
- `mixed-use-urban`
- `industrial-loft`
- `luxury-highrise`

---

## Cost Estimates

**Replicate Pricing (ControlNet SDXL):**
- **Per inference:** ~$0.02-$0.05 (varies by resolution/steps)
- **Monthly estimates:**
  - 100 renderings: ~$3-5
  - 1,000 renderings: ~$30-50
  - 10,000 renderings: ~$300-500

**Tips to reduce cost:**
1. Use lower resolution for previews (faster + cheaper)
2. Batch multiple renderings per session
3. Cache results per massing design
4. Implement rate limiting (e.g., 5 renders/day per user)

---

## Technical Details

### Screenshot Capture

The Three.js canvas is captured using:

```typescript
const canvas = document.querySelector('canvas');
const dataUrl = canvas.toDataURL('image/png');
```

Resolution matches viewport size (typically 1920x1080).

### ControlNet Architecture

**ControlNet** is a neural network control structure that:
1. Takes a control image (your massing screenshot)
2. Extracts structural features (edges, depth, pose)
3. Guides SDXL to preserve building form
4. Allows adding materials, lighting, context without changing geometry

**Why ControlNet vs. standard img2img:**
- Standard img2img: Can drift from original structure
- ControlNet: Locks structure, only modifies appearance
- Result: Perfect for architectural workflows

### Prompt Engineering

The service auto-generates prompts based on user selections:

```typescript
// Example generated prompt:
"photorealistic architectural rendering, modern luxury apartment building, 
floor-to-ceiling glass windows, sleek metal panels, minimalist design, 
contemporary architecture, Atlanta urban context, golden hour lighting, 
warm sunset glow, dramatic shadows, sunny weather, clear blue sky, 
professional photography, high detail, 8K quality, architectural digest style, 
landscaping with trees and greenery, pedestrians, cars"
```

**Negative prompt** filters out:
- Low quality, blurry, distorted, cartoon, sketch, unrealistic, 
  bad architecture, floating objects, incorrect perspective

---

## Advanced Features (Future)

### Depth Map Integration

Currently uses screenshot only. Future enhancement: send depth map for better structural control.

**Three.js depth capture:**
```typescript
const depthMaterial = new THREE.MeshDepthMaterial();
const depthRenderTarget = new THREE.WebGLRenderTarget(width, height);
depthRenderTarget.depthTexture = new DepthTexture(width, height);

scene.overrideMaterial = depthMaterial;
renderer.setRenderTarget(depthRenderTarget);
renderer.render(scene, camera);

// Export as base64
const depthBase64 = depthCanvas.toDataURL('image/png');
```

### Custom LoRA Models

Fine-tune ControlNet on your architectural portfolio:
1. Collect 50-100 images of your firm's buildings
2. Train LoRA adapter on Replicate
3. Reference in API call for brand-consistent renderings

### Style Transfer from Reference Images

Allow users to upload inspiration photos:
```typescript
{
  imageBase64: massingScreenshot,
  styleReferenceBase64: inspirationPhoto,
  prompt_strength: 0.5 // Blend massing + style
}
```

---

## Troubleshooting

### "REPLICATE_API_TOKEN environment variable not set"
- Add token to `.env` file
- Restart backend server

### "Failed to capture screenshot"
- Ensure building is visible in viewport
- Check browser console for canvas errors

### Rendering looks nothing like massing
- Lower `prompt_strength` (0.5-0.6 instead of 0.7)
- Use depth map (future feature)
- Verify ControlNet model is `controlnet-scribble` variant

### Slow generation (>60 seconds)
- Replicate API can queue during high traffic
- Consider self-hosted ComfyUI for guaranteed speed

---

## Files Modified

**Backend:**
- `backend/src/services/ai-rendering.service.ts` - Core rendering logic
- `backend/src/api/rest/ai-rendering.routes.ts` - API endpoints
- `backend/src/api/rest/index.ts` - Route registration

**Frontend:**
- `frontend/src/components/design/AIRenderingPanel.tsx` - UI component
- `frontend/src/components/design/Building3DEditor.tsx` - Integration

**Dependencies:**
- `backend/package.json` - Added `replicate` package

---

## Next Steps

1. **Test with real massing:**
   - Load Atlanta Development deal
   - Generate 300-unit building
   - Create renderings in different styles

2. **Optimize costs:**
   - Implement caching (same massing = reuse rendering)
   - Add rate limiting
   - Store results in S3/database

3. **Enhance quality:**
   - Add depth map capture
   - Fine-tune prompts per property type
   - Train custom LoRA on Atlanta architecture

4. **User experience:**
   - Side-by-side comparison (massing vs. rendering)
   - Variation generator (same massing, multiple styles)
   - Export to PDF pitch deck

---

**Questions? Check:**
- Replicate Docs: https://replicate.com/docs
- ControlNet Paper: https://arxiv.org/abs/2302.05543
- Frontend component: `frontend/src/components/design/AIRenderingPanel.tsx`
