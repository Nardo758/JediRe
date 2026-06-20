# Facet 2: AI Agent Interoperability Standards for Financial Models

**Research Date:** 2026-06-19  
**Scope:** Standards, protocols, and frameworks for connecting AI agents to financial models, APIs, and data sources, with specific focus on real estate underwriting platforms.

---

## 1. Standards for AI Agent-to-API Communication

### 1.1 Model Context Protocol (MCP) — Anthropic

The **Model Context Protocol (MCP)**, introduced by Anthropic in November 2024, has emerged as the dominant open standard for connecting AI applications to external data sources and tools [^1][^2]. It is frequently described as the "USB-C for AI" — a universal connector that eliminates the need for custom integrations between every AI model and every data source [^3][^4].

**Core Architecture:** MCP follows a host-client-server model using JSON-RPC 2.0 [^5]:
- **Host:** The AI application (e.g., Claude, Cursor, ChatGPT) that manages user interactions
- **Client:** The MCP client running within the host that manages connections to servers
- **Server:** Exposes tools (executable operations), resources (read-oriented contexts), and prompts (reusable workflow templates) to AI agents [^6]

**Key Capabilities:**
- **Tool Discovery:** Servers declare capabilities via a manifest; the AI learns what tools are available without manual API documentation [^1]
- **Standardized Invocation:** JSON-RPC 2.0 structures for discovery, invocation, and error handling [^5]
- **Context Management:** Relevant information (conversation history, user state) passes to tools for nuanced operations [^7]
- **Security Control Point:** MCP provides a natural layer for implementing robust security measures [^7]

**Enterprise Adoption:** MCP has been adopted by OpenAI (ChatGPT, Agents SDK, Responses API), Google DeepMind (Gemini), Microsoft (Dynamics 365 migration to MCP), NetSuite, SAP, Oracle, and Docker [^8][^9]. Anthropic donated MCP to the Linux Foundation in 2026 to drive broader interoperability [^10]. The protocol has moved from experimental to production infrastructure, with **16,000+ active servers deployed across enterprises** and millions of weekly SDK downloads [^11].

**Financial Services-Specific Implementations:**
- **Financial Modeling Prep (FMP)** supports MCP, enabling Claude, Cursor, and custom bots to access 70,000+ stock data points without writing API wrapper code [^1]
- **OpenLedger** (embedded accounting API) built an MCP server allowing Claude to interact with ledger data in a structured way [^12]
- **QuantMCP** is a research framework designed to ground LLMs in verifiable financial reality by leveraging MCP to interface with financial data APIs (Wind, yfinance, Tushare, Bloomberg) [^7]
- **Daloopa** integrates with Claude for Finance via MCP connectors, providing accurate, auditable financial data foundations [^8]
- **LSEG (London Stock Exchange Group)** is leveraging MCP to make financial data available to AI models in structured formats, positioning its data as a core part of AI workflows [^9]

### 1.2 Agent-to-Agent (A2A) Protocol — Google

The **A2A Protocol**, launched by Google in April 2025 and contributed to the Linux Foundation, addresses a different tier of interoperability: **peer-to-peer agent communication** rather than model-to-tool [^13][^14].

**Key Features:**
- **Agent Cards:** Capability-based representations that describe what an agent can do and how it can be securely invoked [^15]
- **Communication:** JSON-RPC 2.0 over HTTP(S), with synchronous request/response, streaming (SSE), and asynchronous push notifications [^16]
- **Security:** Enterprise-grade authentication and authorization; agents interact without sharing internal memory or proprietary logic [^16]
- **Partners:** Salesforce, SAP, PayPal, Deloitte, McKinsey, Atlassian, Box, Cohere, Intuit, LangChain, MongoDB, ServiceNow, UKG, Workday [^17]

**Relationship to MCP:** A2A is complementary to MCP. As one engineering assessment notes: "Build with ADK (or any framework), equip with MCP (or any tool), and communicate with A2A, to remote agents, local agents, and humans" [^18]. A2A solves agent-to-agent coordination; MCP solves agent-to-tool/data access.

**Industry analysts project that by 2026, 80% of enterprises will use AI agents, but only 30% will achieve system-level interoperability without a standardized protocol like A2A** [^19].

### 1.3 OpenAI Function Calling / Tool Use

OpenAI's **Function Calling API** (introduced in 2023, evolved into broader "tool use") allows developers to define functions with JSON schemas, and the model produces structured JSON arguments that can be executed by external systems [^20][^21].

**Advantages for Finance:**
- **Structured Output:** Models emit standardized JSON arguments, reducing ambiguity and simplifying downstream processing [^20]
- **System Integration:** Natural-language requests map to function calls that interact with databases, APIs, or computation engines [^20]
- **Workflow Automation:** Enables multi-step pipelines where the LLM determines which functions to call and what parameters to supply [^20]

**Limitations:**
- **Design Overhead:** Developers must carefully specify schemas; poor schemas yield incorrect or incomplete outputs [^20]
- **Latency and Cost:** Function invocation introduces overhead relative to pure text generation [^20]
- **Security:** Model outputs can trigger actions, requiring validation and sanitization [^20]

The **FinAI Data Assistant** research project demonstrates this pattern: it defines a minimal set of parameterized SQL statements for financial data types, then uses an LLM to determine which linking function to use and what parameter values to supply. This concentrates complexity in a small, auditable query library while preserving natural-language interaction [^20].

### 1.4 LangChain Protocols & Framework Ecosystem

**LangChain** is not a protocol but an application framework that has emerged as the leading orchestration layer for building AI agents [^22]. It provides:
- Tool chaining and agent orchestration
- Memory management for stateful workflows
- Integration with external APIs and databases
- Pre-built components for RAG, agents, and multi-step workflows

