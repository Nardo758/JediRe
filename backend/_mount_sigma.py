# -*- coding: utf-8 -*-
"""Mount sigma-full router in index.replit.ts"""
with open('src/index.replit.ts', 'rb') as f:
    content_bytes = f.read()

text = content_bytes.decode('utf-8')

old1 = "import sigmaRouter from './api/rest/sigma.routes';\r\nimport { designMassingRouter } from"
new1 = "import sigmaRouter from './api/rest/sigma.routes';\r\nimport sigmaFullRouter from './api/rest/sigma-full.routes';\r\nimport { designMassingRouter } from"

if old1 in text:
    text = text.replace(old1, new1)
    print("Import: OK")
else:
    print("Import: NOT FOUND")
    # Debug
    idx = text.find("sigmaRouter from")
    if idx >= 0:
        print(f"Context: {repr(text[idx-10:idx+60])}")

old2 = "app.use('/api/v1/sigma', requireAuth, sigmaRouter);\r\n\r\n"
new2 = "app.use('/api/v1/sigma', requireAuth, sigmaRouter);\r\napp.use('/api/v2/sigma', requireAuth, sigmaFullRouter);\r\n\r\n"

if old2 in text:
    text = text.replace(old2, new2)
    print("Mount: OK")
else:
    print("Mount: NOT FOUND")
    idx = text.find("app.use('/api/v1/sigma'")
    if idx >= 0:
        print(f"Context: {repr(text[idx:idx+80])}")

with open('src/index.replit.ts', 'wb') as f:
    f.write(text.encode('utf-8'))
print("Done")
