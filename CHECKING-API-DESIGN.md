# FullKBD: the answer-checking API, comparison rules and rubric (design)

Status: **design, 2026-10-21; client-side version 0.1.0 implemented the same day** - `mathCheck.js`,
tests `mathCheckTests.js` (`node mathCheckTests.js`, 75 cases) and `mathCheckTestHarness.html` (+8 cases typed on the
real keyboard), and `mathCheckPlayground.html` (two keyboards, the rule switches, the equivalence ladder and the sample
points). 0.2.0: equations and relations in the ladder - a last step `equationForms` (law `equationTransforms`):
(left − right) = 0 divided by the leading coefficient, so terms moved between the sides and both sides multiplied by a
number give the same canonical form (scaling only with `statements.scaleEquation`; for < and ≤ a positive factor only). Also `statements.sameSolutions` (true | "note" | false): when left − right is not
a constant multiple (xy = 8 and y = 8/x), numeric points of each solution set (one variable scanned, bisection) must
solve the other equation. `statements.domain` ({ y: { min: "-pi/2", max: "pi/2" } }): equations equivalent only
inside the domain (x = sin y for y = sin⁻¹x) get the error `domain-only`, rubric category `domain` (default −30, also
when the teacher's rubric leaves it out). A student's d/dx, ∫, lim, Σ, ∏ the reference does not have: `not-evaluated`. Help (2026-10-22): `mathCheckHelp.js` -
data only, not part of the library: one entry per rule / rubric element (id = its path, text he/en/ar - English
written so far, examples in the test notation with the expected result); `mathCheckHelp.html` is the document built
from it (examples computed live), linked from the playground; every example is also a test (mathCheckTests.js).
How to show one entry next to its control (instead of a "?" on every item) is still open. 0.8.0 (2026-10-30): the
keyboard's "=" splits the whole root into the sides of a chain ((x < 1 ∨ x) = 3); `answerOf` regroups it so "=" binds
tighter than ∨, ∧ and the comma, as < and ≠ do (x < 1 ∨ (x = 3); x = 1, 5 is (x = 1), 5). `statements.list`
(true | "note" | false, default "note"): a comma list of statements for a reference joined by ∨ / ∧ (x < 1, x = 3 for
x < 1 ∨ x = 3) is read with the reference's connective; the comma form gives `statement-list`. Rubric category
`commaList` for `solution-list`, `exclusion-list` and `statement-list` (a comma for ∨ / ∧ / a set, when the rule does not
accept it): its own penalty for a partial grade; when the rubric does not set it, graded as `form` (as before). 0.8.1: rubric category `direction` (`wrong-direction`) apart from `relation`
(`wrong-relation`), each with its own rule (default once, 50). In an and / or answer, a condition with the same sides as a reference condition
but another relation (x ≤ 5 ∨ x ≥ 7 for x < 5 ∨ x > 7) gives `wrong-relation` / `wrong-direction` per condition, not
`missing-statement` + `extra-statement`. Not yet: the builder page (section 6), units, highlighting, the server packaging. Builds on `ANSWER-CHECKING-DESIGN.md` (the math tree, the comparison
strategies, the rejected options), which stays valid. This document adds what the user asked for on 2026-10-21:

- one function that compares the student's semantic AST with the reference's, usable **in the browser and on a server**;
- two more inputs: **comparison rules** and a **rubric**;
- the output: a **grade 0-100** and **feedback text** explaining every error;
- a **builder page** to enter the reference answer, set the rules and the rubric, and test them;
- where the code lives: inside the keyboard library or separate.

---

## 1. Where the code lives - recommendation: a separate library

```
                 ┌──────────────────────────┐        semantic AST (JSON)       ┌───────────────────────────┐
 browser         │ fullKbdLib (keyboard)    │ ─────────── getAST() ──────────► │ mathCheck (checker)        │
 (STACK-JS,      │  editing, rendering,     │                                  │  pure functions, no DOM    │
  other pages)   │  highlighting by node id │ ◄──── result.errors[].nodes ──── │  compare → grade, feedback │
                 └──────────────────────────┘                                  └───────────────────────────┘
                                                                                     ▲
 server (Node)        reference AST + rules + rubric (from the builder) ─────────────┘   student AST from the page
```

| | Separate library (recommended) | Part of the keyboard |
|---|---|---|
| Server use | loads the checker only - no DOM, no keyboard, small | must load the whole keyboard (DOM code it cannot run) or strip it |
| Same results client / server | one file, the same code in both | possible, but the server copy carries dead weight |
| Builder page | loads both | loads one file |
| Releases | the checker can change (new rules, texts) without touching the keyboard, and the reverse | every rule change is a keyboard release |
| Testing | unit tests on JSON in Node, fast, no browser | needs a browser or a DOM shim |
| Coupling | only through the **semantic AST** - a documented, versioned JSON contract | internal calls, easy to blur the boundary |

**The contract between them is the semantic AST** (`getAST()`, ANSWER-CHECKING-DESIGN 4.3a): node kinds, operators,
parts, and `src` (editor node ids). It gets a version field (`astVersion`), and the checker refuses or adapts to an
older version. What each side owns:

| Keyboard (`fullKbdLib`) | Checker (`mathCheck`) |
|---|---|
| produce the semantic AST, with `src` ids | normalize the tree (flatten, order, signs), evaluate, compare |
| show the feedback: highlight the nodes whose ids the errors carry | rules, rubric, grade |
| the student's interface texts | the **feedback texts** (he / en / ar) - a server needs them too |

Form: one JavaScript file, no dependencies, **UMD** (a browser global `MathCheck`, `require("mathCheck")` in Node,
`import` as a module). The chemistry keyboard has its comparison inside the keyboard file; the same split could be
done there later - not part of this work.

---

## 2. The API

```js
MathCheck.compare(student, reference, rules, rubric, options) → result
```

| Parameter | Content |
|---|---|
| `student` | the student's semantic AST (JSON object or text) |
| `reference` | the reference semantic AST, **or a list** of correct answers (the best grade wins) |
| `rules` | the comparison rules (section 3) |
| `rubric` | the grading rubric (section 4) |
| `options` | `language` (`he` / `en` / `ar`), `seed` (random sampling; section 3.2), `include` (which parts of the result) |

```js
result = {
  grade: 75,                       // 0..100, after the rubric
  correct: false,                  // no error at all (notes allowed)
  feedback: "…",                   // the whole explanation, plain text, numbered lines, in options.language
  items: [                         // the same, structured - for a page that formats or highlights
    { kind: "error", code: "fraction-not-reduced", category: "form",
      message: "…", penalty: 10, counted: true,
      studentNodes: ["n12","n13"], referenceNodes: ["n4"] },
    { kind: "error", code: "…", counted: false, causedBy: 0 },   // shown as "not counted (caused by …)"
    { kind: "note",  code: "commutative-order", message: "…" }    // no penalty
  ],
  penalties: [ { category: "form", points: 10, count: 1, capped: false } ],
  matched: { reference: 0, mistake: null },   // which correct answer / teacher-defined mistake matched
  version: "1.0"
}
```

- **Deterministic:** the same inputs give the same result on a client and on a server (seeded sampling, no time or
  locale dependence). The grade must be reproducible to be defensible.
- **Never throws on student input:** an empty or broken answer is a result (`syntax` / `incomplete`, grade 0).
- `MathCheck.validateRules(rules)`, `MathCheck.validateRubric(rubric)` - for the builder and the server: unknown keys,
  wrong types, conflicting options, reported as messages.
- `MathCheck.feedbackText(code, language, params)` - one message, for pages that build their own feedback.

---

## 3. The comparison rules - all components

The structure, then each component. Every check produces **error codes**; every code belongs to a **rubric
category** (section 4). A check can be set to `"error"` (graded), `"note"` (shown, not graded) or `"off"`.

```js
rules = {
  answerKind: "expression",              // 3.1
  value: { … },                          // 3.2 - is the value right
  equivalence: { … },                    // 3.3 - which differences of form are the same answer
  form: { … },                           // 3.4 - which form the answer must have
  statements: { … },                     // 3.5 - equations, inequalities, systems, solution sets
  collections: { … },                    // 3.6 - sets, tuples, intervals, lists
  structures: { … },                     // 3.7 - integral, limit, derivative, Σ / Π
  numbers: { … },                        // 3.8 - decimals, precision, notation
  units: { … },                          // 3.9 - later (the keyboard has no units yet)
  mistakes: [ … ],                       // 3.10 - teacher-defined wrong answers
  feedback: { … }                        // 3.11 - what the feedback shows
}
```

### 3.1 Answer kind
| Key | Values | Meaning |
|---|---|---|
| `answerKind` | `expression` · `equation` · `inequality` · `system` · `solutionSet` · `set` · `tuple` · `interval` · `number` · `structure` · `derivation` · `auto` | what the answer is; a different kind is the error `answer-type`. `auto`: taken from the reference |
| `acceptKinds` | list | other kinds accepted as the same answer, e.g. `solutionSet` accepts `x=2 ∨ x=3`, `{2,3}`, `x∈{2,3}` |

### 3.2 Value - is the answer mathematically equal?
| Key | Default | Meaning |
|---|---|---|
| `mode` | `numeric` | `numeric`: substitute values and compare; `structural`: equal standard forms only (3.3); `exact`: the same tree |
| `variables` | from the reference | per variable: `{ min, max }`, `integer: true`, `nonzero`, `positive`; or `"fixed"` (a parameter with given values) |
| `samples` | `8` | number of substitution points |
| `seed` | from `options.seed` | random points - the same seed gives the same points everywhere |
| `tolerance` | `{ relative: 1e-9 }` | or `{ absolute: … }`, or `{ decimals: n }` (equal when rounded) |
| `skipUndefined` | `true` | points where √, log, a division by zero is undefined are skipped (and replaced) |
| `constantShift` | `false` | equal up to an added constant (an antiderivative); with `requireConstant: true` the `+C` must be written |
| `scalar` | `false` | equal up to a constant factor (used for equations, 3.5) |
| `complex` | `false` | sample complex values (when `complexNumbers` is on) |

### 3.3 Equivalence - differences of form accepted as the same answer
Used by `mode: structural`, by the form checks, and to decide between *error*, *note* and *silent*.

| Key | Example | Default |
|---|---|---|
| `commutative` | `x+3` = `3+x`, `2x` = `x·2` | accept |
| `associative` | `(a+b)+c` = `a+(b+c)` | accept |
| `likeTerms` | `x+x` = `2x`, `3x−x` = `2x` | accept |
| `numericEvaluation` | `2·3` = `6`, `4/2` = `2` | accept |
| `distributive` | `2(x+1)` = `2x+2` | accept (value) - `form.expanded` / `form.factored` decide if it matters |
| `fractionForms` | `a/b` = `a·b⁻¹` = `(1/b)·a` | accept |
| `decimalFraction` | `0.5` = `1/2`, `0.333…` ≠ `1/3` (beyond `numbers.tolerance`) | accept |
| `signPlacement` | `−a/b` = `a/(−b)` = `−(a/b)` | accept |
| `factorSign` | `(2−x)(x+1)` vs `−(x−2)(x+1)` | accept |
| `powerForms` | `√x` = `x^(1/2)`, `x⁻¹` = `1/x` | accept |
| `trigIdentities`, `logLaws` | `sin²x+cos²x` = `1`, `log a + log b` = `log ab` | accept by value only (numeric mode) |
| `report` | for each accepted difference: `"silent"` or `"note"` | `silent` |

### 3.4 Form - what the answer must look like
Each check is `"off" | "error" | "note"`, plus its parameters. Checked on the **student's** tree, and **only when the
value is right** - for a wrong value they are not run at all (decided 2026-10-21, section 9a).

| Check | Fails for | Code |
|---|---|---|
| `reducedFractions` | `4/6` | `fraction-not-reduced` |
| `simplified` | `x+x+1`, `2·3x` (like terms, numeric products left) | `not-simplified` |
| `expanded` | `2(x+1)` | `not-expanded` |
| `factored` (+ `completely: true`) | `2x+2`; `(2x+4)(x+1)` not complete | `not-factored`, `not-fully-factored` |
| `rationalDenominator` | `1/√2` | `irrational-denominator` |
| `noNegativeExponents` | `x⁻²` | `negative-exponent` |
| `noNestedFractions` | `(1/2)/x` | `nested-fraction` |
| `mixedNumber` / `improperFraction` | `7/2` vs `3½` | `fraction-form` |
| `exactValue` | `1.414` for `√2` | `not-exact` |
| `isolatedVariable` (`x`) | `2x = 4` when `x = 2` is required | `not-isolated` |
| `standardForm` (`polynomial-descending`, `y=mx+b`, …) | `3 + x²` when `x² + 3` is required | `not-standard-form` |
| `noRedundantParentheses`, `noOneCoefficient` (`1x`), `noPowerOne` (`x¹`) | style | `redundant-*` (default `note`) |

### 3.5 Statements - equations, inequalities, systems, solution sets
| Key | Meaning | Default |
|---|---|---|
| `swapSides` | `a=b` = `b=a`; `a<b` = `b>a` | accept |
| `scaleEquation` | `2x=4` = `x=2` (left−right proportional); `scaleInequality` keeps the direction for a positive factor | accept |
| `relationExact` | `<` vs `≤` must match (always an error: `wrong-relation`) | on |
| `systemOrder` | the rows of a system in any order | accept |
| `systemEquivalent` | a different but equivalent system (`x+y=3, x−y=1` vs `x=2, y=1`) | `false` - the rows are matched one by one |
| `solutionSetForms` | `x=2 ∨ x=3`, `{2,3}`, `x∈{2,3}` | accept the ones listed |
| `commaForOr` | `x = 2, 3` - recognized, values checked, flagged | `error` (`comma-for-or`) |
| `chainAsAnd` | `3<x<5` = `x>3 ∧ x<5` | accept |
| `derivation` | a chain `a = b = c`: `lastOnly` (grade the last element) or `allSteps` (each step must be an identity; reports the first wrong step) | `lastOnly` |

### 3.6 Collections - sets, tuples, intervals, lists
| Key | Meaning | Default |
|---|---|---|
| `setOrder` | element order ignored | always (sets) |
| `setDuplicates` | `{1,1,2}`: `accept` / `note` / `error` | `note` |
| `tupleOrder` | order matters | always (tuples / points / vectors) |
| `elementCompare` | each element compared by the value rules (3.2) | on |
| `partialCredit` | missing / extra elements are graded per element (rubric `elements`) | on |
| `intervalEndpoints` | open / closed ends must match | on (`wrong-endpoint-type`) |
| `inexactInclusion` | `⊆` accepted for `⊂` (ANSWER-CHECKING 2: `exactInclusion`) | off |

### 3.7 Structures - integral, limit, derivative, Σ / Π, evaluation
Part by part (ANSWER-CHECKING 5.3); per part a rule:

| Key | Meaning | Default |
|---|---|---|
| `renameBoundVariable` | `∫f(t)dt` = `∫f(x)dx`; `Σ_k` = `Σ_i` | accept |
| `boundsNumeric` | bounds compared by value (`π/2` = `1.5707…` within tolerance) | on |
| `requireDifferential` | a missing `dx` is an error | on |
| `limitDirection` | a missing / wrong one-sided direction | `error` |
| `wholeValueFallback` | parts differ but the whole value is equal (`2∫f` = `∫2f`): accept, with a note | on |
| `requireConstant` | an indefinite integral without `+C` | `error` |
| `sameForm` | the reference is a Σ / Π / ∫ / lim: the student's answer must be one too - the computed number (385 for `Σ_{k=1}^{10}k²`) or another expression of the same value (`2·Σk` for `Σ2k`) gives `not-same-form` (rubric category `structureForm`: its own penalty, or fatal). `"root"`: the answer itself is that structure; `"contains"`: it has one somewhere; `false`: any form of the right value | `"root"` |
| `indexShift` | `Σ_{k=0}^{9}(k+1)²` for `Σ_{k=1}^{10}k²` (bounds and body shifted by the same d) | `"note"` |

**Σ / Π compared part by part (built in 0.9.0, 2026-10-30; ∫ and lim not yet).** In the code the rules are
`rules.structures.{sameForm, renameBoundVariable, indexShift, wholeValue}` (`wholeValue` = `wholeValueFallback` above,
true | "note" | false, default "note"); a finite Σ / Π is also computed (a loop, at most 1000 terms), so it is compared by
value inside an expression (1 + Σ…). The parts `indexVariable`, `start`, `end`, `body`, in this order:
1. The same operator (Σ for Π: `not-same-form`).
2. Each part: the index renamed to the reference's (`renameBoundVariable`); start and end by value (a parameter such as
   `n` sampled as a positive integer, `∞` only equals `∞`); the body by value with the index sampled only at integers
   inside the range (`(−1)^k` = `cos πk`). Errors: `wrong-lower-bound`, `wrong-upper-bound` (with "off by one" when
   the difference is ±1), `swapped-bounds`, `wrong-body`, `body-without-index` (`Σ_{k=1}^{n} n²`),
   `wrong-index-variable` (only when renaming is off).