**LangChain + MCP Integration:** LangChain agents can consume MCP servers. For example, the You.com Finance Research API is available via `langchain-mcp-adapters` [^23]. The relationship is complementary: "LangChain is an application framework... You can use LangChain to create chains of logic, and that agent would then use the MCP protocol to communicate with [financial tools]" [^24].

**Enterprise Pattern:** LangChain + Arcade.dev is a common financial services stack. Arcade serves as the MCP runtime that governs agent access to financial APIs, handling user consent, scoped credentials, tool execution, and audit trails [^25].

### 1.5 Other Emerging Protocols

- **Agent Communication Protocol (ACP):** Launched by IBM in March 2025. Uses RESTful HTTP with MIME-typed multipart messages, supports RBAC and decentralized identity (DID) systems, and includes agent discovery through runtime APIs and manifest-based metadata [^15].
- **Agent Network Protocol (ANP):** Open-source, peer-to-peer (P2P) model allowing agents to autonomously discover, authenticate, and interact without centralized intermediaries [^15].
- **AgentDNS:** A proposed root domain naming system for LLM agents that would standardize cross-vendor service naming, service discovery, authentication, and billing [^26].

---

## 2. Adoption in Financial Services & Real Estate

### 2.1 MCP as the De Facto Standard in Finance

The financial services industry has invested **$35 billion in AI** (2023), with banking accounting for approximately $21 billion. By late 2025, over 70% of institutions were utilizing AI at scale, yet only 38% of AI projects met ROI expectations due to integration challenges [^8]. MCP is solving the "N×M problem" — connecting N models to M data sources — by reducing it to a universal protocol layer [^8][^27].

**Key Financial Services Adopters:**
- **Block (Square)** and **Stripe** are exploring MCP for security, scalability, and governance in multi-tenant environments [^28]
- **Arcade.dev** provides an MCP runtime specifically for FinTech, capital markets, and insurance [^11][^25]
- **Bifrost (Maxim AI)** offers an MCP Gateway for insurance carriers, with SIEM-integrated audit logs, NPI redaction, and underwriting document extraction via MCP [^29]
- **NetSuite** launched its AI Connector Service with native MCP support in August 2025 [^3]
- **Cloudflare** supports MCP for connecting AI agents to external data sources [^28]

### 2.2 Real Estate / CRE Underwriting Platforms

**API-First Architecture is the Norm:** Modern AI real estate underwriting platforms are designed with API-first architectures to connect with existing loan origination systems, property management platforms, and accounting software without requiring complete technology overhauls [^30].

**Leading AI-Powered CRE Underwriting Platforms:**

| Platform | Key AI Capabilities | API/Integration Model |
|----------|-------------------|----------------------|
| **AcquiOS** | OM-to-Excel model in 90s, assumption validation, conflict detection, rent comp verification | Preserves existing Excel/PowerPoint templates; API-first [^31][^32] |
| **Smart Capital Center** | Full AI-powered ingestion from all CRE docs, automated DCF, lender matching | Cloud-native, API connectors, pre-built integrations [^33] |
| **Blooma** | AI-powered credit analysis (5,000 data points per deal), portfolio stress testing | Sits on top of existing LOS via API; connects to FIS, Jack Henry [^34] |
| **Clik.ai** | Rent roll & operating statement extraction, automated scenario modeling | Integrates multifamily financials and market comps via CRED iQ [^35] |
| **Archer** | Multifamily underwriting with AI parsing, comps benchmarking | Flexible API column configuration [^36] |
| **Docsumo** | Document processing for rent rolls, T12s, OMs; OCR + human-in-the-loop | Export and integration with downstream systems [^37] |
| **V7 Go** | Lease abstraction, document analysis, source-cited extraction | Direct integration with models and CRMs [^38] |

**Grihum Housing Finance** (India) is deploying OutSystems Agent Workbench with MCP support to improve loan underwriting accuracy and streamline property evaluations, replacing manual, error-prone workflows [^39][^40].

**MIT Research (2025)** on AI in CRE underwriting identified that GenAI is most suitable for document summarization, performance analysis, and autogenerated lease contracts when deployed using open-source models or private in-house LLMs — offering better privacy and customization than third-party APIs [^35].

---

## 3. Security, Authentication, and Permission Requirements

### 3.1 Core Security Principles

AI agents introduce fundamentally different security risks than traditional software because they are **probabilistic, autonomous, and can chain multiple actions across systems** [^41][^42].

**The AWARE Framework for Agent Governance** (Atlan) provides a structured lens [^43]:

| Dimension | Coverage |
|-----------|----------|
| **A — Actor Intent** | Who or what is acting, on whose behalf, for what job |
| **W — Work Context** | Whether requested data/actions are appropriate for the user, task, and moment |
| **A — Autonomous Guardrails** | Runtime policies constraining agent purpose, tools, and data access |
| **R — Real-time Risk Scoring** | Continuous assessment of agent activity with automated blocking and escalation |
| **E — Ecosystem Observability** | End-to-end traceability of agent actions across systems for audit and forensics |

### 3.2 Authentication & Authorization Patterns

**Individual Agent Identities:** Every AI agent must have a distinct identity, separate from human users. Common approaches include service accounts, API keys, OAuth-based flows, and integration with enterprise IAM systems [^44][^45].

**Least Privilege Access:** Agents should receive only the minimum permissions required for their tasks. A support bot might need read-only access to user profiles and ticket creation, but should be blocked from billing or admin functions [^46].

**Context-Aware Authorization (ABAC):** Access decisions should be dynamic based on factors like task type, data sensitivity, time of day, and agent behavior patterns [^46]. Auth0's Fine-Grained Authorization (FGA) enables policies like: *"Allow access to user data only during business hours, and only for users who've opted in to AI support"* [^46].

**Time-Bound Access:** Agents with elevated privileges should have permissions that expire after a defined window (e.g., one hour) [^46].

**Resource-Level Control:** Instead of blanket API access, restrict agents to specific records, files, or components [^46].

