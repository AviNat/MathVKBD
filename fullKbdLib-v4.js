/*
 * MoodleMathKeyboard V3
 * Reusable structured mathematical expression editor and keyboard.
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
    implicitMultiply: true,
    showImplicitMultiply: true,
    placeholderTooltips: true,
    fixedCalculusVariable: null,
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
        allowComplex:true,
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

let VALUE_TYPE = {
    ALGEBRAIC: 1,
    NATURAL: 2,
    INTEGER: 3,
    VARIABLE: 4,
    IDENTIFIER: 5,
    SUBSCRIPT: 6,
    DIRECTION: 7
};

let PLACEHOLDER_ID = {
    GROUP_CONTENT: 1,
    SET_CONTENT: 2,
    RADICAND: 3,
    ROOT_INDEX: 4,
    NUMERATOR: 5,
    DENOMINATOR: 6,
    SUBSCRIPT: 7,
    LOG_BASE: 8,
    FUNCTION_ARGUMENT: 9,
    VECTOR_NAME: 10,
    EXPONENT: 11,
    FUNCTION_NAME: 12,
    LOWER_BOUND: 13,
    UPPER_BOUND: 14,
    INTEGRAND: 15,
    INTEGRATION_VARIABLE: 16,
    INDEX_VARIABLE: 17,
    START_VALUE: 18,
    END_VALUE: 19,
    SUM_BODY: 20,
    PRODUCT_BODY: 21,
    LIMIT_VARIABLE: 22,
    LIMIT_TARGET: 23,
    LIMIT_DIRECTION: 24,
    LIMIT_BODY: 25,
    DERIVATIVE_VARIABLE: 26,
    DERIVATIVE_EXPRESSION: 27,
    SCIENTIFIC_EXPONENT: 28,
    ABSOLUTE_CONTENT: 29,
    CONJUGATE_CONTENT: 30,
    DIVIDEND: 31,
    DIVISOR: 32
};

let PLACEHOLDER_TEXT = {
    en: {},
    he: {},
    ar: {}
};

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.GROUP_CONTENT] = "Expression";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.GROUP_CONTENT] = "ביטוי";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.GROUP_CONTENT] = "تعبير";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.SET_CONTENT] = "Set contents";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.SET_CONTENT] = "תכולת הקבוצה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.SET_CONTENT] = "محتويات المجموعة";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.RADICAND] = "Radicand";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.RADICAND] = "ביטוי מתחת לשורש";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.RADICAND] = "المقدار تحت الجذر";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.ROOT_INDEX] = "Root index";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.ROOT_INDEX] = "דרגת השורש";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.ROOT_INDEX] = "دليل الجذر";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.NUMERATOR] = "Numerator";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.NUMERATOR] = "מונה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.NUMERATOR] = "البسط";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.DENOMINATOR] = "Denominator";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.DENOMINATOR] = "מכנה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.DENOMINATOR] = "المقام";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.SUBSCRIPT] = "Index";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.SUBSCRIPT] = "אינדקס";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.SUBSCRIPT] = "مؤشر";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.LOG_BASE] = "Logarithm base";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.LOG_BASE] = "בסיס הלוגריתם";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.LOG_BASE] = "أساس اللوغاريتم";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.FUNCTION_ARGUMENT] = "Function argument";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.FUNCTION_ARGUMENT] = "ארגומנט הפונקציה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.FUNCTION_ARGUMENT] = "مدخل الدالة";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.VECTOR_NAME] = "Vector name";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.VECTOR_NAME] = "שם הווקטור";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.VECTOR_NAME] = "اسم المتجه";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.EXPONENT] = "Exponent";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.EXPONENT] = "מעריך";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.EXPONENT] = "الأس";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.FUNCTION_NAME] = "Function name";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.FUNCTION_NAME] = "שם הפונקציה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.FUNCTION_NAME] = "اسم الدالة";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.LOWER_BOUND] = "Lower bound";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.LOWER_BOUND] = "גבול תחתון";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.LOWER_BOUND] = "الحد السفلي";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.UPPER_BOUND] = "Upper bound";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.UPPER_BOUND] = "גבול עליון";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.UPPER_BOUND] = "الحد العلوي";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.INTEGRAND] = "Integrand";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.INTEGRAND] = "הביטוי לאינטגרציה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.INTEGRAND] = "المقدار المراد تكامله";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.INTEGRATION_VARIABLE] = "Integration variable";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.INTEGRATION_VARIABLE] = "משתנה האינטגרציה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.INTEGRATION_VARIABLE] = "متغير التكامل";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.INDEX_VARIABLE] = "Index variable";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.INDEX_VARIABLE] = "משתנה האינדקס";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.INDEX_VARIABLE] = "متغير الفهرسة";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.START_VALUE] = "Start value";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.START_VALUE] = "ערך התחלה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.START_VALUE] = "قيمة البداية";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.END_VALUE] = "End value";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.END_VALUE] = "ערך סיום";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.END_VALUE] = "قيمة النهاية";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.SUM_BODY] = "Summand";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.SUM_BODY] = "האיבר לסכימה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.SUM_BODY] = "الحد المراد جمعه";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.PRODUCT_BODY] = "Product expression";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.PRODUCT_BODY] = "הביטוי למכפלה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.PRODUCT_BODY] = "تعبير حاصل الضرب";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.LIMIT_VARIABLE] = "Limit variable";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.LIMIT_VARIABLE] = "משתנה הגבול";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.LIMIT_VARIABLE] = "متغير النهاية";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.LIMIT_TARGET] = "Limit target";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.LIMIT_TARGET] = "ערך היעד";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.LIMIT_TARGET] = "قيمة الاقتراب";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.LIMIT_DIRECTION] = "Limit direction";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.LIMIT_DIRECTION] = "כיוון ההתקרבות";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.LIMIT_DIRECTION] = "جهة الاقتراب";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.LIMIT_BODY] = "Limit expression";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.LIMIT_BODY] = "ביטוי הגבול";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.LIMIT_BODY] = "تعبير النهاية";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.DERIVATIVE_VARIABLE] = "Differentiation variable";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.DERIVATIVE_VARIABLE] = "משתנה הגזירה";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.DERIVATIVE_VARIABLE] = "متغير الاشتقاق";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.DERIVATIVE_EXPRESSION] = "Expression";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.DERIVATIVE_EXPRESSION] = "ביטוי";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.DERIVATIVE_EXPRESSION] = "تعبير";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.SCIENTIFIC_EXPONENT] = "Exponent";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.SCIENTIFIC_EXPONENT] = "מעריך";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.SCIENTIFIC_EXPONENT] = "الأس";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.ABSOLUTE_CONTENT] = "Expression";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.ABSOLUTE_CONTENT] = "ביטוי";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.ABSOLUTE_CONTENT] = "تعبير";

PLACEHOLDER_TEXT.en[PLACEHOLDER_ID.CONJUGATE_CONTENT] = "Conjugate";
PLACEHOLDER_TEXT.he[PLACEHOLDER_ID.CONJUGATE_CONTENT] = "צמוד";
PLACEHOLDER_TEXT.ar[PLACEHOLDER_ID.CONJUGATE_CONTENT] = "المرافق";


let PLACEHOLDER_VALUE_TEXT = {
    en: {},
    he: {},
    ar: {}
};

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.GROUP_CONTENT] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.GROUP_CONTENT] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.GROUP_CONTENT] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.SET_CONTENT] = "Comma-separated algebraic expressions";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.SET_CONTENT] = "ביטויים אלגבריים מופרדים בפסיקים";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.SET_CONTENT] = "تعابير جبرية مفصولة بفواصل";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.RADICAND] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.RADICAND] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.RADICAND] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.ROOT_INDEX] = "Natural number";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.ROOT_INDEX] = "מספר טבעי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.ROOT_INDEX] = "عدد طبيعي";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.NUMERATOR] = "Integer";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.NUMERATOR] = "מספר שלם";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.NUMERATOR] = "عدد صحيح";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.DENOMINATOR] = "Integer";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.DENOMINATOR] = "מספר שלם";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.DENOMINATOR] = "عدد صحيح";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.DIVIDEND] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.DIVIDEND] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.DIVIDEND] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.DIVISOR] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.DIVISOR] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.DIVISOR] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.SUBSCRIPT] = "number, variable or index expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.SUBSCRIPT] = "מספר, משתנה או ביטוי אינדקס";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.SUBSCRIPT] = "عدد أو متغير أو تعبير فهرسة";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.LOG_BASE] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.LOG_BASE] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.LOG_BASE] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.FUNCTION_ARGUMENT] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.FUNCTION_ARGUMENT] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.FUNCTION_ARGUMENT] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.VECTOR_NAME] = "One- or two-letter variable, optionally indexed";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.VECTOR_NAME] = "משתנה בן אות אחת או שתיים, עם אינדקס לפי הצורך";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.VECTOR_NAME] = "متغير من حرف أو حرفين، ويمكن أن يتضمن مؤشرًا";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.EXPONENT] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.EXPONENT] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.EXPONENT] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.FUNCTION_NAME] = "Identifier";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.FUNCTION_NAME] = "שם מזהה";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.FUNCTION_NAME] = "اسم معرّف";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.LOWER_BOUND] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.LOWER_BOUND] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.LOWER_BOUND] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.UPPER_BOUND] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.UPPER_BOUND] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.UPPER_BOUND] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.INTEGRAND] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.INTEGRAND] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.INTEGRAND] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.INTEGRATION_VARIABLE] = "Single-letter variable";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.INTEGRATION_VARIABLE] = "משתנה בן אות אחת";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.INTEGRATION_VARIABLE] = "متغير من حرف واحد";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.INDEX_VARIABLE] = "Single-letter variable";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.INDEX_VARIABLE] = "משתנה בן אות אחת";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.INDEX_VARIABLE] = "متغير من حرف واحد";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.START_VALUE] = "Integer or algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.START_VALUE] = "מספר שלם או ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.START_VALUE] = "عدد صحيح أو تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.END_VALUE] = "Integer or algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.END_VALUE] = "מספר שלם או ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.END_VALUE] = "عدد صحيح أو تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.SUM_BODY] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.SUM_BODY] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.SUM_BODY] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.PRODUCT_BODY] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.PRODUCT_BODY] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.PRODUCT_BODY] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.LIMIT_VARIABLE] = "Single-letter variable";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.LIMIT_VARIABLE] = "משתנה בן אות אחת";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.LIMIT_VARIABLE] = "متغير من حرف واحد";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.LIMIT_TARGET] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.LIMIT_TARGET] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.LIMIT_TARGET] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.LIMIT_DIRECTION] = "+ / -";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.LIMIT_DIRECTION] = "+ / -";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.LIMIT_DIRECTION] = "+ / -";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.LIMIT_BODY] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.LIMIT_BODY] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.LIMIT_BODY] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.DERIVATIVE_VARIABLE] = "Single-letter variable";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.DERIVATIVE_VARIABLE] = "משתנה בן אות אחת";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.DERIVATIVE_VARIABLE] = "متغير من حرف واحد";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.DERIVATIVE_EXPRESSION] = "Variable or expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.DERIVATIVE_EXPRESSION] = "משתנה או ביטוי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.DERIVATIVE_EXPRESSION] = "متغير أو تعبير";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.SCIENTIFIC_EXPONENT] = "Integer";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.SCIENTIFIC_EXPONENT] = "מספר שלם";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.SCIENTIFIC_EXPONENT] = "عدد صحيح";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.ABSOLUTE_CONTENT] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.ABSOLUTE_CONTENT] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.ABSOLUTE_CONTENT] = "تعبير جبري";

PLACEHOLDER_VALUE_TEXT.en[PLACEHOLDER_ID.CONJUGATE_CONTENT] = "Algebraic expression";
PLACEHOLDER_VALUE_TEXT.he[PLACEHOLDER_ID.CONJUGATE_CONTENT] = "ביטוי אלגברי";
PLACEHOLDER_VALUE_TEXT.ar[PLACEHOLDER_ID.CONJUGATE_CONTENT] = "تعبير جبري";
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
    this.placeholderTooltip = null;
       
    if (!window.MoodleMathKeyboardInstanceCounter) {
        window.MoodleMathKeyboardInstanceCounter = 0;
    }
    window.MoodleMathKeyboardInstanceCounter += 1;
    this.cursorMarkerId = "mathKbdCursorMarker" + window.MoodleMathKeyboardInstanceCounter;
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
MoodleMathKeyboard.prototype.installPhysicalKeyboard = function () {
    let self = this;

    this.physicalKeyHandler = function (event) {
        self.handlePhysicalKey(event);
    };

    document.addEventListener("keydown", this.physicalKeyHandler);
};

MoodleMathKeyboard.prototype.getPlaceholderInfo = function(seq) {
    if (!seq) return null;

    let parentInfo = this.findParent(this.editorAST, seq.id);

    if (!parentInfo || !parentInfo.parent) return null;

    let def = this.getNodeDefinition(parentInfo.parent);

    if (!def ||
        !def.children ||
        !def.children[parentInfo.key]) {
        return null;
    }

    let childDef = def.children[parentInfo.key];

    if (!childDef.placeholder) return null;

    let placeholderId = childDef.placeholder;

    if (typeof placeholderId === "function") {
        placeholderId = placeholderId(parentInfo.parent, this);
    }

    let rule = SYNTAX_RULES[seq.syntax];
    let valueType = rule && rule.valueType
        ? rule.valueType
        : VALUE_TYPE.ALGEBRAIC;

    return {
        placeholderId: placeholderId,
        valueType: valueType
    };
};
MoodleMathKeyboard.prototype.placeholderLatex = function(seq) {
    if (!this.config.placeholderTooltips) {
        return "\\square";
    }

    let info = this.getPlaceholderInfo(seq);

    if (!info) {
        return "\\square";
    }

    let id =
        this.cursorMarkerId +
        "Placeholder" +
        seq.id;

    return "\\square\\cssId{" +
        id +
        "}{\\vphantom{X}}";
};
MoodleMathKeyboard.prototype.editorNodesImplicitlyMultiply = function(left, right) {
    if ( !this.config.showImplicitMultiply ) return false;
    if (!left || !right) return false;

    let leftTypes = [
        "number",
        "scientific",
        "variable",
        "indexedVariable",
        "group",
        "power",
        "sqrt",
        "nthRoot",
        "fraction",
        "simpleFraction",
        "function",
        "namedFunction",
        "absolute",
        "vector"
    ];

    let rightTypes = [
        "number",
        "variable",
        "power",
        "indexedVariable",
        "group",
        "sqrt",
        "nthRoot",
        "fraction",
        "simpleFraction",
        "function",
        "namedFunction",
        "absolute",
        "vector"
    ];

    if (leftTypes.indexOf(left.type) < 0 ||
        rightTypes.indexOf(right.type) < 0) {
        return false;
    }

    if (left.type === "number" && right.type === "number") {
        return false;
    }

    if (left.type === "variable" &&
        right.type === "number" &&
        left.allowDigitSuffix) {
        return false;
    }

    return true;
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
MoodleMathKeyboard.prototype.makeVariable = function(def, typed) {
    return {
        id: this.newId(),
        type: "variable",
        name: def.id,
        latex: def.latex || def.label || def.id,
        allowDigitSuffix: typed === true
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
MoodleMathKeyboard.prototype.eachChild = function(node, callback) {
    this.forEachChild(node, function(child) {
        callback(child);
    });
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
MoodleMathKeyboard.prototype.findParent = function(node, nodeId) {
    let self = this;
    let result = null;

    if (!node) return null;

    this.forEachChild(node, function(child, key, index) {
        if (result) return;

        if (child.id === nodeId) {
            result = {
                parent: node,
                key: key,
                index: index
            };
            return;
        }

        result = self.findParent(child, nodeId);
    });

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

        self.forEachCursorChild(node, function(child) {
            walk(child);
        });
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

        if (previous.textNodeId !== null &&
            current.seqId !== null) {

            let numberNode =
                self.findNode(
                    self.editorAST,
                    previous.textNodeId
                );

            let parentInfo =
                self.findParent(
                    self.editorAST,
                    previous.textNodeId
                );

            if (numberNode &&
                parentInfo &&
                parentInfo.parent.type === "sequence" &&
                previous.charOffset === numberNode.text.length &&
                current.seqId === parentInfo.parent.id &&
                current.offset === parentInfo.index + 1) {

                duplicate = true;
            }
        }

        if (!duplicate) {
            compact.push(current);
        }
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

    if (delta > 0) {
        let context =
            this.getNamedFunctionCursorContext();

        if (context &&
            context.state === "AFTER_NAME") {

            this.cursor = {
                seqId: context.functionNode.argument.id,
                offset: 0,
                textNodeId: null,
                charOffset: null
            };

            this.render();
            return;
        }
    }

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

    if (!seq || seq.items.length === 0) {
        return null;
    }

    let info = this.findParent(this.editorAST, seq.id);

    if (!info ||
        !info.parent ||
        info.parent.type !== "variableName") {
        return null;
    }

    if (info.key !== "variable" &&
        info.key !== "subscript") {
        return null;
    }

    let variableName = info.parent;

    let parentInfo =
        this.findParent(this.editorAST, variableName.id);

    if (!parentInfo ||
        !parentInfo.parent ||
        parentInfo.parent.type !== "namedFunction" ||
        parentInfo.key !== "name") {
        return null;
    }

    return parentInfo.parent;
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

    if (!this.syntaxAllows("digit")) {
        return;
    }

    if (syntax === "functionName" ||
        syntax === "variableNamePart") {

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

    let previous = null;

    if (seq && this.cursor.offset > 0) {
        previous = seq.items[this.cursor.offset - 1];
    }

    if (previous &&
        previous.type === "variable" &&
        previous.allowDigitSuffix) {

        previous.name += digit;
        previous.latex += digit;
        this.changed();
        return;
    }


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

MoodleMathKeyboard.prototype.insertVariable = function(def, typed) {
    if (!this.syntaxAllows("variable")) return;

    if (this.currentSyntax() === "functionName" ||
        this.currentSyntax() === "variableNamePart") {

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

    if (this.insertIntoSequence(this.makeVariable(def, typed))) {
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

    let content = this.makeSequence([], "parenthesesContent");

    this.insertAndEnter({id: this.newId(), type: "group",content: content}, content);

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
        argument: content
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

    if (exponentText === "-1") {

        /*
         * f_2|  ->  f_2 |
         *
         * This is for an indexed variable which has not yet
         * been converted to a namedFunction.
         */
        this.exitIndexedVariableSubscript();

        /*
         * This is the path where the namedFunction structure
         * already exists.
         */
        let context = this.getNamedFunctionCursorContext();

        if (context &&
            (context.state === "FUNCTION_NAME" ||
             context.state === "SUBSCRIPT" ||
             context.state === "AFTER_NAME")) {

            let namedFunction = context.functionNode;

            namedFunction.primeOrder = 0;
            namedFunction.inverseFunction = true;

            this.cursor = {
                seqId: namedFunction.argument.id,
                offset: 0,
                textNodeId: null,
                charOffset: null
            };

            this.changed();
            return;
        }
    }

    if (!this.syntaxAllows("fixedExponent")) return;

    let base = this.takePreviousAsBase();
    if (!base) return;

    let node = {
        id: this.newId(),
        type: "power",
        base: base,
        fixedExponent: exponentText
    };

    if (this.insertIntoSequence(node)) {
        this.changed();
    }
};
MoodleMathKeyboard.prototype.insertSubscript = function () {
    if (!this.syntaxAllows("subscript")) return;
    if (!this.normalizeCursorToSequence()) return;

    let seq = this.currentSequence();
    if (!seq || this.cursor.offset <= 0) return;

    if (seq.syntax === "variableNamePart") {
        let info = this.findParent(this.editorAST, seq.id);

        if (!info ||
            !info.parent ||
            info.parent.type !== "variableName" ||
            info.key !== "variable") {
            return;
        }

        let variableName = info.parent;

        if (variableName.subscript) return;

        variableName.subscript =
            this.makeSequence([], "subscript");

        this.cursor = {
            seqId: variableName.subscript.id,
            offset: 0,
            textNodeId: null,
            charOffset: null
        };

        this.changed();
        return;
    }

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

    let variable = this.makeSequence([], "variableNamePart");

    let name = {
        id: this.newId(),
        type: "variableName",
        variable: variable,
        subscript: null
    };

    let node = {
        id: this.newId(),
        type: "vector",
        name: name
    };

    this.insertAndEnter(node, variable);
};
MoodleMathKeyboard.prototype.insertConjugate = function() {
    if (!this.syntaxAllows("conjugate")) return;

    let content = this.makeSequence([], "expression");

    let node = {
        id: this.newId(),
        type: "conjugate",
        argument: content
    };

    this.insertAndEnter(node, content);
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
        type: "logWithBase",
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
MoodleMathKeyboard.prototype.exitIndexedVariableSubscript = function() {
    if (!this.normalizeCursorToSequence()) return false;

    let seq = this.currentSequence();
    if (!seq) return false;

    let slotInfo = this.findParent(this.editorAST, seq.id);
    if (!slotInfo) return false;

    if (slotInfo.parent.type !== "indexedVariable" ||
        slotInfo.key !== "subscript") {
        return false;
    }

    let indexedVariable = slotInfo.parent;

    let parentInfo =
        this.findParent(this.editorAST, indexedVariable.id);

    if (!parentInfo) return false;

    if (parentInfo.parent.type !== "sequence" ||
        parentInfo.key !== "items") {
        return false;
    }

    this.cursor = {
        seqId: parentInfo.parent.id,
        offset: parentInfo.index + 1,
        textNodeId: null,
        charOffset: null
    };

    return true;
};
MoodleMathKeyboard.prototype.insertNamedFunction = function() {
    this.exitIndexedVariableSubscript();

    if (!this.syntaxAllows("namedFunction")) return;
    if (!this.normalizeCursorToSequence()) return;

    let seq = this.currentSequence();
    let candidate = null;

    let nameVariable = this.makeSequence([], "functionName");
    let name = {
        id: this.newId(),
        type: "variableName",
        variable: nameVariable,
        subscript: null
    };

    if (seq && this.cursor.offset > 0) {
        let previous = seq.items[this.cursor.offset - 1];

        candidate = this.getFunctionModifierCandidate(previous);

        if (candidate) {

            if (candidate.nameNode &&
                candidate.nameNode.type === "indexedVariable") {

                name = {
                    id: this.newId(),
                    type: "variableName",
                    variable: this.makeSequence([], "functionName"),
                    subscript: candidate.nameNode.subscript
                };

                name.variable.items.push({
                    id: this.newId(),
                    type: "identifierChar",
                    text: candidate.variable.name
                });

                nameVariable = name.variable;

            } else {

                nameVariable.items.push({
                    id: this.newId(),
                    type: "identifierChar",
                    text: candidate.variable.name
                });
            }

            seq.items.splice(this.cursor.offset - 1, 1);
            this.cursor.offset -= 1;
        }
    }

    let argument =
        this.makeSequence([], "expression");

    let node = {
        id: this.newId(),
        type: "namedFunction",
        name: name,
        primeOrder: candidate ? candidate.primeOrder : 0,
        inverseFunction: candidate ? candidate.inverseFunction : false,
        superscript: null,
        argument: argument
    };

    if (candidate) {
        this.insertAndEnter(node, argument);

        this.cursor = {
            seqId: argument.id,
            offset: 0,
            textNodeId: null,
            charOffset: null
        };
    } else {
        this.insertAndEnter(node, nameVariable);

        this.cursor = {
            seqId: nameVariable.id,
            offset: 0,
            textNodeId: null,
            charOffset: null
        };
    }

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
    if (node.type === "indexedVariable") {
        return {
            variable: node.variable,
            nameNode: node,
            primeOrder: 0,
            inverseFunction: false
        };
    }

    if (node.type === "prime" && node.value) {

        if (node.value.type === "variable") {
            return {
                variable: node.value,
                primeOrder: node.order,
                inverseFunction: false
            };
        }

        if (node.value.type === "indexedVariable") {
            return {
                variable: node.value.variable,
                nameNode: node.value,
                primeOrder: node.order,
                inverseFunction: false
            };
        }
    }

    if (node.type === "power" && node.fixedExponent === "-1" && node.base) {

        if (node.base.type === "variable") {
            return {
                variable: node.base,
                primeOrder: 0,
                inverseFunction: true
            };
        }

        if (node.base.type === "indexedVariable") {
            return {
                variable: node.base.variable,
                nameNode: node.base,
                primeOrder: 0,
                inverseFunction: true
            };
        }
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
    this.exitIndexedVariableSubscript();

    let namedFunction = this.getNamedFunctionFromNameSlot();

    if (namedFunction) {
        namedFunction.inverseFunction = false;

        if (namedFunction.primeOrder < 3) {
            namedFunction.primeOrder += 1;
        }

        let nameSequence = namedFunction.name.subscript || namedFunction.name.variable;

        this.cursor = {
            seqId: nameSequence.id,
            offset: nameSequence.items.length,
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

    if (previous.type === "indexedVariable") {
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
        if (previous.order < 3) {
            previous.order += 1;
        }

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
        argument: content
    }, content);
};
MoodleMathKeyboard.prototype.insertIntegral = function () {
    if (!this.syntaxAllows("integral")) return;
    let lower = this.makeSequence([]);
    let upper = this.makeSequence([]);
    let integrand = this.makeSequence([]);
    let variable;
    if (this.config.fixedCalculusVariable) {
        variable = this.makeSequence([
            {
                id: this.newId(),
                type: "variable",
                name: this.config.fixedCalculusVariable
            }
        ], "variableOnly");
    } else {
        variable = this.makeSequence([], "variableOnly");
    }
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

    let variable;
    if (kind == "ordinary" &&  this.config.fixedCalculusVariable) {
        variable = this.makeSequence([
            {
                id: this.newId(),
                type: "variable",
                name: this.config.fixedCalculusVariable
            }
        ], "variableOnly");
    } else {
        variable = this.makeSequence([], "variableOnly");
    }
    let expression = this.makeSequence([], "expression");

    let node = {
        id: this.newId(),
        type: "derivative",
        kind: kind,
        order: 1,
        variable: variable,
        expression: expression
    };

    if (kind == "ordinary" && this.config.fixedCalculusVariable) {
        this.insertAndEnter(node, expression);
    } else {
        this.insertAndEnter(node, variable);
    }

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

    let functionContext = this.getNamedFunctionCursorContext();

    if (functionContext && functionContext.state === "AFTER_NAME") {

        let namedFunction = functionContext.functionNode;

        if (namedFunction.inverseFunction) {
            namedFunction.inverseFunction = false;
            this.changed();
            return;
        }

        if (namedFunction.primeOrder > 0) {
            namedFunction.primeOrder -= 1;
            this.changed();
            return;
        }
    }


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

        if (structure.kind == "ordinary" && this.config.fixedCalculusVariable) { return this.deleteStructureNode(structure); }

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
    if (structure.type === "sqrt" && slotInfo.key === "content") {
        return this.deleteStructureNode(structure);
    }
    if (structure.type === "variableName" && slotInfo.key === "variable" && seq.items.length === 0) {

        let parentInfo = this.findParent(this.editorAST, structure.id);

        if (parentInfo &&
            parentInfo.key === "name" &&
            (parentInfo.parent.type === "vector" ||
            parentInfo.parent.type === "namedFunction")) {

            return this.deleteStructureNode( parentInfo.parent );
        }
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
    if (structure.type === "fraction" && slotInfo.key === "numerator") {
        return this.deleteStructureNode(structure);
    }
    if (structure.type === "simpleFraction" &&
        slotInfo.key === "numerator") {
        return this.deleteStructureNode(structure);
    }
    if (structure.type === "mixedFraction" &&
        slotInfo.key === "numerator") {

        let parentInfo = this.findParent(this.editorAST, structure.id);
        if (!parentInfo) return false;

        if (parentInfo.parent.type !== "sequence" ||
            parentInfo.key !== "items") {
            return false;
        }

        parentInfo.parent.items[parentInfo.index] = structure.whole;

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
    if (structure.type === "conjugate" && slotInfo.key === "content") {
        return this.deleteStructureNode(structure);
    }
    if (structure.type === "function" && slotInfo.key === "argument") {
        return this.deleteStructureNode(structure);
    }

    if (structure.type === "namedFunction" && slotInfo.key === "argument") {
        return this.deleteStructureNode(structure);
    }

    if (structure.type === "logWithBase") {
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
    if (structure.type === "variableName" &&
        slotInfo.key === "variable" &&
        seq.items.length === 0) {

        let parentInfo = this.findParent(this.editorAST, structure.id);

        if (parentInfo &&
            parentInfo.parent.type === "vector" &&
            parentInfo.key === "name") {

            return this.deleteStructureNode(parentInfo.parent);
        }
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
MoodleMathKeyboard.prototype.getNamedFunctionCursorContext = function() {
    let seq = this.currentSequence();

    if (!seq) return null;

    let info =
        this.findParent(this.editorAST, seq.id);

    if (!info || !info.parent) {
        return null;
    }

    /*
     * Cursor in the argument.
     */
    if (info.parent.type === "namedFunction" &&
        info.key === "argument") {

        return {
            functionNode: info.parent,
            state: "ARGUMENT",
            sequence: seq
        };
    }

    /*
     * Cursor must otherwise be inside variableName.
     */
    if (info.parent.type !== "variableName") {
        return null;
    }

    let variableName = info.parent;

    let functionInfo =
        this.findParent(
            this.editorAST,
            variableName.id
        );

    if (!functionInfo ||
        !functionInfo.parent ||
        functionInfo.parent.type !== "namedFunction" ||
        functionInfo.key !== "name") {

        return null;
    }

    let functionNode =
        functionInfo.parent;

    /*
     * Base function-name sequence.
     */
    if (info.key === "variable") {

        if (seq.items.length === 0) {
            return {
                functionNode: functionNode,
                state: "EMPTY_NAME",
                sequence: seq
            };
        }

        /*
         * It is AFTER_NAME only when this is the
         * final sequence of the complete name.
         *
         * If a subscript exists, the end of the base
         * name is NOT the end of the complete name.
         */
        if (!variableName.subscript &&
            this.cursor.offset === seq.items.length &&
            (functionNode.primeOrder > 0 ||
             functionNode.inverseFunction)) {

            return {
                functionNode: functionNode,
                state: "AFTER_NAME",
                sequence: seq
            };
        }

        return {
            functionNode: functionNode,
            state: "FUNCTION_NAME",
            sequence: seq
        };
    }

    /*
     * Subscript sequence.
     */
    if (info.key === "subscript") {

        if (this.cursor.offset === seq.items.length &&
            (functionNode.primeOrder > 0 ||
             functionNode.inverseFunction)) {

            return {
                functionNode: functionNode,
                state: "AFTER_NAME",
                sequence: seq
            };
        }

        return {
            functionNode: functionNode,
            state: "SUBSCRIPT",
            sequence: seq
        };
    }

    return null;
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
    let rule = SYNTAX_RULES[seq.syntax];
    let i;

    if (seq.items.length === 0) {
        if (!suppressCursor && editing) {
            out += this.cursorLatexForSequence(seq, 0);

            if (!this.isRootSequence(seq)) {
                out += this.placeholderLatex(seq);
            }
        }

        return out;
    }

    if (!suppressCursor) {
        out += this.cursorLatexForSequence(seq, 0);
    }

    for (i = 0; i < seq.items.length; i += 1) {
        if (i > 0 &&
            this.config.showImplicitMultiply &&
            rule &&
            rule.implicitMultiply &&
            this.editorNodesImplicitlyMultiply(
                seq.items[i - 1],
                seq.items[i]
            )) {

            out += "\\cdot ";
        }

        let item = seq.items[i];

        if (!suppressCursor &&
            editing &&
            item.type === "number" &&
            this.cursor.textNodeId === item.id) {

            out += item.text.substring(0, this.cursor.charOffset);
            out += this.cursorMarkerLatex();
            out += item.text.substring(this.cursor.charOffset);

        } else {
            out += this.renderNode(item, editing);
        }

        if (!suppressCursor) {
            out += this.cursorLatexForSequence(seq, i + 1);
        }
    }

    return out;
};
MoodleMathKeyboard.prototype.ensurePlaceholderTooltip = function() {
    if (this.placeholderTooltip) return;

    let tooltip = document.createElement("div");

    tooltip.style.position = "fixed";
    tooltip.style.display = "none";
    tooltip.style.padding = "4px 7px";
    tooltip.style.background = "#222";
    tooltip.style.color = "#fff";
    tooltip.style.borderRadius = "4px";
    tooltip.style.fontSize = "13px";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.zIndex = "999999";
    tooltip.style.pointerEvents = "none";

    document.body.appendChild(tooltip);

    this.placeholderTooltip = tooltip;
};


MoodleMathKeyboard.prototype.showPlaceholderTooltip = function(marker, text) {
    this.ensurePlaceholderTooltip();

    let rect = marker.getBoundingClientRect();
    let tooltip = this.placeholderTooltip;

    tooltip.textContent = text;
    tooltip.style.display = "block";

    let tooltipRect = tooltip.getBoundingClientRect();

    let left =
        rect.left +
        rect.width / 2 -
        tooltipRect.width / 2;

    let top =
        rect.top -
        tooltipRect.height -
        6;

    if (left < 4) {
        left = 4;
    }

    if (left + tooltipRect.width > window.innerWidth - 4) {
        left =
            window.innerWidth -
            tooltipRect.width -
            4;
    }

    if (top < 4) {
        top =
            rect.bottom + 6;
    }

    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
};


MoodleMathKeyboard.prototype.hidePlaceholderTooltip = function() {
    if (!this.placeholderTooltip) return;

    this.placeholderTooltip.style.display = "none";
};

MoodleMathKeyboard.prototype.installPlaceholderTooltips = function() {
    if (!this.config.placeholderTooltips) return;

    let self = this;

    function walk(node) {
        if (!node) return;

        if (node.type === "sequence") {
            if (node.items.length === 0 &&
                !self.isRootSequence(node)) {

                let info = self.getPlaceholderInfo(node);

                if (info) {
                    let id = self.cursorMarkerId + "Placeholder" + node.id;

                    let marker = document.getElementById(id);

        if (marker) {
            let language = self.config.language || "en";
            let role = PLACEHOLDER_TEXT[language][info.placeholderId] || "";
            let type = PLACEHOLDER_VALUE_TEXT[language][info.placeholderId] || "";

            let text = role;

            if (role && type) {
                text += ": " + type;
            } else if (!role) {
                text = type;
            }

            let square = marker.previousElementSibling;

            if (text && square) {
                let box = square.getBBox();

                let hitRect = document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "rect"
                );

                hitRect.setAttribute("x", box.x);
                hitRect.setAttribute("y", box.y);
                hitRect.setAttribute("width", box.width);
                hitRect.setAttribute("height", box.height);

                hitRect.setAttribute("fill", "transparent");
                hitRect.setAttribute("pointer-events", "all");

                hitRect.style.cursor = "help";

                square.appendChild(hitRect);

                hitRect.addEventListener(
                    "mouseenter",
                    function() {
                        self.showPlaceholderTooltip(
                            square,
                            text
                        );
                    }
                );

                hitRect.addEventListener(
                    "mouseleave",
                    function() {
                        self.hidePlaceholderTooltip();
                    }
                );
            }
        }
                }
            }
        }

        self.forEachChild(node, function(child) {
            walk(child);
        });
    }

    walk(this.editorAST);
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
MoodleMathKeyboard.prototype.renderNode = function(node, editing) {
    if (!node) return "";

    let def = this.getNodeDefinition(node);

    if (!def) return "";

    if (def.renderText !== undefined) {
        return def.renderText;
    }

    if (def.renderProperty) {
        return node[def.renderProperty] || "";
    }

    if (typeof def.render === "function") {
        return def.render(this, node, editing);
    }

    if (typeof def.render === "string") {
        return this.renderFromDefinition(node, editing, def);
    }

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

MoodleMathKeyboard.prototype.semanticFromDefinition =
function(node, def) {
    let semanticDef = def.semantic;
    let result = {};
    let key;

    if (semanticDef.typeFromProperty) {
        result.type = node[semanticDef.typeFromProperty];
    } else {
        result.type = semanticDef.type || node.type;
    }

    if (semanticDef.values) {
        for (key in semanticDef.values) {
            if (!semanticDef.values.hasOwnProperty(key)) continue;

            result[key] =
                semanticDef.values[key];
        }
    }

    if (semanticDef.copy) {
        for (key in semanticDef.copy) {
            if (!semanticDef.copy.hasOwnProperty(key)) continue;

            result[key] =
                node[semanticDef.copy[key]];
        }
    }

    if (!def.children) return result;

    for (key in def.children) {
        if (!def.children.hasOwnProperty(key)) continue;

        let childDef = def.children[key];

        if (!childDef.convertAs) continue;

        let value = node[key];

        if (childDef.convertAs === "sequence") {
            result[key] = value ? this.semanticSequence(value) : null;

        } else if (childDef.convertAs === "node") {
            result[key] = value ? this.semanticNode(value) : null;

        } else if (childDef.convertAs === "value") {
            result[key] = value;
        }
    }

    return result;
};

MoodleMathKeyboard.prototype.semanticNode = function (node) {
    if (!node) return null;

    let def = this.getNodeDefinition(node);

    if (def && typeof def.semantic === "function") {
        return def.semantic(this, node); 
    }

    if (def && def.semantic) {
        return this.semanticFromDefinition(node, def);
    }

    return {
        type: node.type
    };
};
MoodleMathKeyboard.prototype.getVectorName = function(node) {
    let result = "";
    let i;

    if (!node || node.type !== "variableName") {
        return "";
    }

    let seq = node.variable;

    if (!seq) {
        return "";
    }

    for (i = 0; i < seq.items.length; i += 1) {
        if (seq.items[i].type === "variable") {
            result += seq.items[i].name || seq.items[i].id || "";
        }
    }

    if (node.subscript) {
        return {
            type: "indexedVariable",
            variable: {
                type: "variable",
                name: result
            },
            subscript: this.semanticSequence(node.subscript)
        };
    }

    return result;
};
MoodleMathKeyboard.prototype.semanticSequence = function(seq) {
    let result = [];
    let rule = SYNTAX_RULES[seq.syntax];
    let i;

    for (i = 0; i < seq.items.length; i += 1) {
        if (i > 0 &&
            this.config.implicitMultiply &&
            rule &&
            rule.implicitMultiply &&
            this.editorNodesImplicitlyMultiply(
                seq.items[i - 1],
                seq.items[i]
            )) {

            result.push({
                type: "operator",
                op: "*",
                implicit: true
            });
        }

        result.push(
            this.semanticNode(seq.items[i])
        );
    }

    if (result.length === 0) return null;
    if (result.length === 1) return result[0];

    return {
        type: "sequence",
        items: result
    };
};
MoodleMathKeyboard.prototype.renderFromDefinition =
function(node, editing, def) {

    let result = def.render;
    let key;

    if (!def.children) return result;

    for (key in def.children) {
        if (!def.children.hasOwnProperty(key)) continue;

        let childDef = def.children[key];

        if (!childDef.renderAs) continue;

        let value = "";

        if (node[key]) {
            if (childDef.renderAs === "sequence") {
                value = this.renderSequence(node[key], editing);
            } else if (childDef.renderAs === "node") {
                value = this.renderNode(node[key], editing);
            }
        }

        result = result.split("#" + key + "#").join(value);
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

    this.render(ast);
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
                self.insertVariable(def, false);
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
    if (this.config.complexNumbers) {
        checkRow();
        this.makeButton(row, "\\bar{x}", "Conjugate", function() {
            self.insertConjugate();
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

MoodleMathKeyboard.prototype.insertPhysicalSymbol = function(id) {
    let group = SYMBOL_GROUPS.general.symbols;
    let i;

    for (i = 0; i < group.length; i += 1) {
        if (group[i].id === id) {
            this.insertSymbolDefinition(group[i]);
            return;
        }
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
    let count = 0;
    let i;
    let node;

    if (!seq) return 0;

    for (i = 0; i < seq.items.length; i += 1) {
        node = seq.items[i];

        if (node.type === "variable") {
            count += (node.name || "").length;
        } else if (node.type === "identifierChar") {
            count += 1;
        } else {
            count += 1;
        }
    }

    return count;
};

MoodleMathKeyboard.prototype.getNodeDefinition = function(node) {
    if (!node) return null;
    return NODE_DEFS[node.type] || null;
};

MoodleMathKeyboard.prototype.forEachChild = function(node, callback) {
    if (!node) return;

    let def = this.getNodeDefinition(node);

    if (!def || !def.children) return;

    let key;
    let i;

    for (key in def.children) {
        if (!def.children.hasOwnProperty(key)) continue;

        let childDef = def.children[key];
        let value = node[key];

        if (!value) continue;

        if (childDef.multiple) {
            for (i = 0; i < value.length; i += 1) {
                if (value[i]) {
                    callback(value[i], key, i);
                }
            }
        } else {
            callback(value, key, null);
        }
    }
};
MoodleMathKeyboard.prototype.forEachCursorChild = function(node, callback) {
    if (!node) return;
    
    let def = this.getNodeDefinition(node);

    if (!def || !def.children) return;

    let cursorChildren = [];
    let key;
    let i;

    for (key in def.children) {
        if (!def.children.hasOwnProperty(key)) continue;

        let childDef = def.children[key];

        if (!childDef.cursor) continue;

        if (childDef.cursor.condition &&
            !childDef.cursor.condition(node, this)) {
            continue;
        }

        cursorChildren.push({
            key: key,
            order: childDef.cursor.order,
            multiple: !!childDef.multiple
        });
    }

    cursorChildren.sort(function(a, b) {
        return a.order - b.order;
    });

    for (i = 0; i < cursorChildren.length; i += 1) {
        let info = cursorChildren[i];
        let value = node[info.key];
        let j;

        if (!value) continue;

        if (info.multiple) {
            for (j = 0; j < value.length; j += 1) {
                if (value[j]) {
                    callback(value[j], info.key, j);
                }
            }
        } else {
            callback(value, info.key, null);
        }
    }
};

/* ============================================================
   NODE DEFINITIONS
   ============================================================ */

let NODE_DEFS = {

    /* --------------------------------------------------------
       Containers
       -------------------------------------------------------- */

    chain: {
        children: {
            elements: {
                multiple: true,
                cursor: { order: 1}
            }
        }
    },

    sequence: {
        children: {
            items: {
                multiple: true
            }
        },

        render: function(kbd, node, editing) {
            return kbd.renderSequence(node, editing);
        }
    },


    /* --------------------------------------------------------
       Leaf nodes
       -------------------------------------------------------- */

    number: {
        render: function(kbd, node) { return node.text; },

        semantic: {
            type: "number",
            copy: {
                value: "text"
            }
        }
    },

    identifierChar: {
        renderProperty: "text",

        semantic: {
            type: "identifierChar",
            copy: {
                text: "text"
            }
        }
    },
    variable: {
        render: function(kbd, node) { return node.name; },

        semantic: {
            type: "variable",
            copy: {
                name: "name"
            }
        }
    },
   constant: {
        render: function(kbd, node) { return (node.latex) || node.name; },

        semantic: {
            type: "constant",
            copy: {
                name: "name"
            }
        }
    },

    separator: {
        render: function(kbd, node) { return node.separator === "comma" ? "," : ""; },

        semantic: {
            type: "separator"
        }
    },

    operator: {
        render: function(kbd, node, editing) {
            let def = kbd.getOperatorDefinition(node.op);

            if (node.op === "*") {
                return kbd.multiplyLatex();
            }

            if (def) {
                return def.latex;
            }

            return node.op;
        },

        semantic: {
            type: "operator",
            copy: {
                op: "op",
                explicit: "explicit"
            }
        }
    },

    placeholder: {
        render: function(kbd, node, editing) {
            return editing ? "\\square" : "";
        },

        semantic: function(kbd, node) {
            return {
                type: "placeholder",
                required: node.required === true
            };
        }
    },

    /* --------------------------------------------------------
       Simple structures
       -------------------------------------------------------- */
    group: {
        children: {
            content: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 1 },
                placeholder: PLACEHOLDER_ID.GROUP_CONTENT
            }
        },

        render: "\\left(#content#\\right)",

        semantic: function(kbd, node) {
            let i;
            let item;
            let hasComma = false;

            for (i = 0; i < node.content.items.length; i += 1) {
                item = node.content.items[i];

                if (item.type === "separator" &&
                    item.separator === "comma") {
                    hasComma = true;
                    break;
                }
            }

            let content = kbd.semanticSequence(node.content);
            if (!hasComma) {
                return {
                    type: "group",
                    child: content
                };
            }

            return {
                type: "tuple",
                elements: content
            };
        }
    },

    set: {
        children: {
            content: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 1 },
                placeholder: PLACEHOLDER_ID.SET_CONTENT
            }
        },

        render: "\\left\\{#content#\\right\\}",

        semantic: {
            type: "set"
        }
    },

    sqrt: {
        children: {
            argument: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: {
                    order: 1
                },
            placeholder: PLACEHOLDER_ID.RADICAND
            }
        },

        render: "\\sqrt{#argument#}",

        semantic: {
            type: "function",
            values: {
                name: "sqrt"
            }
        }
    },

    nthRoot: {
        children: {
            index: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 1 },
                placeholder: PLACEHOLDER_ID.ROOT_INDEX
            },

            content: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: {
                    order: 2
                },
                placeholder: PLACEHOLDER_ID.RADICAND
            }
        },

        render: "\\sqrt[#index#]{#content#}",

        semantic: {
            type: "nthRoot"
        }
    },
    fraction: {
        children: {
            numerator: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 1 },
                placeholder: PLACEHOLDER_ID.DIVIDEND
            },

            denominator: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 2 },
                placeholder: PLACEHOLDER_ID.DIVISOR
            }
        },

        render: "\\frac{#numerator#}{#denominator#}",

        semantic: function(kbd, node) {
            return {
                type: "binary",
                op: "/",
                left: kbd.semanticSequence(node.numerator),
                right: kbd.semanticSequence(node.denominator)
            };
        }
    },

    simpleFraction: {
        children: {
            numerator: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 1 },
                placeholder: PLACEHOLDER_ID.NUMERATOR
            },

            denominator: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 2 },
                placeholder: PLACEHOLDER_ID.DENOMINATOR
            }
        },

        render: "\\frac{#numerator#}{#denominator#}",

        semantic: function(kbd, node) {
            return {
                type: "simpleFraction",
                numerator: kbd.semanticSequence(node.numerator),
                denominator: kbd.semanticSequence(node.denominator)
            };
        }
    },

    mixedFraction: {
        children: {
            whole: {
                renderAs: "node",
                convertAs: "node",
                cursor: { order: 1 }
            },

            numerator: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 2 },
                placeholder: PLACEHOLDER_ID.NUMERATOR
            },

            denominator: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 3 },
                placeholder: PLACEHOLDER_ID.DENOMINATOR
            }
        },

        render: "#whole#\\frac{#numerator#}{#denominator#}",

        semantic: function(kbd, node) {
            return {
                type: "mixedFraction",
                whole: kbd.semanticNode(node.whole),
                numerator: kbd.semanticSequence(node.numerator),
                denominator: kbd.semanticSequence(node.denominator)
            };
        }
    },

    indexedVariable: {
        children: {
            variable: {
                renderAs: "node",
                convertAs: "node",
                cursor: { order: 1 }
            },

            subscript: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 2 },
                placeholder: PLACEHOLDER_ID.SUBSCRIPT
            }
        },

        render: "#variable#_{\\scriptscriptstyle #subscript#}",

        semantic: {
            type: "indexedVariable"
        }
    },

    logWithBase: {
        children: {
            base: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 1 },
                placeholder: PLACEHOLDER_ID.LOG_BASE
            },

            argument: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 2 },
                placeholder: PLACEHOLDER_ID.FUNCTION_ARGUMENT
            }
        },

        render: "\\log_{#base#}\\left(#argument#\\right)",

        semantic: {
            type: "function",
            values: {
                name: "log"
            }
        }
    },

    absolute: {
        children: {
            argument: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 1 },
                placeholder: PLACEHOLDER_ID.ABSOLUTE_CONTENT
            }
        },

        render: "\\left|#argument#\\right|",

        semantic: {
            type: "function",
            values: {
                name: "abs"
            }
        }
    },

    vector: {
        children: {
            name: {
                nodeType: "variableName",
                renderAs: "node",
                convertAs: "node",
                cursor: { order: 1 }
            }
        },

        render: "\\vec{#name#}",

        semantic: {
            type: "vector"
        }
    },
    conjugate: {
        children: {
            argument: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 1 },
                placeholder:
                    PLACEHOLDER_ID.CONJUGATE_CONTENT
            }
        },

        render: "\\overline{#argument#}",

        semantic: {
            type: "conjugate"
        }
    },
    variableName: {
        children: {
            variable: {
                renderAs: "sequence",
                convertAs: "sequence",
                syntax: "variableNamePart",
                cursor: { order: 1 },
                placeholder: function(node, kbd) {
                    let parentInfo = kbd.findParent(kbd.editorAST, node.id);

                    if (parentInfo &&
                        parentInfo.parent &&
                        parentInfo.parent.type === "namedFunction") {
                        return PLACEHOLDER_ID.FUNCTION_NAME;
                    }

                    return PLACEHOLDER_ID.VECTOR_NAME;
                }
            },

            subscript: {
                renderAs: "sequence",
                convertAs: "sequence",
                syntax: "subscript",
                optional: true,
                cursor: { order: 2 },
                placeholder: PLACEHOLDER_ID.SUBSCRIPT
            }
        },

        render: function(kbd, node, editing) {
        let name = kbd.renderSequence( node.variable, editing, !editing);

        if (!node.subscript) {
            return name;
        }

        return name + "_{\\scriptscriptstyle " + kbd.renderSequence( node.subscript, editing, !editing ) + "}";
        }
    },
    scientific: {
        children: {
            coefficient: {
                renderAs: "node",
                convertAs: "node",
                cursor: {
                    order: 1
                }
            },

            exponent: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 2 },
                placeholder: PLACEHOLDER_ID.SCIENTIFIC_EXPONENT
            }
        },

        render: "#coefficient#\\!\\!\\times\\!\\!10^{#exponent#}",

        semantic: {
            type: "scientific"
        }
    },
    factorial: {
        children: {
            value: {
                renderAs: "node",
                convertAs: "node"
            }
        },

        render: "#value#!",

        semantic: {
            type: "factorial"
        }
    },

    degree: {
        children: {
            value: {
                renderAs: "node",
                convertAs: "node"
            }
        },

        render: "#value#^{\\circ}",

        semantic: {
            type: "degree"
        }
    },

    percent: {
        children: {
            value: {
                renderAs: "node",
                convertAs: "node"
            }
        },

        render: "#value#\\%",

        semantic: {
            type: "percent"
        }
    },

    /* --------------------------------------------------------
       Structures requiring rendering logic
       -------------------------------------------------------- */

    power: {
        children: {
            base: {
                renderAs: "node",
                convertAs: "node",
                cursor: {
                    order: 1,
                    condition: function(node) {
                        return !node.fixedExponent;
                    }
                }
            },

            exponent: {
                optional: true,
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: {
                    order: 2,
                    condition: function(node) {
                        return !node.fixedExponent;
                    }
                },
                placeholder: PLACEHOLDER_ID.EXPONENT
            }
        },

        render: function(kbd, node, editing) {

            if (node.fixedExponent) {
                return "{" +
                    kbd.renderNode(node.base, editing) +
                    "}^{" +
                    node.fixedExponent +
                    "}";
            }

            if (node.base &&
                node.base.type === "function" &&
                !node.base.inverseBase) {

                return node.base.latexName +
                    "^{" +
                    kbd.renderSequence(node.exponent, editing) +
                    "}\\left(" +
                    kbd.renderSequence(node.base.argument, editing) +
                    "\\right)";
            }

            return "{" +
                kbd.renderNode(node.base, editing) +
                "}^{" +
                kbd.renderSequence(node.exponent, editing) +
                "}";
        },

        semantic: function(kbd, node) {

            if (node.fixedExponent) {
                return {
                    type: "binary",
                    op: "^",
                    left: kbd.semanticNode(node.base),
                    right: {
                        type: "number",
                        value: node.fixedExponent
                    }
                };
            }

            return {
                type: "binary",
                op: "^",
                left: kbd.semanticNode(node.base),
                right: kbd.semanticSequence(node.exponent)
            };
        }
    },

    function: {
        children: {
            superscript: {
                optional: true,
                renderAs: "sequence",
                cursor: {
                    order: 1
                },
                placeholder: PLACEHOLDER_ID.EXPONENT
            },

            argument: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: {
                    order: 2
                },
                placeholder: PLACEHOLDER_ID.FUNCTION_ARGUMENT
            }
        },

        render: function(kbd, node, editing) {

            if (node.inverseBase) {
                return node.inverseBase +
                    "^{-1}\\left(" +
                    kbd.renderSequence(node.argument, editing) +
                    "\\right)";
            }

            return node.latexName +
                "\\left(" +
                kbd.renderSequence(node.argument, editing) +
                "\\right)";
        },

        semantic: {
            type: "function",
            copy: {
                name: "name"
            }
        }
    },