3. An index shift (`indexShift`): d = start difference, the end differs by d, body_s(k + d) = body_r(k); also for ∞.
4. The whole value (`wholeValueFallback`, finite bounds only, a loop up to ~1000 terms): equal → accepted with a note,
   unless `sameForm` rejects the form.
The value and the form are separate: a right value in another form gets only `not-same-form`; a Σ with a wrong part
gets that part's error. Rubric categories: `bounds`, `body`, `indexVariable`, `structureForm` - each its own rule.
**∫ (built in 0.10.0).** The parts: the `dx` (missing: `missing-differential`; another letter: `wrong-integration-variable`
when renaming is off - category `indexVariable`), definite or not (`missing-limits` / `extra-limits`, category `bounds`),
the limits by value (∞ / −∞; `swapped-bounds`), the integrand by value at points inside the reference's limits
(`integrandInRange`, default true: ∫₀¹|x|dx = ∫₀¹x dx; false: in the variable's range, and `wholeValue` does not save another
integrand). Definite with finite limits: also computed (adaptive Simpson), so `1/3` for ∫₀¹x²dx is `not-same-form` and another
integrand of the same value is `wholeValue`. Indefinite or improper: the parts only (`x³/3` for ∫x²dx: a wrong value).
lim not yet (target, direction, body).