### 3.3 MCP-Specific Security Considerations

MCP provides structure, but security depends on implementation. Key requirements include [^5]:
- Designing least-privilege access for every server
- Using explicit, scoped authorization rather than broad credentials
- Separating read-only context servers from mutation-capable tools
- Logging all tool invocations with session context
- Applying prompt-injection controls to any server that can relay untrusted content

**Arcade.dev's MCP Runtime** implements a "zero-token-exposure" architecture: LLMs never see banking credentials, payment tokens, or API keys. Arcade manages tokens and secrets rather than raw financial data, retrieving encrypted OAuth tokens only at execution time with validated user context [^25]. This separation of reasoning from execution is the foundation of compliant AI agent deployments for PCI DSS, SOC 2, and banking regulations [^25].

### 3.4 Emerging Threats Unique to Agentic AI

Research has identified **new threat categories** specific to autonomous agents [^47][^48]:

| Threat | Description | Mitigation |
|--------|-------------|------------|
| **Tool Poisoning** | Attackers influence content of tools/data sources agents interact with, injecting instructions that override intended behavior | Test tool poisoning scenarios; enforce permissions at a layer the agent cannot override; sanitize external content before entering agent context [^47] |
| **Goal Hijacking** | Adversarial signals cause agents to reinterpret high-level objectives in ways that serve attacker interests | Detect goal drift; require human review of reasoning traces, not just action logs [^47] |
| **Action Escalation** | Agents discover or are induced to expand their own capabilities — creating accounts, modifying permissions, accessing stored credentials | Prohibit self-modification of permissions; trigger human oversight for any action that would expand agent capabilities [^47] |
| **Cascading Agent Failures** | One compromised agent influences others in multi-agent systems, creating chain reactions | Per-agent isolation of trust boundaries; cross-agent behavioral monitoring for coordinated anomalies [^47] |
| **Prompt Injection** | Attackers hide malicious instructions in tool outputs, causing agents to leak sensitive data or take unauthorized actions | Deploy prompt filtering and injection detectors; fine-tune agents to ignore unauthorized instructions; limit scope of sensitive actions [^49] |

**Critical Statistic:** By 2028, **25% of enterprise breaches are expected to involve AI agent misuse**, and **80% of companies report agents accessing unauthorized systems** [^45]. A Deloitte report reveals that **74% of companies plan to use AI agents within two years, but only 21% have implemented proper governance frameworks** [^50].

---

## 4. How Existing Platforms Expose Financial Models to External AI

### 4.1 API-First Underwriting Platforms

Modern underwriting platforms expose financial models through **REST APIs** that can be consumed by external AI agents, but the emerging pattern is to expose them as **MCP servers** for AI-native consumption.

**Current Exposure Patterns:**
- **Template Preservation:** AcquiOS and Smart Capital Center populate the user's existing Excel templates rather than replacing them, preserving formulas, formatting, and structure [^31][^33]
- **Structured Data APIs:** Platforms like Blooma return structured risk assessments via API that can be consumed by loan origination systems (FIS, Jack Henry) [^34]
- **Document-to-Model APIs:** Clik.ai and Docsumo extract structured data from PDFs/Excel and return normalized JSON that can feed into financial models [^35][^37]

### 4.2 MCP Server Wrappers for Financial APIs

The emerging pattern is to wrap existing financial APIs with MCP servers:
- **FMP MCP Server:** Wraps the Financial Modeling Prep API, exposing tools like `quote`, `balance_sheet`, `earnings` that any MCP client can discover and call [^1]
- **OpenLedger MCP Server:** Wraps an embedded accounting API, allowing Claude to interact with transactions, companies, and financial entities [^12]
- **Portfolio Manager MCP Server:** Wraps investment portfolio APIs (Finnhub, Polygon.io), serving as a template for building custom financial MCP servers [^24]

### 4.3 What Would It Take for Third-Party AI to Connect?

For a third-party AI agent to connect to a real estate underwriting platform and autonomously build/validate financial models, the platform would need to expose:

1. **MCP Server or A2A Agent Card:** Declaring available tools (e.g., `extract_rent_roll`, `build_dcf_model`, `validate_assumptions`) with input schemas and authentication requirements
2. **Read/Write Capabilities:** The AI agent needs to both read source data (OMs, rent rolls, T12s) and write to financial models (Excel cells, database records)
3. **Deterministic Calculation Engine:** As HyperFormula's AI SDK demonstrates, agents need access to deterministic spreadsheet engines (Excel-compatible formula evaluation) rather than asking LLMs to do math [^51]
4. **Dependency Tracing:** Precedents and dependents must be surfaced so the agent can explain how every value was derived [^51]
5. **Audit Hooks:** Every tool call must be logged with session context, user identity, and data accessed [^25]

**Critical Gap:** Most existing CRE platforms are **closed systems** or offer **limited APIs** focused on data ingestion rather than model manipulation. The shift to MCP-native financial modeling is still early.

---

## 5. Role of Function Calling / Tool Use in Financial Model Automation

### 5.1 The Pattern: Natural Language → Structured JSON → Function Execution

Function calling (tool use) is the bridge between an LLM's natural language understanding and deterministic financial computation. The typical flow is [^20][^52]:

1. **Function Definition:** Developer specifies tool names, descriptions, and parameter schemas (e.g., `calculate_noi`, `run_scenario`, `validate_cap_rate`)
2. **Model Invocation:** User asks a natural language question; the model decides whether to call a function
3. **Function Execution:** The application validates the JSON arguments, dispatches to the actual computation engine, and returns results
4. **Model Synthesis:** The LLM crafts a human-readable response based on the verified computation results

### 5.2 Why This Matters for Financial Models

