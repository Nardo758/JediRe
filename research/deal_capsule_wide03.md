# Proprietary Market Data Licensing in CRE Tech: Legal Landscape & Shared Deal Containers

> **Research Mission:** Understand the legal and licensing restrictions around housing proprietary market data (CoStar, Yardi Matrix, REIS) inside a shared deal container. How do institutions and platforms handle this?
>
> **Date:** 2026-06-19
> **Sources:** 9 independent web searches across legal terms, CRE tech publications, compliance blogs, and court filings.

---

## 1. CoStar & Yardi Redistribution Restrictions for Data Embedded in Financial Models

### CoStar Group
CoStar's license agreement is one of the most restrictive in the CRE data industry. Under the CoStar License Agreement Terms and Conditions (April 2021), the licensee (broker) is prohibited from:

> "distribute, disclose, copy, reproduce, make available, communicate to the public by telecommunication, display, publish, transmit, assign, sublicense, transfer, provide access to, use or sell, directly or indirectly, any portion of the Licensed Product."[^1]

The agreement further prohibits:
> "upload, post or otherwise transmit any portion of the Licensed Product on, or provide access to any portion of the Licensed Product through, the Internet, any bulletin board system, any electronic network, any listing service or any other data sharing arrangement" accessible to anyone beyond the broker and its authorized users.[^1]

The "Licensed Product" is defined broadly to include **all information, text, photographic images, and data contained in CoStar's database** — including a broker's own listings shared with CoStar.[^1] The Terms also state that competitors cannot access the Licensed Product, and photos depicting properties the broker represents cannot be posted on any competing website.[^1]

**Implication for shared deal containers:** Embedding CoStar comp data, rent rolls, or submarket analytics into a shared deal model or data room would almost certainly violate these terms unless every recipient is an authorized user under the same CoStar subscription, and even then, redistribution through a third-party platform is prohibited.[^1][^2]

### Yardi Matrix
Yardi Matrix's Subscriber Agreement (May 2026) grants a non-exclusive, non-transferable limited license for "internal business purposes, including but not limited to the evaluation and execution of investments."[^3] Reports may be shared with:
- The licensee's affiliates
- Service providers and professional advisers **bound by confidentiality obligations**

However, the restrictions are severe:
> "You may not rent, lease, sell, transfer (by sublicense, assignment or otherwise except as expressly provided by these TOU), time share, modify, reproduce, copy, make derivative works from, distribute, publish, use to provide service bureau services, or publicly display the Services or **compile, bulk download, or transfer any Matrix Content into any searchable database, or to participate in any data-sharing arrangement or data library.**"[^3]

Additionally, Yardi data must remain in the Yardi Cloud and cannot be removed or copied to any other location.[^4] The license is strictly limited to Designated Users, and sharing login credentials is prohibited.[^3]

**Implication for shared deal containers:** Transferring Yardi Matrix rent comps, market reports, or submarket data into a shared deal container or external underwriting model would violate the prohibition on data-sharing arrangements and bulk transfers. Even sharing with JV partners or lenders in a data room may exceed the scope unless they are bound by confidentiality and the sharing is limited to "Reports."[^3]

### REIS / Moody's Analytics
REIS is owned by Moody's Analytics. Moody's Online Terms of Agreement allow limited distribution only in specific contexts:

> "Where the Information is intended to produce calculations and/or reports to be included in regulatory filings or financial statements, Client may ... reproduce limited excerpts of the Information in such regulatory filings and financial statements that are made publicly available."[^5]

However, this requires assumption of full liability, indemnification of Moody's, and appropriate credit attribution. Use of Moody's trademarks in marketing materials, offering circulars, or prospectuses is prohibited without prior written consent.[^5]

**Implication for shared deal containers:** There is no general right to redistribute REIS data into a shared deal model. Any embedding would need to be evaluated under the specific subscription terms, and broad redistribution is likely prohibited.[^5]

---

## 2. How Other CRE Platforms Handle Licensed Data in Shared Contexts

### VTS & CompStak Partnership Model
In 2016, VTS integrated live CompStak data into its platform "at no additional cost and without a CompStak subscription." The partnership was explicitly **unidirectional**: VTS users could view CompStak lease comps alongside their own data, but "no VTS customer data will be shared back to CompStak."[^6]

This model illustrates how shared contexts can work: the licensed data stays within the licensor's (or its authorized partner's) controlled environment, rather than being extracted and redistributed by the end user.[^6]