### 3.8 Numbers - decimals, precision, notation
| Key | Meaning |
|---|---|
| `decimals` | exactly / at least / at most n decimal places |
| `significantFigures` | n significant figures |
| `rounding` | `round` / `truncate` - a truncated answer for a rounded reference is `wrong-rounding` |
| `scientific` | required / allowed / not allowed |
| `percent` | `50%` = `0.5`: accept / require one form |
| `closeButWrong` | outside the tolerance but within n%: report `rounding` rather than `wrong-value` |

### 3.9 Units - later
The keyboard has no units yet. Reserved: `required`, `accepted` (list), `convert: true` (`2 km` = `2000 m`), codes
`missing-unit`, `wrong-unit`, `unit-not-converted`.

### 3.10 Teacher-defined mistakes
```js
mistakes: [ { answer: <semantic AST>, message: { he, en, ar }, category: "value", points: 30 } ]
```
- Matched with the same comparison as a correct answer (so `2+2x` matches the mistake `2x+2`).
- Order: correct answers → teacher mistakes → automatic diagnosis → generic "wrong value".
- `points`: a grade for this specific mistake (partial credit) instead of the rubric's penalty.

### 3.11 Automatic diagnosis of a wrong value (cheap checks, ANSWER-CHECKING 5.7)
| Check | Code |
|---|---|
| student = −reference | `sign-error` |
| a constant ratio | `missing-factor` |
| the difference is one term of the reference | `missing-term` / `extra-term` |
| the ratio is a power of 10 | `scale-error` |
| one factor of a product wrong, others right | `wrong-factor` (per factor, with highlighting) |
| one part of a structure wrong | the part's code (`wrong-lower-bound`, …) |

