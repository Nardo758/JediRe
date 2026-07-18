import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

# Fix 1: /ingest-rows UPDATE — remove unconditional scope_id/redistribution_restricted overwrite
old1 = """        const assignments: string[] = ['source_signals = $1', 'scope_id = $2', 'redistribution_restricted = $3', 'updated_at = NOW()'];
        const params: unknown[] = [mergedSignals, 'GLOBAL', false];
        let idx = params.length;"""
new1 = """        const assignments: string[] = ['source_signals = $1', 'updated_at = NOW()'];
        const params: unknown[] = [mergedSignals];
        let idx = params.length;"""
content = content.replace(old1, new1)

# Fix 2: /parse-om UPDATE — remove unconditional scope_id/redistribution_restricted overwrite
old2 = """        await pool.query(
          `UPDATE historical_observations
           SET property_year_built = $1,
               source_signals = array(SELECT DISTINCT unnest(source_signals || ARRAY['om'])),
               scope_id = 'GLOBAL',
               redistribution_restricted = FALSE,
               updated_at = NOW()
           WHERE id = $2`,
          [yearBuilt, existing.rows[0].id],
        );"""
new2 = """        await pool.query(
          `UPDATE historical_observations
           SET property_year_built = $1,
               source_signals = array(SELECT DISTINCT unnest(source_signals || ARRAY['om'])),
               updated_at = NOW()
           WHERE id = $2`,
          [yearBuilt, existing.rows[0].id],
        );"""
content = content.replace(old2, new2)

with open(path, 'w') as f:
    f.write(content)

print('Done')
