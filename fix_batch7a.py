import re

with open('backend/src/services/financial-model-engine.service.ts', 'r', encoding='utf-8') as f:
    s = f.read()

# Fix 1: m.active !== false  →  m.status === 'active'
s = s.replace("m.active !== false", "m.status === 'active'")

# Fix 2: m.methodId ?? m.label  →  m.id ?? m.label
s = s.replace("m.methodId ?? m.label", "m.id ?? m.label")

# Fix 3: m.p50 ?? null  →  m.indicatedValueP50 ?? null
s = s.replace("m.p50 ?? null", "m.indicatedValueP50 ?? null")

# Fix 4: m.p50 != null  →  m.indicatedValueP50 != null
s = s.replace("m.p50 != null", "m.indicatedValueP50 != null")

with open('backend/src/services/financial-model-engine.service.ts', 'w', encoding='utf-8') as f:
    f.write(s)

print('done')