### CompStak's Crowdsourced Exchange
CompStak operates on a data-for-access model: CRE professionals contribute deal information to gain access to the database. The data is crowdsourced from over 30,000 brokers, appraisers, and researchers. Because members submit their own deal data, CompStak's license structure is different from traditional data licensors — it functions more as a member exchange than a one-way data feed.[^7]

### Reonomy (Altus Group)
Reonomy sources property data from public records, county assessors, and third-party providers. Its model relies on aggregating publicly available data rather than licensing proprietary comp data. This avoids the redistribution problem entirely but limits the depth of lease-level and non-disclosure market data.[^8]

### Data Aggregation Platforms (Cherre, LightBox, NavigatorCRE)
These platforms connect disparate CRE data sources into a unified API or view. However, they do not solve the licensing problem — they typically require the end user to maintain their own subscriptions to the underlying data providers (e.g., CoStar, REIS) and act as a passthrough or integration layer.[^8]

### Dealpath's Proprietary Comps Database
Dealpath addresses the problem by building its own proprietary database: it captures listings and opportunities via "AI-powered data extraction, bulk imports, and broker feeds" rather than embedding licensed third-party data. This creates a firm-owned asset that can be freely shared within the platform without violating external data licenses.[^9]

---

## 3. The "Derived Data" Exception: Can You Learn Without Redistributing?

### Legal Definition and Contractual Variability
"Derived data" (or "resultant data") generally refers to new information generated through analysis or processing of licensed data, such that the original data cannot be identified via reverse engineering.[^10] Under copyright law, derived data may be considered a **derivative work**, and the right to create derivative works is exclusive to the copyright owner.[^10]

However, there is no uniform default rule. The Fried Frank publication on data licensing states:
> "It is difficult to identify a default rule about what constitutes original as opposed to derived data and where ownership of each resides."[^10]

### Key Contractual Tests for Derived Data
A well-structured derived data clause typically requires that the output:
1. Does not bear resemblance to the underlying data
2. Cannot be readily reverse-engineered or decompiled
3. Cannot be used as a source of or substitute for the licensor's data
4. Cannot compete with the licensor or its affiliates
5. Cannot be used to construct or calculate an index competing with the licensor[^11]

### Critical Misconception
A common misconception is that adding a proprietary analytics layer insulates a downstream product from licensing claims. The National Intellectual Property Authority notes:
> "Adding a proprietary analytics layer to licensed data does not automatically insulate the downstream product from licensing claims. MLS participation agreements and data licensing contracts typically include provisions covering derivative works and downstream data products."[^12]

**Implication for shared deal containers:** A deal container that embeds CoStar or Yardi data inside a financial model, even if transformed into assumptions or comps tables, would likely be treated as a derivative work or a redistribution, not protected derived data. The safe path requires that the original licensed data cannot be reverse-engineered or identified, which is extremely difficult when embedding specific comp points, rent figures, or market vacancy rates.

---

## 4. How Institutional Investors Handle Data Licensing in Shared Underwriting

### Virtual Data Rooms (VDRs) with Granular Access Controls
Institutional investors rely on VDRs to share sensitive underwriting materials. Modern VDRs provide:[^13][^14]
- **NDA gates:** Access is contingent on signing an NDA before viewing any document.
- **Dynamic watermarks:** Per-viewer watermarks with name, email, and timestamp to trace leaks.
- **View-only / no-download restrictions:** Documents can be restricted to on-screen viewing with no printing, copying, or downloading.
- **Granular permissions:** Document-level access controls, not just room-level.
- **Audit trails:** Full logging of every view, download, print attempt, and screenshot attempt.
- **Staged disclosure:** Early-phase sharing of high-level materials via basic file sharing; transition to formal VDR only after LOI.

### The "Controlled AI" Model
With the rise of AI in due diligence, a new framework is emerging: the **Controlled AI** model. This classifies data into three zones:[^15]

| Zone | Data Type | AI Rule |
|------|-----------|---------|
| Green | Public info, websites, news, market reports | AI allowed |
| Amber | Sanitized DDQs, redacted excerpts, non-sensitive summaries | AI allowed in approved enterprise tools only |
| Red | VDR docs, contracts, customer data, KPI packs, LPAs, pricing files | No AI unless Controlled AI environment is contractually approved |

This model ensures that proprietary data (including licensed market data) stays within controlled perimeters.[^15]