**Eliminates Hallucination in Calculations:** Rather than asking an LLM to calculate IRR or NPV (which it may do incorrectly), the LLM calls a deterministic financial engine. HyperFormula's AI SDK for Vercel explicitly addresses this: agents run Excel-compatible formulas through HyperFormula instead of asking the LLM to do math, producing "exact, reproducible, and auditable" results [^51].

**Enables Multi-Step Workflows:** A single underwriting request can trigger a chain of tool calls:
- `extract_rent_roll` → `clean_and_standardize` → `build_dcf_model` → `run_sensitivity_analysis` → `generate_ic_memo`

**Standardizes Interface:** Once tools are defined via MCP, any AI agent can discover and use them without custom integration code [^1].

### 5.3 Spreadsheet-Specific Agentic Patterns

Research on LLM agents for spreadsheet tasks (2026) reveals both the potential and current limitations [^53]:
- Agents can produce structured Excel Tables, schema-aware formulas, and visually rich dashboards
- However, even on "Very Easy" tasks, agents often make fundamental errors (e.g., missing offsetting decreases in accounts receivable calculations) [^53]
- On complex tasks (Hard-level ModelOff Finals financing waterfall requiring 20,925 formulas), agents may fabricate completion or abandon tasks [^53]
- The **read-to-write ratio** shifts dramatically as complexity increases — from 0.09 on Easy tasks to 0.99 on Hard tasks, meaning agents spend most of their time inspecting rather than building [^53]

The **BRTR (Beyond Rows to Reasoning)** framework introduces an iterative tool-calling loop for spreadsheet understanding, achieving state-of-the-art performance by replacing single-pass retrieval with multi-step reasoning and maintaining full auditability through explicit tool-call traces [^54].

### 5.4 Financial Modeling Tools with Native Agent Support

| Tool | Agent/AI Capability | Integration Pattern |
|------|-------------------|-------------------|
| **Microsoft Copilot (Excel)** | Native in Excel; generates formulas, pivot tables, summaries from natural language | Deep Microsoft 365 integration; struggles with complex multi-document workflows [^55] |
| **Claude for Excel** | Add-in that reads workbook content and generates formulas; understands financial modeling conventions | Anthropic-hosted; reads cells, formulas, tab structure; highlights changes for review [^56] |
| **Shortcut** | Excel add-in built specifically for financial analysis and modeling | Formula generation, financial analysis, integrates with existing Excel workflows [^57] |
| **Daloopa Excel Add-in** | Pre-integrated financial data from 5,000+ public companies; native Excel functions | MCP integration or direct API; built-in data quality controls [^58] |
| **HyperFormula AI SDK** | Deterministic Excel-compatible formula evaluation via Vercel AI SDK tool calls | Typed tool calls for read/write cells, trace dependencies, 400+ built-in functions [^51] |

---

## 6. Compliance Implications of AI Agents Modifying Financial Assumptions

### 6.1 The Regulatory Landscape

Regulators are catching up to agentic AI. Frameworks now require documentation, controls, and human oversight for AI systems that take actions on behalf of organizations [^59]:

| Framework | Relevant Requirements for AI Agents in Finance |
|-----------|-----------------------------------------------|
| **SOX (Sarbanes-Oxley)** | Financial reporting integrity requires traceability for any automated system that touches financial data. Every agent action must be auditable [^59] |
| **FINRA** | 2026 oversight priorities explicitly include AI governance; firms must capture prompts, outputs, and version histories to support supervision, audits, and investigations [^59] |
| **GDPR Article 22** | Automated decisions with legal or significant effects on individuals require human intervention, the right to express a point of view, and the right to contest the decision [^60] |
| **ISO 42001** | International AI management systems standard requiring organizations to identify AI risks, implement operational controls, maintain monitoring/logging, and ensure human oversight [^59] |
| **HIPAA** | Healthcare organizations must track every access to PHI, including accesses made by AI agents; audit trails must capture who, what, when, and why [^59] |
| **EU AI Act** | High-risk AI systems (including credit scoring, insurance pricing) require conformity assessments, risk management, data governance, transparency, human oversight, and accuracy [^61] |
| **SEC Rule 15c3-5 / FINRA Rule 3110 / OCC Bulletin 2011-12** | Financial regulatory mandates for compliance certainty, explainability, and risk management [^62] |
| **21 CFR Part 11** | Life sciences standard requiring immutable, timestamped audit log entries for every action, including the data source, records read, calculations performed, and human reviewer identity [^63] |

### 6.2 Audit Trail Requirements

For AI agents modifying financial assumptions, organizations must maintain [^59][^60][^64]:

- **Original goal or trigger:** What initiated the agent's action
- **Plan generated:** The agent's reasoning and planned steps
- **Each tool call:** Inputs, outputs, and the reasoning at each decision point
- **Human approvals or interventions:** Who approved, when, and why
- **Final outcome:** The completed action and its effects
- **Data provenance:** Source of every data point used in the model
- **Confidence scores:** The agent's certainty level for each decision
- **Version history:** Model versions, prompt versions, and tool versions used

**The Lean-Agent Protocol** (research, 2026) proposes a formal-verification-based approach using Lean 4 theorem proving: every proposed agentic action is treated as a mathematical conjecture, and execution is permitted **if and only if** the Lean 4 kernel proves that the action satisfies pre-compiled regulatory axioms. This provides "cryptographic-level compliance certainty at microsecond latency" [^62].

### 6.3 Human-in-the-Loop (HITL) Governance

A tiered governance model is recommended based on the consequence of agent actions [^64]:

| Tier | Action Type | Approval Model | Examples |
|------|-------------|---------------|----------|
| **Tier 1** | Low-risk, reversible | Autonomous execution | Reading data, classifying documents, generating draft responses |
| **Tier 2** | Medium-risk | Approval required | Sending external communications, creating purchase orders below threshold, modifying records |
| **Tier 3** | High-risk or irreversible | Human execution | Large financial commitments, legal filings, changing trust boundaries, modifying security policies |

