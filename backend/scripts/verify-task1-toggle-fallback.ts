import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { getDealFinancials } from '../src/services/proforma-adjustment.service';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const BISHOP  = '3f32276f-aacd-4da3-b306-317c5109b403';
const SENTOSA = '3d96f62d-d986-448f-8ea4-10853021a8cb';
const USER_ID = '6253ba3f-d40d-4597-86ab-270c8397a857'; // actual owner of Bishop + Sentosa
const BASE    = 'http://localhost:4000';

const tok = jwt.sign(
  { userId: USER_ID, email: 'web_test-user@chat.jedire.com', role: 'user' },
  process.env.JWT_SECRET!,
  { expiresIn: '1h', issuer: 'jedire-api', audience: 'jedire-client' } as jwt.SignOptions
);

async function api(method: string, path: string, body?: any) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function probeOn(dealId: string, label: string) {
  const tog = await api('PATCH', `/api/v1/deals/${dealId}/financials/override`,
    { field: 'da:use_unit_mix_for_gpr', value: true });
  console.log(`${label} toggle ON → HTTP ${tog.status}`);

  const fin = await getDealFinancials(pool, dealId);
  const gprRow = fin?.proforma?.year1?.find?.((r: any) => r.field === 'gpr');
  const rrs    = fin?.rentRollSummary;
  console.log(`${label} proforma.year1.gpr:`, JSON.stringify(gprRow));
  console.log(`${label} rrs.gprFromUnitMix=${rrs?.gprFromUnitMix} useUnitMix=${rrs?.useUnitMixForGpr}`);
  return gprRow as any;
}

async function probeOff(dealId: string, label: string) {
  const tog = await api('PATCH', `/api/v1/deals/${dealId}/financials/override`,
    { field: 'da:use_unit_mix_for_gpr', value: false });
  console.log(`${label} toggle OFF → HTTP ${tog.status}`);
  const fin = await getDealFinancials(pool, dealId);
  return fin?.proforma?.year1?.find?.((r: any) => r.field === 'gpr') as any;
}

(async () => {
  console.log('=== BASELINE');
  const bBase = await pool.query(
    `SELECT year1->'gpr' AS g FROM deal_assumptions WHERE deal_id=$1`, [BISHOP]);
  const sBase = await pool.query(
    `SELECT year1->'gpr' AS g FROM deal_assumptions WHERE deal_id=$1`, [SENTOSA]);
  console.log('Bishop  DB baseline gpr:', JSON.stringify(bBase.rows[0]?.g).slice(0, 120));
  console.log('Sentosa DB baseline gpr:', JSON.stringify(sBase.rows[0]?.g).slice(0, 120));

  console.log('\n=== TOGGLE ON');
  const bishopOn  = await probeOn(BISHOP,  '464 Bishop');
  const sentosaOn = await probeOn(SENTOSA, 'Sentosa');

  console.log('\n=== TOGGLE OFF (revert check)');
  const bishopOff  = await probeOff(BISHOP,  '464 Bishop');
  const sentosaOff = await probeOff(SENTOSA, 'Sentosa');
  console.log('Bishop  OFF resolution:', bishopOff?.resolution, '| resolved:', bishopOff?.resolved);
  console.log('Sentosa OFF resolution:', sentosaOff?.resolution, '| resolved:', sentosaOff?.resolved);

  console.log('\n=== VERDICT');
  const BISHOP_PRED  = 4849260;
  const SENTOSA_PRED = 6578604;
  const tol = 0.02;
  const bOnOk  = bishopOn?.resolution  === 'unit_mix' && Math.abs(bishopOn.resolved  - BISHOP_PRED)  / BISHOP_PRED  < tol;
  const sOnOk  = sentosaOn?.resolution === 'unit_mix' && Math.abs(sentosaOn.resolved - SENTOSA_PRED) / SENTOSA_PRED < tol;
  const bOffOk = bishopOff?.resolution  !== 'unit_mix';
  const sOffOk = sentosaOff?.resolution !== 'unit_mix';

  const pct = (v: number, pred: number) => (Math.abs(v - pred) / pred * 100).toFixed(1) + '%';
  console.log(`Bishop  ON  → resolved=${bishopOn?.resolved}  resolution=${bishopOn?.resolution}  predicted=${BISHOP_PRED}  Δ=${bishopOn ? pct(bishopOn.resolved, BISHOP_PRED) : 'N/A'}  OK=${bOnOk}`);
  console.log(`Sentosa ON  → resolved=${sentosaOn?.resolved} resolution=${sentosaOn?.resolution} predicted=${SENTOSA_PRED} Δ=${sentosaOn ? pct(sentosaOn.resolved, SENTOSA_PRED) : 'N/A'}  OK=${sOnOk}`);
  console.log(`Bishop  OFF → resolution=${bishopOff?.resolution}  reverted=${bOffOk}`);
  console.log(`Sentosa OFF → resolution=${sentosaOff?.resolution} reverted=${sOffOk}`);
  console.log('OVERALL:', (bOnOk && sOnOk && bOffOk && sOffOk) ? 'PASS ✓' : 'FAIL ✗');

  await pool.end();
})().catch(async (e) => {
  console.error('FATAL', e.message, '\n', e.stack?.split('\n').slice(0, 5).join('\n'));
  await pool.end();
  process.exit(1);
});
