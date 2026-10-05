---
name: Browser verification on Nix
description: Why downloaded Playwright browsers may fail while a wrapped system Chromium works
---
Prefer a working Nix-wrapped system Chromium for local browser tests when a downloaded Playwright browser fails to load shared libraries.

**Why:** A browser download is not sufficient on NixOS: the unwrapped executable may not find the system shared libraries. This workspace successfully ran browser tests using an existing wrapped Chromium with Playwright instead of adding arbitrary library directories.

**How to apply:** Locate and verify a current executable before selecting it; do not assume a historical Nix store path remains available. Pass the executable through the test runner's configuration. Keep application authentication intact and exercise the existing development sign-in only in development.