### Data Room Best Practices for Licensed Data
The Jacobacci law guide on trade secrets emphasizes:[^16]
> "The data room will be the key location for the sharing of confidential information in a deal. Being mindful of who has, and who needs to have, access to the data will be a useful thing for investor and target alike to ensure that they don't disclose — or receive — too much and to the wrong people. Access to a data room can also be functionally limited, such as limiting whether viewers can copy, print or just view material in the data room."

**Practical implication:** Institutional investors typically do **not** embed licensed market data into shared underwriting models. Instead, they either:
- Share a sanitized summary written by an analyst (not the raw data)
- Require each party to source their own licensed data independently
- Use a VDR with strict access controls and NDAs, treating the data as confidential information
- Restrict access to "need to know" personnel only

---

## 5. Platforms That Successfully Solved the "Licensed Data in Shared Model" Problem

### No Platform Truly "Solves" It by Embedding Licensed Data
The research reveals that **no major CRE platform solves this problem by embedding CoStar, Yardi, or REIS data into a shared model** that is freely redistributable. Instead, successful platforms use one of three strategies:

#### Strategy A: Build a Proprietary Database (Avoid the License)
- **Dealpath** captures market data via AI extraction, broker feeds, and bulk imports into its own proprietary comps database. This data is owned by the firm or the platform, not licensed from a third party, and can be shared freely within the platform.[^9]
- **CompStak** crowdsources data from its member base, creating a proprietary dataset that is governed by member exchange terms rather than traditional one-way licensing.[^7]

#### Strategy B: Passthrough / Partner Integration (Keep Data in Licensor's Control)
- **VTS + CompStak:** The partnership allows VTS users to view CompStak data within VTS, but the data remains within CompStak's controlled delivery mechanism. No redistribution or extraction occurs.[^6]
- **Cherre / LightBox:** These platforms integrate data sources but typically require the end user to hold their own subscriptions. The platform acts as a middleware layer, not a redistribution hub.[^8]

#### Strategy C: Anonymization & Aggregation (Derived Data Approach)
- Some platforms aggregate licensed data into anonymized market trends (e.g., submarket rent averages, vacancy indices) where individual data points cannot be reverse-engineered. However, this requires explicit contractual permission and often additional licensing fees.
- The European Money Markets Institute (EMMI) derived data license explicitly acknowledges licensee IP rights in derived data, but only if the derived data meets strict non-resemblance and non-substitution tests.[^11]

