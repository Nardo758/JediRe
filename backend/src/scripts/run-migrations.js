"use strict";
/**
 * Migration runner — applies every pending .sql file in the codebase's
 * migration directories to the live database.
 *
 * Background (Task #512):
 *   The previous version of this file had a hardcoded list of 5 filenames
 *   it would run and skipped everything else. That meant any newly added
 *   migration .sql file was silently ignored, and missing-column 500 errors
 *   (assumptions_hash, error_message) reached production. This runner now
 *   discovers and applies *all* unapplied migrations, sorted deterministically.
 *
 * Sources scanned (both kept for historical reasons):
 *   - backend/src/db/migrations/
 *   - backend/src/database/migrations/
 *
 * Tracking:
 *   `schema_migrations` is treated as a free-form ledger. The runner adapts
 *   to whichever column layout is already present:
 *     - Modern: schema_migrations(filename TEXT PK, executed_at TIMESTAMPTZ)
 *     - Legacy: schema_migrations(id, migration_number, migration_name,
 *               applied_at) — used by an older Python migration tool that
 *               populated this DB before the TS runner existed.
 *   Tracking keys are stored as the *basename* of the .sql file (no
 *   directory prefix) so the rows interop with the 76 already-tracked
 *   legacy entries.
 *
 *   Caveat: if the same basename ever appears in both migration dirs, only
 *   the first one applied is tracked. Today the only such overlaps are
 *   `20260502_assumptions_hash.sql` and `20260502_017_deal_financial_models_columns.sql`,
 *   both of which are pure `ADD COLUMN IF NOT EXISTS` and therefore safe
 *   to no-op the second time.
 *
 * Usage:
 *   - Standalone: `npm --prefix backend run migrate`
 *   - Programmatic (server startup): `await runPendingMigrations(pool, log)`
 *
 * Behaviour:
 *   Each migration runs inside its own transaction. A failure rolls that
 *   migration back, logs the error, and the runner continues to the next
 *   file. Callers can inspect the returned counts to decide whether to
 *   alert.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPendingMigrations = runPendingMigrations;
exports.verifyCriticalSchema = verifyCriticalSchema;
exports.assertCriticalSchema = assertCriticalSchema;
exports.baselineMigrations = baselineMigrations;
var fs_1 = require("fs");
var path_1 = require("path");
var MIGRATION_DIRS = [
    { ns: 'db', absDir: (0, path_1.join)(__dirname, '..', 'db', 'migrations') },
    { ns: 'database', absDir: (0, path_1.join)(__dirname, '..', 'database', 'migrations') },
];
function discoverMigrations() {
    var out = [];
    for (var _i = 0, MIGRATION_DIRS_1 = MIGRATION_DIRS; _i < MIGRATION_DIRS_1.length; _i++) {
        var _a = MIGRATION_DIRS_1[_i], ns = _a.ns, absDir = _a.absDir;
        if (!(0, fs_1.existsSync)(absDir))
            continue;
        var files = (0, fs_1.readdirSync)(absDir)
            .filter(function (f) { return f.endsWith('.sql'); })
            .sort();
        for (var _b = 0, files_1 = files; _b < files_1.length; _b++) {
            var f = files_1[_b];
            out.push({
                trackingKey: f,
                label: "".concat(ns, "/").concat(f),
                absPath: (0, path_1.join)(absDir, f),
            });
        }
    }
    // Global sort by basename so files apply in date-prefix order regardless
    // of which directory they live in. Tie-break by full label for determinism
    // when the same basename exists in both dirs.
    out.sort(function (a, b) {
        if (a.trackingKey !== b.trackingKey)
            return a.trackingKey < b.trackingKey ? -1 : 1;
        return a.label < b.label ? -1 : 1;
    });
    return out;
}
/**
 * Detect (or create) the schema_migrations table and return which columns
 * to read/write. Adapts to the legacy Python-tool layout that some
 * deployments already have on disk.
 */