**CIBA (Client-Initiated Backchannel Authentication)**, part of OpenID Connect, enables asynchronous user consent for high-risk AI agent actions. When an agent attempts a sensitive operation, the workflow pauses and requests human approval via mobile push, email, or SMS, maintaining complete context for the reviewer [^65].

**Vantyx's VRegulus Platform** demonstrates the regulatory-grade model: the AI has **read-only access** to non-authoritative data views and provides recommendations **without modifying data, confirming accuracy, or approving outcomes**. All data changes are executed exclusively by authorized personnel within validated systems, with stage-gated QA/QC approval gates and immutable audit trails [^63].

### 6.4 Fair Lending and Bias Concerns

AI real estate underwriting systems used in lending decisions are subject to **fair lending regulations** requiring lenders to demonstrate that automated systems do not produce discriminatory outcomes based on protected characteristics [^30]. Requirements include:
- Model documentation explaining how the AI reaches outputs
- Regular bias testing against demographic data
- Human override procedures for individual credit decisions
- Engagement of compliance counsel before deployment
- Ongoing model audit documentation [^30]

---

## 7. Real-World Examples of AI Agents Autonomously Underwriting Deals

### 7.1 Insurance Underwriting: Otera

**Otera** operates specialized AI agents that run every stage of insurance underwriting autonomously, from broker submission through bind and system-of-record sync, under continuous governance [^66].

**Capabilities:**
- Assembles validated risk data, normalized terms, and assessment signals into pricing inputs
- Applies configurable rating rules, loading factors, and underwriting adjustments by line and risk class
- Generates broker-ready quote documents with full supporting rationale
- Maps submissions against authority matrices, routes requests with full context, and escalates automatically when SLAs approach deadlines
- Executes bind instructions directly from the governed pipeline, eliminating rekeying

**Guardrails:**
- Authority management with deterministic routing and real-time tracking
- Complete auditability for internal compliance and external regulators
- 99.9%+ post-validation accuracy claimed [^66]

### 7.2 CRE Underwriting: AcquiOS

**AcquiOS** is an AI-native platform specifically for commercial real estate underwriting that demonstrates a near-autonomous workflow [^31][^32]:

**Workflow:**
1. Forward a broker email or upload an OM
2. AI extracts data and populates the user's existing Excel template with citation-sourced assumptions
3. IRR recalculates in 5–10 seconds as inputs are adjusted
4. Assumptions are cross-referenced against market comps and comparable sales
5. AI maps every party in the deal and surfaces undisclosed relationships
6. An AI agent independently verifies rental comparables
7. Investment committee presentations are generated in the user's PowerPoint template

**Human-in-the-Loop:** Complex deals, unusual circumstances, or high-value transactions get automatically flagged for human review, while routine applications process automatically [^30].

**Outcomes:** 95% reduction in OM data extraction time; 90 seconds from broker email to first model; 5–10 hours saved per IC deck; 20x deal volume with same headcount [^31].

### 7.3 NBFC / Personal Loan Underwriting: DigiQt

**DigiQt** deploys AI agents for non-banking financial companies that handle onboarding, underwriting, servicing, collections, and compliance [^67].

**Architecture:**
- Reasoning core powered by an LLM with domain prompts and policies
- Retrieval from knowledge bases (product policies, rate cards, collections playbooks)
- Tool use via APIs to LOS, LMS, KYC vendors, credit bureaus, payment gateways
- Guardrails: PII redaction, role-based access, approval checkpoints
- Memory to persist conversation and case context across channels

**Underwriting Triage Agent:** Compiles bank statement summaries, fraud checks, and risk flags autonomously, escalating to humans when confidence is low [^67].

### 7.4 Housing Finance: Grihum + OutSystems

**Grihum Housing Finance** (India) is deploying **OutSystems Agent Workbench** with MCP support to improve loan underwriting accuracy and streamline property evaluations [^39][^40]. Specialized agents analyze property evaluation reports and suggest appropriate technical property deviations during loan origination, replacing previously manual, error-prone workflows.

**OutSystems Agent Workbench** supports:
- MCP for giving agents direct access to enterprise systems, external tools, and services
- AWS Bedrock, Azure OpenAI, Anthropic, Gemini, Cohere, Mistral, Databricks, WatsonX
- Policies, auditability, and compliance across the agent lifecycle [^40]

### 7.5 Mortgage & Insurance: Sapiens / Agentic AI

**Sapiens** describes a mortgage industry scenario where agentic AI systems automatically adjust loan-to-value ratios when interest rates shift, based on preset risk parameters. This change triggers another agent that scans a servicing book and identifies customers for refinancing offers [^68].

**Guardrails:** Parameter-driven business logic supported by agents ensures automation is optimized within constraints applied by industry, jurisdictional legislation, and business owners. This represents a dramatic compression of business logic lifecycles — from weeks/months to near real-time [^68].

### 7.6 Indian Outsourcing Hubs: Agentic Risk Orchestration (2026)

By 2026, Indian underwriting outsourcing hubs have transitioned from "administrative support" to **Autonomous Risk Orchestration**, utilizing Agentic AI to ingest multi-modal data (IoT, satellite, wearables) and generate preliminary risk assessments in real-time [^69].

**Key Metrics:**
- 75% increase in productivity for underwriting strategists
- 25% better loss ratios through real-time predictive risk profiling
- 100% audit traceability through algorithmic guardrails
- 30% reduction in total cost of ownership (TCO) for US, UK, and Australian carriers [^69]

### 7.7 Research Framework: QuantMCP

The **QuantMCP** framework (academic, 2025) is explicitly designed to enable LLMs to autonomously build and validate financial models by:
- Interpreting natural language requests for financial information
- Employing MCP to select, parameterize, and invoke appropriate tools (wrappers around Python financial data APIs)
- Ensuring all financial data is sourced directly from authoritative providers in real-time, eliminating hallucination [^7]

