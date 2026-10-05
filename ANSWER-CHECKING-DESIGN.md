# FullKBD: answer checking and feedback (design)

Status: **design phase**. Nothing in this document has been implemented yet.
Decided on 2026-10-04 (design session). The base library is `fullKbdLib-v4.js`.
The new work goes into a **new library version**, so backward compatibility with v4 does not matter.

---

## 0. Roadmap

| Step | Content | Status |
|---|---|---|
| **1** | Finalize the operator set and restructure the keyboard panels (section 2). **No analysis or feedback.** | **next** |
| 2 | Math tree: converter from the editor AST with precedence, ids kept (sections 3–4) | later |
| 3 | `evaluate()` + numeric comparison of algebraic expressions | later |
| 4 | Comparison by standard form (order and grouping ignored) | later |
| 5 | Part-by-part comparison of structures (integral, limit, derivative, Σ/Π) | later |
| 6 | Logic and statement comparison (AND / OR, relations, rows) | later |
| 7 | Error objects, teacher-defined mistakes, he/en/ar texts | later |
| 8 | Highlighting errors by editor node id | later |

---

## 1. Goals

- Add a "submit and check" feature similar to the one in the chemistry keyboard
  (`chemistryLib/chemical-keyboard-v4.js`: `compareChemicalAnswers`, `ChemicalGrammar.compare`,
  `feedbackText`, `comparisonHighlights`).
- Compare the student's answer with the teacher's reference answer and report **all** errors, not only the first.
- Math has far more correct forms than chemistry (`2(x+1)` = `2x+2` = `(4x+4)/2`), so correctness cannot rest
  on structural identity alone.

### Two separate questions
1. **Is the value right?** Is the answer mathematically equal to the reference? Always checked.
2. **Is the form right?** Expanded, factored, simplified, reduced fraction, number of decimals, and so on. Set by the teacher per question.

---

## 2. Step 1: operators and panels (finalized)

### General rules
- **Key labels are never localized:** either a symbol or an English word.
- **Tooltips are localized** (he / en / ar).
- Each group, or sub-group where needed, is turned on by its own flag (`enabledBy`).

### Logic group
| Key | Label | Notes |
|---|---|---|
| AND | `∧` or `and` (still to decide which) | explicit key, **new** |
| OR | `∨` or `or` | explicit key, **new** |
| ⇒ | `⇒` | already exists; not used in answer checking for now |
| ∀, ∃ | `∀` `∃` | need a **separate flag** (e.g. `quantifiers`), off by default |

`∈` / `∉` **move out of Logic** into the new Sets group.

### Sets group (new)
| Kind | Keys | Tree level |
|---|---|---|
| Membership | `∈` `∉` | relation |
| Inclusion | `⊂` (strict/proper) `⊆` (non-strict) `⊄` `⊃` `⊇` | relation; `⊃` is stored reversed as `⊂` |
| Operations | `∪` `∖` (difference) `∩` | operators (see precedence table) |
| Complement | `A′` or `Ā` | wraps its operand, like `!` |
| Constants | `∅` `ℕ` `ℤ` `ℚ` `ℝ` | operand |

- **Strict vs non-strict inclusion:** two separate operators. If the student uses `⊆` where the reference has `⊂`,
  either the teacher adds several correct answers, or a flag (e.g. `exactInclusion`) decides whether the exact operator is required.
  This applies **only to sets**; `<` vs `≤` must always match.
- Left out: Cartesian product `×` (clashes with multiplication), power set, cardinality as a set operation.

### Relations (existing group)
`<` `≤` `>` `≥` `≠`, plus a **new relation `=` key** (the equation relation; distinct from the main-panel chain `=`, see 4.5).

### Vectors
- **Vectors are tuples** (same representation).
- v4 (since 2026-10-05): `structures.vector` = `"none" | "arrow" | "underline" | "both"` (`both` shows two buttons). The notation (`\vec` / `\underline`) is display only.
- Dot product and cross product: **pending**. The user will assess whether high-school math needs them.
  If added, they go at the `×` level, and the dot product needs a key distinct from `·` multiplication.

### Matrices
Out of scope for this keyboard.

### Rows (Enter key)
- A **new-line key** for systems of equations or inequalities: each statement on its own row, one above the other.
- The order of the rows doesn't matter for comparison (see 4.6).

