# DISPATCH: email_verified gate-check → blocker or deferrable (one pass, both branches)

Password reset (B2 GAP #1) is closed. B2 GAP #2 — email verification — is unresolved: `email_verified` defaults false with no way for a user to flip it true. Whether that's a **launch blocker** or a **fast-follow** depends entirely on one question: *does anything in the system gate on `email_verified`?* This dispatch answers that first, then branches. Do PART 1, report, and only then proceed to the branch PART 1 selects. STOP at the report if the answer is ambiguous.

---

## PART 1 — The gate-check (do this first, it decides everything)

Determine whether `email_verified` controls access anywhere.

1. `grep -rn "email_verified" backend/src` — every read/write. For each **read**, classify: does it *gate* (block a request, redirect, 403, hide a feature) or is it *informational* (displayed, logged, returned but not enforced)?
2. Check auth middleware specifically: does any route guard, JWT validation, or login flow reject/limit users where `email_verified = false`? `file:line`.
3. Check the frontend: does any route guard or `AuthPage`/login path block unverified users, or is `email_verified` never enforced client-side either?
4. Check registration: confirm new users are written `email_verified = false` (the assumed default) — paste the insert.

**Report the verdict:**
- **GATES** — something blocks unverified users (name it, `file:line`). → Email verification is a **launch blocker**. Proceed to PART 2A.
- **INFORMATIONAL ONLY** — `email_verified` is written but nothing enforces it; unverified users have full access. → Verification is **deferrable** (not a launch-stopper). Proceed to PART 2B.
- **AMBIGUOUS** — a read exists but it's unclear whether it gates. → STOP, report the specific `file:line` and what it does, human decides. Do not guess.

---

## PART 2A — IF GATES: build email verification (same shape as password reset, full loop)

A blocker — build it. Reuse the password-reset patterns (token table, Resend, single-use, time-boxed). `VerifyEmailPage.tsx` already exists (orphaned) — wire it.

- **DB:** verification-token storage (hashed token, user_id, expiry, used_at) — or reuse the reset-token table pattern with a `purpose` column. Migration tracked.
- **Send endpoint:** `POST /api/v1/auth/email/send-verification` — issues a hashed token, emails `${baseUrl}/verify-email?token=<raw>` via Resend (domain now verified). Fire automatically on registration AND expose for resend.
- **Confirm endpoint:** `POST /api/v1/auth/email/verify` — validates token (hash, expiry, single-use), sets `email_verified = true`, marks token used.
- **Frontend:** add `/verify-email` route → wire `VerifyEmailPage` (reads `?token=`, calls confirm, shows success/expired). Add a "resend verification" affordance where unverified users get blocked.
- **Acceptance (full loop, real account, like password reset):** register → verification email sends + arrives (paste Resend log + inbox) → click link → `email_verified` flips true in DB (paste row before/after) → the previously-gated feature now accessible → expired token rejected → single-use replay rejected → already-verified user re-clicking handled gracefully. PROVEN per item.

## PART 2B — IF INFORMATIONAL ONLY: confirm deferrable, document, move on

Not a blocker — but make the deferral a conscious record, not a silent skip.

- Confirm and paste: nothing gates on `email_verified` (the PART 1 evidence). Unverified users have full access today.
- Document the deferral: note that `email_verified` exists as a column, is set false at registration, and is currently unenforced — so verification is a should-build-before-scaling-trust feature (transactional-email deliverability, preventing typo'd signups), NOT a launch blocker. `VerifyEmailPage.tsx` stays parked as the ready front-half.
- **No build.** Report it as deferred-by-design with the evidence, so it's a logged decision you can revisit, not a forgotten gap.

---

## Report

- PART 1 verdict (GATES / INFORMATIONAL / AMBIGUOUS) with `file:line` evidence.
- Then either PART 2A acceptance (full verification loop proven) or PART 2B deferral record.
- If AMBIGUOUS: stop at PART 1, surface the unclear gate, human decides before any build.

STOP after the selected branch reports.

---

**Why gate-check before building:** building email verification when nothing enforces it is effort spent closing a gap that isn't a gap — while the real launch list waits. But *assuming* it's deferrable when a middleware quietly 403s unverified users ships a product where new signups can't get in. One grep settles it. Don't build or defer on a guess.
