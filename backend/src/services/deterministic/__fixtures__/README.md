# Golden Fixtures — Pin Discipline

These fixtures back `golden-deals.test.ts`. They exist to catch regressions in the
deterministic engine by comparing live output against known-correct values.

## The rule (with teeth)

**Every pinned field must cite its extraction: payload path, capture file, and date.**
A field that was not individually extracted from a real capture is not eligible to be
pinned — it goes in as `null` (or the whole `expected` block goes `null`) and the
corresponding assertion skips automatically.

Concretely:

- **Verified and pinned** — the value came from a real run (live build capture, or
  `runFullModel()` on pinned inputs) and you can point to exactly where in that
  capture's payload it was read from. State that pointer in a comment next to the
  field.
- **Unverifiable / not yet extracted** — leave it `null`. Do not fill it with an
  input assumption, a rough calculation, or a "looks about right" number.
- **Prohibited, full stop:** the words "estimated," "approximate," or "will be
  verified by test" in an `expected` block. If you're writing one of those words,
  you're describing a guess — it doesn't belong here. This is not a style
  preference; a fixture with any unverified field can silently pass while
  masking a real regression in a different field, because `toBeCloseTo`-style
  assertion chains throw on first failure and never get to the fields after the
  guess.

## Why this matters here specifically

This suite's entire purpose is to be the fixed point everyone else's changes are
measured against. If the fixed point itself contains guesses, "the golden suite
passes" stops meaning anything.

## Incident history (why the teeth)

**egiYear1 (2026-07-06):** Bishop's `egiYear1` was pinned as `4_500_000 //
Estimated from rent roll (will be verified by test)` — a placeholder that was
never replaced. It was corrected to the live engine value, but that repair
alone surfaced a second, larger problem below.

**The full Bishop `expected` block (2026-07-06, same day):** unpinned to `null`
entirely after discovering it was never internally coherent. Timeline:
`noiYear1` was corrected from a platform/OM-diagnostic figure (2,632,193) to a
reconstructed-assumptions engine figure (2,161,807) in one commit
(`c01aa57ee`), but every other field in the block — `irr`, `equityMultiple`,
`dscrY1`, `cashOnCashY1`, `totalEquity`, `totalDebt`, `netProceeds` — was left
untouched, still reflecting the *original* capture computed under the old NOI
regime. `goingInCapRate` was never a computed value at all — it was the input
`acquisition.capRate` assumption copied into the `expected` block, coincidentally
plausible-looking. `netProceeds` carried its own in-line "Approximate" flag that
was never resolved. None of this was visible because the test's assertion chain
throws on the first mismatch — with the guessed fields sitting earlier in the
chain, everything after them was silently never checked for years.

**Lesson:** a partial fix to one field in a golden fixture, without re-deriving
every other field in the same block, can leave the fixture worse than before —
internally incoherent but still "passing" until something forces the chain
further. Every field lives or dies together; extract them all from the same
capture, together, or don't pin any of them.

## Re-pinning

If an engine change legitimately moves a golden value (an intentional NOI
methodology change, e.g.), don't overwrite one number in isolation — re-run
the full capture, re-extract every field with its payload path, and update the
provenance comment with the new capture context and a commit message stating
the classification (intentional-change vs regression-being-masked).
