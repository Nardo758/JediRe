# TypeScript Compilation Error Audit — JediRe Backend

**Total errors:** 402 across 111 files

## Error Breakdown by Pattern

### Missing Import: pool not imported from database/connection
**Count:** 14 | **Complexity:** trivial

- `src/api/rest/documentsFiles.routes.ts:202` — TS2304: Cannot find name 'pool'.
- `src/api/rest/documentsFiles.routes.ts:248` — TS2304: Cannot find name 'pool'.
- `src/api/rest/documentsFiles.routes.ts:528` — TS2304: Cannot find name 'pool'.
- ... and 11 more

**Fix:** Add `import { pool } from '../database/connection'` (or correct relative path) to each file.

### Logic Error: Comparison of non-overlapping types
**Count:** 12 | **Complexity:** trivial

- `src/api/rest/valuation-grid.routes.ts:72` — TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap...
- `src/api/rest/valuation-grid.routes.ts:101` — TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap...
- `src/api/rest/valuation-grid.routes.ts:134` — TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap...
- ... and 9 more

**Fix:** Boolean compared to string. Likely `=== 'true'` on a boolean field. Change to `=== true`.

### Module Resolution: pino types missing in sigma modules
**Count:** 8 | **Complexity:** trivial

- `src/services/sigma/analog-engine.ts:18` — TS2307: Cannot find module 'pino' or its corresponding type declarations.
- `src/services/sigma/calibration-ledger.ts:19` — TS2307: Cannot find module 'pino' or its corresponding type declarations.
- `src/services/sigma/causal-discipline-engine.ts:19` — TS2307: Cannot find module 'pino' or its corresponding type declarations.
- ... and 5 more

