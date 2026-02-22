# AI Features User Guide

User-facing guide for AI-powered features in JEDI RE.

---

## Overview

JEDI RE uses Qwen AI to enhance your development workflow with intelligent automation across 5 key areas:

1. **3D Design** - Convert photos to terrain, generate designs
2. **Compliance** - Automated zoning violation detection
3. **Acquisitions** - Analyze owner likelihood to sell
4. **Construction** - Auto-tag photos, estimate progress
5. **Financial** - Market rent predictions *(coming soon)*

---

## Module 1: 3D Viewport AI

### Feature: Photo to Terrain Conversion

**What it does:** Upload a site photo and AI generates 3D terrain data automatically.

**How to use:**

1. Open any deal
2. Navigate to **3D Viewport** tab
3. Click **Upload Site Photo**
4. Select a photo of the development site
5. AI analyzes terrain and applies to 3D model
6. Review elevation map and adjust if needed

**Best practices:**
- Use clear, daytime photos
- Capture multiple angles for best results
- Avoid photos with heavy shadows or obstructions

**Example Output:**
- Elevation map (10x10 grid)
- Slope percentage
- Soil type estimate
- Grading requirements and costs

---

### Feature: AI Design Generation *(Limited)*

**What it does:** Generate building designs from text prompts.

**Current status:** Algorithmic fallback with AI framework ready

**How to use:**

1. In 3D Viewport, click **Generate Design**
2. Enter design requirements (unit count, target FAR, etc.)
3. AI generates optimized building massing
4. Review and modify as needed

---

## Module 2: Design Optimizer AI

### Feature: Automated Compliance Checking

**What it does:** Analyzes your 3D design for zoning violations and provides recommendations.

**How to use:**

1. Design a building in 3D Viewport
2. Click **Check Compliance**
3. (Optional) AI will analyze 3D render if available
4. Review violation report
5. Apply recommended fixes

**Violation Types Detected:**
- ✅ Setback violations
- ✅ Height restrictions
- ✅ Parking ratio compliance
- ✅ FAR violations
- ✅ Shadow impact *(if render provided)*

**Example Report:**
```
⚠️ Warning: North setback appears 5ft short
Recommendation: Adjust building position or reduce footprint
Confidence: 87%
```

---

## Module 3: Neighboring Property AI

### Feature: Owner Disposition Analysis

**What it does:** Predicts how likely a property owner is to sell and suggests negotiation strategy.

**How to use:**

1. Open **Neighboring Properties** tab
2. Click on an adjacent parcel
3. View **AI Disposition Score** (0-100)
4. Review factors (hold period, market timing, etc.)
5. Get recommended approach and pricing

**Disposition Score Guide:**
- **80-100:** Highly likely to sell, act quickly
- **60-79:** Moderate interest, good timing
- **40-59:** Passive interest, long negotiation
- **0-39:** Unlikely to sell, consider alternatives

**Example Analysis:**
```
Owner: Smith Family Trust
Score: 72/100
Factors:
- Long hold period (12 years): 80
- Portfolio streamlining signals: 85
- Market timing favorable: 65

Recommendation: Direct offer at $3.8M-4.2M
Approach: Emphasize estate planning benefits
Timeframe: 3-6 months
```

---

### Feature: Assemblage Strategy

**What it does:** Generates a prioritized acquisition plan for multiple adjacent parcels.

**How to use:**

1. Select multiple neighboring parcels
2. Click **Generate Strategy**
3. AI ranks targets by priority
4. View recommended approach for each
5. Review timeline and risk factors

**Strategy Output:**
- Acquisition sequence (sequential vs. parallel)
- Offer ranges for each property
- Talking points for negotiations
- Timeline and success probability

---

### Feature: Aerial Site Analysis

**What it does:** Analyzes satellite imagery to identify adjacent parcels, infrastructure, and market context.

**How to use:**

1. Click **Analyze Site** from property details
2. AI pulls satellite imagery and analyzes
3. View identified adjacent parcels
4. Review infrastructure and access points
5. See competitive project analysis

**What AI Detects:**
- Parcel boundaries
- Street access and alleys
- Utility locations
- Neighboring uses
- Competitive developments

---

## Module 4: Financial Auto-Sync *(Coming Soon)*

### Feature: AI Rent Predictions

**What it does:** Predicts market rents based on location, unit mix, and comparables.

**Status:** Framework in place, endpoint in development

**How it will work:**
1. Design your unit mix in 3D
2. Click **Predict Market Rents**
3. AI analyzes market comps
4. Rent forecast with confidence scores
5. Option to override AI predictions

