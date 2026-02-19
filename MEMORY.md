# MEMORY.md - Long-Term Memory

**Created:** 2026-02-19  
**Last Updated:** 2026-02-19 16:00 EST

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

**Known Blockers:**
- Python dependencies setup (need Leon at PC to resolve)
- Some features waiting on infrastructure decisions

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

## 📊 Current State (Feb 19, 2026)

### Sprint #4 Progress (Day 3/7)
**Completed:**
- ✅ Deal Capsule integration (Day 1)
- ✅ Multifamily leasing traffic system (Day 2)
- ✅ Property types & strategies system (Day 3)

**Next Critical Tasks:**
- Run migrations 038-039 (property types schema)
- End-to-end testing of property type flow
- Apartment Locator AI production deployment
- Moltworker infrastructure decision

**Sprint Status:** On track, 58% capacity remaining, healthy buffer

### Active Blockers
1. **Python dependencies** (High) - Need Leon at PC to configure environment
2. **Moltworker decision** (Medium) - Infrastructure choice for Apartment Locator AI scraping

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

**Property Types System (Feb 19):**
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
- Property types system complete
- Leasing traffic predictions
- Focus shifting to production deployment
- Testing and polish phase

---

## 🔮 Next Milestones

**Immediate (This Sprint - Feb 17-23):**
- Deploy property types system to production
- Test end-to-end user flows
- Make Moltworker infrastructure decision
- Begin beta user testing

**Short-term (Next 2-4 weeks):**
- Production launch of JEDI RE
- Production launch of Apartment Locator AI
- User feedback collection
- Bug fixes and iteration

**Medium-term (Next 2-3 months):**
- Phase 2 features (pro forma adjustments, supply signals)
- Expand beyond Atlanta metro
- Scale scraping infrastructure
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
