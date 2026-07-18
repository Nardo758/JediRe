import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

old = """    // ── Step 9: Create draft deal ────────────────────────────────────────
    const draft = await step.run('create-draft-deal', async () => {"""

new = """    // ── Step 9: Create draft deal ────────────────────────────────────────
    const stamp = stampProvenance({
      ingestionSource: 'email_intake',
      userId: user_id,
      rawSourceRef: message_id,
      documentSource: 'email',
    });
    const draft = await step.run('create-draft-deal', async () => {"""

if old not in content:
    print('WARNING: block not found')
else:
    content = content.replace(old, new)
    print('Done')

with open(path, 'w') as f:
    f.write(content)
