# Email Extraction User Guide

## What is Email Extraction?

Email Extraction automatically analyzes your incoming emails to find:
- **Property Listings** - Broker emails, off-market deals, investment opportunities
- **Market Intelligence** - Development news, employment announcements, major transactions

When property listings match your acquisition preferences, they're automatically added to your map. Everything else goes to a review queue for you to approve or reject.

---

## Getting Started

### 1. Connect Your Gmail Account

1. Go to **Settings** → **Email Accounts**
2. Click **Connect Gmail**
3. Sign in with your Google account
4. Authorize JEDI RE to read your emails

✅ Your emails will start syncing automatically every 15 minutes.

---

### 2. Set Your Acquisition Preferences

Tell JEDI RE what kinds of properties you're looking for:

1. Go to **Settings** → **Preferences**
2. Set your criteria:
   - **Property Types**: Multifamily, Retail, Office, etc.
   - **Markets**: Which states/cities?
   - **Price Range**: Min/max investment size
   - **Unit Count**: Number of units (for multifamily)
   - **Year Built**: Age of building
   - **Cap Rate**: Minimum return expectations
   - **Condition**: Excellent, Good, Value-Add, Distressed
3. Enable **Auto-Create Pins** (recommended)
4. Set **Confidence Threshold** (default: 80%)

**What does this do?**
- Properties matching your criteria (≥80% match) are **auto-created** on your map
- Properties with lower match scores go to **review queue**
- Non-matching properties are **filtered out**

---

### 3. Sync Your Emails

1. Go to **Inbox**
2. Click **Refresh** to manually sync
3. Or wait for automatic sync (every 15 minutes)

✨ JEDI RE will analyze each email and extract property/news data.

---

## Understanding Email Badges

Emails in your inbox show badges indicating extracted data:

### 🏢 Property Extracted
- A property listing was found in this email
- Could be a broker email, offering memorandum, or off-market deal

### 📰 News Extracted
- Market intelligence was found in this email
- Could be development news, employment announcement, or major transaction

### ✅ Auto-Created
- Property was automatically added to your map
- Matches your acquisition preferences (≥80% confidence)

### ⚠️ Needs Review
- Property was found but needs your approval
- Either low confidence or doesn't strongly match preferences

---

## Reviewing Extractions

### In Your Inbox

1. Open **Inbox**
2. Look for emails with badges (🏢 📰)
3. For properties needing review:
   - Click **Approve** to create a map pin
   - Click **Reject** to dismiss
   - Click **Details** to see full extraction

### Quick Actions

- **View on Map** - Jump to the auto-created pin
- **Approve** - Create pin from reviewed extraction
- **Reject** - Dismiss false positive or non-interest
- **Details** - See extracted data (address, price, cap rate, etc.)

---

## Extraction Details Page

Click **Details** on any extracted email to see:

### Property Details
- Full address
- Price
- Property type (multifamily, retail, etc.)
- Units, sqft, year built
- Cap rate, occupancy
- Condition assessment
- Confidence score (how sure AI is)
- Preference match score (how well it fits your criteria)

### News Details
- Event type (employment, development, etc.)
- Location
- Magnitude (job count, investment amount)
- Sentiment (positive/negative impact)
- Impact score (0-100)
- Source credibility

### Actions
- **Create Pin** - Add to map
- **Reject** - Not interested
- **Delete** - False positive
- **View Email** - Go back to original email

---

## How Extraction Works

### Step 1: Classification
When an email arrives, JEDI RE classifies it:
- **Property** - Broker listing, pricing, units, cap rate
- **News** - Development announcements, employment news
- **Mixed** - Contains both property + news
- **General** - Regular correspondence (ignored)

### Step 2: Extraction (if property/news detected)
AI extracts key details:
- For properties: Address, price, type, units, cap rate, condition
- For news: Event type, location, magnitude, sentiment, impact

### Step 3: Geocoding
Addresses are geocoded to map coordinates using Mapbox.

### Step 4: Preference Matching (for properties)
Property is scored against your acquisition preferences:
- Property type match
- Geographic market match
- Price range
- Unit count
- Year built
- Condition

### Step 5: Decision
- **High match (≥80%)** → Auto-create pin on map
- **Medium match (50-80%)** → Queue for review
- **Low match (<50%)** → Reject
- **Low confidence** → Queue for review

---

## Best Practices

### ✅ Do's

1. **Set Detailed Preferences** - The more specific, the better the auto-matching
2. **Review Regularly** - Check your review queue weekly
3. **Approve Good Extractions** - This helps the AI learn
4. **Reject False Positives** - Helps filter better over time
5. **Update Preferences** - As your strategy changes, update criteria

### ❌ Don'ts

1. **Don't Auto-Create Everything** - Use preferences to filter
2. **Don't Ignore Review Queue** - Good deals might be waiting
3. **Don't Delete Emails** - Extractions are linked to emails
4. **Don't Set Threshold Too Low** - More false positives

---

## Common Scenarios

### Scenario 1: Broker Email with Property Listing