### Comma
Only inside brackets:
| Use | Example |
|---|---|
| Tuple / point / vector | `(1, 2)`; the comma is what makes the parenthesized expression a tuple |
| Set | `{1, 2, 3}` |
| Interval | `(2, 5)`, `[2, 5)`; **clashes with a tuple**, so it needs its own interval structure (key) rather than guessing from context |
| Function with several arguments | `f(x, y)`, `max(a, b)`, `C(n, k)`; only if functions like these are offered |

- `x ≠ 0, 1` **is supported**: converted to `AND(x≠0, x≠1)` (equivalent to `x∉{0,1}`).
- `x = 2, 3` **is not accepted** (mathematically wrong). Students will write it, so it should be recognized
  and given specific feedback ("write x=2 ∨ x=3"); internally it can be converted to `OR` so the values can still be checked.

---

## 3. Representations

```
Editor AST  ──convert──►  Math tree  ──►  evaluate / standardize / compare
 (has ids)               (operator precedence,      │
     ▲                    each node keeps the       │ errors carry editor ids
     │                    ids of its source nodes)  ▼
     └──── LaTeX rendering with highlighted ids ◄───┘
```

- **Comparison is never done on LaTeX.** LaTeX is output only; it is never parsed.
- **Highlighting:** the renderer (`renderNode` / `renderSequence`) receives a set of editor ids and wraps those nodes
  (`\bbox` / `\color` / CSS class). So every math-tree node must keep `src` = the ids of its source editor nodes.
- **The reference answer and the teacher's mistake answers** are entered with the same keyboard and stored as editor AST JSON,
  then go through the same conversion. No text or LaTeX parser is needed.

### Open point in the code
`semanticSequence` (v4 around line 2944) already inserts implicit `×` operators, but its output is **flat**
(`{type:"sequence", items:[…]}`) with no precedence. Need to check whether it keeps editor `id`s. If not, either add the `id`,
or build the math tree straight from the editor AST using the `NODE_DEFS` information.

---

## 4. Math tree

### 4.1 General shape
- **Operator first:** `(op, operand1, operand2, …)`. Postfix operators are stored the same way: `n!` becomes `(!, n)`.
- **Not binary:** `+`, `×`, `∪`, `∩`, `AND`, `OR` take any number of operands and are flattened as they're built:
  `(a+b)+c` = `a+(b+c)` = `(+, a, b, c)`.
- **Form notes kept separately from the value:** fraction vs `÷`, mixed fraction, decimal vs fraction, scientific notation.
  Value comparison ignores them; form checks read them.
