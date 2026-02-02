# Decisions Needed from Leon

**Date:** February 2, 2026  
**Status:** Foundation A→B→C→D Complete ✅

---

## ✅ What's Done (A→B→C→D Sequence)

### A. Multi-Map System Database ✅
- Complete schema for multiple maps per user
- Map pins (property, news, consultant, annotations)
- Deal silos with all intel per property
- Pipeline stages (customizable per map)
- Tasks, news articles, map layers
- Activity logging and collaboration

### B. Account Structure Database ✅
- Individual, Organization, Enterprise, Partner types
- User roles and permissions
- Account invitations
- Usage tracking and limits
- Partner-client relationships

### C. Email → Property Automation Service ✅
- AI extraction of properties from emails
- Geocoding via Mapbox
- User preference matching
- Auto-pin creation on maps
- Batch processing support

### D. Map Layer System Component ✅
- Layer toggle UI
- 8 default layers defined
- Visual indicators and controls

---

## 🎯 Decisions Needed

### 1. Account Types - Which to Launch With?

**Options:**

**A. Start Simple**
- Individual only
- Add Organization later
- Fastest to market

**B. Individual + Organization (Recommended)**
- Cover both solo users and teams
- Competitive feature
- More complex but manageable

**C. All Four Types**
- Individual, Organization, Enterprise, Partner
- Most flexible
- More development time

**Your Decision:** _________________

---

### 2. JediRe Email (@jedire.com) - Implementation Approach?

**Options:**

**A. Hybrid System (Recommended)**
- Users can connect external email (Outlook/Gmail)
- OR use @jedire.com address
- SendGrid API for sending
- Cloudflare Email Routing (free) for receiving
- **Cost:** ~$0-20/month depending on volume

**B. External Only**
- Users must connect their own email
- No @jedire.com addresses
- Simpler, less features
- **Cost:** $0

**C. JediRe Email Only**
- Everyone gets @jedire.com
- No external connections
- Most control
- **Cost:** ~$50-100/month (email hosting)

**Your Decision:** _________________

---

### 3. Email Address Format for @jedire.com

**Options:**
- `firstname@jedire.com` (Leon@jedire.com)
- `firstname.lastname@jedire.com` (Leon.Dixon@jedire.com)
- `username@jedire.com` (user chooses)
- Let user choose during signup

**Your Decision:** _________________

---

### 4. New User Defaults

**A. Automatically create:**
- @jedire.com email address on signup?
- Default "My Deals" map on signup?
- Default pipeline stages?

**B. OR let user choose:**
- Connect external email OR get @jedire.com?
- Create first map manually?
- Customize pipeline during setup?

**Your Decision:** _________________

---

### 5. Subscription Tiers & Limits

**Current schema has:**
```
free:
  - 1 user
  - 5 maps
  - 100 properties
  
basic:
  - ? users
  - ? maps
  - ? properties
  
pro:
  - ? users
  - ? maps
  - ? properties
  
team:
  - ? users
  - ? maps
  - ? properties
  
enterprise:
  - unlimited everything
```

**Your Decision:** Fill in the ? with actual numbers

---

### 6. Email → Property Auto-Creation

**A. Auto-create immediately (Aggressive)**
- Email arrives with property → Pin appears automatically
- Notify user: "1 new property added"
- Risk: False positives

**B. Pending approval (Safe)**
- Email arrives → Add to "Review" queue
- User approves → Pin created
- More manual work

**C. Confidence-based (Smart)**
- High confidence (>0.8) → Auto-create
- Medium confidence (0.5-0.8) → Pending approval
- Low confidence (<0.5) → Ignore

**Your Decision:** _________________

---

### 7. Default Map Behavior

When user signs up:

**A. Create default "My Deals" map automatically**
- Map name: "[User]'s Deals"
- Type: Acquisition
- Default pipeline stages
- Ready to use immediately

**B. Show onboarding wizard**
- "Create your first map"
- Choose name, type, pipeline
- More intentional

**Your Decision:** _________________

---

### 8. Municode Scraper Hosting

The Python scraper needs to run somewhere:

**A. Separate Python service**
- Run alongside Node backend
- Port 5000 for Python API
- Node calls Python when needed

**B. Serverless function**
- Deploy to AWS Lambda / Vercel Functions
- Call via HTTP
- Pay per use

**C. Background worker**
- Run as scheduled job
- Pre-fetch common zoning codes
- Cache in database

**Your Decision:** _________________

---

### 9. Gmail Integration Priority

**A. Add now (before launch)**
- Many users have Gmail
- Complete email solution
- More development time

**B. Add later (post-launch)**
- Outlook + JediRe email enough for v1
- Gmail as v1.1 feature
- Faster to launch

**Your Decision:** _________________

---

### 10. Collaboration Features

**A. Launch with full collaboration**
- Real-time cursors
- Live annotations
- Team presence indicators
- More complex

**B. Basic sharing first**
- Invite to map (no real-time)
- View each other's changes (refresh)
- Add real-time later

**Your Decision:** _________________

---

## 🚀 Next Steps After Decisions

Once you answer these, I can:

1. **Finalize database migrations** with your tier limits
2. **Build email service** based on your choice (@jedire.com or not)
3. **Create onboarding flow** (auto-create or wizard)
4. **Set up Municode integration** (service/serverless/worker)
5. **Build API endpoints** for all the database tables
6. **Upgrade MapView component** with layers and pins
7. **Test on Replit** with your database

---

## 📋 Quick Recommendations (My Opinion)

If you want to launch fast:

**Account Types:** Individual + Organization (B)  
**Email:** Hybrid - connect external OR @jedire.com (A)  
**Email Format:** Let user choose (username@jedire.com)  
**New Users:** Auto-create default map (A)  
**Tiers:**
- Free: 1 user, 5 maps, 100 properties
- Basic ($19/mo): 1 user, 10 maps, 500 properties
- Pro ($49/mo): 1 user, unlimited maps/properties
- Team ($99/mo): 5 users, unlimited maps/properties
- Enterprise: Custom pricing

**Auto-creation:** Confidence-based (C) - smart middle ground  
**Default map:** Auto-create (A) - instant value  
**Municode:** Separate Python service (A) - easiest to maintain  
**Gmail:** Add later (B) - ship faster  
**Collaboration:** Basic sharing first (B) - ship faster  

---

**Reply with your decisions and I'll build the rest!** 🚀

Or if you agree with my recommendations above, just say "Go with your recommendations" and I'll proceed.