**Email:**
> Subject: Off-Market Deal: 200-Unit Multifamily - Austin, TX
> From: broker@cbre.com
> 
> 200-unit apartment complex in Austin. Built 2018. $25M asking. 6.5% cap rate. 95% occupancy.

**What Happens:**
1. Classified as **Property**
2. Extracts: 200 units, Austin TX, $25M, 6.5% cap, 2018, multifamily
3. Matches your preferences (you target multifamily in Texas)
4. **Auto-creates pin** on your map
5. Badge: ✅ Auto-Created

---

### Scenario 2: Market Intelligence Newsletter

**Email:**
> Subject: Amazon Announces 5,000-Job Expansion in Atlanta
> From: newsletter@bisnow.com
> 
> Amazon will invest $500M in new fulfillment center in Gwinnett County, creating 5,000 jobs by 2025.

**What Happens:**
1. Classified as **News**
2. Extracts: Employment event, Gwinnett County GA, 5,000 jobs, $500M investment
3. Creates **news item** in your intelligence feed
4. Badge: 📰 News

---

### Scenario 3: Mixed Email

**Email:**
> Subject: Amazon HQ2 Announced + Adjacent Land for Sale
> From: broker@jll.com
> 
> Amazon announced new campus with 10,000 jobs. Adjacent 5-acre parcel available for $20M.

**What Happens:**
1. Classified as **Mixed**
2. Extracts **both**:
   - News: Employment event, 10,000 jobs
   - Property: 5 acres, $20M
3. Creates news item + property extraction
4. Badges: 🏢 Property + 📰 News

---

### Scenario 4: Low Confidence Extraction

**Email:**
> Subject: Potential Deal in Atlanta
> From: broker@example.com
> 
> I have a property that might interest you. Let's discuss.

**What Happens:**
1. Classified as **Property** (mentions "deal" and "property")
2. Low confidence (no specific details)
3. Queued for **Review**
4. Badge: ⚠️ Needs Review
5. You decide: Request more info or reject

---

## Troubleshooting

### No Extractions Appearing

**Problem:** Emails syncing but no extractions showing

**Solutions:**
1. Check if emails are property-related (not personal emails)
2. Verify LLM service is running (check with admin)
3. Review extraction confidence threshold (maybe too high)
4. Check extraction logs (admin only)

---

### Too Many False Positives

**Problem:** General emails being classified as property/news

**Solutions:**
1. Raise confidence threshold in Settings
2. Reject false positives (helps AI learn)
3. Add senders to blocklist (future feature)
4. Review keyword patterns (admin only)

---

### Missing Properties

**Problem:** Broker email but no extraction created

**Possible Causes:**
1. Email too vague (no specific details)
2. Low confidence score
3. Doesn't match your preferences
4. Geocoding failed (bad address)

**Solutions:**
1. Check review queue (might be there)
2. Lower confidence threshold temporarily
3. Broaden your preferences
4. Manually create pin from email

---

### Geocoding Failures

**Problem:** "Could not geocode address" error

**Cause:** Address format not recognized by geocoding service

**Solutions:**
1. Manually create pin and enter address
2. Contact support if recurring issue
3. Check if address has typos

---

## Privacy & Security

### What Data is Processed?

- **Email subject and body** - Analyzed for property/news content
- **Sender email** - Used for source credibility scoring
- **Extracted data only** - We don't store full email bodies
- **Classification metadata** - Stored for audit trail

### What Data is NOT Processed?

- Personal emails (outside inbox/sent folders)
- Email attachments (coming soon)
- Email threads (coming soon)
- Deleted emails

### Data Retention

- **Property extractions** - Kept indefinitely (for audit trail)
- **News items** - Kept indefinitely
- **Email metadata** - Kept until you disconnect account
- **Classification data** - Kept for 90 days

### Your Control

- You can delete any extraction
- You can disconnect your Gmail account anytime
- You can reject/approve all extractions
- You control preference matching rules

---

## FAQ

**Q: How often do emails sync?**
A: Automatically every 15 minutes. You can also sync manually.

**Q: Can I use multiple Gmail accounts?**
A: Yes! Connect as many as you want. Each account syncs independently.

**Q: What if I miss a good deal?**
A: Check your review queue regularly. High-confidence matches are auto-created, but medium-confidence deals might be waiting for approval.

**Q: Can I turn off auto-creation?**
A: Yes. Go to Settings → Preferences and disable "Auto-Create Pins". All extractions will go to review queue.

**Q: How accurate is the extraction?**
A: Typically 85-95% accurate for well-formatted broker emails. News extraction is 80-90% accurate. You always review before final approval.

**Q: What about Outlook emails?**
A: Support coming soon! Currently Gmail only.

**Q: Can I bulk approve/reject?**
A: Coming soon! For now, review one at a time.

**Q: Does this work for forwarded emails?**
A: Yes, as long as the property details are in the body.

---

## Getting Help

- **Support Email**: support@jedire.com
- **Documentation**: docs.jedire.com
- **Video Tutorials**: youtube.com/jedire
- **Community Forum**: forum.jedire.com

---

**Happy Deal Hunting! 🏢📰**
