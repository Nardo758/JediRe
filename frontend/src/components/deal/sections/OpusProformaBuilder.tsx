import React, { useState, useEffect, useRef, useCallback } from 'react';
import { opusProformaService, type ProformaData, type ProformaVersion } from '@/services/opusProforma.service';

interface OpusProformaBuilderProps {
  deal?: any;
  dealId?: string;
}

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

const fmtPct = (val: number) => `${(val * 100).toFixed(1)}%`;

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const OpusProformaBuilder: React.FC<OpusProformaBuilderProps> = ({ deal, dealId }) => {
  const currentDealId = dealId || deal?.id || 'demo-deal';
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [proformaVersions, setProformaVersions] = useState<ProformaVersion[]>([]);
  const [selectedProforma, setSelectedProforma] = useState<ProformaData | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'models'>('chat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadConversations();
    loadVersions();
  }, [currentDealId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamText]);

  const loadConversations = async () => {
    try {
      const convos = await opusProformaService.getConversations(currentDealId);
      if (convos.length > 0) {
        const convo = await opusProformaService.getConversation(convos[0].id);
        setConversationId(convo.id);
        if (convo.messages) {
          setMessages(convo.messages.map((m: any) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.created_at,
          })));
        }
      }
    } catch (e) {}
  };

  const loadVersions = async () => {
    try {
      const versions = await opusProformaService.getProformaVersions(currentDealId);
      setProformaVersions(versions);
      if (versions.length > 0 && !selectedProforma) {
        setSelectedProforma(versions[0].proforma_data);
      }
    } catch (e) {}
  };

  const startNewSession = async () => {
    try {
      const convo = await opusProformaService.createConversation(currentDealId, 'Pro Forma Session');
      setConversationId(convo.id);
      setMessages([]);
      setStreamText('');
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to start session');
    }
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;

    let convId = conversationId;
    if (!convId) {
      try {
        const convo = await opusProformaService.createConversation(currentDealId, 'Pro Forma Session');
        convId = convo.id;
        setConversationId(convId);
      } catch (e: any) {
        setError('Failed to create session');
        return;
      }
    }

    const userMsg: ChatMsg = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setStreamText('');
    setError(null);

    try {
      await opusProformaService.streamMessage(
        convId!,
        userMsg.content,
        currentDealId,
        (chunk) => {
          setStreamText(prev => prev + chunk);
        },
        () => {
          setStreamText(prev => {
            const fullText = prev;
            setMessages(msgs => [...msgs, {
              role: 'assistant',
              content: fullText,
              timestamp: new Date().toISOString(),
            }]);

            const proforma = opusProformaService.parseProformaFromResponse(fullText);
            if (proforma) {
              setSelectedProforma(proforma);
              loadVersions();
            }

            return '';
          });
          setStreaming(false);
        },
        (errMsg) => {
          setError(errMsg);
          setStreaming(false);
        }
      );
    } catch (e: any) {
      setError(e.message || 'Failed to send message');
      setStreaming(false);
    }
  }, [input, streaming, conversationId, currentDealId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickPrompts = [
    'Build a 5-year pro forma for a 200-unit value-add acquisition at $140K/unit',
    'Generate a stabilized NOI analysis using the rent comp data',
    'Compare conservative vs aggressive return scenarios',
    'What cap rate should I underwrite for exit based on the market data?',
  ];

  const renderProformaTable = (pf: ProformaData) => (
    <div style={{ background: '#1a1a2e', borderRadius: 8, padding: 16, marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h4 style={{ color: '#00d4ff', margin: 0, fontSize: 16 }}>{pf.name || 'Pro Forma Model'}</h4>
        <span style={{ color: '#8892b0', fontSize: 12 }}>{pf.holdPeriod}-Year Hold</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <MetricCard label="IRR" value={fmtPct(pf.returns?.irr || 0)} color="#00d4ff" />
        <MetricCard label="Cash-on-Cash" value={fmtPct(pf.returns?.cashOnCash || 0)} color="#4ade80" />
        <MetricCard label="Equity Multiple" value={`${(pf.returns?.equityMultiple || 0).toFixed(2)}x`} color="#f59e0b" />
        <MetricCard label="DSCR" value={`${(pf.returns?.dscr || 0).toFixed(2)}x`} color="#a78bfa" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, fontSize: 13 }}>
        <div>
          <h5 style={{ color: '#8892b0', fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>Acquisition</h5>
          <Row label="Purchase Price" value={fmtCurrency(pf.acquisition?.purchasePrice || 0)} />
          <Row label="$/Unit" value={fmtCurrency(pf.acquisition?.pricePerUnit || 0)} />
          <Row label="Closing Costs" value={fmtCurrency(pf.acquisition?.closingCosts || 0)} />
          <Row label="Renovation" value={fmtCurrency(pf.acquisition?.renovationBudget || 0)} />
          <Row label="Total Basis" value={fmtCurrency(pf.acquisition?.totalBasis || 0)} bold />
        </div>
        <div>
          <h5 style={{ color: '#8892b0', fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>Financing</h5>
          <Row label="Loan Amount" value={fmtCurrency(pf.financing?.loanAmount || 0)} />
          <Row label="LTV" value={fmtPct(pf.financing?.ltv || 0)} />
          <Row label="Rate" value={fmtPct(pf.financing?.interestRate || 0)} />
          <Row label="Amortization" value={`${pf.financing?.amortizationYears || 30} yrs`} />
          <Row label="Debt Service" value={fmtCurrency(pf.financing?.annualDebtService || 0)} bold />
        </div>
        <div>
          <h5 style={{ color: '#8892b0', fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>Operations</h5>
          <Row label="Gross Rent" value={fmtCurrency(pf.operations?.grossRent || 0)} />
          <Row label="Vacancy" value={fmtPct(pf.operations?.vacancy || 0)} />
          <Row label="EGI" value={fmtCurrency(pf.operations?.effectiveGrossIncome || 0)} />
          <Row label="Expenses" value={fmtCurrency(pf.operations?.operatingExpenses || 0)} />
          <Row label="NOI" value={fmtCurrency(pf.operations?.noi || 0)} bold />
        </div>
      </div>

      {pf.yearlyProjection && pf.yearlyProjection.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h5 style={{ color: '#8892b0', fontSize: 11, textTransform: 'uppercase', marginBottom: 8 }}>Yearly Projection</h5>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a4a' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#8892b0' }}>Year</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#8892b0' }}>Revenue</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#8892b0' }}>Expenses</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#8892b0' }}>NOI</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#8892b0' }}>Debt Service</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#8892b0' }}>Cash Flow</th>
              </tr>
            </thead>
            <tbody>
              {pf.yearlyProjection.map(yr => (
                <tr key={yr.year} style={{ borderBottom: '1px solid #1e1e38' }}>
                  <td style={{ padding: '6px 8px', color: '#ccd6f6' }}>Yr {yr.year}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', color: '#ccd6f6' }}>{fmtCurrency(yr.revenue)}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', color: '#e06c75' }}>{fmtCurrency(yr.expenses)}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', color: '#4ade80' }}>{fmtCurrency(yr.noi)}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', color: '#f59e0b' }}>{fmtCurrency(yr.debtService)}</td>
                  <td style={{ textAlign: 'right', padding: '6px 8px', color: yr.cashFlow >= 0 ? '#4ade80' : '#e06c75', fontWeight: 600 }}>{fmtCurrency(yr.cashFlow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderMessageContent = (content: string) => {
    const proforma = opusProformaService.parseProformaFromResponse(content);
    const cleanText = content.replace(/```proforma\n[\s\S]*?```/g, '').trim();

    return (
      <>
        {cleanText && (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{cleanText}</div>
        )}
        {proforma && renderProformaTable(proforma)}
      </>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600, background: '#0d1117', borderRadius: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #1e1e38' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
            O
          </div>
          <div>
            <h3 style={{ margin: 0, color: '#ccd6f6', fontSize: 15 }}>Opus Pro Forma Builder</h3>
            <span style={{ color: '#8892b0', fontSize: 11 }}>AI-powered financial modeling</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <TabBtn active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>Chat</TabBtn>
          <TabBtn active={activeTab === 'models'} onClick={() => setActiveTab('models')}>
            Models {proformaVersions.length > 0 && <span style={{ background: '#00d4ff', color: '#0d1117', borderRadius: 10, padding: '0 6px', fontSize: 10, marginLeft: 4 }}>{proformaVersions.length}</span>}
          </TabBtn>
          <button onClick={startNewSession} style={{ padding: '4px 12px', background: 'none', border: '1px solid #2a2a4a', borderRadius: 6, color: '#8892b0', fontSize: 12, cursor: 'pointer' }}>
            New Session
          </button>
        </div>
      </div>

      {activeTab === 'chat' ? (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {messages.length === 0 && !streaming && (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>&#9881;</div>
                <h4 style={{ color: '#ccd6f6', marginBottom: 8 }}>Build Your Pro Forma</h4>
                <p style={{ color: '#8892b0', fontSize: 13, marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
                  Opus uses real rent comps, cap rates, density benchmarks, and supply intelligence to build data-driven financial models. Ask a question or try a prompt below.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxWidth: 600, margin: '0 auto' }}>
                  {quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                      style={{
                        padding: '10px 14px', background: '#1a1a2e', border: '1px solid #2a2a4a',
                        borderRadius: 8, color: '#8892b0', fontSize: 12, textAlign: 'left',
                        cursor: 'pointer', lineHeight: 1.4, transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#00d4ff'; e.currentTarget.style.color = '#ccd6f6'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a4a'; e.currentTarget.style.color = '#8892b0'; }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', marginBottom: 16, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: msg.role === 'assistant' ? '85%' : '70%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: msg.role === 'user' ? '#1e3a5f' : '#1a1a2e',
                  color: '#ccd6f6',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}>
                  {msg.role === 'assistant' ? renderMessageContent(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {streaming && streamText && (
              <div style={{ display: 'flex', marginBottom: 16, justifyContent: 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: '12px 12px 12px 4px',
                  background: '#1a1a2e', color: '#ccd6f6', fontSize: 13, lineHeight: 1.6,
                }}>
                  {renderMessageContent(streamText)}
                  <span style={{ display: 'inline-block', width: 6, height: 14, background: '#00d4ff', animation: 'blink 1s infinite', marginLeft: 2, verticalAlign: 'middle' }} />
                </div>
              </div>
            )}

            {streaming && !streamText && (
              <div style={{ display: 'flex', marginBottom: 16, justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 4px', background: '#1a1a2e', color: '#8892b0', fontSize: 13 }}>
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0s' }}>&#9679;</span>
                    <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0.2s' }}>&#9679;</span>
                    <span style={{ animation: 'pulse 1.4s infinite', animationDelay: '0.4s' }}>&#9679;</span>
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div style={{ padding: '10px 14px', background: '#3b1a1a', borderRadius: 8, color: '#e06c75', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid #1e1e38' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Opus to build a pro forma, adjust assumptions, or analyze returns..."
                rows={2}
                style={{
                  flex: 1, padding: '10px 14px', background: '#1a1a2e', border: '1px solid #2a2a4a',
                  borderRadius: 8, color: '#ccd6f6', fontSize: 13, resize: 'none', outline: 'none',
                  fontFamily: 'inherit', lineHeight: 1.5,
                }}
                disabled={streaming}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                style={{
                  padding: '10px 20px', background: input.trim() && !streaming ? '#00d4ff' : '#2a2a4a',
                  border: 'none', borderRadius: 8, color: input.trim() && !streaming ? '#0d1117' : '#555',
                  fontSize: 13, fontWeight: 600, cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
                  minHeight: 42,
                }}
              >
                {streaming ? 'Thinking...' : 'Send'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {proformaVersions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8892b0' }}>
              <p>No pro forma models yet. Chat with Opus to generate your first model.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {proformaVersions.map(v => (
                <div key={v.id} style={{
                  background: '#1a1a2e', borderRadius: 8, padding: 16,
                  border: selectedProforma === v.proforma_data ? '1px solid #00d4ff' : '1px solid #2a2a4a',
                  cursor: 'pointer',
                }} onClick={() => setSelectedProforma(v.proforma_data)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h4 style={{ color: '#ccd6f6', margin: 0, fontSize: 14 }}>v{v.version_number} - {v.version_name}</h4>
                    <span style={{ color: '#8892b0', fontSize: 11 }}>{new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                  {v.proforma_data?.returns && (
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <span style={{ color: '#00d4ff' }}>IRR: {fmtPct(v.proforma_data.returns.irr || 0)}</span>
                      <span style={{ color: '#4ade80' }}>CoC: {fmtPct(v.proforma_data.returns.cashOnCash || 0)}</span>
                      <span style={{ color: '#f59e0b' }}>EM: {(v.proforma_data.returns.equityMultiple || 0).toFixed(2)}x</span>
                      <span style={{ color: '#a78bfa' }}>NOI: {fmtCurrency(v.proforma_data.operations?.noi || 0)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedProforma && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ color: '#ccd6f6', marginBottom: 12 }}>Selected Model Detail</h4>
              {renderProformaTable(selectedProforma)}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes pulse { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }
      `}</style>
    </div>
  );
};

const MetricCard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#0d1117', borderRadius: 6, padding: '8px 12px', textAlign: 'center' }}>
    <div style={{ color, fontSize: 18, fontWeight: 700 }}>{value}</div>
    <div style={{ color: '#8892b0', fontSize: 10, marginTop: 2 }}>{label}</div>
  </div>
);

const Row: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: bold ? '#ccd6f6' : '#8892b0', fontWeight: bold ? 600 : 400 }}>
    <span>{label}</span>
    <span style={{ color: bold ? '#00d4ff' : '#ccd6f6' }}>{value}</span>
  </div>
);

const TabBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: '4px 14px', background: active ? '#1e3a5f' : 'none',
      border: active ? '1px solid #00d4ff' : '1px solid #2a2a4a',
      borderRadius: 6, color: active ? '#00d4ff' : '#8892b0', fontSize: 12,
      cursor: 'pointer', display: 'flex', alignItems: 'center',
    }}
  >
    {children}
  </button>
);

export default OpusProformaBuilder;
