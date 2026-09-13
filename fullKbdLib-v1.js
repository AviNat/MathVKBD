/*
 * MoodleMathKeyboard V2
 * Reusable virtual mathematical keyboard library.
 *
 * Host page requirements:
 *   1. A container DIV.
 *   2. MathJax 3 loaded by the host page.
 *   3. This JavaScript library.
 *   4. new MoodleMathKeyboard({...})
 *
 * The library creates all keyboard DOM and styling dynamically.
 * The host page does not need CSS.
 */
(function () {
"use strict";
/* ============================================================
   DEFAULT CONFIGURATION
   ============================================================ */
let DEFAULT_CONFIG = {
    divId: null,
    readOnly: false,
    debug: false,
    complexNumbers: true,
    enableEquals: true,
    multiplicationSymbol: "cdot",
    variables: [
        { id: "x", label: "x", latex: "x" },
        { id: "y", label: "y", latex: "y" },
        { id: "z", label: "z", latex: "z" }
    ],
    functions: {
        logarithmic: true,
        trigonometric: true,
        inverseTrigonometric: true,
        hyperbolic: true,
        inverseHyperbolic: true,
        namedFunction: true
    },
    structures: {
        integral: true,
        summation: true,
        product: true,
        limit: true,
        absoluteValue: true,
        vector:true,
        derivative: true,
        partialDerivative: true
    },
    symbols: {
        infinity: true,
        degrees: true,
        factorial: true,
        approximate: true,
        inequalities: true,
        logic: true
    },
    getValueFunc: null,
    setValueFunc: null,
    onChange: null
};
/* ============================================================
   CONSTRUCTOR
   ============================================================ */
function MoodleMathKeyboard(options) {
    let key;
    options = options || {};
    this.config = {};
    for (key in DEFAULT_CONFIG) {
        if (Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, key)) {
            this.config[key] = DEFAULT_CONFIG[key];
        }
    }
    for (key in options) {
        if (Object.prototype.hasOwnProperty.call(options, key)) {
            this.config[key] = options[key];
        }
    }
    this.nextId = 1;
    this.editorAST = this.makeChain();
    this.cursor = {
        seqId: this.editorAST.elements[0].id,
        offset: 0,
        textNodeId: null,
        charOffset: null
    };
    this.openPanels = {
        variables: false,
        functions: false,
        symbols: false,
        structures: false,
        units: false
    };
    this.mathJaxPromise = Promise.resolve();
    this.root = null;
    this.display = null;
    this.keyboardArea = null;
    this.mainPanel = null;
    this.sidePanelsArea = null;
    this.panelElements = {};
    this.debugLatex = null;
    this.debugAST = null;
    this.unitValue = "";
    this.unitScale = 1;

    this.popup = null;
    this.dragBar = null;
    this.isDragging = false;
    this.dragDX = 0;
    this.dragDY = 0;
    this.keyboardToggleButton = null;
       
    if (!window.MoodleMathKeyboardInstanceCounter) {
        window.MoodleMathKeyboardInstanceCounter = 0;
    }
    window.MoodleMathKeyboardInstanceCounter += 1;
    this.cursorMarkerId =
        "mathKbdCursorMarker" +
        window.MoodleMathKeyboardInstanceCounter;
    this.caret = null;
    this.displayContainer = null;
        this.init();
        
    if (this.config.physicalKeyboard !== false) {
        this.installPhysicalKeyboard();
    }
}

MoodleMathKeyboard.prototype.positionCaret = function () {
    if (!this.caret) return;

    let marker = document.getElementById(this.cursorMarkerId);

    if (!marker) {
        this.caret.style.display = "none";
        return;
    }

    let markerRect = marker.getBoundingClientRect();
    let containerRect = this.displayContainer.getBoundingClientRect();

    marker.style.opacity = "0";
    this.caret.style.left = (markerRect.left - containerRect.left) + "px";
    this.caret.style.top = (markerRect.top - containerRect.top) + "px";
    this.caret.style.height = markerRect.height + "px";
    this.caret.style.display = "block";
};

/* ============================================================
   physical keys
   ============================================================ */
MoodleMathKeyboard.prototype.findVariableForKey = function (key) {
    let i;
    let def;

    for (i = 0; i < this.config.variables.length; i += 1) {
        def = this.config.variables[i];

        if (def.id === key) return def;
        if (def.label === key) return def;
    }

    return null;
};

MoodleMathKeyboard.prototype.handlePhysicalKey = function (event) {
    if (this.config.readOnly) return;
    let target = event.target;
    let key = event.key;

    if (event.ctrlKey || event.metaKey ||  event.altKey) {  return; }

    if ( key === "Enter" || key === " " ) {
        event.preventDefault();
        return;
    }
    if (  target && 
        (
            target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable
        )
    ) {
        return;
    }

    let variable;

    if (key >= "0" && key <= "9") {
        event.preventDefault();
        this.insertDigit(key);
        return;
    }
    if (key === ",") {
        event.preventDefault();
        this.insertSeparator(COMMA_SYMBOL);
        return;
    }

    if (key === "." || key === "Decimal") {
        event.preventDefault();
        this.insertDecimal();
        return;
    }

    if (key === "+") {
        event.preventDefault();
        this.insertOperator("+", true);
        return;
    }

    if (key === "-") {
        event.preventDefault();
        this.insertOperator("-", true);
        return;
    }

    if (key === "*" || key === "Multiply") {
        event.preventDefault();
        this.insertOperator("*", true);
        return;
    }

    if (key === "/" || key === "Divide") {
        event.preventDefault();
        this.insertDivide();
        return;
    }

    if (key === "=") {
        event.preventDefault();
        this.insertEquals();
        return;
    }

    if (key === "Backspace") {
        event.preventDefault();
        this.deleteLeft();
        return;
    }

    if (key === "ArrowLeft") {
        event.preventDefault();
        this.moveCursor(-1);
        return;
    }

    if (key === "ArrowRight") {
        event.preventDefault();
        this.moveCursor(1);
        return;
    }
    if (key === "(") {
        event.preventDefault();
        this.insertGroup();
        return;
    }

    if (key.length === 1 && key >= "a" && key <= "z") {
    variable = this.findVariableForKey(key);

    if (!variable && this.config.acceptLowercaseVariables) {
        variable = {
            id: key,
            label: key,
            latex: key
        };
    }

    if (variable) {
        event.preventDefault();
        this.insertVariable(variable);
    }

    return;
}

    if (key.length === 1 && key >= "A" && key <= "Z") {
        variable = this.findVariableForKey(key);

        if (!variable && this.config.acceptUppercaseVariables) {
            variable = {
                id: key,
                label: key,
                latex: key
            };
        }

        if (variable) {
            event.preventDefault();
            this.insertVariable(variable);
        }

        return;
}
};

MoodleMathKeyboard.prototype.installPhysicalKeyboard = function () {
    let self = this;

    this.physicalKeyHandler = function (event) {
        self.handlePhysicalKey(event);
    };

    document.addEventListener("keydown", this.physicalKeyHandler);
};

/* ============================================================
   NODE FACTORIES
   ============================================================ */
MoodleMathKeyboard.prototype.newId = function () {
    let value = this.nextId;
    this.nextId += 1;
    return value;
};
MoodleMathKeyboard.prototype.makeSequence = function (items, syntax) {
    return {
        id: this.newId(),
        type: "sequence",
        items: items || [],
        syntax: syntax || "expression"
    };
};
MoodleMathKeyboard.prototype.makeChain = function () {
    return {
        id: this.newId(),
        type: "chain",
        elements: [this.makeSequence([])]
    };
};
MoodleMathKeyboard.prototype.makeNumber = function (text) {
    return {
        id: this.newId(),
        type: "number",
        text: text
    };
};
MoodleMathKeyboard.prototype.makeVariable = function (def) {
    return {
        id: this.newId(),
        type: "variable",
        name: def.id,
        latex: def.latex || def.label || def.id
    };
};
MoodleMathKeyboard.prototype.makeConstant = function (name, latex) {
    return {
        id: this.newId(),
        type: "constant",
        name: name,
        latex: latex
    };
};
/* ============================================================
   TREE WALKING
   ============================================================ */
MoodleMathKeyboard.prototype.eachChild = function (node, callback) {
    let i;
    if (!node) return;
    if (node.type === "chain") {
        for (i = 0; i < node.elements.length; i += 1) callback(node.elements[i]);
        return;
    }
    if (node.type === "sequence") {
        for (i = 0; i < node.items.length; i += 1) callback(node.items[i]);
        return;
    }
    if (node.type === "group" ||
        node.type === "sqrt" ||
        node.type === "absolute") {
        callback(node.content);
        return;
    }
    if (node.type === "set") {
        callback(node.content);
        return;
    }
    if (node.type === "fraction" || node.type === "simpleFraction") {
        callback(node.numerator);
        callback(node.denominator);
        return;
    }
    if (node.type === "mixedFraction") {
        callback(node.whole);
        callback(node.numerator);
        callback(node.denominator);
        return;
    }
    if (node.type === "power") {
        callback(node.base);
        callback(node.exponent);
        return;
    }
    if (node.type === "nthRoot") {
        callback(node.index);
        callback(node.content);
        return;
    }
    if (node.type === "indexedVariable") {
        callback(node.variable);
        callback(node.subscript);
        return;
    }
    if (node.type === "function" || node.type === "namedFunction") {
        if (node.type === "namedFunction") callback(node.name);
        if (node.superscript) callback(node.superscript);
        callback(node.argument);
        return;
    }
    if (node.type === "functionWithBase") {
        callback(node.base);
        callback(node.argument);
        return;
    }
    if (node.type === "integral") {
        callback(node.lower);
        callback(node.upper);
        callback(node.integrand);
        callback(node.variable);
        return;
    }
    if (node.type === "indexedOperator") {
        callback(node.indexVariable);
        callback(node.start);
        callback(node.end);
        callback(node.body);
        return;
    }
    if (node.type === "limit") {
        callback(node.variable);
        callback(node.target);
        callback(node.direction);
        callback(node.body);
        return;
    }
    if (node.type === "derivative") {
        callback(node.variable);
        callback(node.expression);
        return;
    }
    if (node.type === "vector") {
        callback(node.name);
        return;
    }
    if (node.type === "scientific") {
        callback(node.coefficient);
        callback(node.exponent);
        return;
    }
    if (node.type === "factorial" || node.type === "degree" || node.type === "percent" || 
        node.type === "prime") {
        callback(node.value);
    }
};
MoodleMathKeyboard.prototype.findNode = function (node, nodeId) {
    let self = this;
    let result = null;
    if (!node) return null;
    if (node.id === nodeId) return node;
    this.eachChild(node, function (child) {
        if (result) return;
        result = self.findNode(child, nodeId);
    });
    return result;
};
MoodleMathKeyboard.prototype.findParent = function (node, nodeId) {
    let self = this;
    let result = null;
    let i;
    function inspect(child, key, index) {
        if (result || !child) return;
        if (child.id === nodeId) {
            result = {
                parent: node,
                key: key,
                index: index
            };
            return;
        }
        result = self.findParent(child, nodeId);
    }
    if (!node) return null;
    if (node.type === "chain") {
        for (i = 0; i < node.elements.length && !result; i += 1) {
            inspect(node.elements[i], "elements", i);
        }
    } else if (node.type === "sequence") {
        for (i = 0; i < node.items.length && !result; i += 1) {
            inspect(node.items[i], "items", i);
        }
    } else if (node.type === "group" ||
               node.type === "sqrt" ||
               node.type === "absolute") {
        inspect(node.content, "content", null);
    } else if (node.type === "set") {
        inspect(node.content, "content", null);
    } else if (node.type === "fraction" || node.type === "simpleFraction") {
        inspect(node.numerator, "numerator", null);
        inspect(node.denominator, "denominator", null);
    } else if (node.type === "mixedFraction") {
        inspect(node.whole, "whole", null);
        inspect(node.numerator, "numerator", null);
        inspect(node.denominator, "denominator", null);
    } else if (node.type === "power") {
        inspect(node.base, "base", null);
        inspect(node.exponent, "exponent", null);
    } else if (node.type === "nthRoot") {
        inspect(node.index, "index", null);
        inspect(node.content, "content", null);
    } else if (node.type === "indexedVariable") {
        inspect(node.variable, "variable", null);
        inspect(node.subscript, "subscript", null);     
    } else if (node.type === "function") {
        if (node.superscript) inspect(node.superscript, "superscript", null);
        inspect(node.argument, "argument", null);
    } else if (node.type === "namedFunction") {
        inspect(node.name, "name", null);
        if (node.superscript) inspect(node.superscript, "superscript", null);
        inspect(node.argument, "argument", null);
    } else if (node.type === "functionWithBase") {
        inspect(node.base, "base", null);
        inspect(node.argument, "argument", null);
    } else if (node.type === "integral") {
        inspect(node.lower, "lower", null);
        inspect(node.upper, "upper", null);
        inspect(node.integrand, "integrand", null);
        inspect(node.variable, "variable", null);
    } else if (node.type === "indexedOperator") {
        inspect(node.indexVariable, "indexVariable", null);
        inspect(node.start, "start", null);
        inspect(node.end, "end", null);
        inspect(node.body, "body", null);
    } else if (node.type === "limit") {
        inspect(node.variable, "variable", null);
        inspect(node.target, "target", null);
        inspect(node.direction, "direction", null);
        inspect(node.body, "body", null);
    } else if (node.type === "derivative") {
        inspect(node.variable, "variable", null);
        inspect(node.expression, "expression", null);
    } else if (node.type === "vector") {
        inspect(node.name, "name", null);
    } else if (node.type === "scientific") {
        inspect(node.coefficient, "coefficient", null);
        inspect(node.exponent, "exponent", null);
    } else if (node.type === "factorial" || node.type === "degree" || node.type === "percent") {
        inspect(node.value, "value", null);
    }
    return result;
};
MoodleMathKeyboard.prototype.currentSequence = function () {
    return this.findNode(this.editorAST, this.cursor.seqId);
};
/* ============================================================
   CURSOR MAP
   ============================================================ */
MoodleMathKeyboard.prototype.buildCursorMap = function () {
    let self = this;
    let map = [];
    function pushSequencePosition(seq, offset) {
        map.push({
            seqId: seq.id,
            offset: offset,
            textNodeId: null,
            charOffset: null
        });
    }
    function walk(node) {
        let i;
        if (!node) return;
        if (node.type === "chain") {
            for (i = 0; i < node.elements.length; i += 1) {
                walk(node.elements[i]);
            }
            return;
        }
        if (node.type === "sequence") {
            pushSequencePosition(node, 0);
            for (i = 0; i < node.items.length; i += 1) {
                walk(node.items[i]);
                pushSequencePosition(node, i + 1);
            }
            return;
        }
        if (node.type === "number") {
            for (i = 0; i <= node.text.length; i += 1) {
                map.push({
                    seqId: null,
                    offset: null,
                    textNodeId: node.id,
                    charOffset: i
                });
            }
            return;
        }
        if (node.type === "group" ||
            node.type === "sqrt" ||
            node.type === "absolute") {
            walk(node.content);
            return;
        }
        if (node.type === "set") {
            walk(node.content);
            return;
        }
        if (node.type === "fraction" || node.type === "simpleFraction") {
            walk(node.numerator);
            walk(node.denominator);
            return;
        }
        if (node.type === "mixedFraction") {
            walk(node.whole);
            walk(node.numerator);
            walk(node.denominator);
            return;
        }
        if (node.type === "nthRoot") {
            walk(node.index);
            walk(node.content);
            return;
        }
        if (node.type === "power") {
            if (!node.fixedExponent) {
                walk(node.base);
                walk(node.exponent);
            }
            return;
        }
        if (node.type === "indexedVariable") {
            walk(node.variable);
            walk(node.subscript);
            return;
        }
        if (node.type === "function" || node.type === "namedFunction") {
            if ( node.type === "namedFunction")  walk(node.name);
            if (node.superscript) walk(node.superscript);
            walk(node.argument);
            return;
        }
        if (node.type === "functionWithBase") {
            walk(node.base);
            walk(node.argument);
            return;
        }
        if (node.type === "integral") {
            walk(node.lower);
            walk(node.upper);
            walk(node.integrand);
            walk(node.variable);
            return;
        }
        if (node.type === "indexedOperator") {
            walk(node.indexVariable);
            walk(node.start);
            walk(node.end);
            walk(node.body);
            return;
        }
        if (node.type === "limit") {
            walk(node.variable);
            walk(node.target);
            walk(node.direction);
            walk(node.body);
            return;
        }
        if (node.type === "derivative") {
            walk(node.variable);
            walk(node.expression);
            return;
        }
        if (node.type === "vector") {
            walk(node.name);
            return;
        }
        if (node.type === "scientific") {
            walk(node.coefficient);
            walk(node.exponent);
            return;
        }
    }
    walk(this.editorAST);
    let compact = [];
    let j;
    for (j = 0; j < map.length; j += 1) {
        if (compact.length === 0) {
            compact.push(map[j]);
            continue;
        }
        let previous = compact[compact.length - 1];
        let current = map[j];
        let duplicate = false;
        if (previous.textNodeId !== null && current.seqId !== null) {
            let numberNode = self.findNode(self.editorAST, previous.textNodeId);
            let parentInfo = self.findParent(self.editorAST, previous.textNodeId);
            if (numberNode &&
                parentInfo &&
                parentInfo.parent.type === "sequence" &&
                previous.charOffset === numberNode.text.length &&
                current.seqId === parentInfo.parent.id &&
                current.offset === parentInfo.index + 1) {
                duplicate = true;
            }
        }
        if (!duplicate) compact.push(current);
    }
    return compact;
};
MoodleMathKeyboard.prototype.cursorEquals = function (a, b) {
    return a.seqId === b.seqId &&
           a.offset === b.offset &&
           a.textNodeId === b.textNodeId &&
           a.charOffset === b.charOffset;
};
MoodleMathKeyboard.prototype.moveCursor = function (delta) {
    let map = this.buildCursorMap();
    let i;
    let index = -1;
    for (i = 0; i < map.length; i += 1) {
        if (this.cursorEquals(map[i], this.cursor)) {
            index = i;
            break;
        }
    }
    if (index < 0) {
        if (map.length > 0) this.cursor = map[0];
        this.render();
        return;
    }
    index += delta;
    if (index < 0) index = 0;
    if (index >= map.length) index = map.length - 1;
    this.cursor = map[index];
    this.render();
};
/* ============================================================
   BASIC INSERTION
   ============================================================ */
MoodleMathKeyboard.prototype.syntaxAllows = function(actionType) {
    let syntax = this.currentSyntax();
    let rule = SYNTAX_RULES[syntax];

    if (!rule) return true;
    if (rule.allow.indexOf(actionType) < 0) return false;
    if (rule.validate && !rule.validate(this, actionType)) return false;

    let actionRule = ACTION_RULES[actionType];
    if (actionRule && actionRule.validate && !actionRule.validate(this, actionType)) return false;

    if (rule.maxChars !== undefined &&
        (actionType === "variable" || actionType === "digit")) {

        let seq = this.currentOrContainingSequence();

        if (seq && this.sequenceCharCount(seq) >= rule.maxChars) {
            return false;
        }
    }
    return true;
};
MoodleMathKeyboard.prototype.getNamedFunctionFromNameSlot = function() {
    let seq = this.currentSequence();

    if (!seq ||
        seq.syntax !== "functionName" ||
        seq.items.length === 0) {
        return null;
    }

    let info = this.findParent(this.editorAST, seq.id);

    if (!info ||
        !info.parent ||
        info.parent.type !== "namedFunction" ||
        info.key !== "name") {
        return null;
    }

    return info.parent;
};
MoodleMathKeyboard.prototype.currentOrContainingSequence = function() {
    let seq = this.currentSequence();

    if (seq) return seq;

    if (this.cursor.textNodeId !== null) {
        let info = this.findParent(this.editorAST, this.cursor.textNodeId);

        if (info && info.parent && info.parent.type === "sequence") {
            return info.parent;
        }
    }

    return null;
};
MoodleMathKeyboard.prototype.getOperatorDefinition = function(op) {
    return OPERATOR_DEFS[op] || null;
};

MoodleMathKeyboard.prototype.normalizeCursorToSequence = function() {
    if (this.cursor.textNodeId === null) return true;

    let node = this.findNode(this.editorAST, this.cursor.textNodeId);

    if (!node || node.type !== "number") {
        return false;
    }

    let parentInfo = this.findParent(this.editorAST, node.id);

    if (!parentInfo || !parentInfo.parent || parentInfo.parent.type !== "sequence") {
        return false;
    }

    let seq = parentInfo.parent;
    let pos = this.cursor.charOffset;

    if (pos === 0) {
        this.cursor = { seqId: seq.id, offset: parentInfo.index, textNodeId: null, charOffset: null };
        return true;
    }

    if (pos === node.text.length) {
        this.cursor = { seqId: seq.id, offset: parentInfo.index + 1, textNodeId: null, charOffset: null };
        return true;
    }

    return false;
};
MoodleMathKeyboard.prototype.insertIntoSequence = function(node) {
    if (!this.normalizeCursorToSequence()) return false;

    let seq = this.currentSequence();
    if (!seq || seq.type !== "sequence") return false;

    seq.items.splice(this.cursor.offset, 0, node);
    this.cursor.offset += 1;
    return true;
};

MoodleMathKeyboard.prototype.insertDigit = function (digit) {
    let node;
    let seq;

    let syntax = this.currentSyntax();

    if (syntax === "variableOnly" || syntax === "limitDirection") {
        return;
    }

    if ( syntax === "functionName") {
        if (!this.syntaxAllows("digit")) return;

        if (this.insertIntoSequence({
            id: this.newId(),
            type: "identifierChar",
            text: digit
        })) {
            this.changed();
            this.advanceIfNeeded();
        }
        return;
    }

    if (this.cursor.textNodeId !== null) {
        node = this.findNode(this.editorAST, this.cursor.textNodeId);
        if (node && node.type === "number") {
            node.text =
                node.text.substring(0, this.cursor.charOffset) +
                digit +
                node.text.substring(this.cursor.charOffset);
            this.cursor.charOffset += 1;
            this.changed();
            return;
        }
    }
    if (!this.normalizeCursorToSequence()) return;
    seq = this.currentSequence();
    if (!seq) return;
    if (this.cursor.offset > 0) {
        node = seq.items[this.cursor.offset - 1];
        if (node && node.type === "number") {
            node.text += digit;
            this.cursor = {
                seqId: null,
                offset: null,
                textNodeId: node.id,
                charOffset: node.text.length
            };
            this.changed();
            return;
        }
    }
    node = this.makeNumber(digit);
    seq.items.splice(this.cursor.offset, 0, node);
    this.cursor = {
        seqId: null,
        offset: null,
        textNodeId: node.id,
        charOffset: 1
    };
    this.changed();
};

MoodleMathKeyboard.prototype.insertDecimal = function () {
    if (!this.syntaxAllows("decimal")) return;

    let node;
    let seq;
    if (this.inNaturalNumberSlot()) return;

    if (this.cursor.textNodeId !== null) {
        node = this.findNode(this.editorAST, this.cursor.textNodeId);
        if (node &&
            node.type === "number" &&
            node.text.indexOf(".") < 0) {
            if (this.cursor.charOffset === 0) {
                node.text = "0." + node.text;
                this.cursor.charOffset = 2;
            } else {
                node.text =
                    node.text.substring(0, this.cursor.charOffset) +
                    "." +
                    node.text.substring(this.cursor.charOffset);
                this.cursor.charOffset += 1;
            }
            this.changed();
        }
        return;
    }
    if (!this.normalizeCursorToSequence()) return;
    seq = this.currentSequence();
    if (this.cursor.offset > 0) {
        node = seq.items[this.cursor.offset - 1];
        if (node &&
            node.type === "number" &&
            node.text.indexOf(".") < 0) {
            node.text += ".";
            this.cursor = {
                seqId: null,
                offset: null,
                textNodeId: node.id,
                charOffset: node.text.length
            };
            this.changed();
            return;
        }
    }
    node = this.makeNumber("0.");
    seq.items.splice(this.cursor.offset, 0, node);
    this.cursor = {
        seqId: null,
        offset: null,
        textNodeId: node.id,
        charOffset: 2
    };
    this.changed();
};
MoodleMathKeyboard.prototype.insertOperator = function(op, explicit) {
    let def = this.getOperatorDefinition(op);
    let actionType = def ? def.actionType : "relation";
    if (!this.syntaxAllows(actionType)) return;
    if (!this.normalizeCursorToSequence()) return;
    let seq = this.currentSequence();
    if (!seq) return;

    if ((this.currentSyntax() === "signedInteger") && (op === "+" || op === "-")) {
        seq.items.push({ id: this.newId(), type: "operator", op: op, explicit: true });
        this.cursor = { seqId: seq.id, offset: seq.items.length, textNodeId: null, charOffset: null };
        this.changed();
        return;
    }
    if (( this.currentSyntax() === "limitDirection") && (op === "+" || op === "-")) {
         seq.items.push({ id: this.newId(), type: "operator", op: op, explicit: true });
        this.cursor = { seqId: seq.id, offset: seq.items.length, textNodeId: null, charOffset: null };
        this.changed();
        this.advanceIfNeeded();
        return;
    }

    seq.items.splice(this.cursor.offset, 0, { id: this.newId(), type: "operator", op: op, explicit: explicit !== false });
    this.cursor.offset += 1;
    this.changed();
};

MoodleMathKeyboard.prototype.insertVariable = function(def) {
    if (!this.syntaxAllows("variable")) return;

    if (this.currentSyntax() === "functionName") {
        if (this.insertIntoSequence({
            id: this.newId(),
            type: "identifierChar",
            text: def.id
        })) {
            this.changed();
            this.advanceIfNeeded();
        }
        return;
    }

    if (this.insertIntoSequence(this.makeVariable(def))) {
        this.changed();
        this.advanceIfNeeded();
    }
};
MoodleMathKeyboard.prototype.insertConstant = function (name, latex) {
    let syntax = this.currentSyntax();

    if (!this.syntaxAllows("constant") && !this.syntaxAllows("symbol")) return;
    if (this.insertIntoSequence(this.makeConstant(name, latex))) {
        this.changed();
    }
};
/* ============================================================
   STRUCTURAL INSERTION
   ============================================================ */
MoodleMathKeyboard.prototype.insertAndEnter = function (node, targetSequence) {
    if (!this.insertIntoSequence(node)) return;
    this.cursor = {
        seqId: targetSequence.id,
        offset: 0,
        textNodeId: null,
        charOffset: null
    };
    this.changed();
};
MoodleMathKeyboard.prototype.insertGroup = function () {
    if (!this.syntaxAllows("group")) return;
    let content = this.makeSequence([]);
    this.insertAndEnter({
        id: this.newId(),
        type: "group",
        content: content
    }, content);
};
MoodleMathKeyboard.prototype.insertSet = function() {
    if (!this.syntaxAllows("set")) return;

    let content = this.makeSequence([], "setContent");
    let node = { id: this.newId(), type: "set", content: content };

    this.insertAndEnter(node, content);
};
MoodleMathKeyboard.prototype.insertSqrt = function () {
    if (!this.syntaxAllows("sqrt")) return;

    let content = this.makeSequence([]);
    this.insertAndEnter({
        id: this.newId(),
        type: "sqrt",
        content: content
    }, content);
};
MoodleMathKeyboard.prototype.insertNthRoot = function() {
    if (!this.syntaxAllows("nthRoot")) return;

    let index = this.makeSequence([], "natural");
    let content = this.makeSequence([], "expression");
    let node = { id: this.newId(), type: "nthRoot", index: index, content: content };

    if (!this.insertIntoSequence(node)) return;

    this.cursor = { seqId: index.id, offset: 0, textNodeId: null, charOffset: null };
    this.changed();
};
MoodleMathKeyboard.prototype.takePreviousAsBase = function () {
    if (!this.normalizeCursorToSequence()) return null;
    let seq = this.currentSequence();
    if (!seq || this.cursor.offset <= 0) return null;
    let previous = seq.items[this.cursor.offset - 1];
    if (previous.type === "operator" || previous.type === "separator") return null;
    seq.items.splice(this.cursor.offset - 1, 1);
    this.cursor.offset -= 1;
    return previous;
};

MoodleMathKeyboard.prototype.insertFixedExponent = function(exponentText) {
    if (!this.syntaxAllows("fixedExponent")) return;

    if (exponentText === "-1") {
        let namedFunction = this.getNamedFunctionFromNameSlot();

        if (namedFunction) {
            namedFunction.primeOrder = 0;
            namedFunction.inverseFunction = true;
            this.changed();
            return;
        }
    }

    let base = this.takePreviousAsBase();
    if (!base) return;

    let node = {
        id: this.newId(),
        type: "power",
        base: base,
        fixedExponent: exponentText
    };

    if (this.insertIntoSequence(node)) this.changed();
};

MoodleMathKeyboard.prototype.insertSubscript = function () {
    if (!this.syntaxAllows("subscript")) return;
    if (!this.normalizeCursorToSequence()) return;

    let seq = this.currentSequence();
    if (!seq || this.cursor.offset <= 0) return;

    let previous = seq.items[this.cursor.offset - 1];

    if (previous.type !== "variable") return;

    let subscript = this.makeSequence([], "subscript");

    let node = {
        id: this.newId(),
        type: "indexedVariable",
        variable: previous,
        subscript: subscript
    };

    seq.items[this.cursor.offset - 1] = node;

    this.cursor = {
        seqId: subscript.id,
        offset: 0,
        textNodeId: null,
        charOffset: null
    };

    this.changed();
};

MoodleMathKeyboard.prototype.insertPower = function() {
    if (!this.syntaxAllows("power")) return;

    let base = this.takePreviousAsBase();
    if (!base) return;

    let exponent = this.makeSequence([], "expression");

    if (!this.insertIntoSequence({
        id: this.newId(),
        type: "power",
        base: base,
        exponent: exponent
    })) return;

    this.cursor = { seqId: exponent.id, offset: 0, textNodeId: null, charOffset: null };
    this.changed();
};

MoodleMathKeyboard.prototype.insertVector = function() {
    if (!this.syntaxAllows("vector")) return;

    let name = this.makeSequence([], "vectorName");
    let node = { id: this.newId(), type: "vector", name: name };

    this.insertAndEnter(node, name);
};
/* ============================================================
   SIMPLE FRACTION
   ============================================================ */
MoodleMathKeyboard.prototype.insertSimpleFraction = function () {
    if (!this.syntaxAllows("simpleFraction")) return;
    if (!this.normalizeCursorToSequence()) return;
    let seq = this.currentSequence();
    if (!seq) return;

    let numerator = this.makeSequence([], "natural");
    let denominator = this.makeSequence([], "natural");
    let previous = null;
    let node;

    if (this.cursor.offset > 0) {
        previous = seq.items[this.cursor.offset - 1];
    }

    if (previous &&
        previous.type === "number" &&
        previous.text.indexOf(".") < 0) {

        seq.items.splice(this.cursor.offset - 1, 1);
        this.cursor.offset -= 1;

        node = {
            id: this.newId(),
            type: "mixedFraction",
            whole: previous,
            numerator: numerator,
            denominator: denominator
        };
    } else {
        node = {
            id: this.newId(),
            type: "simpleFraction",
            numerator: numerator,
            denominator: denominator
        };
    }

    seq.items.splice(this.cursor.offset, 0, node);
    this.cursor.offset += 1;

    this.cursor = {
        seqId: numerator.id,
        offset: 0,
        textNodeId: null,
        charOffset: null
    };

    this.changed();
};
/* ============================================================
   DIVIDE
   ============================================================ */
MoodleMathKeyboard.prototype.insertDivide = function () {
    if (!this.syntaxAllows("divide")) return;
    if (!this.normalizeCursorToSequence()) return;

    let seq = this.currentSequence();
    if (!seq) return;

    let numerator = this.makeSequence([], "expression");
    let denominator = this.makeSequence([], "expression");
    let previous = null;

    if (this.cursor.offset > 0) {
        previous = seq.items[this.cursor.offset - 1];
    }

    if (previous && previous.type !== "operator") {
        seq.items.splice(this.cursor.offset - 1, 1);
        this.cursor.offset -= 1;
        numerator.items.push(previous);
    }

    let node = {
        id: this.newId(),
        type: "fraction",
        numerator: numerator,
        denominator: denominator
    };

    seq.items.splice(this.cursor.offset, 0, node);
    this.cursor.offset += 1;

    if (numerator.items.length > 0) {
        this.cursor = {
            seqId: denominator.id,
            offset: 0,
            textNodeId: null,
            charOffset: null
        };
    } else {
        this.cursor = {
            seqId: numerator.id,
            offset: 0,
            textNodeId: null,
            charOffset: null
        };
    }

    this.changed();
};

/* ============================================================
   FUNCTIONS
   ============================================================ */
MoodleMathKeyboard.prototype.insertFunction = function (name, latexName, inverseBase) {
    if (!this.syntaxAllows("function")) return;

    let argument = this.makeSequence([]);
    this.insertAndEnter({
        id: this.newId(),
        type: "function",
        name: name,
        latexName: latexName,
        inverseBase: inverseBase || null,
        argument: argument
    }, argument);
};
MoodleMathKeyboard.prototype.insertLogWithBase = function () {
    if (this.inNaturalNumberSlot()) return;
    let base = this.makeSequence([]);
    let argument = this.makeSequence([]);
    let node = {
        id: this.newId(),
        type: "functionWithBase",
        name: "log",
        base: base,
        argument: argument
    };
    if (!this.insertIntoSequence(node)) return;
    this.cursor = {
        seqId: base.id,
        offset: 0,
        textNodeId: null,
        charOffset: null
    };
    this.changed();
};
MoodleMathKeyboard.prototype.insertNamedFunction = function() {
    if (!this.syntaxAllows("namedFunction")) return;
    if (!this.normalizeCursorToSequence()) return;

    let seq = this.currentSequence();
    let candidate = null;
    let name = this.makeSequence([], "functionName");

    if (seq && this.cursor.offset > 0) {
        let previous = seq.items[this.cursor.offset - 1];

        candidate = this.getFunctionModifierCandidate(previous);

        if (candidate) {
            name.items.push({
                id: this.newId(),
                type: "identifierChar",
                text: candidate.variable.name
            });

            seq.items.splice(this.cursor.offset - 1, 1);
            this.cursor.offset -= 1;
        }
    }

    let argument = this.makeSequence([], "expression");

    let node = {
        id: this.newId(),
        type: "namedFunction",
        name: name,
        primeOrder: candidate ? candidate.primeOrder : 0,
        inverseFunction: candidate ? candidate.inverseFunction : false,
        superscript: null,
        argument: argument
    };

    this.insertAndEnter(node, name);

    this.cursor = {
        seqId: name.id,
        offset: name.items.length,
        textNodeId: null,
        charOffset: null
    };

    this.changed();
};
MoodleMathKeyboard.prototype.getFunctionModifierCandidate = function(node) {
    if (!node) return null;

    if (node.type === "variable") {
        return {
            variable: node,
            primeOrder: 0,
            inverseFunction: false
        };
    }

    if (node.type === "prime" &&
        node.value &&
        node.value.type === "variable") {

        return {
            variable: node.value,
            primeOrder: node.order || 1,
            inverseFunction: false
        };
    }

    if (node.type === "power" &&
        node.fixedExponent === "-1" &&
        node.base &&
        node.base.type === "variable") {

        return {
            variable: node.base,
            primeOrder: 0,
            inverseFunction: true
        };
    }

    return null;
};

MoodleMathKeyboard.prototype.deleteFunctionNameModifier = function(seq) {
    if (!seq || seq.syntax !== "functionName") return false;
    if (this.cursor.offset !== seq.items.length) return false;

    let info = this.findParent(this.editorAST, seq.id);

    if (!info ||
        !info.parent ||
        info.parent.type !== "namedFunction" ||
        info.key !== "name") {
        return false;
    }

    let fn = info.parent;

    if (fn.inverseFunction) {
        fn.inverseFunction = false;
        this.changed();
        return true;
    }

    if (fn.primeOrder > 0) {
        fn.primeOrder -= 1;
        this.changed();
        return true;
    }

    return false;
};
MoodleMathKeyboard.prototype.applyPrime = function() {
    let namedFunction = this.getNamedFunctionFromNameSlot();

    if (namedFunction) {
        namedFunction.inverseFunction = false;

        if (namedFunction.primeOrder < 3) { 
            namedFunction.primeOrder += 1;
        }
        this.cursor = {
            seqId: namedFunction.name.id,
            offset: namedFunction.name.items.length,
            textNodeId: null,
            charOffset: null
        };
        this.changed();
        return;
    }

    if (!this.normalizeCursorToSequence()) return;

    let seq = this.currentSequence();
    if (!seq || this.cursor.offset <= 0) return;

    let previous = seq.items[this.cursor.offset - 1];

    if (previous.type === "variable") {
        seq.items[this.cursor.offset - 1] = {
            id: this.newId(),
            type: "prime",
            value: previous,
            order: 1
        };

        this.changed();
        return;
    }

    if (previous.type === "prime") {
        if (previous.order < 3) previous.order += 1;
        this.changed();
        return;
    }

    if (previous.type === "power" &&
        previous.fixedExponent === "-1" &&
        previous.base &&
        previous.base.type === "variable") {

        seq.items[this.cursor.offset - 1] = {
            id: this.newId(),
            type: "prime",
            value: previous.base,
            order: 1
        };

        this.changed();
        return;
    }

    if (previous.type === "namedFunction") {
        previous.inverseFunction = false;

        if (previous.primeOrder < 3) {
            previous.primeOrder += 1;
        }

        this.changed();
        return;
    }
};
MoodleMathKeyboard.prototype.canApplyPrime = function () {
    if (!this.normalizeCursorToSequence()) return false;

    let seq = this.currentSequence();
    if (!seq || this.cursor.offset <= 0) return false;

    let previous = seq.items[this.cursor.offset - 1];

    return previous.type === "variable" ||
           previous.type === "prime" ||
           previous.type === "namedFunction";
};

/* ============================================================
   STRUCTURES
   ============================================================ */
MoodleMathKeyboard.prototype.insertAbsolute = function () {
    if (!this.syntaxAllows("absolute")) return;
    let content = this.makeSequence([]);
    this.insertAndEnter({
        id: this.newId(),
        type: "absolute",
        content: content
    }, content);
};
MoodleMathKeyboard.prototype.insertIntegral = function () {
    if (!this.syntaxAllows("integral")) return;
    let lower = this.makeSequence([]);
    let upper = this.makeSequence([]);
    let integrand = this.makeSequence([]);
    let variable = this.makeSequence([]);
    this.insertAndEnter({
        id: this.newId(),
        type: "integral",
        lower: lower,
        upper: upper,
        integrand: integrand,
        variable: variable
    }, lower);
};
MoodleMathKeyboard.prototype.insertIndexedOperator = function (kind) {
    if (!this.syntaxAllows(kind)) return;

    let indexVariable = this.makeSequence([], "variableOnly");
    let start = this.makeSequence([]);
    let end = this.makeSequence([]);
    let body = this.makeSequence([]);
    this.insertAndEnter({
        id: this.newId(),
        type: "indexedOperator",
        operator: kind,
        indexVariable: indexVariable,
        start: start,
        end: end,
        body: body
    }, indexVariable);
};
MoodleMathKeyboard.prototype.insertLimit = function () {
    if (!this.syntaxAllows("limit")) return;

    let variable = this.makeSequence([], "variableOnly");
    let target = this.makeSequence([], "limitTarget");
    let direction = this.makeSequence([], "limitDirection");
    let body = this.makeSequence([], "expression");

    this.insertAndEnter({
        id: this.newId(),
        type: "limit",
        variable: variable,
        target: target,
        direction: direction,
        body: body
    }, variable);
};
MoodleMathKeyboard.prototype.insertDerivative = function(kind) {
    if (!this.syntaxAllows("derivative")) return;

    let existing = this.getActiveDerivative(kind);

    if (existing) {
        existing.order += 1;
        this.changed();
        return;
    }

    let variable = this.makeSequence([], "variableOnly");
    let expression = this.makeSequence([], "expression");

    let node = {
        id: this.newId(),
        type: "derivative",
        kind: kind,
        order: 1,
        variable: variable,
        expression: expression
    };

    this.insertAndEnter(node, variable);
};
MoodleMathKeyboard.prototype.getActiveDerivative = function(kind) {
    let seq = this.currentSequence();

    if (seq) {
        let info = this.findParent(this.editorAST, seq.id);

        if (info &&
            info.parent &&
            info.parent.type === "derivative" &&
            info.parent.kind === kind &&
            info.key === "expression") {
            return info.parent;
        }
    }

    if (this.cursor.textNodeId !== null) {
        let node = this.findNode(this.editorAST, this.cursor.textNodeId);
        let info = node ? this.findParent(this.editorAST, node.id) : null;

        while (info) {
            if (info.parent.type === "derivative" && info.parent.kind === kind) return info.parent;
            info = this.findParent(this.editorAST, info.parent.id);
        }
    }

    seq = this.currentSequence();

    if (seq && this.cursor.offset > 0) {
        let previous = seq.items[this.cursor.offset - 1];
        if (previous.type === "derivative" && previous.kind === kind) return previous;
    }

    return null;
};
MoodleMathKeyboard.prototype.insertScientific = function () {
    if (!this.syntaxAllows("scientific")) return;
    if (!this.normalizeCursorToSequence()) return;

    let seq = this.currentSequence();
    if (!seq) return;

    let coefficient = null;
    let coefficientFromPrevious = false;

    if (this.cursor.offset > 0) {
        let previous = seq.items[this.cursor.offset - 1];

        if (previous.type === "number") {
            coefficient = previous;
            coefficientFromPrevious = true;

            seq.items.splice(this.cursor.offset - 1, 1);
            this.cursor.offset -= 1;
        }
    }

    if (!coefficient) {
        coefficient = this.makeNumber("1");
    }

    let exponent = this.makeSequence([], "signedInteger");
    this.insertAndEnter({
        id: this.newId(),
        type: "scientific",
        coefficient: coefficient,
        coefficientFromPrevious: coefficientFromPrevious,
        exponent: exponent
    }, exponent);
};
MoodleMathKeyboard.prototype.getFunctionModifierCandidate = function(node) {
    if (!node) return null;

    if (node.type === "variable") {
        return {
            variable: node,
            primeOrder: 0,
            inverseFunction: false
        };
    }

    if (node.type === "prime" &&
        node.value &&
        node.value.type === "variable") {

        return {
            variable: node.value,
            primeOrder: node.order || 1,
            inverseFunction: false
        };
    }

    if (node.type === "power" &&
        node.fixedExponent === "-1" &&
        node.base &&
        node.base.type === "variable") {

        return {
            variable: node.base,
            primeOrder: 0,
            inverseFunction: true
        };
    }

    return null;
};
/* ============================================================
   EQUALS
   ============================================================ */
MoodleMathKeyboard.prototype.cursorAtRootElement = function () {
    let i;
    if (this.cursor.textNodeId !== null) return false;
    for (i = 0; i < this.editorAST.elements.length; i += 1) {
        if (this.editorAST.elements[i].id === this.cursor.seqId) return true;
    }
    return false;
};
MoodleMathKeyboard.prototype.insertEquals = function () {
    if (!this.config.enableEquals) return;
    if (!this.normalizeCursorToSequence()) return;
    if (!this.cursorAtRootElement()) return;
    let i;
    for (i = 0; i < this.editorAST.elements.length; i += 1) {
        if (this.editorAST.elements[i].id === this.cursor.seqId) {
            let newSeq = this.makeSequence([]);
            this.editorAST.elements.splice(i + 1, 0, newSeq);
            this.cursor = {
                seqId: newSeq.id,
                offset: 0,
                textNodeId: null,
                charOffset: null
            };
            this.changed();
            return;
        }
    }
};
/* ============================================================
   POSTFIX
   ============================================================ */
MoodleMathKeyboard.prototype.wrapPreviousPostfix = function (kind) {
    if (!this.normalizeCursorToSequence()) return;

    let seq = this.currentSequence();
    if (!seq || this.cursor.offset <= 0) return;

    let previous = seq.items[this.cursor.offset - 1];

    if (kind === "factorial" && previous.type !== "number" && previous.type !== "variable") {
        return;
    }

    seq.items[this.cursor.offset - 1] = {
        id: this.newId(),
        type: kind,
        value: previous
    };

    this.changed();
};
/* ============================================================
   DELETE / CLEAR
   ============================================================ */
MoodleMathKeyboard.prototype.deletePreviousChainSeparator = function () {
    if (this.cursor.textNodeId !== null) return false;

    let i;

    for (i = 0; i < this.editorAST.elements.length; i += 1) {
        if (this.editorAST.elements[i].id !== this.cursor.seqId) continue;

        if (i === 0) return false;

        let current = this.editorAST.elements[i];

        if (current.items.length !== 0 ||
            this.cursor.offset !== 0) {
            return false;
        }

        this.editorAST.elements.splice(i, 1);

        let previous = this.editorAST.elements[i - 1];

        this.cursor = {
            seqId: previous.id,
            offset: previous.items.length,
            textNodeId: null,
            charOffset: null
        };

        this.changed();
        return true;
    }

    return false;
};
MoodleMathKeyboard.prototype.deleteFunctionModifierFromPrevious = function() {
    if (!this.normalizeCursorToSequence()) return false;

    let seq = this.currentSequence();
    if (!seq || this.cursor.offset <= 0) return false;

    let previous = seq.items[this.cursor.offset - 1];

    if (previous.type === "namedFunction") {
        if (previous.inverseFunction) {
            previous.inverseFunction = false;
            this.changed();
            return true;
        }

        if (previous.primeOrder > 0) {
            previous.primeOrder -= 1;
            this.changed();
            return true;
        }
    }

    if (previous.type === "prime") {
        if (previous.order > 1) {
            previous.order -= 1;
        } else {
            seq.items[this.cursor.offset - 1] = previous.value;
        }

        this.changed();
        return true;
    }

    return false;
};
MoodleMathKeyboard.prototype.deleteLeft = function () {
    let node;
    let parentInfo;
    let seq;
    if (this.cursor.textNodeId !== null) {
        node = this.findNode(this.editorAST, this.cursor.textNodeId);
        if (node && node.type === "number" && this.cursor.charOffset > 0) {
            node.text =
                node.text.substring(0, this.cursor.charOffset - 1) +
                node.text.substring(this.cursor.charOffset);
            this.cursor.charOffset -= 1;
            if (node.text.length === 0) {
                parentInfo = this.findParent(this.editorAST, node.id);
                if (parentInfo && parentInfo.parent.type === "sequence") {
                    parentInfo.parent.items.splice(parentInfo.index, 1);
                    this.cursor = {
                        seqId: parentInfo.parent.id,
                        offset: parentInfo.index,
                        textNodeId: null,
                        charOffset: null
                    };
                }
            }
            this.changed();
            return;
        }
    }
    if (!this.normalizeCursorToSequence()) {
        this.moveCursor(-1);
        return;
    }
    seq = this.currentSequence();
    if (seq && this.deleteFunctionNameModifier(seq)) {
        return;
    }

    if (seq && this.cursor.offset > 0) {
        let previous = seq.items[this.cursor.offset - 1];

        if (previous.type === "power" && previous.fixedExponent) {
            seq.items[this.cursor.offset - 1] = previous.base;
            this.changed();
            return;
        }

        // >>>>>
        if (previous.type === "derivative" && previous.order > 1) {
            previous.order -= 1;
            this.changed();
            return;
        }
        // <<<<
        seq.items.splice(this.cursor.offset - 1, 1);
        this.cursor.offset -= 1;
        this.changed();
        return;
    }

    if (seq && this.cursor.offset > 0) {
        if (this.deleteFunctionModifierFromPrevious()) return;

        seq.items.splice(this.cursor.offset - 1, 1);
        this.cursor.offset -= 1;
        this.changed();
        return;
    }

    if (seq && this.cursor.offset > 0) {
        seq.items.splice(this.cursor.offset - 1, 1);
        this.cursor.offset -= 1;
        this.changed();
        return;
    }

    if (seq && seq.items.length === 0 && this.cursor.offset === 0) {
        if (this.deleteEmptyParentStructure(seq)) return;
        if (this.deletePreviousChainSeparator()) return;
    }

    this.moveCursor(-1);
};
MoodleMathKeyboard.prototype.advanceIfNeeded = function() {
    let seq = this.currentSequence();
    if (!seq) return false;

    let rule = SYNTAX_RULES[seq.syntax];
    if (!rule) return false;

    if (rule.autoAdvance) {
        this.moveCursor(1);
        return true;
    }

    if (rule.autoAdvanceWhenFull && rule.maxItems && seq.items.length >= rule.maxItems) {
        this.moveCursor(1);
        return true;
    }

    return false;
};

MoodleMathKeyboard.prototype.deleteEmptyParentStructure = function (seq) {
    let slotInfo = this.findParent(this.editorAST, seq.id);
    if (!slotInfo) return false;

    let structure = slotInfo.parent;
    if (structure.type === "derivative" && slotInfo.key === "expression" && structure.order > 1) {
        structure.order -= 1;
        this.changed();
        return true;
    }
    if (structure.type === "derivative" && slotInfo.key === "variable") { return this.deleteStructureNode(structure);}
    if (structure.type === "derivative" && slotInfo.key === "expression") {
        this.cursor = { seqId: structure.variable.id, offset: structure.variable.items.length, textNodeId: null, charOffset: null };
        this.render();
        return true;
    }
    if (structure.type === "group") return this.deleteStructureNode(structure);
    if (structure.type === "function" && slotInfo.key === "argument") return this.deleteStructureNode(structure);
    if (structure.type === "namedFunction" && slotInfo.key === "argument") return this.deleteStructureNode(structure);
    if (structure.type === "nthRoot" && slotInfo.key === "index") return this.deleteStructureNode(structure);

    if (structure.type === "integral" && slotInfo.key === "lower") return this.deleteStructureNode(structure);
    if (structure.type === "indexedOperator" && slotInfo.key === "indexVariable") return this.deleteStructureNode(structure);
    if (structure.type === "limit" && slotInfo.key === "variable") return this.deleteStructureNode(structure);
    if (structure.type === "set" && slotInfo.key === "content") {
        return this.deleteStructureNode(structure);
    }
    if (structure.type === "indexedVariable" &&
        slotInfo.key === "subscript") {

        let parentInfo = this.findParent(this.editorAST, structure.id);
        if (!parentInfo) return false;

        if (parentInfo.parent.type !== "sequence" ||
            parentInfo.key !== "items") {
            return false;
        }

        parentInfo.parent.items[parentInfo.index] = structure.variable;

        this.cursor = {
            seqId: parentInfo.parent.id,
            offset: parentInfo.index + 1,
            textNodeId: null,
            charOffset: null
        };

        this.changed();
        return true;
    }
    if (structure.type === "power" && slotInfo.key === "exponent" && !structure.fixedExponent) {
        return this.deleteStructureNodeKeepBase(structure);
    }
    if (structure.type === "function" && slotInfo.key === "argument") {
        return this.deleteStructureNode(structure);
    }

    if (structure.type === "namedFunction" && slotInfo.key === "argument") {
        return this.deleteStructureNode(structure);
    }

    if (structure.type === "functionWithBase") {
        if (slotInfo.key === "base") {
            return this.deleteStructureNode(structure);
        }

        if (slotInfo.key === "argument") {
            this.cursor = {
                seqId: structure.base.id,
                offset: structure.base.items.length,
                textNodeId: null,
                charOffset: null
            };

            this.changed();
            return true;
        }
    }
    if (structure.type === "vector" &&
        slotInfo.key === "name" &&
        seq.items.length === 0) {

        return this.deleteStructureNode(structure);
    }
    if (structure.type === "scientific" &&
        slotInfo.key === "exponent") {

        let parentInfo =
            this.findParent(this.editorAST, structure.id);

        if (!parentInfo) return false;

        if (parentInfo.parent.type !== "sequence" ||
            parentInfo.key !== "items") {
            return false;
        }

        if (structure.coefficientFromPrevious) {
            parentInfo.parent.items[parentInfo.index] =
                structure.coefficient;

            this.cursor = {
                seqId: parentInfo.parent.id,
                offset: parentInfo.index + 1,
                textNodeId: null,
                charOffset: null
            };
        } else {
            parentInfo.parent.items.splice(parentInfo.index, 1);

            this.cursor = {
                seqId: parentInfo.parent.id,
                offset: parentInfo.index,
                textNodeId: null,
                charOffset: null
            };
        }

        this.changed();
        return true;
    }

    return false;
};
MoodleMathKeyboard.prototype.deleteStructureNodeKeepBase = function(structure) {
    let parentInfo = this.findParent(this.editorAST, structure.id);
    if (!parentInfo || !parentInfo.parent || parentInfo.parent.type !== "sequence") return false;

    parentInfo.parent.items[parentInfo.index] = structure.base;
    this.cursor = { seqId: parentInfo.parent.id, offset: parentInfo.index + 1, textNodeId: null, charOffset: null };
    this.changed();
    return true;
};
MoodleMathKeyboard.prototype.deleteStructureNode = function (node) {
    let parentInfo = this.findParent(this.editorAST, node.id);
    if (!parentInfo) return false;

    if (parentInfo.parent.type !== "sequence" ||
        parentInfo.key !== "items") {
        return false;
    }

    parentInfo.parent.items.splice(parentInfo.index, 1);

    this.cursor = {
        seqId: parentInfo.parent.id,
        offset: parentInfo.index,
        textNodeId: null,
        charOffset: null
    };

    this.changed();

    return true;
};

MoodleMathKeyboard.prototype.clearAll = function () {
    this.editorAST = this.makeChain();
    this.cursor = {
        seqId: this.editorAST.elements[0].id,
        offset: 0,
        textNodeId: null,
        charOffset: null
    };
    this.changed();
};
/* ============================================================
   LATEX RENDERER
   ============================================================ */
MoodleMathKeyboard.prototype.cursorMarkerLatex = function () {
    return "\\cssId{" + this.cursorMarkerId + "}{|}";
};

MoodleMathKeyboard.prototype.renderWhenMathJaxReady = function () {
    let self = this;

    if (window.MathJax && window.MathJax.typesetPromise) {
        this.render();
        return;
    }

    setTimeout(function () {
        self.renderWhenMathJaxReady();
    }, 20);
};

MoodleMathKeyboard.prototype.cursorLatexForSequence = function (seq, offset) {
    if (this.cursor.textNodeId === null && this.cursor.seqId === seq.id && this.cursor.offset === offset) {
        return this.cursorMarkerLatex();
    }
    return "";
};

MoodleMathKeyboard.prototype.renderNumber = function (node, editing) {
    if (!editing || this.cursor.textNodeId !== node.id) {
        return node.text;
    }

    let left = node.text.substring(0, this.cursor.charOffset);
    let right = node.text.substring(this.cursor.charOffset);

    return left +  this.cursorMarkerLatex() + right;
};

MoodleMathKeyboard.prototype.renderSequence = function(seq, editing, suppressCursor = false) {
    let out = "";
    let i;

    if (seq.items.length === 0) {
        if (!suppressCursor && editing) {
            out += this.cursorLatexForSequence(seq, 0);

            if (!this.isRootSequence(seq)) {
                out += "\\square";
            }
        }
        return out;
    }

    if (!suppressCursor) { out += this.cursorLatexForSequence(seq, 0); }

    for (i = 0; i < seq.items.length; i += 1) {
        out += this.renderNode(seq.items[i], editing);

        if (!suppressCursor) {
            out += this.cursorLatexForSequence(seq, i + 1);
        }
    }

    return out;
};

MoodleMathKeyboard.prototype.isRootSequence = function (seq) {
    let i;

    for (i = 0; i < this.editorAST.elements.length; i += 1) {
        if (this.editorAST.elements[i].id === seq.id) return true;
    }

    return false;
};

MoodleMathKeyboard.prototype.multiplyLatex = function () {
    return this.config.multiplicationSymbol === "times" ? "\\times " : "\\cdot ";
};
MoodleMathKeyboard.prototype.renderNode = function (node, editing) {
    let name;
    let lower;
    let upper;
    let direction;
    if (!node) return "";
    if (node.type === "number") {
        return this.renderNumber(node, editing);
    }
    if (node.type === "identifierChar") {
        return node.text;
    }
    if (node.type === "variable" || node.type === "constant") {
        return node.latex;
    }
    if (node.type === "separator") return ",\\,";
    if (node.type === "operator") {
        let def = this.getOperatorDefinition(node.op);
        if (node.op === "*") return this.multiplyLatex();
        if (def) return def.latex;
        return node.op;
    }
    if (node.type === "group") {
        return "\\left(" +
            this.renderSequence(node.content, editing) +
            "\\right)";
    }
    if (node.type === "set") return "\\left\\{" +
         this.renderSequence(node.content, editing) + "\\right\\}";
    if (node.type === "sqrt") {
        return "\\sqrt{" +
            this.renderSequence(node.content, editing) +
            "}";
    }
    if (node.type === "nthRoot") {
          return "\\sqrt[" + 
          this.renderSequence(node.index, editing) + "]{" + 
          this.renderSequence(node.content, editing) + "}";
    }
    if (node.type === "fraction" || node.type === "simpleFraction") {
        return "\\frac{" +
            this.renderSequence(node.numerator, editing) +
            "}{" +
            this.renderSequence(node.denominator, editing) +
            "}";
    }
    if (node.type === "mixedFraction") {
        return this.renderNode(node.whole, editing) +
            "\\frac{" +
            this.renderSequence(node.numerator, editing) +
            "}{" +
            this.renderSequence(node.denominator, editing) +
            "}";
    }
    if (node.type === "power") {
        if (node.fixedExponent) {
            return "{" +
                this.renderNode(node.base, editing) +
                "}^{" +
                node.fixedExponent +
                "}";
        }

        if (node.base &&
            node.base.type === "function" &&
            !node.base.inverseBase) {

            return node.base.latexName +
                "^{" +
                this.renderSequence(node.exponent, editing) +
                "}\\left(" +
                this.renderSequence(node.base.argument, editing) +
                "\\right)";
        }

        return "{" +
            this.renderNode(node.base, editing) +
            "}^{" +
            this.renderSequence(node.exponent, editing) +
            "}";
    }
    if (node.type === "indexedVariable") {
        return this.renderNode(node.variable, editing) +
            "_{" +
            this.renderSequence(node.subscript, editing) +
            "}";
    }
    if (node.type === "function") {
        if (node.inverseBase) {
            return node.inverseBase +
                "^{-1}\\left(" +
                this.renderSequence(node.argument, editing) +
                "\\right)";
        }
        return node.latexName +
            "\\left(" +
            this.renderSequence(node.argument, editing) +
            "\\right)";
    }
    if (node.type === "functionWithBase") {
        return "\\log_{" +
            this.renderSequence(node.base, editing) +
            "}\\left(" +
            this.renderSequence(node.argument, editing) +
            "\\right)";
    }
    if (node.type === "namedFunction") {
        let modifier = "";

        if (node.inverseFunction) {
            modifier = "^{-1}";
        } else if (node.primeOrder > 0) {
            modifier = new Array(node.primeOrder + 1).join("'");
        }

        let cursorAfterModifier =
            editing &&
            this.cursor.seqId === node.name.id &&
            this.cursor.offset === node.name.items.length &&
            modifier !== "";
        let name;

        if (cursorAfterModifier) {
            name = this.renderSequence(node.name, false, true);
        } else {
            name = this.renderSequence(node.name, editing);
        }

        let result = name + modifier;

        if (cursorAfterModifier) {
            result += this.cursorMarkerLatex();
        }

        result += "\\left(" +
            this.renderSequence(node.argument, editing) +
            "\\right)";

        return result;
    }
    if (node.type === "absolute") {
        return "\\left|" +
            this.renderSequence(node.content, editing) +
            "\\right|";
    }
    if (node.type === "integral") {
        lower = this.renderSequence(node.lower, editing);
        upper = this.renderSequence(node.upper, editing);
        if (!editing &&
            node.lower.items.length === 0 &&
            node.upper.items.length === 0) {
            return "\\int " +
                this.renderSequence(node.integrand, editing) +
                "\\,d" +
                this.renderSequence(node.variable, editing);
        }
        return "\\int_{" +
            lower +
            "}^{" +
            upper +
            "}" +
            this.renderSequence(node.integrand, editing) +
            "\\,d" +
            this.renderSequence(node.variable, editing);
    }
    if (node.type === "indexedOperator") {
        return (node.operator === "sum" ? "\\sum" : "\\prod") +
            "_{" +
            this.renderSequence(node.indexVariable, editing) +
            "=" +
            this.renderSequence(node.start, editing) +
            "}^{" +
            this.renderSequence(node.end, editing) +
            "}" +
            this.renderSequence(node.body, editing);
    }
    if (node.type === "limit") {
        direction = this.renderSequence(node.direction, editing);
        return "\\lim_{" +
            this.renderSequence(node.variable, editing) +
            "\\to " +
            this.renderSequence(node.target, editing) +
            (direction ? "^{" + direction + "}" : "") +
            "}" +
            this.renderSequence(node.body, editing);
    }
    if (node.type === "derivative") return this.renderDerivative(node, editing);
    if (node.type === "vector") return "\\vec{" + this.renderSequence(node.name, editing) + "}";    
    if (node.type === "scientific") {
        return this.renderNode(node.coefficient, editing) +
            "\\times10^{" +
            this.renderSequence(node.exponent, editing) +
            "}";
    }
    if (node.type === "factorial") { return this.renderNode(node.value, editing) + "!"; }
    if (node.type === "degree") { return this.renderNode(node.value, editing) + "^{\\circ}"; }
    if (node.type === "percent") { return this.renderNode(node.value, editing) + "\\%"; }
    if (node.type === "prime") { return this.renderNode(node.value, editing) + new Array(node.order + 1).join("'"); }
    if (node.type === "placeholder") { return editing ? "\\square" : ""; }
    return "";
};

MoodleMathKeyboard.prototype.renderDerivative = function(node, editing) {
    let variable = this.renderSequence(node.variable, editing);
    let expression = this.renderSequence(node.expression, editing);
    let order = node.order || 1;
    let exponent = order > 1 ? "^{" + order + "}" : "";
    let d = node.kind === "partial" ? "\\partial " : "d";

    if (this.isSingleVariableSequence(node.expression)) {
        return "\\frac{" + d + exponent + expression + "}{" + d + variable + exponent + "}";
    }

    return "\\frac{" + d + exponent + "}{" + d + variable + exponent + "}" + expression;
};
MoodleMathKeyboard.prototype.isSingleVariableSequence = function(seq) {
    return !!seq &&
        seq.items.length === 1 &&
        seq.items[0].type === "variable";
};
MoodleMathKeyboard.prototype.getLatex = function () {
    let parts = [];
    let i;
    for (i = 0; i < this.editorAST.elements.length; i += 1) {
        parts.push(this.renderSequence(this.editorAST.elements[i], false));
    }
    return parts.join("=");
};
MoodleMathKeyboard.prototype.getEditingLatex = function () {
    let parts = [];
    let i;
    for (i = 0; i < this.editorAST.elements.length; i += 1) {
        parts.push(this.renderSequence(this.editorAST.elements[i], true));
    }
    return parts.join("=");
};
/* ============================================================
   SEMANTIC AST
   ============================================================ */
MoodleMathKeyboard.prototype.semanticNode = function (node) {
    let self = this;
    if (!node) return null;
    if (node.type === "number") {
        return {
            type: "number",
            value: node.text
        };
    }
    if (node.type === "variable") {
        return {
            type: "variable",
            name: node.name
        };
    }
    if (node.type === "constant") {
        return {
            type: "constant",
            name: node.name
        };
    }
    if (node.type === "separator") {
        return {
            type: "separator"
        };
    }
    if (node.type === "mixedFraction") {
        return {
            type: "binary",
            op: "+",
            left: self.semanticNode(node.whole),
            right: {
                type: "binary",
                op: "/",
                left: self.semanticSequence(node.numerator),
                right: self.semanticSequence(node.denominator)
            },
            displayStyle: "mixedFraction"
        };
    }
    if (node.type === "simpleFraction") {
        return {
            type: "binary",
            op: "/",
            left: self.semanticSequence(node.numerator),
            right: self.semanticSequence(node.denominator),
            displayStyle: "simpleFraction"
        };
    }
    if (node.type === "fraction") {
        return {
            type: "binary",
            op: "/",
            left: self.semanticSequence(node.numerator),
            right: self.semanticSequence(node.denominator)
        };
    }
    if (node.type === "prime") {
        return {
            type: "prime",
            order: node.order,
            value: this.semanticNode(node.value)
        };
    }
    if (node.type === "group") {
        return {
            type: "group",
            child: self.semanticSequence(node.content)
        };
    }
    if (node.type === "set") {
        return {
            type: "set",
            content: this.semanticSequence(node.content)
        };
    }
    if (node.type === "sqrt") {
        return {
            type: "function",
            name: "sqrt",
            argument: self.semanticSequence(node.content)
        };
    }
    if (node.type === "nthRoot") {
        return {
            type: "nthRoot",
            index: self.semanticSequence(node.index),
            content: self.semanticSequence(node.content)
        };
    }
    if (node.type === "power") {
        if (node.fixedExponent) {
            return {
                type: "binary",
                op: "^",
                left: self.semanticNode(node.base),
                right: {
                    type: "number",
                    value: node.fixedExponent
                }
            };
        }

        return {
            type: "binary",
            op: "^",
            left: self.semanticNode(node.base),
            right: self.semanticSequence(node.exponent)
        };
    }
    if (node.type === "indexedVariable") {
        return {
            type: "indexedVariable",
            variable: this.semanticNode(node.variable),
            subscript: this.semanticSequence(node.subscript)
        };
    }
    if (node.type === "function") {
        return {
            type: "function",
            name: node.name,
            argument: self.semanticSequence(node.argument)
        };
    }
    if (node.type === "functionWithBase") {
        return {
            type: "function",
            name: "log",
            base: self.semanticSequence(node.base),
            argument: self.semanticSequence(node.argument)
        };
    }
    if (node.type === "namedFunction") {
        let name = "";
        let i;

        for (i = 0; i < node.name.items.length; i += 1) {
            let item = node.name.items[i];
            if (item.type === "identifierChar") {
                name += item.text;
            } else if (item.type === "variable") {
                name += item.name;
            }
        }

        return {
            type: "namedFunction",
            name: name,
            primeOrder: node.primeOrder || 0,
            inverseFunction: !!node.inverseFunction,
            superscript: node.superscript ?
                this.semanticSequence(node.superscript) : null,
            argument: this.semanticSequence(node.argument)
        };
    }
    if (node.type === "absolute") {
        return {
            type: "function",
            name: "abs",
            argument: self.semanticSequence(node.content)
        };
    }
    if (node.type === "integral") {
        return {
            type: "integral",
            lower: self.semanticSequence(node.lower),
            upper: self.semanticSequence(node.upper),
            integrand: self.semanticSequence(node.integrand),
            variable: self.semanticSequence(node.variable)
        };
    }
    if (node.type === "indexedOperator") {
        return {
            type: node.operator,
            indexVariable: self.semanticSequence(node.indexVariable),
            start: self.semanticSequence(node.start),
            end: self.semanticSequence(node.end),
            body: self.semanticSequence(node.body)
        };
    }
    if (node.type === "limit") {
        return {
            type: "limit",
            variable: self.semanticSequence(node.variable),
            target: self.semanticSequence(node.target),
            direction: self.semanticSequence(node.direction),
            body: self.semanticSequence(node.body)
        };
    }
    if (node.type === "derivative") {
        return {
            type: "derivative",
            kind: node.kind,
            order: node.order,
            variable: self.semanticSequence(node.variable),
            expression: self.semanticSequence(node.expression)
        };
    }
    if (node.type === "vector") {
        return {
            type: "vector",
            name: self.getVectorName(node.name)
        };
    }
    if (node.type === "scientific") {
        return {
            type: "scientific",
            coefficient: self.semanticNode(node.coefficient),
            exponent: self.semanticSequence(node.exponent)
        };
    }
    if (node.type === "factorial" || node.type === "degree" || node.type === "percent" ) {
        return {
            type: node.type,
            value: self.semanticNode(node.value)
        };
    }
    if (node.type === "operator") {
        return {
            type: "operator",
            op: node.op,
            explicit: node.explicit
        };
    }
    if (node.type === "placeholder") {
        return {
            type: "placeholder",
            required: node.required === true
        };
    }
    return {
        type: node.type
    };
};
MoodleMathKeyboard.prototype.getVectorName = function(seq) {
    let result = "";
    let i;

    for (i = 0; i < seq.items.length; i += 1) {
        if (seq.items[i].type === "variable") result += seq.items[i].name || seq.items[i].id || "";
    }

    return result;
};
MoodleMathKeyboard.prototype.semanticSequence = function (seq) {
    let result = [];
    let i;
    for (i = 0; i < seq.items.length; i += 1) {
        result.push(this.semanticNode(seq.items[i]));
    }
    if (result.length === 0) return null;
    if (result.length === 1) return result[0];
    return {
        type: "sequence",
        items: result
    };
};

MoodleMathKeyboard.prototype.findParent = function (node, nodeId) {
    let self = this;
    let result = null;
    let i;

    function inspect(child, key, index) {
        if (result || !child) return;

        if (child.id === nodeId) {
            result = {
                parent: node,
                key: key,
                index: index
            };
            return;
        }

        result = self.findParent(child, nodeId);
    }

    if (!node) return null;

    if (node.type === "chain") {
        for (i = 0; i < node.elements.length && !result; i += 1) {
            inspect(node.elements[i], "elements", i);
        }
    } else if (node.type === "sequence") {
        for (i = 0; i < node.items.length && !result; i += 1) {
            inspect(node.items[i], "items", i);
        }
    } else if (node.type === "group" ||  node.type === "sqrt" || node.type === "absolute") {
        inspect(node.content, "content", null);
    } else if (node.type === "set" ) {
        inspect(node.content, "content", null);
    } else if (node.type === "fraction" ||
               node.type === "simpleFraction") {
        inspect(node.numerator, "numerator", null);
        inspect(node.denominator, "denominator", null);
    } else if (node.type === "mixedFraction") {
        inspect(node.whole, "whole", null);
        inspect(node.numerator, "numerator", null);
        inspect(node.denominator, "denominator", null);
    } else if (node.type === "power") {
        inspect(node.base, "base", null);
        inspect(node.exponent, "exponent", null);
    } else if (node.type === "nthRoot") {
        inspect(node.index, "index", null);
        inspect(node.content, "content", null);
    }  else if (node.type === "indexedVariable") {
        inspect(node.variable, "variable", null);
        inspect(node.subscript, "subscript", null);
    } else if (node.type === "function") {
        if (node.superscript) inspect(node.superscript, "superscript", null);
        inspect(node.argument, "argument", null);
    } else if (node.type === "namedFunction") {
        inspect(node.name, "name", null);
        if (node.superscript) inspect(node.superscript, "superscript", null);
        inspect(node.argument, "argument", null);
    } else if (node.type === "functionWithBase") {
        inspect(node.base, "base", null);
        inspect(node.argument, "argument", null);
    } else if (node.type === "prime") {
        inspect(node.value, "value", null);
    } else if (node.type === "integral") {
        inspect(node.lower, "lower", null);
        inspect(node.upper, "upper", null);
        inspect(node.integrand, "integrand", null);
        inspect(node.variable, "variable", null);
    } else if (node.type === "indexedOperator") {
        inspect(node.indexVariable, "indexVariable", null);
        inspect(node.start, "start", null);
        inspect(node.end, "end", null);
        inspect(node.body, "body", null);
    } else if (node.type === "limit") {
        inspect(node.variable, "variable", null);
        inspect(node.target, "target", null);
        inspect(node.direction, "direction", null);
        inspect(node.body, "body", null);
    } else if (node.type === "derivative") {
        inspect(node.variable, "variable", null);
        inspect(node.expression, "expression", null);
    } else if (node.type === "scientific") {
        inspect(node.coefficient, "coefficient", null);
        inspect(node.exponent, "exponent", null);
    } else if (node.type === "factorial" || node.type === "degree") {
        inspect(node.value, "value", null);
    } else if (node.type === "vector") {
        inspect(node.name, "name", null);
    }

        return result;
};

MoodleMathKeyboard.prototype.currentSyntax = function () {
    if (this.cursor.textNodeId !== null) {
        let node = this.findNode(this.editorAST, this.cursor.textNodeId);
        let parent = this.findParent(this.editorAST, node.id);

        if (parent &&
            parent.parent &&
            parent.parent.type === "sequence") {
            return parent.parent.syntax || "expression";
        }
    }

    let seq = this.currentSequence();

    if (seq) {
        return seq.syntax || "expression";
    }

    return "expression";
};
MoodleMathKeyboard.prototype.inNaturalNumberSlot = function () {
    return this.currentSyntax() === "natural";
};

MoodleMathKeyboard.prototype.getAST = function () {
    let result = {
        type: "chain",
        elements: []
    };
    let i;
    for (i = 0; i < this.editorAST.elements.length; i += 1) {
        result.elements.push(
            this.semanticSequence(this.editorAST.elements[i])
        );
    }
    return result;
};
MoodleMathKeyboard.prototype.getEditorAST = function () {
    return JSON.parse(JSON.stringify(this.editorAST));
};
/* ============================================================
   CALLBACK
   ============================================================ */
MoodleMathKeyboard.prototype.changed = function () {
    let latex = this.getLatex();
    let ast = this.getAST();
    if (typeof this.config.setValueFunc === "function") {
        this.config.setValueFunc(latex, ast);
    }
    if (typeof this.config.onChange === "function") {
        this.config.onChange({
            latex: latex,
            ast: ast,
            editorAST: this.getEditorAST()
        });
    }
    this.render();
};
/* ============================================================
   MATHJAX BUTTON LABELS
   ============================================================ */
MoodleMathKeyboard.prototype.setMathLabel = function (button, latex) {
    button.setAttribute("data-math-label", latex);
    button.textContent = "\\(" + latex + "\\)";
};
MoodleMathKeyboard.prototype.typesetButtons = function (root) {
    let buttons = root.querySelectorAll("button[data-math-label]");
    if (!window.MathJax ||
        !window.MathJax.typesetPromise ||
        buttons.length === 0) {
        return;
    }
    window.MathJax.typesetPromise(
        Array.prototype.slice.call(buttons)
    ).catch(function (error) {
        console.error("MathJax button error:", error);
    });
};
/* ============================================================
   DOM HELPERS
   ============================================================ */
MoodleMathKeyboard.prototype.applyButtonStyle = function (button) {
    button.style.minWidth = "52px";
    button.style.height = "42px";
    button.style.margin = "2px";
    button.style.padding = "3px 7px";
    button.style.border = "1px solid #999";
    button.style.borderRadius = "5px";
    button.style.backgroundColor = "#fff";
    button.style.cursor = "pointer";
    button.style.fontSize = "16px";
    button.style.verticalAlign = "middle";
};
MoodleMathKeyboard.prototype.makeButton = function (parent, latex, title, action) {
    let self = this;
    let button = document.createElement("button");
    button.type = "button";
    this.applyButtonStyle(button);
    if (latex !== null) {
        this.setMathLabel(button, latex);
    }
    if (title) button.title = title;
    button.onclick = function (event) {
        event.stopPropagation();
        if (self.config.readOnly) return;
        action();
    };
    parent.appendChild(button);
    return button;
};
MoodleMathKeyboard.prototype.makeTextButton = function (parent, text, title, action) {
    let self = this;
    let button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    this.applyButtonStyle(button);
    if (title) button.title = title;
    button.onclick = function (event) {
        event.stopPropagation();
        if (!self.config.readOnly) action();
    };
    parent.appendChild(button);
    return button;
};
MoodleMathKeyboard.prototype.makeRow = function (parent) {
    let row = document.createElement("div");
    row.style.whiteSpace = "nowrap";
    row.style.marginBottom = "4px";
    parent.appendChild(row);
    return row;
};
MoodleMathKeyboard.prototype.makePanel = function(name) {
    let self = this;
    let def = PANEL_DEFINITIONS[name];
    if (!def) return null;
    
    let panel = document.createElement("div");
    panel.setAttribute("data-panel-name", name);
    panel.style.display = "none";
    panel.style.backgroundColor = "#fff";
    panel.style.border = "1px solid #aaa";
    panel.style.borderRadius = "7px";
    panel.style.padding = "6px";
    panel.style.boxShadow = "0 2px 8px rgba(0,0,0,0.18)";
    panel.style.minWidth = "230px";
    panel.style.maxWidth = "310px";
    panel.style.boxSizing = "border-box";
    let header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "5px";
    let titleSpan = document.createElement("span");
    titleSpan.textContent = def.title;
    titleSpan.style.fontWeight = "bold";
    header.appendChild(titleSpan);
    let close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.style.width = "24px";
    close.style.height = "24px";
    close.style.padding = "0";
    close.style.border = "1px solid #999";
    close.style.borderRadius = "4px";
    close.style.backgroundColor = "#fff";
    close.onclick = function (event) {
        event.stopPropagation();
        self.closePanel(name);
    };
    header.appendChild(close);
    panel.appendChild(header);
    let body = document.createElement("div");
    body.setAttribute("data-panel-body", name);
    panel.appendChild(body);
    this.sidePanelsArea.appendChild(panel);
    this.panelElements[name] = panel;
    return body;
};
/* ============================================================
   INITIALIZATION
   ============================================================ */
MoodleMathKeyboard.prototype.init = function () {
    let host = document.getElementById(this.config.divId);
    if (!host) {
        throw new Error(
            "MoodleMathKeyboard: container not found: " +
            this.config.divId
        );
    }
    this.root = document.createElement("div");
    this.root.style.position = "relative";
    this.root.style.fontFamily = "Arial, sans-serif";
    this.root.style.direction = "ltr";
    host.appendChild(this.root);

    this.displayContainer = document.createElement("div");

    this.displayContainer.style.position = "relative";
    this.displayContainer.style.marginBottom = "7px";
    this.displayContainer.style.display = "flex";
    this.displayContainer.style.alignItems = "stretch";
    this.displayContainer.style.gap = "4px";
    this.root.appendChild(this.displayContainer);

    this.keyboardToggleButton = document.createElement("button");
    this.keyboardToggleButton.type = "button";
    this.keyboardToggleButton.textContent = "⌨";
    this.keyboardToggleButton.title = "Open keyboard";
    this.keyboardToggleButton.style.width = "42px";
    this.keyboardToggleButton.style.border = "1px solid #888";
    this.keyboardToggleButton.style.borderRadius = "6px";
    this.keyboardToggleButton.style.backgroundColor = "#fff";
    this.keyboardToggleButton.style.cursor = "pointer";
    this.keyboardToggleButton.style.fontSize = "20px";

    this.keyboardToggleButton.onclick = function(event) {
        event.stopPropagation();
        self.showKeyboard();
    };

    this.displayContainer.appendChild(this.keyboardToggleButton);

    this.display = document.createElement("div");
    this.display.setAttribute("dir", "ltr");
    this.display.style.direction = "ltr";
    this.display.style.textAlign = "left";
    this.display.style.minHeight = "54px";
    this.display.style.border = "1px solid #888";
    this.display.style.borderRadius = "6px";
    this.display.style.padding = "8px 10px";
    this.display.style.backgroundColor = "#fff";
    this.display.style.fontSize = "22px";
    this.display.style.boxSizing = "border-box";
    this.display.style.overflowX = "auto";
    this.display.style.flex = "1";
    this.display.style.minWidth = "0";
    this.displayContainer.appendChild(this.display);
    this.display.onclick = function(event) {
        event.stopPropagation();
        if (!self.config.readOnly) self.showKeyboard();
    };

    this.caret = document.createElement("div");

    this.caret.style.position = "absolute";
    this.caret.style.width = "1px";
    this.caret.style.backgroundColor = "#000";
    this.caret.style.pointerEvents = "none";
    this.caret.style.display = "none";
    this.caret.style.zIndex = "10";

    this.displayContainer.appendChild(this.caret);

    this.keyboardArea = document.createElement("div");
    this.keyboardArea.style.display = "flex";
    this.keyboardArea.style.alignItems = "flex-start";
    this.keyboardArea.style.gap = "7px";
  
    this.sidePanelsArea = document.createElement("div");
    this.sidePanelsArea.style.display = "flex";
    this.sidePanelsArea.style.alignItems = "flex-start";
    this.sidePanelsArea.style.gap = "6px";
    this.sidePanelsArea.style.flexWrap = "wrap";
  
    this.mainPanel = document.createElement("div");
    this.mainPanel.style.backgroundColor = "#f7f7f7";
    this.mainPanel.style.border = "1px solid #aaa";
    this.mainPanel.style.borderRadius = "7px";
    this.mainPanel.style.padding = "6px";
    this.mainPanel.style.boxSizing = "border-box";
    this.mainPanel.style.whiteSpace = "nowrap";

    this.popup = document.createElement("div");
    this.popup.style.position = "absolute";
    this.popup.style.left = "0px";
    this.popup.style.top = "60px";
    this.popup.style.backgroundColor = "#f7f7f7";
    this.popup.style.border = "1px solid #555";
    this.popup.style.borderRadius = "8px";
    this.popup.style.padding = "6px";
    this.popup.style.boxShadow = "0 3px 12px rgba(0,0,0,0.25)";
    this.popup.style.zIndex = "99999";
    this.popup.style.display = "none"; 
    this.popup.onclick = function(event) {
        event.stopPropagation();
    };
    this.root.appendChild(this.popup);

    let self = this;
    let title = document.createElement("div");
    title.style.direction = "ltr";
    title.style.cursor = "move";
    title.style.backgroundColor = "#ddd";
    title.style.padding = "4px";
    title.style.borderRadius = "5px";
    title.style.marginBottom = "6px";
    title.style.display = "flex";
    title.style.justifyContent = "space-between";
    title.style.alignItems = "center";

    let titleText = document.createElement("span");
    titleText.textContent = "Math Keyboard";
    title.appendChild(titleText);

    this.popupContent = document.createElement("div");
    this.popupContent.style.display = "flex";
    this.popupContent.style.alignItems = "flex-start";
    this.popupContent.style.gap = "7px";

    let closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.title = "Close";
    closeButton.style.border = "none";
    closeButton.style.backgroundColor = "transparent";
    closeButton.style.padding = "0";
    closeButton.style.cursor = "pointer";
    closeButton.style.fontSize = "20px";
    closeButton.onclick = function(event) {
        event.stopPropagation();
        self.hideKeyboard();
    };
    title.appendChild(closeButton);

    title.onmousedown = function(event) {
        if (event.target === closeButton) return;

        self.isDragging = true;
        self.dragDX = event.clientX - self.popup.offsetLeft;
        self.dragDY = event.clientY - self.popup.offsetTop;

        document.onmousemove = function(ev) {
            if (!self.isDragging) return;
            self.popup.style.left = (ev.clientX - self.dragDX) + "px";
            self.popup.style.top = (ev.clientY - self.dragDY) + "px";
        };

        document.onmouseup = function() {
                self.isDragging = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
    };

    this.popup.appendChild(title);
    this.popup.appendChild(this.popupContent);

    this.popupContent.appendChild(this.mainPanel);
    this.popupContent.appendChild(this.sidePanelsArea);
    this.dragBar = title;

    this.buildAllPanels();
    this.buildMainPanel();
    if (this.config.debug) this.buildDebugArea();
    
    this.renderWhenMathJaxReady();

    function typesetMainPanelWhenReady() {
        if (window.MathJax && window.MathJax.typesetPromise) {
            self.typesetButtons(self.mainPanel);
            return;
        }

        setTimeout(typesetMainPanelWhenReady, 20);
    }

    typesetMainPanelWhenReady();
};
MoodleMathKeyboard.prototype.showKeyboard = function() {
    if (!this.popup) return;
    this.popup.style.display = "block";
};

MoodleMathKeyboard.prototype.hideKeyboard = function() {
    if (!this.popup) return;
    this.popup.style.display = "none";
};

MoodleMathKeyboard.prototype.renderWhenMathJaxReady = function () {
    let self = this;

    if (window.MathJax && window.MathJax.typesetPromise) {
        this.render();
        return;
    }

    setTimeout(function () {
        self.renderWhenMathJaxReady();
    }, 20);
};
/* ============================================================
   MAIN PANEL
   ============================================================ */
let PANEL_DEFINITIONS = {
    variables: { title: "Variables / constants", persistent: true },
    functions: { title: "Functions", persistent: true },
    structures: { title: "Structures", persistent: false },
    symbols: { title: "Symbols", persistent: true },
    units: { title: "Units", persistent: false }
};
MoodleMathKeyboard.prototype.closeNonPersistentPanels = function(exceptName) {
    let name;

    for (name in PANEL_DEFINITIONS) {
        if (!Object.prototype.hasOwnProperty.call(PANEL_DEFINITIONS, name)) continue;
        if (name === exceptName) continue;
        if (PANEL_DEFINITIONS[name].persistent) continue;

        this.closePanel(name);
    }
};
MoodleMathKeyboard.prototype.buildMainPanel = function () {
    let self = this;
    let row;
    row = this.makeRow(this.mainPanel);
    
    let i;

    for (i = 0; i < FIXED_EXPONENT_KEYS.length; i += 1) {
        (function(def) {
            self.makeButton(row, def.latex, def.title, function() {
                self.insertFixedExponent(def.exponent);
            });
        })(FIXED_EXPONENT_KEYS[i]);
    }
    this.makeButton(row, "x^{\\square}", "Power", function () {
        self.insertPower();
    });
    this.makeButton(row, "\\sqrt{\\square}", "Square root", function () {
        self.insertSqrt();
    });
    this.makeButton(row, "\\sqrt[\\square]{x}", "Nth root", function() {
        self.insertNthRoot();
    });
    this.makeButton(row, "x_{\\square}", "Subscript", function () {
        self.insertSubscript();
    });
    
    row = this.makeRow(this.mainPanel);
    this.makeButton(row, "\\pi", "Pi", function() {
        self.insertConstant("pi", "\\pi ");
    });
    this.makeButton(row, "x{.\\!.\\!.}", "Variables and constants", function () {
        self.togglePanel("variables");
    });
    this.makeButton(row, "f(){.\\!.\\!.}", "Functions", function () {
        self.togglePanel("functions");
    });
    this.makeButton(row, "\\int\\;\\sum", "Structures", function () {
        self.togglePanel("structures");
    });
    this.makeButton(row, "\\infty\\;\\le", "Symbols", function () {
        self.togglePanel("symbols");
    });
    if (this.config.withUnits) {
        this.makeButton(row, "[\\mathrm{u}]", "Select units", function() {
            self.togglePanel("units");
        });
    }
    row = this.makeRow(this.mainPanel);
    this.makeButton(row, "\\frac{\\square}{\\square}", "Fraction / mixed fraction", function () {
        self.insertSimpleFraction();
    });
    this.makeButton(row, "\\left(\\square\\right)", "Parentheses", function () {
        self.insertGroup();
    });

    if (this.config.structures.sets) {
        this.makeButton(row, "\\left\\{\\square\\right\\}", "Set", function() {
            self.insertSet();
        });
    }

    this.makeCommaButton(row, COMMA_SYMBOL);

    this.makeTextButton(row, "DEL", "Delete left", function () {
        self.deleteLeft();
    });
    this.makeTextButton(row, "AC", "Clear all", function () {
        self.clearAll();
    });
    let table = document.createElement("table");
    table.style.borderCollapse = "separate";
    table.style.borderSpacing = "3px";
    table.style.marginTop = "2px";
    table.style.margin = "2px auto 0 auto";
    this.mainPanel.appendChild(table);
    let rows = [
        ["7", "8", "9", "/"],
        ["4", "5", "6", "*"],
        ["1", "2", "3", "-"],
        ["0", ".", "SCI", "+"]
    ];
    let r;
    let c;
    for (r = 0; r < rows.length; r += 1) {
        let tr = document.createElement("tr");
        table.appendChild(tr);
        for (c = 0; c < rows[r].length; c += 1) {
            let td = document.createElement("td");
            tr.appendChild(td);
            this.buildCalculatorKey(td, rows[r][c]);
        }
    }

    // insert arrows around the = button 
    row = this.makeRow(this.mainPanel);
    row.style.textAlign = "center";
    this.makeTextButton(row, "←", "Move left", function () {
        self.moveCursor(-1);
    });
    
    if (this.config.enableEquals) {
       
        let equals = this.makeButton(row, "=", "Equals / next chain element", function () {
            self.insertEquals();
        });
        equals.style.width = "134px";
    }
    this.makeTextButton(row, "→", "Move right", function () {
        self.moveCursor(1);
    });
};

/* ============================================================
   CALCULATOR KEYS
   ============================================================ */
MoodleMathKeyboard.prototype.buildCalculatorKey = function (td, key) {
    let self = this;
    if (key >= "0" && key <= "9") {
        this.makeButton(td, key, key, function () {
            self.insertDigit(key);
        });
        return;
    }
    if (key === ".") {
        this.makeButton(td, ".", "Decimal point", function () {
            self.insertDecimal();
        });
        return;
    }
    if (key === "/") {
        this.makeButton(td, "\\div", "Fraction / mixed fraction", function () {
            self.insertDivide();
        });
        return;
    }
    if (key === "*") {
        this.makeButton(td, "\\times", "Multiply", function () {
            self.insertOperator("*", true);
        });
        return;
    }
    if (key === "-") {
        this.makeButton(td, "-", "Minus", function () {
            self.insertOperator("-", true);
        });
        return;
    }
    if (key === "+") {
        this.makeButton(td, "+", "Plus", function () {
            self.insertOperator("+", true);
        });
        return;
    }
    if (key === "SCI") {
        this.makeButton(td, "\\times10^{\\square}", "Scientific notation", function () {
            self.insertScientific();
        });
    }
};
/* ============================================================
   PANELS
   ============================================================ */
MoodleMathKeyboard.prototype.buildAllPanels = function() {
    if (this.config.withUnits) {
        this.buildUnitsPanel(this.makePanel("units"));
    }
    this.buildStructuresPanel(this.makePanel("structures"));
    this.buildVariablesPanel(this.makePanel("variables"));
    this.buildFunctionsPanel(this.makePanel("functions"));
    this.buildSymbolsPanel(this.makePanel("symbols"));

    
};
MoodleMathKeyboard.prototype.addPanelHeading = function (body, text) {
    let div = document.createElement("div");
    div.textContent = text;
    div.style.fontWeight = "bold";
    div.style.fontSize = "12px";
    div.style.marginTop = "4px";
    div.style.marginBottom = "2px";
    body.appendChild(div);
};
MoodleMathKeyboard.prototype.buildVariablesPanel = function (body) {
    let self = this;
    let row;
    let i;
    this.addPanelHeading(body, "Constants");
    row = this.makeRow(body);
    
    if (this.config.complexNumbers) {
        this.makeButton(row, "i", "Imaginary unit", function () {
            self.insertConstant("i", "i");
        });
    }
    this.makeButton(row, "e", "Euler's number", function () {
        self.insertConstant("e", "e");
    });
    this.addPanelHeading(body, "Variables");
    row = null;
    for (i = 0; i < this.config.variables.length; i += 1) {
        if (i % 4 === 0) row = this.makeRow(body);
        (function (def) {
            self.makeButton(row, def.latex, def.label || def.id, function () {
                self.insertVariable(def);
            });
        })(this.config.variables[i]);
    }
};
MoodleMathKeyboard.prototype.buildFunctionsPanel = function (body) {
    let self = this;
    let row;
    if (this.config.functions.logarithmic) {
        this.addPanelHeading(body, "Logarithmic");
        row = this.makeRow(body);
        this.makeButton(row, "\\ln", "Natural logarithm", function () {
            self.insertFunction("ln", "\\ln", null);
        });
        this.makeButton(row, "\\log", "Base 10 logarithm", function () {
            self.insertFunction("log10", "\\log", null);
        });
        this.makeButton(row, "\\log_{a}", "Arbitrary-base logarithm", function () {
            self.insertLogWithBase();
        });
    }
    if (this.config.functions.trigonometric) {
        this.addPanelHeading(body, "Trigonometric");
        row = this.makeRow(body);
        this.makeButton(row, "\\sin", "Sine", function () {
            self.insertFunction("sin", "\\sin", null);
        });
        this.makeButton(row, "\\cos", "Cosine", function () {
            self.insertFunction("cos", "\\cos", null);
        });
        this.makeButton(row, "\\tan", "Tangent", function () {
            self.insertFunction("tan", "\\tan", null);
        });
    }
    if (this.config.functions.inverseTrigonometric) {
        row = this.makeRow(body);
        this.makeButton(row, "\\sin^{-1}", "Inverse sine", function () {
            self.insertFunction("asin", "", "\\sin");
        });
        this.makeButton(row, "\\cos^{-1}", "Inverse cosine", function () {
            self.insertFunction("acos", "", "\\cos");
        });
        this.makeButton(row, "\\tan^{-1}", "Inverse tangent", function () {
            self.insertFunction("atan", "", "\\tan");
        });
    }
    if (this.config.functions.hyperbolic) {
        this.addPanelHeading(body, "Hyperbolic");
        row = this.makeRow(body);
        this.makeButton(row, "\\sinh", "Hyperbolic sine", function () {
            self.insertFunction("sinh", "\\sinh", null);
        });
        this.makeButton(row, "\\cosh", "Hyperbolic cosine", function () {
            self.insertFunction("cosh", "\\cosh", null);
        });
        this.makeButton(row, "\\tanh", "Hyperbolic tangent", function () {
            self.insertFunction("tanh", "\\tanh", null);
        });
    }
    if (this.config.functions.inverseHyperbolic) {
        row = this.makeRow(body);
        this.makeButton(row, "\\sinh^{-1}", "Inverse hyperbolic sine", function () {
            self.insertFunction("asinh", "", "\\sinh");
        });
        this.makeButton(row, "\\cosh^{-1}", "Inverse hyperbolic cosine", function () {
            self.insertFunction("acosh", "", "\\cosh");
        });
        this.makeButton(row, "\\tanh^{-1}", "Inverse hyperbolic tangent", function () {
            self.insertFunction("atanh", "", "\\tanh");
        });
    }
    if (this.config.functions.namedFunction) {
        this.addPanelHeading(body, "Named function");
        row = this.makeRow(body);
        this.makeButton(row, "f\\left(\\square\\right)", "Named function", function () {
            self.insertNamedFunction();
        });
        this.makeButton(row, "'", "Prime", function () {
            self.applyPrime();
        });
    }
};
MoodleMathKeyboard.prototype.buildStructuresPanel = function (body) {
    let self = this;
    let btnCount = 0;
    let row;
    function checkRow() {
        if ( btnCount % 5 == 0 ) {
            row = self.makeRow(body);
        }
        btnCount++;

    }
    
    if (this.config.structures.absoluteValue) {
        checkRow();
        this.makeButton(row, "\\left|x\\right|", "Absolute value", function () {
            self.insertAbsolute();
            self.closePanel("structures");
        });
    }
    if (this.config.structures.integral) {
        checkRow();
        this.makeButton(row, "\\int", "Integral", function () {
            self.insertIntegral();
            self.closePanel("structures");
        });
    }
    if (this.config.structures.summation) {
        checkRow();
        this.makeButton(row, "\\sum", "Summation", function () {
            self.insertIndexedOperator("sum");
            self.closePanel("structures");
        });
    }
    if (this.config.structures.product) {
        checkRow();
        this.makeButton(row, "\\prod", "Product", function () {
            self.insertIndexedOperator("product");
            self.closePanel("structures");
        });
    }
    if (this.config.structures.limit) {
        checkRow();
        this.makeButton(row, "\\lim", "Limit", function () {
            self.insertLimit();
            self.closePanel("structures");
        });
    }
    if (this.config.structures.vector) {
        checkRow();
        this.makeButton(row, "\\vec{u}", "Vector", function() {
            self.insertVector();
            self.closePanel("structures");
        });
    } 
    if (this.config.structures.derivative) {
        checkRow();
        this.makeButton(row, "\\frac{d}{dx}", "Derivative", function() {
            self.insertDerivative("ordinary");
           // self.closePanel("structures");
        });
    }

    if (this.config.structures.partialDerivative) {
        checkRow();
        this.makeButton(row, "\\frac{\\partial}{\\partial x}", "Partial derivative", function() {
            self.insertDerivative("partial");
           // self.closePanel("structures");
        });
    }
    
};
MoodleMathKeyboard.prototype.makeClearUnitButton = function(parent) {
    let self = this;
    let button = document.createElement("button");
    button.type = "button";
    button.title = this.getLocalizedText({ en: "No unit", he: "ללא יחידה", ar: "بدون وحدة" });
    button.textContent = button.title;
    button.style.minWidth = "52px";
    button.style.height = "36px";
    button.style.margin = "2px";
    button.onclick = function() {
        self.clearUnit();
    };
    parent.appendChild(button);
    return button;
};

MoodleMathKeyboard.prototype.buildUnitsPanel = function(body) {
    let categoryName;
    let groupName;
    let category;
    let group;
    let row = null;
    let i;
    let column = 0;
    row = this.makeRow(body);
    this.makeClearUnitButton(row);

    for (categoryName in UNIT_GROUPS) {
        if (!Object.prototype.hasOwnProperty.call(UNIT_GROUPS, categoryName)) continue;

        category = UNIT_GROUPS[categoryName];

        let categoryTitle = document.createElement("div");
        categoryTitle.textContent = this.getLocalizedText(category.title);
        categoryTitle.style.fontWeight = "bold";
        categoryTitle.style.marginTop = "6px";
        body.appendChild(categoryTitle);

        for (groupName in category.groups) {
            if (!Object.prototype.hasOwnProperty.call(category.groups, groupName)) continue;

            group = category.groups[groupName];

            let groupTitle = document.createElement("div");
            groupTitle.textContent = this.getLocalizedText(group.title);
            groupTitle.style.fontSize = "12px";
            groupTitle.style.marginTop = "4px";
            body.appendChild(groupTitle);

            row = this.makeRow(body);
            column = 0;

            for (i = 0; i < group.units.length; i += 1) {
                if (column === 5) {
                    row = this.makeRow(body);
                    column = 0;
                }

                this.makeUnitButton(row, group.units[i]);
                column += 1;
            }
        }
    }
};

MoodleMathKeyboard.prototype.makeUnitButton = function(parent, unit) {
    let self = this;
    let button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-math-label", unit.latex);
    button.textContent = unit.symbol;
    button.title = this.getUnitName(unit);
    button.style.minWidth = "52px";
    button.style.height = "36px";
    button.style.margin = "2px";
    button.onclick = function() {
        self.selectUnit(unit);
    };
    parent.appendChild(button);
    return button;
};

MoodleMathKeyboard.prototype.toggleUnitsPanel = function() {
    if (!this.unitPanel) return;
    this.unitPanel.style.display = this.unitPanel.style.display === "none" ? "block" : "none";
};
MoodleMathKeyboard.prototype.selectUnit = function(unit) {
    this.unitValue = unit.value;
    this.unitScale = unit.scale;
    this.closePanel("units");
    this.changed();
};
MoodleMathKeyboard.prototype.clearUnit = function() {
    this.unitValue = "";
    this.unitScale = 1;
    this.closePanel("units");
    this.changed();
};
MoodleMathKeyboard.prototype.getUnitLatex = function() {
    if (!this.unitValue) return "";

    let categoryName;
    let groupName;
    let category;
    let group;
    let i;
    let unit;

    for (categoryName in UNIT_GROUPS) {
        if (!Object.prototype.hasOwnProperty.call(UNIT_GROUPS, categoryName)) continue;

        category = UNIT_GROUPS[categoryName];

        for (groupName in category.groups) {
            if (!Object.prototype.hasOwnProperty.call(category.groups, groupName)) continue;

            group = category.groups[groupName];

            for (i = 0; i < group.units.length; i += 1) {
                unit = group.units[i];

                if (unit.value === this.unitValue) {
                    return unit.latex;
                }
            }
        }
    }

    return "";
};
MoodleMathKeyboard.prototype.getEditingDisplayLatex = function() {
    let latex = this.getEditingLatex();
    let unitLatex = this.getUnitLatex();

    if (unitLatex) latex += "\\;" + unitLatex;

    return latex;
};
MoodleMathKeyboard.prototype.getUnit = function() {
    return this.unitValue;
};

MoodleMathKeyboard.prototype.getUnitScale = function() {
    return this.unitScale;
};
MoodleMathKeyboard.prototype.buildSymbolsPanel = function(body) {
    let groupName;
    for (groupName in SYMBOL_GROUPS) {
        if (!Object.prototype.hasOwnProperty.call(SYMBOL_GROUPS, groupName)) continue;
        let group = SYMBOL_GROUPS[groupName];
        if (this.config.symbols[group.enabledBy]) this.addSymbolGroup(body, groupName);
    }
};

MoodleMathKeyboard.prototype.addSymbolGroup = function(body, groupName) {
    let self = this;
    let group = SYMBOL_GROUPS[groupName];
    let row = null;
    let i;
    if (!group) return;

    this.addPanelHeading(body, group.title);

    for (i = 0; i < group.symbols.length; i += 1) {
        if (i % 5 === 0) row = this.makeRow(body);

        (function(symbol) {
            let button = self.makeButton(row, symbol.latex, symbol.title, 
                symbol.type == "separator"  ? function() {self.insertSeparator(symbol);} :
                function() {self.insertSymbolDefinition(symbol);}
            );
            button.style.minWidth = "42px";
            button.style.width = "42px";
        })(group.symbols[i]);
    }
};

MoodleMathKeyboard.prototype.makeCommaButton = function(row, symbol) {
    let self = this;

    let button = self.makeButton(row, symbol.latex, symbol.title, 
        function() {self.insertSeparator(symbol);} 
    );
    button.style.minWidth = "42px";
    button.style.width = "42px";
};

MoodleMathKeyboard.prototype.insertSeparator = function(def) {
    if (!this.syntaxAllows(def.id)) return;

    if (!this.normalizeCursorToSequence()) return;

    let node = {
        id: this.newId(),
        type: "separator",
        separator: def.id
    };

    if (this.insertIntoSequence(node)) this.changed();
};
MoodleMathKeyboard.prototype.insertSymbolDefinition = function(symbol) {
    if (!symbol) return;

    if (symbol.type === "symbol") {
        if (!this.syntaxAllows("symbol") && !this.syntaxAllows("constant")) return;
        this.insertConstant(symbol.id, symbol.latex);
        return;
    }

    if (symbol.type === "operator") {
        this.insertOperator(symbol.op, true);
        return;
    }

    if (symbol.type === "postfix") {
        if (!this.syntaxAllows("postfix")) return;
        this.wrapPreviousPostfix(symbol.action);
    }
};
MoodleMathKeyboard.prototype.nodeBeforeCursor = function() {
    if (this.cursor.textNodeId !== null) {
        let node = this.findNode(this.editorAST, this.cursor.textNodeId);
        let parentInfo = this.findParent(this.editorAST, this.cursor.textNodeId);

        if (!node || !parentInfo || parentInfo.parent.type !== "sequence") return null;

        if (this.cursor.charOffset > 0) return node;

        if (parentInfo.index <= 0) return null;

        return parentInfo.parent.items[parentInfo.index - 1];
    }

    let seq = this.currentSequence();
    if (!seq || this.cursor.offset <= 0) return null;

    return seq.items[this.cursor.offset - 1];
};
MoodleMathKeyboard.prototype.getSymbolDefinitionByOperator = function (op) {
    let groupName;
    let group;
    let i;
    let symbol;

    for (groupName in SYMBOL_GROUPS) {
        if (!Object.prototype.hasOwnProperty.call(SYMBOL_GROUPS, groupName)) continue;

        group = SYMBOL_GROUPS[groupName];

        for (i = 0; i < group.symbols.length; i += 1) {
            symbol = group.symbols[i];

            if (symbol.type === "operator" && symbol.op === op) {
                return symbol;
            }
            if (symbol.type === "separator" && symbol.operator === op) {
                return symbol;
            }
        }
    }

    return null;
};
MoodleMathKeyboard.prototype.sequenceCharCount = function(seq) {
    return seq ? seq.items.length : 0;
};
let FIXED_EXPONENT_KEYS = [
    { id: "square", latex: "x^2", title: "Square", exponent: "2" },
    { id: "reciprocal", latex: "x^{-1}", title: "Reciprocal", exponent: "-1" }
];
let COMMA_SYMBOL = {
                id: "comma",
                operator: ",",
                latex: ",\\,",
                title: "Comma",
                type: "separator"
            };

let SYMBOL_GROUPS = {
    general: {
    title: "General",
    enabledBy: "general",
        symbols: [
            {
                id: "infinity",
                latex: "\\infty ",
                title: "Infinity",
                type: "symbol"
            },
            {
                id: "factorial",
                latex: "!",
                title: "Factorial",
                type: "postfix",
                action: "factorial"
            },
            {
                id: "percent",
                latex: "\\%",
                title: "Percent",
                type: "postfix",
                action: "percent"
            },
            {
                id: "emptyset",
                latex: "\\emptyset ",
                title: "empty set",
                type: "symbol"
            },
            {
                id: "approximate",
                latex: "\\approx ",
                title: "Approximately equal",
                type: "operator",
                op: "approximate"
            },
            {
                id: "plusMinus",
                latex: "\\pm ",
                title: "Plus or minus",
                type: "operator",
                op: "plusMinus"
            },
            {
                id: "minusPlus",
                latex: "\\mp ",
                title: "Minus or plus",
                type: "operator",
                op: "minusPlus"
            },
            {
                id: "naturalNumbers",
                latex: "\\mathbb{N} ",
                title: "Natural numbers",
                type: "symbol"
            },
            {
                id: "realNumbers",
                latex: "\\mathbb{R} ",
                title: "Real numbers",
                type: "symbol"
            },
            {
                id: "realNumbers",
                latex: "\\mathbb{C} ",
                title: "Complex numbers",
                type: "symbol"
            }
        ]
    },
    relations: {
        title: "Relations",
        enabledBy: "relations",
        symbols: [
            {
                id: "less",
                latex: "<",
                title: "Less than",
                type: "operator",
                op: "less"
            },
            {
                id: "lessEqual",
                latex: "\\le ",
                title: "Less than or equal",
                type: "operator",
                op: "lessEqual"
            },
            {
                id: "greater",
                latex: ">",
                title: "Greater than",
                type: "operator",
                op: "greater"
            },
            {
                id: "greaterEqual",
                latex: "\\ge ",
                title: "Greater than or equal",
                type: "operator",
                op: "greaterEqual"
            },
            {
                id: "notEqual",
                latex: "\\ne ",
                title: "Not equal",
                type: "operator",
                op: "notEqual"
            }
        ]
    },

    logic: {
        title: "Logic",
        enabledBy: "logic",
        symbols: [
            {
                id: "forall",
                latex: "\\forall ",
                title: "For all",
                type: "symbol"
            },
            {
                id: "exists",
                latex: "\\exists ",
                title: "Exists",
                type: "symbol"
            },
            {
                id: "memberOf",
                latex: "\\in ",
                title: "Member of",
                type: "operator",
                op: "memberOf"
            },
            {
                id: "notMemberOf",
                latex: "\\notin ",
                title: "Not a member of",
                type: "operator",
                op: "notMemberOf"
            },
            {
                id: "implies",
                latex: "\\Rightarrow ",
                title: "Implies",
                type: "symbol",
                operator: "implies"
            }
        ]
    },

    geometry: {
        title: "Geometry",
        enabledBy: "geometry",
        symbols: [
            {
                id: "degree",
                latex: "^{\\circ}",
                title: "Degrees",
                type: "postfix",
                action: "degree"
            },
            {
                id: "angle",
                latex: "\\measuredangle ",
                title: "Angle",
                type: "symbol"
            },
            {
                id: "triangle",
                latex: "\\triangle ",
                title: "Triangle",
                type: "symbol"
            },
            {
                id: "congruent",
                latex: "\\cong ",
                title: "Congruent ",
                type: "operator",
                op: "congruent"
            },
            {
                id: "similar",
                latex: "\\sim ",
                title: "Similar",
                type: "operator",
                op: "similar"
            },
            {
                id: "parallel",
                latex: "\\parallel ",
                title: "Parallel",
                type: "operator",
                op: "parallel"
            },
            {
                id: "perpendicular",
                latex: "\\perp ",
                title: "Perpendicular",
                type: "operator",
                op: "perpendicular"
            }
        ]
    }
};
let SYNTAX_RULES = {
    expression: { allow: ["digit","decimal","variable","constant","plus","minus",
        "additive","multiply","divide","relation","group","sqrt","nthRoot",
        "fixedExponent","power","simpleFraction","function","namedFunction",
        "integral","sum","product","limit","derivative","absolute","scientific","postfix",
        "symbol","subscript", "comma", "set", "vector", ] },

    natural: { allow: ["digit"] },
    setContent: { allow: ["comma", "digit","decimal","variable","constant","plus","minus","additive",
        "multiply","divide","group","sqrt","nthRoot","fixedExponent","power","simpleFraction","function",
        "namedFunction","absolute","scientific","postfix","symbol","subscript","comma"]
    },
    functionName: {
        allow: ["variable", "digit", "postfix", "fixedExponent"],
        maxChars: 4,
        validate: function(kbd, action) {
            let seq = kbd.currentOrContainingSequence();
            if (!seq || seq.syntax !== "functionName") return false;

            if (action === "variable" || action === "digit") {
                return seq.items.length < SYNTAX_RULES.functionName.maxChars;
            }

            if (action === "postfix" || action === "fixedExponent") {
                return seq.items.length > 0;
            }

            return false;
        }
    },
    vectorName: {
        allow: ["variable"],
        maxItems: 2,
        autoAdvanceWhenFull: true,
        validate: function(kbd, action) {
            let seq = kbd.currentSequence();
            if (!seq) return false;
            return action === "variable" && seq.items.length < SYNTAX_RULES.vectorName.maxItems;
        }
    },
    variableOnly: {
        allow: ["variable"],
        maxChars: 1,
        autoAdvance: true,
        validate: function(kbd, action) {
            let seq = kbd.currentSequence();
            return action === "variable" && !!seq && seq.items.length === 0;
        }
    },

    limitDirection: {
        allow: ["plus","minus"],
        autoAdvance: true,
        validate: function(kbd, action) {
            let seq = kbd.currentSequence();
            return !!seq && seq.items.length === 0;
        }
    },

    signedInteger: {
        allow: ["digit","plus","minus"],
        validate: function(kbd, action) {
            if (action === "digit") return true;
            let seq = kbd.currentSequence();
            return !!seq && seq.items.length === 0;
        }
    },

    subscript: { allow: ["digit","variable","plus","minus", "symbol", "comma"] },

    limitTarget: { allow: ["digit","decimal","variable","constant","plus","minus","simpleFraction"] }
};

let ACTION_RULES = {
    comma: {
        validate: function(kbd) {
            let previous = kbd.nodeBeforeCursor();

            if (!previous) return false;

            if (previous.type === "separator" && previous.separator === "comma") return false;

            return true;
        }
    }
};

let OPERATOR_DEFS = {
    "+": { actionType: "plus", latex: "+" },
    "-": { actionType: "minus", latex: "-" },
    "*": { actionType: "multiply", latexFromConfig: true },

    less: { actionType: "relation", latex: "<" },
    lessEqual: { actionType: "relation", latex: "\\le " },
    greater: { actionType: "relation", latex: ">" },
    greaterEqual: { actionType: "relation", latex: "\\ge " },
    notEqual: { actionType: "relation", latex: "\\ne " },

    approximate: { actionType: "relation", latex: "\\approx " },
    memberOf: { actionType: "relation", latex: "\\in " },
    notMemberOf: { actionType: "relation", latex: "\\notin " },
    implies: { actionType: "relation", latex: "\\Rightarrow " },

    plusMinus: { actionType: "additive", latex: "\\pm " },
    minusPlus: { actionType: "additive", latex: "\\mp " },

    congruent: { actionType: "relation", latex: "\\cong " },
    similar: { actionType: "relation", latex: "\\sim " },
    parallel: { actionType: "relation", latex: "\\parallel " },
    perpendicular: { actionType: "relation", latex: "\\perp " }
};

MoodleMathKeyboard.prototype.getLocalizedText = function(value) {
    if (typeof value === "string") return value;
    if (!value) return "";
    return value[this.config.language] || value.en || "";
};
MoodleMathKeyboard.prototype.getUnitName = function(unit) {
    if (!unit) return "";
    return unit[this.config.language] || unit.en || unit.value || "";
};
let UNIT_GROUPS = {
    measurements: {
        title: {
            en: "Measurements",
            he: "מדידות",
            ar: "القياسات"
        },

        groups: {
            length: {
                title: {
                    en: "Length",
                    he: "אורך",
                    ar: "الطول"
                },

                units: [
                    {
                        value: "mm",
                        scale: 0.001,
                        symbol: "mm",
                        latex: "\\mathrm{mm}",
                        en: "millimeter",
                        he: "מילימטר",
                        ar: "مليمتر"
                    },
                    {
                        value: "cm",
                        scale: 0.01,
                        symbol: "cm",
                        latex: "\\mathrm{cm}",
                        en: "centimeter",
                        he: "סנטימטר",
                        ar: "سنتيمتر"
                    },
                    {
                        value: "m",
                        scale: 1,
                        symbol: "m",
                        latex: "\\mathrm{m}",
                        en: "meter",
                        he: "מטר",
                        ar: "متر"
                    },
                    {
                        value: "km",
                        scale: 1000,
                        symbol: "km",
                        latex: "\\mathrm{km}",
                        en: "kilometer",
                        he: "קילומטר",
                        ar: "كيلومتر"
                    }
                ]
            },

            area: {
                title: {
                    en: "Area",
                    he: "שטח",
                    ar: "المساحة"
                },

                units: [
                    {
                        value: "cm^2",
                        scale: 0.0001,
                        symbol: "cm²",
                        latex: "\\mathrm{cm^2}",
                        en: "square centimeter",
                        he: "סנטימטר רבוע",
                        ar: "سنتيمتر مربع"
                    },
                    {
                        value: "m^2",
                        scale: 1,
                        symbol: "m²",
                        latex: "\\mathrm{m^2}",
                        en: "square meter",
                        he: "מטר רבוע",
                        ar: "متر مربع"
                    },
                    {
                        value: "km^2",
                        scale: 1000000,
                        symbol: "km²",
                        latex: "\\mathrm{km^2}",
                        en: "square kilometer",
                        he: "קילומטר רבוע",
                        ar: "كيلومتر مربع"
                    }
                ]
            },

            volume: {
                title: {
                    en: "Volume",
                    he: "נפח",
                    ar: "الحجم"
                },

                units: [
                    {
                        value: "cm^3",
                        scale: 0.000001,
                        symbol: "cm³",
                        latex: "\\mathrm{cm^3}",
                        en: "cubic centimeter",
                        he: "סנטימטר מעוקב",
                        ar: "سنتيمتر مكعب"
                    },
                    {
                        value: "m^3",
                        scale: 1,
                        symbol: "m³",
                        latex: "\\mathrm{m^3}",
                        en: "cubic meter",
                        he: "מטר מעוקב",
                        ar: "متر مكعب"
                    },
                    {
                        value: "L",
                        scale: 0.001,
                        symbol: "L",
                        latex: "\\mathrm{L}",
                        en: "liter",
                        he: "ליטר",
                        ar: "لتر"
                    }
                ]
            }
        }
    },

    motion: {
        title: {
            en: "Motion",
            he: "תנועה",
            ar: "الحركة"
        },

        groups: {
            time: {
                title: {
                    en: "Time",
                    he: "זמן",
                    ar: "الزمن"
                },

                units: [
                    {
                        value: "s",
                        scale: 1,
                        symbol: "s",
                        latex: "\\mathrm{s}",
                        en: "second",
                        he: "שנייה",
                        ar: "ثانية"
                    },
                    {
                        value: "min",
                        scale: 60,
                        symbol: "min",
                        latex: "\\mathrm{min}",
                        en: "minute",
                        he: "דקה",
                        ar: "دقيقة"
                    },
                    {
                        value: "h",
                        scale: 3600,
                        symbol: "h",
                        latex: "\\mathrm{h}",
                        en: "hour",
                        he: "שעה",
                        ar: "ساعة"
                    }
                ]
            },

            speed: {
                title: {
                    en: "Speed",
                    he: "מהירות",
                    ar: "السرعة"
                },

                units: [
                    {
                        value: "m/s",
                        scale: 1,
                        symbol: "m/s",
                        latex: "\\frac{\\mathrm{m}}{\\mathrm{s}}",
                        en: "meter per second",
                        he: "מטר לשנייה",
                        ar: "متر في الثانية"
                    },
                    {
                        value: "km/h",
                        scale: 1000 / 3600,
                        symbol: "km/h",
                        latex: "\\frac{\\mathrm{km}}{\\mathrm{h}}",
                        en: "kilometer per hour",
                        he: "קילומטר לשעה",
                        ar: "كيلومتر في الساعة"
                    }
                ]
            },

            acceleration: {
                title: {
                    en: "Acceleration",
                    he: "תאוצה",
                    ar: "التسارع"
                },

                units: [
                    {
                        value: "m/s^2",
                        scale: 1,
                        symbol: "m/s²",
                        latex: "\\frac{\\mathrm{m}}{\\mathrm{s^2}}",
                        en: "meter per second squared",
                        he: "מטר לשנייה בריבוע",
                        ar: "متر في الثانية المربعة"
                    }
                ]
            }
        }
    },

    mass: {
        title: {
            en: "Mass",
            he: "מסה",
            ar: "الكتلة"
        },

        groups: {
            mass: {
                title: {
                    en: "Mass",
                    he: "מסה",
                    ar: "الكتلة"
                },

                units: [
                    {
                        value: "g",
                        scale: 0.001,
                        symbol: "g",
                        latex: "\\mathrm{g}",
                        en: "gram",
                        he: "גרם",
                        ar: "غرام"
                    },
                    {
                        value: "kg",
                        scale: 1,
                        symbol: "kg",
                        latex: "\\mathrm{kg}",
                        en: "kilogram",
                        he: "קילוגרם",
                        ar: "كيلوغرام"
                    }
                ]
            }
        }
    }
};

/* ============================================================
   PANEL VISIBILITY
   ============================================================ */
MoodleMathKeyboard.prototype.openPanel = function (name) {
    let panel = this.panelElements[name];
    if (!panel) return;
    this.openPanels[name] = true;
    panel.style.display = "block";
    if (panel.getAttribute("data-math-typeset") !== "1") {
        this.typesetButtons(panel);
        panel.setAttribute("data-math-typeset", "1");
    }
};
MoodleMathKeyboard.prototype.closePanel = function (name) {
    if (!this.panelElements[name]) return;
    this.openPanels[name] = false;
    this.panelElements[name].style.display = "none";
};
MoodleMathKeyboard.prototype.togglePanel = function(name) {
    let panel = this.panelElements[name];
    if (!panel) return;

    let isOpen = this.openPanels[name];

    this.closeNonPersistentPanels(name);

    if (isOpen) {
        this.closePanel(name);
    } else {
        this.openPanel(name);
    }
};
/* ============================================================
   DEBUG
   ============================================================ */
MoodleMathKeyboard.prototype.buildDebugArea = function () {
    this.debugLatex = document.createElement("pre");
    this.debugLatex.style.direction = "ltr";
    this.debugLatex.style.textAlign = "left";
    this.debugLatex.style.border = "1px solid #ccc";
    this.debugLatex.style.padding = "5px";
    this.debugLatex.style.backgroundColor = "#fff";
    this.root.appendChild(this.debugLatex);
    this.debugAST = document.createElement("pre");
    this.debugAST.style.direction = "ltr";
    this.debugAST.style.textAlign = "left";
    this.debugAST.style.border = "1px solid #ccc";
    this.debugAST.style.padding = "5px";
    this.debugAST.style.backgroundColor = "#fff";
    this.debugAST.style.whiteSpace = "pre-wrap";
    this.root.appendChild(this.debugAST);
};
/* ============================================================
   RENDER
   ============================================================ */
MoodleMathKeyboard.prototype.render = function () {
    let self = this;
    let editingLatex = this.getEditingDisplayLatex();
    let finalLatex = this.getLatex();

    if (this.caret) {
        this.caret.style.display = "none";
    }

    if (this.debugLatex) {
        this.debugLatex.textContent = "LaTeX: " + finalLatex;
    }

    if (this.debugAST) {
        this.debugAST.textContent =
            "Semantic AST:\n" +
            JSON.stringify(this.getAST(), null, 2) +
            "\n\nEditor AST:\n" +
            JSON.stringify(this.getEditorAST(), null, 2);
    }

    if (!window.MathJax || !window.MathJax.typesetPromise) {
        return;
    }

    this.mathJaxPromise = this.mathJaxPromise.then(function () {
        if (window.MathJax.typesetClear) {
            window.MathJax.typesetClear([self.display]);
        }

        self.display.textContent = "\\(" + editingLatex + "\\)";

        return window.MathJax.typesetPromise([self.display]);
    }).then(function () {
        self.positionCaret();
    }).catch(function (error) {
        console.error("MathJax render error:", error);

        if (self.caret) {
            self.caret.style.display = "none";
        }

        self.display.textContent = editingLatex;
    });
};
/* ============================================================
   PUBLIC METHODS
   ============================================================ */
MoodleMathKeyboard.prototype.getValue = function () {
    return this.getLatex();
};
MoodleMathKeyboard.prototype.clear = function () {
    this.clearAll();
};
MoodleMathKeyboard.prototype.destroy = function () {
    if (this.physicalKeyHandler) {
        document.removeEventListener("keydown", this.physicalKeyHandler);
        this.physicalKeyHandler = null;
    }

    if (this.root && this.root.parentNode) {
        this.root.parentNode.removeChild(this.root);
    }
};
window.MoodleMathKeyboard = MoodleMathKeyboard;
})();