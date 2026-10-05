import axios from 'axios';
import { createHash } from 'crypto';
import { SiteEvidence, SiteParcel, SiteReview } from '../../types/site-finder';
import { SOURCES, resolveZoning } from './sources';
import { normalizeAuthority, normalizeCode } from './criteria';

const PBC_ART4 = 'https://pbc.gov/uldc/pdf/Article4.pdf';
const MDC_IU1 = 'https://www.miamidade.gov/global/economy/zoning/districts/iu-1-industrial-light-manufacturing.page';
// Reviewed table snapshot: columns were checked against the official PDF, not keyword-inferred.
// Any document revision invalidates these use-table assertions pending a new human check.
const PBC_ART4_REVIEWED_SHA256 = '3fc0558093bac76116300bdb84c07757b0404c5d77a118f5dc360b72feb2b951';
const cache = new Map<string, { until: number; review: SiteReview }>();
const docCache = new Map<string, { until: number; bytes: Buffer; at: string }>();
const inflight = new Map<string, Promise<{ bytes: Buffer; at: string }>>();
async function document(url: string) {
  if (![PBC_ART4, MDC_IU1].includes(url)) throw new Error('Unapproved zoning-code URL');
  const hit = docCache.get(url);
  if (hit && hit.until > Date.now()) return hit;
  if (inflight.has(url)) return inflight.get(url)!;
  const work = (async () => {
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000, maxRedirects: 0, maxContentLength: 12 * 1024 * 1024 });
    const data = { bytes: Buffer.from(r.data), at: new Date().toISOString(), until: Date.now() + 60 * 60 * 1000 };
    if (data.bytes.length < 1000) throw new Error('Official code document is incomplete');
    if (docCache.size >= 8) docCache.clear();
    docCache.set(url, data); return data;
  })();
  inflight.set(url, work);
  try { return await work; } finally { inflight.delete(url); }
}
const evidence = (section: string, excerpt: string, url: string, checkedAt: string): SiteEvidence => ({ section, excerpt, url, checkedAt });
export function verifiedPermission(r: SiteReview): SiteReview {
  // Assertions without both a precise legal term and official evidence cannot become matches.
  if (['by-right', 'conditional', 'prohibited'].includes(r.status) && (!r.legalUse || !r.evidence.some(e => e.section.includes('Table 4.B.5.A') && e.excerpt && e.url.startsWith(`${PBC_ART4}#`)))) {
    r.status = 'unverified'; r.limitations.push('Permission evidence is incomplete.');
  }
  return r;
}
export async function reviewParcel(p: SiteParcel, refresh = false): Promise<SiteReview> {
  if (refresh) {
    p.jurisdiction = null; p.district = null; p.warnings = p.warnings.filter(w=>w.startsWith('Assessor classification unavailable:'));
    p.zoningSourceUrl=undefined;p.jurisdictionSourceUrl=undefined;p.review.districtName=undefined;
    await resolveZoning(p);
  }
  const requested = p.review.requestedUse;
  const now = new Date().toISOString();
  const r: SiteReview = { status: requested ? 'unverified' : 'not-requested', requestedUse: requested, districtName: p.review.districtName, checkedAt: now, evidence: [], standards: [], conditions: [], limitations: [...p.warnings] };
  r.limitations.push('Preliminary district screening only. Not legal zoning confirmation, entitlement or licensing approval, or evidence of sale availability.');
  r.limitations.push('Parcel-specific setbacks, density, height, access, future-land-use consistency, overlays and prior approvals remain unknown unless explicitly cited.');
  if (p.zoningSourceUrl && p.district) r.evidence.push(evidence('Official zoning-map intersection', `${p.jurisdiction}: district ${p.district}${r.districtName ? ` — ${r.districtName}` : ''}. A district designation does not establish permission for a proposed use.`, p.zoningSourceUrl, now));
  if (!p.jurisdiction || !p.district) {
    r.limitations.push('Authority or zoning district unresolved. No permission assessment can be made; retry or narrow geography.'); return r;
  }
  const key = JSON.stringify([normalizeAuthority(p.jurisdiction), normalizeCode(p.district), requested || '', p.warnings]);
  if (!refresh) {
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return { ...hit.review, evidence: [...hit.review.evidence], limitations: [...hit.review.limitations] };
  }
  try {
    if (p.county === 'Miami-Dade' && p.jurisdiction.toUpperCase().includes('UNINCORPORATED') && normalizeCode(p.district) === 'IU-1') {
      const doc = await document(MDC_IU1);
      const html = doc.bytes.toString('utf8');
      const content = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      const required = ['Light industrial manufacturing', 'Wholesale distribution facilities', 'Warehousing', 'Storage facilities', 'Offices'];
      if (!required.every(t => content.includes(t))) throw new Error('IU-1 district source has changed; uses require re-verification.');
      r.evidence.push(evidence('IU-1 — official district uses (Chapter 33 zoning summary)', 'The IU-1 Industrial, Light Manufacturing zoning district allows: Light industrial manufacturing; Wholesale distribution facilities; Warehousing; Storage facilities; Offices.', MDC_IU1, doc.at));
      // Summary is evidence of a listed use but not a statutory approval-process determination.
      r.conditions.push('Consult the controlling Chapter 33 provisions and applicable approvals. The official district summary does not specify every approval condition.');
      r.limitations.push('The district summary does not establish a by-right versus special-exception process; permission remains unverified until code sections are checked.');
      if (requested && ['warehouse', 'warehousing'].includes(requested.toLowerCase())) r.legalUse = 'Warehousing';
      const height = content.match(/Maximum building height is ([^.]+\.)/i);
      if (height) {
        const ev = evidence('IU-1 — Building height', height[0], MDC_IU1, doc.at);
        r.evidence.push(ev); r.standards.push({ name: 'District maximum building height (exceptions may apply)', value: height[1], evidence: ev });
      }
    } else if (p.county === 'Palm Beach' && p.jurisdiction.toUpperCase().includes('UNINCORPORATED')) {
      const doc = await document(PBC_ART4);
      if (createHash('sha256').update(doc.bytes).digest('hex') !== PBC_ART4_REVIEWED_SHA256) throw new Error('Official Article 4 has changed since the reviewed use-table snapshot. Permission is unknown until the new table is verified.');
      r.evidence.push(evidence('ULDC Article 4.A.3–5 — general applicability', 'Zoning and Future Land Use Consistency; Overlays; Airport Zones. These additional requirements must be reviewed separately from the use matrix.', `${PBC_ART4}#page=9`, doc.at));
      const use = requested?.toLowerCase();
      const industrial = use === 'warehouse' || use === 'warehousing' || use === 'manufacturing';
      if (industrial || !requested) {
        const warehouse = use !== 'manufacturing';
        const term = warehouse ? 'Warehouse' : 'Manufacturing and Processing';
        const section = warehouse ? '4.B.5.C.17' : '4.B.5.C.8';
        const definition = warehouse ? 'An establishment used for the storage of raw materials, equipment, or products.' : 'Manufacturing and Processing';
        r.evidence.push(evidence(`ULDC Article ${section} — ${term}`, definition, `${PBC_ART4}#page=${warehouse ? 100 : 96}`, doc.at));
        if (requested) r.legalUse = term;
        if (['IL', 'IG'].includes(p.district)) {
          r.evidence.push(evidence('Table 4.B.5.A — Industrial Use Matrix; Use Approval Process Key', `${term}: IL = P, IG = P. P = Permitted by Right. Supplementary Use Standards for each use must be reviewed regardless of the approval process set forth in the Use Matrix.`, `${PBC_ART4}#page=91`, doc.at));
          if (requested) r.status = 'by-right';
          r.conditions.push('Supplementary use standards and Article 4.A.9 project approval thresholds still apply. Larger projects may require DRO or Board of County Commissioners approval.');
        } else if (['CG', 'IRO'].includes(p.district)) {
          r.evidence.push(evidence('Table 4.B.5.A — Industrial Use Matrix; Use Approval Process Key', `${term}: CG = D, IRO with CH FLU = D. D = Subject to DRO approval. FLU and supplementary standards must be checked.`, `${PBC_ART4}#page=91`, doc.at));
          if (requested && p.district === 'CG') r.status = 'conditional';
          r.conditions.push('Development Review Officer approval required; zoning/FLU consistency and project thresholds must be verified.');
          if (p.district === 'IRO') r.limitations.push('Applicable FLU designation is unresolved; the IRO table column cannot be selected.');
        } else if (['RE','RT','RS','RM'].includes(p.district) && requested) {
          r.evidence.push(evidence('Table 4.B.5.A — Industrial Use Matrix; Use Approval Process Key', `${term}: ${p.district} = -. - = Prohibited use, unless stated otherwise within Supplementary Use Standards.`, `${PBC_ART4}#page=91`, doc.at));
          r.status='prohibited';
          r.conditions.push('This is the standard district matrix, not a determination about existing vested rights or an overlay exception. Supplementary standards and prior approvals require separate review.');
        }
        if (warehouse) {
          const ev = evidence('ULDC Article 4.B.5.C.17.e — accessory office', 'Unless approved as a Class A Conditional Use, or as specified in the Overlay – WCRAO standard, office space in each Warehouse bay shall be a maximum of 30 percent of the GFA of that bay.', `${PBC_ART4}#page=100`, doc.at);
          r.standards.push({ name: 'Warehouse accessory office (district rule, exceptions apply)', value: 'Maximum 30% of bay GFA unless Class A approval or WCRAO rule applies', evidence: ev }); r.evidence.push(ev);
          r.evidence.push(evidence('ULDC Article 4.B.5.C.17.b–d — supplementary limitations', 'Typical uses include moving companies, cold storage, and dead storage facilities, but excludes Self-Service Storage facilities. WCRAO Office/Warehouse development: minimum 25 percent office space per bay. CG, IRO, MUPD or Commercial Pod of PIPD with CH FLU: outdoor storage and activities prohibited.', `${PBC_ART4}#page=100`, doc.at));
        }
      } else if (use && /assisted living|memory care|continuing care|independent senior|skilled nursing/.test(use)) {
        if (use === 'skilled nursing') {
          r.legalUse = 'Skilled Nursing or Residential Treatment Facility';
          const ev = evidence('ULDC Article 4.B.4.C.15 — skilled nursing', 'An establishment where care is offered or provided for three or more persons suffering from illness ... or for three or more persons requiring further institutional care after being discharged from a Hospital. Shall be required to be licensed by the State of Florida.', `${PBC_ART4}#page=89`, doc.at);
          r.evidence.push(ev);
          r.conditions.push('State licensing required. The district use-table entry has not been verified for this parcel.');
          const standard = evidence('ULDC Article 4.B.4.C.15.d–e — lot size and frontage', 'A minimum of 10,000 square feet or the minimum requirement of the zoning district, whichever is greater. A minimum of 100 feet of frontage or the minimum requirement of the zoning district.', `${PBC_ART4}#page=89`, doc.at);
          r.evidence.push(standard); r.standards.push({ name: 'Skilled nursing minimum lot size (greater district minimum applies)', value: '10,000 square feet or district minimum, whichever greater', evidence: standard });
        } else {
          r.evidence.push(evidence('ULDC Article 4.B.1.C — Community Residential Uses', 'Assisted Living Facilities for adults with disabilities or elderly for the number of people that exceed the thresholds to be considered a Community Residence and do not emulate a family.', `${PBC_ART4}#page=15`, doc.at));
          r.evidence.push(evidence('ULDC Article 4.B.1.C — Community Residence distinctions', 'Assisted Living Facility for the elderly or other people with disabilities (F.S. § 429.02(5)).', `${PBC_ART4}#page=17`, doc.at));
          r.limitations.push('Assisted living may be a Congregate Living Facility or a Community Residence depending on resident count and family-like operation. Independent senior apartments are not automatically assisted living. Continuing care and memory care require activity/licensing-specific classification; no generic senior-living permission is inferred.');
        }
        r.limitations.push('A legal-use classification and district use-table entry require additional operational facts. Permission remains unverified.');
      } else r.limitations.push('Requested use is not covered by the reviewed Article 4 use-table entries. Its local legal classification remains unknown.');
    } else {
      r.limitations.push('This authority/district does not yet have a verified local-code use-table review. Zoning map evidence alone is not a permission match.');
    }
  } catch (e: any) {
    r.status = requested ? 'unverified' : 'not-requested';
    r.limitations.push(`Official code check incomplete: ${e.message}. Retry review when the source recovers.`);
  }
  verifiedPermission(r);
  if (cache.size >= 1000) cache.clear();
  cache.set(key, { until: Date.now() + (r.status === 'unverified' ? 60 * 1000 : 60 * 60 * 1000), review: r });
  return r;
}