function resolveTableShape(pool) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, cols, keyCandidates, timeCandidates, numCandidates, keyCol, timeCol, numCol;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, pool.query("SELECT column_name\n       FROM information_schema.columns\n      WHERE table_name = 'schema_migrations'")];
                case 1:
                    rows = (_c.sent()).rows;
                    cols = new Set(rows.map(function (r) { return String(r.column_name); }));
                    if (!(cols.size === 0)) return [3 /*break*/, 3];
                    // No table yet — create the modern shape.
                    return [4 /*yield*/, pool.query("\n      CREATE TABLE IF NOT EXISTS schema_migrations (\n        filename    TEXT PRIMARY KEY,\n        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n      );\n    ")];
                case 2:
                    // No table yet — create the modern shape.
                    _c.sent();
                    return [2 /*return*/, { keyCol: 'filename', timeCol: 'executed_at', numCol: null }];
                case 3:
                    keyCandidates = ['filename', 'migration_name', 'name'];
                    timeCandidates = ['executed_at', 'applied_at', 'created_at'];
                    numCandidates = ['migration_number'];
                    keyCol = keyCandidates.find(function (c) { return cols.has(c); });
                    timeCol = (_a = timeCandidates.find(function (c) { return cols.has(c); })) !== null && _a !== void 0 ? _a : null;
                    numCol = (_b = numCandidates.find(function (c) { return cols.has(c); })) !== null && _b !== void 0 ? _b : null;
                    if (!keyCol) {
                        throw new Error("schema_migrations exists but has no recognized filename column. " +
                            "Found columns: [".concat(Array.from(cols).join(', '), "]. ") +
                            "Expected one of: ".concat(keyCandidates.join(', '), "."));
                    }
                    return [2 /*return*/, { keyCol: keyCol, timeCol: timeCol, numCol: numCol }];
            }
        });
    });
}
/**
 * Allocator for the legacy `migration_number` column. Pre-loads MAX(num)+1
 * once and increments locally so we don't issue one MAX query per insert.
 * Falls back to 0 if the table is empty.
 */
function makeNumberAllocator(pool, shape) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, next;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!shape.numCol)
                        return [2 /*return*/, function () { return 0; }];
                    return [4 /*yield*/, pool.query("SELECT COALESCE(MAX(\"".concat(shape.numCol, "\"), 0) + 1 AS next FROM schema_migrations"))];
                case 1:
                    rows = (_c.sent()).rows;
                    next = Number((_b = (_a = rows[0]) === null || _a === void 0 ? void 0 : _a.next) !== null && _b !== void 0 ? _b : 1);
                    return [2 /*return*/, function () { return next++; }];
            }
        });
    });
}
function loadAppliedSet(pool, shape) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.query("SELECT \"".concat(shape.keyCol, "\" AS k FROM schema_migrations"))];
                case 1:
                    rows = (_a.sent()).rows;
                    return [2 /*return*/, new Set(rows.map(function (r) { return String(r.k); }))];
            }
        });
    });
}
/**
 * Build a parameterised INSERT for the resolved table shape, including the
 * legacy numeric column when present. Returns the SQL and a value-builder
 * given a tracking key. The value-builder pulls a fresh number from the
 * allocator, so callers must invoke it once per insert (not reuse).
 *
 * `mode` controls conflict handling — 'upsert' uses ON CONFLICT DO NOTHING
 * and requires a unique index on keyCol; 'insert' assumes the caller has
 * already checked for duplicates inside its transaction.
 */
function buildInsert(shape, allocateNum, mode) {
    var cols = [shape.keyCol];
    var placeholders = ['$1'];
    var p = 1;
    if (shape.numCol) {
        cols.push(shape.numCol);
        placeholders.push("$".concat(++p));
    }
    if (shape.timeCol) {
        cols.push(shape.timeCol);
        // NOW() is a server-side default — no parameter needed.
        placeholders.push('NOW()');
    }
    var conflict = mode === 'upsert'
        ? " ON CONFLICT (\"".concat(shape.keyCol, "\") DO NOTHING")
        : '';
    var colsSql = cols.map(function (c) { return "\"".concat(c, "\""); }).join(', ');
    var sqlBase = "INSERT INTO schema_migrations (".concat(colsSql, ") VALUES (").concat(placeholders.join(', '), ")").concat(conflict);
    return function (key) {
        var params = [key];
        if (shape.numCol)
            params.push(allocateNum());
        return { sql: sqlBase, params: params };
    };
}
var consoleLogger = {
    info: function (m) { return console.log("[migrate] ".concat(m)); },
    warn: function (m) { return console.warn("[migrate] ".concat(m)); },
    error: function (m) { return console.error("[migrate] ".concat(m)); },
};
/**
 * Apply every unapplied migration in lexical (date-prefix) order.
 * Idempotent: already-applied basenames in `schema_migrations` are skipped.
 */