### 3.12 Feedback options
| Key | Meaning |
|---|---|
| `showReference` | include the reference answer in the feedback |
| `showPenalties` | the penalty heading per category ("−10% · form") |
| `showNotes` | include notes |
| `maxItems` | at most n messages (the rest summarized) |
| `messages` | teacher overrides per error code and language |

---

## 4. The rubric

Same model as the chemistry keyboard (`RUBRIC_CATEGORY_OF`, `SUPPRESSION_RULES`, `gradeComparison`).

```js
rubric = {
  start: 100,                                    // the grade before penalties
  categories: {
    value:     { mode: "once", points: 100 },    // a wrong value: the whole answer
    form:      { mode: "each", points: 10, max: 30 },
    elements:  { mode: "each", points: 25, max: 100 },
    sign:      { mode: "once", points: 50 },
    …
  },
  fatal: ["syntax", "incomplete", "answer-type"],  // grade 0, regardless of the rest
  oneMistakeOnePenalty: true,                    // section 4.4
  minimum: 0
}
```

### 4.1 Per category
| Key | Meaning |
|---|---|
| `mode` | `once`: one penalty however many errors of the category · `each`: a penalty per error · `none`: shown, not graded |
| `points` | the penalty (percent of the full grade) |
| `max` | the cap for `each` |
| `allMissing` | a separate penalty when every item of the kind is missing (as for states in chemistry) |