**Fix:** Replace `import type { Logger } from 'pino'` with `import type { Logger } from '../../utils/logger'` (or wherever the project's Logger type lives). Remove all pino dependencies from sigma/. The project already has `createLogger` utility.

### Missing Import: dealCheck middleware not imported
**Count:** 5 | **Complexity:** trivial

- `src/api/rest/deal-assumptions.routes.ts:2783` — TS2304: Cannot find name 'dealCheck'.
- `src/api/rest/deal-assumptions.routes.ts:2784` — TS2304: Cannot find name 'dealCheck'.
- `src/api/rest/deal-validation.routes.ts:33` — TS2304: Cannot find name 'dealCheck'.
- ... and 2 more

**Fix:** Import `dealCheck` from the correct middleware module (likely `../../middleware/auth` or similar).

### Missing Variable: user_id variable undefined
**Count:** 4 | **Complexity:** trivial

- `src/api/rest/capsule.routes.ts:481` — TS2304: Cannot find name 'user_id'.
- `src/api/rest/capsule.routes.ts:582` — TS2304: Cannot find name 'user_id'.
- `src/api/rest/capsule.routes.ts:732` — TS2304: Cannot find name 'user_id'.
- ... and 1 more

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Missing Import: assertDealOrgAccess not imported
**Count:** 3 | **Complexity:** trivial

- `src/api/rest/notarize.routes.ts:86` — TS2304: Cannot find name 'assertDealOrgAccess'.
- `src/api/rest/notarize.routes.ts:109` — TS2304: Cannot find name 'assertDealOrgAccess'.
- `src/api/rest/notarize.routes.ts:147` — TS2304: Cannot find name 'assertDealOrgAccess'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Missing Variable: sc2/sp2 variables undefined
**Count:** 2 | **Complexity:** trivial

- `src/api/rest/grid.routes.ts:290` — TS2304: Cannot find name 'sc2'.
- `src/api/rest/grid.routes.ts:299` — TS2304: Cannot find name 'sp2'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Missing Variable: rows variable undefined
**Count:** 2 | **Complexity:** trivial

- `src/services/building-profiles/building-profile.service.ts:410` — TS2304: Cannot find name 'rows'.
- `src/services/building-profiles/building-profile.service.ts:442` — TS2304: Cannot find name 'rows'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Module Resolution: rss-parser types missing
**Count:** 2 | **Complexity:** trivial

- `src/services/discovery/sources/cre-rss.ts:28` — TS2307: Cannot find module 'rss-parser' or its corresponding type declarations.
- `src/services/news-connections/rss-feeds.ts:12` — TS2307: Cannot find module 'rss-parser' or its corresponding type declarations.

**Fix:** Install `@types/rss-parser` or add `declare module 'rss-parser'`.

### Module Resolution: Missing proforma-blueprint module
**Count:** 2 | **Complexity:** trivial

- `src/services/proforma-adjustment.service.ts:2105` — TS2307: Cannot find module '../blueprint/proforma-blueprint' or its corresponding type declarations.
- `src/services/proforma-adjustment.service.ts:3180` — TS2307: Cannot find module '../blueprint/proforma-blueprint' or its corresponding type declarations.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Missing Variable: field variable undefined
**Count:** 1 | **Complexity:** trivial

- `src/agents/cashflow.postprocess.ts:677` — TS2304: Cannot find name 'field'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Missing Import: StubMeteringAdapter not imported
**Count:** 1 | **Complexity:** trivial

- `src/api/rest/admin.routes.ts:1669` — TS2304: Cannot find name 'StubMeteringAdapter'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Import Mismatch: pool import mismatch (named vs default)
**Count:** 1 | **Complexity:** trivial

- `src/api/rest/audit.routes.ts:7` — TS2614: Module '"../../database/connection"' has no exported member 'pool'. Did you mean to use 'import pool...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Unused Directive: @ts-expect-error with no error to suppress
**Count:** 1 | **Complexity:** trivial

- `src/api/rest/m07-calibration.routes.ts:93` — TS2578: Unused '@ts-expect-error' directive.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Missing Import: ownerCheck middleware not imported
**Count:** 1 | **Complexity:** trivial

- `src/api/rest/portfolio.routes.ts:680` — TS2304: Cannot find name 'ownerCheck'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Missing Import: buildHeuristicSigma not imported
**Count:** 1 | **Complexity:** trivial

- `src/api/rest/sigma-full.routes.ts:135` — TS2304: Cannot find name 'buildHeuristicSigma'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Missing Import: createHash not imported from crypto
**Count:** 1 | **Complexity:** trivial

- `src/services/correlationEngine.service.ts:3326` — TS2304: Cannot find name 'createHash'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Missing Variable: totalUnits variable undefined
**Count:** 1 | **Complexity:** trivial

- `src/services/financial-model-engine.service.ts:593` — TS2304: Cannot find name 'totalUnits'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Module Resolution: Missing platform-hooks module
**Count:** 1 | **Complexity:** trivial

- `src/services/gmail-sync.service.ts:507` — TS2307: Cannot find module '../../services/agents/platform-hooks' or its corresponding type declarations.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Logic Error: Expression is never nullish
**Count:** 1 | **Complexity:** trivial

- `src/services/proforma-adjustment.service.ts:2272` — TS2881: This expression is never nullish.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Module Resolution: Missing lifecycle module import
**Count:** 1 | **Complexity:** trivial

- `src/services/skills/skills/index.ts:548` — TS2307: Cannot find module '../../../lifecycle/transition-guard.service' or its corresponding type declarati...

**Fix:** The file `lifecycle/transition-guard.service` doesn't exist or isn't exported. Either create the module, or stub `guardTransition` locally with `// @ts-expect-error`.

### Type Mismatch: Express Request missing file property (Multer)
**Count:** 76 | **Complexity:** small

- `src/api/rest/bulk-upload.routes.ts:111` — TS2339: Property 'files' does not exist on type 'AuthenticatedRequest'.
- `src/api/rest/bulk-upload.routes.ts:218` — TS2339: Property 'file' does not exist on type 'AuthenticatedRequest'.
- `src/api/rest/capital-structure.routes.ts:410` — TS2339: Property 'file' does not exist on type 'Request<ParamsDictionary, any, any, ParsedQs, Record<string,...
- ... and 73 more

**Fix:** Same as above — either augment Express.Request globally, or cast `req as any` in upload handlers. **Rabbit hole:** small if cast, moderate if proper typing.

### Generic Mismatch: dbQuery/generic function no longer accepts type param
**Count:** 32 | **Complexity:** small

- `src/api/rest/bulk-upload.routes.ts:340` — TS2558: Expected 0 type arguments, but got 1.
- `src/api/rest/calibration.routes.ts:231` — TS2558: Expected 0 type arguments, but got 1.
- `src/api/rest/property-discovery.routes.ts:457` — TS2558: Expected 0 type arguments, but got 1.
- ... and 29 more

**Fix:** Remove the generic type argument from `dbQuery<T>(...)` calls. The current `query` export from `database/connection` is not generic. Change to `dbQuery(...)` and cast result rows if needed: `const rows = result.rows as T[]`.

### Naming Mismatch: Snake_case vs camelCase property mismatch
**Count:** 32 | **Complexity:** small

- `src/api/rest/deal-assumptions.routes.ts:309` — TS2551: Property 'total_units' does not exist on type '{ landCost?: number; hardCostPsf?: number; softCostPc...
- `src/api/rest/deal-assumptions.routes.ts:317` — TS2551: Property 'land_cost' does not exist on type '{ landCost?: number; hardCostPsf?: number; softCostPct?...
- `src/api/rest/deal-assumptions.routes.ts:319` — TS2551: Property 'avg_unit_sf' does not exist on type '{ landCost?: number; hardCostPsf?: number; softCostPc...
- ... and 29 more

**Fix:** The DB layer returns snake_case but TS types use camelCase. Either rename accessors to camelCase (if ORM maps them) or add runtime mapping. Many are simple renames in destructuring.

### Type Mismatch: string not assignable to number
**Count:** 14 | **Complexity:** small

- `src/agents/cashflow.postprocess.ts:1655` — TS2345: Argument of type '{ gpr_year1?: number; noi_year1: number; purchase_price: number; hold_years: numbe...
- `src/inngest/functions/bls-qcew-monthly.ts:14` — TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
- `src/inngest/functions/calibrationRealizationCron.ts:197` — TS2345: Argument of type 'JsonifyObject<{ updated_at?: string; noi?: number; deal_id?: string; gpr?: number;...
- ... and 11 more

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Scope Error: Block-scoped variable used before declaration
**Count:** 7 | **Complexity:** small

- `src/api/rest/deal-assumptions.routes.ts:1668` — TS2448: Block-scoped variable 'res' used before its declaration.
- `src/routes/m35-events.routes.ts:684` — TS2448: Block-scoped variable 'rentGrowthAttributions' used before its declaration.
- `src/routes/m35-events.routes.ts:692` — TS2448: Block-scoped variable 'rentGrowthAttributions' used before its declaration.
- ... and 4 more

**Fix:** Move the variable declaration above its first use, or rename the shadowed variable.

### Type Mismatch: Object literal has unknown property
**Count:** 7 | **Complexity:** small

- `src/routes/m35-connectors.routes.ts:303` — TS2353: Object literal may only specify known properties, and 'status' does not exist in type 'CreateEventIn...
- `src/services/deterministic/deterministic-model-runner.ts:996` — TS2353: Object literal may only specify known properties, and 'effectiveVacancy' does not exist in type 'Mon...
- `src/services/deterministic/proforma-assumptions-bridge.ts:425` — TS2353: Object literal may only specify known properties, and 'underwritingVacancyFloor' does not exist in t...
- ... and 4 more

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type 'string | number | boolean' is not assignable to type '
**Count:** 7 | **Complexity:** small

- `src/services/proforma-adjustment.service.ts:6023` — TS2322: Type 'string | number | boolean' is not assignable to type 'string | number'.
- `src/services/proforma-adjustment.service.ts:6078` — TS2322: Type 'string | number | boolean' is not assignable to type 'string | number'.
- `src/services/proforma-adjustment.service.ts:6104` — TS2322: Type 'string | number | boolean' is not assignable to type 'string | number'.
- ... and 4 more

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Type Mismatch: global.Express.Multer type missing
**Count:** 6 | **Complexity:** small

- `src/api/rest/archive.routes.ts:778` — TS2694: Namespace 'global.Express' has no exported member 'Multer'.
- `src/api/rest/archive.routes.ts:1426` — TS2694: Namespace 'global.Express' has no exported member 'Multer'.
- `src/api/rest/bulk-upload.routes.ts:111` — TS2694: Namespace 'global.Express' has no exported member 'Multer'.
- ... and 3 more

**Fix:** Add `@types/multer` to devDependencies and ensure `express.d.ts` augments `Express.Request` with `file`/`files`. Or add a local type declaration: `interface Request { file?: Multer.File; files?: Multer.File[] }`.

### Syntax Error: Duplicate property in object literal
**Count:** 5 | **Complexity:** small

- `src/services/agents/deal-structuring.service.ts:380` — TS1117: An object literal cannot have multiple properties with the same name.
- `src/services/agents/deal-structuring.service.ts:381` — TS1117: An object literal cannot have multiple properties with the same name.
- `src/services/building-profiles/building-profile.service.ts:153` — TS1117: An object literal cannot have multiple properties with the same name.
- ... and 2 more

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Arity Mismatch: Function called with wrong number of arguments
**Count:** 5 | **Complexity:** small

- `src/services/design/design-massing.service.ts:63` — TS2554: Expected 2 arguments, but got 1.
- `src/services/design/design-massing.service.ts:83` — TS2554: Expected 2 arguments, but got 1.
- `src/services/knowledge-graph/kg-deal-ingestion.routes.ts:31` — TS2554: Expected 2-3 arguments, but got 1.
- ... and 2 more

**Fix:** Pass required additional args, or check function signature.

### Type Mismatch: Missing required properties
**Count:** 3 | **Complexity:** small

- `src/agents/research.config.ts:98` — TS2741: Property 'outputSchema' is missing in type '{ name: string; description: string; inputSchema: ZodObj...
- `src/services/ai/aiService.ts:28` — TS2741: Property 'basic' is missing in type '{ scout: { research: string; zoning: string; supply: string; ca...
- `src/services/traffic-data-sources.service.ts:526` — TS2741: Property 'state' is missing in type '{ property_id: any; primary_adt_station_id: any; primary_adt: a...

**Fix:** Add missing fields to object literals, or make fields optional in the target type.

### Other: Type '{ name: string; description: string; inputSchema: z.Zo
**Count:** 3 | **Complexity:** small

- `src/agents/research.config.ts:101` — TS2322: Type '{ name: string; description: string; inputSchema: z.ZodObject<{ deal_name: z.ZodString; addres...
- `src/agents/research.config.ts:103` — TS2322: Type '{ name: string; description: string; inputSchema: z.ZodObject<{ address: z.ZodOptional<z.ZodSt...
- `src/agents/research.config.ts:105` — TS2322: Type '{ name: string; description: string; inputSchema: z.ZodObject<{ content_base64: z.ZodString; f...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Type Mismatch: "left" not assignable to alignment union
**Count:** 3 | **Complexity:** small

- `src/api/rest/capsule-sharing.routes.ts:645` — TS2322: Type '"left"' is not assignable to type '"right" | "center"'.
- `src/api/rest/capsule-sharing.routes.ts:2297` — TS2322: Type '"left"' is not assignable to type '"right" | "center"'.
- `src/api/rest/capsule-sharing.routes.ts:2607` — TS2322: Type '"left"' is not assignable to type '"right" | "center"'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Type Mismatch: QueryResult not assignable to Record
**Count:** 3 | **Complexity:** small

- `src/api/rest/investor-capital.routes.ts:102` — TS2345: Argument of type 'QueryResult<any>' is not assignable to parameter of type 'Record<string, unknown>'...
- `src/api/rest/investor-capital.routes.ts:116` — TS2345: Argument of type 'QueryResult<any>' is not assignable to parameter of type 'Record<string, unknown>'...
- `src/api/rest/investor-capital.routes.ts:142` — TS2345: Argument of type 'QueryResult<any>' is not assignable to parameter of type 'Record<string, unknown>'...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type '"warning" | SignalSeverity' is not assignable to type 
**Count:** 3 | **Complexity:** small

- `src/services/deal-completeness/signal-registry.ts:203` — TS2322: Type '"warning" | SignalSeverity' is not assignable to type 'SignalSeverity'.
- `src/services/deal-completeness/signal-registry.ts:249` — TS2322: Type '"warning" | SignalSeverity' is not assignable to type 'SignalSeverity'.
- `src/services/deal-completeness/signal-registry.ts:371` — TS2322: Type '"warning" | SignalSeverity' is not assignable to type 'SignalSeverity'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Missing Type: ProvenancedValue type not imported
**Count:** 3 | **Complexity:** small

- `src/services/financial-model-engine.service.ts:590` — TS2304: Cannot find name 'ProvenancedValue'.
- `src/services/financial-model-engine.service.ts:603` — TS2304: Cannot find name 'ProvenancedValue'.
- `src/services/financial-model-engine.service.ts:616` — TS2304: Cannot find name 'ProvenancedValue'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Syntax Error: Shorthand property without value in scope
**Count:** 2 | **Complexity:** small

- `src/api/rest/email.routes.ts:260` — TS18004: No value exists in scope for the shorthand property 'query'. Either declare one or provide an initia...
- `src/api/rest/financial-documents.routes.ts:18` — TS18004: No value exists in scope for the shorthand property 'query'. Either declare one or provide an initia...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Export Mismatch: Module declares but does not export symbol
**Count:** 2 | **Complexity:** small

- `src/routes/m35-events.routes.ts:54` — TS2459: Module '"../services/m35-playbook.service"' declares 'classifyMsaTier' locally, but it is not export...
- `src/services/proforma/event-deltas.service.ts:29` — TS2459: Module '"../m35-playbook.service"' declares 'classifyMsaTier' locally, but it is not exported.

**Fix:** Add `export` keyword to `classifyMsaTier` in the source module.

### Version Mismatch: ZodError.errors property missing (v3/v4 API change)
**Count:** 2 | **Complexity:** small

- `src/services/design/design-massing.service.ts:107` — TS2339: Property 'errors' does not exist on type 'ZodError<unknown>'.
- `src/services/skills/skill-registry.ts:104` — TS2339: Property 'errors' does not exist on type 'ZodError<unknown>'.

**Fix:** Zod v4 changed `error.errors` to `error.issues`. Update `error.errors.map(...)` to `(error as any).issues?.map(...)` or use `// @ts-expect-error`.

### Other: Type 'string' is not assignable to type 'number'.
**Count:** 2 | **Complexity:** small

- `src/services/document-extraction/vendor-registry/costar.vendor.ts:201` — TS2322: Type 'string' is not assignable to type 'number'.
- `src/services/document-extraction/vendor-registry/costar.vendor.ts:264` — TS2322: Type 'string' is not assignable to type 'number'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ type: "Event"; externalId: string; name:
**Count:** 2 | **Complexity:** small

- `src/services/gmail-sync.service.ts:786` — TS2345: Argument of type '{ type: "Event"; externalId: string; name: string; properties: { eventType: string...
- `src/services/neural-network/graph-ingestion-listener.ts:296` — TS2345: Argument of type '{ type: "Event"; externalId: string; name: any; properties: { eventType: string; u...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '"ZoningProfile"' is not assignable to para
**Count:** 2 | **Complexity:** small

- `src/services/knowledge-graph/kg-deal-context.service.ts:169` — TS2345: Argument of type '"ZoningProfile"' is not assignable to parameter of type 'NodeType'.
- `src/services/knowledge-graph/kg-deal-listener.service.ts:320` — TS2345: Argument of type '"ZoningProfile"' is not assignable to parameter of type 'NodeType'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ type: "Document"; externalId: string; na
**Count:** 2 | **Complexity:** small

- `src/services/neural-network/graph-ingestion-listener.ts:365` — TS2345: Argument of type '{ type: "Document"; externalId: string; name: string; properties: { documentType: ...
- `src/services/news/newsletter-parser.service.ts:338` — TS2345: Argument of type '{ type: "Document"; externalId: string; name: string; properties: { documentType: ...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type 'string' is not assignable to type 'GraphNode'.
**Count:** 2 | **Complexity:** small

- `src/services/neural-network/knowledge-graph.service.ts:865` — TS2322: Type 'string' is not assignable to type 'GraphNode'.
- `src/services/neural-network/knowledge-graph.service.ts:911` — TS2322: Type 'string' is not assignable to type 'GraphNode'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ dealType?: string; strategy?: string; }'
**Count:** 2 | **Complexity:** small

