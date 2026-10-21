/*
 * mathCheck - compares a student's answer with a reference answer and grades it.
 * Design: CHECKING-API-DESIGN.md (API, rules, rubric) and ANSWER-CHECKING-DESIGN.md (the math tree, strategies).
 *
 *   MathCheck.compare(student, reference, rules, rubric, options) -> { grade, correct, feedback, items, ... }
 *
 * Input: the semantic AST of fullKbdLib-v4 (getAST(): {type: "chain", elements: [...]}), as an object or JSON text.
 * Pure functions: no DOM, no network. One file for the browser (global MathCheck) and Node (require).
 * Deterministic: random sample points come from a seeded generator, so the same inputs give the same grade anywhere.
 *
 * Version 0.1 (2026-10-21): value (numeric sampling), equations, inequalities, and / or, sets, tuples, derivations
 * (last step or all steps), the equivalence ladder (structural canonical form), form checks, diagnosis of a wrong value,
 * teacher-defined mistakes, the rubric, feedback in he / en / ar. Not yet: structures (integral, limit, Σ...) beyond
 * exact comparison, units, complex numbers, highlighting (the items keep the node ids for it).
 */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.MathCheck = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const VERSION = "0.2.0";

/* ============================================================
   DEFAULTS
   ============================================================ */
const DEFAULT_RULES = {
    answerKind: "auto",
    acceptKinds: [],
    value: {
        mode: "numeric",                 // numeric | structural | exact
        variables: {},                   // { x: { min, max, integer, positive, nonzero } }
        samples: 8,
        tolerance: { relative: 1e-9, absolute: 1e-12 },
        domain: { min: -4, max: 4 }      // default range for every variable
    },
    equivalence: {                       // true: accepted silently, "note": accepted with a note, false: not accepted
        commutative: true,
        numericEvaluation: true,
        decimalFraction: true,
        signPlacement: true,
        fractionForms: true,
        powerForms: true,
        likeTerms: true,
        distributive: true,
        vectorReversal: true,            // BA⃗ = −AB⃗ (in structural mode; by value always)
        equationTransforms: true         // y + 3 = 2x + 5 is y = 2x + 2: terms moved between the sides (scaling: statements.scaleEquation)
    },
    form: {},                            // check: "off" | "note" | "error"; isolatedVariable: "x" with level
    statements: {
        scaleEquation: true,             // 2x = 4 is x = 2
        sameSolutions: true,             // xy = 8 is y = 8/x (the same solution set): true | "note" | false
        domain: null,                    // { y: { min: "-pi/2", max: "pi/2" } }: equivalent only there -> partial (category domain)
        derivation: "lastOnly"           // lastOnly | allSteps
    },
    collections: {
        setDuplicates: "note"
    },
    numbers: {
        decimals: null,                  // { exactly | min | max: n }
        closeButWrong: 0                 // percent: outside the tolerance but within it -> "rounding"
    },
    diagnosis: true,
    mistakes: [],
    feedback: {
        showPenalties: true,
        showNotes: true,
        showReference: false,
        messages: {}                     // { code: { he, en, ar } }
    }
};

const DEFAULT_RUBRIC = {
    start: 100,
    minimum: 0,
    fatal: ["incomplete", "answerType"],
    categories: {
        value: { mode: "once", points: 100 },
        form: { mode: "each", points: 10, max: 30 },
        relation: { mode: "once", points: 50 },
        elements: { mode: "each", points: 25, max: 100 },
        order: { mode: "once", points: 25 },
        precision: { mode: "once", points: 10 },
        derivation: { mode: "once", points: 20 },
        domain: { mode: "once", points: 30 },
        mistake: { mode: "once", points: 100 }
    }
};

/* error code -> rubric category (CHECKING-API-DESIGN 4.2) */
const CATEGORY_OF = {
    "incomplete": "incomplete",
    "answer-type": "answerType",
    "wrong-value": "value",
    "not-evaluated": "value",
    "domain-only": "domain",
    "sign-error": "sign",
    "missing-factor": "factor",
    "scale-error": "scale",
    "missing-term": "term",
    "extra-term": "term",
    "fraction-not-reduced": "form",
    "not-simplified": "form",
    "not-expanded": "form",
    "not-factored": "form",
    "not-fully-factored": "form",
    "negative-exponent": "form",
    "irrational-denominator": "form",
    "not-exact": "form",
    "not-isolated": "form",
    "not-equivalent-form": "form",
    "wrong-relation": "relation",
    "wrong-direction": "relation",
    "missing-element": "elements",
    "extra-element": "elements",
    "duplicate-element": "elements",
    "missing-statement": "elements",
    "extra-statement": "elements",
    "wrong-order": "order",
    "wrong-decimals": "precision",
    "rounding": "precision",
    "wrong-step": "derivation",
    "teacher-mistake": "mistake",
    "unsupported": "value"
};

/* the diagnosis categories: graded through "value" until the rubric sets them (CHECKING-API-DESIGN 9.2) */
const DIAGNOSIS_CATEGORIES = ["sign", "factor", "scale", "term"];
/* categories that cost points even when the teacher's rubric does not list them */
const CATEGORY_DEFAULTS = { domain: { mode: "once", points: 30 } };

/* ============================================================
   SMALL HELPERS
   ============================================================ */
function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

function merge(base, over) {
    if (over === undefined || over === null) return clone(base);
    if (typeof base !== "object" || base === null || Array.isArray(base)) return clone(over);
    const out = clone(base);
    Object.keys(over).forEach(function (k) {
        if (over[k] === undefined) return;
        out[k] =(typeof base[k] === "object" && base[k] !== null && !Array.isArray(base[k]) &&
            typeof over[k] === "object" && over[k] !== null && !Array.isArray(over[k]))
            ? merge(base[k], over[k]) : clone(over[k]);
    });
    return out;
}

function parseInput(x) {
    if (typeof x === "string") {
        try { return JSON.parse(x); } catch (e) { return null; }
    }
    return x || null;
}

/* the node without editor ids - for keys, seeds and exact comparison */
function stripSrc(node) {
    return JSON.parse(JSON.stringify(node, function (k, v) { return k === "src" ? undefined : v; }));
}

function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/* mulberry32 - small, fast, seeded */
function makeRandom(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function walk(node, fn) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(function (n) { walk(n, fn); }); return; }
    fn(node);
    Object.keys(node).forEach(function (k) {
        if (k === "src") return;
        const v = node[k];
        if (v && typeof v === "object") walk(v, fn);
    });
}

function srcOf(node) {
    const ids = [];
    walk(node, function (n) { (n.src || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
    return ids;
}

/* ============================================================
   RATIONAL NUMBERS (for the canonical form)
   ============================================================ */
function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = a % b; a = b; b = t; }
    return a;
}
function rat(n, d) {
    if (d === undefined) d = 1;
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d) || 1;
    return { n: n / g, d: d / g };
}
function ratAdd(a, b) { return rat(a.n * b.d + b.n * a.d, a.d * b.d); }
function ratMul(a, b) { return rat(a.n * b.n, a.d * b.d); }
function ratIsInt(a) { return a.d === 1; }
function ratPowInt(a, k) {
    if (k === 0) return rat(1);
    if (k < 0) return ratPowInt(rat(a.d, a.n), -k);
    let r = rat(1);
    for (let i = 0; i < k; i += 1) r = ratMul(r, a);
    return r;
}
function ratFromString(s) {
    s = String(s).trim();
    const neg = s.charAt(0) === "-";
    if (neg) s = s.slice(1);
    const m = /^(\d*)(?:\.(\d*))?$/.exec(s);
    if (!m) return null;
    const whole = m[1] || "0", frac = m[2] || "";
    if (whole.length + frac.length > 15) return null;          // beyond exact integer arithmetic
    const d = Math.pow(10, frac.length);
    const r = rat(Number(whole) * d + (frac ? Number(frac) : 0), d);
    return neg ? rat(-r.n, r.d) : r;
}
function ratKey(a) { return a.d === 1 ? String(a.n) : a.n + "/" + a.d; }

/* ============================================================
   THE ANSWER: chain, kind
   ============================================================ */
/* the answer inside the keyboard's root: one expression, an equation (2 elements), a derivation (3+) */
function answerOf(rootNode) {
    if (!rootNode) return null;
    if (rootNode.type !== "chain") return rootNode;
    const els = (rootNode.elements || []).filter(function (e) { return e !== null && e !== undefined; });
    if (els.length === 0) return null;
    if (els.length === 1) return els[0];
    return { type: "chain", elements: els };
}

const RELATION_OPS = {
    less: true, greater: true, lessEqual: true, greaterEqual: true, notEqual: true, approximate: true, equal: true
};

function kindOf(a) {
    if (!a) return "empty";
    if (a.type === "chain") return a.elements.length === 2 ? "equation" : "derivation";
    if (a.type === "relation") return "inequality";
    if (a.type === "operation" && (a.op === "and" || a.op === "or" || a.op === "implies")) return "statement";
    if (a.type === "set") return "set";
    if (a.type === "tuple") return "tuple";
    if (a.type === "list") return "list";
    return "expression";
}

function hasMissing(node) {
    let found = false;
    walk(node, function (n) { if (n.type === "missing" || n.type === "placeholder") found = true; });
    return found;
}

/* ============================================================
   NUMERIC EVALUATION
   ============================================================ */
function Unsupported(what) { this.what = what; }

function varKey(node) {
    if (node.type === "variable") return node.name;
    if (node.type === "indexedVariable") return varKey(node.variable) + "_" + keyOfPlain(node.subscript);
    if (node.type === "variableName") return node.name + (node.subscript ? "_" + keyOfPlain(node.subscript) : "");
    return null;
}
function keyOfPlain(node) { return JSON.stringify(stripSrc(node)); }

/*
 * A vector as an unknown: AB⃗ between two points -> "vec(AB)"; BA⃗ = −AB⃗, so the points in order and a sign
 * (reversed: written in the other order). v⃗ -> "vec(v)". { key, sign, written }
 */
function vectorKey(node) {
    const nm = node.name || {};
    if (nm.points && nm.points.length === 2) {
        const p = varKey(nm.points[0]), q = varKey(nm.points[1]);
        const join = function (a, b) { return "vec(" + a + (a.length > 1 || b.length > 1 ? "," : "") + b + ")"; };
        return p <= q ? { key: join(p, q), sign: 1, written: join(p, q) } : { key: join(q, p), sign: -1, written: join(p, q) };
    }
    const k = "vec(" + (varKey(nm) || keyOfPlain(nm)) + ")";
    return { key: k, sign: 1, written: k };
}

function collectVariables(node, set) {
    walk(node, function (n) {
        if (n.type === "vector") {
            const v = vectorKey(n).key;
            if (set.indexOf(v) < 0) set.push(v);
            return;
        }
        if (n.type === "variable" || n.type === "indexedVariable") {
            const k = varKey(n);
            if (k && set.indexOf(k) < 0) set.push(k);
        }
    });
    return set;
}

function factorial(n) {
    if (n < 0 || Math.floor(n) !== n || n > 170) return NaN;
    let r = 1;
    for (let i = 2; i <= n; i += 1) r *= i;
    return r;
}