### 4.2 Categories and the codes they collect
| Category | Codes |
|---|---|
| `syntax` (fatal) | empty slot, missing operand, `comma-for-or` (if set to fatal) |
| `answerType` (fatal by default) | `answer-type` |
| `value` | `wrong-value` (nothing better diagnosed) |
| `sign` | `sign-error` |
| `factor` | `missing-factor`, `wrong-factor` |
| `term` | `missing-term`, `extra-term` |
| `scale` | `scale-error` |
| `form` | `fraction-not-reduced`, `not-simplified`, `not-expanded`, `not-factored`, `not-fully-factored`, `irrational-denominator`, `negative-exponent`, `nested-fraction`, `fraction-form`, `not-exact`, `not-isolated`, `not-standard-form` |
| `relation` | `wrong-relation` (x ≤ 4 for x < 4, ∉ for ∈), `comma-for-or` |
| `direction` | `wrong-direction` of an inequality (x > 4 for x < 4); its own rule, apart from `relation` (0.8.1) |
| `commaList` | `solution-list`, `exclusion-list`, `statement-list`; not set in the rubric: graded as `form` (0.8.0) |
| `elements` | `missing-element`, `extra-element`, `wrong-element`, `duplicate-element`, `missing-row`, `extra-row` |
| `order` | `wrong-order` (tuples) |
| `endpoints` | `wrong-endpoint-type` |
| `structure` | `wrong-lower-bound`, `wrong-upper-bound`, `swapped-bounds`, `missing-differential`, `wrong-variable`, `wrong-direction`, `missing-direction`, `wrong-order` (derivative), `missing-constant` |
| `precision` | `wrong-decimals`, `wrong-significant-figures`, `wrong-rounding`, `rounding` |
| `notation` | `scientific-required`, `percent-form` |
| `derivation` | `wrong-step` |
| `mistake` | a teacher-defined mistake (its own `points` override) |

