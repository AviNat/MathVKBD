/*
 * Automated tests for MoodleMathKeyboard (fullKbdLib-v4.js).
 *
 * Each case types a key sequence through the internal API (no physical key
 * events) and compares the semantic tree from getAST() with a reference
 * written in a compact, human-readable notation:
 *
 *   (+ 7 x (* 3 y))         operation: operator first, then operands
 *   (less 3 x)              relation
 *   ?                       missing operand (empty slot)
 *   ∅                       empty / absent part
 *   tuple[1, 2]  set{1, 2}  vec(u)  sin(x)  x_1
 *   integral<lower=0 upper=1 ...>   other structures: type<part=value ...>
 *   a ‖ b                   chain elements (main-panel "=")
 *
 * Keys (space separated):
 *   0-9 .            digits, decimal point
 *   a single letter  variable (from the test variables)
 *   + - *            operators          /  fraction (÷ key)   frac  simple fraction
 *   ^  ^2  ^-1       power, fixed exponents                    _  subscript
 *   ( { ,            group, set, comma                         |  evaluation bar
 *   =                chain "=" (main panel)
 *   < > <= >= != ≈   relations          ± ∓  plus-minus / minus-plus
 *   ! %              factorial, percent π  pi
 *   √ ⁿ√ abs conj    roots, absolute value, conjugate
 *   ∫ Σ Π lim d/dx ∂ integral, sum, product, limit, derivative, partial derivative
 *   vec vec_         vector with arrow / underline
 *   sin cos tan ln log logb f()   functions, log with base, named function
 *   ' sci            prime, scientific notation
 *   ← → DEL AC       navigation, delete left, clear all
 *
 * Used by kbdTestHarness.html.
 */
