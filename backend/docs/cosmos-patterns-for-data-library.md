# Cosmos Curator Patterns → JediRe Data Library

## What Cosmos Does (for Video)

| Step | Tool | What It Produces |
|---|---|---|
| Split | TransNetV2 | Long video → semantic clips |
| Embed | Cosmos-Embed1-336p | Per-clip embedding vectors |
| Caption | Qwen2.5-7B-VLM / Cosmos-Reason1-7B | Text description per clip |
| Cluster | Time Series K-Means (Soft-DTW) | Group clips by behavioral similarity |
| Filter | Distance thresholding | Outlier detection (bad clips) |
| Shard | WebDataset sharder | Training-ready dataset chunks |

## Pattern 1: Embedding-Based Deduplication

**Cosmos approach:** Each video clip gets an embedding vector. Clips with near-identical embeddings are flagged as duplicates.

**JediRe translation:** Each property record (from county records, OMs, Apartment Locator, Costar) gets an embedding via an embedding model. Properties with cosine similarity > 0.95 are flagged as potential duplicates.

**Implementation sketch:**
```sql
-- Store property embeddings
CREATE TABLE property_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  source VARCHAR(50),  -- 'county', 'om', 'apartment_locator', 'costar'
  embedding vector(768),  -- pgvector
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Find potential duplicates
SELECT a.property_id AS a_id, b.property_id AS b_id,
       a.source AS a_source, b.source AS b_source,
       1 - (a.embedding <=> b.embedding) AS similarity
FROM property_embeddings a
JOIN property_embeddings b ON a.id < b.id
WHERE 1 - (a.embedding <=> b.embedding) > 0.90
ORDER BY similarity DESC;
```

**Benefit:** Catches "same property, different name" cases — e.g., "Exchange at Holly Springs" vs "Holly Springs Exchange" from two data sources.

## Pattern 2: Trajectory Clustering for Deal Lifecycle

**Cosmos approach:** A video's embedding vectors across time form a "trajectory." Clustering trajectories groups semantically similar videos regardless of length.

**JediRe translation:** A deal's data points across its lifecycle (underwriting → operations → reforecast → disposition) form a trajectory. Clustering deal trajectories identifies patterns — which deals succeed/fail similarly.

**Implementation sketch:**
```python
# Each deal = sequence of state snapshots at key events
# Snapshots: {revenue, occupancy, NOI, cap_rate, expense_ratio}
# Each is an embedding derived from the snapshot vector
# Time Series K-Means clusters deals by how they evolve

from tslearn.clustering import TimeSeriesKMeans
from tslearn.metrics import soft_dtw
import numpy as np

# deal_trajectories: shape (n_deals, n_snapshots, n_metrics)
model = TimeSeriesKMeans(n_clusters=5, metric="softdtw", max_iter=50)
labels = model.fit_predict(deal_trajectories)
# Cluster 0 = "rapid growth, stable expenses"
# Cluster 1 = "declining, expense blowout"
# etc.
```

**Benefit:** When underwriting a new deal, find which trajectory cluster it most resembles → predict outcome using historical cluster performance.

## Pattern 3: Outlier Detection in Property Data

**Cosmos approach:** Compute distance of each trajectory to its cluster centroid (barycenter). Flag trajectories beyond 95th percentile as outliers.

**JediRe translation:** For each expense category (insurance, taxes, payroll, utilities), compute per-unit costs across the archive. Flag properties where any metric is >2 std deviations from the peer mean.

**Implementation sketch:**
```sql
-- Per-unit expense outliers
WITH per_unit AS (
  SELECT d.id, d.property_name, d.units,
         de.insurance_expense / d.units AS insurance_per_unit,
         de.tax_expense / d.units AS taxes_per_unit,
         de.payroll_expense / d.units AS payroll_per_unit,
         d.year_built,
         d.city,
         d.state
  FROM archive_deals d
  JOIN archive_deal_expenses de ON de.deal_id = d.id
  WHERE d.units > 0 AND d.state = 'NC'
)
SELECT property_name, units, insurance_per_unit,
       AVG(insurance_per_unit) OVER () AS peer_avg,
       STDDEV(insurance_per_unit) OVER () AS peer_std,
       CASE WHEN ABS(insurance_per_unit - AVG(insurance_per_unit) OVER ())
              > 2 * STDDEV(insurance_per_unit) OVER ()
            THEN 'OUTLIER'
            ELSE 'OK'
       END AS flag
FROM per_unit;
```

