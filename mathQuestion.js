/*
 * Copyright (c) 2026 Avi Nathan. All rights reserved.
 * No part of this file may be copied, modified or distributed without the written permission of the copyright holder.
 */
/*
 * MathQuestion - a math keyboard question in Moodle STACK (STACK-JS) or in any other system (version MathQuestion.version).
 *
 * All student-side code is here; the playground (mathCheckPlayground.html, tab "4. Question code") generates only the
 * configuration and a fixed template, as the chemistry builder does (chemistryLib/STACKJS-DESIGN.md):
 *
 *   MathQuestion.mountStackJs(stack_js, config)       inside a STACK [[iframe]] - loads MathJax itself
 *   MathQuestion.mount(element, config, options)      any other system (the page loads MathJax 3 with [tex]/html)
 *     options.state     the saved state (an object or its JSON text) or null
 *     options.readOnly  true: the review - the submitted answer with its grade and feedback
 *     options.onChange  function (state, score) after every change; state null when the answer is emptied
 *
 * Needs, loaded before it: fullKbdLib-v4.js (MoodleMathKeyboard) and mathCheck.js (MathCheck).
 *
 * The configuration:
 *   { tool: "mathCheck-question", formatVersion: 1, questionId,
 *     language: "exercise" (the exercise's feedback language) | "system" (the page's language) | "en" | "he" | "ar",
 *     review: { grade, feedback, reference }    - what the review shows (each true unless false)
 *     inputs: { score: "ans1", state: "ans2" }   - the STACK inputs (STACK-JS only)
 *     displayChars                               - the answer box's width in characters; none = the whole width
 *     mathJaxUrl                                 - STACK-JS only; default MathJax 3 from jsDelivr
 *     exercise: the playground's exercise package (.mchk): keyboard, reference, referenceUnit, rules, rubric, language }
 *
 * The saved state (what onChange gets; in the STACK string input encoded: "mq1:" + base64 of the JSON, see encodeState):
 *   { v: 1, latex, editor, unit: { value, scale } | null, grade, feedback }
 * editor - the keyboard's editor AST, to show the answer again; latex - to read it without the keyboard; grade 0..100
 * and feedback - what the student got, for Moodle's response history. Plain text (Moodle's "Fill in correct
 * responses" puts the model answer there - the reference LaTeX) is taken as the LaTeX of an answer.
 */
