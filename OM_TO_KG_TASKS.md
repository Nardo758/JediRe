# OM → Knowledge Graph + Extraction Pipeline Integration

## Priority: HIGH — First, then deal creation sync

## Overview

An Offering Memorandum contains ~20 distinct intelligence signals. Currently:
- `om-distribution.service.ts` writes raw data to SQL tables (market_rent_comps, market_sale_comps, broker_narratives, etc.)
- A single `Document` node is created in the Knowledge Graph (bare minimum)
- **The constituent signals never fan out into the KG** — rent comps, sale comps, broker narratives, cap rates, expense ratios, submarket context

This means F4 Markets, context awareness, and the Supply/Research agents can't see OM-derived data through the graph.

**Goal:** Fan-out OM data into the KG as proper typed nodes with edges, so the neural network automatically uses OM data for market analysis, sentiment, and property details.

---

## Task A: Register "OM" in the Classifier + Extraction Pipeline

### A1. Add OM detection to `classifier.ts`

In the PDF branch of `classifyDocument()` (around line 120-140), after the tax bill check, add OM detection:

```
OM indicators (check text content):
  - "offering memorandum"
  - "confidentiality" + "memorandum"
  - "broker" + "investment summary"
  - "cushman & wakefield" / "colliers" / "cbre" / "jll" / "marcus & millichap"
  - "cap rate" + "noi" + "rent roll" in same doc
  - "pro forma" + "operating statement"
  - "exclusively offered by" / "exclusive listing"

Return type: 'OM' with confidence 0.6-0.85 based on signals matched
```

Also add a filename pattern:
```
/offering[\s_-]*memorandum|investment[\s_-]*summary|property[\s_-]*offering/i
```

### A2. Register OM in `extraction-pipeline.ts`

In `getParser()` function, add:
```
case 'OM': return parseOM;
```

But parseOM takes different parameters than the other parsers. Instead of calling parseOM directly in the pipeline, create a bridge function `parseOMForPipeline(buffer, filename)` that:
- Calls parseOM with minimal context
- Returns an `ExtractionResult` with the OM data
- The data-router already has `case 'OM': rowsInserted = await routeOM(...)` — this works

So in the switch:
```
case 'OM':
  return parseOMForPipeline(buffer, filename);
```

Create `parseOMForPipeline`:
```typescript
async function parseOMForPipeline(buffer: Buffer, filename: string): Promise<ExtractionResult> {
  const { parseOM } = require('./parsers/om-parser');
  const result = await parseOM(buffer, filename, 'pipeline', {
    onStageChange: async () => {},
    userId: 'pipeline',
  });
  // Map result.omPropertyData to ExtractionResult format
  return {
    documentType: 'OM',
    success: result.error ? false : true,
    error: result.error,
    data: {
      propertyName: result.omPropertyData?.name,
      units: result.omPropertyData?.units,
      yearBuilt: result.omPropertyData?.yearBuilt,
      rentableSf: result.omPropertyData?.rentableSf,
      avgUnitSf: result.omPropertyData?.avgUnitSf,
      marketRent: result.omPropertyData?.marketRent,
      occupancy: result.omPropertyData?.occupancy,
      noi: result.omPropertyData?.noi,
      capRate: result.omPropertyData?.capRate,
      expenseRatio: result.omPropertyData?.expenseRatio,
      rentRoll: result.omData?.rentRoll,
      operatingStatement: result.omData?.operatingStatement,
      unitMix: result.omData?.unitMix,
      financingData: result.omData?.financingData,
      brokerNarratives: result.omData?.brokerNarratives,
      submarketData: result.omData?.submarketData,
      developmentPipeline: result.omData?.developmentPipeline,
    },
    summary: result.summary,
    warnings: result.parsingWarnings,
  };
}
```

---

## Task B: Fan-out OM Data into Knowledge Graph

### B1. Add KG types for OM-derived data

In `knowledge-graph.service.ts`, ensure these node types are registered:

