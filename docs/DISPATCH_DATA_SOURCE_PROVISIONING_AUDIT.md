# DISPATCH — DATA-SOURCE PROVISIONING AUDIT (Read-Only)

**Purpose:** CREATE-1 proved the research pipeline works end-to-end, but the last trace showed sources returning "no data due to subscription restrictions." The plumbing is real; the faucets may be dry. This audit produces the table that tells the operator EXACTLY which data sources are wired, credentialed, and actually returning data — so provisioning decisions are made on fact, not guess. Read-only: no fixes, no credential changes.
**Executor:** engine-authority agent. Repo `Nardo758/JediRe.git` · backend :4000.
**Standing rules:** S1-01 evidence per row · never PASTE a secret value (report presence/absence of a credential, never its content) · verify counts.

## The deliverable: one table, every research data source
For EACH source the platform integrates for deal research, produce a row:

| Source | Integration point (file:line) | Credential (env var name only) | Cred present? | Last-call result | Verdict |
|--------|------------------------------|-------------------------------|---------------|------------------|---------|

Sources to cover (from the stack — verify the actual list against code, add any found, flag any listed-but-absent):
- **RentCast** (rent/comps)
- **ATTOM** (property/tax/deed/mortgage)
- **CompStak** (lease comps)
- **ApartmentIQ** (multifamily data)
- **County GIS / ArcGIS** (parcel/zoning geometry)
- **FDOT AADT** (traffic)
- **Census / GeoEnrichment**
- **Google Places**
- **FRED** (DGS10, SOFR, CPIAUCSL)
- **Municode** (zoning code text)
- **SpyFu** (if still wired)
- **Tavily / web search** (the Zoning agent's search — errored empty in last trace)
- **DeepSeek / LLM** (the agent engine itself — now funded, confirm)
- any others found in the integration layer.

## Per-source, establish (read-only)
1. **Integration point:** where the source is called — file:line of the client/adapter. Is it wired into the create/research path, or defined-but-unused?
2. **Credential presence:** which env var(s) the client reads. Is it SET in this environment? (Report set/unset — NEVER the value.) Distinguish "env var missing" from "env var present but call still failed."
3. **Last-call result classification** — reconcile against the CREATE-1 trace where possible:
   - `RETURNS DATA` — source works, returns usable data.
   - `EMPTY-BY-SUBSCRIPTION` — call succeeds but account/tier lacks access (the "subscription restrictions" case).
   - `EMPTY-BY-BUG` — call errors or mis-handles (e.g. Tavily's empty-error-object).
   - `NOT-WIRED` — defined but never called on the research path.
   - `NO-CREDENTIAL` — env var absent, call can't authenticate.
4. **Free vs paid:** is this a free/public API (FRED, Census, county GIS often are) or a paid subscription (ATTOM, CompStak, RentCast, CompStak, ApartmentIQ typically)? Free-but-empty is a bug; paid-but-empty is a provisioning decision.

## Cross-checks
1. **CoStar firewall (standing constraint):** confirm NO source in the list routes CoStar data (the four leak vectors stay clean) — this audit is a good moment to re-verify the non-CoStar stack is what's actually wired.
2. **The CREATE-1 "subscription restrictions" error:** trace it to the specific source(s) that emitted it — which tool call, which source, which credential state.
3. **Zoning agent's dry sources:** the Zoning schema-validation failure may partly be dry API sources (Municode/GIS) — note which of Zoning's expected inputs are API-sourced and currently returning nothing (feeds the Zoning source-routing dispatch).

## DELIVERABLE + STOP
`docs/audits/DATA_SOURCE_PROVISIONING_AUDIT.md`: the master table + per-source detail + the free/paid split + the CoStar re-confirmation. End with:
- **PROVISION list:** paid sources that are wired + credential-ready but need a subscription activated (the operator's action list) — prioritized by relevance to the FL/Atlanta/Dallas launch markets.
- **FIX list:** sources that are EMPTY-BY-BUG or NOT-WIRED (code work, not provisioning).
- **FREE-WINS list:** free/public sources that should return data and don't (cheap fixes, high value — FRED/Census/county GIS).
**STOP. No credential changes, no fixes, no secret values in the report.**

## OUT OF SCOPE
Activating any subscription (operator) · fixing wired-but-broken sources (follow-on) · Zoning agent fix (own dispatch) · new-source integration.

**Read-only. The table turns "the faucets are dry" into "these exact three faucets need turning on, these two are broken, these are free and should work."**