The builder lists only the categories the rules can produce for the question.

### 4.3 The grade
`grade = max(minimum, start − Σ penalties)`; a fatal code → 0; a matched teacher mistake with `points` → that grade
(the rest of the rubric not applied, unless the teacher says so). Rounded to whole percent.

### 4.4 One mistake = one penalty (suppression)
Errors caused by another error are shown as "not counted (caused by …)" and not graded:
| Error | Hides |
|---|---|
| wrong value | - (the form checks are not run at all for a wrong value: decided 2026-10-21, section 9a) |
| a wrong element / term / factor | the value error of the whole, when that element explains it |
| a wrong bound / part of a structure | the structure's whole-value error |
| `sign-error` | `wrong-value` |
| a teacher mistake match | the automatic diagnosis |

---

## 5. Feedback text

- Numbered lines, in `options.language`, grouped by rubric category with the penalty heading (as in chemistry):
  `−10% · Form` then `1. The fraction 4/6 can be reduced.`
- Formulas inside a message: LaTeX between `\(…\)` (a page with MathJax typesets them; the server returns the same
  text) - and `items[].message` the same text, `items[].latex` the formula pieces, for a page that formats itself.
- Right-to-left languages: formulas and numbers isolated left to right (the lesson from the chemistry keyboard).
- Teacher messages (3.10, 3.12) replace the built-in text for their code.

