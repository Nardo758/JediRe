-- §E-F1: Drop users.enabled_modules zombie column.
--
-- Trace confirmed (2026-06-27):
--   - Column populated with default '{supply}' on all 5 real users, never modified.
--   - Fetched in 3 login query paths (login/dev-login/me) and placed in session as
--     req.session.modules — but zero enforcement sites exist anywhere in the codebase.
--   - The LIVE module system is user_module_settings + module_definitions (separate
--     table with toggle/purchase/subscribe endpoints). enabled_modules was an earlier
--     generation entitlement column, superseded by the table-driven system — zombie #2
--     after users.subscription_tier (zombie #1, dropped 2026-06-27).
--   - All 3 query sites updated to remove the SELECT and return modules: [] in the
--     session payload. user_module_settings enforcement at agent dispatch is a
--     separate feature (scaffolding exists, enforcement not yet wired — tracked as
--     §E-F1 follow-up, NOT a blocker for this DROP).
--
-- Safe to drop: column is not read by any middleware, agent, or service.

ALTER TABLE users DROP COLUMN IF EXISTS enabled_modules;