| Node Type | Description | Properties |
|-----------|-------------|------------|
| `Document` | Source OM file | documentType, fileId, msaKey, submarketKey, processedAt |
| `BrokerNarrative` | Broker-written summary | source, sentimentScore, narrative, keyPoints, marketOutlook |
| `RentComp` | Rental comparable | rent, rentPerSf, units, sf, occupancy, yearBuilt, submarket |
| `SaleComp` | Sale comparable | price, pricePerUnit, pricePerSf, capRate, saleDate, buyer, seller |
| `ExpenseBenchmark` | Expense assumptions | expenseRatio, managementFee, taxPerUnit, insurancePerUnit, rMaintPerUnit, reservePerUnit |

Edge types:
| Source | Target | Type | Properties |
|--------|--------|------|------------|
| Document | BrokerNarrative | HAS | — |
| Document | RentComp | HAS | — |
| Document | SaleComp | HAS | — |
| Document | ExpenseBenchmark | HAS | — |
| BrokerNarrative | Market | ABOUT | topic, relevance |
| BrokerNarrative | Submarket | ABOUT | topic, relevance |
| RentComp | Market | IN_MARKET | — |
| RentComp | Submarket | IN_SUBMARKET | — |
| SaleComp | Market | IN_MARKET | — |

### B2. Add `ingestOM()` method to `GraphIngestionListener`

In `graph-ingestion-listener.ts`, add a new event type `'om.processed'` and an `ingestOM()` method:

```typescript
private async ingestOM(event: EntityEvent): Promise<string> {
  const { data } = event;
  
  // 1. Create/update Document node
  const docNodeId = await this.kg.upsertNode({
    type: 'Document',
    externalId: `om-${data.fileId}`,
    name: `OM: ${data.propertyName || data.msaKey || 'unknown'}`,
    properties: {
      documentType: 'offering_memorandum',
      fileId: data.fileId,
      propertyName: data.propertyName,
      address: data.address,
      units: data.units,
      yearBuilt: data.yearBuilt,
      msaKey: data.msaKey,
      submarketKey: data.submarketKey,
      broker: data.broker,
      processedAt: new Date(),
    }
  });

  // 2. Create BrokerNarrative node
  if (data.brokerNarratives && data.brokerNarratives.length > 0) {
    for (const narrative of data.brokerNarratives) {
      const narrativeNodeId = await this.kg.upsertNode({
        type: 'BrokerNarrative',
        externalId: `bn-${data.fileId}-${narrative.id || Date.now()}`,
        name: `Narrative: ${data.propertyName || data.msaKey}`,
        properties: {
          source: narrative.source || 'om',
          sentimentScore: narrative.sentimentScore,
          narrative: narrative.text,
          keyPoints: narrative.keyPoints,
          marketOutlook: narrative.marketOutlook,
          extractedAt: new Date(),
        }
      });

      await this.kg.createEdge({
        sourceNodeId: docNodeId,
        targetNodeId: narrativeNodeId,
        edgeType: 'HAS',
        properties: {}
      });

      // Link narrative to market
      if (data.msaKey) {
        const marketNode = await this.kg.findNodeByExternalId('Market', data.msaKey);
        if (marketNode) {
          await this.kg.createEdge({
            sourceNodeId: narrativeNodeId,
            targetNodeId: marketNode.id,
            edgeType: 'ABOUT',
            properties: { topic: 'market_outlook', relevance: 0.9 }
          });
        }
      }
    }
  }

  // 3. Create RentComp nodes
  if (data.rentComps && data.rentComps.length > 0) {
    for (const comp of data.rentComps) {
      const compNodeId = await this.kg.upsertNode({
        type: 'RentComp',
        externalId: `rc-om-${data.fileId}-${comp.unitType || comp.id || Math.random().toString(36).slice(2, 8)}`,
        name: `Rent ${comp.unitType || 'comp'}: $${comp.rent}`,
        properties: {
          rent: comp.rent,
          rentPerSf: comp.rentPerSf,
          unitType: comp.unitType,
          units: comp.units,
          sqft: comp.sqft,
          occupancy: comp.occupancy,
          yearBuilt: comp.yearBuilt,
          submarket: comp.submarket,
          sourceOmFileId: data.fileId,
          extractedAt: new Date(),
        }
      });

      await this.kg.createEdge({
        sourceNodeId: docNodeId,
        targetNodeId: compNodeId,
        edgeType: 'HAS',
        properties: {}
      });

      if (data.msaKey) {
        const marketNode = await this.kg.findNodeByExternalId('Market', data.msaKey);
        if (marketNode) {
          await this.kg.createEdge({
            sourceNodeId: compNodeId,
            targetNodeId: marketNode.id,
            edgeType: 'IN_MARKET',
            properties: {}
          });
        }
      }

      if (data.submarketKey) {
        const subNode = await this.kg.findNodeByExternalId('Submarket', data.submarketKey);
        if (subNode) {
          await this.kg.createEdge({
            sourceNodeId: compNodeId,
            targetNodeId: subNode.id,
            edgeType: 'IN_SUBMARKET',
            properties: {}
          });
        }
      }
    }
  }

  // 4. Create SaleComp node (single sale comp from OM — the OM itself is a listing)
  if (data.askingPrice || data.capRate) {
    const saleNodeId = await this.kg.upsertNode({
      type: 'SaleComp',
      externalId: `sc-om-${data.fileId}`,
      name: `Listing: ${data.propertyName || 'OM property'}`,
      properties: {
        price: data.askingPrice,
        pricePerUnit: data.askingPrice && data.units ? data.askingPrice / data.units : null,
        capRate: data.capRate,
        noi: data.noi,
        units: data.units,
        yearBuilt: data.yearBuilt,
        source: 'om',
        sourceOmFileId: data.fileId,
        listingDate: data.listingDate,
        broker: data.broker,
        extractedAt: new Date(),
      }
    });

    await this.kg.createEdge({
      sourceNodeId: docNodeId,
      targetNodeId: saleNodeId,
      edgeType: 'HAS',
      properties: {}
    });

    if (data.msaKey) {
      const marketNode = await this.kg.findNodeByExternalId('Market', data.msaKey);
      if (marketNode) {
        await this.kg.createEdge({
          sourceNodeId: saleNodeId,
          targetNodeId: marketNode.id,
          edgeType: 'IN_MARKET',
          properties: {}
        });
      }
    }
  }

  // 5. Create ExpenseBenchmark node
  if (data.expenseRatio || data.expenseData) {
    const expNodeId = await this.kg.upsertNode({
      type: 'ExpenseBenchmark',
      externalId: `eb-om-${data.fileId}`,
      name: `Expenses: ${data.propertyName || 'OM property'}`,
      properties: {
        expenseRatio: data.expenseRatio,
        managementFee: data.expenseData?.managementFeePct,
        taxPerUnit: data.expenseData?.taxPerUnit,
        insurancePerUnit: data.expenseData?.insurancePerUnit,
        rMaintPerUnit: data.expenseData?.repairsPerUnit,
        reservePerUnit: data.expenseData?.reservePerUnit,
        totalExpenses: data.expenseData?.totalExpenses,
        submarket: data.submarketKey,
        sourceOmFileId: data.fileId,
        extractedAt: new Date(),
      }
    });

    await this.kg.createEdge({
      sourceNodeId: docNodeId,
      targetNodeId: expNodeId,
      edgeType: 'HAS',
      properties: {}
    });

    if (data.msaKey) {
      const marketNode = await this.kg.findNodeByExternalId('Market', data.msaKey);
      if (marketNode) {
        await this.kg.createEdge({
          sourceNodeId: expNodeId,
          targetNodeId: marketNode.id,
          edgeType: 'IN_MARKET',
          properties: {}
        });
      }
    }
  }

  return docNodeId;
}
```

### B3. Wire `ingestOM()` into `om-distribution.service.ts`

In `om-distribution.service.ts`, after the existing KG ingestion (around line 447), replace the bare-bones Document node with a full fan-out:

```typescript
// After existing distribution (rent comps, sale comps, etc. SQL inserts):

// Fan-out OM data into Knowledge Graph
try {
  const { getGraphIngestionListener } = await import('../neural-network/graph-ingestion-listener');
  const listener = getGraphIngestionListener(getPool());
  
  await listener.handleEvent({
    type: 'om.processed',
    entityType: 'Document',
    entityId: `om-${args.fileId}`,
    data: {
      fileId: args.fileId,
      propertyName: omExtraction?.propertyName,
      address: omExtraction?.address,
      units: omExtraction?.units,
      yearBuilt: omExtraction?.yearBuilt,
      msaKey: args.geo.msaKey,
      submarketKey: args.geo.submarketKey,
      broker: omExtraction?.broker,
      askingPrice: omExtraction?.askingPrice,
      capRate: omExtraction?.capRate,
      noi: omExtraction?.noi,
      expenseRatio: omExtraction?.expenseRatio,
      expenseData: omExtraction?.expenseData,
      listingDate: omExtraction?.listingDate,
      brokerNarratives: omExtraction?.brokerNarratives,
      rentComps: omExtraction?.rentComps,
      developmentPipeline: omExtraction?.developmentPipeline,
    },
    timestamp: new Date(),
    source: 'om-distribution',
  });
} catch (graphErr) {
  logger.warn('[om-distribute] KG fan-out failed (non-fatal)', { err: graphErr });
}
```

