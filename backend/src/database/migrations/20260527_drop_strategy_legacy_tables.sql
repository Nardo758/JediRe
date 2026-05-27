-- Drop legacy M08 v1 scoring tables.
-- strategy_scores and strategy_arbitrage were written by strategyArbitrage.service.ts
-- and read by the /strategy-scores and /arbitrage REST endpoints. Both have been
-- removed in favour of the v2 detection-first system (m08-strategies.service.ts,
-- strategy_analyses table). No live v2 code reads these tables.
-- Safe to drop: confirmed no foreign-key references in any other table.

DROP TABLE IF EXISTS strategy_scores;
DROP TABLE IF EXISTS strategy_arbitrage;
