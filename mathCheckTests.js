/*
 * Tests for mathCheck.js - in Node (node mathCheckTests.js) and in the browser (mathCheckTestHarness.html).
 *
 * Answers are written in the compact notation of kbdTests.js (the notation the keyboard tests check getAST()
 * against), parsed here into the same semantic AST the keyboard produces:
 *   (+ 7 x (* 3 y))  operation     (less x 3)  relation      ?  missing     ∅  empty
 *   tuple[1, 2]  set{1, 2}         sin(x)  sqrt((+ x 1))  log_2(8)        x_1  indexed variable
 *   simpleFraction<numerator=1 denominator=2>  (other structures: type<part=value ...>)
 *   a ‖ b                          chain elements (the main-panel "=")
 *   vec(AB)  the vector from A to B   vec(v)  a one-letter vector
 *
 * The browser harness also runs end-to-end cases typed with the real keyboard (kbdTests.js key notation).
 */
(function (global) {
"use strict";

/* ---------------- the notation -> semantic AST ---------------- */
const RELATIONS = ["less", "greater", "lessEqual", "greaterEqual", "notEqual", "approximate", "equal", "memberOf", "notMemberOf"];
const CONSTANTS = ["pi", "e", "i"];

function parse(text) {
    if (text === null || text === undefined) return null;
    const elements = String(text).split(" ‖ ").map(function (part) { return parseNode(part); });
    return { type: "chain", elements: elements };
}

function parseNode(text) {
    let i = 0;
    const s = String(text);

    function space() { while (i < s.length && s[i] === " ") i += 1; }
    function peek() { return s[i]; }
    function expect(c) {
        if (s[i] !== c) throw new Error("expected '" + c + "' at " + i + " in: " + s);
        i += 1;
    }
    function ident() {
        const m = /^[A-Za-z][A-Za-z0-9]*/.exec(s.slice(i));
        if (!m) throw new Error("expected a name at " + i + " in: " + s);
        i += m[0].length;
        return m[0];
    }
    function list(close) {
        const items = [];
        space();
        if (peek() === close) { i += 1; return items; }
        for (;;) {
            items.push(node());
            space();
            if (peek() === ",") { i += 1; continue; }
            expect(close);
            return items;
        }
    }
    function node() {
        space();
        const c = peek();
        if (c === "?") { i += 1; return { type: "missing" }; }
        if (c === "∅") { i += 1; return null; }
        if (c === "(") {
            i += 1;
            space();
            const opMatch = /^[^\s()]+/.exec(s.slice(i));
            const op = opMatch[0];
            i += op.length;
            const args = [];
            for (;;) {
                space();
                if (peek() === ")") { i += 1; break; }
                args.push(node());
            }
            if (RELATIONS.indexOf(op) >= 0) return { type: "relation", op: op, left: args[0], right: args[1] };
            return { type: "operation", op: op, operands: args };
        }
        const num = /^-?\d+(\.\d+)?/.exec(s.slice(i));
        if (num) { i += num[0].length; return { type: "number", value: num[0] }; }

        const name = ident();
        /* vec(AB): the vector from A to B, as the keyboard gives it (name.points); vec(v): a one-letter vector */
        if (name === "vec" && peek() === "(") {
            i += 1;
            const text = ident();
            expect(")");
            const point = function (p) { return { type: "variableName", name: p, subscript: null }; };
            return text.length === 2 ? { type: "vector", name: { type: "variableName", name: text, subscript: null, points: [point(text[0]), point(text[1])] } }
                : { type: "vector", name: point(text) };
        }
        if (name === "tuple" && peek() === "[") { i += 1; return { type: "tuple", elements: list("]") }; }
        if (name === "list" && peek() === "[") { i += 1; return { type: "list", items: list("]") }; }
        if (name === "set" && peek() === "{") { i += 1; return { type: "set", elements: list("}") }; }
        if (peek() === "<") {
            i += 1;
            const out = { type: name };
            for (;;) {
                space();
                if (peek() === ">") { i += 1; break; }
                const key = ident();
                expect("=");
                out[key] = node();
            }
            return out;
        }
        if (name === "log" && peek() === "_") {
            i += 1;
            const base = node();
            expect("(");
            const arg = node();
            expect(")");
            return { type: "function", name: "log", base: base, argument: arg };
        }
        if (peek() === "(") {
            i += 1;
            const arg = node();
            expect(")");
            return { type: "function", name: name, argument: arg };
        }
        let result = CONSTANTS.indexOf(name) >= 0 ? { type: "constant", name: name } : { type: "variable", name: name };
        if (peek() === "_") {
            i += 1;
            result = { type: "indexedVariable", variable: result, subscript: node() };
        }
        return result;
    }

    const result = node();
    space();
    if (i !== s.length) throw new Error("unexpected text at " + i + " in: " + s);
    return result;
}

/* ---------------- the cases ---------------- */
const FORM = function (name, level) { const f = {}; f[name] = level || "error"; return { form: f }; };

const CASES = [
    /* the equivalence ladder: the first step at which the answers are the same */
    { group: "Equivalence", name: "identical", ref: "(+ x 1)", student: "(+ x 1)", expect: { grade: 100, equivalence: "identical" } },
    { group: "Equivalence", name: "order (commutative)", ref: "(+ x 1)", student: "(+ 1 x)", expect: { grade: 100, equivalence: "commutative" } },
    { group: "Equivalence", name: "x+x = 2x (like terms)", ref: "(* 2 x)", student: "(+ x x)", expect: { grade: 100, equivalence: "likeTerms" } },
    { group: "Equivalence", name: "x·x = x² (like factors)", ref: "(^ x 2)", student: "(* x x)", expect: { grade: 100, equivalence: "likeTerms" } },
    { group: "Equivalence", name: "2(x+1) = 2x+2 (distributive)", ref: "(* 2 (+ x 1))", student: "(+ (* 2 x) 2)", expect: { grade: 100, equivalence: "distributive" } },
    { group: "Equivalence", name: "(x+1)² = x²+2x+1", ref: "(^ (+ x 1) 2)", student: "(+ (^ x 2) (* 2 x) 1)", expect: { grade: 100, equivalence: "distributive" } },
    { group: "Equivalence", name: "1/2 = 0.5 (number forms)", ref: "(/ 1 2)", student: "0.5", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Equivalence", name: "x/2 = 0.5x", ref: "(/ x 2)", student: "(* 0.5 x)", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Equivalence", name: "−a/b = a/(−b)", ref: "(neg (/ a b))", student: "(/ a (neg b))", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Equivalence", name: "√x = x^0.5", ref: "sqrt(x)", student: "(^ x 0.5)", rules: { value: { variables: { x: { positive: true } } } }, expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Functions", name: "asin(x) = π/2 − acos(x) (x in −1..1)", ref: "asin(x)", student: "(+ (/ pi 2) (neg acos(x)))", rules: { value: { variables: { x: { min: -1, max: 1 } } } }, expect: { grade: 100 } },
    { group: "Functions", name: "asin(x) with the default range (undefined points skipped)", ref: "asin(x)", student: "(+ (/ pi 2) (neg acos(x)))", expect: { grade: 100 } },
    { group: "Functions", name: "acos(x) for asin(x)", ref: "asin(x)", student: "acos(x)", rules: { value: { variables: { x: { min: -1, max: 1 } } } }, expect: { grade: 0 } },
    { group: "Functions", name: "atan(x) = asin(x/√(1+x²))", ref: "atan(x)", student: "asin((/ x sqrt((+ 1 (^ x 2)))))", expect: { grade: 100 } },
    { group: "Functions", name: "sinh(x) = (eˣ − e⁻ˣ)/2", ref: "sinh(x)", student: "(/ (+ (^ e x) (neg (^ e (neg x)))) 2)", expect: { grade: 100 } },
    { group: "Functions", name: "cosh² − sinh² = 1", ref: "1", student: "(+ (^ cosh(x) 2) (neg (^ sinh(x) 2)))", expect: { grade: 100 } },
    { group: "Functions", name: "asinh(x) = ln(x + √(x²+1))", ref: "asinh(x)", student: "ln((+ x sqrt((+ (^ x 2) 1))))", expect: { grade: 100 } },
    { group: "Functions", name: "atanh for tanh", ref: "tanh(x)", student: "atanh(x)", rules: { value: { variables: { x: { min: -0.9, max: 0.9 } } } }, expect: { grade: 0 } },
    { group: "Functions", name: "y = asin(x) as sin(y) = x? (no: other branches)", ref: "y ‖ asin(x)", student: "sin(y) ‖ x", expect: { grade: 0 } },
    { group: "Units", name: "2 km for 2 km", ref: "2", refUnit: "km", student: "2", studentUnit: "km", expect: { grade: 100 } },
    { group: "Units", name: "2000 m for 2 km: converted", ref: "2", refUnit: "km", student: "2000", studentUnit: "m", expect: { grade: 100 } },
    { group: "Units", name: "2000 m for 2 km, other units noted", ref: "2", refUnit: "km", student: "2000", studentUnit: "m", rules: { units: { otherUnits: "note" } }, expect: { grade: 100, notes: ["note-other-unit"] } },
    { group: "Units", name: "2000 m for 2 km, other units not accepted", ref: "2", refUnit: "km", student: "2000", studentUnit: "m", rules: { units: { otherUnits: false } }, expect: { grade: 70, codes: ["unit-not-accepted"], feedbackIncludes: "Write the answer in" } },
    { group: "Units", name: "2 without a unit", ref: "2", refUnit: "km", student: "2", studentUnit: "", expect: { grade: 70, codes: ["missing-unit"], feedbackIncludes: "The unit is missing." } },
    { group: "Units", name: "2 km/h: a unit of speed for a length", ref: "2", refUnit: "km", student: "2", studentUnit: "km/h", expect: { grade: 70, codes: ["wrong-unit"], feedbackIncludes: "is not a unit of length" } },
    { group: "Units", name: "2 m for 2 km: a wrong value", ref: "2", refUnit: "km", student: "2", studentUnit: "m", expect: { grade: 0, codes: ["scale-error"] } },
    { group: "Units", name: "120 km for 2 km (12 · 10 without converting minutes)", ref: "2", refUnit: "km", student: "120", studentUnit: "km", expect: { grade: 0 } },
    { group: "Units", name: "7200 s for 2 h", ref: "2", refUnit: "h", student: "7200", studentUnit: "s", expect: { grade: 100 } },
    { group: "Units", name: "12 km/h as 10/3 m/s", ref: "12", refUnit: "km/h", student: "(/ 10 3)", studentUnit: "m/s", expect: { grade: 100 } },
    { group: "Units", name: "a unit not asked for: ignored", ref: "2", student: "2", studentUnit: "km", expect: { grade: 100 } },
    { group: "Units", name: "strict: 2000 m for 2 km", ref: "2", refUnit: "km", student: "2000", studentUnit: "m", rules: { units: { strict: true } }, expect: { grade: 70, codes: ["unit-not-accepted"] } },
    { group: "Units", name: "strict: 2 km for 2 km", ref: "2", refUnit: "km", student: "2", studentUnit: "km", rules: { units: { strict: true } }, expect: { grade: 100 } },
    { group: "Units", name: "a unit error fatal: no unit gives 0", ref: "2", refUnit: "km", student: "2", studentUnit: "", rubric: { fatal: ["incomplete", "answerType", "units"] }, expect: { grade: 0, codes: ["missing-unit"] } },
    { group: "Units", name: "strict + fatal: 2000 m gives 0", ref: "2", refUnit: "km", student: "2000", studentUnit: "m", rules: { units: { strict: true } }, rubric: { fatal: ["incomplete", "answerType", "units"] }, expect: { grade: 0, codes: ["unit-not-accepted"] } },
    { group: "Units", name: "units category 50", ref: "2", refUnit: "km", student: "2", studentUnit: "", rubric: { categories: { value: { mode: "once", points: 100 }, units: { mode: "once", points: 50 } } }, expect: { grade: 50 } },
    { group: "Form checks", name: "√(1/2) for √2/2: rational denominator noted", ref: "(/ sqrt(2) 2)", student: "sqrt((/ 1 2))", rules: { form: { rationalDenominator: "note" } }, expect: { grade: 100, notes: ["irrational-denominator"] } },
    { group: "Form checks", name: "√(1/4) for 1/2: a perfect square, nothing to note", ref: "(/ 1 2)", student: "sqrt((/ 1 4))", rules: { form: { rationalDenominator: "note" } }, expect: { grade: 100, codes: [] } },
    { group: "Form checks", name: "√2/2 itself: nothing to note", ref: "(/ sqrt(2) 2)", student: "(/ sqrt(2) 2)", rules: { form: { rationalDenominator: "note" } }, expect: { grade: 100, codes: [] } },
    { group: "Plus-minus", name: "±7 for ±7", ref: "(plusMinus 7)", student: "(plusMinus 7)", expect: { grade: 100 } },
    { group: "Plus-minus", name: "∓7 for ±7", ref: "(plusMinus 7)", student: "(minusPlus 7)", expect: { grade: 100 } },
    { group: "Plus-minus", name: "7 for ±7: one value", ref: "(plusMinus 7)", student: "7", expect: { grade: 50, codes: ["missing-plus-minus"], feedbackIncludes: "Only one of the two values" } },
    { group: "Plus-minus", name: "−7 for ±7: one value", ref: "(plusMinus 7)", student: "(neg 7)", expect: { grade: 50, codes: ["missing-plus-minus"] } },
    { group: "Plus-minus", name: "6 for ±7: wrong", ref: "(plusMinus 7)", student: "6", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Plus-minus", name: "5 for 2 ± 3: one value", ref: "(plusMinus 2 3)", student: "5", expect: { grade: 50, codes: ["missing-plus-minus"] } },
    { group: "Plus-minus", name: "−1 for 2 ± 3: one value", ref: "(plusMinus 2 3)", student: "(neg 1)", expect: { grade: 50, codes: ["missing-plus-minus"] } },
    { group: "Plus-minus", name: "2 − 3 for 2 ± 3: one value", ref: "(plusMinus 2 3)", student: "(+ 2 (neg 3))", expect: { grade: 50, codes: ["missing-plus-minus"] } },
    { group: "Plus-minus", name: "2 ± 4 for 2 ± 3: the part after ± wrong", ref: "(plusMinus 2 3)", student: "(plusMinus 2 4)", expect: { grade: 50, codes: ["pm-second-wrong"], feedbackIncludes: "after" } },
    { group: "Plus-minus", name: "1 ± 3 for 2 ± 3: the part before ± wrong", ref: "(plusMinus 2 3)", student: "(plusMinus 1 3)", expect: { grade: 50, codes: ["pm-first-wrong"], feedbackIncludes: "before" } },
    { group: "Plus-minus", name: "1 ± 4 for 2 ± 3: both wrong", ref: "(plusMinus 2 3)", student: "(plusMinus 1 4)", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Plus-minus", name: "2 ∓ (−3) for 2 ± 3: the same values", ref: "(plusMinus 2 3)", student: "(minusPlus 2 (neg 3))", expect: { grade: 100 } },
    { group: "Plus-minus", name: "(3+2x) ± (7+3y) for (2x+3) ± (3y+7)", ref: "(plusMinus (+ (* 2 x) 3) (+ (* 3 y) 7))", student: "(plusMinus (+ 3 (* 2 x)) (+ 7 (* 3 y)))", expect: { grade: 100 } },
    { group: "Plus-minus", name: "(2x+3) ± (3y+8): the part after ± wrong", ref: "(plusMinus (+ (* 2 x) 3) (+ (* 3 y) 7))", student: "(plusMinus (+ (* 2 x) 3) (+ (* 3 y) 8))", expect: { grade: 50, codes: ["pm-second-wrong"] } },
    { group: "Plus-minus", name: "2x + 3y + 10 for (2x+3) ± (3y+7): one value, partial", ref: "(plusMinus (+ (* 2 x) 3) (+ (* 3 y) 7))", student: "(+ (* 2 x) (* 3 y) 10)", expect: { grade: 50, codes: ["missing-plus-minus"] } },
    { group: "Plus-minus", name: "the same with oneValue wrong: 0", ref: "(plusMinus (+ (* 2 x) 3) (+ (* 3 y) 7))", student: "(+ (* 2 x) (* 3 y) 10)", rules: { plusMinus: { oneValue: "wrong" } }, expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Plus-minus", name: "7 for ±7, rubric plusMinus 30", ref: "(plusMinus 7)", student: "7", rubric: { categories: { value: { mode: "once", points: 100 }, plusMinus: { mode: "once", points: 30 } } }, expect: { grade: 70 } },
    { group: "Plus-minus", name: "Hebrew: one value", ref: "(plusMinus 7)", student: "7", language: "he", expect: { feedbackIncludes: "רק אחד משני הערכים" } },
    { group: "Solutions", name: "x = 1 ∨ x = 5 for x = 3 ± 2", ref: "x ‖ (plusMinus 3 2)", student: "(or (equal x 1) (equal x 5))", expect: { grade: 100 } },
    { group: "Solutions", name: "x ∈ {5, 1} for x = 3 ± 2", ref: "x ‖ (plusMinus 3 2)", student: "(memberOf x set{5, 1})", expect: { grade: 100 } },
    { group: "Solutions", name: "x = 1, 5 for x = 3 ± 2: a list, noted", ref: "x ‖ (plusMinus 3 2)", student: "x ‖ list[1, 5]", expect: { grade: 100, notes: ["solution-list"], feedbackIncludes: "not a proper form" } },
    { group: "Solutions", name: "x = 3 ± 2 for x ∈ {1, 5}", ref: "(memberOf x set{1, 5})", student: "x ‖ (plusMinus 3 2)", expect: { grade: 100 } },
    { group: "Solutions", name: "x = 5 for x = 3 ± 2: one value (± rule)", ref: "x ‖ (plusMinus 3 2)", student: "x ‖ 5", expect: { grade: 50, codes: ["missing-plus-minus"] } },
    { group: "Solutions", name: "x = 5 for x = 1 ∨ x = 5: a solution missing, named", ref: "(or (equal x 1) (equal x 5))", student: "x ‖ 5", expect: { grade: 75, codes: ["missing-solution"], feedbackIncludes: "The solution \\(1\\) is missing." } },
    { group: "Solutions", name: "x ∈ {1, 5, 7} for x = 3 ± 2: 7 is not a solution", ref: "x ‖ (plusMinus 3 2)", student: "(memberOf x set{1, 5, 7})", expect: { grade: 75, codes: ["extra-solution"], feedbackIncludes: "\\(7\\) is not a solution" } },
    { group: "Solutions", name: "the set form not accepted: an error", ref: "x ‖ (plusMinus 3 2)", student: "(memberOf x set{1, 5})", rules: { solutions: { set: false } }, expect: { grade: 90, codes: ["solution-form-not-accepted"], feedbackIncludes: "x=a\\pm b" } },
    { group: "Solutions", name: "a list not accepted: an error", ref: "(or (equal x 1) (equal x 5))", student: "x ‖ list[1, 5]", rules: { solutions: { list: false } }, expect: { grade: 90, codes: ["solution-list"] } },
    { group: "Solutions", name: "x = 1, 6 for x = 3 ± 2: 6 wrong, 5 missing", ref: "x ‖ (plusMinus 3 2)", student: "x ‖ list[1, 6]", expect: { grade: 50, codes: ["extra-solution", "missing-solution"] } },
    { group: "Solutions", name: "y ∈ {1, 5} for x ∈ {1, 5}: another variable", ref: "(memberOf x set{1, 5})", student: "(memberOf y set{1, 5})", expect: { grade: 0 } },
    { group: "Exclusions", name: "x ∉ {1, 5} for x ≠ 1 ∧ x ≠ 5", ref: "(and (notEqual x 1) (notEqual x 5))", student: "(notMemberOf x set{1, 5})", expect: { grade: 100 } },
    { group: "Exclusions", name: "x ≠ 1, 5 for x ∉ {1, 5}: a list, noted", ref: "(notMemberOf x set{1, 5})", student: "list[(notEqual x 1), 5]", expect: { grade: 100, notes: ["exclusion-list"], feedbackIncludes: "x\\ne 1\\land x\\ne 5" } },
    { group: "Exclusions", name: "x ≠ 1 for x ∉ {1, 5}: 5 should be excluded too", ref: "(notMemberOf x set{1, 5})", student: "(notEqual x 1)", expect: { grade: 75, codes: ["missing-excluded"], feedbackIncludes: "should be excluded too" } },
    { group: "Exclusions", name: "x ∉ {1, 5, 0} for x ∉ {1, 5}: set against set - the membership wording", ref: "(notMemberOf x set{1, 5})", student: "(notMemberOf x set{1, 5, 0})", expect: { grade: 75, codes: ["extra-element"] } },
    { group: "Exclusions", name: "x ≠ 1 ∧ x ≠ 5 ∧ x ≠ 0 for x ∉ {1, 5}: 0 should not be excluded", ref: "(notMemberOf x set{1, 5})", student: "(and (notEqual x 1) (notEqual x 5) (notEqual x 0))", expect: { grade: 75, codes: ["extra-excluded"], feedbackIncludes: "should not be excluded" } },
    { group: "Exclusions", name: "x ∈ {1, 5} for x ∉ {1, 5}: not the same kind", ref: "(notMemberOf x set{1, 5})", student: "(memberOf x set{1, 5})", expect: { grade: 50, codes: ["wrong-relation"] } },
    { group: "Exclusions", name: "x ≠ 2, x ≠ 8 for x ∉ {2, 8}: a list of statements, noted", ref: "(notMemberOf x set{2, 8})", student: "list[(notEqual x 2), (notEqual x 8)]", expect: { grade: 100, notes: ["exclusion-list"] } },
    { group: "Exclusions", name: "x ≠ 2, x ≠ 8 for x ≠ 2 ∧ x ≠ 8", ref: "(and (notEqual x 2) (notEqual x 8))", student: "list[(notEqual x 2), (notEqual x 8)]", expect: { grade: 100, notes: ["exclusion-list"] } },
    { group: "Exclusions", name: "x ≠ 2, x ≠ 7 for x ∉ {2, 8}: 7 wrong, 8 missing", ref: "(notMemberOf x set{2, 8})", student: "list[(notEqual x 2), (notEqual x 7)]", expect: { grade: 50, codes: ["extra-excluded", "missing-excluded"] } },
    { group: "Exclusions", name: "x ≠ 2, y ≠ 8: two variables - not a set of excluded values", ref: "(notMemberOf x set{2, 8})", student: "list[(notEqual x 2), (notEqual y 8)]", expect: { grade: 0 } },
    { group: "Solutions", name: "x = 1, x = 5 for x = 3 ± 2: a list of statements, noted", ref: "x ‖ (plusMinus 3 2)", student: "list[(equal x 1), (equal x 5)]", expect: { grade: 100, notes: ["solution-list"] } },
    { group: "Logic notation", name: "symbols (default): x ≠ 1 ∧ x ≠ 5 in the note", ref: "(notMemberOf x set{1, 5})", student: "list[(notEqual x 1), 5]", expect: { feedbackIncludes: "x\\ne 1\\land x\\ne 5" } },
    { group: "Logic notation", name: "english: AND", ref: "(notMemberOf x set{1, 5})", student: "list[(notEqual x 1), 5]", logicNotation: "english", expect: { feedbackIncludes: "\\text{AND}" } },
    { group: "Logic notation", name: "language en: or (the set form not accepted)", ref: "(or (equal x 1) (equal x 5))", student: "(memberOf x set{1, 5})", rules: { solutions: { set: false } }, logicNotation: "language", expect: { feedbackIncludes: "\\text{or}" } },
    { group: "Logic notation", name: "language he: או, reversed for MathJax", ref: "x ‖ (plusMinus 3 2)", student: "x ‖ list[1, 5]", language: "he", logicNotation: "language", expect: { feedbackIncludes: "\\text{וא}" } },
    { group: "Logic notation", name: "language ar: and in a named part", ref: "(and (less 3 x) (less x 5))", student: "(and (less 3 x) (less x 7))", language: "ar", logicNotation: "language", expect: { grade: 50 } },
    { group: "Exclusions", name: "Hebrew: the excluded values with commas", ref: "(notMemberOf x set{1, 5})", student: "list[(notEqual x 1), 5]", language: "he", expect: { feedbackIncludes: "עם פסיקים" } },
    { group: "Complex", name: "0.12 − 0.16i for (3+4i)⁻¹", ref: "(^ (+ 3 (* 4 i)) -1)", student: "(+ 0.12 (neg (* 0.16 i)))", expect: { grade: 100 } },
    { group: "Complex", name: "(3+4i)⁻¹ for 0.12 − 0.16i", ref: "(+ 0.12 (neg (* 0.16 i)))", student: "(^ (+ 3 (* 4 i)) -1)", expect: { grade: 100 } },
    { group: "Complex", name: "1/(3+4i) for 0.12 − 0.16i", ref: "(+ 0.12 (neg (* 0.16 i)))", student: "(/ 1 (+ 3 (* 4 i)))", expect: { grade: 100 } },
    { group: "Complex", name: "(3−4i)/25 for (3+4i)⁻¹", ref: "(^ (+ 3 (* 4 i)) -1)", student: "(/ (+ 3 (neg (* 4 i))) 25)", expect: { grade: 100 } },
    { group: "Complex", name: "0.12 + 0.16i for (3+4i)⁻¹: the imaginary part wrong", ref: "(^ (+ 3 (* 4 i)) -1)", student: "(+ 0.12 (* 0.16 i))", expect: { grade: 0 } },
    { group: "Complex", name: "−0.12 + 0.16i: a sign error", ref: "(+ 0.12 (neg (* 0.16 i)))", student: "(+ (neg 0.12) (* 0.16 i))", expect: { grade: 0, codes: ["sign-error"] } },
    { group: "Complex", name: "i² = −1", ref: "(neg 1)", student: "(^ i 2)", expect: { grade: 100 } },
    { group: "Complex", name: "(1+i)² = 2i", ref: "(* 2 i)", student: "(^ (+ 1 i) 2)", expect: { grade: 100 } },
    { group: "Complex", name: "√−4 = 2i", ref: "(* 2 i)", student: "sqrt((neg 4))", expect: { grade: 100 } },
    { group: "Complex", name: "√−4 alone (no i anywhere): not a real number", ref: "2", student: "sqrt((neg 4))", expect: { grade: 0 } },
    { group: "Complex", name: "x + i with a variable", ref: "(+ (* 2 x) (* 2 i))", student: "(* 2 (+ x i))", expect: { grade: 100 } },
    { group: "Complex", name: "noRootOfNegative error: √−4 for 2i", ref: "(* 2 i)", student: "sqrt((neg 4))", rules: { form: { noRootOfNegative: "error" } }, expect: { grade: 90, codes: ["root-of-negative"], feedbackIncludes: "with i" } },
    { group: "Complex", name: "noRootOfNegative note: √−4 for 2i", ref: "(* 2 i)", student: "sqrt((neg 4))", rules: { form: { noRootOfNegative: "note" } }, expect: { grade: 100, notes: ["root-of-negative"] } },
    { group: "Complex", name: "noRootOfNegative: 2i itself, nothing", ref: "sqrt((neg 4))", student: "(* 2 i)", rules: { form: { noRootOfNegative: "error" } }, expect: { grade: 100, codes: [] } },
    { group: "Complex", name: "noRootOfNegative: 3 + √−16 for 3 + 4i", ref: "(+ 3 (* 4 i))", student: "(+ 3 sqrt((neg 16)))", rules: { form: { noRootOfNegative: "error" } }, expect: { grade: 90, codes: ["root-of-negative"] } },
    { group: "Complex", name: "noRootOfNegative: (−4)^½ for 2i", ref: "(* 2 i)", student: "(^ (neg 4) (/ 1 2))", rules: { form: { noRootOfNegative: "error" } }, expect: { grade: 90, codes: ["root-of-negative"] } },
    { group: "Complex", name: "noRootOfNegative: √4 = 2 is not flagged", ref: "2", student: "sqrt(4)", rules: { form: { noRootOfNegative: "error" } }, expect: { grade: 100, codes: [] } },
    { group: "Complex", name: "noRootOfNegative: ∛−8 = −2 (an odd root) is not flagged", ref: "(neg 2)", student: "nthRoot<index=3 content=(neg 8)>", rules: { form: { noRootOfNegative: "error" } }, expect: { grade: 100, codes: [] } },
    { group: "Complex", name: "realDenominator note: (3+4i)⁻¹", ref: "(+ 0.12 (neg (* 0.16 i)))", student: "(^ (+ 3 (* 4 i)) -1)", rules: { form: { realDenominator: "note" } }, expect: { grade: 100, notes: ["complex-denominator"], feedbackIncludes: "without i in the denominator" } },
    { group: "Complex", name: "realDenominator error: 1/(3+4i)", ref: "(+ 0.12 (neg (* 0.16 i)))", student: "(/ 1 (+ 3 (* 4 i)))", rules: { form: { realDenominator: "error" } }, expect: { grade: 90, codes: ["complex-denominator"] } },
    { group: "Complex", name: "realDenominator: 0.12 − 0.16i itself, nothing", ref: "(^ (+ 3 (* 4 i)) -1)", student: "(+ 0.12 (neg (* 0.16 i)))", rules: { form: { realDenominator: "error" } }, expect: { grade: 100, codes: [] } },
    { group: "Complex", name: "realDenominator: a wrong value - no form check", ref: "(+ 0.12 (neg (* 0.16 i)))", student: "(^ (+ 3 (* 4 i)) -2)", rules: { form: { realDenominator: "error" } }, expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Units", name: "Hebrew: the unit is missing", ref: "2", refUnit: "km", student: "2", studentUnit: "", language: "he", expect: { grade: 70, feedbackIncludes: "חסרה יחידת המידה" } },
    { group: "Form difference", name: "exact: (x+2)(x+3) for x²+5x+6 - factored, expanded expected", ref: "(+ (^ x 2) (* 5 x) 6)", student: "(* (+ x 2) (+ x 3))", rules: { value: { mode: "exact" } }, expect: { grade: 90, codes: ["not-equivalent-form"], feedbackIncludes: "the answer is factored and the expanded form is expected" } },
    { group: "Form difference", name: "exact: x²+5x+6 for (x+2)(x+3) - expanded, factored expected", ref: "(* (+ x 2) (+ x 3))", student: "(+ (^ x 2) (* 5 x) 6)", rules: { value: { mode: "exact" } }, expect: { grade: 90, feedbackIncludes: "the answer is expanded and the factored form is expected" } },
    { group: "Form difference", name: "structural, distributive off: the same message", ref: "(* (+ x 2) (+ x 3))", student: "(+ (^ x 2) (* 5 x) 6)", rules: { value: { mode: "structural" }, equivalence: { distributive: false } }, expect: { grade: 90, feedbackIncludes: "the factored form is expected" } },
    { group: "Form difference", name: "exact: 1 + x for x + 1 - order", ref: "(+ x 1)", student: "(+ 1 x)", rules: { value: { mode: "exact" } }, expect: { grade: 90, feedbackIncludes: "another order" } },
    { group: "Form difference", name: "exact: x + x for 2x - like terms", ref: "(* 2 x)", student: "(+ x x)", rules: { value: { mode: "exact" } }, expect: { grade: 90, feedbackIncludes: "like terms" } },
    { group: "Form difference", name: "exact: −BA⃗ for AB⃗ - a reversed vector", ref: "vec(AB)", student: "(neg vec(BA))", rules: { value: { mode: "exact" } }, expect: { grade: 90, feedbackIncludes: "opposite direction" } },
    { group: "Form difference", name: "structural: sin²x + cos²x for 1 - no single difference", ref: "1", student: "(+ (^ sin(x) 2) (^ cos(x) 2))", rules: { value: { mode: "structural" } }, expect: { grade: 90, feedbackIncludes: "this form of the answer is not accepted" } },
    { group: "Form difference", name: "Hebrew", ref: "(+ (^ x 2) (* 5 x) 6)", student: "(* (+ x 2) (+ x 3))", rules: { value: { mode: "exact" } }, language: "he", expect: { feedbackIncludes: "מפורקת לגורמים" } },
    { group: "Missing named", name: "{1, 2} for {1, 2, 3}: 3 is missing", ref: "set{1, 2, 3}", student: "set{1, 2}", expect: { grade: 75, codes: ["missing-element"], feedbackIncludes: "The element \\(3\\) is missing." } },
    { group: "Missing named", name: "{1} for {1, 1/2, −3}: both named", ref: "set{1, (/ 1 2), (neg 3)}", student: "set{1}", expect: { grade: 50, codes: ["missing-element", "missing-element"], feedbackIncludes: "\\(\\frac{1}{2}\\) is missing" } },
    { group: "Missing named", name: "the second one named too", ref: "set{1, (/ 1 2), (neg 3)}", student: "set{1}", expect: { feedbackIncludes: "\\(-3\\) is missing" } },
    { group: "Missing named", name: "{0.5, 2} for {1/2, 2, 3}: 3, not 1/2", ref: "set{(/ 1 2), 2, 3}", student: "set{0.5, 2}", expect: { grade: 75, feedbackIncludes: "The element \\(3\\) is missing." } },
    { group: "Missing named", name: "Hebrew", ref: "set{1, 2, 3}", student: "set{1, 2}", language: "he", expect: { feedbackIncludes: "חסר האיבר" } },
    { group: "Missing named", name: "not named when nameMissing is false", ref: "set{1, 2, 3}", student: "set{1, 2}", rules: { feedback: { nameMissing: false } }, expect: { grade: 75, feedbackIncludes: "An element is missing." } },
    { group: "Missing named", name: "tuple (1, 2) for (1, 2, 3)", ref: "tuple[1, 2, 3]", student: "tuple[1, 2]", expect: { codes: ["missing-element"], feedbackIncludes: "The element \\(3\\) is missing." } },
    { group: "Missing named", name: "x = 2 alone for x = 2 ∨ x = 3: a solution missing (2026-10-23)", ref: "(or (equal x 2) (equal x 3))", student: "(or (equal x 2))", expect: { codes: ["missing-solution"], feedbackIncludes: "The solution \\(3\\) is missing." } },
    { group: "Missing named", name: "a part of an and/or statement that is not a solution set: named as a part", ref: "(or (less x 2) (greater x 3))", student: "(or (less x 2))", expect: { codes: ["missing-statement"], feedbackIncludes: "\\(x>3\\) is missing" } },
    { group: "Membership", name: "x ∈ {2,3} for x ∈ {2,3,5}: 5 missing", ref: "(memberOf x set{2, 3, 5})", student: "(memberOf x set{2, 3})", expect: { grade: 75, codes: ["missing-element"], feedbackIncludes: "The element \\(5\\) is missing." } },
    { group: "Membership", name: "x ∈ {5,3,2}: another order", ref: "(memberOf x set{2, 3, 5})", student: "(memberOf x set{5, 3, 2})", expect: { grade: 100 } },
    { group: "Membership", name: "x ∈ {2,3,5,7}: 7 extra", ref: "(memberOf x set{2, 3, 5})", student: "(memberOf x set{2, 3, 5, 7})", expect: { grade: 75, codes: ["extra-element"], feedbackIncludes: "\\(7\\) should not be there" } },
    { group: "Membership", name: "x ∈ {2,4}: 3, 5 missing, 4 extra", ref: "(memberOf x set{2, 3, 5})", student: "(memberOf x set{2, 4})", expect: { grade: 25, codes: ["extra-element", "missing-element", "missing-element"] } },
    { group: "Membership", name: "x ∈ {4/2, 3, 5}: 4/2 is 2", ref: "(memberOf x set{2, 3, 5})", student: "(memberOf x set{(/ 4 2), 3, 5})", expect: { grade: 100 } },
    { group: "Membership", name: "x ∉ {2,3,5} for x ∈ {2,3,5}", ref: "(memberOf x set{2, 3, 5})", student: "(notMemberOf x set{2, 3, 5})", expect: { grade: 50, codes: ["wrong-relation"] } },
    { group: "Membership", name: "y ∈ {2,3,5} for x ∈ {2,3,5}", ref: "(memberOf x set{2, 3, 5})", student: "(memberOf y set{2, 3, 5})", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Membership", name: "{2,3,5} for x ∈ {2,3,5}: answer type", ref: "(memberOf x set{2, 3, 5})", student: "set{2, 3, 5}", expect: { grade: 0, codes: ["answer-type"], feedbackIncludes: "a membership" } },
    { group: "Vectors", name: "CB + BA = CA for AB + BC = AC (all reversed)", ref: "(+ vec(AB) vec(BC)) ‖ vec(AC)", student: "(+ vec(CB) vec(BA)) ‖ vec(CA)", expect: { grade: 100 } },
    { group: "Vectors", name: "BC + AB = AC (order of the terms)", ref: "(+ vec(AB) vec(BC)) ‖ vec(AC)", student: "(+ vec(BC) vec(AB)) ‖ vec(AC)", expect: { grade: 100, equivalence: "commutative" } },
    { group: "Vectors", name: "AB − CB = AC (one reversed, with a minus)", ref: "(+ vec(AB) vec(BC)) ‖ vec(AC)", student: "(+ vec(AB) (neg vec(CB))) ‖ vec(AC)", expect: { grade: 100 } },
    { group: "Vectors", name: "AB + BC = CA: wrong direction", ref: "(+ vec(AB) vec(BC)) ‖ vec(AC)", student: "(+ vec(AB) vec(BC)) ‖ vec(CA)", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Vectors", name: "AB + CB = AC: one reversed without a minus", ref: "(+ vec(AB) vec(BC)) ‖ vec(AC)", student: "(+ vec(AB) vec(CB)) ‖ vec(AC)", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Vectors", name: "expression: −BA for AB", ref: "vec(AB)", student: "(neg vec(BA))", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Vectors", name: "expression: BA for AB", ref: "vec(AB)", student: "vec(BA)", expect: { grade: 0, codes: ["sign-error"] } },
    { group: "Vectors", name: "2u + 3v as 3v + 2u", ref: "(+ (* 2 vec(u)) (* 3 vec(v)))", student: "(+ (* 3 vec(v)) (* 2 vec(u)))", expect: { grade: 100, equivalence: "commutative" } },
    { group: "Vectors", name: "structural: CB + BA = CA", ref: "(+ vec(AB) vec(BC)) ‖ vec(AC)", student: "(+ vec(CB) vec(BA)) ‖ vec(CA)", rules: { value: { mode: "structural" } }, expect: { grade: 100, equivalence: "equationForms" } },
    { group: "Vectors", name: "structural, reversal not accepted", ref: "(+ vec(AB) vec(BC)) ‖ vec(AC)", student: "(+ vec(CB) vec(BA)) ‖ vec(CA)", rules: { value: { mode: "structural" }, equivalence: { vectorReversal: false } }, expect: { grade: 0 } },
    { group: "Function values", name: "sin(π/2) = 1", ref: "1", student: "sin((/ pi 2))", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "cos π = −1", ref: "(neg 1)", student: "cos(pi)", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "tan(π/4) = 1", ref: "1", student: "tan((/ pi 4))", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "sin(π/6) = 1/2", ref: "(/ 1 2)", student: "sin((/ pi 6))", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "sin(π/3) = √3/2", ref: "(/ sqrt(3) 2)", student: "sin((/ pi 3))", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "cos(π/4) = 1/√2", ref: "(/ 1 sqrt(2))", student: "cos((/ pi 4))", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "sin⁻¹1 = π/2", ref: "(/ pi 2)", student: "asin(1)", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "ln e = 1", ref: "1", student: "ln(e)", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "log 100 = 2", ref: "2", student: "log10(100)", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "log₂8 = 3", ref: "3", student: "log_2(8)", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "cosh 0 = 1, sinh 0 = 0", ref: "1", student: "(+ cosh(0) sinh(0))", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "x + sin(π/2) = x + 1", ref: "(+ x 1)", student: "(+ x sin((/ pi 2)))", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "sin 1 is not 1", ref: "1", student: "sin(1)", expect: { grade: 0 } },
    { group: "Function values", name: "structural: sin(π/2) = 1", ref: "1", student: "sin((/ pi 2))", rules: { value: { mode: "structural" } }, expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Function values", name: "structural: sin(π/3) = √3/2", ref: "(/ sqrt(3) 2)", student: "sin((/ pi 3))", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
    { group: "Function values", name: "structural: sin²(π/5) + cos²(π/5) = 1", ref: "1", student: "(+ (^ sin((/ pi 5)) 2) (^ cos((/ pi 5)) 2))", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
    { group: "Function values", name: "structural: sin 1 is not 1", ref: "1", student: "sin(1)", rules: { value: { mode: "structural" } }, expect: { grade: 0 } },
    { group: "Function values", name: "structural: numeric evaluation not accepted", ref: "1", student: "sin((/ pi 2))", rules: { value: { mode: "structural" }, equivalence: { numericEvaluation: false } }, expect: { grade: 90, codes: ["not-equivalent-form"] } },
    { group: "Derivatives", name: "(x³ sin x)′: product rule, factored reference", ref: "(* (^ x 2) (+ (* 3 sin(x)) (* x cos(x))))", student: "(+ (* 3 (^ x 2) sin(x)) (* (^ x 3) cos(x)))", expect: { grade: 100, equivalence: "distributive" } },
    { group: "Derivatives", name: "(sin x²)′: chain rule, factors in another order", ref: "(* cos((^ x 2)) 2 x)", student: "(* 2 x cos((^ x 2)))", expect: { grade: 100, equivalence: "commutative" } },
    { group: "Derivatives", name: "(sin x / x)′: quotient rule as two fractions", ref: "(/ (+ (* x cos(x)) (neg sin(x))) (^ x 2))", student: "(+ (/ cos(x) x) (neg (/ sin(x) (^ x 2))))", expect: { grade: 100 } },
    { group: "Derivatives", name: "(sin x²)′: inner derivative forgotten", ref: "(* 2 x cos((^ x 2)))", student: "cos((^ x 2))", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Derivatives", name: "(ln x)′ = x⁻¹ as 1/x", ref: "(^ x -1)", student: "(/ 1 x)", expect: { grade: 100, equivalence: "numberForms" } },
    { group: "Derivatives", name: "(asin x)′ = 1/√(1−x²)", ref: "(/ 1 sqrt((+ 1 (neg (^ x 2)))))", student: "(^ (+ 1 (neg (^ x 2))) (/ -1 2))", expect: { grade: 100 } },
    { group: "Equivalence", name: "sin²+cos² = 1: equal by value only", ref: "1", student: "(+ (^ sin(x) 2) (^ cos(x) 2))", expect: { grade: 100, equivalence: null } },
    { group: "Equivalence", name: "a note for an accepted difference", ref: "(+ x 1)", student: "(+ 1 x)", rules: { equivalence: { commutative: "note" } }, expect: { grade: 100, notes: ["note-commutative"] } },
    { group: "Equivalence", name: "structural mode, distributive not accepted", ref: "(* 2 (+ x 1))", student: "(+ (* 2 x) 2)", rules: { value: { mode: "structural" }, equivalence: { distributive: false } }, expect: { grade: 90, codes: ["not-equivalent-form"] } },
    { group: "Equivalence", name: "structural mode, distributive accepted", ref: "(* 2 (+ x 1))", student: "(+ (* 2 x) 2)", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
    { group: "Equivalence", name: "exact mode: another order is another form", ref: "(+ x 1)", student: "(+ 1 x)", rules: { value: { mode: "exact" } }, expect: { grade: 90, codes: ["not-equivalent-form"] } },
    { group: "Equivalence", name: "√(x²) is not x (sampled over negative x too)", ref: "x", student: "sqrt((^ x 2))", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Equivalence", name: "√(x²) = |x|", ref: "abs(x)", student: "sqrt((^ x 2))", expect: { grade: 100 } },
    { group: "Equivalence", name: "two variables", ref: "(* (+ a b) (+ a (neg b)))", student: "(+ (^ a 2) (neg (^ b 2)))", expect: { grade: 100, equivalence: "distributive" } },
    { group: "Equivalence", name: "log₂8 = 3", ref: "3", student: "log_2(8)", expect: { grade: 100 } },

    /* a wrong value: diagnosis, graded by the rubric */
    { group: "Wrong value", name: "plain wrong value", ref: "(+ x 1)", student: "(+ x 2)", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Wrong value", name: "sign error (graded as value when the rubric does not set it)", ref: "(+ x (neg 1))", student: "(+ 1 (neg x))", expect: { grade: 0, codes: ["sign-error"] } },
    { group: "Wrong value", name: "sign error with its own penalty", ref: "(+ x (neg 1))", student: "(+ 1 (neg x))", rubric: { categories: { value: 100, sign: 50 } }, expect: { grade: 50, codes: ["sign-error"] } },
    { group: "Wrong value", name: "missing factor", ref: "(* 2 x)", student: "x", rubric: { categories: { value: 100, factor: 40 } }, expect: { grade: 60, codes: ["missing-factor"] } },
    { group: "Wrong value", name: "power of 10", ref: "2.5", student: "25", expect: { grade: 0, codes: ["scale-error"] } },
    { group: "Wrong value", name: "missing term", ref: "(+ (^ x 2) x 1)", student: "(+ (^ x 2) 1)", rubric: { categories: { value: 100, term: 30 } }, expect: { grade: 70, codes: ["missing-term"] } },
    { group: "Wrong value", name: "extra term", ref: "(+ (^ x 2) 1)", student: "(+ (^ x 2) x 1)", rubric: { categories: { value: 100, term: 30 } }, expect: { grade: 70, codes: ["extra-term"] } },
    { group: "Wrong value", name: "close but rounded wrongly", ref: "2.5", student: "2.49", rules: { numbers: { closeButWrong: 1 } }, expect: { grade: 90, codes: ["rounding"] } },

    /* form - only when the value is right (decided 2026-10-21) */
    { group: "Form", name: "6/8 for 3/4: not reduced", ref: "(/ 3 4)", student: "(/ 6 8)", rules: FORM("reducedFractions"), expect: { grade: 90, codes: ["fraction-not-reduced"] } },
    { group: "Form", name: "6/10 for 3/4: wrong value, form not checked", ref: "(/ 3 4)", student: "(/ 6 10)", rules: FORM("reducedFractions"), expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Form", name: "3/4 reduced", ref: "(/ 3 4)", student: "(/ 3 4)", rules: FORM("reducedFractions"), expect: { grade: 100, codes: [] } },
    { group: "Form", name: "reduced: a note only", ref: "(/ 3 4)", student: "(/ 6 8)", rules: FORM("reducedFractions", "note"), expect: { grade: 100, notes: ["fraction-not-reduced"] } },
    { group: "Form", name: "x+x for 2x: not simplified", ref: "(* 2 x)", student: "(+ x x)", rules: FORM("simplified"), expect: { grade: 90, codes: ["not-simplified"] } },
    { group: "Form", name: "2+3 for 5: not simplified", ref: "5", student: "(+ 2 3)", rules: FORM("simplified"), expect: { grade: 90, codes: ["not-simplified"] } },
    { group: "Form", name: "2(x+1) when expanded is required", ref: "(+ (* 2 x) 2)", student: "(* 2 (+ x 1))", rules: FORM("expanded"), expect: { grade: 90, codes: ["not-expanded"] } },
    { group: "Form", name: "2x+2 when factored is required", ref: "(* 2 (+ x 1))", student: "(+ (* 2 x) 2)", rules: FORM("factored"), expect: { grade: 90, codes: ["not-factored"] } },
    { group: "Form", name: "2(2x+2): not fully factored", ref: "(* 4 (+ x 1))", student: "(* 2 (+ (* 2 x) 2))", rules: FORM("factored"), expect: { grade: 90, codes: ["not-fully-factored"] } },
    { group: "Form", name: "x⁻¹: negative exponent", ref: "(/ 1 x)", student: "(^ x -1)", rules: FORM("noNegativeExponents"), expect: { grade: 90, codes: ["negative-exponent"] } },
    { group: "Form", name: "1/√2: irrational denominator", ref: "(/ sqrt(2) 2)", student: "(/ 1 sqrt(2))", rules: FORM("rationalDenominator"), expect: { grade: 90, codes: ["irrational-denominator"] } },
    { group: "Form", name: "1.41421356237 for √2: not exact", ref: "sqrt(2)", student: "1.41421356237", rules: FORM("exactValue"), expect: { grade: 90, codes: ["not-exact"] } },
    { group: "Form", name: "two form errors, each counted", ref: "(* 2 x)", student: "(+ x (/ 2 2) x (neg 1))", rules: { form: { simplified: "error", reducedFractions: "error" } }, expect: { grade: 80, codes: ["not-simplified", "fraction-not-reduced"] } },

    /* numbers */
    { group: "Numbers", name: "1/3 to 2 decimals: 0.33", ref: "(/ 1 3)", student: "0.33", rules: { value: { tolerance: { decimals: 2 } }, numbers: { decimals: { exactly: 2 } } }, expect: { grade: 100 } },
    { group: "Numbers", name: "1/3 to 2 decimals: 0.333", ref: "(/ 1 3)", student: "0.333", rules: { value: { tolerance: { decimals: 2 } }, numbers: { decimals: { exactly: 2 } } }, expect: { grade: 90, codes: ["wrong-decimals"] } },

    /* equations and inequalities */
    { group: "Statements", name: "x = 2 as 2 = x", ref: "x ‖ 2", student: "2 ‖ x", expect: { grade: 100 } },
    { group: "Statements", name: "2x = 4 for x = 2 (scaled)", ref: "x ‖ 2", student: "(* 2 x) ‖ 4", expect: { grade: 100, notes: ["note-scaled-equation"] } },
    { group: "Statements", name: "2x = 4 when x must be isolated", ref: "x ‖ 2", student: "(* 2 x) ‖ 4", rules: { form: { isolatedVariable: "x" } }, expect: { grade: 90, codes: ["not-isolated"] } },
    { group: "Statements", name: "2x = 4 when scaling is not accepted", ref: "x ‖ 2", student: "(* 2 x) ‖ 4", rules: { statements: { scaleEquation: false } }, expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Statements", name: "x = 3 for x = 2", ref: "x ‖ 2", student: "x ‖ 3", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Statements", name: "x < 3 as 3 > x", ref: "(less x 3)", student: "(greater 3 x)", expect: { grade: 100 } },
    { group: "Statements", name: "−x > −3 for x < 3", ref: "(less x 3)", student: "(greater (neg x) (neg 3))", expect: { grade: 100 } },
    { group: "Statements", name: "x > 3 for x < 3: direction", ref: "(less x 3)", student: "(greater x 3)", expect: { grade: 50, codes: ["wrong-direction"] } },
    { group: "Statements", name: "x ≤ 3 for x < 3: relation", ref: "(less x 3)", student: "(lessEqual x 3)", expect: { grade: 50, codes: ["wrong-relation"] } },
    { group: "Statements", name: "3 < x < 5 as x < 5 ∧ x > 3", ref: "(and (less 3 x) (less x 5))", student: "(and (less x 5) (greater x 3))", expect: { grade: 100 } },
    { group: "Statements", name: "one condition wrong", ref: "(and (less 3 x) (less x 5))", student: "(and (less 3 x) (less x 7))", expect: { grade: 50, codes: ["missing-statement", "extra-statement"] } },
    { group: "Statements", name: "x = 2 ∨ x = 3 in another order", ref: "(or (equal x 2) (equal x 3))", student: "(or (equal x 3) (equal 2 x))", expect: { grade: 100 } },
    { group: "Equations", name: "y = 2(x+1) as y = 2x+2 (right side another form)", ref: "y ‖ (* 2 (+ x 1))", student: "y ‖ (+ (* 2 x) 2)", expect: { grade: 100, equivalence: "distributive" } },
    { group: "Equations", name: "y = (x+1)² as y = x²+2x+1", ref: "y ‖ (^ (+ x 1) 2)", student: "y ‖ (+ (^ x 2) (* 2 x) 1)", expect: { grade: 100, equivalence: "distributive" } },
    { group: "Equations", name: "y = 2x+2 as 2x+2 = y (sides swapped)", ref: "y ‖ (+ (* 2 x) 2)", student: "(+ (* 2 x) 2) ‖ y", expect: { grade: 100, equivalence: "commutative" } },
    { group: "Equations", name: "3 added to both sides", ref: "y ‖ (+ (* 2 x) 2)", student: "(+ y 3) ‖ (+ (* 2 x) 5)", expect: { grade: 100, equivalence: "equationForms" } },
    { group: "Equations", name: "both sides times 2", ref: "y ‖ (+ (* 2 x) 2)", student: "(* 2 y) ‖ (+ (* 4 x) 4)", expect: { grade: 100, equivalence: "equationForms", notes: ["note-scaled-equation"] } },
    { group: "Equations", name: "both sides times −1/2", ref: "y ‖ (+ (* 2 x) 2)", student: "(neg (/ y 2)) ‖ (+ (neg x) (neg 1))", expect: { grade: 100, equivalence: "equationForms" } },
    { group: "Equations", name: "terms moved: y − 2x = 2", ref: "y ‖ (+ (* 2 x) 2)", student: "(+ y (neg (* 2 x))) ‖ 2", expect: { grade: 100, equivalence: "equationForms" } },
    { group: "Equations", name: "y = 2x+3 for y = 2x+2", ref: "y ‖ (+ (* 2 x) 2)", student: "y ‖ (+ (* 2 x) 3)", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Equations", name: "times x is not equivalent", ref: "y ‖ (+ (* 2 x) 2)", student: "(* x y) ‖ (+ (* 2 (^ x 2)) (* 2 x))", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Equations", name: "structural: 3 added to both sides", ref: "y ‖ (+ (* 2 x) 2)", student: "(+ y 3) ‖ (+ (* 2 x) 5)", rules: { value: { mode: "structural" } }, expect: { grade: 100, equivalence: "equationForms" } },
    { group: "Equations", name: "structural: moving terms not accepted", ref: "y ‖ (+ (* 2 x) 2)", student: "(+ y 3) ‖ (+ (* 2 x) 5)", rules: { value: { mode: "structural" }, equivalence: { equationTransforms: false } }, expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Equations", name: "structural: scaling not accepted", ref: "y ‖ (+ (* 2 x) 2)", student: "(* 2 y) ‖ (+ (* 4 x) 4)", rules: { value: { mode: "structural" }, statements: { scaleEquation: false } }, expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Equations", name: "with a note when the law is set to note", ref: "y ‖ (+ (* 2 x) 2)", student: "(+ y 3) ‖ (+ (* 2 x) 5)", rules: { equivalence: { equationTransforms: "note" } }, expect: { grade: 100, notes: ["note-equationTransforms"] } },
    { group: "Equations", name: "y = 8/x as xy = 8 (same solutions)", ref: "(* x y) ‖ 8", student: "y ‖ (/ 8 x)", expect: { grade: 100, equivalence: "sameSolutions" } },
    { group: "Equations", name: "xy = 8 as y = 8/x (same solutions)", ref: "y ‖ (/ 8 x)", student: "(* x y) ‖ 8", expect: { grade: 100, equivalence: "sameSolutions" } },
    { group: "Equations", name: "x = 8/y as xy = 8", ref: "(* x y) ‖ 8", student: "x ‖ (/ 8 y)", expect: { grade: 100, equivalence: "sameSolutions" } },
    { group: "Equations", name: "same solutions with a note", ref: "(* x y) ‖ 8", student: "y ‖ (/ 8 x)", rules: { statements: { sameSolutions: "note" } }, expect: { grade: 100, notes: ["note-same-solutions"] } },
    { group: "Equations", name: "same solutions not accepted", ref: "(* x y) ‖ 8", student: "y ‖ (/ 8 x)", rules: { statements: { sameSolutions: false } }, expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Equations", name: "y = 8x for xy = 8", ref: "(* x y) ‖ 8", student: "y ‖ (* 8 x)", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Equations", name: "x = 2 for x² = 4 (a solution lost)", ref: "(^ x 2) ‖ 4", student: "x ‖ 2", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Equations", name: "x = 4 for x² = 4x (x = 0 lost)", ref: "(^ x 2) ‖ (* 4 x)", student: "x ‖ 4", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Equations", name: "y = 1 for (x−1)y = x−1 (x = 1 lost)", ref: "(* (+ x (neg 1)) y) ‖ (+ x (neg 1))", student: "y ‖ 1", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Equations", name: "√y = x for y = x² (x < 0 lost)", ref: "y ‖ (^ x 2)", student: "sqrt(y) ‖ x", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Domain", name: "x = sin y for y = sin⁻¹x, no domain given", ref: "y ‖ asin(x)", student: "x ‖ sin(y)", expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Domain", name: "x = sin y for y = sin⁻¹x, −π/2 ≤ y ≤ π/2: partial", ref: "y ‖ asin(x)", student: "x ‖ sin(y)", rules: { statements: { domain: { y: { min: "-pi/2", max: "pi/2" } } } }, expect: { grade: 70, codes: ["domain-only"] } },
    { group: "Domain", name: "the other way: y = sin⁻¹x for x = sin y", ref: "x ‖ sin(y)", student: "y ‖ asin(x)", rules: { statements: { domain: { y: { min: "-pi/2", max: "pi/2" } } } }, expect: { grade: 70, codes: ["domain-only"] } },
    { group: "Domain", name: "y = sin⁻¹x + 1: wrong also in the domain", ref: "y ‖ asin(x)", student: "(+ y (neg 1)) ‖ asin(x)", rules: { statements: { domain: { y: { min: "-pi/2", max: "pi/2" } } } }, expect: { grade: 0, codes: ["wrong-value"] } },
    { group: "Domain", name: "y = sin⁻¹x itself, domain given: full", ref: "y ‖ asin(x)", student: "y ‖ asin(x)", rules: { statements: { domain: { y: { min: "-pi/2", max: "pi/2" } } } }, expect: { grade: 100 } },
    { group: "Domain", name: "x = √y for x² = y, x ≥ 0", ref: "(^ x 2) ‖ y", student: "x ‖ sqrt(y)", rules: { statements: { domain: { x: { min: 0 } } } }, expect: { grade: 70, codes: ["domain-only"] } },
    { group: "Domain", name: "x = 2 for x² = 4, x ≥ 0, rubric domain 50", ref: "(^ x 2) ‖ 4", student: "x ‖ 2", rules: { statements: { domain: { x: { min: 0 } } } }, rubric: { categories: { value: { mode: "once", points: 100 }, domain: { mode: "once", points: 50 } } }, expect: { grade: 50, codes: ["domain-only"] } },
    { group: "Equations", name: "x < 3 as 2x − 6 < 0", ref: "(less x 3)", student: "(less (+ (* 2 x) (neg 6)) 0)", expect: { grade: 100, equivalence: "equationForms" } },
    { group: "Statements", name: "an equation answered with an expression", ref: "x ‖ 2", student: "2", expect: { grade: 0, codes: ["answer-type"] } },

    /* sets and tuples */
    { group: "Collections", name: "set in another order", ref: "set{1, 2, 3}", student: "set{3, 1, 2}", expect: { grade: 100 } },
    { group: "Collections", name: "set: element by value", ref: "set{0.5, 2}", student: "set{2, (/ 1 2)}", expect: { grade: 100 } },
    { group: "Collections", name: "set: missing element", ref: "set{1, 2, 3}", student: "set{1, 2}", expect: { grade: 75, codes: ["missing-element"] } },
    { group: "Collections", name: "set: extra element", ref: "set{1, 2, 3}", student: "set{1, 2, 3, 4}", expect: { grade: 75, codes: ["extra-element"] } },
    { group: "Collections", name: "set: duplicate is a note", ref: "set{1, 2, 3}", student: "set{1, 2, 2, 3}", expect: { grade: 100, notes: ["duplicate-note"] } },
    { group: "Collections", name: "set: three missing, capped", ref: "set{1, 2, 3, 4}", student: "set{1}", rubric: { categories: { value: 100, elements: { mode: "each", points: 25, max: 50 } } }, expect: { grade: 50, codes: ["missing-element", "missing-element", "missing-element"] } },
    { group: "Collections", name: "tuple in order", ref: "tuple[1, 2]", student: "tuple[(/ 2 2), 2]", expect: { grade: 100 } },
    { group: "Collections", name: "tuple: wrong order", ref: "tuple[1, 2]", student: "tuple[2, 1]", expect: { grade: 75, codes: ["wrong-order"] } },

    /* ± */
    { group: "Plus-minus", name: "1 ± 2 = 1 ∓ 2", ref: "(plusMinus 1 2)", student: "(minusPlus 1 2)", expect: { grade: 100 } },
    { group: "Plus-minus", name: "x + 1 for x ± 1: one of the two values (partial, 2026-10-23)", ref: "(plusMinus x 1)", student: "(+ x 1)", expect: { grade: 50, codes: ["missing-plus-minus"] } },
    { group: "Plus-minus", name: "x + 1 for x ± 1, oneValue wrong: 0", ref: "(plusMinus x 1)", student: "(+ x 1)", rules: { plusMinus: { oneValue: "wrong" } }, expect: { grade: 0 } },

    /* chains */
    { group: "Chains", name: "an expression answered as steps: the last is graded", ref: "(* 2 x)", student: "(+ x x) ‖ (* 2 x)", expect: { grade: 100, notes: ["note-last-step"] } },
    { group: "Chains", name: "all steps: a wrong middle step", ref: "(^ (+ x 1) 2) ‖ (+ (^ x 2) (* 2 x) 1)", student: "(^ (+ x 1) 2) ‖ (+ (^ x 2) 1) ‖ (+ (^ x 2) (* 2 x) 1)", rules: { answerKind: "derivation", statements: { derivation: "allSteps" } }, expect: { grade: 80, codes: ["wrong-step"] } },

    /* completeness and kind */
    { group: "Completeness", name: "an empty place", ref: "(+ x 1)", student: "(+ x ?)", expect: { grade: 0, codes: ["incomplete"] } },
    { group: "Completeness", name: "no answer", ref: "(+ x 1)", student: "∅", expect: { grade: 0, codes: ["incomplete"] } },

    /* teacher-defined mistakes and several references */
    { group: "Mistakes", name: "a teacher mistake with points", ref: "(* 2 x)", student: "(^ x 2)", rules: { mistakes: [{ answer: "(^ x 2)", message: { en: "The derivative of x² is 2x, not x²." }, points: 30 }] }, expect: { grade: 30, codes: ["teacher-mistake"], feedbackIncludes: "not x²" } },
    { group: "Mistakes", name: "a teacher mistake matched by value", ref: "(* 2 x)", student: "(* x x)", rules: { mistakes: [{ answer: "(^ x 2)", message: { en: "x² again" } }] }, expect: { grade: 0, codes: ["teacher-mistake"] } },
    { group: "Mistakes", name: "several references: the best counts", refs: ["(+ x 1)", "(* 2 x)"], student: "(* x 2)", expect: { grade: 100, reference: 1 } },

    /* rubric and feedback */
    { group: "Rubric", name: "a category set to none: shown, not graded", ref: "(/ 3 4)", student: "(/ 6 8)", rules: FORM("reducedFractions"), rubric: { categories: { value: 100, form: { mode: "none" } } }, expect: { grade: 100, codes: ["fraction-not-reduced"] } },
    { group: "Rubric", name: "Hebrew feedback", ref: "(/ 3 4)", student: "(/ 6 8)", rules: FORM("reducedFractions"), language: "he", expect: { grade: 90, feedbackIncludes: "אפשר לצמצם" } },
    { group: "Rubric", name: "Arabic feedback", ref: "(+ x 1)", student: "(+ x 2)", language: "ar", expect: { grade: 0, feedbackIncludes: "قيمة الإجابة" } }
];

/* the examples of the help (mathCheckHelp.js) are tests too: the help must say what the library does */
(function addHelpExamples() {
    let help = global.MathCheckHelp;
    if (!help && typeof module === "object" && module.exports) {
        try { help = require("./mathCheckHelp.js"); } catch (e) { help = null; }
    }
    if (!help) return;
    help.sections.forEach(function (section) {
        section.items.forEach(function (item) {
            (item.examples || []).forEach(function (ex) {
                CASES.push({ group: "Help: " + item.id, name: ex.caption, ref: ex.ref, student: ex.student,
                    refUnit: ex.refUnit, studentUnit: ex.studentUnit,
                    rules: ex.rules, rubric: ex.rubric, language: ex.language, expect: ex.expect });
            });
        });
    });
})();

/* end-to-end: typed with the real keyboard (browser only) */
const E2E = [
    { name: "2(x+1) typed, 2x+2 typed", refKeys: "2 ( x + 1", studentKeys: "2 x + 2", expect: { grade: 100, equivalence: "distributive" } },
    { name: "sin⁻¹ x typed, π/2 − cos⁻¹ x typed", refKeys: "asin x", studentKeys: "π / 2 → - acos x", expect: { grade: 100 } },
    { name: "CB⃗ + BA⃗ = CA⃗ typed for AB⃗ + BC⃗ = AC⃗", refKeys: "vec A B → + vec B C → = vec A C", studentKeys: "vec C B → + vec B A → = vec C A", expect: { grade: 100 } },
    { name: "x ∈ {2, 3} typed for x ∈ {2, 3, 5}", refKeys: "x ∈ { 2 , 3 , 5", studentKeys: "x ∈ { 2 , 3", expect: { grade: 75, codes: ["missing-element"], feedbackIncludes: "The element \\(5\\) is missing." } },
    { name: "0.12 − 0.16i typed for (3+4i)⁻¹ typed", refKeys: "( 3 + 4 ⅈ → ^ - 1", studentKeys: "0 . 1 2 - 0 . 1 6 ⅈ", expect: { grade: 100 } },
    { name: "(3+4i)⁻¹ typed, a complex denominator noted", refKeys: "0 . 1 2 - 0 . 1 6 ⅈ", studentKeys: "( 3 + 4 ⅈ → ^ - 1", rules: { form: { realDenominator: "note" } }, expect: { grade: 100, notes: ["complex-denominator"] } },
    { name: "√−4 typed for 2i typed, the 2i form required", refKeys: "2 ⅈ", studentKeys: "√ - 4", rules: { form: { noRootOfNegative: "error" } }, expect: { grade: 90, codes: ["root-of-negative"] } },
    { name: "7 typed for ±7 typed: one value", refKeys: "± 7", studentKeys: "7", expect: { grade: 50, codes: ["missing-plus-minus"] } },
    { name: "2 ± 4 typed for 2 ± 3 typed", refKeys: "2 ± 3", studentKeys: "2 ± 4", expect: { grade: 50, codes: ["pm-second-wrong"] } },
    { name: "x = 1, 5 typed for x = 3 ± 2 typed: a list, noted", refKeys: "x = 3 ± 2", studentKeys: "x = 1 , 5", expect: { grade: 100, notes: ["solution-list"] } },
    { name: "x ∈ {1, 5} typed for x = 3 ± 2 typed", refKeys: "x = 3 ± 2", studentKeys: "x ∈ { 1 , 5", expect: { grade: 100 } },
    { name: "x ≠ 1, 5 typed for x ∉ {1, 5} typed: a list, noted", refKeys: "x ∉ { 1 , 5", studentKeys: "x ≠ 1 , 5", expect: { grade: 100, notes: ["exclusion-list"] } },
    { name: "x ≠ 2, x ≠ 8 typed for x ∉ {2, 8} typed", refKeys: "x ∉ { 2 , 8", studentKeys: "x ≠ 2 , x ≠ 8", expect: { grade: 100, notes: ["exclusion-list"] } },
    { name: "x ≠ 1 typed for x ∉ {1, 5} typed: 5 should be excluded too", refKeys: "x ∉ { 1 , 5", studentKeys: "x ≠ 1", expect: { grade: 75, codes: ["missing-excluded"] } },
    { name: "sin(π/2) typed for 1", refKeys: "1", studentKeys: "sin π / 2", expect: { grade: 100, equivalence: "numberForms" } },
    { name: "d/dx sin x² typed back for 2x cos x²", refKeys: "2 x cos x ^2", studentKeys: "d/dx x → sin x ^2", expect: { grade: 0, codes: ["not-evaluated"] } },
    { name: "x y = 8 typed, y = 8/x typed", refKeys: "x y = 8", studentKeys: "y = 8 / x", expect: { grade: 100, equivalence: "sameSolutions" } },
    { name: "y = 2(x+1) typed, y + 3 = 2x + 5 typed", refKeys: "y = 2 ( x + 1", studentKeys: "y + 3 = 2 x + 5", expect: { grade: 100, equivalence: "equationForms" } },
    { name: "(x+1)² typed, x²+2x+1 typed", refKeys: "( x + 1 → ^2", studentKeys: "x ^2 + 2 x + 1", expect: { grade: 100 } },
    { name: "1/2 typed, 0.5 typed", refKeys: "1 / 2", studentKeys: "0 . 5", expect: { grade: 100 } },
    { name: "x = 2 typed, 2 = x typed", refKeys: "x = 2", studentKeys: "2 = x", expect: { grade: 100 } },
    { name: "{1, 2} typed, {2, 1} typed", refKeys: "{ 1 , 2", studentKeys: "{ 2 , 1", expect: { grade: 100 } },
    { name: "3 < x < 5 typed, x < 5 typed", refKeys: "3 < x < 5", studentKeys: "x < 5", expect: { grade: 0, codes: ["answer-type"] } },
    { name: "6/8 typed for 3/4, reduced required", refKeys: "3 / 4", studentKeys: "6 / 8", rules: FORM("reducedFractions"), expect: { grade: 90, codes: ["fraction-not-reduced"] } },
    { name: "√x typed with positive x, x^0.5 typed", refKeys: "√ x", studentKeys: "x ^ 0 . 5", rules: { value: { variables: { x: { positive: true } } } }, expect: { grade: 100 } }
];

/* ---------------- running ---------------- */
function check(result, expect) {
    const problems = [];
    const codes = result.items.filter(function (it) { return it.kind === "error"; }).map(function (it) { return it.code; }).sort();
    const notes = result.items.filter(function (it) { return it.kind === "note"; }).map(function (it) { return it.code; }).sort();
    if (expect.grade !== undefined && result.grade !== expect.grade) problems.push("grade " + result.grade + ", expected " + expect.grade);
    if (expect.codes && JSON.stringify(codes) !== JSON.stringify(expect.codes.slice().sort())) problems.push("codes [" + codes + "], expected [" + expect.codes + "]");
    if (expect.notes && expect.notes.some(function (n) { return notes.indexOf(n) < 0; })) problems.push("notes [" + notes + "], expected [" + expect.notes + "]");
    if (expect.equivalence !== undefined && result.matched.equivalence !== expect.equivalence) problems.push("equivalence " + result.matched.equivalence + ", expected " + expect.equivalence);
    if (expect.reference !== undefined && result.matched.reference !== expect.reference) problems.push("reference " + result.matched.reference + ", expected " + expect.reference);
    if (expect.feedbackIncludes && result.feedback.indexOf(expect.feedbackIncludes) < 0) problems.push("feedback lacks: " + expect.feedbackIncludes);
    return problems;
}

function prepareRules(rules) {
    if (!rules || !rules.mistakes) return rules;
    const copy = JSON.parse(JSON.stringify(rules));
    copy.mistakes.forEach(function (m) { if (typeof m.answer === "string" && m.answer.charAt(0) !== "{") m.answer = parse(m.answer); });
    return copy;
}

function run(MathCheck) {
    return CASES.map(function (c) {
        const out = { testCase: c, pass: false, problems: [], result: null, error: null };
        try {
            let ref = c.refs ? c.refs.map(parse) : parse(c.ref);
            let stu = parse(c.student === "∅" ? null : c.student) || { type: "chain", elements: [] };
            /* an answer with a unit: { answer, unit } (studentUnit "" = the student chose none) */
            if (c.refUnit !== undefined) ref = { answer: ref, unit: c.refUnit };
            if (c.studentUnit !== undefined) stu = { answer: stu, unit: c.studentUnit || null };
            out.result = MathCheck.compare(stu, ref,
                prepareRules(c.rules), c.rubric, { language: c.language || "en", logicNotation: c.logicNotation });
            out.problems = check(out.result, c.expect);
            out.pass = out.problems.length === 0;
        } catch (e) {
            out.error = e.message + (e.stack ? "\n" + e.stack.split("\n").slice(1, 3).join("\n") : "");
        }
        return out;
    });
}

/* the keyboard's own AST from typed keys (browser): KbdTests.pressKey */
function typed(Keyboard, KbdTests, host, keys) {
    const div = document.createElement("div");
    div.id = "mcE2E" + Math.random().toString(36).slice(2);
    host.appendChild(div);
    const k = new Keyboard({ divId: div.id, physicalKeyboard: false, variables: KbdTests.variables });
    keys.split(/\s+/).filter(Boolean).forEach(function (key) { KbdTests.pressKey(k, key); });
    const ast = k.getAST();
    if (k.destroy) k.destroy();
    host.removeChild(div);
    return ast;
}

function runE2E(MathCheck, Keyboard, KbdTests, host) {
    return E2E.map(function (c) {
        const out = { testCase: c, pass: false, problems: [], result: null, error: null };
        try {
            out.result = MathCheck.compare(typed(Keyboard, KbdTests, host, c.studentKeys), typed(Keyboard, KbdTests, host, c.refKeys),
                c.rules, c.rubric, { language: "en" });
            out.problems = check(out.result, c.expect);
            out.pass = out.problems.length === 0;
        } catch (e) {
            out.error = e.message;
        }
        return out;
    });
}

const api = { cases: CASES, e2e: E2E, parse: parse, run: run, runE2E: runE2E, check: check };

if (typeof module === "object" && module.exports) {
    module.exports = api;
    /* node mathCheckTests.js */
    if (require.main === module) {
        const MathCheck = require("./mathCheck.js");
        const results = run(MathCheck);
        let failed = 0;
        let group = "";
        results.forEach(function (r) {
            if (r.testCase.group !== group) { group = r.testCase.group; console.log("\n" + group); }
            if (r.pass) console.log("  ok    " + r.testCase.name);
            else {
                failed += 1;
                console.log("  FAIL  " + r.testCase.name + "\n        " + (r.error || r.problems.join("; ")));
                if (r.result) console.log("        feedback: " + r.result.feedback.replace(/\n/g, " | "));
            }
        });
        console.log("\nmathCheck " + MathCheck.version + ": " + (results.length - failed) + " passed, " + failed + " failed of " + results.length);
        process.exitCode = failed ? 1 : 0;
    }
} else {
    global.MathCheckTests = api;
}
})(typeof window !== "undefined" ? window : this);
