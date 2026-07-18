import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

# 1. Fix stale comment: awaiting_review -> PROSPECT
content = content.replace(
    "Step 9: Create draft deal (status = awaiting_review, source = email_intake)",
    "Step 9: Create draft deal (status = PROSPECT, source = email_intake)"
)

# 2. Add stampProvenance import after createDealDraft import
old_import = "import { createDealDraft } from '../../agents/tools/create_deal_draft';"
new_import = old_import + "\nimport { stampProvenance } from '../../utils/provenance-stamp';"
content = content.replace(old_import, new_import)

# 3. Update createDealDraft call to pass a stamp
old_call = """    // ── Step 9: Create draft deal ────────────────────────────────────────
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

new_call = """    // ── Step 9: Create draft deal ────────────────────────────────────────
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

content = content.replace(old_call, new_call)

with open(path, 'w') as f:
    f.write(content)

print('Done')
