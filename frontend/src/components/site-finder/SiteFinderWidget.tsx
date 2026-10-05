import React from 'react';
import type { SiteCriteria, SiteInstruction } from '../../../../shared/site-finder';
export type SiteInstructionView = SiteInstruction;

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  busy: boolean;
  instruction: SiteInstructionView | null;
  clarification: boolean;
  canRetryNetwork: boolean;
  onRetryNetwork: () => void;
  onRetryNew: () => void;
  onResume: () => void;
  pollingPaused: boolean;
  history: SiteInstructionView[];
  onRestore: (id: string) => void;
}

const criteriaLines = (criteria: SiteCriteria): string[] => {
  const lines: string[] = [];
  if (criteria.counties?.length) lines.push(`Counties: ${criteria.counties.join(', ')}`);
  if (criteria.municipality) lines.push(`Municipality: ${criteria.municipality}`);
  if (criteria.propertyType) lines.push(`Property type: ${criteria.propertyType}${criteria.typeSemantics ? ` (${criteria.typeSemantics})` : ''}`);
  if (criteria.intendedUse) lines.push(`Intended use: ${criteria.intendedUse}`);
  if (criteria.zoning) lines.push(`Zoning: ${criteria.zoning.code} · ${criteria.zoning.jurisdiction}`);
  if (criteria.area) {
    const { min, max, unit, minInclusive, maxInclusive } = criteria.area;
    const areaParts = [
      min !== undefined ? `${minInclusive === false ? '>' : '≥'} ${min}` : null,
      max !== undefined ? `${maxInclusive === false ? '<' : '≤'} ${max}` : null,
    ].filter(Boolean);
    if (areaParts.length) lines.push(`Parcel area: ${areaParts.join(' and ')} ${unit}`);
  }
  if (criteria.addressText) lines.push(`Address contains: ${criteria.addressText}`);
  lines.push(`Result cap: ${criteria.limit} per county`);
  return lines;
};

export function SiteFinderWidget({
  text, onTextChange, onSubmit, busy, instruction, clarification, canRetryNetwork,
  onRetryNetwork, onRetryNew, onResume, pollingPaused, history, onRestore,
}: Props) {
  const isTerminalError = instruction?.status === 'error';
  const isActive = instruction && ['queued', 'understanding'].includes(instruction.status);
  const statusLabel: Record<SiteInstructionView['status'], string> = {
    queued: 'QUEUED', understanding: 'UNDERSTANDING REQUEST', clarification: 'NEEDS CLARIFICATION',
    searching: 'SEARCHING PARCEL SOURCES', error: 'INSTRUCTION ERROR',
  };

  return <section className="sf-panel">
    <div className="sf-panel-head"><div><span className="sf-eyebrow">01 / DESCRIBE THE PARCEL YOU NEED</span><h2>{clarification ? 'Clarify the request' : 'Describe the search'}</h2></div><span className="sf-panel-index">PLAIN LANGUAGE</span></div>
    <div className="sf-interpret">
      <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>
        <textarea
          value={text}
          maxLength={1000}
          onChange={event => onTextChange(event.target.value)}
          placeholder={clarification ? 'Answer the question above. Your reply will be added to this instruction.' : 'For example: Find parcels over 3 acres in Broward suitable for assisted living.'}
          aria-label={clarification ? 'Clarification response' : 'Describe your parcel search'}
          aria-describedby="sf-instruction-hint"
        />
        <div className="sf-instruction-meta"><span id="sf-instruction-hint">{clarification ? 'Your answer will refine the existing request.' : 'Describe location, intended use, size, or other requirements.'}</span><span>{text.length}/1000</span></div>
        <button type="submit" disabled={busy || !text.trim() || Boolean(isActive)}>{busy ? 'SENDING…' : clarification ? 'SEND CLARIFICATION' : 'FIND SITES'}</button>
      </form>
      {instruction && <div className="sf-interpret-summary" aria-live="polite">
        <div className="sf-instruction-status"><strong>{statusLabel[instruction.status]}</strong><span>REF {instruction.id.slice(0, 8)}</span></div>
        {instruction.message && <p className={isTerminalError ? 'sf-issue' : ''}>{instruction.message}</p>}
        {instruction.summary?.length ? <ul>{instruction.summary.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul> : null}
        {instruction.criteria && <div className="sf-validated-criteria"><strong>VALIDATED SEARCH CRITERIA · READ ONLY</strong><ul>{criteriaLines(instruction.criteria).map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ul></div>}
        {instruction.status === 'clarification' && <p className="sf-clarification-hint">The search is paused until you answer in the box above.</p>}
        {isTerminalError && <div className="sf-instruction-actions"><span>Keep this request for reference, or explicitly start it again with a new ID.</span><button type="button" onClick={onRetryNew}>RETRY AS NEW REQUEST</button></div>}
      </div>}
      {pollingPaused && <div className="sf-instruction-actions"><span>Progress updates paused after repeated connection failures.</span><button type="button" onClick={onResume}>RESUME CHECKS</button></div>}
      {canRetryNetwork && <div className="sf-instruction-actions"><span>Request not confirmed. Retry safely with the same instruction ID.</span><button type="button" onClick={onRetryNetwork}>RETRY SAME REQUEST</button></div>}
      {history.length > 0 && <div className="sf-instruction-history"><div className="sf-section-label">RECENT INSTRUCTIONS</div>{history.slice(0, 6).map(item => <button type="button" className="sf-history-item" key={item.id} onClick={() => onRestore(item.id)}><span>{item.text}</span><span>{statusLabel[item.status]}</span></button>)}</div>}
      <div className="sf-disclaimer">Preliminary screening only. Not legal zoning, licensing, availability, or for-sale advice.</div>
    </div>
  </section>;
}

export default SiteFinderWidget;