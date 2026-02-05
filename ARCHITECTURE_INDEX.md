# JEDI RE - Architecture Documentation Index

**Purpose:** Central index to all architecture and design documents  
**Last Updated:** 2026-02-05

---

## 📚 Core Documents

### 1. **JEDI_DATA_SCHEMA.md** ⭐ START HERE
**Version:** 2.0  
**Purpose:** Complete data structure specification  
**Covers:** All 8 engines, JEDI Score, API design  
**Status:** Living document - updated each phase

**Use this for:**
- Understanding data flow through the platform
- API endpoint design
- Engine input/output contracts
- Database schema design

---

### 2. **ROADMAP.md**
**Purpose:** Development timeline and milestones  
**Phases:** 1-4 (Foundation → Full Platform)  
**Updated:** Weekly progress tracking

**Use this for:**
- Project timeline
- Feature prioritization
- Sprint planning
- Milestone tracking

---

### 3. **JEDIRE_ARCHITECTURE_V2.md**
**Purpose:** Map-centric platform design  
**Covers:** UI/UX, multi-map system, collaboration  
**Focus:** User-facing architecture

**Use this for:**
- Understanding the map interface
- Collaborative features
- User workflows

---

### 4. **docs/PHASE_2_ARCHITECTURE.md**
**Purpose:** Market intelligence layer design  
**Covers:** Data ingestion, storage, analysis pipelines  
**Phase:** 2-4 engines (Game Theory, Network Science, etc.)

**Use this for:**
- Data source integration
- ETL pipeline design
- Phase 2-4 planning

---

### 5. **docs/BACKEND_ARCHITECTURE.md**
**Purpose:** Backend API and services  
**Tech Stack:** Express, TypeScript, PostgreSQL  
**Covers:** REST/GraphQL endpoints, auth, database

**Use this for:**
- API development
- Database design
- Service architecture

---

### 6. **docs/UX_DESIGN.md**
**Purpose:** User experience and interface design  
**Covers:** User personas, workflows, progressive disclosure  
**Focus:** How users interact with JEDI RE

**Use this for:**
- UI development
- Feature design
- User testing

---

## 🔄 Document Update Schedule

### After Each Phase Completion:
- Update `ROADMAP.md` with progress
- Enhance `JEDI_DATA_SCHEMA.md` with new engine schemas
- Archive old versions with date stamps

### Weekly:
- Update `ROADMAP.md` progress tracking
- Log blockers and decisions

### Monthly:
- Review all architecture docs for consistency
- Update version numbers
- Archive outdated designs

---

## 📐 Schema Version Control

**Current Version:** 2.0 (2026-02-05)

**Version History:**
- **v2.0** (2026-02-05): Complete 8-engine schema + JEDI Score
- **v1.0** (2026-02-02): Initial Phase 1 engines only

**Versioning Rules:**
- Major version (2.0 → 3.0): Breaking changes to core schemas
- Minor version (2.0 → 2.1): New engines or data sources added
- Patch version (2.0 → 2.0.1): Clarifications, typos, non-breaking updates

**When to Bump Version:**
- Adding new engine → Minor bump
- Changing existing engine I/O → Major bump
- Adding optional fields → Patch bump

---

## 🎯 How to Use This Index

### **If you're building an API endpoint:**
1. Check `JEDI_DATA_SCHEMA.md` for I/O schemas
2. Reference `BACKEND_ARCHITECTURE.md` for patterns
3. Update `ROADMAP.md` when complete

### **If you're designing a feature:**
1. Check `UX_DESIGN.md` for user workflows
2. Check `JEDI_DATA_SCHEMA.md` for data availability
3. Check `ROADMAP.md` for phase alignment

### **If you're planning a sprint:**
1. Check `ROADMAP.md` for phase goals
2. Check `JEDI_DATA_SCHEMA.md` for data requirements
3. Check `PHASE_2_ARCHITECTURE.md` for technical approach

### **If you're onboarding someone new:**
1. Start with `ROADMAP.md` (what we're building)
2. Then `JEDI_DATA_SCHEMA.md` (how data flows)
3. Then `JEDIRE_ARCHITECTURE_V2.md` (user experience)
4. Finally phase-specific docs as needed

---

## 📝 Document Owners

**JEDI_DATA_SCHEMA.md:** Technical Lead (evolves with product)  
**ROADMAP.md:** Product Owner (weekly updates)  
**Architecture docs:** Technical Lead (monthly review)  
**UX docs:** Design Lead (updated per user feedback)

---

## 🔗 Quick Links

- **Schema (MAIN):** [`JEDI_DATA_SCHEMA.md`](./JEDI_DATA_SCHEMA.md)
- **Roadmap:** [`ROADMAP.md`](./ROADMAP.md)
- **V2 Architecture:** [`JEDIRE_ARCHITECTURE_V2.md`](./JEDIRE_ARCHITECTURE_V2.md)
- **Phase 2:** [`docs/PHASE_2_ARCHITECTURE.md`](./docs/PHASE_2_ARCHITECTURE.md)
- **Backend:** [`docs/BACKEND_ARCHITECTURE.md`](./docs/BACKEND_ARCHITECTURE.md)
- **UX Design:** [`docs/UX_DESIGN.md`](./docs/UX_DESIGN.md)

---

## 💡 Best Practices

1. **Always check the schema first** - It's the source of truth
2. **Update docs as you build** - Don't let them drift
3. **Version breaking changes** - Maintain backward compatibility
4. **Add examples** - Show don't tell
5. **Link between docs** - Make navigation easy

---

**Questions? Start with the schema. It answers most questions about "What data do I have?" and "What should this return?"**
