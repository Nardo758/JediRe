/**
 * Safe formula evaluator — Custom Metrics Category 7
 *
 * CUSTOM_METRICS_BUILD_SPEC.md §4 — Security boundary
 *
 * "Any formula" must never become eval() on user input.
 * Parses → AST → validates against whitelist → rejects unknowns.
 *
 * Allowed: field identifiers (whitelist), numeric literals, operators + - * / ( ),
 * functions {min, max, avg, abs, round}. Nothing else.
 *
 * No eval(), no Function(), no dynamic dispatch.
 */

import { logger } from '../../utils/logger';

// ─── Whitelist ───────────────────────────────────────────────────────────────

/** System field keys available in custom metric formulas. */
export const FIELD_WHITELIST = new Set([
  // P&L fields
  'gpr', 'loss_to_lease', 'vacancy_loss', 'concessions', 'bad_debt',
  'net_rental_income', 'other_income', 'effective_gross_income',
  'egi', 'payroll', 'repairs_maintenance', 'turnover', 'amenities',
  'contract_services', 'marketing', 'office', 'g_and_a', 'hoa_dues',
  'utilities', 'water_sewer', 'electric', 'gas_fuel', 'landscaping',
  'management_fee', 'insurance', 'real_estate_tax', 'personal_property_tax',
  'replacement_reserves', 'total_opex', 'noi', 'noi_per_unit',
  'loss_to_lease_pct', 'vacancy_pct', 'concessions_pct', 'bad_debt_pct',
  'non_revenue_units_pct', 'management_fee_pct',
  // Capital / deal fields
  'loan_amount', 'purchase_price', 'equity', 'units', 'total_units',
  'occupied_units', 'occupancy_rate', 'dscr', 'debt_service',
  'cash_on_cash', 'irr', 'equity_multiple', 'exit_cap_rate',
  // Other custom metrics (resolved at evaluation time)
]);

/** Allowed functions in custom metric formulas. */
export const FUNCTION_WHITELIST = new Set([
  'min', 'max', 'avg', 'abs', 'round',
]);

// ─── AST Types ───────────────────────────────────────────────────────────────

export type ASTNode =
  | { type: 'literal'; value: number }
  | { type: 'field'; name: string }
  | { type: 'function'; name: string; args: ASTNode[] }
  | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: ASTNode; right: ASTNode }
  | { type: 'unary'; op: '+' | '-'; operand: ASTNode };

export interface ValidatedFormula {
  ast: ASTNode;
  referencedFields: string[];
  referencedMetrics: string[];  // other custom metric keys
  isRatio: boolean;             // formula shape is a/b → ratio
}

export interface ValidationResult {
  valid: boolean;
  formula?: ValidatedFormula;
  error?: string;
}

// ─── Tokenizer ─────────────────────────────────────────────────────────────────

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }
  | { type: 'eof' };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  const s = input.trim();

  while (pos < s.length) {
    const ch = s[pos];

    // Skip whitespace
    if (/\s/.test(ch)) {
      pos++;
      continue;
    }

    // Number (integer or decimal)
    if (/\d/.test(ch)) {
      let end = pos;
      while (end < s.length && (/\d/.test(s[end]) || s[end] === '.')) end++;
      const num = parseFloat(s.slice(pos, end));
      tokens.push({ type: 'number', value: num });
      pos = end;
      continue;
    }

    // Identifier (field or function name)
    if (/[a-zA-Z_]/.test(ch)) {
      let end = pos;
      while (end < s.length && /[a-zA-Z0-9_]/.test(s[end])) end++;
      tokens.push({ type: 'identifier', value: s.slice(pos, end) });
      pos = end;
      continue;
    }

    // Operators
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'operator', value: ch });
      pos++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      pos++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      pos++;
      continue;
    }

    // Comma
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      pos++;
      continue;
    }

    // Unknown token → reject
    throw new Error(`Invalid token at position ${pos}: '${ch}'`);
  }

  tokens.push({ type: 'eof' });
  return tokens;
}