- `src/services/opus.service.ts:492` — TS2345: Argument of type '{ dealType?: string; strategy?: string; }' is not assignable to parameter of type ...
- `src/services/opus.service.ts:942` — TS2345: Argument of type '{ dealType?: string; strategy?: string; }' is not assignable to parameter of type ...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Version Mismatch: Zod v4 $ZodType vs ZodType incompatibility
**Count:** 2 | **Complexity:** small

- `src/services/skills/skill-registry.ts:147` — TS2345: Argument of type '$ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>' is not assignable...
- `src/services/skills/skill-registry.ts:153` — TS2345: Argument of type '$ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>' is not assignable...

**Fix:** The project has both Zod v3 and v4 installed. skill-registry.ts uses `z.ZodType` from v3 but receives `$ZodType` from v4. Either lock to one version, or use `z.any()` as workaround. **Rabbit hole:** yes — recommend `// @ts-expect-error` around the ZodType assignments until a single Zod version is enforced.

### Other: Type 'string' is not assignable to type 'ModelName'.
**Count:** 1 | **Complexity:** small

- `src/agents/cashflow.config.ts:719` — TS2322: Type 'string' is not assignable to type 'ModelName'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ type: "Document"; externalId: any; name:
**Count:** 1 | **Complexity:** small

- `src/api/rest/capsule.routes.ts:414` — TS2345: Argument of type '{ type: "Document"; externalId: any; name: any; properties: { documentType: any; m...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type 'Response<any, Record<string, any>>' is not assignable 
**Count:** 1 | **Complexity:** small

