// Safe arithmetic evaluator (recursive descent) — never uses eval().
// Supports + - * / % ^, parentheses, unary minus, constants pi/e and common functions.
const FUNCS = { sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, round: Math.round, floor: Math.floor, ceil: Math.ceil };
const CONSTS = { pi: Math.PI, e: Math.E };

export function calculate(input) {
  const src = input.toLowerCase().replace(/[x×]/g, '*').replace(/÷/g, '/').replace(/,/g, '');
  const tokens = src.match(/\d*\.?\d+(?:e[+-]?\d+)?|[a-z]+|[-+*/%^()]/g);
  if (!tokens || tokens.join('') !== src.replace(/\s+/g, '')) throw new Error('Unsupported characters in expression');
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];

  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') v = next() === '+' ? v + term() : v - term();
    return v;
  }
  function term() {
    let v = power();
    while (['*', '/', '%'].includes(peek())) {
      const op = next();
      const r = power();
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  }
  function power() {
    const base = unary();
    if (peek() === '^') {
      next();
      return base ** power();
    }
    return base;
  }
  function unary() {
    if (peek() === '-') { next(); return -unary(); }
    if (peek() === '+') { next(); return unary(); }
    return primary();
  }
  function primary() {
    const t = next();
    if (t === undefined) throw new Error('Unexpected end of expression');
    if (t === '(') {
      const v = expr();
      if (next() !== ')') throw new Error('Missing )');
      return v;
    }
    if (/^[\d.]/.test(t)) return Number(t);
    if (t in CONSTS) return CONSTS[t];
    if (t in FUNCS) {
      if (next() !== '(') throw new Error(`Expected ( after ${t}`);
      const v = expr();
      if (next() !== ')') throw new Error('Missing )');
      return FUNCS[t](v);
    }
    throw new Error(`Unknown token "${t}"`);
  }

  const result = expr();
  if (i < tokens.length) throw new Error(`Unexpected "${tokens[i]}"`);
  if (!Number.isFinite(result)) throw new Error('Result is not a finite number');
  return Math.round(result * 1e10) / 1e10;
}

// Pull the math part out of a sentence like "what is 12 * (3 + 4)?"
export function extractExpression(text) {
  const m = text.match(/[-+*/%^().\d\sx×÷a-z]*\d[-+*/%^().\d\sx×÷a-z]*/i);
  if (!m) return null;
  return m[0].replace(/\b(what|is|calculate|calc|compute|equals?|the|of|please)\b/gi, '').trim() || null;
}
