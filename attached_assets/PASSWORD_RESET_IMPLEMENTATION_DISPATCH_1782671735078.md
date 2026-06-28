# IMPLEMENTATION DISPATCH: Password reset (launch blocker — full loop)

Launch-readiness GAP from the cleanup audit: a user who forgets their password has **no recovery path** — no backend route, no email sender, no "forgot password" link. Custom JWT+bcrypt auth, no hosted provider to fall back on. Today the only recoveries are Google OAuth or manual DB edit. This blocks charging users. The frontend form (`ResetPasswordPage.tsx`) already exists — this builds the missing backend + email + wiring. Acceptance proves the **end-to-end loop against a real account**, not "the route exists." STOP at the report.

---

## Security model (get this right — it's an auth surface)

- **Token:** cryptographically random (≥32 bytes, `crypto.randomBytes`), **stored hashed** (SHA-256) in DB — never store the raw token. The raw token goes only in the email link. (If the DB leaks, hashed tokens can't be used.)
- **Single-use:** consumed on successful reset; deleted/marked-used so it can't be replayed.
- **Time-boxed:** expires in ~30–60 min. Expired tokens rejected.
- **No user enumeration:** the request endpoint returns the **same** response whether or not the email exists ("if an account exists, a reset link was sent"). Never reveal which emails are registered.
- **Rate-limited:** cap requests per email/IP to prevent abuse (token spam, enumeration-by-timing).
- **Invalidate on use:** after a successful reset, consider invalidating existing sessions/JWTs for that user (optional but recommended — a reset often means "I think I'm compromised").
- **Google-OAuth accounts:** if the account was created via Google and has no password, decide the behavior — either allow setting a password (converts to hybrid) or return the generic "if an account exists…" and don't send (since they sign in with Google). Pick one, state it; do not leak that the account is Google-only.

## BUILD

**1 — DB: reset-token storage.** A `password_reset_tokens` table (or equivalent): `id`, `user_id` (FK), `token_hash`, `expires_at`, `used_at` (nullable), `created_at`. Migration tracked in `schema_migrations` per the existing convention. Index on `token_hash` for lookup.

**2 — Backend: request endpoint.** `POST /api/v1/auth/password-reset/request` — body `{ email }`.
- Look up user. If found AND has a password (see Google-OAuth note): generate raw token, store its hash + expiry, send the email (step 4). If not found / Google-only: do nothing.
- **Always** return the same 200 + generic message regardless. Rate-limit before the lookup.

**3 — Backend: confirm endpoint.** `POST /api/v1/auth/password-reset/confirm` — body `{ token, newPassword }`.
- Hash the provided token, look it up. Reject if not found, expired, or already used.
- Validate `newPassword` against the existing password policy (length/complexity — match whatever registration enforces).
- bcrypt-hash the new password, update the user, mark the token used (single-use), optionally invalidate sessions.
- Return success/failure. Generic errors on the failure paths (don't distinguish "expired" vs "already used" in a way that aids attack — a single "this reset link is invalid or expired" is fine).

**4 — Email: Resend integration.** Send a reset email with the raw token in a link → `${baseUrl}/reset-password?token=<raw>`. Use the existing Resend setup. Plain, clear copy; link expires in N minutes; "if you didn't request this, ignore it." Confirm the from-address/domain is verified in Resend (or it silently won't deliver).

**5 — Frontend: route + wire the existing page.**
- Add the route `/reset-password` → `ResetPasswordPage` (currently orphaned — this is the wiring that was missing).
- `ResetPasswordPage` reads `?token=` from the URL, takes the new password, calls the confirm endpoint, shows success → redirect to login, or the generic error.
- Also add a **request** entry point: a "Forgot password?" link on `AuthPage` (the live login page — it currently has none) → a small request form (email input) calling the request endpoint, showing the generic "if an account exists…" confirmation.

## ACCEPTANCE — prove the full loop against a real account (not "route exists")

Run the **entire** flow on a real test account in a live environment (Replit — DB + backend + email). Paste evidence at each step:

1. **Request:** submit the test account's email at the forgot-password form → 200 + generic message. Confirm a row landed in `password_reset_tokens` (hashed token, future expiry) — paste the DB row (token_hash, not raw).
2. **Email:** confirm the email actually sent + arrived via Resend (paste the Resend send log / received link). The link contains a raw token and points at `/reset-password?token=`.
3. **Reset:** open the link → `ResetPasswordPage` loads with the token → submit a new password → success. Paste.
4. **Login with new password:** log in with the new password → works. Paste.
5. **Old password rejected:** confirm the old password no longer logs in. Paste.
6. **Single-use:** reuse the same reset link → rejected (token already used). Paste.
7. **Expiry:** (force-expire a token or wait) → expired token rejected. Paste.
8. **No enumeration:** request reset for an email that doesn't exist → **same** generic 200, no email sent, no DB row. Paste both the non-existent and existent responses showing they're identical.
9. **Google-only account** (if testable): request reset for a Google-OAuth-only account → behaves per the stated decision, doesn't leak that it's Google-only. Paste.

**Report:** each acceptance item PROVEN with the paste it specifies. The loop isn't done until 1→6 pass end-to-end against a real account — a green unit test or an existing route is not proof (the lesson of this whole program: code-present ≠ working). Items 7–9 are security-correctness; flag any that fail. STOP after reporting.

---

**Why end-to-end and not "route exists":** every prior "done" in this program that wasn't proven at the real-run level hid a bug. A password-reset route that returns 200 but whose email never sends (unverified Resend domain), or whose token comparison is off, looks complete and is useless. The only proof is a real account going request → email → click → new password → login, with the old password dead and the link single-use. Run that.
