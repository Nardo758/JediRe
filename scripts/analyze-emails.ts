/**
 * Email Workflow Analyzer
 *
 * Reads .eml files, classifies them, extracts deal-related data,
 * and maps against JediRe's platform capabilities.
 *
 * Run:
 *   cd backend && npx ts-node --transpile-only ../scripts/analyze-emails.ts
 *
 * Outputs:
 *   - Deal workflow patterns (pipeline stage progression)
 *   - Identified tasks, milestones, decisions
 *   - Platform capability gaps
 *   - Extractable data (news, comps, contacts)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ── Types ──

interface EmailMeta {
  file: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  messageId: string;
  bodyText: string;
}

interface DealMention {
  dealName: string;
  confidence: 'high' | 'medium' | 'low';
  stage?: PipelineStage;
}

type PipelineStage =
  | 'sourcing' | 'loi' | 'due_diligence' | 'closing'
  | 'asset_management' | 'disposition' | 'unknown';

interface WorkflowEvent {
  email: string;
  from: string;
  subject: string;
  category: EmailCategory;
  deal?: string;
  date: string;
  body?: string;
}

type EmailCategory =
  | 'dealroom_access'       // Data room access granted/approved
  | 'nda_confidentiality'   // NDA signed
  | 'offering_memorandum'   // OM / teaser sent
  | 'market_news'
  | 'deal_update'
  | 'financial_report'      // T12, rent roll, P&L
  | 'task_assignment'
  | 'meeting_request'
  | 'broker_communication'
  | 'internal_discussion'
  | 'newsletter'
  | 'unknown';

const EML_DIR = '/home/ldixon/.openclaw/MAG Emails/MAG Email PC/ldixon@myersapartmentgroup.com.pst/Inbox/War Room Links';

// ── Parsing ──

function parseEml(filePath: string): EmailMeta {
  const content = fs.readFileSync(filePath, 'utf-8');
  const headers: Record<string, string> = {};
  let bodyStart = 0;

  // Split headers from body
  const lines = content.split('\n');
  let inHeaders = true;
  let headerLines: string[] = [];
  let bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (inHeaders) {
      if (line === '' || line === '\r') {
        inHeaders = false;
        continue;
      }
      headerLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }

  // Parse headers
  let currentKey = '';
  for (const l of headerLines) {
    const match = l.match(/^([A-Za-z-]+):\s*(.*)/);
    if (match) {
      currentKey = match[1].toLowerCase();
      headers[currentKey] = match[2].trim();
    } else if (currentKey && l.startsWith(' ')) {
      // Continuation line
      headers[currentKey] += ' ' + l.trim();
    }
  }

  const toField = headers['to'] || '';
  const toEmails = toField.split(',').map(e => e.trim()).filter(Boolean);

  // Body - skip multipart boundaries, decode quoted-printable if needed
  let bodyText = bodyLines.join('\n');

  // If multipart, try to extract text/plain or text/html
  const contentType = headers['content-type'] || '';
  if (contentType.includes('multipart/')) {
    const boundary = contentType.match(/boundary="?([^";\s]+)"?/i);
    if (boundary) {
      const parts = bodyText.split(`--${boundary[1]}`);
      for (const part of parts) {
        if (part.includes('Content-Type: text/plain') || part.includes('Content-Type: text/html')) {
          const partLines = part.split('\n');
          let inPartBody = false;
          let partBody: string[] = [];
          for (const pl of partLines) {
            if (pl.trim() === '' && !inPartBody) {
              inPartBody = true;
              continue;
            }
            if (inPartBody) {
              // Skip content-transfer-encoding headers if still in headers
              if (pl.match(/^[A-Za-z-]+:/) && partBody.length === 0) continue;
              partBody.push(pl);
            }
          }
          if (partBody.length > 0) {
            bodyText = partBody.join('\n');
            break;
          }
        }
      }
    }
  }

  // Decode =?UTF-8?Q?...?= subject
  let subject = headers['subject'] || '(no subject)';
  const encodedMatch = subject.match(/=\?([^?]+)\?([^?]+)\?([^?]*)\?=/);
  if (encodedMatch) {
    try {
      subject = Buffer.from(encodedMatch[3], 'base64').toString('utf-8');
    } catch {
      // keep as-is
    }
  }

  return {
    file: path.basename(filePath),
    subject,
    from: headers['from'] || '(unknown)',
    to: toEmails,
    date: headers['date'] || '',
    messageId: headers['message-id'] || '',
    bodyText,
  };
}

// ── Classification ──

function classifyEmail(meta: EmailMeta): EmailCategory {
  const subj = meta.subject.toLowerCase();
  const from = meta.from.toLowerCase();
  const body = meta.bodyText.toLowerCase().slice(0, 1000);

  // Dealroom access
  if (/access (approved|granted)/i.test(subj) || /data room/i.test(subj)) return 'dealroom_access';
  if (/confidentiality (agreement|approved)/i.test(subj) || /nda/i.test(subj)) return 'nda_confidentiality';
  if (/offering memorandum/i.test(subj) || /offering/i.test(subj) || /om attached/i.test(subj)) return 'offering_memorandum';

  // Financial
  if (/t-12|t12|rent roll|operating statement|p&l|profit and loss|financials?/i.test(subj)) return 'financial_report';
  if (/aged receivables|aging|delinquenc/i.test(subj)) return 'financial_report';

  // Market / News
  if (/market (update|report|trend)|newsletter|weekly|monthly digest/i.test(subj)) return 'market_news';
  if (/bisnow|costar|globest|therealdeal/i.test(from) || /news/i.test(subj)) return 'newsletter';

  // Deal updates
  if (/update|status|progress|next steps/i.test(subj)) return 'deal_update';

  // Tasks
  if (/action (item|required)|task|to do|follow.?up|deadline|due date/i.test(subj)) return 'task_assignment';

  // Meetings
  if (/meeting|call|conference|schedule|calendar|zoom|teams/i.test(subj)) return 'meeting_request';

  // Broker communications
  if (/(broker|listing|exclusive|listing agent|selling agent)/i.test(subj)) return 'broker_communication';

  // Internal
  if (/internal|team|discussion|thoughts|feedback|opinion/i.test(subj)) return 'internal_discussion';

  return 'unknown';
}

// ── Deal Extraction ──

function extractDealMentions(meta: EmailMeta): DealMention[] {
  const deals: DealMention[] = [];
  const subj = meta.subject;

  // Common pattern: "Deal Name: Action"
  const colonMatch = subj.match(/^([A-Za-z0-9][A-Za-z0-9\s.'&-]+?):\s*(.+)/);
  if (colonMatch) {
    const name = colonMatch[1].trim();
    const action = colonMatch[2].toLowerCase();
    let stage: PipelineStage = 'unknown';

    if (/access|approved|confidential/i.test(action)) stage = 'due_diligence';
    else if (/offer|loi|letter/i.test(action)) stage = 'loi';
    else if (/om|offering|teaser/i.test(action)) stage = 'sourcing';
    else if (/close|funding|settlement/i.test(action)) stage = 'closing';
    else if (/operating|t12|rent roll|financial/i.test(action)) stage = 'asset_management';

    deals.push({ dealName: name, confidence: 'high', stage });
  }

  return deals;
}

// ── Workflow Pattern Detection ──

function detectWorkflowPatterns(emails: WorkflowEvent[]): void {
  const dealGroups = new Map<string, WorkflowEvent[]>();

  for (const e of emails) {
    if (e.deal) {
      if (!dealGroups.has(e.deal)) dealGroups.set(e.deal, []);
      dealGroups.get(e.deal)!.push(e);
    }
  }

  console.log(`\n📊 Deal Pipeline Analysis`);
  console.log(`   ${dealGroups.size} unique deals identified\n`);

  for (const [deal, events] of dealGroups) {
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const stages = events.map(e => `[${e.category}] ${e.subject.slice(0, 60)}`).join('\n       → ');
    console.log(`   🏗️  ${deal} (${events.length} events)`);
    console.log(`       ${stages}`);

    // Detect workflow gaps
    const hasNDA = events.some(e => e.category === 'nda_confidentiality');
    const hasOM = events.some(e => e.category === 'offering_memorandum');
    const hasFin = events.some(e => e.category === 'financial_report');
    const hasAccess = events.some(e => e.category === 'dealroom_access');

    if (!hasAccess) console.log(`       ⚠️  Missing: Data room access event`);
    if (!hasFin) console.log(`       ⚠️  Missing: Financial reporting`);
    if (hasAccess && !hasFin) console.log(`       ⚠️  Due diligence started but no financial reports found`);
  }
}

// ── Platform Gap Analysis ──

function analyzePlatformGaps(emails: WorkflowEvent[]): void {
  console.log(`\n🔍 Platform Capability Gap Analysis`);
  console.log(`   ${'='.repeat(60)}`);

  // What JediRe tracks
  const platformTracks = {
    stages: ['sourcing', 'loi', 'due_diligence', 'closing', 'asset_management', 'disposition'],
    categories: ['dealroom_access', 'nda_confidentiality', 'offering_memorandum', 'financial_report'],
  };

  const categoriesFound = new Set(emails.map(e => e.category));
  const dealsWorkflow = new Map<string, Set<string>>();

  for (const e of emails) {
    if (e.deal) {
      if (!dealsWorkflow.has(e.deal)) dealsWorkflow.set(e.deal, new Set());
      dealsWorkflow.get(e.deal)!.add(e.category);
    }
  }

  // Coverage
  console.log(`   Categories found in emails:`);
  for (const cat of [...categoriesFound].sort()) {
    const count = emails.filter(e => e.category === cat).length;
    const covered = platformTracks.categories.includes(cat) ? '✅' : '❌';
    console.log(`   ${covered} ${cat} (${count})`);
  }

  // Gaps
  const gapEvents = emails.filter(e => !platformTracks.categories.includes(e.category));
  console.log(`\n   📋 Events NOT tracked by platform (${gapEvents.length}):`);
  for (const g of gapEvents.slice(0, 10)) {
    console.log(`       • ${g.category}: "${g.subject.slice(0, 70)}"`);
  }

  if (gapEvents.length > 10) {
    console.log(`       ... and ${gapEvents.length - 10} more`);
  }

  // Category gaps to consider adding
  const uncategorized = [...categoriesFound].filter(c => !platformTracks.categories.includes(c));
  if (uncategorized.length > 0) {
    console.log(`\n   💡 Suggested new platform event types:`);
    for (const c of uncategorized) {
      console.log(`       + ${c}`);
    }
  }
}

// ── Main ──

async function main() {
  console.log(`📧 Email Workflow Analyzer\n`);
  console.log(`   Scanning: ${EML_DIR}`);

  const files = fs.readdirSync(EML_DIR)
    .filter(f => f.endsWith('.eml'))
    .sort((a, b) => parseInt(a) - parseInt(b));

  console.log(`   Found: ${files.length} emails\n`);

  const allEvents: WorkflowEvent[] = [];
  const allDeals = new Map<string, Set<string>>();
  const senders = new Map<string, number>();
  const categories: Record<string, number> = {};

  for (const file of files) {
    const filePath = path.join(EML_DIR, file);
    try {
      const meta = parseEml(filePath);
      const category = classifyEmail(meta);
      const deals = extractDealMentions(meta);

      categories[category] = (categories[category] || 0) + 1;
      senders.set(meta.from, (senders.get(meta.from) || 0) + 1);

      const dealName = deals.length > 0 && deals[0].confidence === 'high' ? deals[0].dealName : undefined;

      if (dealName) {
        if (!allDeals.has(dealName)) allDeals.set(dealName, new Set());
        allDeals.get(dealName)!.add(category);
      }

      allEvents.push({
        email: file,
        from: meta.from,
        subject: meta.subject,
        category,
        deal: dealName,
        date: meta.date,
        body: meta.bodyText.slice(0, 200),
      });

    } catch (err: any) {
      console.error(`   ⚠️  Error parsing ${file}: ${err.message}`);
    }
  }

  // ── Summary ──

  console.log(`📊 Classification Summary`);
  console.log(`   ${'='.repeat(60)}`);
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / files.length) * 100).toFixed(0);
    console.log(`   ${cat.padEnd(25)} ${count.toString().padStart(3)}  (${pct}%)`);
  }

  console.log(`\n👤 Top Senders`);
  console.log(`   ${'='.repeat(60)}`);
  const sortedSenders = [...senders.entries()].sort((a, b) => b[1] - a[1]);
  for (const [sender, count] of sortedSenders.slice(0, 10)) {
    console.log(`   ${count}  ${sender}`);
  }

  // Deal pipeline
  const dealEntries = [...allDeals.entries()].sort((a, b) => b[1].size - a[1].size);
  console.log(`\n🏗️  Detected Deals (${dealEntries.length})`);
  console.log(`   ${'='.repeat(60)}`);
  for (const [deal, cats] of dealEntries) {
    console.log(`   • ${deal} (${[...cats].join(', ')})`);
  }

  // Workflow patterns
  detectWorkflowPatterns(allEvents);

  // Platform gaps
  analyzePlatformGaps(allEvents);

  // ── Output full data as JSON ──

  const outputPath = path.join(EML_DIR, '../..', 'email-analysis.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    totalEmails: files.length,
    categories,
    senders: Object.fromEntries(senders),
    deals: Object.fromEntries(allDeals),
    events: allEvents,
  }, null, 2));

  console.log(`\n💾 Full analysis saved to: ${outputPath}`);
}

main().catch(console.error);
