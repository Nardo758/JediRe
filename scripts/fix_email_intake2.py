import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

# The previous replacement didn't match; do it more surgically.
# Replace just the step.run('create-draft-deal') block

old_block = """    // ── Step 9: Create draft deal ────────────────────────────────────────
    const draft = await step.run('create-draft-deal', async () => {
      return createDealDraft(fields, user_id, {
        gmail_message_id: message_id,
        from_address,
        classification_confidence: classification.confidence,
        asset_class_hint: classification.asset_class_hint,
        fit_score: fitScore.fit_score,
        fit_breakdown: fitScore.fit_breakdown,
      });
    });"""

new_block = """    // ── Step 9: Create draft deal ────────────────────────────────────────
    const stamp = stampProvenance({
      ingestionSource: 'email_intake',
      userId: user_id,
      rawSourceRef: message_id,
      documentSource: 'email',
    });
    const draft = await step.run('create-draft-deal', async () => {
      return createDealDraft(fields, user_id, {
        gmail_message_id: message_id,
        from_address,
        classification_confidence: classification.confidence,
        asset_class_hint: classification.asset_class_hint,
        fit_score: fitScore.fit_score,
        fit_breakdown: fitScore.fit_breakdown,
      }, stamp);
    });"""

if old_block not in content:
    print('WARNING: old_block not found, nothing changed for create-draft-deal')
else:
    content = content.replace(old_block, new_block)
    print('create-draft-deal block replaced')

with open(path, 'w') as f:
    f.write(content)