(function (global) {
"use strict";

let TEST_VARIABLES = ["a", "b", "c", "f", "n", "t", "u", "x", "y"].map(function (v) {
    return { id: v, label: v, latex: v };
});

/* --------------------------------------------------------------
   Test cases. "expect" is the reference result - verify it by eye
   before accepting it (the harness shows the rendered expression).
   -------------------------------------------------------------- */
let CASES = [
    /* Arithmetic and precedence */
    { group: "Arithmetic", name: "sum with product", keys: "7 + x + 3 y", expect: "(+ 7 x (* 3 y))" },
    { group: "Arithmetic", name: "parentheses disappear", keys: "( 7 + x + 3 y", expect: "(+ 7 x (* 3 y))" },
    { group: "Arithmetic", name: "minus is + neg", keys: "a - b + c", expect: "(+ a (neg b) c)" },
    { group: "Arithmetic", name: "unary minus on a product", keys: "- a b", expect: "(neg (* a b))" },
    { group: "Arithmetic", name: "signed factor", keys: "2 * - 3", expect: "(* 2 (neg 3))" },
    { group: "Arithmetic", name: "flatten (a+b)+c", keys: "( a + b → + c", expect: "(+ a b c)" },
    { group: "Arithmetic", name: "flatten a(bc)", keys: "a * ( b * c", expect: "(* a b c)" },
    { group: "Arithmetic", name: "product of groups", keys: "( a + b → ( a - b", expect: "(* (+ a b) (+ a (neg b)))" },
    { group: "Arithmetic", name: "decimal", keys: "2 . 5 x", expect: "(* 2.5 x)" },
    { group: "Arithmetic", name: "constant pi", keys: "2 π", expect: "(* 2 pi)" },
    { group: "Arithmetic", name: "incomplete", keys: "x +", expect: "(+ x ?)" },
    { group: "Arithmetic", name: "factorial", keys: "5 ! + 1", expect: "(+ factorial<value=5> 1)" },
    { group: "Arithmetic", name: "implicit × with display off", keys: "3 y", config: { showImplicitMultiply: false }, expect: "(* 3 y)" },

    /* Powers and fractions */
    { group: "Powers & fractions", name: "power then factor", keys: "x ^ 2 → 3", expect: "(* (^ x 2) 3)" },
    { group: "Powers & fractions", name: "expression exponent", keys: "x ^ a + 1", expect: "(^ x (+ a 1))" },
    { group: "Powers & fractions", name: "fixed exponent key", keys: "x ^2", expect: "(^ x 2)" },
    { group: "Powers & fractions", name: "reciprocal key", keys: "x ^-1", expect: "(^ x -1)" },
    { group: "Powers & fractions", name: "power of power", keys: "2 ^ 3 ^ 2", expect: "(^ 2 (^ 3 2))" },
    { group: "Powers & fractions", name: "-x² is -(x²)", keys: "- x ^2", expect: "(neg (^ x 2))" },
    { group: "Powers & fractions", name: "empty exponent", keys: "x ^", expect: "(^ x ?)" },
    { group: "Powers & fractions", name: "1/a then b stays in denominator", keys: "1 / a b", expect: "(/ 1 (* a b))" },
    { group: "Powers & fractions", name: "group as numerator", keys: "( a + b → / c", expect: "(/ (+ a b) c)" },
    { group: "Powers & fractions", name: "exit fraction with →", keys: "1 / a → + b", expect: "(+ (/ 1 a) b)" },
    { group: "Powers & fractions", name: "empty denominator", keys: "a /", expect: "(/ a ?)" },

    /* Subscripts */
    { group: "Subscripts", name: "expression subscript", keys: "x _ n + 1", expect: "x_(+ n 1)" },
    { group: "Subscripts", name: "→ out of subscript", keys: "x _ n + 1 → + 2", expect: "(+ x_(+ n 1) 2)" },
    { group: "Subscripts", name: "power of indexed variable", keys: "x _ n - 1 → ^ 2", expect: "(^ x_(+ n (neg 1)) 2)" },
    { group: "Subscripts", name: "multi-digit subscript", keys: "x _ 1 2", expect: "x_12" },
    { group: "Subscripts", name: "product of indexed variables", keys: "a _ 1 → a _ 2", expect: "(* a_1 a_2)" },
    { group: "Subscripts", name: "two indices", keys: "x _ t , u", expect: "x_list[t, u]" },
    { group: "Subscripts", name: "coefficient", keys: "2 x _ n", expect: "(* 2 x_n)" },
    { group: "Subscripts", name: "parentheses not allowed in subscript", keys: "x _ ( n", expect: "x_n" },
    { group: "Subscripts", name: "← ← out to the left", keys: "x _ n ← ← y", expect: "(* y x_n)" },
    { group: "Subscripts", name: "DEL empty subscript", keys: "x _ DEL", expect: "x" },
    { group: "Subscripts", name: "DEL subscript content then subscript", keys: "x _ n DEL DEL", expect: "x" },
    { group: "Subscripts", name: "DEL after subscript deletes it whole", keys: "x _ n + 1 → DEL", expect: "∅" },
    { group: "Subscripts", name: "← into subscript, DEL", keys: "x _ n + 1 → ← DEL", expect: "x_(+ n ?)" },

    /* Signs and relations */
    { group: "Signs & relations", name: "a ± b", keys: "a ± b", expect: "(plusMinus a b)" },
    { group: "Signs & relations", name: "unary ±", keys: "± a", expect: "(plusMinus a)" },
    { group: "Signs & relations", name: "± inside a sum", keys: "x + a ± b - c", expect: "(+ (plusMinus (+ x a) b) (neg c))" },
    { group: "Signs & relations", name: "relation chain → and", keys: "3 < x < 5", expect: "(and (less 3 x) (less x 5))" },
    { group: "Signs & relations", name: "not equal", keys: "x != 2", expect: "(notEqual x 2)" },
    { group: "Signs & relations", name: "chain =", keys: "x = 2 x", expect: "x ‖ (* 2 x)" },

    /* Tuples and sets */
    { group: "Tuples & sets", name: "tuple", keys: "( 1 , 2", expect: "tuple[1, 2]" },
    { group: "Tuples & sets", name: "set", keys: "{ 1 , x + 1", expect: "set{1, (+ x 1)}" },
    { group: "Tuples & sets", name: "vector in set", keys: "{ vec u", expect: "set{vec(u)}" },

    /* Structures */
    { group: "Structures", name: "evaluation after operand", keys: "x | 1 → 2", expect: "evaluation<base=x lower=1 upper=2>" },
    { group: "Structures", name: "evaluation on empty display", keys: "| x + 1", expect: "evaluation<base=(+ x 1) lower=∅ upper=∅>" },
    { group: "Structures", name: "evaluation takes only previous operand", keys: "2 x | 1", expect: "(* 2 evaluation<base=x lower=1 upper=∅>)" },
    { group: "Structures", name: "two evaluations", keys: "x | 0 → 1 → → - y | 0", expect: "(+ evaluation<base=x lower=0 upper=1> (neg evaluation<base=y lower=0 upper=∅>))" },
    { group: "Structures", name: "vector with arrow", keys: "2 vec u", expect: "(* 2 vec(u))" },
    { group: "Structures", name: "vector with index", keys: "vec x _ 1", expect: "vec(x_1)" },
    { group: "Structures", name: "vector underline", keys: "0 . 5 vec_ u", expect: "(* 0.5 vec(u))" },
    { group: "Structures", name: "absolute value", keys: "abs x - 1", expect: "abs((+ x (neg 1)))" },
    { group: "Structures", name: "sine", keys: "sin x", expect: "sin(x)" },
    { group: "Structures", name: "square root", keys: "√ x + 1", expect: "sqrt((+ x 1))" },
    { group: "Structures", name: "nth root", keys: "ⁿ√ 3 x", expect: "nthRoot<index=3 content=x>" },
    { group: "Structures", name: "simple fraction", keys: "frac 1 → 2", expect: "simpleFraction<numerator=1 denominator=2>" },
    { group: "Structures", name: "log with base", keys: "logb 2 → 8", expect: "log_2(8)" },
    { group: "Structures", name: "named function", keys: "f() f → x", expect: "f(x)" },
    { group: "Structures", name: "power of a function", keys: "sin x → ^2", expect: "(^ sin(x) 2)" },
    { group: "Structures", name: "definite integral", keys: "∫ 0 → 1 → x ^2 → x", expect: "integral<lower=0 upper=1 integrand=(^ x 2) variable=x>" },
    { group: "Structures", name: "sum", keys: "Σ n 1 → 1 0 → n ^2", expect: "sum<indexVariable=n start=1 end=10 body=(^ n 2)>" },
    { group: "Structures", name: "limit without direction", keys: "lim x 0 → → sin x", expect: "limit<variable=x target=0 direction=∅ body=sin(x)>" },
    { group: "Structures", name: "derivative", keys: "d/dx x x ^2", expect: "derivative<kind=ordinary order=1 variable=x expression=(^ x 2)>" },

    /* Navigation */
    { group: "Navigation", name: "← ← then type at start", keys: "a b ← ← x", expect: "(* x a b)" },
    { group: "Navigation", name: "← to start of a sum", keys: "a + b ← ← ← c", expect: "(+ (* c a) b)" },
    { group: "Navigation", name: "→ at end does nothing", keys: "( a → → b", expect: "(* a b)" },
    { group: "Navigation", name: "← on empty does nothing", keys: "← ← a", expect: "a" },
    { group: "Navigation", name: "→ out of exponent", keys: "x ^ 2 → → y", expect: "(* (^ x 2) y)" },
    { group: "Navigation", name: "→ out of square root", keys: "√ x → + 1", expect: "(+ sqrt(x) 1)" },
    { group: "Navigation", name: "→ out of absolute value", keys: "abs x → y", expect: "(* abs(x) y)" },
    { group: "Navigation", name: "← from denominator into numerator", keys: "1 / 2 ← ← ← 3", expect: "(/ 13 2)" },
    { group: "Navigation", name: "digit before a number joins it", keys: "1 2 ← ← 5", expect: "512" },
    { group: "Navigation", name: "digit at start of denominator", keys: "1 / 2 ← ← 3", expect: "(/ 1 32)" },
    { group: "Navigation", name: "← into exponent", keys: "x ^ 2 → ← ← y", expect: "(^ x (* y 2))" },

    /* Delete */
    { group: "Delete", name: "delete a digit", keys: "1 2 3 DEL", expect: "12" },
    { group: "Delete", name: "delete operator and operand", keys: "a + b DEL DEL", expect: "a" },
    { group: "Delete", name: "delete in the middle", keys: "a b c ← DEL", expect: "(* a c)" },
    { group: "Delete", name: "empty exponent keeps base", keys: "x ^ DEL", expect: "x" },
    { group: "Delete", name: "exponent then power", keys: "x ^ 2 DEL DEL", expect: "x" },
    { group: "Delete", name: "empty group", keys: "( DEL", expect: "∅" },
    { group: "Delete", name: "empty square root", keys: "√ DEL", expect: "∅" },
    { group: "Delete", name: "empty conjugate", keys: "conj DEL", expect: "∅" },
    { group: "Delete", name: "empty evaluation keeps base", keys: "x | DEL", expect: "x" },
    { group: "Delete", name: "empty evaluation without base", keys: "| DEL", expect: "∅" },
    { group: "Delete", name: "empty integral", keys: "∫ DEL", expect: "∅" },
    { group: "Delete", name: "empty vector", keys: "vec DEL", expect: "∅" },
    { group: "Delete", name: "function emptied", keys: "sin x DEL DEL", expect: "∅" },
    { group: "Delete", name: "empty denominator moves to numerator", keys: "1 / DEL 5", expect: "(/ 15 ?)" },
    { group: "Delete", name: "delete before ±", keys: "a ± b ← ← DEL", expect: "(plusMinus b)" },
    /* intended: DEL right after a structure deletes it whole; move inside (←) to delete part of it */
    { group: "Delete", name: "DEL after a group deletes the whole group", keys: "( x + 3 + y → DEL", expect: "∅" },
    { group: "Delete", name: "← into the group, DEL deletes one item", keys: "( x + 3 + y → ← DEL", expect: "(+ x 3 ?)" },
    { group: "Delete", name: "← into the group, DEL DEL", keys: "( x + 3 + y → ← DEL DEL", expect: "(+ x 3)" },
    { group: "Delete", name: "DEL after a square root deletes it whole", keys: "√ x + 1 → DEL", expect: "∅" },
    { group: "Delete", name: "← into the square root, DEL", keys: "√ x + 1 → ← DEL", expect: "sqrt((+ x ?))" },
    { group: "Delete", name: "clear all", keys: "a + b AC", expect: "∅" }
];

/* --------------------------------------------------------------
   Compact notation of a semantic node
   -------------------------------------------------------------- */
function show(node) {
    if (node === null || node === undefined) return "∅";
    if (typeof node !== "object") return String(node);

    switch (node.type) {
        case "number": return node.value;
        case "variable": return node.name;
        case "constant": return node.name;
        case "missing": return "?";
        case "operation": return "(" + node.op + " " + node.operands.map(show).join(" ") + ")";
        case "relation": return "(" + node.op + " " + show(node.left) + " " + show(node.right) + ")";
        case "tuple": return "tuple[" + node.elements.map(show).join(", ") + "]";
        case "set": return "set{" + node.elements.map(show).join(", ") + "}";
        case "list": return "list[" + node.items.map(show).join(", ") + "]";
        case "variableName": return node.name + (node.subscript ? "_" + show(node.subscript) : "");
        case "indexedVariable": return show(node.variable) + "_" + show(node.subscript);
        case "vector": return "vec(" + show(node.name) + ")";
        case "function": return node.name + (node.base !== undefined ? "_" + show(node.base) : "") + "(" + show(node.argument) + ")";
        case "namedFunction":
            return show(node.name) +
                (node.inverseFunction ? "^-1" : new Array((node.primeOrder || 0) + 1).join("'")) +
                (node.superscript ? "^" + show(node.superscript) : "") +
                "(" + show(node.argument) + ")";
    }

    return node.type + "<" + Object.keys(node).filter(function (key) {
        return key !== "type" && key !== "src" && node[key] !== undefined;
    }).map(function (key) {
        return key + "=" + show(node[key]);
    }).join(" ") + ">";
}

/* --------------------------------------------------------------
   Keys -> internal API
   -------------------------------------------------------------- */
let KEY_ACTIONS = {
    ".": function (k) { k.insertDecimal(); },
    "+": function (k) { k.insertOperator("+", true); },
    "-": function (k) { k.insertOperator("-", true); },
    "*": function (k) { k.insertOperator("*", true); },
    "/": function (k) { k.insertDivide(); },
    "frac": function (k) { k.insertSimpleFraction(); },
    "^": function (k) { k.insertPower(); },
    "^2": function (k) { k.insertFixedExponent("2"); },
    "^-1": function (k) { k.insertFixedExponent("-1"); },
    "_": function (k) { k.insertSubscript(); },
    "(": function (k) { k.insertGroup(); },
    "{": function (k) { k.insertSet(); },
    ",": function (k) { k.insertSeparator({ id: "comma" }); },
    "|": function (k) { k.insertEvaluation(); },
    "=": function (k) { k.insertEquals(); },
    "<": function (k) { k.insertOperator("less", true); },
    ">": function (k) { k.insertOperator("greater", true); },
    "<=": function (k) { k.insertOperator("lessEqual", true); },
    ">=": function (k) { k.insertOperator("greaterEqual", true); },
    "!=": function (k) { k.insertOperator("notEqual", true); },
    "≈": function (k) { k.insertOperator("approximate", true); },
    "±": function (k) { k.insertOperator("plusMinus", true); },
    "∓": function (k) { k.insertOperator("minusPlus", true); },
    "!": function (k) { k.insertPhysicalSymbol("factorial"); },
    "%": function (k) { k.insertPhysicalSymbol("percent"); },
    "π": function (k) { k.insertConstant("pi", "\\pi "); },
    "√": function (k) { k.insertSqrt(); },
    "ⁿ√": function (k) { k.insertNthRoot(); },
    "abs": function (k) { k.insertAbsolute(); },
    "conj": function (k) { k.insertConjugate(); },
    "∫": function (k) { k.insertIntegral(); },
    "Σ": function (k) { k.insertIndexedOperator("sum"); },
    "Π": function (k) { k.insertIndexedOperator("product"); },
    "lim": function (k) { k.insertLimit(); },
    "d/dx": function (k) { k.insertDerivative("ordinary"); },
    "∂": function (k) { k.insertDerivative("partial"); },
    "vec": function (k) { k.insertVector("arrow"); },
    "vec_": function (k) { k.insertVector("underline"); },
    "sin": function (k) { k.insertFunction("sin", "\\sin", null); },
    "cos": function (k) { k.insertFunction("cos", "\\cos", null); },
    "tan": function (k) { k.insertFunction("tan", "\\tan", null); },
    "ln": function (k) { k.insertFunction("ln", "\\ln", null); },
    "log": function (k) { k.insertFunction("log10", "\\log", null); },
    "logb": function (k) { k.insertLogWithBase(); },
    "f()": function (k) { k.insertNamedFunction(); },
    "'": function (k) { k.applyPrime(); },
    "sci": function (k) { k.insertScientific(); },
    "←": function (k) { k.moveCursor(-1); },
    "→": function (k) { k.moveCursor(1); },
    "DEL": function (k) { k.deleteLeft(); },
    "AC": function (k) { k.clearAll(); }
};

function pressKey(k, key) {
    if (/^[0-9]$/.test(key)) return k.insertDigit(key);

    if (/^[a-z]$/.test(key)) {
        let variable = k.config.variables.filter(function (v) { return v.id === key; })[0];
        if (!variable) throw new Error("variable not in the test variables: " + key);
        return k.insertVariable(variable, false);
    }

    if (!Object.prototype.hasOwnProperty.call(KEY_ACTIONS, key)) throw new Error("unknown key: " + key);
    KEY_ACTIONS[key](k);
}

function showChain(ast) {
    return ast.elements.map(show).join(" ‖ ");
}

/*
 * Run all cases. KeyboardClass = window.MoodleMathKeyboard; host = a DOM
 * element that receives a temporary container for each keyboard.
 */
function run(KeyboardClass, host) {
    let results = [];
    let i;

    for (i = 0; i < CASES.length; i += 1) {
        let testCase = CASES[i];
        let div = document.createElement("div");
        let options = { physicalKeyboard: false, variables: TEST_VARIABLES };
        let result = { testCase: testCase, actual: null, latex: "", editingLatex: "", error: null, pass: false };
        let key;

        div.id = "kbdTestHost" + i;
        host.appendChild(div);
        options.divId = div.id;

        if (testCase.config) {
            for (key in testCase.config) {
                if (Object.prototype.hasOwnProperty.call(testCase.config, key)) options[key] = testCase.config[key];
            }
        }

        try {
            let k = new KeyboardClass(options);

            testCase.keys.split(/\s+/).filter(Boolean).forEach(function (key) { pressKey(k, key); });

            result.actual = showChain(k.getAST());
            result.latex = k.getLatex();
            result.editingLatex = k.getEditingLatex();
            result.pass = result.actual === testCase.expect;
            k.destroy();
        } catch (e) {
            result.error = e.message;
        }

        host.removeChild(div);
        results.push(result);
    }

    return results;
}

global.KbdTests = {
    cases: CASES,
    variables: TEST_VARIABLES,
    show: show,
    pressKey: pressKey,
    run: run
};
})(window);