This framework can interface with commercial providers (Wind, Bloomberg) and open sources (yfinance, Tushare, Alpha Vantage), providing a standardized interface for multiple LLMs [^7].

---

## 8. Key Takeaways for the Deal Capsule

### 8.1 What It Would Take for Third-Party AI to Connect to a RE Underwriting Platform

To enable a third-party AI agent to connect to a real estate underwriting platform and autonomously build/validate financial models, the platform must:

1. **Expose an MCP Server or A2A Agent Card** declaring available tools (`extract_rent_roll`, `populate_dcf`, `validate_assumptions`, `run_scenario`) with JSON schemas
2. **Implement Scoped Authentication** using OAuth 2.1 + PKCE, with per-user, per-tool authorization rather than blanket API keys
3. **Separate Read and Write Operations** into distinct MCP servers or tools, with read-only as default
4. **Provide a Deterministic Calculation Engine** (Excel-compatible or similar) that the agent invokes via tool calls rather than performing math itself
5. **Log Every Tool Invocation** with session context, user identity, data accessed, and operation result — exported to SIEM (Splunk, Datadog) for compliance
6. **Implement Tiered HITL Governance:** Autonomous for data extraction, approval-required for assumption changes, human-execution for capital commitments
7. **Support Template Preservation:** Output to the firm's existing Excel/PowerPoint templates rather than forcing new formats
8. **Maintain Full Audit Trail:** Including data provenance, confidence scores, model versions, and human reviewer identity

### 8.2 Critical Gaps

- **Closed Platforms:** Most CRE underwriting platforms (ARGUS, some versions of Dealpath) are not designed for external AI consumption; they are desktop or monolithic web apps
- **Standardization:** No universal standard yet exists for *financial model-specific* MCP tools; each platform implements its own schema
- **Determinism:** LLMs still struggle with complex multi-sheet Excel modeling; deterministic engines (HyperFormula) are nascent
- **Governance:** Only 21% of companies have proper AI governance frameworks; the gap between deployment speed and safety controls is widening [^50]
- **Compliance:** Regulatory frameworks (FINRA, SOX, fair lending) are still evolving to address AI-specific risks like tool poisoning and goal hijacking

### 8.3 Strategic Implications

The convergence of MCP as the dominant model-to-tool protocol and A2A as the emerging agent-to-agent protocol creates a **dual-protocol architecture** for the future of AI-powered underwriting:
- **MCP** enables the underwriting platform to expose its data extraction, model building, and validation tools to any AI agent
- **A2A** enables specialized agents (document extraction, market research, financial modeling, risk assessment) to collaborate autonomously on a single deal
- **MCP + A2A together** could enable an ecosystem where a "Deal Sourcing Agent" discovers an opportunity, delegates to an "Underwriting Agent" via A2A, which uses MCP tools to access the platform's DCF engine, market data, and risk models — all within governed, auditable boundaries

The institutions moving first on MCP adoption are not just gaining efficiency; they are building enterprise AI architecture that will define competitive advantage for the next decade [^8].

---

## References

[^1]: Financial Modeling Prep. "AI Agent (MCP Server) - Financial Modeling Prep." https://site.financialmodelingprep.com/developer/docs/mcp-server

[^2]: Hou, X. et al. "Model Context Protocol (MCP): Landscape, Security..." https://arxiv.org/pdf/2503.23278

[^3]: Hopper, Glenn. "Unleashing Enterprise AI Value in Finance: The CFO's Guide." NetSuite, 2026. https://cdn.base.parameter1.com/.../wp-unleashing-enterprise-ai-value-in-finance...

[^4]: Coderio. "Model Context Protocol (MCP): The Enterprise AI Standard Explained." 2026. https://www.coderio.com/blog/innovation/mastering-ai-integration-model-context-protocol/

[^5]: Coderio FAQ. MCP vs API, security, technical implementation. https://www.coderio.com/blog/innovation/mastering-ai-integration-model-context-protocol/

[^6]: Duc Xinh. "What is MCP (Model Context Protocol)?" 2025. https://www.ducxinh.com/en/techblog/what-is-mcp-(model-context-protocol)-understanding-the-standardized-protocol-for-ai-agent-integration

[^7]: QuantMCP Paper. "Grounding Large Language Models in Verifiable Financial Reality." arXiv:2506.06622v2, 2025. https://arxiv.org/html/2506.06622v2

[^8]: Daloopa. "The MCP Revolution: How Model Context Protocol Will Transform Finance Roles." 2026. https://daloopa.com/blog/analyst-best-practices/the-mcp-revolution-how-model-context-protocol-will-transform-finance-roles

[^9]: Fintech.Global. "How MCP is reshaping AI workflows in finance." Nov 2025. https://fintech.global/2025/11/14/how-mcp-is-reshaping-ai-workflows-in-finance/

[^10]: CRN Asia. "Anthropic opens India office as revenue doubles..." Feb 2026. https://www.crnasia.com/india/news/2026/anthropic-opens-india-office...

[^11]: Arcade.dev. "Enterprise MCP Guide For FinTech & Financial Institutions." 2025. https://www.arcade.dev/blog/authors/arcade-dev-team/

[^12]: GitHub - openledger/Open-Ledger-MCP-Server. https://github.com/openledger/Open-Ledger-MCP-Server

[^13]: A2A Protocol Official. https://a2a-protocol.org/latest/

[^14]: Zapyan. "AI Agent Interoperability: The A2A Protocol." Feb 2026. https://zapyan.com/ai-agent-interoperability-a2a-protocol/

[^15]: arXiv Survey. "A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, and ANP." 2025. https://arxiv.org/html/2505.02279v2

[^16]: GitHub - a2aproject/A2A. https://github.com/a2aproject/A2A

[^17]: Salvador Vilalta. "Agent2Agent (A2A): Google's Revolutionary Protocol." Apr 2025. https://salvadorvilalta.com/en/agent2agent-a2a-googles-revolutionary-protocol-for-ai-agent-interoperability/

