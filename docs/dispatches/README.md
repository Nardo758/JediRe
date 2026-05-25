# Dispatch Archive

## Purpose

Canonical source of dispatch text for agent sessions. Each file contains the
exact instructions for a task as written by Leon, giving any future bot session
access to the original intent without relying on transcript reconstruction.

## Format

One file per task, named `task-<number>-<slug>.md`.

## Convention

- Dispatch text pasted verbatim at file creation time.
- Sections reconstructed from transcripts rather than original text are marked `[reconstructed]`.
- This directory is checked **before** executing any task — if a dispatch file
  exists, it is authoritative over handoff notes from prior agent sessions.

## Index

| File | Task | Status |
|---|---|---|
| `task-1040-phase-8-research-agent.md` | Phase 8 — Research Agent Enrichment | IMPLEMENTED |
| `task-1041-phase-8-completion.md` | Phase 8 Completion — DQ Canonical Path + Apply/Discard Staging | IN_PROGRESS |