namedFunction: {
    children: {
        name: {
            nodeType: "variableName",
            renderAs: "node",
            convertAs: "node",
            cursor: {
                order: 1
            },
            placeholder: PLACEHOLDER_ID.FUNCTION_NAME
        },

        superscript: {
            optional: true,
            renderAs: "sequence",
            convertAs: "sequence",
            cursor: {
                order: 2
            },
            placeholder: PLACEHOLDER_ID.EXPONENT
        },

        argument: {
            renderAs: "sequence",
            convertAs: "sequence",
            cursor: {
                order: 3
            },
            placeholder: PLACEHOLDER_ID.FUNCTION_ARGUMENT
        }
    },

render: function(kbd, node, editing) {
    let modifier = "";

    if (node.inverseFunction) {
        modifier = "^{-1}";
    } else if (node.primeOrder > 0) {
        modifier = new Array(node.primeOrder + 1).join("'");
    }

    let context = null;

    if (editing) {
        context = kbd.getNamedFunctionCursorContext();
    }

    let cursorAfterName =
        context &&
        context.functionNode === node &&
        context.state === "AFTER_NAME";

    let name;

    if (cursorAfterName) {
        name = kbd.renderNode(node.name, false);
    } else {
        name = kbd.renderNode(node.name, editing);
    }

    let result = name + modifier;

    if (cursorAfterName) {
        result += kbd.cursorMarkerLatex();
    }

    result += "\\left(" + kbd.renderSequence(node.argument, editing) + "\\right)";
    return result;
},
    semantic: function(kbd, node) {
        return {
            type: "namedFunction",
            name: kbd.semanticNode(node.name),
            primeOrder: node.primeOrder || 0,
            inverseFunction: !!node.inverseFunction,
            superscript: node.superscript ? kbd.semanticSequence(node.superscript) : null,
            argument: kbd.semanticSequence(node.argument)
        };
    }
},
    integral: {
        children: {
            lower: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 1 },
                placeholder:
                    PLACEHOLDER_ID.LOWER_BOUND
            },

            upper: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 2 },
                placeholder:
                    PLACEHOLDER_ID.UPPER_BOUND
            },

            integrand: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 3 },
                placeholder:
                    PLACEHOLDER_ID.INTEGRAND
            },

            variable: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: {
                    order: 4,
                    condition: function(node, kbd) {
                        return !kbd.config.fixedCalculusVariable;
                    }
                },
                placeholder: PLACEHOLDER_ID.INTEGRATION_VARIABLE
            }
        },

        render: function(kbd, node, editing) {
            let lower = kbd.renderSequence(node.lower, editing);
            let upper = kbd.renderSequence(node.upper, editing);

            if (!editing &&
                node.lower.items.length === 0 &&
                node.upper.items.length === 0) {

                return "\\int " +
                    kbd.renderSequence(node.integrand, editing) +
                    "\\,d" +
                    kbd.renderSequence(node.variable, editing);
            }

            return "\\int_{" +
                lower +
                "}^{" +
                upper +
                "}" +
                kbd.renderSequence(node.integrand, editing) +
                "\\,d" +
                kbd.renderSequence(node.variable, editing);
        },
        semantic: {
        type: "integral"
    }
    },

    indexedOperator: {
        children: {
        indexVariable: {
            renderAs: "sequence",
            convertAs: "sequence",
            cursor: { order: 1 },
            placeholder:
                PLACEHOLDER_ID.INDEX_VARIABLE
        },

        start: {
            renderAs: "sequence",
            convertAs: "sequence",
            cursor: { order: 2 },
            placeholder:
                PLACEHOLDER_ID.START_VALUE
        },

        end: {
            renderAs: "sequence",
            convertAs: "sequence",
            cursor: { order: 3 },
            placeholder:
                PLACEHOLDER_ID.END_VALUE
        },

        body: {
            renderAs: "sequence",
            convertAs: "sequence",
            cursor: { order: 4 },

            placeholder: function(node) {
                return node.operator === "product"
                    ? PLACEHOLDER_ID.PRODUCT_BODY
                    : PLACEHOLDER_ID.SUM_BODY;
            }
        }
    },

        render: function(kbd, node, editing) {

            return (node.operator === "sum" ? "\\sum" : "\\prod") +
                "_{" +
                kbd.renderSequence(node.indexVariable, editing) +
                "=" +
                kbd.renderSequence(node.start, editing) +
                "}^{" +
                kbd.renderSequence(node.end, editing) +
                "}" +
                kbd.renderSequence(node.body, editing);
        },
        semantic: {
            typeFromProperty: "operator"
        }
    },

   limit: {
    children: {
        variable: {
            renderAs: "sequence",
            convertAs: "sequence",
            cursor: { order: 1 },
            placeholder: PLACEHOLDER_ID.LIMIT_VARIABLE
        },

        target: {
            renderAs: "sequence",
            convertAs: "sequence",
            cursor: { order: 2 },
            placeholder: PLACEHOLDER_ID.LIMIT_TARGET
        },

        direction: {
            renderAs: "sequence",
            convertAs: "sequence",
            cursor: { order: 3 },
            placeholder: PLACEHOLDER_ID.LIMIT_DIRECTION
        },

        body: {
            renderAs: "sequence",
            convertAs: "sequence",
            cursor: { order: 4 },
            placeholder: PLACEHOLDER_ID.LIMIT_BODY
        }
    },

    render: function(kbd, node, editing) {
        let direction =
            kbd.renderSequence(node.direction, editing);

        return "\\lim_{" +
            kbd.renderSequence(node.variable, editing) +
            "\\to {" +
            kbd.renderSequence(node.target, editing) +
            "}" +
            (direction ? "^{" + direction + "}" : "") +
            "}" +
            kbd.renderSequence(node.body, editing);
    },

    semantic: {
        type: "limit"
    }
},

    derivative: {
        children: {
            variable: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: {
                    order: 1,
                    condition: function(node, kbd) {
                        return !( node.kind == "ordinary" && kbd.config.fixedCalculusVariable );
                    }
                },
                placeholder: PLACEHOLDER_ID.DERIVATIVE_VARIABLE
            },

            expression: {
                renderAs: "sequence",
                convertAs: "sequence",
                cursor: { order: 2 },
                placeholder: PLACEHOLDER_ID.DERIVATIVE_EXPRESSION
            }
        },

        render: function(kbd, node, editing) {
            return kbd.renderDerivative(node, editing);
        },

        semantic: {
            type: "derivative",
            copy: {
                kind: "kind",
                order: "order"
            }
        }
    },

    prime: {
        children: {
            value: {
                renderAs: "node",
                convertAs: "node"
            }
        },

        render: function(kbd, node, editing) {
            return kbd.renderNode(node.value, editing) +
                new Array(node.order + 1).join("'");
        },

        semantic: {
            type: "prime",
            copy: {
                order: "order"
            }
        }
    }
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
        "symbol","subscript", "set", "vector", "conjugate"],
        valueType: VALUE_TYPE.ALGEBRAIC,
        implicitMultiply: true
    },
    parenthesesContent: {
        allow: [
            "digit","decimal","variable","constant","plus","minus",
            "additive","multiply","divide","relation","group","sqrt","nthRoot",
            "fixedExponent","power","simpleFraction","function","namedFunction",
            "integral","sum","product","limit","derivative","absolute","scientific",
            "postfix","symbol","subscript","comma","set","vector","conjugate"
        ],
        valueType: VALUE_TYPE.ALGEBRAIC,
        implicitMultiply: true
    },

    natural: { allow: ["digit"],
        valueType: VALUE_TYPE.NATURAL
     },
    setContent: { allow: ["comma", "digit","decimal","variable","constant","plus","minus","additive",
        "multiply","divide","group","sqrt","nthRoot","fixedExponent","power","simpleFraction","function",
        "namedFunction","absolute","scientific","postfix","symbol","subscript","comma"],
        valueType: VALUE_TYPE.ALGEBRAIC, 
        implicitMultiply: true
    },
    functionName: {
        allow: ["variable", "digit", "postfix", "fixedExponent"],
        maxChars: 8,
        valueType: VALUE_TYPE.IDENTIFIER,
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
        allow: ["variable", "subscript"],
        maxItems: 2,
        autoAdvanceWhenFull: true,
        valueType: VALUE_TYPE.IDENTIFIER,

        validate: function(kbd, action) {
            let seq = kbd.currentSequence();

            if (!seq) return false;

            if (action === "variable") {
                return seq.items.length === 0 ||
                    (seq.items.length === 1 &&
                    seq.items[0].type === "variable");
            }

            if (action === "subscript") {
                return seq.items.length === 1 &&
                    seq.items[0].type === "variable";
            }

            return false;
        }
    },
    variableOnly: {
        allow: ["variable"],
        maxChars: 1,
        autoAdvance: true,
        valueType: VALUE_TYPE.VARIABLE,
        validate: function(kbd, action) {
            let seq = kbd.currentSequence();
            return action === "variable" && !!seq && seq.items.length === 0;
        }
    },
    variableNamePart: {
        allow: ["variable", "digit", "subscript"],
        maxChars: 2,
        autoAdvanceWhenFull: true,
        valueType: VALUE_TYPE.IDENTIFIER,

        validate: function(kbd, action) {
            let seq = kbd.currentOrContainingSequence();

            if (!seq) return false;
            if (action === "subscript") {
                return true;
            }
            if (action === "variable") {
                return true;
            }

            if (action === "digit") {
                return kbd.sequenceCharCount(seq) > 0;
            }

            return false;
        }
    },
    limitDirection: {
        allow: ["plus","minus"],
        autoAdvance: true,
        valueType: VALUE_TYPE.DIRECTION,
        validate: function(kbd, action) {
            let seq = kbd.currentSequence();
            return !!seq && seq.items.length === 0;
        }
    },

    signedInteger: {
        allow: ["digit","plus","minus"],
        valueType: VALUE_TYPE.INTEGER,
        validate: function(kbd, action) {
            if (action === "digit") return true;
            let seq = kbd.currentSequence();
            return !!seq && seq.items.length === 0;
        }
    },

    subscript: { allow: ["digit","variable","plus","minus", "symbol", "comma"],
        valueType: VALUE_TYPE.SUBSCRIPT
     },

    limitTarget: { allow: ["digit","decimal","variable","subscript", "constant","plus","minus","simpleFraction", "sqrt", 
        "nthRoot", "power", "fixedExponent"] }
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
let PHYSICAL_KEY_ACTIONS = {
    "Enter": [],
    " ": [],

    ",": ["insertSeparator", COMMA_SYMBOL],

    ".": "insertDecimal",
    "Decimal": "insertDecimal",

    "+": ["insertOperator", "+", true],
    "-": ["insertOperator", "-", true],

    "*": ["insertOperator", "*", true],
    "Multiply": ["insertOperator", "*", true],

    "/": "insertDivide",
    "Divide": "insertDivide",

    "=": "insertEquals",
    "^": "insertPower",
    "'": "applyPrime",
    "_": "insertSubscript",

    "!": ["insertPhysicalSymbol", "factorial"],
    "%": ["insertPhysicalSymbol", "percent"],

    "Backspace": "deleteLeft",

    "ArrowLeft": ["moveCursor", -1],
    "ArrowRight": ["moveCursor", 1],

    "(": "insertGroup",
    "{": "insertSet"
};
MoodleMathKeyboard.prototype.handlePhysicalKey = function(event) {
    this.hidePlaceholderTooltip();

    if (this.config.readOnly) return;

    let target = event.target;
    let key = event.key;
    let handled = false;
    let action;
    let variable;

    /*
     * Do not interfere with browser/system shortcuts.
     *
     * Shift is intentionally NOT included here.
     * event.key already contains the shifted value:
     * Shift+8  -> "*"
     * Shift+=  -> "+"
     * Shift+A  -> "A"
     */
    if (event.ctrlKey || event.metaKey || event.altKey) { return;  }

    /*
     * Do not process typing intended for another editable field.
     */
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) { return; }

    /*
     * Digits
     */
    if (key >= "0" && key <= "9") {
        this.insertDigit(key);
        handled = true;
    }

    /*
     * Letters
     */
    else if (key.length === 1 &&
        ((key >= "a" && key <= "z") ||
         (key >= "A" && key <= "Z"))) {

        variable = this.findVariableForKey(key);

        if (!variable &&
            this.config.acceptLowercaseVariables) {

            variable = {
                id: key,
                label: key,
                latex: key
            };
        }

        if (variable) {
            this.insertVariable(variable, true);
            handled = true;
        }
    }

    /*
     * Data-driven physical-key actions.
     */
    else if (
        Object.prototype.hasOwnProperty.call(
            PHYSICAL_KEY_ACTIONS,
            key
        )
    ) {
        action = PHYSICAL_KEY_ACTIONS[key];

        /*
         * [] means:
         * intercept the key but perform no keyboard action.
         *
         * Used for Enter and Space so they do not activate
         * a focused panel button.
         */
        if (Array.isArray(action)) {
            if (action.length > 0) {
                this[action[0]].apply(
                    this,
                    action.slice(1)
                );
            }
        } else {
            this[action]();
        }

        handled = true;
    }

    /*
     * Do this once for every handled physical key.
     */
    if (handled) {
        event.preventDefault();

        if (this.displayContainer) {
            this.displayContainer.focus();
        }
    }
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
MoodleMathKeyboard.prototype.render = function (ast) {
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
            JSON.stringify(ast || this.getAST(), null, 2) +
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
          
        self.installPlaceholderTooltips();
        self.positionCaret();
    }).catch(function (error) {
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
