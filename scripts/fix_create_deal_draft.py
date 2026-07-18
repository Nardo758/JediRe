import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

# 1. Add provenance stamp import after autoDiscoverComps
old_import = "import { autoDiscoverComps } from '../../services/comp-set-discovery.service';"
new_import = old_import + "\nimport { stampProvenance, type ProvenanceStamp } from '../../utils/provenance-stamp';"
content = content.replace(old_import, new_import)

# 2. Update function signature to accept optional stamp
old_sig = """export async function createDealDraft(
  fields: ExtractedDealFields,
  userId: string,
  metadata: IntakeMetadata
): Promise<CreateDealDraftResult> {"""
new_sig = """export async function createDealDraft(
  fields: ExtractedDealFields,
  userId: string,
  metadata: IntakeMetadata,
  stamp?: ProvenanceStamp
): Promise<CreateDealDraftResult> {"""
content = content.replace(old_sig, new_sig)

# 3. Embed stamp into dealData
old_deal_data = """  const dealData = {
    source: 'email_intake',
    gmail_message_id: metadata.gmail_message_id,"""
new_deal_data = """  const dealData = {
    source: 'email_intake',
    _provenance: stamp ?? stampProvenance({ ingestionSource: 'email_intake', userId }),
    gmail_message_id: metadata.gmail_message_id,"""
content = content.replace(old_deal_data, new_deal_data)

# 4. Remove duplicate malformed createDealDraftTool block (lines 160-167)
old_dup = """export const createDealDraftTool = {
  name: 'create_deal_draft',
  description: `Create a PROSPECT deal draft from email intake.
Insert directly into deals table with status='PROSPECT' and intake provenance.
Returns: deal_id, deal_name, status.
Use after extract_deal_fields + score_fit_against_profile confirm a deal.`,
  };
}


export const createDealDraftTool = {"""
new_dup = """export const createDealDraftTool = {"""
content = content.replace(old_dup, new_dup)

with open(path, 'w') as f:
    f.write(content)

print('Done')
