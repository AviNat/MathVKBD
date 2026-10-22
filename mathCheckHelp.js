/*
 * mathCheck - help for the comparison rules and the rubric (data only; not part of the library).
 *
 * One entry per rule / rubric element, keyed by its path in the rules or rubric object ("equivalence.vectorReversal",
 * "rubric.categories.domain"). Used by:
 *   - mathCheckHelp.html: the help document (every entry, its examples computed live with MathCheck.compare);
 *   - the playground / builder: help for one element, by its id (MathCheckHelp.byId["value.mode"]);
 *   - mathCheckTests.js: every example is also a test - "expect" must be what the library gives.
 *
 * Texts: { en, he, ar } - English first; a missing language falls back to English.
 * Examples are in the compact notation of mathCheckTests.js:
 *   (+ x 1)  (* 2 x)  (/ 1 2)  (^ x 2)  (neg x)  sin(x)  sqrt(x)   x ‖ 2  (an equation)   (less x 3)   set{1, 2}
 *   tuple[1, 2]   (or (equal x 2) (equal x 3))   (memberOf x set{2, 3})   vec(AB)  (the vector from A to B)
 * An example's rules / rubric are only what differs from the defaults.
 */
(function (global) {
"use strict";

const SECTIONS = [
{
    id: "answer", title: { en: "The answer" },
    items: [
        {
            id: "answerKind", path: "rules.answerKind", values: "auto | expression | equation | inequality | statement | set | membership | tuple | list | derivation",
            text: { en: "What kind of answer is expected. \"auto\" takes the kind of the reference answer. An answer of another kind gets 0 (the fatal error \"answer type\"), with feedback saying what was expected." },
            examples: [
                { caption: "An expression for an equation", ref: "x ‖ 2", student: "2", expect: { grade: 0, codes: ["answer-type"] } },
                { caption: "An expression answered as a chain: the last step is graded", ref: "(+ (* 2 x) 2)", student: "(* 2 (+ x 1)) ‖ (+ (* 2 x) 2)", expect: { grade: 100 } }
            ]
        },
        {
            id: "acceptKinds", path: "rules.acceptKinds", values: "a list of kinds, e.g. [\"tuple\"]",
            text: { en: "Other kinds accepted besides answerKind, without the \"answer type\" error. Rarely needed: the answer is still compared with the reference." }
        }
    ]
},
{
    id: "value", title: { en: "The value - is the answer mathematically equal?" },
    items: [
        {
            id: "value.mode", path: "rules.value.mode", values: "numeric (default) | structural | exact",
            text: { en: "numeric: the two answers are computed at random points; equal values everywhere = the same answer (any correct form is accepted). structural: the two are rewritten in a standard form with the accepted equivalence laws and must then be identical - a law that is not accepted makes a form unacceptable. exact: the answer must be written exactly as the reference." },
            examples: [
                { caption: "numeric: any correct form", ref: "1", student: "(+ (^ sin(x) 2) (^ cos(x) 2))", expect: { grade: 100 } },
                { caption: "structural: no law turns sin²x + cos²x into 1 - the value is right, the form is not accepted", ref: "1", student: "(+ (^ sin(x) 2) (^ cos(x) 2))", rules: { value: { mode: "structural" } }, expect: { grade: 90, codes: ["not-equivalent-form"] } },
                { caption: "exact: 1 + x is not written as x + 1 - the feedback says what differs", ref: "(+ x 1)", student: "(+ 1 x)", rules: { value: { mode: "exact" } }, expect: { grade: 90, codes: ["not-equivalent-form"] } },
                { caption: "exact: (x + 2)(x + 3) for x² + 5x + 6", ref: "(+ (^ x 2) (* 5 x) 6)", student: "(* (+ x 2) (+ x 3))", rules: { value: { mode: "exact" } }, expect: { grade: 90, codes: ["not-equivalent-form"] } }
            ]
        },
        {
            id: "value.samples", path: "rules.value.samples", values: "a number, at least 3 (default 8)",
            text: { en: "How many random points the numeric comparison uses. The points are the same every time for the same reference answer, so a grade never changes between attempts." }
        },
        {
            id: "value.tolerance", path: "rules.value.tolerance", values: "{ relative, absolute } (default 1e-9, 1e-12) | { decimals: n }",
            text: { en: "How close two values must be to count as equal. { decimals: 2 }: equal after rounding to 2 decimal places - for numeric answers that may be rounded." },
            examples: [
                { caption: "3.14 for π, default tolerance", ref: "pi", student: "3.14", expect: { grade: 0 } },
                { caption: "3.14 for π, to 2 decimals", ref: "pi", student: "3.14", rules: { value: { tolerance: { decimals: 2 } } }, expect: { grade: 100 } }
            ]
        },
        {
            id: "value.domain", path: "rules.value.domain", values: "{ min, max } (default -4 .. 4)",
            text: { en: "The range the random values of every variable are taken from. Narrow it when the answers are equal only there (√(x²) = x only for x ≥ 0)." },
            examples: [
                { caption: "x for √(x²), the default range", ref: "sqrt((^ x 2))", student: "x", expect: { grade: 0 } },
                { caption: "x for √(x²), the range 0 .. 4", ref: "sqrt((^ x 2))", student: "x", rules: { value: { domain: { min: 0, max: 4 } } }, expect: { grade: 100 } }
            ]
        },
        {
            id: "value.variables", path: "rules.value.variables", values: "{ x: { min, max, positive, nonzero, integer } }",
            text: { en: "The range of one variable (instead of value.domain): positive, nonzero, integer, or min / max. The answers are compared only there - a condition that is part of the question (\"for x > 0\")." },
            examples: [
                { caption: "x for √(x²), x positive", ref: "sqrt((^ x 2))", student: "x", rules: { value: { variables: { x: { positive: true } } } }, expect: { grade: 100 } }
            ]
        }
    ]
},
{
    id: "equivalence", title: { en: "Equivalence laws - differences of form accepted as the same answer" },
    intro: { en: "Each law: accept (true), accept with a note (\"note\"), or not accepted (false). The laws decide in structural mode: a difference that needs a law that is not accepted gets \"value right, form not accepted\". In numeric mode the value decides; the law only names the difference (and adds its note)." },
    items: [
        {
            id: "equivalence.commutative", path: "rules.equivalence.commutative", values: "true | \"note\" | false",
            text: { en: "The order of terms and factors: x + 1 = 1 + x, 2x = x·2. Also the sides of an equation: x = 2 is 2 = x." },
            examples: [
                { caption: "1 + x for x + 1", ref: "(+ x 1)", student: "(+ 1 x)", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
                { caption: "not accepted", ref: "(+ x 1)", student: "(+ 1 x)", rules: { value: { mode: "structural" }, equivalence: { commutative: false } }, expect: { grade: 90, codes: ["not-equivalent-form"] } }
            ]
        },
        {
            id: "equivalence.numericEvaluation", path: "rules.equivalence.numericEvaluation", values: "true | \"note\" | false",
            text: { en: "Computations with numbers: 2 + 3 = 5, 2·3 = 6, 2³ = 8, and exact function values: sin(π/2) = 1, ln e = 1, log₂8 = 3, sin(π/3) = √3/2." },
            examples: [
                { caption: "2 + 3 for 5", ref: "5", student: "(+ 2 3)", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
                { caption: "sin(π/2) for 1", ref: "1", student: "sin((/ pi 2))", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
                { caption: "not accepted", ref: "5", student: "(+ 2 3)", rules: { value: { mode: "structural" }, equivalence: { numericEvaluation: false } }, expect: { grade: 90, codes: ["not-equivalent-form"] } }
            ]
        },
        {
            id: "equivalence.decimalFraction", path: "rules.equivalence.decimalFraction", values: "true | \"note\" | false",
            text: { en: "A decimal number and its fraction: 0.5 = 1/2, 0.25x = x/4." },
            examples: [
                { caption: "0.5 for 1/2", ref: "(/ 1 2)", student: "0.5", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
                { caption: "not accepted", ref: "(/ 1 2)", student: "0.5", rules: { value: { mode: "structural" }, equivalence: { decimalFraction: false } }, expect: { grade: 90, codes: ["not-equivalent-form"] } }
            ]
        },
        {
            id: "equivalence.signPlacement", path: "rules.equivalence.signPlacement", values: "true | \"note\" | false",
            text: { en: "Where the minus sign is written: −a/b = a/(−b) = (−a)/b, −(−x) = x." },
            examples: [
                { caption: "a/(−b) for −a/b", ref: "(neg (/ a b))", student: "(/ a (neg b))", rules: { value: { mode: "structural" } }, expect: { grade: 100 } }
            ]
        },
        {
            id: "equivalence.fractionForms", path: "rules.equivalence.fractionForms", values: "true | \"note\" | false",
            text: { en: "Forms of a fraction: x/2 = ½x, a/b = a·b⁻¹." },
            examples: [
                { caption: "½x for x/2", ref: "(/ x 2)", student: "(* (/ 1 2) x)", rules: { value: { mode: "structural" } }, expect: { grade: 100 } }
            ]
        },
        {
            id: "equivalence.powerForms", path: "rules.equivalence.powerForms", values: "true | \"note\" | false",
            text: { en: "Forms of a power or a root: √x = x^½, ∛x = x^⅓, (x²)³ = x⁶." },
            examples: [
                { caption: "x^0.5 for √x (x positive)", ref: "sqrt(x)", student: "(^ x 0.5)", rules: { value: { mode: "structural", variables: { x: { positive: true } } } }, expect: { grade: 100 } }
            ]
        },
        {
            id: "equivalence.vectorReversal", path: "rules.equivalence.vectorReversal", values: "true | \"note\" | false",
            text: { en: "A vector in the opposite direction with a minus sign: BA⃗ = −AB⃗. So CB⃗ + BA⃗ = CA⃗ is the equation AB⃗ + BC⃗ = AC⃗ multiplied by −1. By value (numeric mode) this always holds." },
            examples: [
                { caption: "CB⃗ + BA⃗ = CA⃗ for AB⃗ + BC⃗ = AC⃗", ref: "(+ vec(AB) vec(BC)) ‖ vec(AC)", student: "(+ vec(CB) vec(BA)) ‖ vec(CA)", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
                { caption: "−BA⃗ for AB⃗", ref: "vec(AB)", student: "(neg vec(BA))", expect: { grade: 100 } },
                { caption: "BA⃗ for AB⃗: a sign error", ref: "vec(AB)", student: "vec(BA)", expect: { grade: 0, codes: ["sign-error"] } }
            ]
        },
        {
            id: "equivalence.likeTerms", path: "rules.equivalence.likeTerms", values: "true | \"note\" | false",
            text: { en: "Like terms and like factors combined or not: x + x = 2x, x·x = x², 3x − x = 2x." },
            examples: [
                { caption: "x + x for 2x", ref: "(* 2 x)", student: "(+ x x)", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
                { caption: "accepted with a note", ref: "(* 2 x)", student: "(+ x x)", rules: { equivalence: { likeTerms: "note" } }, expect: { grade: 100 } }
            ]
        },
        {
            id: "equivalence.distributive", path: "rules.equivalence.distributive", values: "true | \"note\" | false",
            text: { en: "Expanded or factored: 2(x + 1) = 2x + 2, (x + 1)² = x² + 2x + 1. To require one of the forms, add the form check \"expanded\" or \"factored\"." },
            examples: [
                { caption: "2x + 2 for 2(x + 1)", ref: "(* 2 (+ x 1))", student: "(+ (* 2 x) 2)", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
                { caption: "not accepted", ref: "(* 2 (+ x 1))", student: "(+ (* 2 x) 2)", rules: { value: { mode: "structural" }, equivalence: { distributive: false } }, expect: { grade: 90, codes: ["not-equivalent-form"] } }
            ]
        },
        {
            id: "equivalence.equationTransforms", path: "rules.equivalence.equationTransforms", values: "true | \"note\" | false",
            text: { en: "An equation or relation transformed: terms moved between the sides, the same number added to both sides (y + 3 = 2x + 5 is y = 2x + 2), both sides multiplied by a number (statements.scaleEquation)." },
            examples: [
                { caption: "y + 3 = 2x + 5 for y = 2x + 2", ref: "y ‖ (+ (* 2 x) 2)", student: "(+ y 3) ‖ (+ (* 2 x) 5)", rules: { value: { mode: "structural" } }, expect: { grade: 100 } },
                { caption: "y − 2x = 2 for y = 2x + 2", ref: "y ‖ (+ (* 2 x) 2)", student: "(+ y (neg (* 2 x))) ‖ 2", expect: { grade: 100 } }
            ]
        }
    ]
},
{
    id: "form", title: { en: "Form checks - required forms" },
    intro: { en: "Each check: off, \"note\" (a remark, no points off) or \"error\" (points off in the rubric category form). Form checks run only when the value is right: a wrong answer is not also told it is not reduced." },
    items: [
        {
            id: "form.reducedFractions", path: "rules.form.reducedFractions", values: "off | \"note\" | \"error\"",
            text: { en: "Every fraction in lowest terms: 3/4, not 6/8; x + 1 over 2, not (2x + 2)/4." },
            examples: [
                { caption: "6/8 for 3/4", ref: "(/ 3 4)", student: "(/ 6 8)", rules: { form: { reducedFractions: "error" } }, expect: { grade: 90, codes: ["fraction-not-reduced"] } }
            ]
        },
        {
            id: "form.simplified", path: "rules.form.simplified", values: "off | \"note\" | \"error\"",
            text: { en: "Nothing left to simplify: no numbers to combine (x + 2 + 3), no like terms (x + x), no double minus." },
            examples: [
                { caption: "x + 2 + 3 for x + 5", ref: "(+ x 5)", student: "(+ x 2 3)", rules: { form: { simplified: "error" } }, expect: { grade: 90, codes: ["not-simplified"] } }
            ]
        },
        {
            id: "form.expanded", path: "rules.form.expanded", values: "off | \"note\" | \"error\"",
            text: { en: "No product of a sum and no power of a sum left: 2x + 2, not 2(x + 1)." },
            examples: [
                { caption: "2(x + 1) for 2x + 2", ref: "(+ (* 2 x) 2)", student: "(* 2 (+ x 1))", rules: { form: { expanded: "error" } }, expect: { grade: 90, codes: ["not-expanded"] } }
            ]
        },
        {
            id: "form.factored", path: "rules.form.factored", values: "off | \"note\" | \"error\" | { level, completely: false }",
            text: { en: "The STUDENT'S answer must be a product, not a sum: 2(x + 1), not 2x + 2. Also completely: 2(x + 1), not 1·(2x + 2) with a common factor left inside (completely: false turns this part off). It checks only the student's answer: a factored answer passes silently, whatever the form of the reference. To note that a student factored (or expanded) when the reference did not, set the law equivalence.distributive to \"note\"." },
            examples: [
                { caption: "2x + 2 for 2(x + 1)", ref: "(* 2 (+ x 1))", student: "(+ (* 2 x) 2)", rules: { form: { factored: "error" } }, expect: { grade: 90, codes: ["not-factored"] } },
                { caption: "(x + 2)(x + 3) for x² + 5x + 6: factored, so nothing to report", ref: "(+ (^ x 2) (* 5 x) 6)", student: "(* (+ x 2) (+ x 3))", rules: { form: { factored: "note" } }, expect: { grade: 100, codes: [] } },
                { caption: "the same with distributive \"note\": the difference is noted", ref: "(+ (^ x 2) (* 5 x) 6)", student: "(* (+ x 2) (+ x 3))", rules: { equivalence: { distributive: "note" } }, expect: { grade: 100, notes: ["note-distributive"] } }
            ]
        },
        {
            id: "form.noNegativeExponents", path: "rules.form.noNegativeExponents", values: "off | \"note\" | \"error\"",
            text: { en: "No negative exponents: 1/x, not x⁻¹." },
            examples: [
                { caption: "x⁻¹ for 1/x", ref: "(/ 1 x)", student: "(^ x -1)", rules: { form: { noNegativeExponents: "error" } }, expect: { grade: 90, codes: ["negative-exponent"] } }
            ]
        },
        {
            id: "form.rationalDenominator", path: "rules.form.rationalDenominator", values: "off | \"note\" | \"error\"",
            text: { en: "No root in a denominator: √2/2, not 1/√2." },
            examples: [
                { caption: "1/√2 for √2/2", ref: "(/ sqrt(2) 2)", student: "(/ 1 sqrt(2))", rules: { form: { rationalDenominator: "error" } }, expect: { grade: 90, codes: ["irrational-denominator"] } }
            ]
        },
        {
            id: "form.exactValue", path: "rules.form.exactValue", values: "off | \"note\" | \"error\"",
            text: { en: "An exact answer, not a decimal: 1/2, not 0.5 (when the reference has no decimal number)." },
            examples: [
                { caption: "0.5 for 1/2", ref: "(/ 1 2)", student: "0.5", rules: { form: { exactValue: "error" } }, expect: { grade: 90, codes: ["not-exact"] } }
            ]
        },
        {
            id: "form.isolatedVariable", path: "rules.form.isolatedVariable", values: "a variable name, e.g. \"x\" | { variable, level }",
            text: { en: "The answer must be the equation solved for this variable: x = 2, not 2x = 4; y = 2x + 1, not y − 2x = 1." },
            examples: [
                { caption: "2x = 4 when x = … is required", ref: "x ‖ 2", student: "(* 2 x) ‖ 4", rules: { form: { isolatedVariable: "x" } }, expect: { grade: 90, codes: ["not-isolated"] } }
            ]
        }
    ]
},
{
    id: "statements", title: { en: "Equations, inequalities and chains" },
    items: [
        {
            id: "statements.scaleEquation", path: "rules.statements.scaleEquation", values: "true (default) | false",
            text: { en: "An equation multiplied by a number is the same equation: 2x = 4 for x = 2 (accepted with a note). false: the equation must have the same \"size\"." },
            examples: [
                { caption: "2x = 4 for x = 2", ref: "x ‖ 2", student: "(* 2 x) ‖ 4", expect: { grade: 100 } },
                { caption: "not accepted", ref: "x ‖ 2", student: "(* 2 x) ‖ 4", rules: { statements: { scaleEquation: false } }, expect: { grade: 0, codes: ["wrong-value"] } }
            ]
        },
        {
            id: "statements.sameSolutions", path: "rules.statements.sameSolutions", values: "true (default) | \"note\" | false",
            text: { en: "Equations with the same solutions are the same, also when one is not a multiple of the other: xy = 8 and y = 8/x (x = 0 is never a solution of xy = 8). Solutions are searched numerically; equations that lose or add solutions are not accepted (x = 2 for x² = 4)." },
            examples: [
                { caption: "y = 8/x for xy = 8", ref: "(* x y) ‖ 8", student: "y ‖ (/ 8 x)", expect: { grade: 100 } },
                { caption: "x = 2 for x² = 4: a solution lost", ref: "(^ x 2) ‖ 4", student: "x ‖ 2", expect: { grade: 0, codes: ["wrong-value"] } }
            ]
        },
        {
            id: "statements.domain", path: "rules.statements.domain", values: "{ y: { min: \"-pi/2\", max: \"pi/2\" } } - numbers or text with pi",
            text: { en: "Partial credit for an equation that is the same only inside this domain: x = sin y for y = sin⁻¹x when −π/2 ≤ y ≤ π/2. The rubric category domain takes the points off (default 30) and the feedback names the condition. To give full credit instead, limit the variable with value.variables." },
            examples: [
                { caption: "x = sin y for y = sin⁻¹x, −π/2 ≤ y ≤ π/2", ref: "y ‖ asin(x)", student: "x ‖ sin(y)", rules: { statements: { domain: { y: { min: "-pi/2", max: "pi/2" } } } }, expect: { grade: 70, codes: ["domain-only"] } },
                { caption: "√x = y for x = y², y ≥ 0", ref: "x ‖ (^ y 2)", student: "sqrt(x) ‖ y", rules: { statements: { domain: { y: { min: 0 } } } }, expect: { grade: 70, codes: ["domain-only"] } }
            ]
        },
        {
            id: "statements.derivation", path: "rules.statements.derivation", values: "lastOnly (default) | allSteps",
            text: { en: "An answer written as a chain of steps (a = b = c). lastOnly: only the last step is graded. allSteps: every step must equal the one before it - a wrong step costs the points of the rubric category derivation." },
            examples: [
                { caption: "a wrong middle step, allSteps", ref: "(^ (+ x 1) 2) ‖ (+ (^ x 2) (* 2 x) 1)", student: "(^ (+ x 1) 2) ‖ (+ (^ x 2) 1) ‖ (+ (^ x 2) (* 2 x) 1)", rules: { answerKind: "derivation", statements: { derivation: "allSteps" } }, expect: { grade: 80, codes: ["wrong-step"] } }
            ]
        }
    ]
},
{
    id: "collections", title: { en: "Sets, lists and x ∈ A" },
    intro: { en: "Sets and lists are compared element by element in any order; each missing or extra element is named in the feedback (feedback.nameMissing) and costs the points of the rubric category elements. The same for the set in x ∈ {…}." },
    items: [
        {
            id: "collections.setDuplicates", path: "rules.collections.setDuplicates", values: "\"note\" (default) | \"error\" | off",
            text: { en: "An element written twice: {1, 1, 2} for {1, 2}. \"note\": accepted with a remark; \"error\": points off (category elements)." },
            examples: [
                { caption: "{1, 1, 2} for {1, 2}", ref: "set{1, 2}", student: "set{1, 1, 2}", expect: { grade: 100 } },
                { caption: "as an error", ref: "set{1, 2}", student: "set{1, 1, 2}", rules: { collections: { setDuplicates: "error" } }, expect: { grade: 75, codes: ["duplicate-element"] } }
            ]
        },
        {
            id: "membership", path: "answer kind membership", values: "x ∈ A, x ∉ A",
            text: { en: "x ∈ {2, 3, 5}: the same element on the left, the same relation (∈ / ∉), and the sets compared as sets." },
            examples: [
                { caption: "x ∈ {2, 3} for x ∈ {2, 3, 5}", ref: "(memberOf x set{2, 3, 5})", student: "(memberOf x set{2, 3})", expect: { grade: 75, codes: ["missing-element"] } },
                { caption: "x ∉ {2, 3, 5} for x ∈ {2, 3, 5}", ref: "(memberOf x set{2, 3, 5})", student: "(notMemberOf x set{2, 3, 5})", expect: { grade: 50, codes: ["wrong-relation"] } }
            ]
        }
    ]
},
{
    id: "numbers", title: { en: "Numbers" },
    items: [
        {
            id: "numbers.decimals", path: "rules.numbers.decimals", values: "{ exactly: n } | { min: n } | { max: n }",
            text: { en: "The number of digits after the decimal point of a numeric answer (category precision). Use it with value.tolerance { decimals } for rounded answers." },
            examples: [
                { caption: "0.33 for 1/3, 2 decimals", ref: "(/ 1 3)", student: "0.33", rules: { value: { tolerance: { decimals: 2 } }, numbers: { decimals: { exactly: 2 } } }, expect: { grade: 100 } },
                { caption: "0.333 for 1/3, 2 decimals", ref: "(/ 1 3)", student: "0.333", rules: { value: { tolerance: { decimals: 2 } }, numbers: { decimals: { exactly: 2 } } }, expect: { grade: 90, codes: ["wrong-decimals"] } }
            ]
        },
        {
            id: "numbers.closeButWrong", path: "rules.numbers.closeButWrong", values: "a percent, e.g. 1 (default 0: off)",
            text: { en: "A numeric answer outside the tolerance but within this percent of the right value is a rounding error (category precision), not a wrong value." },
            examples: [
                { caption: "2.49 for 2.5, within 1%", ref: "2.5", student: "2.49", rules: { numbers: { closeButWrong: 1 } }, expect: { grade: 90, codes: ["rounding"] } }
            ]
        }
    ]
},
{
    id: "wrong", title: { en: "Wrong answers" },
    items: [
        {
            id: "diagnosis", path: "rules.diagnosis", values: "true (default) | false",
            text: { en: "When the value is wrong, look for a typical cause: only the sign (sign), a missing factor (factor), off by a power of 10 (scale), a missing or extra term (term). The feedback says so; the points come from the rubric category of that cause - until the rubric sets it, as a wrong value." },
            examples: [
                { caption: "−(x + 1) for x + 1: a sign error", ref: "(+ x 1)", student: "(neg (+ x 1))", expect: { grade: 0, codes: ["sign-error"] } },
                { caption: "with the rubric category sign at 50", ref: "(+ x 1)", student: "(neg (+ x 1))", rubric: { categories: { value: { mode: "once", points: 100 }, sign: { mode: "once", points: 50 } } }, expect: { grade: 50, codes: ["sign-error"] } }
            ]
        },
        {
            id: "mistakes", path: "rules.mistakes", values: "[{ answer, message: { en, he, ar }, points }]",
            text: { en: "Wrong answers the teacher expects, each with its own message and, optionally, its own grade. A student's answer with the same value gets that message." },
            examples: [
                { caption: "x² for (x²)′ = 2x, a teacher mistake worth 30", ref: "(* 2 x)", student: "(^ x 2)", rules: { mistakes: [{ answer: "(^ x 2)", message: { en: "The derivative of x² is 2x, not x²." }, points: 30 }] }, expect: { grade: 30, codes: ["teacher-mistake"] } }
            ]
        }
    ]
},
{
    id: "feedback", title: { en: "Feedback" },
    items: [
        { id: "feedback.showPenalties", path: "rules.feedback.showPenalties", values: "true (default) | false", text: { en: "Show the points taken off per rubric category (\"−25% · Elements\")." } },
        { id: "feedback.showNotes", path: "rules.feedback.showNotes", values: "true (default) | false", text: { en: "Show the notes (accepted differences, remarks) that do not cost points." } },
        { id: "feedback.showReference", path: "rules.feedback.showReference", values: "false (default) | true", text: { en: "Show the reference answer in the feedback." } },
        {
            id: "feedback.nameMissing", path: "rules.feedback.nameMissing", values: "true (default) | false",
            text: { en: "Name a missing element or part in the feedback (\"The element 5 is missing.\"). It shows part of the answer; false: \"An element is missing.\"" },
            examples: [
                { caption: "{1, 2} for {1, 2, 3}", ref: "set{1, 2, 3}", student: "set{1, 2}", expect: { grade: 75, codes: ["missing-element"] } },
                { caption: "not named", ref: "set{1, 2, 3}", student: "set{1, 2}", rules: { feedback: { nameMissing: false } }, expect: { grade: 75, codes: ["missing-element"] } }
            ]
        },
        { id: "feedback.messages", path: "rules.feedback.messages", values: "{ code: { en, he, ar } }", text: { en: "The teacher's own text for an error or note code (e.g. \"missing-element\"), replacing the built-in one." } }
    ]
},
{
    id: "rubric", title: { en: "The rubric - from errors to a grade" },
    intro: { en: "Every error belongs to a category. The grade starts at start; each category with errors takes its points off once (mode once), per error up to max (mode each), or nothing (mode none). A fatal error gives 0. The grade is never below minimum." },
    items: [
        { id: "rubric.start", path: "rubric.start", values: "a number (default 100)", text: { en: "The grade before any deduction." } },
        { id: "rubric.minimum", path: "rubric.minimum", values: "a number (default 0)", text: { en: "The lowest grade after the deductions." } },
        {
            id: "rubric.fatal", path: "rubric.fatal", values: "[\"incomplete\", \"answerType\"] (default)",
            text: { en: "Errors that give 0 at once: incomplete - an empty place left in the answer; answerType - an answer of another kind." },
            examples: [
                { caption: "an expression for an equation", ref: "x ‖ 2", student: "2", expect: { grade: 0, codes: ["answer-type"] } }
            ]
        },
        { id: "rubric.mode", path: "rubric.categories.<category>.mode", values: "once | each | none", text: { en: "once: the points once, however many errors of the category; each: the points per error, up to max; none: no points off (the error is still in the feedback)." } },
        {
            id: "rubric.categories.value", path: "rubric.categories.value", values: "default once, 100",
            text: { en: "A wrong value (and a diagnosis whose own category is not set)." },
            examples: [{ caption: "x + 2 for x + 1", ref: "(+ x 1)", student: "(+ x 2)", expect: { grade: 0 } }]
        },
        {
            id: "rubric.categories.form", path: "rubric.categories.form", values: "default each, 10, max 30",
            text: { en: "A form check set to \"error\" that fails; also \"value right, form not accepted\" in structural mode." },
            examples: [{ caption: "6/8 for 3/4, reduced fractions required", ref: "(/ 3 4)", student: "(/ 6 8)", rules: { form: { reducedFractions: "error" } }, expect: { grade: 90 } }]
        },
        {
            id: "rubric.categories.relation", path: "rubric.categories.relation", values: "default once, 50",
            text: { en: "The wrong relation (≤ for <, ∉ for ∈) or the wrong direction (x > 3 for x < 3)." },
            examples: [{ caption: "x ≤ 3 for x < 3", ref: "(less x 3)", student: "(lessEqual x 3)", expect: { grade: 50, codes: ["wrong-relation"] } }]
        },
        {
            id: "rubric.categories.elements", path: "rubric.categories.elements", values: "default each, 25, max 100",
            text: { en: "A missing or extra element of a set, list or tuple, or a missing or extra part of an and / or answer." },
            examples: [{ caption: "{1} for {1, 2, 3}: two missing", ref: "set{1, 2, 3}", student: "set{1}", expect: { grade: 50 } }]
        },
        {
            id: "rubric.categories.order", path: "rubric.categories.order", values: "default once, 25",
            text: { en: "The right elements of a tuple (an ordered pair) in the wrong order." },
            examples: [{ caption: "(2, 1) for (1, 2)", ref: "tuple[1, 2]", student: "tuple[2, 1]", expect: { grade: 75, codes: ["wrong-order"] } }]
        },
        { id: "rubric.categories.precision", path: "rubric.categories.precision", values: "default once, 10", text: { en: "The wrong number of decimals (numbers.decimals) or a rounding error (numbers.closeButWrong)." } },
        { id: "rubric.categories.derivation", path: "rubric.categories.derivation", values: "default once, 20", text: { en: "A wrong step in a chain of steps (statements.derivation: allSteps)." } },
        { id: "rubric.categories.domain", path: "rubric.categories.domain", values: "default once, 30 (also when the rubric leaves it out)", text: { en: "An equation that is the same only inside the domain of statements.domain." } },
        { id: "rubric.categories.mistake", path: "rubric.categories.mistake", values: "default once, 100", text: { en: "A teacher-defined mistake (rules.mistakes) without its own points." } },
        { id: "rubric.categories.sign", path: "rubric.categories.sign", values: "not set (graded as value)", text: { en: "Diagnosis: only the sign is wrong, −(x + 1) for x + 1. Set it to give partial credit." } },
        { id: "rubric.categories.factor", path: "rubric.categories.factor", values: "not set (graded as value)", text: { en: "Diagnosis: a missing factor, x for 2x." } },
        { id: "rubric.categories.scale", path: "rubric.categories.scale", values: "not set (graded as value)", text: { en: "Diagnosis: off by a power of 10, 25 for 2.5 (often units)." } },
        { id: "rubric.categories.term", path: "rubric.categories.term", values: "not set (graded as value)", text: { en: "Diagnosis: a missing or extra term, x² + 1 for x² + 2x + 1." } }
    ]
}
];

/* every entry by its id */
const byId = {};
SECTIONS.forEach(function (s) { s.items.forEach(function (it) { byId[it.id] = it; }); });

/* a text in the language, else English */
function text(t, language) { return t ? (t[language] || t.en || "") : ""; }

const api = { sections: SECTIONS, byId: byId, text: text };

if (typeof module === "object" && module.exports) module.exports = api;
else global.MathCheckHelp = api;
})(typeof window !== "undefined" ? window : this);