- **Implicit multiplication = explicit multiplication.** It's a display-only difference and plays no part in comparison
  (it's not even kept as a form note).

### 4.2 Decisions on specific cases
| Case | Decision |
|---|---|
| Division | The `/` key builds a fraction structure; the tree follows what's displayed: `1 / a b` gives `1/(ab)` (the cursor stays in the denominator) |
| `−x²` | = `−(x²)`; parentheses are redundant. `(−x)²` is different. Follows naturally because power takes the node before it as its base |
| `sin x` / `sin xy` | Handled by the keyboard: functions always show `()` with an input slot, so the argument is the function's own part |
| Postfix (`!` `%` `°` `′`) | Stored prefix: `(!, operand)`. `wrapPreviousPostfix` probably already wraps the operand; check this |
| `±` | Its own structure: `(±, a, b)` or `(±, b)`. **Not** merged into `+` (`a±b` ≠ `b±a`). Comparison is applied to its operands |
| `±` vs `∓` | All ±/∓ signs in an expression share one sign variable s∈{+1,−1}; `±`=s, `∓`=−s. The value is the set {value at s=+1, value at s=−1}. So `∓` ≡ `±` when only one kind appears; when both appear they're linked (`a±b∓c` = {a+b−c, a−b+c}) |
| Chain `3<x<5` | `AND(3<x, x<5)`. General rule: `e₁ R₁ e₂ R₂ e₃` → `AND(e₁R₁e₂, e₂R₂e₃)` |
| `>` / `⊃` | Stored reversed (`a>b` → `b<a`), so `5>x>3` = `3<x<5` |
| Equality `a=b` | Equals `b=a` |
| Rows | `AND(row₁, row₂, …)`, unordered. A row may contain an `OR` |

### 4.3 Precedence (loosest first)
| Level | Operators | Tree | Note |
|---|---|---|---|
| 1 | rows (Enter) | `(AND, [row₁, row₂, …])` | unordered |
| 2 | **chain `=`** (main-panel key) | chain of elements | assignment / derivation steps (see 4.5) |
| 3 | `∨` | `(OR, [A, B, …])` | any number of operands, unordered |
| 4 | `∧` | `(AND, [A, B, C])` | binds tighter than OR; `3<x ∧ x<5` needs no parentheses |
| 5 | **relation `=`** (relations panel) `≠` `<` `≤` `>` `≥` `∈` `∉` `⊂` `⊆` `⊄` `⊃` `⊇` | relation | a chain of relations → `AND` |
| 6 | `∪` `∖` | `∪` any number of operands; `∖` binary, left to right | like `+`/`−`: `A∪B∖C` = `(A∪B)∖C` |
| 7 | `∩` | any number of operands | like `×`: `A∪B∩C` = `A∪(B∩C)` |
| 8 | `+` `−` `±` (binary) | `+` any number of operands; `±` its own node | |
| 9 | `×` (explicit/implicit) | any number of operands | dot/cross product would go here if added |
| 10 | unary `−` `±` | prefix | `−ab` = `−(ab)` |
| 11 | structures, postfix, complement | operand | already wrap their operand |

- Set operators (5–6) and arithmetic operators (7–8) can't appear at the same level: `A∪B+1` is a type error with a message.
  A set element can contain arithmetic (`{x+1, 2}`).
- `⇒` (if ever used) would be looser than level 2.

### 4.3a Arithmetic tree shape (decided 2026-10-05)
Example `(7+x+3y)` → `(+, 7, x, (*, 3, y))`:
```json
{ "type": "operation", "op": "+", "src": [ids], "operands": [
    { "type": "number", "value": "7" },
    { "type": "variable", "name": "x" },
    { "type": "operation", "op": "*", "operands": [ {"type":"number","value":"3"}, {"type":"variable","name":"y"} ] } ] }
```
- `a−b` → `(+, a, (neg, b))`; leading/after-operator `−ab` → `(neg, (*, a, b))`.
- Implicit and explicit `×` are identical (the `implicit` flag is dropped).
- Parentheses disappear (the tree shows grouping); with a comma → `tuple`.
- A single item is the item itself (no wrapper).
- Every node keeps `src` (editor ids). **Checked:** the v4 semantic output does not keep ids, so this must be added.
- **Checked:** postfix (`!`, `%`) is already a structure (`wrapPreviousPostfix` replaces the previous item), so no parsing is needed.
- **Implemented in v4 (2026-10-05):** `getAST()` now returns this tree (it replaced the flat sequences;
  `getAST` was only used for debug). Parser: `semanticSequence` → `parseSemanticList` / `parseSemanticLevel` /
  `parseSemanticRelations` / `parseSemanticAdditive` / `parseSemanticTerm` / `parseSemanticFactor`.
  Node kinds: `operation` (`op`: `+`, `*`, `neg`, `plusMinus`, `minusPlus`, `and`, `or`, `implies`), `relation`
  (`op`, `left`, `right`), `tuple`, `set` (`elements`), `list` (comma-separated, internal), `missing` (empty operand).
  AND/OR levels are in the parser already; the keys only need to emit operators `and` / `or`.
- `showImplicitMultiply` is display only and no longer affects the tree; operands side by side without an operator (e.g. `2π`) are a product.
- Power and the `/` fraction are operations too: `(^, base, exponent)`, `(/, numerator, denominator)`
  (e.g. `1 / a b` → `(/ 1 (* a b))`). `simpleFraction` and `mixedFraction` keep their own types (form notes).

### 4.5 Two kinds of `=`
| | Chain `=` | Relation `=` |
|---|---|---|
| Entered from | main panel (existing key) | relations panel (**new key**, not in v4 yet) |
| Controlled by | the existing chain-length setting | the relations flag |
| Meaning | each element has the same value: derivation, or assignment like `x = 5` | equation: a statement that may be true or false |
| Precedence | lowest (level 2) | relation level (5) |
| Compared as | steps checked as identities; last element vs reference | equation equivalence (left − right proportional) |

- The user expects no real exercise to need both. Both are shown as the same `=`; the difference is only in the tree.
- The teacher configuration should pick one per exercise. If both are enabled, the meaning depends on which key was pressed, which the student can't see, so the configuration should prevent it or the documentation should warn.
- If both are ever needed, the chain `=` could get a subtle visual difference (e.g. wider spacing) without changing the tree.

### 4.4 Structures with named parts (existing in `NODE_DEFS`)
| Structure | Parts |
|---|---|
| `integral` | `lower`, `upper`, `integrand`, `variable` |
| `evaluation` (added to v4 on 2026-10-05) `F(x)\|ₐᵇ` | `base` (node), `lower`, `upper`; bounds mean the same as the integral's. After an operand, that operand becomes the base (`x\|₁²` = `(x)\|₁²`); where an expression is expected, an empty `(□)` base is created. Can appear several times in one expression |
| `limit` | `variable`, `target`, `direction`, `body` |
| `derivative` | `variable`, `expression` + `kind`, `order` |
| `indexedOperator` (sum/product) | `indexVariable`, `start`, `end`, `body` + `operator` |
| `prime` | `value` + `order` |

Other node types in v4: number, variable, constant, group, set, sqrt, nthRoot, power, fraction, simpleFraction,
mixedFraction, indexedVariable, logWithBase, absolute, vector, conjugate, variableName, function, namedFunction,
scientific, factorial, degree, percent, separator, operator.

---

## 5. Comparison strategy (for later steps)

### 5.1 Algebraic expressions: value
- **Substitute random numbers** for the variables (5–10 points) and compare with relative tolerance.
  No symbolic algebra and no CAS.
- Skip points where a function isn't defined (log, √, division by zero). The teacher can give a domain per variable.
- Trig and logs: sample within a sensible range, because periodicity can produce false matches.

### 5.2 Algebraic expressions: form (standard form, order and grouping ignored)
- Flatten `+` and `×`, sort their operands into a fixed order, drop redundant parentheses, standardize signs
  (`a−b` → `+[a, −b]`, minus moves to the front of a product).
- Needed especially when the goal is factoring.
- Which differences to ignore is a teacher setting (e.g. should `2·3x` match `6x`? `a/b` match `a·b⁻¹`?).
- **Matching factors** gives precise feedback:
  - one student factor = several reference factors multiplied together → "not fully factored"
  - a reference factor with no match → "factor missing"
  - `(2−x)` vs `(x−2)`: accept or flag, by teacher setting

### 5.3 Structures (integral, limit, derivative, Σ/Π)
- **Part by part, not numerically.** That's simpler and gives focused feedback.
  ```
  compare(student, reference):
    same structure type? → compare each part by its rule, collect errors
    both plain algebra?  → numeric comparison
    otherwise            → wrong-structure error
  ```
- Rules per part kind:
  | Kind | Rule | Examples |
  |---|---|---|
  | value | numeric, no variables | bounds, limit target, Σ start/end (∞ handled specially) |
  | variable | exact identity | `dx`, `x→`, index `k` |
  | exact | exact match | limit direction (empty = two-sided), derivative `kind`/`order` |
  | expression | numeric, after renaming the structure's own variable | integrand, limit body, Σ body |
- Renaming the structure's own variable: `∫f(t)dt` = `∫f(x)dx`.
- Common mistakes to detect: integral bounds swapped, missing `dx`, wrong variable; limit with wrong or missing direction;
  derivative of the wrong order or with respect to the wrong variable; Σ start/end off by one.
- **Fallback for alternative forms** (`2∫f` vs `∫2f`, shifted index): if the parts don't match, evaluate the whole structure
  numerically (Simpson's rule for a definite integral, a loop for a finite Σ). If the values agree, accept, optionally with a note.
- **No symbolic integration or differentiation is needed.** The teacher puts the result in the reference answer.
- Is the structure **the question** or **the answer**? When the answer is the result (e.g. an antiderivative `x²+C`),
  use "differs by a constant" mode plus a check that `+C` is present.

### 5.4 Logic and statements
- `AND` / `OR`: unordered matching of operands (like set elements).
- Relation chain `=`: can serve as a **derivation** (each link checked as an identity), giving the feedback
  "the mistake first appears in step N". The last expression is compared with the reference.
- `0<x<5`: compared as `AND` of two inequalities, so it equals `x>3 ∧ x<5` or two rows.
- Equation vs equation: (left − right) of the student must be a constant multiple of (left − right) of the reference.
- Inequalities: the same, plus the direction (and the sign flip when multiplying by a negative).
- Sets: order doesn't matter. Tuples / vectors: order matters.
- Open: should a derivation ever be required, or only allowed with just the last step graded?

### 5.5 Units and numbers
- Correct number with wrong unit; right quantity in a different unit (convert using the unit scale).
- Precision, decimals, rounding.

### 5.6 Pipeline (mirrors `compareChemicalAnswers`)
1. Syntax / completeness (empty placeholders)
2. Answer type (expression, equation, inequality, chain, set, tuple, number+unit, structure, AND/OR)
3. Value
4. Form (teacher's rules)
5. Units
6. Precision
Each step adds errors; don't stop at the first one.

### 5.7 Common mistakes
- **Teacher-defined mistakes:** the teacher enters typical wrong answers with the keyboard, each with a localized message.
  This gives the best feedback for the least code, and can replace complicated automatic checks.
- Matched with the same comparison as the correct answer, so `2+2x` matches a stored mistake `2x+2`.
- Order: correct answer, then teacher's mistakes, then generic automatic checks, then generic "wrong".
- Generic automatic checks (keep only the cheap ones): student = −reference (sign); a constant ratio (missing factor);
  difference is one reference term (missing term); ratio is a power of 10 (unit/scale); close but outside the tolerance (rounding).
- Limitation: a student with two mistakes at once won't match; gets a generic message.
- The teacher can also give **several correct answers**.

### 5.8 Output format (like chemistry)
```js
{ correct, errors: [{ code, expected, actual, slot, studentNodes, referenceNodes }], notes }
```
plus `feedbackText(language, code)` for he/en/ar. The `PLACEHOLDER_ID` texts for empty input slots
(e.g. `LOWER_BOUND`, `LIMIT_TARGET`) can be reused for messages like "the lower bound is wrong".

### 5.9 Highlighting
- Relevant, but later. Editor nodes and slots have `id`s, so highlighting is by id (not character ranges as in chemistry).
- Appropriate granularity: a wrong part, a term, a factor, a set element, a row.
- Keep the ids in the error objects from the start.

### 5.10 Teacher configuration (sketch)
```js
check: {
  reference: <editor AST JSON>,             // one or more correct answers
  answerKind: "expression" | "derivation" | "statement" | "collection" | ...,
  variables: { x: [-5, 5] },                // sampling domain
  tolerance: 1e-6,                           // or { decimals: 2 }
  form: ["simplified", "factored"],          // optional
  exactInclusion: false,
  mistakes: [ { answer: <editor AST JSON>, message: { he: "...", en: "...", ar: "..." } } ]
}
```

---

## 6. Rejected options and why

### AI engine for comparison at check time: no
- Privacy: school students' answers in a Ministry of Education system would be sent to an external service. Probably the deciding obstacle.
- Infrastructure: the tools server is a static Google Cloud Storage bucket, so there's no backend to keep an API key secret.
- Results vary between runs and models make algebra mistakes; a grade must be repeatable and explainable.
- Cost and speed for every student and every attempt.
- **Where AI does help:** when a question is authored, generate likely mistakes with feedback text and alternative correct forms;
  the teacher reviews them. No cost per student, no privacy issue, predictable checking.

### External math library
- **math.js:** parse, evaluate, simplify, symbolic derivative. No integrals, limits or Σ notation, and doesn't read LaTeX.
- **CortexJS Compute Engine:** reads LaTeX into MathJSON (including `\int` `\sum` `\lim`), numeric evaluation of integrals and limits,
  symbolic derivatives. It may read the keyboard's LaTeX differently than intended.
- Conclusion: neither gives part-by-part feedback, and both lose the editor ids. At most, a library could serve as `evaluate()`.
  Choose it (or none) only on the quality of its evaluation. The structural layer is built on our own tree in any case.
  (These library details are from memory and should be verified before deciding.)

---

## 7. Open decisions
- AND/OR key label: `∧`/`∨` or `and`/`or`.
- Dot product and cross product: are they needed?
- Interval structure (key) to avoid the clash with tuples.
- Does a derivation need to be a required kind of answer?
- Whether `semanticSequence` output keeps ids (section 3).
- Whether postfix is already a structure (`wrapPreviousPostfix`).
