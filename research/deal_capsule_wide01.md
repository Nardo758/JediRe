# Institutional Real Estate Deal Sharing Landscape — Research Findings

**Date:** 2026-06-19  
**Scope:** How pension funds, family offices, REITs, and institutional GPs share underwriting models, deal memos, and financial analysis with partners.  
**Sources:** Industry publications, vendor sites, institutional investor guidelines, and proptech market analyses.

---

## 1. How do institutional RE investors currently share deal underwriting models?

### Excel Remains the Lingua Franca
Despite the proliferation of specialized software, **Microsoft Excel continues to dominate institutional real estate analysis** [^5]. Its flexibility allows modeling of any property type, deal structure, or partnership arrangement without software constraints. Every real estate professional knows Excel, enabling universal sharing with partners, lenders, and asset managers without compatibility issues or license barriers [^5].

Key reasons for Excel's persistence:
- **Transparency:** Every formula and calculation is exposed, making it easy to audit assumptions and trace errors [^5].
- **Flexibility:** Custom logic for mixed-use properties, multiple debt tranches, mezzanine financing, and complex waterfall structures can be built without template limitations [^5].
- **Universal accessibility:** No proprietary software required for the receiving party [^5].

### Institutional Standards: ARGUS Enterprise
For formal DCF valuations and cash-flow modeling, **ARGUS Enterprise by Altus Group** remains the institutional standard [^5][^7]. It is used for institutional cash-flow modeling but does not ingest broker packages or populate acquisition models automatically [^0]. Pricing is steep at **$5,000–$15,000+ per seat per year** [^5].

### Data Rooms and Virtual Deal Rooms
Institutional investors rely heavily on **virtual data rooms (VDRs)** for secure document sharing during due diligence:
- **MotionCRE** offers deal workspaces with scoped external data rooms, per-visitor activity logs, and file-level audit trails [^6].
- **Orangedox** layers VDR capabilities (tracking, watermarking, NDA gating) on top of Google Drive, preserving familiar workflows [^6].
- **iDeals** and **Box** serve larger enterprise M&A and real estate transactions with enterprise-grade encryption and Q&A workflows [^6].

These platforms host:
- Underwriting models and financial projections
- Rent rolls, T-12s, environmental reports
- Investment summaries, operating agreements, subscription documents
- Sponsor track records and legal documents [^6]

### Deal Management & Investor Portals
Beyond static file sharing, institutional firms use **pipeline and fund-management platforms**:
- **Dealpath:** Leading deal-management platform for institutional CRE teams; 6 of the top 10 institutional investors use it. Supports $10T+ in transaction decisions [^3][^7].
- **Juniper Square:** Investment-management software for 1,000+ real estate firms, including the world's largest institutional investors. Focuses on investor reporting, fundraising, and fund administration [^7].
- **Agora:** CRE-specific platform with investor portals, automated waterfall calculations, and CRM [^3].
- **InvestorFlow:** AI-powered front-office platform for capital formation and deal workflows [^3].
- **VTS:** Leading leasing and asset-management platform for landlords, with business intelligence and tenant-relationship tools [^7].

### Family Offices & Co-Investment Structures
Family offices increasingly band together for club deals and co-investments, partnering with institutional investors such as pension funds and sovereign wealth funds in joint ventures for real estate at scale [^1]. They often use **Jersey Private Funds (JPFs)** or bespoke joint-venture structures to pool capital, requiring secure document sharing and governance frameworks [^1].

---

## 2. What features do institutions require for deal sharing?

### The Five Criteria Institutional LPs Evaluate
Per Tilt Analytics, **institutional LPs evaluate fund models on five criteria** [^4]:
1. **Transparency** — Can every assumption be traced from input to output? Are formulas auditable?
2. **Granularity** — Are individual property assumptions modeled independently, or blended into portfolio averages?
3. **Waterfall accuracy** — Does the distribution waterfall match the LPA terms precisely, including preferred-return accrual, catch-up mechanics, and clawback provisions?
4. **Stress-testability** — Can assumptions be flexed at property and portfolio levels to see how returns degrade?
5. **Fee clarity** — Are management fees, acquisition fees, disposition fees, and promote structures modeled explicitly?

### Operational Due Diligence Requirements
Reporting quality is a proxy for operational maturity. LPs expect:
- Quarterly reports within 45 days of quarter-end in consistent formats
- Clear NAV attribution and portfolio-company commentary
- Independent fund administration and audit
- Cybersecurity practices protecting LP data and deal information
- Documented conflict-of-interest policies [^4]

### Governance and Standardization
- **ILPA Reporting Template v2.0** (effective Jan 1, 2026) standardizes fee, expense, and carried-interest disclosure. Models mapping cleanly to ILPA v2.0 signal operational maturity [^4].
- **PREA Investor Toolkit** provides reference provisions for governance, transparency, disclosure, and fiduciary obligations in commingled funds and JVs [^4].
- **Standardized underwriting** aligned with institutional U.S. real estate standards is increasingly table stakes [^4].