/**
 * Advisory-lock key for serialising concurrent migration runners (e.g.
 * two replicas booting at once). Arbitrary 64-bit constant — collisions
 * are harmless beyond unrelated callers waiting on each other briefly.
 * `4951290512` = ascii "JediRe" hashed informally; chosen for log clarity.
 */
var MIGRATION_LOCK_KEY = 4951290512;
function runPendingMigrations(pool_1) {
    return __awaiter(this, arguments, void 0, function (pool, log) {
        var lockClient, lockAcquired, tryRes, _a;
        var _b;
        if (log === void 0) { log = consoleLogger; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, pool.connect()];
                case 1:
                    lockClient = _c.sent();
                    lockAcquired = false;
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, , 7, 12]);
                    return [4 /*yield*/, lockClient.query('SELECT pg_try_advisory_lock($1) AS got', [MIGRATION_LOCK_KEY])];
                case 3:
                    tryRes = _c.sent();
                    if (!!((_b = tryRes.rows[0]) === null || _b === void 0 ? void 0 : _b.got)) return [3 /*break*/, 5];
                    log.info('another runner is migrating — waiting for lock...');
                    return [4 /*yield*/, lockClient.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY])];
                case 4:
                    _c.sent();
                    _c.label = 5;
                case 5:
                    lockAcquired = true;
                    return [4 /*yield*/, runPendingMigrationsLocked(pool, log)];
                case 6: return [2 /*return*/, _c.sent()];
                case 7:
                    if (!lockAcquired) return [3 /*break*/, 11];
                    _c.label = 8;
                case 8:
                    _c.trys.push([8, 10, , 11]);
                    return [4 /*yield*/, lockClient.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])];
                case 9:
                    _c.sent();
                    return [3 /*break*/, 11];
                case 10:
                    _a = _c.sent();
                    return [3 /*break*/, 11];
                case 11:
                    lockClient.release();
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    });
}
function runPendingMigrationsLocked(pool, log) {
    return __awaiter(this, void 0, void 0, function () {
        var shape, applied, all, seen, collisions, _i, all_1, m, prior, allocateNum, result, useUpsert, rows, _a, buildOne, _b, all_2, m, sql, client, ins, exists, ins, err_1, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, resolveTableShape(pool)];
                case 1:
                    shape = _d.sent();
                    return [4 /*yield*/, loadAppliedSet(pool, shape)];
                case 2:
                    applied = _d.sent();
                    all = discoverMigrations();
                    seen = new Map();
                    collisions = [];
                    for (_i = 0, all_1 = all; _i < all_1.length; _i++) {
                        m = all_1[_i];
                        prior = seen.get(m.trackingKey);
                        if (prior)
                            collisions.push("".concat(prior, "  vs  ").concat(m.relPath));
                        else
                            seen.set(m.trackingKey, m.relPath);
                    }
                    if (collisions.length > 0) {
                        throw new Error("Migration filename collisions detected (basename used in both dirs):\n  " +
                            collisions.join('\n  ') +
                            "\nRename one of each pair so basenames are globally unique.");
                    }
                    return [4 /*yield*/, makeNumberAllocator(pool, shape)];
                case 3:
                    allocateNum = _d.sent();
                    result = { applied: [], skipped: 0, failed: [] };
                    useUpsert = false;
                    _d.label = 4;
                case 4:
                    _d.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, pool.query("SELECT 1\n         FROM pg_index i\n         JOIN pg_attribute a\n           ON a.attrelid = i.indrelid\n          AND a.attnum = ANY(i.indkey)\n        WHERE i.indrelid = 'schema_migrations'::regclass\n          AND i.indisunique\n          AND i.indnatts = 1\n          AND a.attname = $1\n        LIMIT 1", [shape.keyCol])];
                case 5:
                    rows = (_d.sent()).rows;
                    useUpsert = rows.length > 0;
                    return [3 /*break*/, 7];
                case 6:
                    _a = _d.sent();
                    useUpsert = false;
                    return [3 /*break*/, 7];
                case 7:
                    buildOne = buildInsert(shape, allocateNum, useUpsert ? 'upsert' : 'insert');
                    _b = 0, all_2 = all;
                    _d.label = 8;
                case 8:
                    if (!(_b < all_2.length)) return [3 /*break*/, 26];
                    m = all_2[_b];
                    if (applied.has(m.trackingKey)) {
                        result.skipped++;
                        return [3 /*break*/, 25];
                    }
                    sql = void 0;
                    try {
                        sql = (0, fs_1.readFileSync)(m.absPath, 'utf8');
                    }
                    catch (err) {
                        log.error("Could not read ".concat(m.label, ": ").concat(err.message));
                        result.failed.push({ file: m.label, error: "read: ".concat(err.message) });
                        return [3 /*break*/, 25];
                    }
                    log.info("Running ".concat(m.label, "..."));
                    return [4 /*yield*/, pool.connect()];
                case 9:
                    client = _d.sent();
                    _d.label = 10;
                case 10:
                    _d.trys.push([10, 19, 24, 25]);
                    return [4 /*yield*/, client.query('BEGIN')];
                case 11:
                    _d.sent();
                    return [4 /*yield*/, client.query(sql)];
                case 12:
                    _d.sent();
                    if (!useUpsert) return [3 /*break*/, 14];
                    ins = buildOne(m.trackingKey);
                    return [4 /*yield*/, client.query(ins.sql, ins.params)];
                case 13:
                    _d.sent();
                    return [3 /*break*/, 17];
                case 14: return [4 /*yield*/, client.query("SELECT 1 FROM schema_migrations WHERE \"".concat(shape.keyCol, "\" = $1 LIMIT 1"), [m.trackingKey])];
                case 15:
                    exists = _d.sent();
                    if (!(exists.rowCount === 0)) return [3 /*break*/, 17];
                    ins = buildOne(m.trackingKey);
                    return [4 /*yield*/, client.query(ins.sql, ins.params)];
                case 16:
                    _d.sent();
                    _d.label = 17;
                case 17: return [4 /*yield*/, client.query('COMMIT')];
                case 18:
                    _d.sent();
                    log.info("\u2713 ".concat(m.label));
                    result.applied.push(m.label);
                    applied.add(m.trackingKey);
                    return [3 /*break*/, 25];
                case 19:
                    err_1 = _d.sent();
                    _d.label = 20;
                case 20:
                    _d.trys.push([20, 22, , 23]);
                    return [4 /*yield*/, client.query('ROLLBACK')];
                case 21:
                    _d.sent();
                    return [3 /*break*/, 23];
                case 22:
                    _c = _d.sent();
                    return [3 /*break*/, 23];
                case 23:
                    log.error("\u2717 ".concat(m.label, ": ").concat(err_1.message));
                    result.failed.push({ file: m.label, error: err_1.message });
                    return [3 /*break*/, 25];
                case 24:
                    client.release();
                    return [7 /*endfinally*/];
                case 25:
                    _b++;
                    return [3 /*break*/, 8];
                case 26:
                    if (result.applied.length === 0 && result.failed.length === 0) {
                        log.info("No pending migrations (".concat(result.skipped, " already applied)."));
                    }
                    else {
                        log.info("Done \u2014 applied ".concat(result.applied.length, ", ") +
                            "skipped ".concat(result.skipped, ", failed ").concat(result.failed.length, "."));
                    }
                    return [2 /*return*/, result];
            }
        });
    });
}
var REQUIRED_COLUMNS = [
    { table: 'deal_financial_models', column: 'assumptions_hash',
        reason: 'F9 cache staleness check (Task #493 / #511)' },
    { table: 'deal_financial_models', column: 'error_message',
        reason: 'engine writes failure reason (Task #511)' },
];
function verifyCriticalSchema(pool_1) {
    return __awaiter(this, arguments, void 0, function (pool, log) {
        var missing, _i, REQUIRED_COLUMNS_1, req, rows, err_2, _a, missing_1, m;
        if (log === void 0) { log = consoleLogger; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    missing = [];
                    _i = 0, REQUIRED_COLUMNS_1 = REQUIRED_COLUMNS;
                    _b.label = 1;
                case 1:
                    if (!(_i < REQUIRED_COLUMNS_1.length)) return [3 /*break*/, 6];
                    req = REQUIRED_COLUMNS_1[_i];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, pool.query("SELECT 1\n           FROM information_schema.columns\n          WHERE table_name = $1 AND column_name = $2\n          LIMIT 1", [req.table, req.column])];
                case 3:
                    rows = (_b.sent()).rows;
                    if (rows.length === 0)
                        missing.push(req);
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _b.sent();
                    log.warn("schema check failed for ".concat(req.table, ".").concat(req.column, ": ").concat(err_2.message));
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6:
                    if (missing.length > 0) {
                        log.warn("SCHEMA DRIFT \u2014 ".concat(missing.length, " required column(s) missing:"));
                        for (_a = 0, missing_1 = missing; _a < missing_1.length; _a++) {
                            m = missing_1[_a];
                            log.warn("  \u2022 ".concat(m.table, ".").concat(m.column, "  (").concat(m.reason, ")"));
                        }
                        log.warn('A migration file likely exists in the codebase but was not');
                        log.warn('applied to this database. Run: npm --prefix backend run migrate');
                    }
                    else {
                        log.info("schema check OK (".concat(REQUIRED_COLUMNS.length, " required column(s) present)."));
                    }
                    return [2 /*return*/, { ok: missing.length === 0, missing: missing }];
            }
        });
    });
}
/**
 * Throws if any critical column is missing. Intended for callers that want
 * to fail-fast at startup rather than warn — keeps the warn path available
 * for development environments where a partial schema is sometimes desired.
 */