---

## 6. The builder page (`mathCheckBuilder.html`)

One page, the same structure as the chemistry question builder; loads `fullKbdLib` and `mathCheck`.

| Section | Content |
|---|---|
| **File** | New / Open / Save (the question as one JSON file: reference answers, rules, rubric, test cases); interface language he / en / ar |
| **Keyboard** | which keyboard options the student gets (the existing `fullKbdLib` config: panels, functions, sets, complex numbers…) |
| **Reference answers** | one or more, entered **with the keyboard**; each shows its semantic AST (collapsible) and its detected kind |
| **Rules** | sections 3.1 - 3.8 as grouped controls: each check a three-way switch *off / note / error* with its parameters; the variable domains filled from the reference's variables; `validateRules` messages inline |
| **Teacher mistakes** | add a wrong answer with the keyboard, its message in three languages, its category or points |
| **Rubric** | the table of categories (only the relevant ones): once / each / none, points, max, all-missing; fatal codes; a "reset to defaults" |
| **Try it** | a student keyboard + **Check**: the grade, the feedback as the student sees it, the answer with the errors highlighted, and the raw `result` JSON (collapsible) |
| **Test cases** | a table of saved student answers with the expected grade (and optionally expected codes); **Run all** shows pass / fail per row - a regression check after changing rules or rubric. Add the current "Try it" answer as a case with one click |
| **Export** | the configuration for a target: STACK-JS (as in chemistry), a stand-alone page, or a **server JSON** (`{reference, rules, rubric}`) for `compare` on a server |

---

## 7. Server use

- Node: `const MathCheck = require("./mathCheck.js")`, then `MathCheck.compare(studentAst, config.reference,
  config.rules, config.rubric, {language, seed})`. No DOM, no keyboard, no network.
- The page sends the student's **semantic AST** (not LaTeX); the server re-checks it, so the grade does not depend on the
  browser. The AST is validated (`astVersion`, node kinds, size limits) before use.
- Moodle: STACK grades with Maxima on its server and has no Node. Options: (a) grade in the browser through STACK-JS, as
  the chemistry keyboard does (simple; a determined student could change the score); (b) a small Node service the STACK
  question calls - not possible from STACK as is; (c) a dedicated Moodle question type (`QTYPE-DESIGN` in chemistryLib).
  The library supports all three; which one is a separate decision.

---

## 8. Plan (relative to ANSWER-CHECKING-DESIGN.md's roadmap)