/* the value of an expression at env = { vars: {x: 1.3}, s: 1 }; s is the ± sign (ANSWER-CHECKING 4.2) */
function evaluate(node, env) {
    if (!node) throw new Unsupported("empty");
    switch (node.type) {
        case "number": return parseFloat(node.value);
        case "variable":
        case "indexedVariable": {
            const k = varKey(node);
            if (!(k in env.vars)) throw new Unsupported("variable " + k);
            return env.vars[k];
        }
        case "vector": {
            /* BA⃗ = −AB⃗ always, by value */
            const v = vectorKey(node);
            if (!(v.key in env.vars)) throw new Unsupported("vector " + v.key);
            return v.sign * env.vars[v.key];
        }
        case "constant":
            if (node.name === "pi") return Math.PI;
            if (node.name === "e") return Math.E;
            throw new Unsupported("constant " + node.name);
        case "operation": {
            const v = function (i) { return evaluate(node.operands[i], env); };
            switch (node.op) {
                case "+": return node.operands.reduce(function (a, o) { return a + evaluate(o, env); }, 0);
                case "*": return node.operands.reduce(function (a, o) { return a * evaluate(o, env); }, 1);
                case "neg": return -v(0);
                case "/": return v(0) / v(1);
                case "^": {
                    const b = v(0), e = v(1);
                    /* a negative base with an odd-denominator exponent (x^(1/3)) - real root */
                    if (b < 0 && Math.floor(e) !== e) {
                        const inv = 1 / e;
                        if (Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 === 1) return -Math.pow(-b, e);
                        return NaN;
                    }
                    return Math.pow(b, e);
                }
                case "plusMinus": return node.operands.length === 2 ? v(0) + env.s * v(1) : env.s * v(0);
                case "minusPlus": return node.operands.length === 2 ? v(0) - env.s * v(1) : -env.s * v(0);
            }
            throw new Unsupported("operation " + node.op);
        }
        case "function": {
            const a = evaluate(node.argument, env);
            switch (node.name) {
                case "sqrt": return Math.sqrt(a);
                case "abs": return Math.abs(a);
                case "sin": return Math.sin(a);
                case "cos": return Math.cos(a);
                case "tan": return Math.tan(a);
                case "asin": return Math.asin(a);
                case "acos": return Math.acos(a);
                case "atan": return Math.atan(a);
                case "sinh": return Math.sinh(a);
                case "cosh": return Math.cosh(a);
                case "tanh": return Math.tanh(a);
                case "asinh": return Math.asinh(a);
                case "acosh": return Math.acosh(a);
                case "atanh": return Math.atanh(a);
                case "ln": return Math.log(a);
                case "log10": return Math.log10(a);
                case "log": return Math.log(a) / Math.log(evaluate(node.base, env));
            }
            throw new Unsupported("function " + node.name);
        }
        case "nthRoot": {
            const n = evaluate(node.index, env), x = evaluate(node.content, env);
            if (x < 0 && Math.round(n) % 2 === 1) return -Math.pow(-x, 1 / n);
            return Math.pow(x, 1 / n);
        }
        case "simpleFraction": return evaluate(node.numerator, env) / evaluate(node.denominator, env);
        case "mixedFraction": {
            const w = evaluate(node.whole, env), f = evaluate(node.numerator, env) / evaluate(node.denominator, env);
            return w < 0 ? w - f : w + f;
        }
        case "factorial": return factorial(evaluate(node.value, env));
        case "percent": return evaluate(node.value, env) / 100;
        case "degree": return evaluate(node.value, env) * Math.PI / 180;
        case "scientific": return evaluate(node.coefficient, env) * Math.pow(10, evaluate(node.exponent, env));
    }
    throw new Unsupported(node.type);
}

function usesPlusMinus(node) {
    let found = false;
    walk(node, function (n) { if (n.type === "operation" && (n.op === "plusMinus" || n.op === "minusPlus")) found = true; });
    return found;
}

/* ============================================================
   SAMPLING
   ============================================================ */
/*
 * Sample points for the variables of both expressions. Returns envs (one per point) - the same points for every
 * expression compared in one check (student, reference, a teacher mistake, a term), so the values can be compared.
 */
function makeSampler(rules, seed) {
    const random = makeRandom(seed);
    const dom = rules.value.domain || { min: -4, max: 4 };
    return function (vars, count) {
        const envs = [];
        for (let p = 0; p < count; p += 1) {
            const values = {};
            vars.forEach(function (k) {
                const spec = rules.value.variables[k] || {};
                let min = spec.min !== undefined ? spec.min : dom.min;
                let max = spec.max !== undefined ? spec.max : dom.max;
                if (spec.positive) min = Math.max(min, 0.05);
                let x = min + random() * (max - min);
                if (spec.integer) x = Math.round(x);
                if ((spec.nonzero || spec.integer) && Math.abs(x) < 0.05) x = spec.integer ? 1 : 0.37;
                values[k] = x;
            });
            envs.push({ vars: values, s: 1 });
        }
        return envs;
    };
}

function closeTo(a, b, tol) {
    if (!isFinite(a) || !isFinite(b)) return false;
    if (tol.decimals !== undefined) {
        const f = Math.pow(10, tol.decimals);
        return Math.round(a * f) === Math.round(b * f);
    }
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    return Math.abs(a - b) <= (tol.relative || 0) * scale + (tol.absolute || 0);
}

/*
 * The values of several expressions at the same points. ± : each point gives two values (s = +1, -1).
 * Returns { ok, rows: [{ env, values: [[v(s=+1), v(s=-1)] per expression] }], unsupported }.
 * A point where the first expression (the reference) is undefined is replaced by another one.
 */
function sampleValues(exprs, ctx) {
    const vars = [];
    exprs.forEach(function (e) { collectVariables(e, vars); });
    const pm = exprs.some(usesPlusMinus);
    const signs = pm ? [1, -1] : [1];
    const want = Math.max(3, ctx.rules.value.samples || 8);
    const envs = ctx.sample(vars, want * 4);
    const rows = [];
    try {
        for (let i = 0; i < envs.length && rows.length < want; i += 1) {
            const env = envs[i];
            const values = exprs.map(function (e) {
                return signs.map(function (s) { env.s = s; return evaluate(e, env); });
            });
            if (values[0].some(function (v) { return !isFinite(v); })) continue;
            rows.push({ env: { vars: env.vars }, values: values });
        }
    } catch (e) {
        if (e instanceof Unsupported) return { ok: false, unsupported: e.what, rows: [] };
        throw e;
    }
    return { ok: rows.length >= 3, rows: rows, vars: vars, pm: pm };
}

/* equal values at every point (± : the two values as a set) */
function rowsEqual(rows, i, j, tol) {
    return rows.every(function (row) {
        const a = row.values[i].slice().sort(function (x, y) { return x - y; });
        const b = row.values[j].slice().sort(function (x, y) { return x - y; });
        return a.every(function (v, k) { return closeTo(v, b[k], tol); });
    });
}

/* a constant k with values[i] = k·values[j] at every point (points where both are ~0 skipped); null if none */
function constantRatio(rows, i, j, tol) {
    let k = null;
    for (const row of rows) {
        const a = row.values[i][0], b = row.values[j][0];
        if (Math.abs(b) < 1e-12) {
            if (Math.abs(a) < 1e-9) continue;
            return null;
        }
        const r = a / b;
        if (k === null) k = r;
        else if (!closeTo(r, k, { relative: 1e-7, absolute: 1e-12 })) return null;
    }
    return k;
}

/* ============================================================
   CANONICAL FORM - the equivalence ladder (CHECKING-API-DESIGN 3.3)
   ============================================================ */
/*
 * A canonical node: { k: "num", r } | { k: "dec", v } | { k: "var", name } | { k: "const", name } | { k: "add", t: [] }
 * | { k: "mul", f: [] } | { k: "pow", b, e } | { k: "div", n, d } | { k: "neg", x } | { k: "fn", name, a: [] }
 * | { k: "pm", op, a: [] } | { k: "rel", op, l, r } | { k: "and" | "or", a: [] } | { k: "tuple" | "set", a: [] }
 * | { k: "other", key }. key(c) is a stable text: two answers are equivalent under a set of laws when their keys are equal.
 */
const LADDER = [
    { name: "identical", laws: [] },
    { name: "commutative", laws: ["commutative"] },
    { name: "numberForms", laws: ["numericEvaluation", "decimalFraction", "signPlacement", "fractionForms", "powerForms", "vectorReversal"] },
    { name: "likeTerms", laws: ["likeTerms"] },
    { name: "distributive", laws: ["distributive"] },
    /* equations and relations: L − R = 0, divided by the leading coefficient */
    { name: "equationForms", laws: ["equationTransforms"] }
];

function ckey(c) {
    switch (c.k) {
        case "num": return ratKey(c.r);
        case "dec": return "d" + c.v;
        case "var": return c.name;
        case "const": return "#" + c.name;
        case "add": return "(+ " + c.t.map(ckey).join(" ") + ")";
        case "mul": return "(* " + c.f.map(ckey).join(" ") + ")";
        case "pow": return "(^ " + ckey(c.b) + " " + ckey(c.e) + ")";
        case "div": return "(/ " + ckey(c.n) + " " + ckey(c.d) + ")";
        case "neg": return "(- " + ckey(c.x) + ")";
        case "fn": return c.name + "(" + c.a.map(ckey).join(",") + ")";
        case "pm": return "(" + c.op + " " + c.a.map(ckey).join(" ") + ")";
        case "rel": return "(" + c.op + " " + ckey(c.l) + " " + ckey(c.r) + ")";
        case "chain": return "chain[" + c.a.map(ckey).join(",") + "]";
        case "and": case "or": case "tuple": case "set": return c.k + "[" + c.a.map(ckey).join(",") + "]";
        case "other": return "other:" + c.key;
    }
    return "?";
}

function num(r) { return { k: "num", r: r }; }
function isNum(c) { return c.k === "num"; }
function isZero(c) { return isNum(c) && c.r.n === 0; }
function isOne(c) { return isNum(c) && c.r.n === 1 && c.r.d === 1; }