[^18]: a2a-protocol.org. "What is A2A Protocol?" https://a2a-protocol.org/latest/

[^19]: Efficiently Connected. "Google Announces Agent2Agent (A2A) Protocol." Apr 2025. https://www.efficientlyconnected.com/google-announces-agent2agent-a2a-protocol-to-enable-secure-ai-agent-interoperability/

[^20]: arXiv:2510.14162v1. "FinAI Data Assistant: LLM-based Financial Database Query Processing with the OpenAI Function Calling API." Oct 2025. https://arxiv.org/html/2510.14162v1

[^21]: OpenAI Community. "In prep for fine tuned models support for function calls..." Sept 2023. https://community.openai.com/t/in-prep-for-fine-tuned-models-support-for-function-calls...

[^22]: 1delta. "LangChain vs ElizaOS vs OpenClaw: DeFi Lending." May 2026. https://www.1delta.io/blog/langchain-vs-elizaos-vs-openclaw-defi-lending

[^23]: LangChain Blog. "EU macroeconomic analysis with Deep Agents, LangSmith, and You.com Finance Research API." May 2026. https://www.langchain.com/blog/financial-ai-that-investigates-macro-trends...

[^24]: Skywork AI. "Portfolio Manager MCP Server: The Ultimate Guide." Mar 2025. https://skywork.ai/skypage/en/ai-engineers-portfolio-manager-guide/...

[^25]: Arcade.dev. "Production-Ready AI Agents for Financial Services." Nov 2025. https://blog.arcade.dev/build-ai-agents-for-fintech-payments

[^26]: arXiv:2505.22368. "AgentDNS: A Root Domain Naming System for LLM Agents." https://arxiv.org/pdf/2505.22368

[^27]: "The Big Book of Enterprise AI Agent Use Cases." Shakudo. https://cdn.prod.website-files.com/.../The%20Big%20Book%20of%20Enterprise%20AI%20Agent%20Use%20Cases...

[^28]: Hou et al. MCP Landscape paper. Industry adoption section. https://arxiv.org/pdf/2503.23278

[^29]: Maxim AI Bifrost. https://www.getmaxim.ai/bifrost/industry-pages/insurance

[^30]: GrowthFactor AI. "AI Real Estate Underwriting: Speed & Accuracy 2026." May 2025. https://www.growthfactor.ai/resources/blog/ai-real-estate-underwriting

[^31]: AcquiOS. "AI Real Estate Underwriting: Speed & Accuracy." https://acquios.ai/cre

[^32]: AcquiOS Blog. "The Complete Guide to AI-Powered CRE Underwriting." Apr 2026. https://acquios.ai/blog-cre-underwriting-guide

[^33]: Smart Capital Center. "Top CRE Investment Underwriting Software Compared." May 2026. https://smartcapitalcenter.com/blog-post/top-cre-investment-underwriting-software-and-automation-platforms-compared

[^34]: BestCRE. "Blooma - CRE Underwriting & Deal Analysis." May 2026. https://bestcre.com/category/best-cre-underwriting-deal-analysis/

[^35]: MIT Thesis (Jaklis). "AI and ML in Real Estate Underwriting." 2025. https://dspace.mit.edu/bitstream/handle/1721.1/163306/jaklis-cjaklis-msms-mgt-2025-thesis.pdf

[^36]: Adventures in CRE. "AI Tools for Commercial Real Estate (Summer 2026 Edition)." May 2026. https://www.adventuresincre.com/ai-tools-commercial-real-estate/

[^37]: AI CRE Tools. "Docsumo." Feb 2026. https://www.aicretools.com/docsumo

[^38]: V7 Labs. "AI in Commercial Real Estate Investment." Nov 2025. https://www.v7labs.com/blog/ai-in-cre-investment

[^39]: OutSystems. "Agent Workbench General Availability." Sept 2025. https://www.outsystems.com/news/agent-workbench-general-availability/

[^40]: ITBrief. "OutSystems launches Agent Workbench." Oct 2025. https://itbrief.co.uk/story/outsystems-launches-agent-workbench-for-unified-enterprise-ai

[^41]: Atlan. "AI Agent Risks & Guardrails: 2026 Enterprise Security Guide." Apr 2026. https://atlan.com/know/ai-agent-risks-guardrails/

[^42]: arXiv:2605.16471. "The Perils of Agency: How Developers Perceive, Prioritize, and Address Risks in Agentic AI Products." May 2026. https://arxiv.org/html/2606.15485v1

[^43]: Atlan AWARE Framework. https://atlan.com/know/ai-agent-risks-guardrails/

[^44]: Witness AI. "AI Agent Access Control Guide." Mar 2026. https://witness.ai/blog/ai-agent-access-control/

[^45]: Prefactor. "5 Best Practices for AI Agent Access Control." Mar 2026. https://prefactor.tech/blog/5-best-practices-for-ai-agent-access-control

[^46]: WorkOS. "Securing AI agents: A guide to authentication, authorization, and defense." Jun 2025. https://workos.com/blog/securing-ai-agents

[^47]: Hjazeen, Michel. "SOC 2 for AI Systems: The Missing Controls Framework." Feb 2026. https://www.michelhjazeen.com/articles/soc2-ai-systems-missing-controls-framework

[^48]: arXiv:2605.16471. Agentic AI security research. https://arxiv.org/pdf/2605.16471

[^49]: AI Security Intelligence. "AI Incident Response Playbook Suite." https://aisecurityintelligence.com/downloads/AI-Incident-Response-Playbook-Suite.pdf

[^50]: WireUnwired. "Companies Rush AI Agents Into Production—Only 21% Have Safeguards." Jan 2026. https://wireunwired.com/companies-rush-ai-agents-into-production-only-21-have-safeguards/

