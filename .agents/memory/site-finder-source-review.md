---
name: South Florida preliminary screening
description: Source validation and legal-use evidence boundaries for Site Finder
---
Keep preliminary parcel discovery independent from local legal-use permission and from deal automation. Broad current assessment categories are not precise care-program definitions or entitlement evidence.

**Why:** South Florida public sources vary materially in semantics and currency. Municipal map gaps and old municipal-boundary metadata persist even when county parcel discovery works. Generic “senior living” obscures materially different regulated uses.

**How to apply:** Revalidate the actual official layer metadata and code provisions before expanding source or permission coverage. Retain unknowns and explicit coverage gaps rather than inferring permission from a district name or assessor classification. A reviewed code snapshot must lose permission assertions when the official document changes.

Treat district/municipal spatial intersections as candidate evidence, not proof of controlling authority on their own.

**Why:** Official spatial-intersection queries return adjacent polygons sharing only an edge. Using raw hit counts falsely reports split zoning or changes authority. Large parcel geometries also exceed practical public-service request limits; bounding envelopes are faster candidates but cannot establish zoning.

**How to apply:** Preserve polygon holes and multipart geometry; require positive-area intersection and full parcel coverage when resolving a single authority/district. Use bounded envelopes only for discovery and perform exact parcel-based checks afterward.

Site Finder is an instruction-driven, deal-independent experience: a clear request should start a bounded search with one submission, not require interpretation approval or manual filter editing.

**Why:** The user explicitly clarified that typing “Find parcels over 3 acres zoned for assisted living in Broward” is an instruction for an actual agent to search, not a shortcut for filling out a filter wizard.

**How to apply:** Keep clarification in the same text-driven experience and do not require a selected deal. Preserve requested boundaries and distinguish proposed activities from assessor classifications. Interrupted instruction processing should require an explicit retry rather than silently charging the user for another model call.

Recovery must preserve the user's current intent: an explicitly selected or retried search takes precedence over an instruction's original search, and retrying a clarification answer must retain its original request context.

**Why:** Replaying an original instruction during recovery can silently restore the wrong search; replaying only an answer such as “Assisted living” loses the requested county and acreage.

**How to apply:** Include navigation/reload and failed-clarification retry cases whenever changing recovery behavior, not just the initial successful search.