1. `mathCheck.js` skeleton: UMD, `compare` with the result shape, rubric engine (section 4) - first with `value` only.
2. Value: tree normalization + seeded numeric comparison (3.2) - roadmap steps 2-3.
3. Standard form + equivalence options (3.3) and the form checks (3.4) - roadmap step 4.
4. Builder page: reference, rules, rubric, Try it, test cases.
5. Statements, collections (3.5, 3.6) - roadmap step 6.
6. Structures (3.7) - roadmap step 5.
7. Numbers (3.8), teacher mistakes and diagnosis (3.10, 3.11), feedback texts he / en / ar - roadmap step 7.
8. Highlighting in the keyboard from `items[].studentNodes` - roadmap step 8.
9. Node tests on JSON fixtures (the same cases as the builder's test table).

## 9. Decided (2026-10-21, the user)

1. **A separate library `mathCheck.js`** - yes.
2. **A wrong value: defined in the rubric.** No built-in partial credit: the teacher sets the penalty of `value` (e.g. 100 =
   grade 0) and of each diagnosis category (`sign`, `term`, `factor`, `scale`); a diagnosed error replaces `wrong-value`
   (4.4), so a sign error can cost 50 instead of 100. Builder defaults: `value` 100, the diagnosis categories off (= 100
   through `value`) until the teacher sets them.
3. **Form checks when the value is wrong: not run.** A fixed rule, not an option (the user, after the example in 9a):
   the form of a wrong answer is not checked, reported or graded - the feedback says only that the value is wrong (and
   any diagnosis of it, e.g. a sign error).
4. **Equivalence over several references:** the rules (3.3) should make one reference answer enough in most questions;
   several references stay possible for answers that are genuinely different (two solution methods, `x = ±2` written as
   a set or as two equations when `acceptKinds` does not cover it). The builder suggests an equivalence option when a
   test case fails only by form.
5. **Server:** probably **Open edX** (see 9b). **One checker in JavaScript, run by Node on the server** - no Python
   port. How Open edX calls it (a Node service, or an embedded JS engine in Python) is decided when the server is set up.
6. **Highlighting:** later. The error items keep `studentNodes` / `referenceNodes` from the start, so nothing has to
   change in the checker when highlighting is added.

### 9a. Form checks when the value is wrong - an example

Question: "Reduce the fraction 12/16." Reference `3/4`, rule `form.reducedFractions: "error"`.
Rubric: `value` 100 (once), `form` 20 (each).

| Student | Value | Form | `skip` | `note` (default) | `grade` |
|---|---|---|---|---|---|
| `3/4` | right | reduced | 100 | 100 | 100 |
| `6/8` | right | not reduced | 80 - "6/8 can be reduced" | 80 | 80 |
| `6/10` | **wrong** (3/5) | not reduced | 0 - "the value is wrong" | 0 - "the value is wrong"; *not counted: 6/10 can also be reduced* | 0 (100 + 20, floor 0) |

Where it matters - a partial-credit rubric, `value` 60:

| Student | `skip` | `note` | `grade` |
|---|---|---|---|
| `6/10` | 40 | 40, with the form remark shown as not counted | 20 - one mistake penalized twice |

**Decided: `skip`** - for `6/10` the feedback says only that the value is wrong; whether it is reduced is not checked.
(The table above was the example the decision was made on; `note` and `grade` are not implemented.)

### 9b. Open edX (to verify when the server is chosen)

Open edX is Python (Django); it does not run JavaScript on the server. Its JavaScript problem type (JSInput) runs the
page's code in the browser, and the grading is a **Python** function on the server that receives a string from the page.
So, with `mathCheck.js`:
- (a) the grade is computed in the browser and sent as the answer (simple; a student could change it - as in STACK-JS);
- (b) a small **Node service** next to the edX server, called by the Python grader (the same `mathCheck.js`, a server
  grade);
- (c) a Python port of the checker (two code bases to keep equal - not recommended).
The checker's design does not depend on the choice.

**Decided 2026-10-21 (the user): one checker, in JavaScript - no Python port.** On a server it runs on **Node**, the same
`mathCheck.js` file as in the browser: (b) above - a small Node service the Python grader of Open edX calls with the
student's semantic AST and the question's configuration, answering `{grade, feedback, items}`. A variant to compare when
the server is set up: running the same JS file inside the Python process with an embedded JavaScript engine (e.g. a
V8 or QuickJS binding for Python) - still one code base, no separate service. (a), the grade computed in the browser, stays
possible for practice questions.

## 10. Open questions

Answered in section 9. Still open: how the server calls the checker (a Node service or an embedded JS engine, 9b) -
when the platform is set up.