(function (global) {
"use strict";

const VERSION = "1.0.2";
const MATHJAX_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";

const TEXT = {
    en: { reference: "Reference answer:", empty: "No answer was given." },
    he: { reference: "התשובה הנכונה:", empty: "לא ניתנה תשובה." },
    ar: { reference: "الإجابة الصحيحة:", empty: "لم تُعطَ إجابة." }
};

/* ============================================================
   MATHJAX - none inside a STACK frame: loaded here, with the [tex]/html extension the keyboard's cursor needs
   ============================================================ */
let mathJaxLoading = null;
function ensureMathJax(url) {
    const mj = global.MathJax;
    if (mj && mj.version && mj.startup) return mj.startup.promise;
    if (mathJaxLoading) return mathJaxLoading;
    global.MathJax = {
        loader: { load: ["[tex]/html"] },
        tex: { packages: { "[+]": ["html"] }, inlineMath: [["\\(", "\\)"]] },
        svg: { fontCache: "global" }
    };
    mathJaxLoading = new Promise(function (resolve, reject) {
        const s = document.createElement("script");
        s.src = url || MATHJAX_URL;
        s.onload = function () { resolve(global.MathJax.startup.promise); };
        s.onerror = function () { reject(new Error("MathJax could not be loaded: " + s.src)); };
        document.head.appendChild(s);
    });
    return mathJaxLoading;
}
function typeset(el) {
    const mj = global.MathJax;
    if (!mj || !mj.startup || !mj.startup.promise) return;
    mj.startup.promise.then(function () { return mj.typesetPromise([el]); }).catch(function () {});
}

/* ============================================================
   THE SAVED STATE
   ============================================================ */
/*
 * In a STACK string input the state is STATE_PREFIX + base64 of the JSON (UTF-8): letters, digits, + / = only. The
 * JSON itself has backslashes (\n in the feedback, LaTeX) and characters such as − and ·; with them a wrong answer's
 * state was invalid in STACK, so Check did not grade it (2026-10-30 - a correct one, "Score: 100%", had none).
 */
const STATE_PREFIX = "mq1:";
function encodeState(state) {
    const bytes = new TextEncoder().encode(JSON.stringify(state));
    let bin = "";
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    return STATE_PREFIX + global.btoa(bin);
}
function decodeState(text) {
    const bin = global.atob(text.slice(STATE_PREFIX.length).replace(/\s+/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

function parseState(text) {
    if (text && typeof text === "object") return text;
    if (!text) return null;
    text = String(text).trim();
    if (text.indexOf(STATE_PREFIX) === 0) {
        try { text = decodeState(text); } catch (e) { return null; }
    }
    let s = null;
    try { s = JSON.parse(text); } catch (e) { s = null; }
    if (s && typeof s === "object" && (s.editor || typeof s.latex === "string")) return s;
    return { latex: String(text) };
}

/* the editor AST back into a keyboard (as the playground's loadEditor) - the cursor at the end */
function restoreEditor(keyboard, editorAST) {
    if (!editorAST || !editorAST.elements || !editorAST.elements.length) return;
    let maxId = 0;
    JSON.stringify(editorAST, function (key, v) { if (key === "id" && typeof v === "number" && v > maxId) maxId = v; return v; });
    const last = editorAST.elements[editorAST.elements.length - 1];
    keyboard.editorAST = JSON.parse(JSON.stringify(editorAST));
    keyboard.cursor = { seqId: last.id, offset: (last.items || []).length, textNodeId: null, charOffset: null };
    keyboard.nextId = maxId + 1;
    keyboard.changed();
}

function isEmpty(keyboard) {
    const e = keyboard.getEditorAST();
    const typed = e && e.elements && e.elements.some(function (el) { return (el.items || []).length > 0; });
    return !typed && !keyboard.getUnit();
}

/* ============================================================
   ONE QUESTION
   ============================================================ */
function supported(code) {
    code = String(code || "").replace(/['"\s]/g, "").toLowerCase().slice(0, 2);
    return code === "he" || code === "ar" || code === "en" ? code : "";
}

/*
 * host - an element; cfg - the configuration; adapter - { state, review, save(state, score) } from mountStackJs /
 * mount. Returns { keyboard, check() }.
 */
function runQuestion(host, cfg, adapter) {
    const ex = cfg.exercise || {};
    if (!ex.reference) throw new Error("the configuration has no exercise (reference answer)");
    adapter = adapter || {};

    /* the student language: "system" - the page's language (Moodle sets <html lang>), so one copy serves all */
    const lang = cfg.language === "system"
        ? (supported(global.studentLanguage) || supported(document.documentElement.lang) || supported(ex.language) || "en")
        : (supported(cfg.language) || supported(ex.language) || "en");
    const review = adapter.review === true;
    const saved = adapter.state || null;

    host.textContent = "";
    host.dir = lang === "en" ? "ltr" : "rtl";
    if (!host.id) host.id = "mathq-" + (global.__mathqRuns = (global.__mathqRuns || 0) + 1);
    const kbDiv = document.createElement("div");
    kbDiv.id = host.id + "-keyboard";
    kbDiv.dir = "ltr";
    host.appendChild(kbDiv);

    function check(keyboard) {
        const stu = keyboard.getAST();
        const options = { language: lang, logicNotation: (ex.keyboard && ex.keyboard.logicNotation) || "symbols" };
        return ex.referenceUnit
            ? global.MathCheck.compare({ answer: stu, unit: keyboard.getUnit() || null }, { answer: ex.reference, unit: ex.referenceUnit },
                ex.rules || {}, ex.rubric || null, options)
            : global.MathCheck.compare(stu, ex.reference, ex.rules || {}, ex.rubric || null, options);
    }

    let restoring = true;
    const kbConfig = Object.assign({}, ex.keyboard || {}, {
        divId: kbDiv.id,
        readOnly: review,
        physicalKeyboard: !review,
        onChange: function () {
            if (restoring || review || typeof adapter.save !== "function") return;
            if (isEmpty(keyboard)) { adapter.save(null, 0); return; }
            const result = check(keyboard);
            const score = Math.round(result.grade * 100) / 10000;
            adapter.save({
                v: 1, latex: keyboard.getLatex(), editor: keyboard.getEditorAST(),
                unit: keyboard.getUnit() ? { value: keyboard.getUnit(), scale: keyboard.getUnitScale() } : null,
                grade: result.grade, feedback: result.feedback
            }, score);
        }
    });
    if (cfg.language === "system") kbConfig.language = lang;      // the keyboard's tooltips too
    if (cfg.displayChars > 0) kbConfig.displayChars = cfg.displayChars;
    const keyboard = new global.MoodleMathKeyboard(kbConfig);

    if (saved && saved.editor) restoreEditor(keyboard, saved.editor);
    if (saved && saved.unit && saved.unit.value) keyboard.selectUnit(saved.unit);
    restoring = false;

    if (!review) {
        /*
         * The computer keyboard reaches the keyboard only when the focus is in this document and not in a text field
         * (handlePhysicalKey ignores those). The ⌨ button and the keys cancel mousedown so as not to take the focus -
         * in a STACK frame the key presses then went to the Moodle page (2026-10-29). A press on the question takes it.
         */
        host.addEventListener("pointerdown", function () {
            if (!document.hasFocus()) global.focus();
            const a = document.activeElement;
            if (a && !host.contains(a) && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) a.blur();
        }, true);
        return { keyboard: keyboard, check: function () { return check(keyboard); } };
    }

    /*
     * The review: the answer read-only, then what cfg.review switches on - the grade (the feedback's first line),
     * the feedback (the rest), the reference answer. The grade is computed again with the question's current rules.
     */
    const show = cfg.review || {};
    keyboard.keyboardToggleButton.style.display = "none";
    keyboard.caret.style.visibility = "hidden";          // no cursor in an answer that cannot change (render shows it)
    const out = document.createElement("div");
    out.style.cssText = "margin-top:8px;white-space:pre-wrap";
    host.appendChild(out);
    const line = function (text, css) {
        const d = document.createElement("div");
        d.textContent = text;
        if (css) d.style.cssText = css;
        out.appendChild(d);
        return d;
    };

    if (!saved || (!saved.editor && !saved.latex)) {
        line(TEXT[lang].empty, "font-weight:bold");
    } else if (!saved.editor) {
        /* a model answer from Moodle (plain LaTeX): no editor to show it in */
        kbDiv.style.display = "none";
        line("\\(" + saved.latex + "\\)", "direction:ltr;text-align:left;font-size:20px");
    } else {
        const lines = String(check(keyboard).feedback || "").split("\n");
        if (show.grade !== false) line(lines[0], "font-weight:bold;font-size:18px");
        if (show.feedback !== false && lines.length > 1) line(lines.slice(1).join("\n"));
    }
    if (show.reference !== false) {
        line(TEXT[lang].reference, "font-weight:bold;margin-top:10px");
        line("\\(" + global.MathCheck.latex(ex.reference) + (ex.referenceUnit ? "\\;\\text{" + ex.referenceUnit + "}" : "") + "\\)",
            "direction:ltr;text-align:left;font-size:20px");
    }
    typeset(out);
    return { keyboard: keyboard, check: function () { return check(keyboard); } };
}

/* ============================================================
   STACK-JS - inside a STACK [[iframe]] (the playground's template)
   ============================================================ */
/*
 * config.inputs = { score: "ans1", state: "ans2" } - the question text hides them (a frame cannot). limittoquestion
 * = true: each frame works with the inputs of its own question, also when two questions on the page use the same
 * names. The review: STACK shows the submitted inputs read-only in the sandbox too (probe T2 of the chemistry design).
 */
function mountStackJs(stackJs, cfg) {
    const names = cfg.inputs || { score: "ans1", state: "ans2" };
    let host = document.getElementById(cfg.hostId || "mathq");
    if (!host) {
        host = document.createElement("div");
        host.id = cfg.hostId || "mathq";
        document.body.appendChild(host);
    }
    function access(name) {
        if (!name) return Promise.resolve(null);
        return Promise.resolve(stackJs.request_access_to_input(name, false, true)).then(function (id) {
            return document.getElementById(id);
        });
    }
    /*
     * The score as STACK's numerical input takes it also with "Forbid float" on (2026-10-30: a decimal score 0.4 was
     * invalid there, so Check did not grade a partly correct answer - and the hidden validation did not show why):
     * 0, 1 or a fraction in lowest terms of 10000ths, e.g. 2/5.
     */
    function scoreText(score) {
        const n = Math.max(0, Math.min(10000, Math.round(score * 10000)));
        if (n === 0 || n === 10000) return String(n / 10000);
        let a = n, b = 10000;
        while (b) { const t = a % b; a = b; b = t; }
        return (n / a) + "/" + (10000 / a);
    }
    /* a value reaches Moodle only with a change event */
    function put(el, value) {
        if (!el || el.value === value) return;
        el.value = value;
        el.dispatchEvent(new Event("change"));
    }

    return Promise.all([access(names.score), access(names.state), ensureMathJax(cfg.mathJaxUrl)]).then(function (els) {
        const scoreEl = els[0], stateEl = els[1];
        const review = [scoreEl, stateEl].some(function (e) { return e && (e.readOnly || e.disabled); });
        const run = runQuestion(host, cfg, {
            state: stateEl ? parseState(stateEl.value) : null,
            review: review,
            save: function (state, score) {
                put(stateEl, state ? encodeState(state) : "");
                put(scoreEl, state ? scoreText(score) : "");
            }
        });
        /* the keys cannot float over the page: they close when the student leaves the frame (Moodle's Check, the next question) */
        global.addEventListener("blur", function () { run.keyboard.hideKeyboard(); });
        fitFrame(stackJs);
        return run;
    }).catch(function (e) {
        const msg = "Math keyboard: " + (e && e.message ? e.message : e);
        if (stackJs.display_error) stackJs.display_error(msg);
        if (global.console) console.error(msg, e);
    });
}

/*
 * The frame follows its content: the answer box while the keys are closed, the keys (an absolute window, not part of
 * the page height) while they are open. The bottom of every element shown - not scrollHeight, which never shrinks
 * below the frame's height.
 */
function fitFrame(stackJs) {
    let last = 0, pending = false;
    function needed() {
        let bottom = 0;
        const all = document.body.getElementsByTagName("*");
        for (let i = 0; i < all.length; i += 1) {
            const r = all[i].getBoundingClientRect();
            if (r.width && r.height && r.bottom > bottom) bottom = r.bottom;
        }
        return Math.ceil(bottom + (global.scrollY || 0) + 12);
    }
    function check() {
        pending = false;
        const h = needed();
        if (Math.abs(h - last) < 3) return;
        last = h;
        stackJs.resize_containing_frame("100%", h + "px");
    }
    function soon() {
        if (pending) return;
        pending = true;
        /* not requestAnimationFrame: a browser may hold it back in a frame that is not focused */
        setTimeout(check, 30);
    }
    if (global.MutationObserver) new MutationObserver(soon).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
    if (global.ResizeObserver) new ResizeObserver(soon).observe(document.body);
    global.addEventListener("resize", soon);
    document.documentElement.style.overflow = "hidden";
    soon();
}

/* ============================================================
   ANY OTHER SYSTEM
   ============================================================ */
function mount(element, cfg, opts) {
    opts = opts || {};
    return runQuestion(element, cfg, {
        state: parseState(opts.state),
        review: opts.readOnly === true,
        save: typeof opts.onChange === "function" ? opts.onChange : null
    });
}

const MathQuestion = {
    version: VERSION,
    mountStackJs: mountStackJs,
    mount: mount,
    parseState: parseState,
    encodeState: encodeState
};
if (typeof module === "object" && module.exports) module.exports = MathQuestion;
global.MathQuestion = MathQuestion;
})(typeof window !== "undefined" ? window : this);