- `src/api/rest/financial-documents.routes.ts:19` — TS2322: Type 'Response<any, Record<string, any>>' is not assignable to type 'boolean'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type 'Request<ParamsDictionary, any, any, Parsed
**Count:** 1 | **Complexity:** small

- `src/index.replit.ts:294` — TS2345: Argument of type 'Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>' is not assigna...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type 'JsonifyObject<{ errors?: string[]; durationMs?: number
**Count:** 1 | **Complexity:** small

- `src/inngest/functions/m35-connectors-nightly.ts:51` — TS2322: Type 'JsonifyObject<{ errors?: string[]; durationMs?: number; connector?: string; recordsScanned?: n...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ id: any; name: any; category: any; subty
**Count:** 1 | **Complexity:** small

- `src/routes/m35-events.routes.ts:656` — TS2345: Argument of type '{ id: any; name: any; category: any; subtype: any; status: any; lat: number; lng: ...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Cannot find name 'options'. Did you mean 'Option'?
**Count:** 1 | **Complexity:** small

- `src/services/ai/aiService.ts:355` — TS2552: Cannot find name 'options'. Did you mean 'Option'?

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Type Mismatch: "input" resolution not in PeriodLayeredValue union
**Count:** 1 | **Complexity:** small

- `src/services/custom-metrics/derivation.service.ts:177` — TS2322: Type '{ periodIndex: number; month: string; resolved: number; resolution: "input"; source: string; z...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type 'string' is not assignable to type '"agent" | "platform
**Count:** 1 | **Complexity:** small

