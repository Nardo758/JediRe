# F5-1 CAPTURE — Ten Minutes in Replit (Operator)

**What this unblocks:** Bishop's golden re-pin → your Excel parity list → D3-W6 evidence integrity. Three things, one build.
**Prereq:** Replit session, backend running on :4000, DB connected. HEAD contains `b31a7b801` (the instrumentation commit).

## Steps
1. **Pull the instrumentation:**
```bash
cd ~/workspace
rm -f .git/*.lock 2>/dev/null
git pull origin master
git log --oneline -1   # expect b31a7b801 or later
```

2. **Make sure the backend is up and watch its console.** The instrumentation logs only for Bishop (`3f32276f-aacd-4da3-b306-317c5109b403`).

3. **Trigger one live Bishop build.** Either through the UI (F9 → Build Model on Bishop) or via the build route with the constructed body (`scripts/construct-build-body.ts` — the known F-P1-A path). Any real build works; it must go through `buildModel()`, not the test's direct `runFullModel()` call.

4. **Copy the logged JSON.** The console prints two blocks:
   - `modelAssumptions` at the `runFullModel()` boundary — **this is the one that matters** (post all 7 enhancement phases).
   - `full.adjustedAssumptions` post-M11/M14/reconcile — capture it too; it's useful context.
   Save both to a file, e.g. `/tmp/bishop_effective_assumptions.json`.

5. **Sanity-check two fields before you send it.** In the captured `modelAssumptions`, look for:
   - the **debt rate** — is it 6.0% or 6.5%?
   - the **NOI-relevant inputs** that M11 consumes.
   If the rate reads 6.0%, the hypothesis is already looking right: the enhancement phases set it, and the test path (raw store assumptions) had 6.5%.

6. **Send it back to the external agent** with the F5 follow-up note. It populates `bishop.golden.ts`'s `effectiveAssumptions`, runs the golden test against that input contract, and reports whether July-5-class values reproduce (loan ~$21.0M).

## What the answer means
- **Test reproduces $21.0M loan / 6.0% rate** → there was never an M11 regression; Finding P was simply incomplete (schema without capture). Bishop re-pins from a fresh full-payload capture, parity list goes final, D3-W6 unblocks behind F5-6's other half.
- **Test still diverges** → a real engine change moved something; the intentional-vs-regression trace runs on two threads (what moved the rate, which NOI M11 should consume).

Either way: **don't adjust any expected value to make it agree.** The disagreement is the data.

## If the console shows nothing
The instrumentation is deal-ID gated. Confirm you built *Bishop* (`3f32276f-aacd-4da3-b306-317c5109b403`), and that the build went through the service's `buildModel()` — a direct `runFullModel()` call bypasses the logging point entirely, which is the whole reason this capture exists.
