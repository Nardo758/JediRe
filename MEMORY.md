# MEMORY.md - Long-Term Memory

**Created:** 2026-02-19  
**Last Updated:** 2026-02-22 08:20 EST

---

## 🧠 Core Identity & Purpose

I'm RocketMan 🚀, Leon's AI partner for real estate development and tech building. Not just an assistant—a collaborator who ships code, solves problems, and keeps projects moving forward.

**Working Relationship:**
- Leon is hands-on technical founder, comfortable with code and infrastructure
- Works primarily in Replit (JEDI RE), comfortable with Git
- Values speed, but not at expense of quality
- Appreciates proactive work and clear documentation
- Trusts me with significant autonomy on implementation details

---

## 🏗️ Active Projects Portfolio

### JEDI RE - Real Estate Intelligence Platform
**Status:** Active development, 85% complete  
**Tech Stack:** Supabase, TypeScript, React, PostGIS  
**Deployment:** Replit (https://jedi-re.replit.app)

**Core Mission:** Build-vs-buy intelligence for multifamily real estate deals

**Key Systems Built (as of Feb 2026):**
- Dashboard V2 with intelligence hierarchy
- Property management (parcels, deals, properties)
- Geographic hierarchy (MSAs, submarkets, trade areas)
- Financial modeling with pro forma analysis
- Email intelligence (Gmail sync + property extraction)
- News intelligence framework (3-tier event system)
- Multifamily leasing traffic prediction engine
- Property types & investment strategies system (51 types, 204 combinations)
- Deal Capsule architecture (Phases 1-3)
- Municipal data scraping (property records, $50K/year CoStar savings)

**Current Phase:** Sprint #4 (Feb 17-23) - Production deployment & testing

**Recent Major Addition (Feb 21):**
- Market Intelligence UI complete (Phase 1+2)
  - 89 research outputs fully mapped and documented
  - 7 new pages built (~70KB)
  - 5 critical components (MarketDataTable, SupplyWaveChart, OwnerPortfolioView, etc.)
  - 10-Year Supply Wave visualization (key differentiator)
  - Complete navigation structure
  - Status badge system (REAL/MOCK/PENDING data indicators)
  - Ready for Phase 3 (intelligence engine backend)

**Known Blockers:**
- Python dependencies setup (need Leon at PC to resolve)
- Market Intelligence awaiting wiring in Replit (WIRING_GUIDE.md ready)
- Apartment Locator AI awaiting Moltworker infrastructure decision

### Apartment Locator AI
**Status:** 99% MVP ready, awaiting production deployment  
**Tech Stack:** Cloudflare Workers, Supabase, React  
**Purpose:** Renter-facing platform to find hidden gem apartments

**Key Features:**
- Property scraping (Cloudflare Worker handling anti-bot)
- Admin panel (5 dashboards for monitoring)
- Savings calculator
- Monetization (blurred results paywall)
- JEDI RE integration

**Current Blocker:** Moltworker deployment decision (infrastructure choice)

### Traveloure
**Status:** 70% complete, maintenance mode  
**Purpose:** Travel services platform

### OppGrid
**Status:** Production, independent operation  
**Purpose:** Real estate data aggregation

---

## 🚀 Working Patterns & Methodology

### Sprint System (Weekly Sprints)
**Current:** Sprint #4 (Feb 17-23, 2026)  
**Pattern:** Monday-Sunday weeks, retrospective on Sundays

**Sprint #3 Highlights (Feb 10-16):**
- 170% completion rate (3 planned + 14 bonus systems)
- 120+ commits, ~425K lines of code
- 17 complete systems delivered
- Historic sprint, set new baseline for velocity

**Sprint Structure:**
- P0 (Critical Path), P1 (Important), P2 (Nice to Have)
- Daily progress tracking in SPRINT.md
- Weekly retrospectives update PROJECT_TRACKER.md

### Parallel Agent Deployment
**Pattern:** Deploy multiple sub-agents simultaneously for complex features

**Recent Example (Feb 19):** Property Types System
- 4 agents deployed in parallel
- 9 minutes wall-clock time
- Complete system delivered (database + API + UI + docs)
- Result: 51 property types, 204 strategy combinations, production-ready

**Track Record:**
- Feb 18: 7 agents (leasing traffic system, 70 minutes)
- Feb 19: 4 agents (property types system, 9 minutes)

**Key Insight:** Parallel agent deployment is most effective when:
- System has clear component boundaries
- Tasks are independent (no dependencies between agents)
- Specification is detailed upfront

### Development Workflow
1. **Morning sessions** - Leon often works 9:00-12:00 EST
2. **Afternoon/evening** - Variable, sometimes late (past midnight)
3. **Git commits** - Frequent, descriptive commit messages
4. **Documentation** - Comprehensive docs alongside code
5. **Testing** - Test scripts, verification checklists

---

## 💡 Key Learnings & Patterns

### Technical Decisions
- **PostgreSQL + PostGIS** for spatial operations (geocoding, boundaries)
- **Supabase** for backend (database + auth + realtime)
- **TypeScript** end-to-end for type safety
- **React** for frontend
- **Cloudflare Workers** for scraping (handles anti-bot measures)
- **Mapbox** for geocoding (with OSM Nominatim fallback)

### Architecture Principles
- **3-tier geographic hierarchy** (MSA → Submarket → Trade Area)
- **Event-driven** design (news events cascade to affected deals)
- **Dual extraction** (property emails vs. news intelligence)
- **Strategy system** (property type + investment strategy combinations)
- **Impact decay models** (proximity, sector relevance, absorption, temporal)

### Process Learnings
1. **Clear specification = faster execution** - Detailed specs lead to successful sub-agent deployments
2. **Real-world data validation is critical** - Feb 18 leasing system calibrated against 5 years of actual data
3. **Documentation should be continuous** - Don't defer docs until "later"
4. **Parallel work requires independence** - Can't parallelize dependent tasks
5. **Git history is source of truth** - Track all changes, descriptive commits

---

## 🔧 Infrastructure & Credentials

### Known Environments
- **JEDI RE Production:** Replit (https://jedi-re.replit.app)
- **Database:** Supabase (PostgreSQL + PostGIS)
- **Version Control:** GitHub
- **Development:** Replit IDE

### API Integrations
- **Mapbox:** Geocoding service
- **Gmail API:** Email sync (OAuth configured)
- **OpenAI:** (assumed for AI processing)

### Deployment Pattern
- Code commits to GitHub
- Replit auto-deploys or manual "Publish App"
- Migrations run manually in Replit database
- Frontend builds automatically

---

## 📊 Current State (Feb 22, 2026)

### Sprint #4 Progress (Day 6/7 - Sunday Review)
**Completed (Days 1-5):**
- ✅ Deal Capsule integration (Day 1)
- ✅ Multifamily leasing traffic system (Day 2 - 7 agents)
- ✅ Property types & strategies system (Day 3 - 4 agents, 9 min)
- ✅ Fulton County property import (Day 3 - 1,028 properties)
- ✅ Backend refactoring (Day 3 - 86% code reduction)
- ✅ Production verification (Day 4)
- ✅ UI reorganization plan (Day 4)
- ✅ **Market Intelligence UI Phase 1+2 (Day 5)** 🔥
- ✅ **Development Platform Architecture (Day 5)** 🏗️
- ✅ **5 3D Development Modules (Day 5 - 12 min parallel build)** 🎨
- ✅ **Deal Creation Flow Integration (Day 5 - Steps 9-12)** 🔗
- ✅ **Qwen AI Integration Phase 2 (Day 5 - 7 AI services)** 🤖

**Day 6 (Sunday, Feb 22):**
- ✅ Sprint #4 retrospective completed
- ✅ PROJECT_TRACKER.md updated with complete summary
- ✅ SPRINT.md updated with retrospective + Sprint #5 preview
- ✅ All documentation current

**Market Intelligence Achievement (Feb 21):**
- **Phase 1:** 7 pages, complete navigation structure
- **Phase 2:** 5 critical components (MarketDataTable, SupplyWaveChart, etc.)
- **89 outputs** fully documented and mapped
- **10-Year Supply Wave** visualization (key differentiator vs competitors)
- **~140KB code** pushed to GitHub (commit 44f5c132)
- **Status badges** showing REAL vs MOCK data (Atlanta has 12 real outputs)
- **WIRING_GUIDE.md** created for 10-minute integration in Replit

**Next Critical Tasks (Day 7 - Monday Feb 23):**
- End-to-end testing: Property types, Market Intelligence, 3D modules
- Settings UI testing
- Performance review and optimization
- Moltworker infrastructure decision
- Sprint #5 planning session

**Sprint #4 Status:** 
- **Progress:** 75% complete
- **Capacity:** 31% buffer remaining (15.5 hours)
- **Rating:** ⭐⭐⭐⭐⭐ Historic sprint!
- **Systems Delivered:** 16 major systems in 6 days

### Active Blockers
1. **Market Intelligence wiring** (Low) - Ready for Leon, WIRING_GUIDE.md provides exact steps
2. **Python dependencies** (High) - Need Leon at PC to configure environment
3. **Moltworker decision** (Medium) - Infrastructure choice for Apartment Locator AI scraping

---

## 🎯 Strategic Context

### Business Goals
Leon is building competitive advantage through proprietary intelligence:
- **Cost savings:** $50K+/year vs CoStar subscription
- **Speed advantage:** Real-time property/market intelligence
- **Data moat:** Municipal scrapers, property records, leasing data
- **Strategy intelligence:** 51 property types × 4 strategies = strategic arbitrage

### Competitive Positioning
- **Target:** Southeast US + Texas multifamily markets
- **Partner:** Jeremy Myers
- **Edge:** Technology + speed + proprietary data
- **Markets:** Atlanta (seed data), expanding to other metros

### Vision
Build the "operating system" for real estate development decisions:
- Acquisition intelligence (JEDI RE)
- Renter pipeline (Apartment Locator AI)
- Integration across portfolio (unified data model)

---

## 🛠️ Technical Debt & Future Work

### Known Technical Debt
- Python integration environment needs setup
- Some migrations pending manual execution
- Performance optimization needed (page load times)
- Test coverage could be expanded

### Future Enhancements (from docs)
- **Phase 2:** Pro forma adjustments, supply signals, risk scoring
- **Phase 3:** Full risk categories, scenario generation, source credibility
- **Beta testing:** User feedback and iteration
- **Analytics:** Usage tracking, feature adoption

---

## 📝 Communication Patterns

### Leon's Style
- Direct, technical communication
- Appreciates proactive solutions
- Comfortable with autonomy
- Values clear documentation
- Responds well to options with recommendations

### My Communication Style (per SOUL.md)
- Be helpful, not performatively helpful
- Have opinions, make recommendations
- Be resourceful before asking
- Skip filler phrases ("Great question!", "I'd be happy to...")
- Concise when appropriate, thorough when needed

### When to Reach Out
**Always report:**
- Sprint goals completed
- Critical blockers needing Leon
- Milestones achieved
- Something broke requiring attention

**Usually report:**
- Significant progress (>20% of major feature)
- Found solution to blocking problem
- Discovered valuable insights

**Don't report (HEARTBEAT_OK):**
- Routine maintenance work
- Nothing new since last check (<30 min)
- Late night unless urgent (23:00-08:00 EST)
- Leon clearly busy/in flow

---

## 🧩 Files & Structure Conventions

### Memory Organization
- **Daily logs:** `memory/YYYY-MM-DD.md` - Raw session logs
- **Long-term:** `MEMORY.md` (this file) - Curated learnings
- **Heartbeat state:** `memory/heartbeat-state.json` - Track periodic checks

### Documentation Standards
- **UPPERCASE.md** files in root for key docs
- Comprehensive inline comments in code
- Architecture docs alongside implementation
- Quick reference guides for complex systems
- Test scripts included with new features

### Git Conventions
- Descriptive commit messages
- Feature branches when appropriate
- Frequent commits (don't accumulate large changesets)
- Commit format: `type: description` (e.g., `feat: Add property types system`)

---

## 🎓 Lessons from Recent Work

### February 2026 Insights

**Sprint #4 Summary (Feb 17-22):**
- Learned: Historic sprint possible with parallel agent strategy (16 systems in 6 days)
- Pattern: Day 5 delivered 11 systems alone (most productive day ever)
- Success factors:
  - Parallel agent deployment (4-7 agents simultaneously)
  - Clear specifications before building
  - Phase-based architecture (UI → Components → Engine)
  - Comprehensive documentation alongside code
- Challenges:
  - Some blockers persisted (Python dependencies, Moltworker)
  - End-to-end testing deferred (need explicit allocation)
  - Risk of over-building without validation
- Key achievement: Market Intelligence + Development Platform complete
- Sprint rating: ⭐⭐⭐⭐⭐ (5/5)

**Market Intelligence UI (Feb 21):**
- Learned: UI skeleton → Components → Engine → Wire-up is effective staging
- Pattern: 89 outputs organized into 8 signal groups across 9 pages
- Success factor: Status badges (REAL/MOCK/PENDING) show data availability transparently
- Key differentiator: 10-Year Supply Wave (competitors only show 2-year pipeline)
- Build approach: Phase 1 navigation (70KB), Phase 2 components (70KB), ready for Phase 3 engine
- Timeline: Built in one overnight session, ready for integration

**Fulton County Import (Feb 19 evening):**
- Learned: Can import entire market in seconds (1,028 properties, 39 seconds)
- Pattern: Parallel API calls (10 concurrent) with UPSERT strategy (safe to re-run)
- Success factor: 3 Fulton County APIs integrated (Tax Parcels, Sales, Market Trends)
- Data quality: 249,964 total units, 292 sales records, 52 market trend points

**Property Types System (Feb 19 morning):**
- Learned: 4 parallel agents can deliver complex system in 9 minutes
- Pattern: Database → API → UI → Custom Builder pipeline
- Success factor: Clear specification from Leon (strategy matrix spreadsheet)

**Leasing Traffic System (Feb 18):**
- Learned: Real data calibration is essential (5 years of actual performance)
- Pattern: Seasonal multipliers dramatically impact predictions (June 3x December)
- Success factor: 99% tour conversion, 20.7% close rate from actual data

**Sprint #3 (Feb 10-16):**
- Learned: 170% completion possible with parallel agent strategy
- Pattern: Can deliver 17 systems in one week with clear priorities
- Success factor: Mix of planned work + opportunistic bonus features

**Gmail Integration (Feb 10-11):**
- Learned: OAuth configuration is finicky, needs exact credential match
- Pattern: Build system first, troubleshoot credentials separately
- Blocker resolved: Eventually got OAuth working after credential sync

---

## 🚨 Important Context & Gotchas

### Production Considerations
- **Migrations:** Must be run manually in Replit database console
- **Secrets:** Stored in Replit Secrets, not in code
- **Deployment:** Replit "Publish App" button or auto-deploy on commit
- **Database:** PostgreSQL via Supabase, includes PostGIS extension

### Development Quirks
- **TypeScript:** Strict mode, catch errors early
- **React:** Functional components, hooks pattern
- **Supabase client:** Both public (anon key) and service (admin) clients
- **PostGIS:** Special functions for spatial queries (ST_Contains, ST_Within)

### Testing Approach
- Test scripts in bash (test-*.sh files)
- Verification checklists in docs
- Manual testing in Replit
- Production testing after deployment

---

## 📅 Timeline Context

**Early February 2026:**
- Dashboard V2 complete
- Email intelligence foundation built
- Sprint system formalized

**Mid-February 2026 (Sprint #3):**
- Historic sprint: 170% completion
- Municipal data scraping
- Admin panels
- Deal Capsule architecture

**Late February 2026 (Sprint #4, Current):**
- Property types system complete (Feb 19)
- Fulton County market import complete (1,028 properties)
- Leasing traffic predictions (Feb 18)
- **Market Intelligence UI complete (Feb 21)** - 89 outputs, 7 pages, 5 components
- Backend refactoring (86% code reduction)
- Focus shifting to production deployment
- Testing and polish phase
- Phase 3 (intelligence engine backend) ready to start

---

## 🔮 Next Milestones

**Immediate (This Sprint - Feb 17-23, Days 5-7 remaining):**
- Wire up Market Intelligence UI in Replit (Leon - 10 min)
- Phase 3: Build intelligence engine (89 calculation services)
- Test end-to-end property type flow
- Make Moltworker infrastructure decision
- Weekend: Sprint retrospective + Sprint #5 planning

**Short-term (Sprint #5 - Next Week):**
- Complete Market Intelligence Phase 3 (backend calculations)
- Production deployment of JEDI RE
- Production deployment of Apartment Locator AI
- Beta user testing preparation

**Medium-term (Next 2-3 months):**
- User feedback collection and iteration
- Expand market coverage beyond Atlanta
- Scale scraping infrastructure
- Advanced analytics and intelligence features
- Build user base

---

## 🤝 Partnership Notes

### What I Know About Leon
- **Location:** Eastern Time (America/New_York)
- **Contact:** Telegram (@MikieLikie01)
- **Business:** Real estate development, multifamily focus
- **Markets:** Southeast US + Texas
- **Partner:** Jeremy Myers
- **Working hours:** Variable, sometimes late nights
- **Tech comfort:** High - writes code, manages infrastructure
- **Decision style:** Appreciates options with clear recommendations

### What Leon Expects from Me
- Proactive problem solving
- Quality over speed (but fast when possible)
- Clear documentation
- Autonomous execution on implementation details
- Strategic thinking, not just task execution
- Keep projects moving forward during downtime

### Trust Level
- **High autonomy** on technical implementation
- **Collaboration** on strategic decisions
- **Ask first** for external actions (emails, public posts)
- **Act freely** on internal work (code, docs, organization)

---

**End of MEMORY.md**

*This file captures curated long-term context. For daily logs, see memory/YYYY-MM-DD.md files.*