[^51]: HyperFormula. "AI SDK for Vercel." https://hyperformula.handsontable.com/docs/guide/ai-sdk.html

[^52]: Menlo VC. "AI Agents: A New Architecture for Enterprise Automation." Sept 2024. https://menlovc.com/perspective/ai-agents-a-new-architecture-for-enterprise-automation/

[^53]: arXiv:2605.22664v2. "Evaluating LLM Agents on End-to-End Spreadsheet Tasks in Finance." Jun 2026. https://arxiv.org/html/2605.22664v2

[^54]: arXiv:2603.06503v1. "Agentic Retrieval for Multimodal Spreadsheet Understanding and Editing." Mar 2026. https://arxiv.org/html/2603.06503v1

[^55]: V7 Labs. "Best AI for Excel: Financial Modeling Guide [2026]." Jan 2026. https://www.v7labs.com/blog/best-ai-for-excel

[^56]: Anthropic Support. "Use Claude for Excel." Mar 2026. https://support.claude.com/en/articles/12650343-use-claude-in-excel

[^57]: Wall Street Prep. "Ranking the Best AI Tools for Financial Modeling (2026)." Feb 2026. https://www.wallstreetprep.com/knowledge/ranking-the-best-ai-tools-for-financial-modeling-2026/

[^58]: Daloopa. "LLMs for Financial Data Analysis: Excel Integration Strategies." Jan 2026. https://daloopa.com/blog/analyst-best-practices/llms-for-financial-data-analysis-excel-integration-strategies

[^59]: Maybe Don't. "Governance & Compliance." https://maybedont.ai/solutions/governance-compliance/

[^60]: OmniOps Terms of Service. "Autonomous AI Agent Actions." https://www.omniops.co.uk/terms

[^61]: MeritData. "Guardrails & Ethics for Autonomous Agents." https://www.meritdata-tech.com/resources-post/guardrails-ethics-autonomous-agents

[^62]: Rashie, Devakh & Rashi, Veda. "Type-Checked Compliance: Deterministic Guardrails for Agentic Financial Systems Using Lean 4 Theorem Proving." arXiv:2604.01483v1, 2026. https://arxiv.org/html/2604.01483v1

[^63]: Vantyx. "VRegulus Platform." https://www.vantyxtech.com/

[^64]: McKenna Consultants. "Building AI Agents for Enterprise Automation: A Practical Guide." Jul 2025. https://www.mckennaconsultants.com/building-ai-agents-for-enterprise-automation-a-practical-guide/

[^65]: Okta. "The role of AI in IAM: Securing the agentic frontier." Mar 2026. https://www.okta.com/en-au/identity-101/role-of-ai-in-iam/

[^66]: Otera. "Autonomous AI Agents for Underwriting." Jun 2026. https://www.otera.ai/solutions/insurance-autonomous-underwriting

[^67]: DigiQt. "AI Agents in NBFCs: Proven Gains, Fewer Pitfalls." Sept 2025. https://digiqt.com/blog/ai-agents-for-nbfcs/

[^68]: Sapiens. "What's Next for Agentic AI?" Dec 2025. https://sapiens.com/resources/blog/whats-next-for-agentic-ai/

[^69]: Cynergy BPO. "Underwriting Outsourcing India: The Agentic & Risk-Adaptive Frontier." Feb 2026. https://cynergybpo.com/blog/underwriting-outsourcing-india-agentic-risk-adaptive-frontier/

[^70]: CFA Institute. "Agentic AI for Finance: Workflows, Tips, and Case Studies." Dec 2024. https://rpc.cfainstitute.org/research/the-automation-ahead-content-series/agentic-ai-for-finance

[^71]: Leanware. "Agentic AI Guardrails: How to Build Safe and Scalable Autonomous Systems." Feb 2026. https://www.leanware.co/insights/agentic-ai-guardrails-how-to-build-safe-and-scalable-autonomous-systems

[^72]: Galileo AI. "Essential Framework for AI Agent Guardrails." Dec 2025. https://galileo.ai/blog/ai-agent-guardrails-framework

[^73]: Notch CX. "AI Agent Guardrails & Escalations in Regulated Industries." Jun 2026. https://www.notch.cx/post/guardrails-and-escalations-for-ai-agents-in-regulated-industries

[^74]: Kakunin. "AI Agent Guardrails: Taming Autonomous AI Systems." May 2026. https://www.kakunin.ai/blog/guardrails-for-ai-agents

[^75]: Auth0. "MCP vs A2A: A Guide to AI Agent Communication Protocols." Jul 2025. https://auth0.com/blog/mcp-vs-a2a/

[^76]: Yodaplus. "MCP vs. LangChain Agents vs. AutoGen: Which Protocol Wins Where?" Apr 2025. https://yodaplus.com/blog/mcp-vs-langchain-agents-vs-autogen-which-protocol-wins-where/

[^77]: ChatFin. "OpenAI GPT 5 API: Building Finance AI Agents for Enterprises." Feb 2026. https://chatfin.ai/blog/openai-gpt-5-api-building-finance-ai-agents-for-enterprises/

[^78]: OpenClaw / CodeBridge. "OpenClaw Approval Design: What Needs Human Sign-Off." May 2026. https://www.codebridge.tech/articles/openclaw-approval-design-what-actually-needs-human-sign-off-in-a-production-workflow

[^79]: AI for CRE Collective. "AI Underwriting Models in Commercial Real Estate." Apr 2026. https://aiforcrecollective.com/ai-underwriting-models-commercial-real-estate/

[^80]: Virtual Workforce. "AI Agents for REITs." Feb 2026. https://virtualworkforce.ai/ai-agents-for-reits/

[^81]: A-Team Insight. "Anthropic's Financial Industry Claude Iteration." Feb 2026. https://a-teaminsight.com/blog/anthropics-financial-industry-claude-iteration-aimed-at-easing-ai-adoption/