function assertCriticalSchema(pool_1) {
    return __awaiter(this, arguments, void 0, function (pool, log) {
        var r, detail;
        if (log === void 0) { log = consoleLogger; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, verifyCriticalSchema(pool, log)];
                case 1:
                    r = _a.sent();
                    if (!r.ok) {
                        detail = r.missing.map(function (m) { return "".concat(m.table, ".").concat(m.column); }).join(', ');
                        throw new Error("schema drift detected \u2014 missing required column(s): ".concat(detail));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Mark every discovered migration as applied WITHOUT running it. Used once
 * after deploying this framework to an existing database whose schema is
 * already correct (so the legacy SQL files — many of which contain bugs
 * like Supabase-only roles or ON CONFLICT on non-unique columns — don't
 * spam the startup log on every boot). After baselining, only newly-added
 * .sql files will be attempted.
 */
function baselineMigrations(pool_1) {
    return __awaiter(this, arguments, void 0, function (pool, log) {
        var shape, applied, all, allocateNum, buildOne, recorded, _i, all_3, m, ins, err_3;
        if (log === void 0) { log = consoleLogger; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, resolveTableShape(pool)];
                case 1:
                    shape = _a.sent();
                    return [4 /*yield*/, loadAppliedSet(pool, shape)];
                case 2:
                    applied = _a.sent();
                    all = discoverMigrations();
                    return [4 /*yield*/, makeNumberAllocator(pool, shape)];
                case 3:
                    allocateNum = _a.sent();
                    buildOne = buildInsert(shape, allocateNum, 'insert');
                    recorded = 0;
                    _i = 0, all_3 = all;
                    _a.label = 4;
                case 4:
                    if (!(_i < all_3.length)) return [3 /*break*/, 9];
                    m = all_3[_i];
                    // Skip duplicates within the same baseline run too — the same basename
                    // can appear in both migration directories (today: `20260502_*.sql`).
                    if (applied.has(m.trackingKey))
                        return [3 /*break*/, 8];
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    ins = buildOne(m.trackingKey);
                    return [4 /*yield*/, pool.query(ins.sql, ins.params)];
                case 6:
                    _a.sent();
                    applied.add(m.trackingKey);
                    recorded++;
                    return [3 /*break*/, 8];
                case 7:
                    err_3 = _a.sent();
                    log.warn("baseline insert failed for ".concat(m.trackingKey, ": ").concat(err_3.message));
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 4];
                case 9:
                    log.info("Baseline recorded ".concat(recorded, " migration(s); ").concat(applied.size, " were already tracked."));
                    return [2 /*return*/, { recorded: recorded, alreadyApplied: applied.size }];
            }
        });
    });
}
// ── CLI entry point ────────────────────────────────────────────────────────
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var getPool, pool, isBaseline, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('../database/connection'); })];
                case 1:
                    getPool = (_a.sent()).getPool;
                    pool = getPool();
                    isBaseline = process.argv.includes('--baseline');
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 8, 10]);
                    if (!isBaseline) return [3 /*break*/, 5];
                    return [4 /*yield*/, baselineMigrations(pool)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, verifyCriticalSchema(pool)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
                case 5: return [4 /*yield*/, runPendingMigrations(pool)];
                case 6:
                    res = _a.sent();
                    return [4 /*yield*/, verifyCriticalSchema(pool)];
                case 7:
                    _a.sent();
                    if (res.failed.length > 0)
                        process.exit(1);
                    return [3 /*break*/, 10];
                case 8: return [4 /*yield*/, pool.end().catch(function () { })];
                case 9:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    });
}
if (require.main === module) {
    main().catch(function (err) {
        console.error('[migrate] Fatal:', err.message);
        process.exit(1);
    });
}