// ─── Parser (Recursive descent) ──────────────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: Token['type']): Token {
    const tok = this.current();
    if (tok.type !== type) {
      throw new Error(`Expected ${type}, got ${tok.type}`);
    }
    this.pos++;
    return tok;
  }

  parse(): ASTNode {
    const node = this.parseExpression();
    this.expect('eof');
    return node;
  }

  // expression → term ((+|-) term)*
  private parseExpression(): ASTNode {
    let left = this.parseTerm();
    while (this.current().type === 'operator' && (this.current().value === '+' || this.current().value === '-')) {
      const op = this.advance().value as '+' | '-';
      const right = this.parseTerm();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  // term → factor ((*|/) factor)*
  private parseTerm(): ASTNode {
    let left = this.parseFactor();
    while (this.current().type === 'operator' && (this.current().value === '*' || this.current().value === '/')) {
      const op = this.advance().value as '*' | '/';
      const right = this.parseFactor();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  // factor → (+|-) factor | primary
  private parseFactor(): ASTNode {
    const tok = this.current();
    if (tok.type === 'operator' && (tok.value === '+' || tok.value === '-')) {
      const op = this.advance().value as '+' | '-';
      const operand = this.parseFactor();
      return { type: 'unary', op, operand };
    }
    return this.parsePrimary();
  }

  // primary → number | identifier | function_call | '(' expression ')'
  private parsePrimary(): ASTNode {
    const tok = this.current();

    if (tok.type === 'number') {
      this.advance();
      return { type: 'literal', value: tok.value };
    }

    if (tok.type === 'identifier') {
      this.advance();
      // Check if function call
      if (this.current().type === 'lparen') {
        // Function call
        const name = tok.value;
        this.advance(); // consume lparen
        const args: ASTNode[] = [];
        if (this.current().type !== 'rparen') {
          args.push(this.parseExpression());
          while (this.current().type === 'comma') {
            this.advance();
            args.push(this.parseExpression());
          }
        }
        this.expect('rparen');
        return { type: 'function', name, args };
      }
      // Field reference
      return { type: 'field', name: tok.value };
    }

    if (tok.type === 'lparen') {
      this.advance();
      const expr = this.parseExpression();
      this.expect('rparen');
      return expr;
    }

    throw new Error(`Unexpected token: ${tok.type}`);
  }
}

// ─── Validator ─────────────────────────────────────────────────────────────────

function validateAST(node: ASTNode, selfKey: string, otherMetricKeys: Set<string>): { valid: boolean; error?: string; referencedFields: string[]; referencedMetrics: string[]; isRatio: boolean } {
  const referencedFields: string[] = [];
  const referencedMetrics: string[] = [];

  function walk(n: ASTNode): { isRatio: boolean; hasDiv: boolean } {
    switch (n.type) {
      case 'literal':
        return { isRatio: false, hasDiv: false };

      case 'field': {
        // Check whitelist
        if (!FIELD_WHITELIST.has(n.name) && !otherMetricKeys.has(n.name)) {
          throw new Error(`Unknown identifier: '${n.name}'`);
        }
        if (n.name === selfKey) {
          throw new Error(`Self-reference: metric cannot reference itself`);
        }
        if (otherMetricKeys.has(n.name)) {
          referencedMetrics.push(n.name);
        } else {
          referencedFields.push(n.name);
        }
        return { isRatio: false, hasDiv: false };
      }

      case 'function': {
        if (!FUNCTION_WHITELIST.has(n.name)) {
          throw new Error(`Unknown function: '${n.name}'`);
        }
        let childHasDiv = false;
        for (const arg of n.args) {
          const res = walk(arg);
          childHasDiv = childHasDiv || res.hasDiv;
        }
        return { isRatio: false, hasDiv: childHasDiv };
      }

      case 'binary': {
        const left = walk(n.left);
        const right = walk(n.right);
        const hasDiv = left.hasDiv || right.hasDiv || n.op === '/';
        // A ratio is a division where both operands are "additive" (fields or sums)
        const isRatio = n.op === '/' && (n.left.type === 'field' || n.left.type === 'binary' && (n.left.op === '+' || n.left.op === '-'));
        return { isRatio: isRatio || left.isRatio || right.isRatio, hasDiv };
      }

      case 'unary': {
        return walk(n.operand);
      }
    }
  }

  try {
    const result = walk(node);
    return { valid: true, referencedFields: [...new Set(referencedFields)], referencedMetrics: [...new Set(referencedMetrics)], isRatio: result.isRatio };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err), referencedFields: [], referencedMetrics: [], isRatio: false };
  }
}

// ─── Cycle Detection ─────────────────────────────────────────────────────────

/**
 * Detect cycles in custom metric references.
 * Returns { valid: true } if no cycles, { valid: false, cycle: [...] } if cycle found.
 */
export function detectCycles(metricGraph: Record<string, string[]>): { valid: boolean; cycle?: string[] } {
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string): string[] | null {
    visited.add(node);
    recStack.add(node);

    for (const neighbor of metricGraph[node] ?? []) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      } else if (recStack.has(neighbor)) {
        return [neighbor, node]; // cycle found
      }
    }

    recStack.delete(node);
    return null;
  }

  for (const key of Object.keys(metricGraph)) {
    if (!visited.has(key)) {
      const cycle = dfs(key);
      if (cycle) {
        return { valid: false, cycle };
      }
    }
  }

  return { valid: true };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate a custom metric formula string.
 *
 * @param formulaString  The formula to validate (e.g., "noi / loan_amount")
 * @param selfKey        The metric_key being defined (for self-reference guard)
 * @param otherMetricKeys Other custom metric keys already defined (for cycle detection + whitelist)
 * @returns              ValidationResult with AST or error
 */