---

### Feature: AI Cost Estimation

**What it does:** Estimates construction costs based on 3D design complexity.

**Status:** Framework in place, endpoint in development

**How it will work:**
1. Complete 3D design
2. Click **Estimate Costs with AI**
3. AI finds comparable projects
4. Cost breakdown by category
5. Confidence score and reasoning

---

## Module 5: Pipeline 3D Visualization

### Feature: Auto Photo Tagging

**What it does:** Automatically tags construction photos to 3D model locations.

**How to use:**

1. Open a deal in Pipeline
2. Click **Upload Progress Photos**
3. Select multiple photos
4. AI tags photos to building sections
5. Review and adjust tags if needed
6. Photos appear on 3D model

**What AI Detects:**
- Construction phase (foundation, framing, MEP, finishes)
- Building section (floor, wing, area)
- 3D coordinates within model
- Photo category tags

**Example Tags:**
```
Photo 1: "foundation, excavation, south-wing"
Location: Floor 1, South Wing, Section A
Confidence: 89%

Photo 2: "framing, rough-in, MEP"
Location: Floor 3, Main Building
Confidence: 82%
```

---

### Feature: Progress Estimation

**What it does:** Estimates construction completion percentage from photos.

**How to use:**

1. Select a building section
2. Upload recent photos
3. Click **Estimate Progress**
4. AI analyzes construction state
5. View completion percentage and timeline

**Progress Report Includes:**
- Percent complete (0-100%)
- Items completed
- Items remaining
- Estimated days to completion
- Confidence score

**Example:**
```
Floor 3 Progress: 65%
Completed: Framing, Rough MEP, Windows
Remaining: Drywall, Finishes, Punch-list
Est. Completion: 45 days
Confidence: 82%
```

---

## AI Settings & Controls

### Toggling AI Features

1. Navigate to **Settings** > **AI Features**
2. Enable/disable specific features:
   - ☑️ Image to 3D Terrain
   - ☑️ Design Compliance
   - ☑️ Aerial Analysis
   - ☑️ Owner Disposition
   - ☑️ Auto Photo Tagging
   - ☑️ Progress Estimation

### When AI is Disabled

All features gracefully fallback:
- Manual input required for terrain
- Rule-based compliance checking
- Basic owner scoring without AI insights
- Generic photo tags
- Manual progress tracking

---

## Tips for Best Results

### Photo Quality

**Do:**
- ✅ Use high-resolution images (1280x1280 min)
- ✅ Take photos in good lighting
- ✅ Capture multiple angles
- ✅ Include reference objects for scale

**Don't:**
- ❌ Use blurry or low-res images
- ❌ Upload photos with heavy filters
- ❌ Submit screenshots of renders
- ❌ Use images >10MB (resize first)

### Interpreting Confidence Scores

- **90-100%:** Very high confidence, trust the result
- **75-89%:** High confidence, good result
- **60-74%:** Moderate confidence, verify result
- **0-59%:** Low confidence, use with caution

### When to Override AI

AI is a tool, not a replacement for expertise. Override when:
- Your local knowledge contradicts AI
- Confidence score is low (<60%)
- AI misses context you have
- Manual data is more current

---

## Troubleshooting

### "AI service unavailable"

**Cause:** Backend not configured or HuggingFace down

**Solution:** Contact administrator or use manual input

---

### Slow AI responses

**Cause:** Large images or API congestion

**Solutions:**
- Resize images before upload
- Wait during off-peak hours
- Use fallback methods

---

### Incorrect AI results

**Cause:** Poor image quality, unusual site conditions, or edge cases

**Solutions:**
- Upload higher quality photos
- Provide multiple angles
- Verify and correct AI results manually
- Report persistent issues to support

---

## Privacy & Data

### What data does AI see?

- Uploaded photos (temporarily)
- Design geometry and parameters
- Market data from database
- Property ownership records

### Data retention:

- Images: Not stored permanently
- AI results: Cached 24 hours
- Logs: Retained 30 days

### Can I opt out?

Yes, disable AI features in Settings. Platform will work fully without AI using fallback methods.

---

## Support

Questions about AI features?

- **Technical issues:** See `QWEN_SETUP.md`
- **API details:** See `QWEN_API_REFERENCE.md`
- **Integration guide:** See `QWEN_INTEGRATION_GUIDE.md`

---

**Enjoy AI-powered real estate development!** 🚀

---

**Last Updated:** 2025-02-21