### Technology-Enabled Features
Modern platforms provide:
- **Audit trails:** File-level access logging, per-visitor activity, IP tracking, and download monitoring [^6]
- **Version control:** Live-sync with source documents (e.g., Google Drive) so updates propagate without manual re-upload [^6]
- **Watermarking:** Dynamic watermarks displaying viewer email to discourage unauthorized sharing [^6]
- **Access revocation:** One-click revocation of links or user access without affecting underlying workspaces [^6]
- **Scenario comparison:** Sensitivity analysis and multi-scenario modeling
- **Real-time investor portals:** Self-service access to balances, documents, and performance dashboards [^3]

---

## 3. What are the pain points with current Excel-based sharing?

### The "Excel as Programming Language" Problem
Oliver Beavers (Phosphor) describes the core issue: Excel modelers are essentially software engineers using a no-code interface, but **without any of the tools software engineers rely on** [^2]:
- **No version control**
- **No ability to test**
- **No templating** — every new model requires rebuilding from scratch
- **No semantic meaning** — Excel does not understand that EBITDA = EBIT - Depreciation - Amortization, or that NOI is a real estate metric [^2]

### Common Operational Failures
- **Circular references:** Institutional-grade fund models should never rely on circular references. They produce inconsistent results across machines, cannot be reliably audited, and break during stress-testing with data tables [^4].
- **Formula errors and copy-paste mistakes:** Manual model building carries hidden costs in development time, maintenance, version control, and knowledge dependency on the original builder [^5].
- **Assumption opacity:** When models are shared via email, it is difficult to track which version contains which assumptions, leading to diligence confusion and unnecessary back-and-forth [^6].
- **No audit trail:** Unlike VDRs, email-based Excel sharing provides no visibility into who opened, edited, or downloaded the model [^6].
- **File size and stability:** Large spreadsheets become unstable, slow, and prone to crashing [^2].

### The "Don't Replace Excel, Support It" Consensus
Most institutional teams **should not replace Excel** — their model is often the system of record. Modern tools (e.g., Primer, Apers XL-2) are designed to populate and support Excel rather than force a vendor-owned workbook [^0][^5].

---

## 4. Are there any emerging platforms specifically for RE deal sharing/model collaboration?

### Deal Management & Pipeline
- **Dealpath:** Founded 2014, 300+ institutional clients, $10T+ in supported transactions. Centralizes pipeline, analytics, and execution workflows [^3][^7]. JLL Spark invested to accelerate growth [^3].
- **VTS:** Leading platform for leasing velocity, tenant engagement, and real-time portfolio analytics. Less focused on investment/fund management [^7].

### Fund Administration & Investor Relations
- **Juniper Square:** Over 1,000 real estate firms. Streamlines investment operations, investor reporting, and fundraising. Handles complex investment structures and analytics [^7].
- **Agora:** CRE-focused alternative to Juniper Square with investor portals, CRM, automated waterfall calculations, and K-1 delivery. Starts at $749/month [^3].
- **SyndicationPro / InvestNext / Janover Connect:** Target syndicators and smaller GPs with CRM, eSign, subscription tools, and distribution automation [^3].

### AI-Powered Model Generation & Acquisition Workflow
- **Primer:** AI agents for acquisitions that map deal data into the team's existing Excel model, creates reviewable deal records, and preserves data for future comp/pipeline work. Focuses on exact model mapping, source citations, and conflict checks [^0].
- **Apers XL-2:** Generates institutional-quality Excel workbooks with real formulas via AI, eliminating manual model-building while keeping Excel as the deliverable [^5].
- **Phosphor:** Semantic financial modeling platform that brings version control, testing, and semantic meaning to real estate underwriting [^2].

### Data Rooms & Secure Collaboration
- **MotionCRE:** Built specifically for CRE, combines deal workspaces with scoped external data rooms, live analytics, and lender/investor package management [^6].
- **Orangedox:** Google Drive-native VDR with investor tracking, watermarking, and engagement analytics for mid-market transactions [^6].
- **Raveum:** Institutional-grade U.S. real estate access platform with standardized underwriting, transparent reporting, and governance frameworks for allocators [^4].

### Market Context: PropTech M&A Surge
The PropTech M&A market is active: **163 deals announced in the first 11 months of 2025**, ahead of 134 for all of 2024, with $6.8B in disclosed transaction value [^5]. Buyers favor recurring software, proprietary data, workflow control, and products useful even when transaction volumes soften [^5]. Major transactions include:
- Rocket Companies acquiring Redfin ($1.8B)
- CoStar acquiring Matterport
- Brookfield acquiring Divvy Homes' platform (~$1B) [^5]

---

## 5. What would make an institutional LP comfortable receiving a shared underwriting model instead of an Excel file?