### What This Means for a Shared Deal Container
If the goal is to build a shared deal container (like JediRe's Deal Capsule) that houses proprietary market data, the safest legal paths are:

1. **User-Bring-Your-Own-License:** Each user accesses the container with their own CoStar/Yardi/REIS credentials, and the platform acts as a passthrough viewer (like VTS + CompStak). No data is stored or redistributed by the platform.
2. **Proprietary Data Capture:** The platform builds its own database from public records, broker relationships, and user-contributed data (like Dealpath or CompStak), avoiding dependency on licensed data entirely.
3. **Analyst-Sanitized Summaries:** Licensed data is reviewed by an analyst who produces a summary or conclusion. Only the summary (not the raw data) is placed in the shared container. This reduces but does not eliminate risk.
4. **Restricted VDR Model:** If licensed data must be shared, it is placed in a VDR with NDAs, view-only access, watermarks, and audit trails. This treats the data as confidential information rather than a shared model input.

---

## Summary Table: Redistribution Risk by Data Source

| Data Source | License Type | Redistribution in Shared Model | Embedded in Financial Model | Key Risk |
|-------------|--------------|-------------------------------|----------------------------|----------|
| **CoStar** | Non-exclusive, non-transferable, user-limited | **Prohibited** — no data sharing arrangements[^1] | **Prohibited** — no uploading to electronic networks[^1] | Copyright infringement, contract breach, competitor exclusion clauses |
| **Yardi Matrix** | Non-exclusive, non-transferable, Designated Users only | **Prohibited** — no data-sharing arrangement or searchable database[^3] | **Prohibited** — must remain in Yardi Cloud[^4] | Contract breach, audit risk, termination of license |
| **REIS / Moody's** | Subscription, limited excerpt exception | **Generally prohibited** — limited regulatory filing exception only[^5] | **Prohibited** without specific license | Liability for unauthorized use, trademark misuse |
| **CompStak** | Member exchange (crowdsourced) | Allowed within CompStak ecosystem; extraction restrictions apply | Subject to member terms | Data quality dependent on crowdsourcing |
| **Public Records** | Public domain (with state-level fees) | Generally allowed | Allowed | Lower IP risk; accuracy/completeness issues |

---

## Sources

[^1]: CoStar License Agreement Terms and Conditions (April 2021), as cited in *Malm Inc. v. CoStar Group Inc.* complaint and CoStar Product Terms. URL: https://business.cch.com/ald/MalmIncvCoStarGroupIncComplaint042726.pdf; https://www.cms7files1.revize.com/birmingham/BOARD%20PACKET%20-%20FINAL.pdf

[^2]: CoStar Terms of Use regarding authorized user passcodes and competitor restrictions. URL: https://ipwatchdog.com/wp-content/uploads/2023/05/CoStar-v.-Commercial-Real-Estate-Exchange-Coypright-Complaint-9-25-20.pdf

[^3]: Yardi Matrix Subscriber Agreement, Section 2 (License Grant; Restrictions), Version May 6, 2026. URL: https://resources.yardi.com/legal/matrix/subscriber-agreement/

[^4]: Yardi Cloud Services Agreement (Tacoma Housing Authority execution), Section 2(b) Restrictions. URL: https://www.tacomahousing.org/wp-content/uploads/2022/01/THA-BOC-Resolution-2022-01-26-1-Execution-Contract-with-Yardi-Systems-Inc.-1.pdf

[^5]: Moody's Online Terms of Agreement, Section 11 (Limited Distribution of Information). URL: https://www.moodys.com/web/en/us/site-assets/online-terms-of-agreement.pdf

[^6]: "VTS Market Intelligence Now Includes CompStak Data," Bisnow, April 19, 2016. URL: https://www.bisnow.com/new-york/news/technology/video-vts-connect-puts-all-the-data-you-need-in-one-place-58973

[^7]: CompStak vs. Reonomy comparison, CompStak, October 15, 2024. URL: https://compstak.com/go/reonomy-alternative-vs-compstak

[^8]: "CRE Analytics Platform: Compare Top Options (2026)," GrowthFactor, January 27, 2026. URL: https://www.growthfactor.ai/resources/blog/cre-analytics-platform-ultimate-guide

[^9]: Dealpath homepage and product descriptions, 2026. URL: https://www.dealpath.com/; https://imaa-institute.org/m-and-a-tools/dealpath/

[^10]: Glazer, D., "Data as IP and Data License Agreements," Fried Frank, 2017. URL: https://www.friedfrank.com/uploads/siteFiles/Publications/Data%20as%20IP%20and%20Data%20License%20Agreements%20(1).pdf

[^11]: European Money Markets Institute (EMMI) Derived Data License Agreement, 2026. URL: https://www.emmi-benchmarks.eu/globalassets/documents/pdf/subscriptions/rates-plans/agreements/2026/emmi-derived-data-license-agreement_2026.pdf

[^12]: "Intellectual Property Rights in Real Estate Data and Databases," National Intellectual Property Authority. URL: https://nationalintellectualpropertyauthority.com/real-estate-data-intellectual-property/

[^13]: "Investor Data Room: What to Include, Best Practices & Top Providers (2026)," Peony, March 21, 2026. URL: https://www.peony.ink/blog/data-room-for-investors

[^14]: "Data room for investors: How to build one to sell your SaaS," L40°, August 25, 2025. URL: https://www.l40.com/insights/data-room-investors

[^15]: "No AI Allowed? PE NDAs, Data Rooms, and Confidentiality Risk," VCI Institute. URL: https://www.vciinstitute.com/blog/no-ai-allowed-private-equity-confidentiality-risk-in-the-age-of-generative-ai

[^16]: Jacobacci Law, "Trade Secrets — Data Room Best Practices," 2023. URL: https://www.jacobacci-law.com/hubfs/2024%20Trade%20Secrets%20-%20Denmark%2C%20European%20Union%2C%20Germany%2C%20Israel%2C%20Italy%2C%20Japan%2C%20Poland%2C%20South%20Korea%2C%20Taiwan%2C%20United%20Kingdom.pdf

[^17]: CoStar v. CREXi litigation background and antitrust counterclaims, Ninth Circuit, June 23, 2025. URL: https://cdn.ca9.uscourts.gov/datastore/opinions/2025/06/23/23-55662.pdf

[^18]: "CoStar Has Long History of Copyright Infringement Lawsuits," The Real Deal, August 7, 2025. URL: https://therealdeal.com/national/2025/08/07/costar-has-long-history-of-copyright-infringement-lawsuits/