**Benefit:** Instantly spot which archive deals have anomalous expense ratios — ~3% rental real estate damage, tax appeal opportunities, over-insured properties.

## Pattern 4: Semantic Captioning for Deal Narratives

**Cosmos approach:** Each video clip gets a structured caption: "Static scene: [objects, spatial layout]. Dynamics: [actions, interactions, physics]."

**JediRe translation:** Each deal gets a structured summary generated from its numeric data: "Property: [class, vintage, units]. Market: [MSA trends, supply pipeline]. Operations: [expense ratio, NOI margin, occupancy trajectory]."

**Already implemented in:** Our Commentary agent's output — the `market_narrative`, `supply_narrative`, and `investment_thesis` sections are exactly this. The Cosmos pattern validates our approach.

## Pattern 5: Iterative Prompt Tuning with Evaluation

**Cosmos approach:** "Generate captions on 50-100 clips, manually review, identify systematic errors, adjust prompt, repeat."

**JediRe translation:** For the Cashflow agent — after each run, compare the agent's expense assumptions against the actual budget data. Build an eval loop:

1. Run agent on an archive deal with known budget
2. Compare agent's proforma vs actual budget line items
3. Score accuracy per line item
4. Identify systematic biases (e.g., "agent consistently underestimates insurance by 15%")
5. Adjust prompt or bias correction factor
6. Repeat

**Implementation sketch:**
```sql
CREATE TABLE agent_accuracy_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(50),
  deal_id UUID REFERENCES archive_deals(id),
  prompt_version VARCHAR(50),
  run_id UUID,
  line_item VARCHAR(100),
  agent_value NUMERIC(14,2),
  actual_value NUMERIC(14,2),
  error_pct NUMERIC(6,3),
  absolute_error_pct NUMERIC(6,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Running bias per line item
SELECT line_item, COUNT(*) AS n,
       AVG(error_pct) AS mean_bias_pct,
       STDDEV(error_pct) AS bias_variance
FROM agent_accuracy_scores
WHERE agent_id = 'cashflow'
GROUP BY line_item
ORDER BY ABS(AVG(error_pct)) DESC;
```

## Pattern 6: Data Quality Pipeline

**Cosmos approach:** raw_data/ → processed_data/v0/ → webdataset/
Versioned data, progressive refinement through filters.

**JediRe translation:**
```
raw_imports/                    ← County CSV dumps, OM PDFs, Costar exports
  ├── fulton_2025q1.csv
  ├── 464_bishop_om.pdf
  └── costar_raleigh_2026.csv
  ↓ (normalize + schema match)
staging/                        ← Standardized per source type
  ├── property_records/
  ├── expense_records/
  └── comp_records/
  ↓ (dedup + enrich + validate)
curated/                        ← Clean, merged, cross-referenced
  ├── properties/
  ├── archive_deals/
  └── market_data/
  ↓ (publish)
data_library/                   ← What agents query
  ├── data_library_assets
  └── data_matrix_context
```

## What We Should Build Next (Priority Order)

1. **Property embedding + dedup** (Pattern 1) — pgvector on property records, catch duplicate entries from different sources. Low effort, high impact.

2. **Agent accuracy scoring** (Pattern 5) — Capture agent predictions vs actual archive budgets. This feeds directly into the self-learning feedback loop we already started.

3. **Deal trajectory clustering** (Pattern 2) — After we have enough archive deals with lifecycle data, cluster them. Currently ~10-15 deals minimum needed for meaningful clusters.

4. **Data quality pipeline** (Pattern 6) — Formalize the staging → curated flow. Currently we import directly into production tables. A staging layer would prevent bad data propagation.

## Key Takeaway

The Cosmos Cookbook's most valuable pattern for us isn't the video models — it's the **data curation methodology**. Embedding-based dedup, trajectory clustering, outlier detection, structured captions, iterative eval cycles — these are all directly transferable to multifamily data quality and agent improvement.