### B4. Add `'om.processed'` to EntityEventType

In `graph-ingestion-listener.ts`, add `'om.processed'` to the EntityEventType union and to the switch in `handleEvent()`:

```typescript
case 'om.processed':
  nodeId = await this.ingestOM(event);
  break;
```

---

## Task C: OM Extraction → Knowledge Graph from Creation Flow

When an OM is uploaded during deal creation (once Task A is done), the extraction pipeline calls `routeOM()` in `data-router.ts`. Currently `routeOM()` writes to the same comp tables that `om-distribution.service.ts` writes to. Ensure the fan-out also runs:

### C1. Wire KG ingestion after routeOM() in data-router.ts

In `data-router.ts`, after `routeOM()` returns (and `upsertDataLibraryAsset()` completes), add a call to the graph ingestion listener:

```typescript
// After library update, fan-out OM data to KG
if (result.documentType === 'OM') {
  try {
    const { getGraphIngestionListener } = await import('../neural-network/graph-ingestion-listener');
    const listener = getGraphIngestionListener(getPool());
    await listener.handleEvent({
      type: 'om.processed',
      entityType: 'Document',
      entityId: `om-${ctx.documentId || dealId}`,
      data: {
        fileId: ctx.documentId || dealId,
        propertyName: result.data?.propertyName,
        address: result.data?.address,
        units: result.data?.units,
        yearBuilt: result.data?.yearBuilt,
        msaKey: result.data?.msa,
        submarketKey: result.data?.submarket,
        askingPrice: result.data?.askingPrice,
        capRate: result.data?.capRate,
        noi: result.data?.noi,
        expenseRatio: result.data?.expenseRatio,
        brokerNarratives: result.data?.brokerNarratives,
        rentComps: result.data?.rentComps,
      },
      timestamp: new Date(),
      source: 'extraction-pipeline',
    });
  } catch (e) {
    // Non-fatal
  }
}
```

---

## What This Unlocks

After these 3 tasks:

1. **F4 Markets automatically uses OM data** — context awareness queries `BrokerNarrative` nodes for sentiment, `RentComp` nodes for market rents, `SaleComp` nodes for cap rates
2. **Supply agent sees OM development pipeline** — `Event` nodes with development project data get linked to submarkets
3. **Research agent sees OM broker narratives** — sentiment analysis on the `BrokerNarrative` nodes
4. **Capsule intelligence for other deals picks up OM comps** — KG traversal finds `RentComp` / `SaleComp` nodes connected to the same market
5. **Deal creation OM upload flows end-to-end** — classify → parse → route → fan-out to KG

## Implementation Order

1. Task A1 + A2 (classifier + pipeline — enable OM in deal creation flow)
2. Task B1–B4 (fan-out KG ingestion — make OM data graph-aware)
3. Task C1 (wire pipeline → KG)
4. Test: upload 464 Bishop OM through deal creation → verify KG has RentComp, SaleComp, BrokerNarrative nodes → F4 Markets shows OM-derived data

## Files to Modify

| File | Changes |
|------|---------|
| `backend/src/services/document-extraction/classifier.ts` | A1: Add OM detection |
| `backend/src/services/document-extraction/extraction-pipeline.ts` | A2: Add OM parser bridge |
| `backend/src/services/neural-network/graph-ingestion-listener.ts` | B1-B4: Add OM ingestion method + types |
| `backend/src/services/document-extraction/om-distribution.service.ts` | B3: Wire fan-out after current distribution |
| `backend/src/services/document-extraction/data-router.ts` | C1: Wire fan-out after routeOM() |
| `backend/src/services/neural-network/knowledge-graph.service.ts` | B1: Ensure types exist for new node types |