- `src/services/custom-metrics/derivation.service.ts:210` — TS2322: Type 'string' is not assignable to type '"agent" | "platform_default" | "computed" | "actual" | "der...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type '{ id: string; severity: SignalSeverity; title: string;
**Count:** 1 | **Complexity:** small

- `src/services/deal-completeness/signal-registry.ts:163` — TS2322: Type '{ id: string; severity: SignalSeverity; title: string; description: string; recommendedAction:...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type '"warning"' is not assignable to type 'SignalSeverity'.
**Count:** 1 | **Complexity:** small

- `src/services/deal-completeness/signal-registry.ts:339` — TS2322: Type '"warning"' is not assignable to type 'SignalSeverity'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type '{ provenance: string; amortizationYears: number; rateT
**Count:** 1 | **Complexity:** small

- `src/services/debt-advisor/rulesets/amort-profile.ruleset.ts:41` — TS2322: Type '{ provenance: string; amortizationYears: number; rateType: string; ioPeriodMonths: number; amo...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type '"weekly_update"' is not assignable to type '"supply" |
**Count:** 1 | **Complexity:** small

- `src/services/discovery/scheduled-discovery.ts:374` — TS2322: Type '"weekly_update"' is not assignable to type '"supply" | "cap_rates" | "rents" | "rates"'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Type Mismatch: Conversion may be a mistake
**Count:** 1 | **Complexity:** small

- `src/services/document-extraction/data-router.ts:1135` — TS2352: Conversion of type 'OMBrokerProforma' to type 'Record<string, unknown>' may be a mistake because nei...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: This expression is not callable.
**Count:** 1 | **Complexity:** small

- `src/services/document-extraction/parsers/costar-parser.ts:427` — TS2349: This expression is not callable.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Type Mismatch: Property does not exist in type (suggestion available)
**Count:** 1 | **Complexity:** small

- `src/services/document-extraction/parsers/leasing-stats-parser.ts:754` — TS2561: Object literal may only specify known properties, but 'floorPlan' does not exist in type 'LeasingSta...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type '"default" | "state_profile"' is not assignable to type
**Count:** 1 | **Complexity:** small

- `src/services/dot-temporal-profiles.service.ts:275` — TS2322: Type '"default" | "state_profile"' is not assignable to type '"default" | "fdot_profile"'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Type Mismatch: GraphNode requires id property
**Count:** 1 | **Complexity:** small

- `src/services/gmail-sync.service.ts:767` — TS2345: Argument of type '{ type: "Event"; externalId: string; name: string; properties: { eventType: string...

**Fix:** The `kg.upsertNode` expects `id` on the node object, but callers omit it. Either add `id` to every call, or make `id` optional in the `Omit<GraphNode, ...>` type. **Rabbit hole:** moderate — touches 10+ call sites.

### Other: Argument of type '"full" | "standard" | "light"' is not assi
**Count:** 1 | **Complexity:** small

- `src/services/inflation/replacement-cost.service.ts:617` — TS2345: Argument of type '"full" | "standard" | "light"' is not assignable to parameter of type '"standard" ...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '"complete" | "awaiting_review"' is not ass
**Count:** 1 | **Complexity:** small

- `src/services/intake-orchestrator/worker.ts:1136` — TS2345: Argument of type '"complete" | "awaiting_review"' is not assignable to parameter of type 'IntakeJobS...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type 'ZoningPrecedent[]' is not assignable to type '{ zoneCo
**Count:** 1 | **Complexity:** small

- `src/services/knowledge-graph/kg-deal-context.service.ts:130` — TS2322: Type 'ZoningPrecedent[]' is not assignable to type '{ zoneCode: string; jurisdiction: string; dimens...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type '"ZoningProfile"' is not assignable to type 'NodeType'.
**Count:** 1 | **Complexity:** small

- `src/services/knowledge-graph/kg-deal-listener.service.ts:114` — TS2322: Type '"ZoningProfile"' is not assignable to type 'NodeType'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type '"ProgramTarget"' is not assignable to type 'NodeType'.
**Count:** 1 | **Complexity:** small

- `src/services/knowledge-graph/kg-deal-listener.service.ts:228` — TS2322: Type '"ProgramTarget"' is not assignable to type 'NodeType'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Type '"AmenityFeature"' is not assignable to type 'NodeType'
**Count:** 1 | **Complexity:** small

- `src/services/knowledge-graph/kg-deal-listener.service.ts:257` — TS2322: Type '"AmenityFeature"' is not assignable to type 'NodeType'.

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Type Mismatch: Missing properties in type
**Count:** 1 | **Complexity:** small

- `src/services/neural-network/data-matrix.service.ts:812` — TS2739: Type '{ similarDealsCount: number; avgCapRate: number; avgIrr: number; avgHoldPeriod: number; source...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ type: "Property"; externalId: string; na
**Count:** 1 | **Complexity:** small

- `src/services/neural-network/graph-ingestion-listener.ts:89` — TS2345: Argument of type '{ type: "Property"; externalId: string; name: any; properties: { address: any; cit...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ type: "Deal"; externalId: string; name: 
**Count:** 1 | **Complexity:** small

- `src/services/neural-network/graph-ingestion-listener.ts:167` — TS2345: Argument of type '{ type: "Deal"; externalId: string; name: any; properties: { stage: any; status: a...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ type: "Sale"; externalId: string; name: 
**Count:** 1 | **Complexity:** small

- `src/services/neural-network/graph-ingestion-listener.ts:206` — TS2345: Argument of type '{ type: "Sale"; externalId: string; name: string; properties: { salePrice: any; sa...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ type: "Permit"; externalId: string; name
**Count:** 1 | **Complexity:** small

- `src/services/neural-network/graph-ingestion-listener.ts:259` — TS2345: Argument of type '{ type: "Permit"; externalId: string; name: string; properties: { permitNumber: an...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ type: "BrokerNarrative"; externalId: str
**Count:** 1 | **Complexity:** small

- `src/services/neural-network/graph-ingestion-listener.ts:388` — TS2345: Argument of type '{ type: "BrokerNarrative"; externalId: string; name: string; properties: { source:...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ type: "RentComp"; externalId: string; na
**Count:** 1 | **Complexity:** small

- `src/services/neural-network/graph-ingestion-listener.ts:444` — TS2345: Argument of type '{ type: "RentComp"; externalId: string; name: string; properties: { rent: any; ren...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Other: Argument of type '{ type: "ExpenseBenchmark"; externalId: st
**Count:** 1 | **Complexity:** small

- `src/services/neural-network/graph-ingestion-listener.ts:544` — TS2345: Argument of type '{ type: "ExpenseBenchmark"; externalId: string; name: string; properties: { expens...

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Type Mismatch: Property access on unknown/union type
**Count:** 54 | **Complexity:** moderate

- `src/api/rest/admin-api-key.routes.ts:296` — TS2339: Property 'ingestBuildingPermits' does not exist on type 'typeof import("C:/Users/Leons' Computer 2/O...
- `src/api/rest/admin.routes.ts:1300` — TS2339: Property 'ingestBuildingPermits' does not exist on type 'typeof import("C:/Users/Leons' Computer 2/O...
- `src/api/rest/capital-structure.routes.ts:514` — TS2339: Property 'purchasePrice' does not exist on type '{}'.
- ... and 51 more

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

### Type Mismatch: QueryResult property access (unknown shape)
**Count:** 22 | **Complexity:** moderate

- `src/api/rest/deal-assumptions.routes.ts:309` — TS2339: Property 'target_units' does not exist on type 'QueryResult<any>'.
- `src/api/rest/deal-assumptions.routes.ts:365` — TS2339: Property 'target_units' does not exist on type 'QueryResult<any>'.
- `src/api/rest/deal-assumptions.routes.ts:399` — TS2339: Property 'property_id' does not exist on type 'QueryResult<any>'.
- ... and 19 more

**Fix:** Apply the minimal type-correct change for the specific error site. If the root cause spans multiple files, flag for `// @ts-expect-error`.

## Execution Order Recommendation

| Priority | Category | Files | Complexity | Action |
|----------|----------|-------|------------|--------|
| P1 | Missing Import: pool not imported from database/connecti | 2 | trivial | Fix directly |
| P1 | Logic Error: Comparison of non-overlapping types | 2 | trivial | Fix directly |
| P1 | Module Resolution: pino types missing in sigma modules | 8 | trivial | Fix directly |
| P1 | Missing Import: dealCheck middleware not imported | 3 | trivial | Fix directly |
| P1 | Missing Variable: user_id variable undefined | 1 | trivial | Fix directly |
| P1 | Missing Import: assertDealOrgAccess not imported | 1 | trivial | Fix directly |
| P1 | Missing Variable: sc2/sp2 variables undefined | 1 | trivial | Fix directly |
| P1 | Missing Variable: rows variable undefined | 1 | trivial | Fix directly |
| P1 | Module Resolution: rss-parser types missing | 2 | trivial | Fix directly |
| P1 | Module Resolution: Missing proforma-blueprint module | 1 | trivial | Fix directly |
| P1 | Missing Variable: field variable undefined | 1 | trivial | Fix directly |
| P1 | Missing Import: StubMeteringAdapter not imported | 1 | trivial | Fix directly |
| P1 | Import Mismatch: pool import mismatch (named vs default) | 1 | trivial | Fix directly |
| P1 | Unused Directive: @ts-expect-error with no error to suppre | 1 | trivial | Fix directly |
| P1 | Missing Import: ownerCheck middleware not imported | 1 | trivial | Fix directly |
| P1 | Missing Import: buildHeuristicSigma not imported | 1 | trivial | Fix directly |
| P1 | Missing Import: createHash not imported from crypto | 1 | trivial | Fix directly |
| P1 | Missing Variable: totalUnits variable undefined | 1 | trivial | Fix directly |
| P1 | Module Resolution: Missing platform-hooks module | 1 | trivial | Fix directly |
| P1 | Logic Error: Expression is never nullish | 1 | trivial | Fix directly |
| P1 | Module Resolution: Missing lifecycle module import | 1 | trivial | Fix directly |
| P2 | Type Mismatch: Express Request missing file property (M | 15 | small | Fix directly |
| P2 | Generic Mismatch: dbQuery/generic function no longer accep | 13 | small | Fix directly |
| P2 | Naming Mismatch: Snake_case vs camelCase property mismatc | 4 | small | Fix directly |
| P2 | Type Mismatch: string not assignable to number | 13 | small | Fix directly |
| P2 | Scope Error: Block-scoped variable used before declar | 3 | small | Fix directly |
| P2 | Type Mismatch: Object literal has unknown property | 5 | small | Fix directly |
| P2 | Other: Type 'string | number | boolean' is not  | 1 | small | Fix directly |
| P2 | Type Mismatch: global.Express.Multer type missing | 5 | small | Fix directly |
| P2 | Syntax Error: Duplicate property in object literal | 4 | small | Fix directly |
| P2 | Arity Mismatch: Function called with wrong number of arg | 2 | small | Fix directly |
| P2 | Type Mismatch: Missing required properties | 3 | small | Fix directly |
| P2 | Other: Type '{ name: string; description: strin | 1 | small | Fix directly |
| P2 | Type Mismatch: "left" not assignable to alignment union | 1 | small | Fix directly |
| P2 | Type Mismatch: QueryResult not assignable to Record | 1 | small | Fix directly |
| P2 | Other: Type '"warning" | SignalSeverity' is not | 1 | small | Fix directly |
| P2 | Missing Type: ProvenancedValue type not imported | 1 | small | Fix directly |
| P2 | Syntax Error: Shorthand property without value in scop | 2 | small | Fix directly |
| P2 | Export Mismatch: Module declares but does not export symb | 2 | small | Fix directly |
| P2 | Version Mismatch: ZodError.errors property missing (v3/v4  | 2 | small | Fix directly |
| P2 | Other: Type 'string' is not assignable to type  | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ type: "Event"; exter | 2 | small | Fix directly |
| P2 | Other: Argument of type '"ZoningProfile"' is no | 2 | small | Fix directly |
| P2 | Other: Argument of type '{ type: "Document"; ex | 2 | small | Fix directly |
| P2 | Other: Type 'string' is not assignable to type  | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ dealType?: string; s | 1 | small | Fix directly |
| P2 | Version Mismatch: Zod v4 $ZodType vs ZodType incompatibili | 1 | small | Fix directly |
| P2 | Other: Type 'string' is not assignable to type  | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ type: "Document"; ex | 1 | small | Fix directly |
| P2 | Other: Type 'Response<any, Record<string, any>> | 1 | small | Fix directly |
| P2 | Other: Argument of type 'Request<ParamsDictiona | 1 | small | Fix directly |
| P2 | Other: Type 'JsonifyObject<{ errors?: string[]; | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ id: any; name: any;  | 1 | small | Fix directly |
| P2 | Other: Cannot find name 'options'. Did you mean | 1 | small | Fix directly |
| P2 | Type Mismatch: "input" resolution not in PeriodLayeredV | 1 | small | Fix directly |
| P2 | Other: Type 'string' is not assignable to type  | 1 | small | Fix directly |
| P2 | Other: Type '{ id: string; severity: SignalSeve | 1 | small | Fix directly |
| P2 | Other: Type '"warning"' is not assignable to ty | 1 | small | Fix directly |
| P2 | Other: Type '{ provenance: string; amortization | 1 | small | Fix directly |
| P2 | Other: Type '"weekly_update"' is not assignable | 1 | small | Fix directly |
| P2 | Type Mismatch: Conversion may be a mistake | 1 | small | Fix directly |
| P2 | Other: This expression is not callable. | 1 | small | Fix directly |
| P2 | Type Mismatch: Property does not exist in type (suggest | 1 | small | Fix directly |
| P2 | Other: Type '"default" | "state_profile"' is no | 1 | small | Fix directly |
| P2 | Type Mismatch: GraphNode requires id property | 1 | small | Fix directly |
| P2 | Other: Argument of type '"full" | "standard" |  | 1 | small | Fix directly |
| P2 | Other: Argument of type '"complete" | "awaiting | 1 | small | Fix directly |
| P2 | Other: Type 'ZoningPrecedent[]' is not assignab | 1 | small | Fix directly |
| P2 | Other: Type '"ZoningProfile"' is not assignable | 1 | small | Fix directly |
| P2 | Other: Type '"ProgramTarget"' is not assignable | 1 | small | Fix directly |
| P2 | Other: Type '"AmenityFeature"' is not assignabl | 1 | small | Fix directly |
| P2 | Type Mismatch: Missing properties in type | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ type: "Property"; ex | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ type: "Deal"; extern | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ type: "Sale"; extern | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ type: "Permit"; exte | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ type: "BrokerNarrati | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ type: "RentComp"; ex | 1 | small | Fix directly |
| P2 | Other: Argument of type '{ type: "ExpenseBenchm | 1 | small | Fix directly |
| P3 | Type Mismatch: Property access on unknown/union type | 17 | moderate | Batch fix |
| P3 | Type Mismatch: QueryResult property access (unknown sha | 2 | moderate | Batch fix |

## Deep Rabbit Holes (Flagged)

The following issues should get `// @ts-expect-error` annotations as a temporary measure rather than full fixes:

1. **Zod v3/v4 version mismatch** in `skill-registry.ts` — Two incompatible Zod versions are installed. `$ZodType` (v4) ≠ `ZodType` (v3). A full fix requires unifying on one Zod version and updating all schemas.
2. **GraphNode `id` required across 10+ call sites** — `kg.upsertNode` callers omit `id`, but the type requires it. Either refactor the type (moderate) or add IDs everywhere (large).
3. **Missing `lifecycle/transition-guard.service`** — Module doesn't exist. Stub or implement.
4. **Missing `proforma-blueprint` module** — Two imports in `proforma-adjustment.service.ts` reference a non-existent module.

## Target Module Focus (sigma / property-enrichment / skills)

| File | Error | Suggested Fix |
|------|-------|---------------|
| `src/services/property-enrichment/apartment-locator/sync-table.service.ts:42` | TS2558: Expected 0 type arguments, but got 1. | See pattern fix above |
| `src/services/property-enrichment/apartment-locator/sync-table.service.ts:70` | TS2558: Expected 0 type arguments, but got 1. | See pattern fix above |
| `src/services/property-enrichment/discovery/property-discovery.service.ts:380` | TS2345: Argument of type '{ type: "Property"; externalId: string; name: string... | See pattern fix above |
| `src/services/property-enrichment/discovery/property-discovery.service.ts:503` | TS2558: Expected 0 type arguments, but got 1. | See pattern fix above |
| `src/services/property-enrichment/discovery/property-discovery.service.ts:506` | TS2558: Expected 0 type arguments, but got 1. | See pattern fix above |
| `src/services/property-enrichment/discovery/property-discovery.service.ts:515` | TS2558: Expected 0 type arguments, but got 1. | See pattern fix above |
| `src/services/property-enrichment/discovery/property-discovery.service.ts:520` | TS2558: Expected 0 type arguments, but got 1. | See pattern fix above |
| `src/services/property-enrichment/discovery/property-discovery.service.ts:524` | TS2558: Expected 0 type arguments, but got 1. | See pattern fix above |
| `src/services/property-enrichment/property-info/base-provider.ts:33` | TS2558: Expected 0 type arguments, but got 1. | See pattern fix above |
| `src/services/sigma/analog-engine.ts:18` | TS2307: Cannot find module 'pino' or its corresponding type declarations. | See pattern fix above |
| `src/services/sigma/analog-engine.ts:578` | TS2339: Property 'eventId' does not exist on type '{ eventId?: string; } | { h... | See pattern fix above |
| `src/services/sigma/calibration-ledger.ts:19` | TS2307: Cannot find module 'pino' or its corresponding type declarations. | See pattern fix above |
| `src/services/sigma/causal-discipline-engine.ts:19` | TS2307: Cannot find module 'pino' or its corresponding type declarations. | See pattern fix above |
| `src/services/sigma/factor-estimator.ts:21` | TS2307: Cannot find module 'pino' or its corresponding type declarations. | See pattern fix above |
| `src/services/sigma/hmm-regime-classifier.ts:18` | TS2307: Cannot find module 'pino' or its corresponding type declarations. | See pattern fix above |
| `src/services/sigma/multi-tier-factor.ts:20` | TS2307: Cannot find module 'pino' or its corresponding type declarations. | See pattern fix above |
| `src/services/sigma/peer-characters-seed.ts:428` | TS2345: Argument of type '{ seeded: number; }' is not assignable to parameter ... | See pattern fix above |
| `src/services/sigma/peer-characters-seed.ts:440` | TS2345: Argument of type '{ loaded: number; seeded: number; }' is not assignab... | See pattern fix above |
| `src/services/sigma/peer-intelligence.ts:19` | TS2307: Cannot find module 'pino' or its corresponding type declarations. | See pattern fix above |
| `src/services/sigma/sigma-apply-deal.ts:326` | TS2367: This comparison appears to be unintentional because the types 'string'... | See pattern fix above |
| `src/services/sigma/spatial-kernel.ts:22` | TS2307: Cannot find module 'pino' or its corresponding type declarations. | See pattern fix above |
| `src/services/skills/skill-registry.ts:104` | TS2339: Property 'errors' does not exist on type 'ZodError<unknown>'. | See pattern fix above |
| `src/services/skills/skill-registry.ts:147` | TS2345: Argument of type '$ZodType<unknown, unknown, $ZodTypeInternals<unknown... | See pattern fix above |
| `src/services/skills/skill-registry.ts:153` | TS2345: Argument of type '$ZodType<unknown, unknown, $ZodTypeInternals<unknown... | See pattern fix above |
| `src/services/skills/skills/index.ts:548` | TS2307: Cannot find module '../../../lifecycle/transition-guard.service' or it... | See pattern fix above |