export function validateFormula(
  formulaString: string,
  selfKey: string,
  otherMetricKeys: Set<string> = new Set(),
): ValidationResult {
  try {
    const tokens = tokenize(formulaString);
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const validation = validateAST(ast, selfKey, otherMetricKeys);
    if (!validation.valid) {
      return { valid: false, error: validation.error };
    }

    // Cycle detection: if this metric references others, check the full graph
    if (validation.referencedMetrics.length > 0) {
      const graph: Record<string, string[]> = { [selfKey]: validation.referencedMetrics };
      for (const key of otherMetricKeys) {
        graph[key] = graph[key] || []; // populated by caller if needed
      }
      const cycleResult = detectCycles(graph);
      if (!cycleResult.valid) {
        return { valid: false, error: `Cycle detected: ${cycleResult.cycle?.join(' → ')}` };
      }
    }

    return {
      valid: true,
      formula: {
        ast,
        referencedFields: validation.referencedFields,
        referencedMetrics: validation.referencedMetrics,
        isRatio: validation.isRatio,
      },
    };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Evaluate a validated AST against a context of field values.
 *
 * @param ast       The validated AST
 * @param context   Field values at a single period { gpr: 5000, noi: 2000, ... }
 * @returns         The computed value, or null if any input is null/undefined
 */
export function evaluateFormula(ast: ASTNode, context: Record<string, number | null>): number | null {
  function evalNode(node: ASTNode): number | null {
    switch (node.type) {
      case 'literal':
        return node.value;

      case 'field': {
        const val = context[node.name];
        return val != null && isFinite(val) ? val : null;
      }

      case 'function': {
        const argVals = node.args.map(evalNode);
        if (argVals.some(v => v == null)) return null;
        const vals = argVals as number[];
        switch (node.name) {
          case 'min': return Math.min(...vals);
          case 'max': return Math.max(...vals);
          case 'avg': return vals.reduce((a, b) => a + b, 0) / vals.length;
          case 'abs': return Math.abs(vals[0]);
          case 'round': return Math.round(vals[0]);
          default: return null; // should not happen after validation
        }
      }

      case 'binary': {
        const left = evalNode(node.left);
        const right = evalNode(node.right);
        if (left == null || right == null) return null;
        switch (node.op) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return right !== 0 ? left / right : null; // div-by-zero guard
        }
      }

      case 'unary': {
        const val = evalNode(node.operand);
        if (val == null) return null;
        return node.op === '-' ? -val : val;
      }
    }
  }

  return evalNode(ast);
}

/**
 * Infer default rollup from formula shape.
 *
 * @param formula  The validated formula
 * @returns        'sum' | 'avg' | 'end_of_period' | 'rederive'
 */
export function inferRollup(formula: ValidatedFormula): 'sum' | 'avg' | 'end_of_period' | 'rederive' {
  if (formula.isRatio) return 'rederive'; // ratio cannot be summed
  if (formula.referencedFields.length === 1) {
    // Single field: infer from the field name
    const field = formula.referencedFields[0];
    if (field.endsWith('_pct') || field.endsWith('_rate') || field === 'occupancy_rate') return 'avg';
    if (field === 'units' || field === 'total_units' || field === 'occupied_units') return 'end_of_period';
  }
  return 'sum'; // default: flow field, sum monthly → annual
}

/**
 * Block sum on ratio-shaped formulas.
 *
 * @param formula  The validated formula
 * @param rollup   The requested rollup
 * @returns        { allowed: boolean, error?: string }
 */
export function checkRollupAllowed(
  formula: ValidatedFormula,
  rollup: 'sum' | 'avg' | 'end_of_period' | 'rederive',
): { allowed: boolean; error?: string } {
  if (rollup === 'sum' && formula.isRatio) {
    return {
      allowed: false,
      error: 'Rollup "sum" is blocked for ratio-shaped formulas. A ratio cannot be summed month-to-annual. Use "rederive" instead (re-derives at annual level from annual inputs).',
    };
  }
  return { allowed: true };
}