function sortByKey(list) {
    return list.slice().sort(function (a, b) {
        const ka = ckey(a), kb = ckey(b);
        /* numbers first, then by text */
        if (isNum(a) !== isNum(b)) return isNum(a) ? -1 : 1;
        return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
}

function canonical(node, o) {
    if (!node) return { k: "other", key: "null" };
    /*
     * sin(π/2) = 1, ln e = 1, log₂8 = 3, sin(π/3) = √3/2, sin⁻¹1 = π/2, 1/√2 = √2/2: numbers with a function or a
     * root in them, by their exact value (numericEvaluation)
     */
    if (o.numericEvaluation && node.type !== "number" && node.type !== "constant" && withFunction(node) &&
        !hasVariable(node) && !usesPlusMinus(node)) {
        const exact = exactValue(node, o);
        if (exact) return exact;
    }
    switch (node.type) {
        case "number": {
            const isDec = String(node.value).indexOf(".") >= 0;
            if (isDec && !o.decimalFraction) return { k: "dec", v: String(node.value) };
            const r = ratFromString(node.value);
            return r ? num(r) : { k: "dec", v: String(node.value) };
        }
        case "variable": case "indexedVariable": return { k: "var", name: varKey(node) };
        case "constant": return { k: "const", name: node.name };
        case "vector": {
            /* CB⃗ = −BC⃗ (vectorReversal); without the law the vector as written */
            const v = vectorKey(node);
            if (!o.vectorReversal) return { k: "var", name: v.written };
            return v.sign < 0 ? cneg({ k: "var", name: v.key }, o) : { k: "var", name: v.key };
        }
        case "operation": return canonicalOperation(node, o);
        case "relation": return crel(node.op, canonical(node.left, o), canonical(node.right, o), o);
        case "chain": {
            /* an equation is a chain of 2; a derivation keeps its steps */
            const els = node.elements.map(function (e) { return canonical(e, o); });
            if (els.length === 2) return crel("equal", els[0], els[1], o);
            return { k: "chain", a: els };
        }
        case "function": {
            const a = canonical(node.argument, o);
            if (node.name === "sqrt" && o.powerForms) return cpow(a, num(rat(1, 2)), o);
            const args = [a];
            if (node.base !== undefined) args.unshift(canonical(node.base, o));
            return { k: "fn", name: node.name, a: args };
        }
        case "nthRoot": {
            const n = canonical(node.index, o), x = canonical(node.content, o);
            if (o.powerForms && isNum(n) && ratIsInt(n.r) && n.r.n !== 0) return cpow(x, num(rat(1, n.r.n)), o);
            return { k: "fn", name: "root", a: [n, x] };
        }
        case "simpleFraction": return cdiv(canonical(node.numerator, o), canonical(node.denominator, o), o);
        case "mixedFraction": {
            const w = canonical(node.whole, o), f = cdiv(canonical(node.numerator, o), canonical(node.denominator, o), o);
            return cadd([w, f], o);
        }
        case "percent": return o.numericEvaluation ? cmul([canonical(node.value, o), num(rat(1, 100))], o)
            : { k: "fn", name: "percent", a: [canonical(node.value, o)] };
        case "tuple": return { k: "tuple", a: node.elements.map(function (e) { return canonical(e, o); }) };
        case "set": {
            const a = node.elements.map(function (e) { return canonical(e, o); });
            return { k: "set", a: sortByKey(a) };
        }
    }
    /* structures not normalized yet: exact (without ids) */
    return { k: "other", key: JSON.stringify(stripSrc(node)) };
}

function withFunction(node) {
    let found = false;
    walk(node, function (n) { if (n.type === "function" || n.type === "nthRoot") found = true; });
    return found;
}

/*
 * The value of a node without variables as an exact canonical number, when it is one: p/q, (p/q)·√b (b square-free)
 * or (p/q)·π, with q ≤ 12 and b ≤ 30. null otherwise (sin 1 stays sin 1).
 */
function exactValue(node, o) {
    let v;
    try { v = evaluate(node, { vars: {}, s: 1 }); } catch (e) { return null; }
    if (!isFinite(v)) return null;
    const near = function (x, y) { return Math.abs(x - y) <= 1e-11 * Math.max(1, Math.abs(y)); };
    const asRat = function (x) {
        for (let q = 1; q <= 12; q += 1) {
            const p = Math.round(x * q);
            if (Math.abs(p) <= 1e6 && near(x, p / q)) return rat(p, q);
        }
        return null;
    };
    let r = asRat(v);
    if (r) return num(r);
    const SQUARE_FREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15, 17, 19, 21, 22, 23, 26, 29, 30];
    for (let i = 0; i < SQUARE_FREE.length; i += 1) {
        r = asRat(v / Math.sqrt(SQUARE_FREE[i]));
        if (r) return cmul([num(r), cpow(num(rat(SQUARE_FREE[i])), num(rat(1, 2)), o)], o);
    }
    r = asRat(v / Math.PI);
    if (r) return cmul([num(r), { k: "const", name: "pi" }], o);
    return null;
}

function crel(op, l, r, o) {
    /* a > b is b < a (always: ANSWER-CHECKING 4.2) */
    if (op === "greater") { op = "less"; const t = l; l = r; r = t; }
    if (op === "greaterEqual") { op = "lessEqual"; const t = l; l = r; r = t; }
    if (o.equationTransforms) return relToZero(op, l, r, o);
    if (o.commutative && (op === "equal" || op === "notEqual" || op === "approximate") && ckey(l) > ckey(r)) {
        const t = l; l = r; r = t;
    }
    return { k: "rel", op: op, l: l, r: r };
}

/*
 * The same equation / relation transformed: L − R  op  0, divided by the coefficient of the first term
 * that is not a number (y + 3 = 2x + 5 and 2y = 4x + 4 both become y − 2x − 2 = 0). Only a positive divisor
 * for < and ≤; only the sign when scaling is not accepted (statements.scaleEquation).
 */
function relToZero(op, l, r, o) {
    const terms = function (c) { return c.k === "add" ? c.t : [c]; };
    const diff = cadd(terms(l).concat(terms(r).map(function (t) { return cneg(t, o); })), o);
    const parts = terms(diff);
    /* the leading term: the first by its key without the coefficient (2x and −x/2 lead the same way) */
    let lead = null, leadKey = null;
    parts.forEach(function (t) {
        const sc = splitCoefficient(t);
        if (sc[1] === null) return;
        const key = ckey(sc[1]);
        if (leadKey === null || key < leadKey) { lead = sc; leadKey = key; }
    });
    let c = (lead || splitCoefficient(parts[0]))[0];
    const sign = c.n < 0 ? -1 : 1;
    if (c.n === 0) c = rat(1);
    if (!o.scaleEquation) c = rat(sign);
    if (op === "less" || op === "lessEqual") c = rat(Math.abs(c.n), c.d);
    if (c.n === 1 && c.d === 1) return { k: "rel", op: op, l: diff, r: num(rat(0)) };
    const inv = num(rat(c.d * (c.n < 0 ? -1 : 1), Math.abs(c.n)));
    return { k: "rel", op: op, l: cadd(parts.map(function (t) { return cmul([inv, t], o); }), o), r: num(rat(0)) };
}

function canonicalOperation(node, o) {
    const ops = node.operands.map(function (x) { return canonical(x, o); });
    switch (node.op) {
        case "+": return cadd(ops, o);
        case "*": return cmul(ops, o);
        case "neg": return cneg(ops[0], o);
        case "/": return cdiv(ops[0], ops[1], o);
        case "^": return cpow(ops[0], ops[1], o);
        case "and": case "or": return { k: node.op, a: o.commutative ? sortByKey(ops) : ops };
        case "plusMinus": case "minusPlus": return { k: "pm", op: node.op, a: ops };
    }
    return { k: "fn", name: node.op, a: ops };
}

function cneg(x, o) {
    if (o.signPlacement || o.numericEvaluation) {
        if (isNum(x)) return num(rat(-x.r.n, x.r.d));
    }
    if (o.signPlacement) return cmul([num(rat(-1)), x], o);
    if (x.k === "neg" && o.numericEvaluation) return x.x;
    return { k: "neg", x: x };
}

function cdiv(n, d, o) {
    if (o.numericEvaluation && isNum(n) && isNum(d) && d.r.n !== 0) return num(ratMul(n.r, rat(d.r.d, d.r.n)));
    if (o.fractionForms) return cmul([n, cpow(d, num(rat(-1)), o)], o);
    if (o.numericEvaluation && isOne(d)) return n;
    return { k: "div", n: n, d: d };
}

function cpow(b, e, o) {
    if (o.numericEvaluation) {
        if (isNum(e) && e.r.n === 0) return num(rat(1));
        if (isOne(e)) return b;
        if (isNum(b) && isNum(e) && ratIsInt(e.r) && Math.abs(e.r.n) <= 12 && !(b.r.n === 0 && e.r.n < 0)) {
            return num(ratPowInt(b.r, e.r.n));
        }
    }
    /* (x^a)^b = x^(ab) for numeric exponents */
    if (o.powerForms && b.k === "pow" && isNum(b.e) && isNum(e)) return cpow(b.b, num(ratMul(b.e.r, e.r)), o);
    /* (ab)^n = a^n b^n for an integer n - also (−b)⁻¹ = −b⁻¹ */
    if (o.powerForms && b.k === "mul" && isNum(e) && ratIsInt(e.r)) {
        return cmul(b.f.map(function (f) { return cpow(f, e, o); }), o);
    }
    /* (a+b)^n expanded when the distributive law is accepted */
    if (o.distributive && b.k === "add" && isNum(e) && ratIsInt(e.r) && e.r.n >= 2 && e.r.n <= 6) {
        const f = [];
        for (let i = 0; i < e.r.n; i += 1) f.push(b);
        return cmul(f, o);
    }
    /* (ab)^n = a^n b^n with like terms (x²·x = x³ needs the factors apart) */
    if (o.likeTerms && b.k === "mul" && isNum(e)) {
        return cmul(b.f.map(function (f) { return cpow(f, e, o); }), o);
    }
    return { k: "pow", b: b, e: e };
}

/* coefficient and rest of a term: 3x -> [3, x], -x -> [-1, x], 5 -> [5, null] */
function splitCoefficient(t) {
    if (isNum(t)) return [t.r, null];
    if (t.k === "neg") {
        const s = splitCoefficient(t.x);
        return [rat(-s[0].n, s[0].d), s[1]];
    }
    if (t.k === "mul" && t.f.length > 0 && isNum(t.f[0])) {
        const rest = t.f.slice(1);
        return [t.f[0].r, rest.length === 1 ? rest[0] : { k: "mul", f: rest }];
    }
    return [rat(1), t];
}

function cadd(terms, o) {
    let flat = [];
    terms.forEach(function (t) { if (t.k === "add") flat = flat.concat(t.t); else flat.push(t); });

    if (o.numericEvaluation) {
        let sum = rat(0), any = false;
        const rest = [];
        flat.forEach(function (t) { if (isNum(t)) { sum = ratAdd(sum, t.r); any = true; } else rest.push(t); });
        flat = rest;
        if (any && (sum.n !== 0 || flat.length === 0)) flat.push(num(sum));
    }

    if (o.likeTerms) {
        const groups = [], index = {};
        flat.forEach(function (t) {
            const s = splitCoefficient(t);
            if (s[1] === null) { groups.push({ c: s[0], rest: null }); return; }
            const k = ckey(s[1]);
            if (index[k] === undefined) { index[k] = groups.length; groups.push({ c: s[0], rest: s[1] }); }
            else groups[index[k]].c = ratAdd(groups[index[k]].c, s[0]);
        });
        flat = [];
        groups.forEach(function (g) {
            if (g.rest === null) { flat.push(num(g.c)); return; }
            if (g.c.n === 0) return;
            if (g.c.n === 1 && g.c.d === 1) flat.push(g.rest);
            else flat.push(cmul([num(g.c), g.rest], o));
        });
    }

    if (o.commutative) flat = sortByKey(flat);
    if (flat.length === 0) return num(rat(0));
    if (flat.length === 1) return flat[0];
    return { k: "add", t: flat };
}

function cmul(factors, o) {
    let flat = [];
    factors.forEach(function (f) { if (f.k === "mul") flat = flat.concat(f.f); else flat.push(f); });

    if (o.numericEvaluation) {
        let prod = rat(1), any = false;
        const rest = [];
        flat.forEach(function (f) { if (isNum(f)) { prod = ratMul(prod, f.r); any = true; } else rest.push(f); });
        if (any && prod.n === 0) return num(rat(0));
        flat = rest;
        if (any && !(prod.n === 1 && prod.d === 1)) flat.unshift(num(prod));
    }

    /* the distributive law: a product of sums is expanded */
    if (o.distributive && flat.some(function (f) { return f.k === "add"; })) {
        let terms = [[]];
        flat.forEach(function (f) {
            const parts = f.k === "add" ? f.t : [f];
            const next = [];
            terms.forEach(function (t) { parts.forEach(function (p) { next.push(t.concat([p])); }); });
            terms = next;
        });
        if (terms.length <= 400) return cadd(terms.map(function (t) { return cmul(t, o); }), o);
    }

    /* like factors: x·x = x², x²·x⁻¹ = x */
    if (o.likeTerms) {
        const groups = [], index = {};
        flat.forEach(function (f) {
            const base = f.k === "pow" && isNum(f.e) ? f.b : f;
            const exp = f.k === "pow" && isNum(f.e) ? f.e.r : rat(1);
            if (isNum(base)) { groups.push({ base: base, exp: exp, numeric: true }); return; }
            const k = ckey(base);
            if (index[k] === undefined) { index[k] = groups.length; groups.push({ base: base, exp: exp }); }
            else groups[index[k]].exp = ratAdd(groups[index[k]].exp, exp);
        });
        flat = [];
        groups.forEach(function (g) {
            if (g.numeric) { flat.push(g.exp.n === 1 && g.exp.d === 1 ? g.base : cpow(g.base, num(g.exp), o)); return; }
            if (g.exp.n === 0) return;
            flat.push(g.exp.n === 1 && g.exp.d === 1 ? g.base : { k: "pow", b: g.base, e: num(g.exp) });
        });
        if (o.numericEvaluation) {
            let prod = rat(1);
            const rest = [];
            flat.forEach(function (f) { if (isNum(f)) prod = ratMul(prod, f.r); else rest.push(f); });
            flat = rest;
            if (!(prod.n === 1 && prod.d === 1)) flat.unshift(num(prod));
        }
    }

    if (o.commutative) flat = sortByKey(flat);
    if (flat.length === 0) return num(rat(1));
    if (flat.length === 1) return flat[0];
    return { k: "mul", f: flat };
}

/* the laws a ladder step uses - only the laws the rules accept */
function lawsUpTo(step, rules) {
    const o = {};
    for (let i = 0; i <= step; i += 1) {
        LADDER[i].laws.forEach(function (law) { if (rules.equivalence[law] !== false) o[law] = true; });
    }
    if (o.equationTransforms) o.scaleEquation = rules.statements.scaleEquation !== false;
    return o;
}

/* the first ladder step at which the two are the same, or -1 */
function equivalenceStep(a, b, rules) {
    for (let i = 0; i < LADDER.length; i += 1) {
        const o = lawsUpTo(i, rules);
        if (ckey(canonical(a, o)) === ckey(canonical(b, o))) return i;
    }
    return -1;
}

/* the laws that made the step: for the note ("the same answer written with like terms combined") */
function lawNoteFor(step, rules) {
    if (step <= 0) return null;
    const used = LADDER[step].laws.filter(function (law) { return rules.equivalence[law] !== false; });
    const noted = used.filter(function (law) { return rules.equivalence[law] === "note"; });
    return noted.length ? noted[0] : null;
}

/* ============================================================
   PRINTING (LaTeX, for the feedback)
   ============================================================ */
const REL_LATEX = { less: "<", greater: ">", lessEqual: "\\le", greaterEqual: "\\ge", notEqual: "\\ne", approximate: "\\approx", equal: "=" };

function latex(node, parentPrec) {
    if (!node) return "?";
    const p = parentPrec || 0;
    const wrap = function (s, prec) { return prec < p ? "\\left(" + s + "\\right)" : s; };
    switch (node.type) {
        case "number": return String(node.value);
        case "variable": return node.name;
        case "indexedVariable": return latex(node.variable) + "_{" + latex(node.subscript) + "}";
        case "constant": return node.name === "pi" ? "\\pi" : node.name;
        case "vector": {
            const nm = node.name || {};
            const text = nm.points ? nm.points.map(function (p) { return p.name; }).join("") : (nm.name || "");
            return nm.points && nm.points.length > 1 ? "\\overrightarrow{" + text + "}" : "\\vec{" + text + "}";
        }
        case "missing": case "placeholder": return "\\square";
        case "chain": return node.elements.map(function (e) { return latex(e); }).join("=");
        case "relation": return latex(node.left) + REL_LATEX[node.op] + latex(node.right);
        case "tuple": return "\\left(" + node.elements.map(function (e) { return latex(e); }).join(",") + "\\right)";
        case "set": return "\\left\\{" + node.elements.map(function (e) { return latex(e); }).join(",") + "\\right\\}";
        case "list": return node.items.map(function (e) { return latex(e); }).join(",");
        case "function":
            if (node.name === "sqrt") return "\\sqrt{" + latex(node.argument) + "}";
            if (node.name === "abs") return "\\left|" + latex(node.argument) + "\\right|";
            if (node.name === "log") return "\\log_{" + latex(node.base) + "}\\left(" + latex(node.argument) + "\\right)";
            /* asin, acosh ...: written sin⁻¹, cosh⁻¹ as on the keyboard */
            if (/^a(sin|cos|tan)h?$/.test(node.name)) return "\\" + node.name.slice(1) + "^{-1}\\left(" + latex(node.argument) + "\\right)";
            return "\\" + (node.name === "log10" ? "log" : node.name) + "\\left(" + latex(node.argument) + "\\right)";
        case "nthRoot": return "\\sqrt[" + latex(node.index) + "]{" + latex(node.content) + "}";
        case "simpleFraction": return "\\frac{" + latex(node.numerator) + "}{" + latex(node.denominator) + "}";
        case "mixedFraction": return latex(node.whole) + "\\frac{" + latex(node.numerator) + "}{" + latex(node.denominator) + "}";
        case "factorial": return latex(node.value, 9) + "!";
        case "percent": return latex(node.value, 9) + "\\%";
        case "degree": return latex(node.value, 9) + "^{\\circ}";
        case "operation": {
            const o = node.operands;
            switch (node.op) {
                case "+": return wrap(o.map(function (t, i) {
                    if (i > 0 && t.type === "operation" && t.op === "neg") return "-" + latex(t.operands[0], 3);
                    return (i > 0 ? "+" : "") + latex(t, 2);
                }).join(""), 2);
                case "neg": return wrap("-" + latex(o[0], 3), 3);
                case "*": return wrap(o.map(function (f) { return latex(f, 4); }).join("\\cdot "), 4);
                case "/": return "\\frac{" + latex(o[0]) + "}{" + latex(o[1]) + "}";
                case "^": return "{" + latex(o[0], 9) + "}^{" + latex(o[1]) + "}";
                case "plusMinus": return wrap(o.length === 2 ? latex(o[0], 2) + "\\pm " + latex(o[1], 3) : "\\pm " + latex(o[0], 3), 2);
                case "minusPlus": return wrap(o.length === 2 ? latex(o[0], 2) + "\\mp " + latex(o[1], 3) : "\\mp " + latex(o[0], 3), 2);
                case "and": return o.map(function (x) { return latex(x); }).join("\\land ");
                case "or": return o.map(function (x) { return latex(x); }).join("\\lor ");
            }
        }
    }
    return node.type;
}

function latexNumber(x) {
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    for (let d = 2; d <= 12; d += 1) {
        const n = x * d;
        if (Math.abs(n - Math.round(n)) < 1e-9) return (x < 0 ? "-" : "") + "\\frac{" + Math.abs(Math.round(n)) + "}{" + d + "}";
    }
    return String(Math.round(x * 1e6) / 1e6);
}

/* ============================================================
   FEEDBACK TEXTS (he / en / ar). {x}: a parameter; math as \( ... \)
   ============================================================ */
const TEXT = {
    en: {
        "incomplete": "The answer is not complete: fill in every empty place.",
        "answer-type": "The answer should be {expected}, but it is {actual}.",
        "wrong-value": "The value of the answer is not correct.",
        "not-evaluated": "Work out {what} in the answer and write the result.",
        "domain-only": "The equation is equivalent to the expected one only when \\({condition}\\).",
        "op-derivative": "the derivative", "op-integral": "the integral", "op-evaluation": "the evaluation between the bounds",
        "op-limit": "the limit", "op-sum": "the sum", "op-product": "the product",
        "sign-error": "The sign is wrong: the answer is the negative of the correct one.",
        "missing-factor": "The answer is off by a factor of \\({factor}\\).",
        "scale-error": "The answer is off by a factor of \\({factor}\\) (check the units or the decimal point).",
        "missing-term": "A term is missing from the answer.",
        "extra-term": "The term \\({term}\\) should not be in the answer.",
        "fraction-not-reduced": "The fraction \\({fraction}\\) can be reduced.",
        "not-simplified": "The answer can be simplified further: {detail}.",
        "not-expanded": "The answer should be expanded (no parentheses left to multiply out).",
        "not-factored": "The answer should be written as a product of factors.",
        "not-fully-factored": "The factor \\({factor}\\) can be factored further.",
        "negative-exponent": "Write the answer without negative exponents.",
        "irrational-denominator": "Rationalize the denominator of \\({fraction}\\).",
        "not-exact": "Give the exact value, not a decimal approximation.",
        "not-isolated": "Write the answer with \\({variable}\\) alone on one side.",
        "not-equivalent-form": "The value is right, but this form of the answer is not accepted here.",
        "wrong-relation": "The relation \\({actual}\\) is not the right one.",
        "wrong-direction": "The inequality points the wrong way.",
        "missing-element": "An element is missing.",
        "extra-element": "The element \\({element}\\) should not be there.",
        "duplicate-element": "The element \\({element}\\) appears more than once.",
        "missing-statement": "A part of the answer (a condition or an equation) is missing.",
        "extra-statement": "The part \\({statement}\\) should not be in the answer.",
        "wrong-order": "The order of the elements is not correct.",
        "wrong-decimals": "The answer should have {decimals} digits after the decimal point.",
        "rounding": "The answer is close, but not accurate enough - check the rounding.",
        "wrong-step": "Step {step} of the derivation is not correct.",
        "unsupported": "This kind of answer cannot be checked automatically yet.",
        "note-identical": "",
        "note-commutative": "Accepted: the same answer in a different order.",
        "note-numericEvaluation": "Accepted: the numbers can still be calculated.",
        "note-decimalFraction": "Accepted: a decimal written for a fraction (or the reverse).",
        "note-signPlacement": "Accepted: the minus sign is in another place.",
        "note-fractionForms": "Accepted: the fraction is written in another form.",
        "note-powerForms": "Accepted: a root or power is written in another form.",
        "note-likeTerms": "Accepted: like terms are not combined.",
        "note-distributive": "Accepted: the same answer, expanded or factored differently.",
        "note-equationTransforms": "Accepted: an equivalent equation (terms moved between the sides).",
        "note-vectorReversal": "Accepted: a vector written in the opposite direction with a minus sign (\\(\\overrightarrow{BA}=-\\overrightarrow{AB}\\)).",
        "note-same-solutions": "Accepted: an equivalent equation (the same solutions).",
        "note-last-step": "Only the last expression is graded.",
        "note-scaled-equation": "Accepted: an equivalent equation (multiplied by a number).",
        "duplicate-note": "The element \\({element}\\) is written more than once.",
        "score": "Score: {score}%",
        "notes": "Notes",
        "not-counted": "Not counted",
        "reference": "A correct answer: \\({reference}\\)",
        "kind-expression": "an expression", "kind-equation": "an equation", "kind-inequality": "an inequality",
        "kind-statement": "a statement", "kind-set": "a set", "kind-tuple": "a tuple (an ordered list)",
        "kind-list": "a list", "kind-derivation": "a chain of steps", "kind-empty": "empty",
        "cat-value": "Value", "cat-sign": "Sign", "cat-factor": "Factor", "cat-scale": "Scale", "cat-term": "Terms",
        "cat-form": "Form", "cat-relation": "Relation", "cat-elements": "Elements", "cat-order": "Order",
        "cat-precision": "Precision", "cat-derivation": "Derivation", "cat-mistake": "Common mistake", "cat-domain": "Domain",
        "cat-incomplete": "Incomplete", "cat-answerType": "Type of answer",
        "detail-like-terms": "combine the like terms", "detail-numbers": "calculate the numbers",
        "detail-double-negation": "remove the double minus"
    },
    he: {
        "incomplete": "התשובה אינה שלמה: יש למלא את כל המקומות הריקים.",
        "answer-type": "התשובה צריכה להיות {expected}, אך היא {actual}.",
        "wrong-value": "ערך התשובה אינו נכון.",
        "not-evaluated": "יש לחשב את {what} שבתשובה ולכתוב את התוצאה.",
        "domain-only": "המשוואה שקולה למשוואה הנדרשת רק כאשר \\({condition}\\).",
        "op-derivative": "הנגזרת", "op-integral": "האינטגרל", "op-evaluation": "ההצבה בגבולות",
        "op-limit": "הגבול", "op-sum": "הסכום", "op-product": "המכפלה",
        "sign-error": "הסימן שגוי: התשובה היא הנגדית של התשובה הנכונה.",
        "missing-factor": "התשובה שונה מהתשובה הנכונה פי \\({factor}\\).",
        "scale-error": "התשובה שונה מהתשובה הנכונה פי \\({factor}\\) (יש לבדוק את היחידות או את הנקודה העשרונית).",
        "missing-term": "חסר איבר בתשובה.",
        "extra-term": "האיבר \\({term}\\) לא צריך להופיע בתשובה.",
        "fraction-not-reduced": "אפשר לצמצם את השבר \\({fraction}\\).",
        "not-simplified": "אפשר לפשט את התשובה עוד: {detail}.",
        "not-expanded": "יש לפתוח סוגריים בתשובה.",
        "not-factored": "יש לכתוב את התשובה כמכפלת גורמים.",
        "not-fully-factored": "אפשר לפרק את הגורם \\({factor}\\) עוד.",
        "negative-exponent": "יש לכתוב את התשובה בלי חזקות שליליות.",
        "irrational-denominator": "יש לגרום למכנה של \\({fraction}\\) להיות רציונלי.",
        "not-exact": "יש לתת ערך מדויק, לא קירוב עשרוני.",
        "not-isolated": "יש לכתוב את התשובה כך ש־\\({variable}\\) לבד באגף אחד.",
        "not-equivalent-form": "הערך נכון, אך הצורה הזו של התשובה אינה מתקבלת כאן.",
        "wrong-relation": "היחס \\({actual}\\) אינו היחס הנכון.",
        "wrong-direction": "כיוון אי־השוויון הפוך.",
        "missing-element": "חסר איבר.",
        "extra-element": "האיבר \\({element}\\) לא צריך להופיע.",
        "duplicate-element": "האיבר \\({element}\\) מופיע יותר מפעם אחת.",
        "missing-statement": "חסר חלק בתשובה (תנאי או משוואה).",
        "extra-statement": "החלק \\({statement}\\) לא צריך להופיע בתשובה.",
        "wrong-order": "סדר האיברים אינו נכון.",
        "wrong-decimals": "בתשובה צריכות להיות {decimals} ספרות אחרי הנקודה העשרונית.",
        "rounding": "התשובה קרובה, אך אינה מדויקת מספיק - יש לבדוק את העיגול.",
        "wrong-step": "שלב {step} בפיתוח אינו נכון.",
        "unsupported": "עדיין לא ניתן לבדוק תשובה מסוג זה אוטומטית.",
        "note-identical": "",
        "note-commutative": "התקבל: אותה תשובה בסדר אחר.",
        "note-numericEvaluation": "התקבל: עדיין אפשר לחשב את המספרים.",
        "note-decimalFraction": "התקבל: מספר עשרוני במקום שבר (או להפך).",
        "note-signPlacement": "התקבל: סימן המינוס במקום אחר.",
        "note-fractionForms": "התקבל: השבר כתוב בצורה אחרת.",
        "note-powerForms": "התקבל: שורש או חזקה כתובים בצורה אחרת.",
        "note-likeTerms": "התקבל: איברים דומים לא כונסו.",
        "note-distributive": "התקבל: אותה תשובה, בפתיחת סוגריים או בפירוק אחר.",
        "note-equationTransforms": "התקבל: משוואה שקולה (איברים הועברו מאגף לאגף).",
        "note-vectorReversal": "התקבל: וקטור בכיוון ההפוך עם סימן מינוס (\\(\\overrightarrow{BA}=-\\overrightarrow{AB}\\)).",
        "note-same-solutions": "התקבל: משוואה שקולה (אותם פתרונות).",
        "note-last-step": "רק הביטוי האחרון נבדק.",
        "note-scaled-equation": "התקבל: משוואה שקולה (כפולה במספר).",
        "duplicate-note": "האיבר \\({element}\\) כתוב יותר מפעם אחת.",
        "score": "ציון: {score}%",
        "notes": "הערות",
        "not-counted": "לא נספר",
        "reference": "תשובה נכונה: \\({reference}\\)",
        "kind-expression": "ביטוי", "kind-equation": "משוואה", "kind-inequality": "אי־שוויון",
        "kind-statement": "טענה", "kind-set": "קבוצה", "kind-tuple": "סדרה סדורה",
        "kind-list": "רשימה", "kind-derivation": "שרשרת שלבים", "kind-empty": "ריקה",
        "cat-value": "ערך", "cat-sign": "סימן", "cat-factor": "גורם", "cat-scale": "קנה מידה", "cat-term": "איברים",
        "cat-form": "צורה", "cat-relation": "יחס", "cat-elements": "איברים", "cat-order": "סדר",
        "cat-precision": "דיוק", "cat-derivation": "פיתוח", "cat-mistake": "טעות נפוצה", "cat-domain": "תחום",
        "cat-incomplete": "תשובה חלקית", "cat-answerType": "סוג התשובה",
        "detail-like-terms": "יש לכנס איברים דומים", "detail-numbers": "יש לחשב את המספרים",
        "detail-double-negation": "יש להסיר מינוס כפול"
    },
    ar: {
        "incomplete": "الإجابة غير كاملة: املأ كل الأماكن الفارغة.",
        "answer-type": "يجب أن تكون الإجابة {expected}، لكنها {actual}.",
        "wrong-value": "قيمة الإجابة غير صحيحة.",
        "not-evaluated": "احسب {what} في الإجابة واكتب النتيجة.",
        "domain-only": "المعادلة مكافئة للمعادلة المطلوبة فقط عندما \\({condition}\\).",
        "op-derivative": "المشتقة", "op-integral": "التكامل", "op-evaluation": "التعويض بين الحدين",
        "op-limit": "النهاية", "op-sum": "المجموع", "op-product": "الجداء",
        "sign-error": "الإشارة خاطئة: الإجابة هي سالب الإجابة الصحيحة.",
        "missing-factor": "تختلف الإجابة عن الصحيحة بعامل \\({factor}\\).",
        "scale-error": "تختلف الإجابة عن الصحيحة بعامل \\({factor}\\) (تحقق من الوحدات أو من الفاصلة العشرية).",
        "missing-term": "ينقص حدّ في الإجابة.",
        "extra-term": "يجب ألا يظهر الحد \\({term}\\) في الإجابة.",
        "fraction-not-reduced": "يمكن اختصار الكسر \\({fraction}\\).",
        "not-simplified": "يمكن تبسيط الإجابة أكثر: {detail}.",
        "not-expanded": "يجب فك الأقواس في الإجابة.",
        "not-factored": "يجب كتابة الإجابة كحاصل ضرب عوامل.",
        "not-fully-factored": "يمكن تحليل العامل \\({factor}\\) أكثر.",
        "negative-exponent": "اكتب الإجابة دون أسس سالبة.",
        "irrational-denominator": "اجعل مقام \\({fraction}\\) عددًا نسبيًا.",
        "not-exact": "أعطِ القيمة الدقيقة، لا تقريبًا عشريًا.",
        "not-isolated": "اكتب الإجابة بحيث يكون \\({variable}\\) وحده في طرف.",
        "not-equivalent-form": "القيمة صحيحة، لكن هذا الشكل من الإجابة غير مقبول هنا.",
        "wrong-relation": "العلاقة \\({actual}\\) ليست العلاقة الصحيحة.",
        "wrong-direction": "اتجاه المتباينة معكوس.",
        "missing-element": "ينقص عنصر.",
        "extra-element": "يجب ألا يظهر العنصر \\({element}\\).",
        "duplicate-element": "يظهر العنصر \\({element}\\) أكثر من مرة.",
        "missing-statement": "ينقص جزء من الإجابة (شرط أو معادلة).",
        "extra-statement": "يجب ألا يظهر الجزء \\({statement}\\) في الإجابة.",
        "wrong-order": "ترتيب العناصر غير صحيح.",
        "wrong-decimals": "يجب أن يكون في الإجابة {decimals} أرقام بعد الفاصلة العشرية.",
        "rounding": "الإجابة قريبة لكنها ليست دقيقة بما يكفي - تحقق من التقريب.",
        "wrong-step": "الخطوة {step} في الاشتقاق غير صحيحة.",
        "unsupported": "لا يمكن بعد فحص هذا النوع من الإجابات تلقائيًا.",
        "note-identical": "",
        "note-commutative": "مقبول: الإجابة نفسها بترتيب آخر.",
        "note-numericEvaluation": "مقبول: لا يزال من الممكن حساب الأعداد.",
        "note-decimalFraction": "مقبول: عدد عشري بدل كسر (أو العكس).",
        "note-signPlacement": "مقبول: إشارة السالب في مكان آخر.",
        "note-fractionForms": "مقبول: الكسر مكتوب بشكل آخر.",
        "note-powerForms": "مقبول: جذر أو قوة مكتوبة بشكل آخر.",
        "note-likeTerms": "مقبول: لم تُجمع الحدود المتشابهة.",
        "note-distributive": "مقبول: الإجابة نفسها بعد فك الأقواس أو بتحليل آخر.",
        "note-equationTransforms": "مقبول: معادلة مكافئة (نُقلت حدود من طرف إلى آخر).",
        "note-vectorReversal": "مقبول: متجه في الاتجاه المعاكس مع إشارة سالب (\\(\\overrightarrow{BA}=-\\overrightarrow{AB}\\)).",
        "note-same-solutions": "مقبول: معادلة مكافئة (الحلول نفسها).",
        "note-last-step": "يتم تقييم التعبير الأخير فقط.",
        "note-scaled-equation": "مقبول: معادلة مكافئة (مضروبة في عدد).",
        "duplicate-note": "العنصر \\({element}\\) مكتوب أكثر من مرة.",
        "score": "الدرجة: {score}%",
        "notes": "ملاحظات",
        "not-counted": "لا يُحتسب",
        "reference": "إجابة صحيحة: \\({reference}\\)",
        "kind-expression": "تعبيرًا", "kind-equation": "معادلة", "kind-inequality": "متباينة",
        "kind-statement": "عبارة", "kind-set": "مجموعة", "kind-tuple": "زوجًا مرتبًا (قائمة مرتبة)",
        "kind-list": "قائمة", "kind-derivation": "سلسلة خطوات", "kind-empty": "فارغة",
        "cat-value": "القيمة", "cat-sign": "الإشارة", "cat-factor": "العامل", "cat-scale": "المقياس", "cat-term": "الحدود",
        "cat-form": "الشكل", "cat-relation": "العلاقة", "cat-elements": "العناصر", "cat-order": "الترتيب",
        "cat-precision": "الدقة", "cat-derivation": "الاشتقاق", "cat-mistake": "خطأ شائع", "cat-domain": "المجال",
        "cat-incomplete": "إجابة ناقصة", "cat-answerType": "نوع الإجابة",
        "detail-like-terms": "اجمع الحدود المتشابهة", "detail-numbers": "احسب الأعداد",
        "detail-double-negation": "احذف إشارة السالب المزدوجة"
    }
};

const LRI = "⁦", PDI = "⁩";

function feedbackText(code, language, params, custom) {
    const lang = TEXT[language] ? language : "en";
    let text = (custom && custom[code] && (custom[code][lang] || custom[code].en)) || TEXT[lang][code] || TEXT.en[code] || code;
    const rtl = lang !== "en";
    Object.keys(params || {}).forEach(function (k) {
        let v = params[k];
        if (k === "expected" || k === "actual") {
            if (typeof v === "string" && TEXT[lang]["kind-" + v]) v = TEXT[lang]["kind-" + v];
        }
        if (k === "what" && typeof v === "string" && TEXT[lang]["op-" + v]) v = TEXT[lang]["op-" + v];
        text = text.split("{" + k + "}").join(String(v));
    });
    /* math and numbers left to right inside a right-to-left line (the chemistry keyboard's lesson) */
    if (rtl) text = text.replace(/\\\(([\s\S]*?)\\\)/g, function (m) { return LRI + m + PDI; });
    return text;
}

/* ============================================================
   FORM CHECKS (CHECKING-API-DESIGN 3.4) - on the student's answer, only when its value is right
   ============================================================ */
function isIntegerNumber(n) { return n && n.type === "number" && /^\d+$/.test(String(n.value)); }
function intValue(n) {
    if (isIntegerNumber(n)) return Number(n.value);
    if (n && n.type === "operation" && n.op === "neg" && isIntegerNumber(n.operands[0])) return -Number(n.operands[0].value);
    return null;
}

/* the integer coefficients of a sum's terms (null when a term has no integer coefficient) */
function integerCoefficients(sum) {
    return sum.operands.map(function (t) {
        let neg = false;
        if (t.type === "operation" && t.op === "neg") { neg = true; t = t.operands[0]; }
        let c = intValue(t);
        if (c === null && t.type === "operation" && t.op === "*") c = intValue(t.operands[0]);
        if (c === null && (t.type === "variable" || t.type === "operation")) c = 1;
        return c === null ? null : (neg ? -c : c);
    });
}

function hasVariable(node) { return collectVariables(node, []).length > 0; }

function containsRoot(node) {
    let found = false;
    walk(node, function (n) {
        if (n.type === "function" && n.name === "sqrt") found = true;
        if (n.type === "nthRoot") found = true;
        if (n.type === "operation" && n.op === "^") {
            const e = n.operands[1];
            if (e && (e.type === "operation" && e.op === "/" || e.type === "simpleFraction")) found = true;
            if (e && e.type === "number" && String(e.value).indexOf(".") >= 0) found = true;
        }
    });
    return found;
}

function runFormChecks(student, reference, rules, add) {
    const form = rules.form || {};
    const level = function (name) { const v = form[name]; return v === "error" || v === "note" ? v : (v && v.level) || null; };
    const expr = student && student.type === "chain" ? student.elements[student.elements.length - 1] : student;

    if (level("reducedFractions")) {
        walk(student, function (n) {
            let a = null, b = null;
            if (n.type === "operation" && n.op === "/") { a = n.operands[0]; b = n.operands[1]; }
            if (n.type === "simpleFraction") { a = n.numerator; b = n.denominator; }
            if (!a || !b) return;
            const x = intValue(a), y = intValue(b);
            let g = 1;
            if (x !== null && y !== null) g = gcd(x, y);
            else if (a.type === "operation" && a.op === "+" && y !== null) {
                const cs = integerCoefficients(a);
                if (cs.every(function (c) { return c !== null; })) g = cs.reduce(gcd, Math.abs(y));
            }
            if (g > 1 || (y !== null && Math.abs(y) === 1 && x !== null)) {
                add(level("reducedFractions"), "fraction-not-reduced", { fraction: latex(n) }, [n]);
            }
        });
    }

    if (level("simplified")) {
        let detail = null, at = null;
        walk(student, function (n) {
            if (detail || n.type !== "operation") return;
            if (n.op === "+") {
                const numbers = n.operands.filter(function (t) { return intValue(t) !== null || t.type === "number"; });
                if (numbers.length >= 2) { detail = "detail-numbers"; at = n; return; }
                /* like terms: the same canonical rest */
                const o = { commutative: true };
                const seen = {};
                n.operands.forEach(function (t) {
                    const rest = splitCoefficient(canonical(t, o))[1];
                    if (!rest) return;
                    const k = ckey(rest);
                    if (seen[k]) { detail = "detail-like-terms"; at = n; }
                    seen[k] = true;
                });
            }
            if (n.op === "*") {
                const numbers = n.operands.filter(function (t) { return t.type === "number"; });
                if (numbers.length >= 2) { detail = "detail-numbers"; at = n; }
            }
            if (n.op === "neg" && n.operands[0].type === "operation" && n.operands[0].op === "neg") {
                detail = "detail-double-negation"; at = n;
            }
        });
        if (detail) add(level("simplified"), "not-simplified", { detailKey: detail }, [at]);
    }

    if (level("expanded")) {
        let found = null;
        walk(student, function (n) {
            if (found || n.type !== "operation") return;
            if (n.op === "*" && n.operands.some(function (f) { return f.type === "operation" && f.op === "+" && hasVariable(f); })) found = n;
            if (n.op === "^" && n.operands[0].type === "operation" && n.operands[0].op === "+" && intValue(n.operands[1]) > 1) found = n;
        });
        if (found) add(level("expanded"), "not-expanded", {}, [found]);
    }

    if (level("factored")) {
        let top = expr;
        if (top && top.type === "operation" && top.op === "neg") top = top.operands[0];
        if (top && top.type === "operation" && top.op === "+" && hasVariable(top)) {
            add(level("factored"), "not-factored", {}, [top]);
        } else if (form.factored && form.factored.completely !== false) {
            const factors = top && top.type === "operation" && top.op === "*" ? top.operands : [top];
            factors.forEach(function (f) {
                const sum = f && f.type === "operation" && f.op === "^" ? f.operands[0] : f;
                if (!sum || sum.type !== "operation" || sum.op !== "+") return;
                const cs = integerCoefficients(sum);
                if (cs.every(function (c) { return c !== null; }) && cs.reduce(gcd, 0) > 1) {
                    add(level("factored"), "not-fully-factored", { factor: latex(sum) }, [sum]);
                }
            });
        }
    }

    if (level("noNegativeExponents")) {
        let found = null;
        walk(student, function (n) {
            if (found || n.type !== "operation" || n.op !== "^") return;
            const e = n.operands[1];
            if (e && (e.type === "number" && Number(e.value) < 0 || e.type === "operation" && e.op === "neg")) found = n;
        });
        if (found) add(level("noNegativeExponents"), "negative-exponent", {}, [found]);
    }

    if (level("rationalDenominator")) {
        walk(student, function (n) {
            if (n.type === "operation" && n.op === "/" && containsRoot(n.operands[1])) {
                add(level("rationalDenominator"), "irrational-denominator", { fraction: latex(n) }, [n]);
            }
        });
    }

    if (level("exactValue")) {
        const decimals = function (t) { let d = false; walk(t, function (n) { if (n.type === "number" && String(n.value).indexOf(".") >= 0) d = true; }); return d; };
        if (decimals(student) && !decimals(reference)) add(level("exactValue"), "not-exact", {}, []);
    }

    if (form.isolatedVariable) {
        const name = typeof form.isolatedVariable === "string" ? form.isolatedVariable : form.isolatedVariable.variable;
        const lvl = typeof form.isolatedVariable === "string" ? "error" : (form.isolatedVariable.level || "error");
        let ok = false;
        if (student && student.type === "chain" && student.elements.length === 2) {
            const l = student.elements[0], r = student.elements[1];
            const alone = function (side, other) {
                return side.type === "variable" && side.name === name && collectVariables(other, []).indexOf(name) < 0;
            };
            ok = alone(l, r) || alone(r, l);
        }
        if (!ok) add(lvl, "not-isolated", { variable: name }, [student]);
    }
}

/* number of decimal places of a plain number answer */
function decimalPlaces(node) {
    if (!node || node.type !== "number") {
        if (node && node.type === "operation" && node.op === "neg") return decimalPlaces(node.operands[0]);
        return null;
    }
    const s = String(node.value), i = s.indexOf(".");
    return i < 0 ? 0 : s.length - i - 1;
}

/* ============================================================
   COMPARISON OF ONE ANSWER WITH ONE REFERENCE
   ============================================================ */
function makeContext(rules, seed) {
    return { rules: rules, sample: makeSampler(rules, seed) };
}

/* are two expressions equal (value, by the rules' mode)? Returns { equal, step, rows, unsupported } */
function expressionsEqual(s, r, ctx) {
    const rules = ctx.rules;
    const step = equivalenceStep(s, r, rules);
    if (rules.value.mode === "exact") return { equal: step === 0, step: step, structural: true };
    if (rules.value.mode === "structural") {
        const top = lawsUpTo(LADDER.length - 1, rules);
        return { equal: ckey(canonical(s, top)) === ckey(canonical(r, top)), step: step, structural: true };
    }
    const sample = sampleValues([r, s], ctx);
    if (!sample.ok) {
        /* not numeric (a structure, a complex number): the canonical form decides */
        return { equal: step >= 0, step: step, unsupported: sample.unsupported, rows: [] };
    }
    return { equal: rowsEqual(sample.rows, 1, 0, rules.value.tolerance), step: step, rows: sample.rows, vars: sample.vars };
}

/* statements: an equation (chain of 2), a relation, and / or of them */
function statementsEqual(s, r, ctx, out) {
    const rules = ctx.rules;
    if (!s || !r) return false;

    if (r.type === "chain" && r.elements.length === 2) {
        if (!(s.type === "chain" && s.elements.length === 2)) return false;
        return equationsEqual(s, r, ctx, out);
    }

    if (r.type === "relation") {
        if (s.type !== "relation") return false;
        const nr = normalizeRelation(r), ns = normalizeRelation(s);
        const fr = difference(nr.right, nr.left), fs = difference(ns.right, ns.left);
        if (rules.value.mode === "exact") return equivalenceStep(s, r, rules) === 0;
        if (rules.value.mode === "structural") return equivalenceStep(s, r, rules) >= 0;
        const sample = sampleValues([fr, fs], ctx);
        const k = sample.ok ? constantRatio(sample.rows, 1, 0, rules.value.tolerance) : null;
        debugSample(out, sample, k);
        if (!sample.ok) return equivalenceStep(s, r, rules) >= 0;
        if (k === null) return false;
        if (ns.op !== nr.op) {
            /* the same sides with another relation: < for ≤ (one error, the relation) */
            if (out && (k > 0 || nr.op === "notEqual")) out.relation = { actual: ns.op, expected: nr.op };
            return false;
        }
        const symmetric = nr.op === "notEqual" || nr.op === "approximate" || nr.op === "equal";
        if (!symmetric && k < 0) { if (out) out.direction = true; return false; }
        if (!rules.statements.scaleEquation && Math.abs(Math.abs(k) - 1) > 1e-7) return false;
        return true;
    }

    if (r.type === "operation" && (r.op === "and" || r.op === "or")) {
        if (!(s.type === "operation" && s.op === r.op)) return false;
        const m = matchUnordered(s.operands, r.operands, function (a, b) { return statementsEqual(a, b, ctx); });
        if (out) out.match = m;
        return m.missing.length === 0 && m.extra.length === 0;
    }

    return expressionsEqual(s, r, ctx).equal;
}

function normalizeRelation(rel) {
    if (rel.op === "greater") return { op: "less", left: rel.right, right: rel.left };
    if (rel.op === "greaterEqual") return { op: "lessEqual", left: rel.right, right: rel.left };
    return { op: rel.op, left: rel.left, right: rel.right };
}

function difference(a, b) {
    return { type: "operation", op: "+", operands: [a, { type: "operation", op: "neg", operands: [b] }] };
}

/*
 * Points of the solution set of f = 0: all variables but one at random, the one scanned over its range; at a change
 * of sign, bisection. A pole also changes sign (y − 8/x at x = 0) - kept only if f is ~0 there. Returns [vars].
 */
function solutionPoints(f, vars, ctx, want) {
    const rules = ctx.rules, dom = rules.value.domain || { min: -4, max: 4 };
    const envs = ctx.sample(vars, want * 4), points = [], STEPS = 97;
    const at = function (base, v, x) {
        const values = Object.assign({}, base);
        values[v] = x;
        return { x: x, y: evaluate(f, { vars: values, s: 1 }), vars: values };
    };
    for (let i = 0; i < envs.length && points.length < want; i += 1) {
        const v = vars[i % vars.length], spec = rules.value.variables[v] || {};
        if (spec.integer) continue;
        let lo = spec.min !== undefined ? spec.min : dom.min, hi = spec.max !== undefined ? spec.max : dom.max;
        if (spec.positive) lo = Math.max(lo, 0.05);
        let prev = at(envs[i].vars, v, lo), found = 0;
        for (let j = 1; j <= STEPS && found < 2; j += 1) {
            const cur = at(envs[i].vars, v, lo + (hi - lo) * j / STEPS);
            if (isFinite(prev.y) && isFinite(cur.y) && prev.y * cur.y <= 0 && !(prev.y === 0 && j > 1)) {
                let a = prev, b = cur;
                for (let n = 0; n < 60 && a.y !== 0; n += 1) {
                    const m = at(envs[i].vars, v, (a.x + b.x) / 2);
                    if (!isFinite(m.y)) break;
                    if (a.y * m.y <= 0) b = m; else a = m;
                }
                const root = Math.abs(a.y) <= Math.abs(b.y) ? a : b;
                if (Math.abs(root.y) <= 1e-7 * Math.max(1, Math.abs(prev.y), Math.abs(cur.y))) { points.push(root.vars); found += 1; }
            }
            prev = cur;
        }
    }
    return points;
}

/* xy = 8 and y = 8/x: the same solutions though not a constant multiple. null when too few solutions were found to tell */
function sameSolutionSet(fr, fs, ctx, sample) {
    if (sample.pm) return null;
    const vars = sample.vars, want = Math.max(4, ctx.rules.value.samples || 8);
    let pr, ps;
    try { pr = solutionPoints(fr, vars, ctx, want); ps = solutionPoints(fs, vars, ctx, want); }
    catch (e) { if (e instanceof Unsupported) return null; throw e; }
    if (pr.length < 3 || ps.length < 3) return null;
    /* "zero" relative to the size of g at the sample points */
    const scaleOf = function (idx) {
        return sample.rows.reduce(function (m, row) { const y = Math.abs(row.values[idx][0]); return isFinite(y) ? Math.max(m, y) : m; }, 1);
    };
    const holds = function (g, scale) {
        return function (p) { const y = evaluate(g, { vars: p, s: 1 }); return isFinite(y) && Math.abs(y) <= 1e-6 * scale; };
    };
    const okR = pr.map(holds(fs, scaleOf(1))), okS = ps.map(holds(fr, scaleOf(0)));
    return {
        equal: okR.every(Boolean) && okS.every(Boolean),
        reference: pr.map(function (p, i) { return { vars: p, holds: okR[i] }; }),
        student: ps.map(function (p, i) { return { vars: p, holds: okS[i] }; })
    };
}

/* a bound: a number, or a text with π - "-pi/2", "2pi", "pi/4", "3.5" */
function boundValue(b) {
    if (typeof b === "number") return b;
    if (typeof b !== "string") return undefined;
    const m = /^\s*([+-]?)\s*(\d*\.?\d*)\s*\*?\s*(pi|π)?\s*(?:\/\s*(\d+\.?\d*))?\s*$/.exec(b);
    if (!m || (!m[2] && !m[3])) return undefined;
    let v = (m[2] ? parseFloat(m[2]) : 1) * (m[3] ? Math.PI : 1);
    if (m[4]) v /= parseFloat(m[4]);
    return m[1] === "-" ? -v : v;
}
function boundLatex(b) {
    const m = /^\s*([+-]?)\s*(\d*\.?\d*)\s*\*?\s*(pi|π)?\s*(?:\/\s*(\d+\.?\d*))?\s*$/.exec(String(b));
    if (!m) return String(b);
    const top = (m[2] || "") + (m[3] ? "\\pi " : "");
    return (m[1] === "-" ? "-" : "") + (m[4] ? "\\frac{" + top + "}{" + m[4] + "}" : top);
}

/* statements.domain -> { y: { min, max } } as numbers for the sampler; null if none */
function domainRanges(domain) {
    if (!domain || typeof domain !== "object") return null;
    const out = {};
    let any = false;
    Object.keys(domain).forEach(function (v) {
        const d = domain[v] || {}, r = {};
        if (boundValue(d.min) !== undefined) r.min = boundValue(d.min);
        if (boundValue(d.max) !== undefined) r.max = boundValue(d.max);
        if (r.min !== undefined || r.max !== undefined) { out[v] = r; any = true; }
    });
    return any ? out : null;
}
/* −π/2 ≤ y ≤ π/2 */
function domainLatex(domain) {
    return Object.keys(domain).map(function (v) {
        const d = domain[v] || {};
        return (boundValue(d.min) !== undefined ? boundLatex(d.min) + " \\le " : "") + v +
            (boundValue(d.max) !== undefined ? " \\le " + boundLatex(d.max) : "");
    }).join(",\\; ");
}

/* for the playground / builder: the points at which left − right was compared, and the ratio found */
function debugSample(out, sample, k) {
    if (!out || !out.debug) return;
    out.debug.rows = sample.rows || [];
    out.debug.vars = sample.vars || [];
    out.debug.sampled = "left-right";
    out.debug.ratio = k;
    out.debug.unsupported = sample.unsupported;
}

function equationsEqual(s, r, ctx, out) {
    const mode = ctx.rules.value.mode;
    if (mode === "exact") return equivalenceStep(s, r, ctx.rules) === 0;
    if (mode === "structural") return equivalenceStep(s, r, ctx.rules) >= 0;
    const fr = difference(r.elements[0], r.elements[1]);
    const fs = difference(s.elements[0], s.elements[1]);
    const sample = sampleValues([fr, fs], ctx);
    const k = sample.ok ? constantRatio(sample.rows, 1, 0, ctx.rules.value.tolerance) : null;
    debugSample(out, sample, k);
    if (!sample.ok) return equivalenceStep(s, r, ctx.rules) >= 0;
    if (k === null || Math.abs(k) < 1e-12) {
        /* not a constant multiple: the same solutions? (xy = 8 and y = 8/x) */
        if (ctx.rules.statements.sameSolutions !== false) {
            const sol = sameSolutionSet(fr, fs, ctx, sample);
            if (out && out.debug) out.debug.solutions = sol;
            if (sol && sol.equal) {
                if (out) out.solutions = true;
                return true;
            }
        }
        /* the same solutions inside the teacher's domain only (x = sin y and y = sin⁻¹x for −π/2 ≤ y ≤ π/2): partial */
        const domain = domainRanges(ctx.rules.statements.domain);
        if (domain) {
            const dctx = makeContext(merge(ctx.rules, { value: { variables: domain } }), 1);
            const dsol = sameSolutionSet(fr, fs, dctx, sample);
            if (out && out.debug) out.debug.domainSolutions = dsol;
            if (dsol && dsol.equal && out) out.domainOnly = true;
        }
        return false;
    }
    if (Math.abs(Math.abs(k) - 1) > 1e-7) {
        if (!ctx.rules.statements.scaleEquation) return false;
        if (out) out.scaled = true;
    }
    return true;
}

/* unordered matching (sets, and / or): { pairs: [[i, j]], missing: [reference j], extra: [student i] } */
function matchUnordered(studentItems, referenceItems, eq) {
    const usedS = {}, pairs = [], missing = [];
    referenceItems.forEach(function (r, j) {
        for (let i = 0; i < studentItems.length; i += 1) {
            if (!usedS[i] && eq(studentItems[i], r)) { usedS[i] = true; pairs.push([i, j]); return; }
        }
        missing.push(j);
    });
    const extra = [];
    studentItems.forEach(function (s, i) { if (!usedS[i]) extra.push(i); });
    return { pairs: pairs, missing: missing, extra: extra };
}

/* the first derivative / integral / limit / Σ / ∏ in the student's answer of a type the reference does not have */
const OPERATION_TYPES = { derivative: true, integral: true, evaluation: true, limit: true, sum: true, product: true };
function firstOperation(s, r) {
    const inRef = {};
    walk(r, function (n) { if (OPERATION_TYPES[n.type]) inRef[n.type] = true; });
    let found = null;
    walk(s, function (n) { if (!found && OPERATION_TYPES[n.type] && !inRef[n.type]) found = n; });
    return found;
}

/*
 * Compare one student answer with one reference: returns the raw items (before the rubric):
 *   { code, kind: "error" | "note", params, nodes, causedBy }
 */
function compareOne(student, reference, rules, options, debug) {
    const items = [];
    const add = function (kind, code, params, nodes) {
        items.push({ kind: kind, code: code, params: params || {}, nodes: (nodes || []).filter(Boolean) });
    };
    const ctx = makeContext(rules, options.seed !== undefined ? options.seed : hashString(JSON.stringify(stripSrc(reference))));
    const s = answerOf(student), r = answerOf(reference);
    const state = { valueRight: false, matchedMistake: null, equivalence: null };

    if (!s || hasMissing(s)) {
        add("error", "incomplete", {}, s ? [s] : []);
        return { items: items, state: state };
    }

    /* "find the derivative": the question written back (d/dx of the expression) is not an answer */
    const open = firstOperation(s, r);
    if (open) {
        add("error", "not-evaluated", { what: open.type }, [open]);
        return { items: items, state: state };
    }

    let refKind = rules.answerKind && rules.answerKind !== "auto" ? rules.answerKind : kindOf(r);
    let stuKind = kindOf(s);
    let sAns = s;

    /* an expression answered as a chain (2(x+1) = 2x+2, or x = 2): the last element is graded (ANSWER-CHECKING 5.4) */
    if (refKind === "expression" && (stuKind === "derivation" || stuKind === "equation")) {
        sAns = s.elements[s.elements.length - 1];
        add("note", "note-last-step", {}, []);
        stuKind = "expression";
    }
    if (refKind === "derivation" && stuKind === "equation") stuKind = "derivation";
    if (refKind === "solutionSet") refKind = kindOf(r);

    const accepted = (rules.acceptKinds || []).indexOf(stuKind) >= 0;
    if (stuKind !== refKind && !accepted) {
        add("error", "answer-type", { expected: refKind, actual: stuKind }, [s]);
        return { items: items, state: state };
    }

    if (refKind === "expression") {
        const eq = expressionsEqual(sAns, r, ctx);
        state.equivalence = eq.step;
        if (debug) { debug.rows = eq.rows || []; debug.vars = eq.vars || []; debug.step = eq.step; debug.unsupported = eq.unsupported; }
        if (eq.equal) {
            state.valueRight = true;
            if (rules.value.mode !== "numeric" || eq.step > 0) {
                const law = lawNoteFor(eq.step, rules);
                if (law) add("note", "note-" + law, {}, []);
            }
        } else if (eq.structural && expressionsEqual(sAns, r, makeContext(merge(rules, { value: { mode: "numeric" } }), 1)).equal) {
            /* the value is right, the form is not one the rules accept */
            state.valueRight = true;
            add("error", "not-equivalent-form", {}, [sAns]);
        } else {
            diagnoseWrongValue(sAns, r, eq, ctx, add, state);
        }
    } else if (refKind === "equation" || refKind === "inequality" || refKind === "statement") {
        const out = { debug: debug };
        const equal = statementsEqual(s, r, ctx, out);
        state.equivalence = equivalenceStep(s, r, rules);
        if (debug) debug.step = state.equivalence;
        if (equal) {
            state.valueRight = true;
            if (out.scaled) add("note", "note-scaled-equation", {}, []);
            if (out.solutions) {
                state.equivalenceName = "sameSolutions";
                if (rules.statements.sameSolutions === "note") add("note", "note-same-solutions", {}, []);
            }
            const law = lawNoteFor(state.equivalence, rules);
            if (law && !(law === "equationTransforms" && out.scaled)) add("note", "note-" + law, {}, []);
        } else if (out.domainOnly) {
            add("error", "domain-only", { condition: domainLatex(rules.statements.domain) }, [s]);
        } else if (out.relation) {
            add("error", "wrong-relation", { actual: REL_LATEX[out.relation.actual], expected: REL_LATEX[out.relation.expected] }, [s]);
        } else if (out.direction) {
            add("error", "wrong-direction", {}, [s]);
        } else if (out.match) {
            out.match.missing.forEach(function () { add("error", "missing-statement", {}, []); });
            out.match.extra.forEach(function (i) { add("error", "extra-statement", { statement: latex(s.operands[i]) }, [s.operands[i]]); });
        } else {
            add("error", "wrong-value", {}, [s]);
        }
    } else if (refKind === "set" || refKind === "list") {
        const sItems = s.type === "set" ? s.elements : s.items, rItems = r.type === "set" ? r.elements : r.items;
        const eq = function (a, b) { return expressionsEqual(a, b, ctx).equal; };
        const m = matchUnordered(sItems, rItems, eq);
        m.missing.forEach(function () { add("error", "missing-element", {}, []); });
        m.extra.forEach(function (i) {
            /* the same value as a matched element: a duplicate */
            const dup = m.pairs.some(function (p) { return eq(sItems[i], sItems[p[0]]); });
            if (dup) {
                const lvl = rules.collections.setDuplicates;
                if (lvl === "error") add("error", "duplicate-element", { element: latex(sItems[i]) }, [sItems[i]]);
                else if (lvl === "note") add("note", "duplicate-note", { element: latex(sItems[i]) }, [sItems[i]]);
            } else {
                add("error", "extra-element", { element: latex(sItems[i]) }, [sItems[i]]);
            }
        });
        state.valueRight = m.missing.length === 0 && m.extra.every(function (i) {
            return m.pairs.some(function (p) { return eq(sItems[i], sItems[p[0]]); });
        });
    } else if (refKind === "tuple") {
        const eq = function (a, b) { return expressionsEqual(a, b, ctx).equal; };
        const sameOrder = s.elements.length === r.elements.length && r.elements.every(function (e, i) { return eq(s.elements[i], e); });
        if (sameOrder) state.valueRight = true;
        else {
            const m = matchUnordered(s.elements, r.elements, eq);
            if (m.missing.length === 0 && m.extra.length === 0) add("error", "wrong-order", {}, [s]);
            else {
                m.missing.forEach(function () { add("error", "missing-element", {}, []); });
                m.extra.forEach(function (i) { add("error", "extra-element", { element: latex(s.elements[i]) }, [s.elements[i]]); });
            }
        }
    } else if (refKind === "derivation") {
        /* a chain of steps: the last against the reference's last; with allSteps every step an identity */
        const last = s.elements[s.elements.length - 1], rLast = r.elements[r.elements.length - 1];
        if (rules.statements.derivation === "allSteps") {
            for (let i = 1; i < s.elements.length; i += 1) {
                if (!expressionsEqual(s.elements[i], s.elements[i - 1], ctx).equal) {
                    add("error", "wrong-step", { step: i }, [s.elements[i]]);
                    break;
                }
            }
        }
        const eq = expressionsEqual(last, rLast, ctx);
        if (eq.equal) state.valueRight = items.every(function (it) { return it.kind !== "error"; });
        else add("error", "wrong-value", {}, [last]);
    }

    /* form, numbers - only when the value is right (decided 2026-10-21, CHECKING-API-DESIGN 9.3) */
    if (state.valueRight) {
        runFormChecks(s, r, rules, function (lvl, code, params, nodes) {
            if (code === "not-simplified" && params.detailKey) params = { detail: params.detailKey };
            add(lvl === "note" ? "note" : "error", code, params, nodes);
        });
        const nd = rules.numbers.decimals;
        if (nd && refKind === "expression") {
            const places = decimalPlaces(sAns);
            if (places !== null) {
                const want = nd.exactly !== undefined ? nd.exactly : nd.min !== undefined ? nd.min : nd.max;
                const bad = nd.exactly !== undefined ? places !== nd.exactly : nd.min !== undefined ? places < nd.min : places > nd.max;
                if (bad) add("error", "wrong-decimals", { decimals: want }, [sAns]);
            }
        }
    }

    return { items: items, state: state };
}

/* a wrong expression value: a teacher mistake, then the automatic diagnosis, then "wrong value" */
function diagnoseWrongValue(s, r, eq, ctx, add, state) {
    const rules = ctx.rules;

    for (let m = 0; m < (rules.mistakes || []).length; m += 1) {
        const mistake = rules.mistakes[m];
        const mAns = answerOf(parseInput(mistake.answer));
        if (mAns && expressionsEqual(s, mAns, ctx).equal) {
            state.matchedMistake = m;
            add("error", "teacher-mistake", { message: mistake.message, points: mistake.points }, [s]);
            return;
        }
    }

    const tol = rules.value.tolerance;
    if (rules.diagnosis !== false && eq.rows && eq.rows.length >= 3 && !usesPlusMinus(s) && !usesPlusMinus(r)) {
        const rows = eq.rows;                             // values: [reference, student]
        const k = constantRatio(rows, 1, 0, tol);
        /* two plain numbers always have a ratio: only a sign or a power of 10 means something there */
        const variables = hasVariable(r) || hasVariable(s);
        if (k !== null && Math.abs(k + 1) < 1e-7) { add("error", "sign-error", {}, [s]); return; }
        if (k !== null && Math.abs(k) > 1e-9) {
            const lg = Math.log10(Math.abs(k));
            if (Math.abs(lg - Math.round(lg)) < 1e-9 && Math.round(lg) !== 0) {
                add("error", "scale-error", { factor: latexNumber(k) }, [s]);
                return;
            }
            if (variables) {
                add("error", "missing-factor", { factor: latexNumber(k) }, [s]);
                return;
            }
        }
        /* one term missing (s = r − t) or extra (s = r + t) */
        const refTerms = r.type === "operation" && r.op === "+" ? r.operands : [];
        const stuTerms = s.type === "operation" && s.op === "+" ? s.operands : [];
        const diff = difference(s, r);
        for (const t of refTerms) {
            const sm = sampleValues([diff, { type: "operation", op: "neg", operands: [t] }], ctx);
            if (sm.ok && rowsEqual(sm.rows, 0, 1, tol)) { add("error", "missing-term", {}, [s]); return; }
        }
        for (const t of stuTerms) {
            const sm = sampleValues([diff, t], ctx);
            if (sm.ok && rowsEqual(sm.rows, 0, 1, tol)) { add("error", "extra-term", { term: latex(t) }, [t]); return; }
        }
        /* close but outside the tolerance: rounding */
        const pct = rules.numbers.closeButWrong;
        if (pct > 0 && !hasVariable(r) && rows.every(function (row) {
            const a = row.values[1][0], b = row.values[0][0];
            return Math.abs(a - b) <= pct / 100 * Math.max(Math.abs(b), 1e-12);
        })) {
            add("error", "rounding", {}, [s]);
            return;
        }
    }
    add("error", "wrong-value", {}, [s]);
}

/* ============================================================
   RUBRIC (CHECKING-API-DESIGN 4)
   ============================================================ */
function categoryRule(rubric, cat) {
    const r = rubric.categories[cat];
    if (r === undefined || r === null) return null;
    if (typeof r === "number") return { mode: "once", points: r };
    return r;
}

function applyRubric(raw, rubric) {
    const errors = raw.items.filter(function (it) { return it.kind === "error"; });
    const penalties = [];
    let total = 0;

    /* fatal: grade 0 */
    const fatal = errors.filter(function (e) { return rubric.fatal.indexOf(CATEGORY_OF[e.code] || e.code) >= 0; });
    if (fatal.length) {
        errors.forEach(function (e) { e.counted = fatal.indexOf(e) >= 0; e.penalty = 0; });
        return { grade: 0, penalties: [{ category: CATEGORY_OF[fatal[0].code], points: rubric.start, count: fatal.length, capped: false, fatal: true }] };
    }

    /* a teacher mistake with its own points: that grade */
    const mistake = errors.filter(function (e) { return e.code === "teacher-mistake" && typeof e.params.points === "number"; })[0];
    if (mistake) {
        mistake.counted = true;
        mistake.penalty = rubric.start - mistake.params.points;
        return { grade: Math.max(rubric.minimum, Math.round(mistake.params.points)), penalties: [{ category: "mistake", points: mistake.penalty, count: 1, capped: false }] };
    }

    const byCategory = {};
    errors.forEach(function (e) {
        let cat = CATEGORY_OF[e.code] || "value";
        /* a diagnosis category the rubric does not set: graded as a wrong value (CHECKING-API-DESIGN 9.2) */
        if (DIAGNOSIS_CATEGORIES.indexOf(cat) >= 0 && !categoryRule(rubric, cat)) cat = "value";
        e.category = cat;
        (byCategory[cat] = byCategory[cat] || []).push(e);
    });

    Object.keys(byCategory).forEach(function (cat) {
        const list = byCategory[cat], rule = categoryRule(rubric, cat) || CATEGORY_DEFAULTS[cat];
        if (!rule || rule.mode === "none") {
            list.forEach(function (e) { e.counted = false; e.penalty = 0; });
            return;
        }
        let points, capped = false;
        if (rule.mode === "each") {
            points = list.length * rule.points;
            if (rule.max !== undefined && points > rule.max) { points = rule.max; capped = true; }
        } else {
            points = rule.points;
        }
        list.forEach(function (e, i) { e.counted = true; e.penalty = rule.mode === "each" ? rule.points : (i === 0 ? rule.points : 0); });
        total += points;
        penalties.push({ category: cat, points: points, count: list.length, capped: capped });
    });

    return { grade: Math.max(rubric.minimum, Math.round(rubric.start - total)), penalties: penalties };
}

/* ============================================================
   THE FEEDBACK TEXT
   ============================================================ */
function buildFeedback(raw, graded, rules, language, reference) {
    const lang = TEXT[language] ? language : "en";
    const custom = rules.feedback.messages || {};
    const lines = [];
    const rtl = lang !== "en";
    const iso = function (s) { return rtl ? LRI + s + PDI : s; };

    lines.push(feedbackText("score", lang, { score: iso(graded.grade) }));

    const errors = raw.items.filter(function (it) { return it.kind === "error"; });
    const notes = raw.items.filter(function (it) { return it.kind === "note"; });
    let n = 0;
    const message = function (it) {
        if (it.code === "teacher-mistake") {
            const m = it.params.message || {};
            return typeof m === "string" ? m : (m[lang] || m.en || feedbackText("wrong-value", lang, {}, custom));
        }
        const params = Object.assign({}, it.params);
        if (params.detail) params.detail = TEXT[lang][params.detail] || params.detail;
        return feedbackText(it.code, lang, params, custom);
    };

    const groups = {};
    errors.forEach(function (e) { (groups[e.category || CATEGORY_OF[e.code]] = groups[e.category || CATEGORY_OF[e.code]] || []).push(e); });
    Object.keys(groups).forEach(function (cat) {
        const p = graded.penalties.filter(function (x) { return x.category === cat; })[0];
        if (rules.feedback.showPenalties && p) {
            lines.push(iso("−" + p.points + "%") + " · " + (TEXT[lang]["cat-" + cat] || cat));
        }
        groups[cat].forEach(function (e) {
            n += 1;
            e.message = message(e);
            lines.push(n + ". " + e.message + (e.counted === false ? " (" + TEXT[lang]["not-counted"] + ")" : ""));
        });
    });

    if (rules.feedback.showNotes) {
        const shown = notes.filter(function (it) { return (TEXT[lang][it.code] || "") !== "" || custom[it.code]; });
        if (shown.length) {
            lines.push(TEXT[lang].notes + ":");
            shown.forEach(function (it) { it.message = message(it); lines.push("• " + it.message); });
        }
    }

    if (rules.feedback.showReference && errors.length) {
        lines.push(feedbackText("reference", lang, { reference: latex(answerOf(reference)) }));
    }
    return lines.join("\n");
}

/* ============================================================
   VALIDATION OF THE TEACHER'S INPUT
   ============================================================ */
function validateRules(rules) {
    const msgs = [];
    if (!rules || typeof rules !== "object") return ["rules: not an object"];
    Object.keys(rules).forEach(function (k) {
        if (!(k in DEFAULT_RULES)) msgs.push("rules." + k + ": unknown key");
    });
    if (rules.value && rules.value.mode && ["numeric", "structural", "exact"].indexOf(rules.value.mode) < 0) {
        msgs.push("rules.value.mode: numeric | structural | exact");
    }
    if (rules.value && rules.value.samples !== undefined && !(rules.value.samples >= 3)) msgs.push("rules.value.samples: at least 3");
    return msgs;
}

function validateRubric(rubric) {
    const msgs = [];
    if (!rubric || typeof rubric !== "object") return ["rubric: not an object"];
    Object.keys(rubric.categories || {}).forEach(function (cat) {
        const r = rubric.categories[cat];
        if (typeof r === "number") return;
        if (!r || ["once", "each", "none"].indexOf(r.mode) < 0) msgs.push("rubric.categories." + cat + ".mode: once | each | none");
        else if (r.mode !== "none" && !(r.points >= 0)) msgs.push("rubric.categories." + cat + ".points: a number ≥ 0");
    });
    return msgs;
}

/* ============================================================
   THE API
   ============================================================ */
function compare(student, reference, rules, rubric, options) {
    options = options || {};
    const R = merge(DEFAULT_RULES, rules || {});
    /* a rubric's categories replace the defaults (the teacher's table is the whole table) */
    const B = merge(DEFAULT_RUBRIC, Object.assign({}, rubric || {}, { categories: undefined }));
    if (rubric && rubric.categories) B.categories = clone(rubric.categories);
    const language = options.language || "en";

    const s = parseInput(student);
    const refs = Array.isArray(reference) ? reference.map(parseInput) : [parseInput(reference)];

    let best = null;
    refs.forEach(function (ref, index) {
        const debug = options.debug ? {} : null;
        const raw = compareOne(s, ref, R, options, debug);
        const graded = applyRubric(raw, B);
        if (!best || graded.grade > best.graded.grade) best = { raw: raw, graded: graded, index: index, debug: debug, ref: ref };
    });

    const feedback = buildFeedback(best.raw, best.graded, R, language, best.ref);
    const items = best.raw.items.map(function (it) {
        return {
            kind: it.kind,
            code: it.code,
            category: it.kind === "error" ? (it.category || CATEGORY_OF[it.code]) : null,
            message: it.message || "",
            penalty: it.penalty || 0,
            counted: it.kind === "error" ? it.counted !== false : false,
            studentNodes: it.nodes.reduce(function (a, n) { return a.concat(srcOf(n)); }, [])
        };
    });
    const result = {
        grade: best.graded.grade,
        correct: !items.some(function (it) { return it.kind === "error"; }),
        feedback: feedback,
        items: items,
        penalties: best.graded.penalties,
        matched: {
            reference: best.index,
            mistake: best.raw.state.matchedMistake,
            equivalence: best.raw.state.equivalence !== null && best.raw.state.equivalence >= 0 ? LADDER[best.raw.state.equivalence].name
                : best.raw.state.equivalenceName || null
        },
        version: VERSION
    };
    if (options.debug) result.debug = best.debug;
    return result;
}

/* the canonical form as text - for the builder / playground, to show how equivalence is computed */
function canonicalText(answer, rules, stepName) {
    const R = merge(DEFAULT_RULES, rules || {});
    let step = LADDER.length - 1;
    LADDER.forEach(function (l, i) { if (l.name === stepName) step = i; });
    return ckey(canonical(answerOf(parseInput(answer)), lawsUpTo(step, R)));
}

return {
    compare: compare,
    validateRules: validateRules,
    validateRubric: validateRubric,
    feedbackText: feedbackText,
    canonicalText: canonicalText,
    ladder: LADDER.map(function (l) { return { name: l.name, laws: l.laws.slice() }; }),
    latex: function (answer) { return latex(answerOf(parseInput(answer))); },
    defaults: { rules: clone(DEFAULT_RULES), rubric: clone(DEFAULT_RUBRIC) },
    version: VERSION
};
});
