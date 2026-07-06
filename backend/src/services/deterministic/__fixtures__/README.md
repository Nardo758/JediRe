# Golden Fixtures — Pin Discipline

These fixtures back `golden-deals.test.ts`. They exist to catch regressions in the
deterministic engine by comparing live output against known-correct values.

## The rule

**No field enters a fixture as an estimate or TBD.** A value is either:

- **Verified and pinned** — captured from a real run (live build capture or
  `runFullModel()` on pinned inputs), with a provenance comment stating: what
  produced it, when, and against which commit/input contract.
- **Unverifiable** — left `null`. The corresponding assertion must skip
  (`hasExpected` gating, or an explicit early return) rather than compare
  against a guess.

There is no third option. A fixture value that says "estimated," "approximate,"
or "will be verified by test" is a pin-discipline violation — it silently turns
the golden suite into a check against a guess instead of a check against truth,
and nobody notices until someone traces a failure back to it (as happened with
`egiYear1` on Bishop, corrected 2026-07-06 — see `bishop.golden.ts`).

## Why this matters here specifically

This suite's entire purpose is to be the fixed point everyone else's changes
are measured against. If the fixed point itself contains guesses, "the golden
suite passes" stops meaning anything — it becomes possible for both a real
regression and a lucky guess to look identical: green.

## Re-pinning

If an engine change legitimately moves a golden value (an intentional NOI
methodology change, e.g.), don't just overwrite the number — update the
provenance comment with the new capture context and commit message stating
the classification (intentional-change vs regression-being-masked). Re-pinning
without that trail is how false confidence gets built into the fixture.