### Auditable Transparency Above All
LPs use the fund model as a **primary underwriting tool** because it reveals how sponsor economics interact with investor returns under every scenario [^4]. A polished pitch deck means nothing if the model cannot withstand diligence. To replace an Excel file, a shared model must offer:
- **Full formula visibility** — every calculation exposed and traceable [^4][^5]
- **Assumption traceability** — inputs linked directly to outputs with no black-box logic [^4]
- **Third-party audit** — models verified error-free by independent auditors (e.g., RCA AuditDefense) [^0]

### Institutional-Grade Structural Requirements
1. **No circular references** — Direct calculation methods producing identical results across machines [^4]
2. **Property-level independence** — Each asset must stand on its own to assess concentration risk [^4]
3. **Exact waterfall matching** — Preferred return, catch-up, clawback, and promote structures must mirror LPA terms precisely [^4]
4. **Stress testing at multiple levels** — Flexibility to test property-level and portfolio-level scenarios [^4]
5. **Fee mapping to ILPA v2.0** — Explicit modeling of management fees, acquisition fees, disposition fees, and total sponsor compensation [^4]

### Operational Comfort Factors
- **Standardized, consistent reporting** — Quarterly delivery in predictable formats with clear NAV attribution [^4]
- **Version control and audit trails** — Ability to see exactly who changed what assumption and when [^6]
- **Secure access with watermarking** — Dynamic watermarks, access revocation, and per-session logging [^6]
- **Output in Excel format** — Even AI-generated models must deliver Excel as the final artifact because it is the format institutional investors trust [^5]
- **Compliance alignment** — FATCA, CRS, and institutional governance frameworks [^4]

### The "System of Record" Argument
As one industry observer noted, **"Most institutional teams should not replace Excel. Their model is often the system of record."** [^0] The path to LP comfort is not to eliminate Excel, but to **generate, populate, and validate Excel models** through a controlled, transparent, auditable platform that preserves the trusted output format while eliminating manual errors and assumption drift.

---

## Citations

| ID | Source | Date | URL |
|----|--------|------|-----|
| [^0] | Proprise AI — Best CRE Underwriting Software | 2026-06-01 | https://www.proprise.ai/primer/guides/real-estate-underwriting-software/ |
| [^1] | Maples Group / PERE — Private Equity Platform Approach; Family Offices Banding Together | 2026-03-04 / 2026-01-29 | https://maples.com/knowledge/private-equity-adopts-platform-approach-to-uk-real-estate-deals; https://www.perenews.com/like-institutional-investors-family-offices-are-banding-together/ |
| [^2] | Adventures in CRE — Phosphor Interview (Oliver Beavers) | 2025-06-25 | https://www.adventuresincre.com/audioseries-s3spe6/ |
| [^3] | Dealpath / JLL Spark; Agora; Exafol | 2025-05-28 / 2026-02-02 / 2025-11-10 | https://spark.jllt.com/resources/blog/jll-spark-and-dealpath-transforming-cre-capital-markets-in-the-age-of-ai/; https://agorareal.com/compare/juniper-square-alternatives/; https://www.exafol.com/comparison/vts-vs-dealpath |
| [^4] | Tilt Analytics — LP Fund Model Guide; PREA Investor Toolkit; ILPA DDQ 2.0; Raveum; V7 Labs | 2026-05-26 / 2024-10-11 / 2021-11 / 2026-02-12 / 2026-06-11 | https://tiltanalytics.com/real-estate-fund-model-guide/; https://www.prea.org/research/investor-toolkit/; https://ilpa.org/wp-content/uploads/2021/11/ILPA-DDQ-2.0.pdf; https://www.raveum.com/institution; https://www.v7labs.com/blog/private-equity-fund-due-diligence |
| [^5] | eFinancialModels; Apers; Levera Partners; SourceForge; AscendixTech | 2026-01-28 / 2026-04-01 / 2026-02-19 / 2025-09-17 | https://www.efinancialmodels.com/real-estate-financial-modeling-in-excel-101/; https://apers.app/compare/best-real-estate-financial-modeling-software; https://www.leverapartners.com/blog/proptech-real-estate-software-ma/; https://ascendixtech.com/real-estate-technology-trends/ |
| [^6] | MotionCRE; Orangedox; Agora; EthosData | 2026-06-15 / 2026-01-21 / 2026-05-27 | https://motioncre.com/features/data-rooms; https://www.orangedox.com/blog/real-estate-data-room; https://agorareal.com/compare/best-real-estate-data-room-tools/; https://www.ethosdata.com/due-diligence-data-room/ |
| [^7] | Dealpath; Gitnux; Leni; Agora; CRE Software.tech | 2024-01-05 / 2026-02-11 / 2026-02-13 / 2026-01-14 / 2026-02-20 | https://www.dealpath.com/blog/cre-tech-essential-solutions-digital-transformation/; https://gitnux.org/best/real-estate-sponsor-software/; https://leni.co/help-articles/cre-asset-management-software/; https://agorareal.com/compare/commercial-real-estate-management-software/; https://cresoftware.tech/guides/investment-valuation.html |
