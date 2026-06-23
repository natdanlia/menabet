"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { BookOpen, RotateCcw, Eye, EyeOff, ChevronDown, PartyPopper } from "lucide-react";
import versesData from "@/data/verses.json";

type Division = keyof typeof versesData;
type BibleVersion = "esv" | "kjv" | "nkjv" | "nasb" | "niv";

interface WeekData {
  reference: string;
  esv: string;
  kjv: string;
  nkjv: string;
  nasb: string;
  niv: string;
}

const DIVISIONS: { value: Division; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "primary", label: "Primary" },
  { value: "junior", label: "Junior" },
  { value: "senior", label: "Senior" },
];

const VERSIONS: { value: BibleVersion; label: string }[] = [
  { value: "esv", label: "ESV" },
  { value: "kjv", label: "KJV" },
  { value: "nkjv", label: "NKJV" },
  { value: "nasb", label: "NASB" },
  { value: "niv", label: "NIV" },
];

const LEVEL_LABELS = ["Full Text", "25% Hidden", "50% Hidden", "75% Hidden", "100% Hidden"];
const LEVEL_COLORS = ["bg-emerald-500", "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500"];

// Monospace font stack — every character is exactly the same width.
// This fixes "mm" crowding and "W" overflow regardless of the verse font.
const MONO = "'Courier New', Courier, monospace";

function splitToken(token: string): { pre: string; core: string; post: string } {
  const m = token.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9''\-]*)([^a-zA-Z0-9]*)$/);
  if (!m) return { pre: "", core: token, post: "" };
  return { pre: m[1], core: m[2], post: m[3] };
}

function getCutoff(totalWords: number, level: number): number {
  if (level === 0) return 0;
  if (level === 4) return totalWords;
  return Math.round(totalWords * [0, 0.25, 0.5, 0.75, 1][level]);
}

// ── Blinking vertical caret ───────────────────────────────────────────────────
function Caret() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: "1.5px",
        height: "1.1em",
        backgroundColor: "#6366f1",
        verticalAlign: "text-bottom",
        // Negative margins so the caret takes no layout space between slots
        marginLeft: "-0.75px",
        marginRight: "-0.75px",
        borderRadius: "1px",
        animation: "slotBlink 1s step-end infinite",
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

// ── Per-word letter-slot input ────────────────────────────────────────────────
function WordInput({
  correct,
  value,
  onChange,
  onComplete,
  onBackspacePrev,
  onArrowPrev,
  onArrowNext,
  registerRef,
  registerFocusAt,
}: {
  correct: string;
  value: string;
  onChange: (v: string) => void;
  onComplete: () => void;
  onBackspacePrev: () => void;
  onArrowPrev: () => void;
  onArrowNext: () => void;
  registerRef: (el: HTMLInputElement | null) => void;
  registerFocusAt: (fn: (pos: number) => void) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused]   = useState(false);
  const [cursorPos, setCursorPos] = useState(0);

  // Stable refs so callbacks never go stale
  const valueRef     = useRef(value);   valueRef.current     = value;
  const cursorRef    = useRef(cursorPos); cursorRef.current   = cursorPos;
  const correctLen   = correct.length;

  // ── Native focus tracking (reliable for programmatic .focus() calls) ──────
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onIn  = () => setFocused(true);
    const onOut = () => setFocused(false);
    el.addEventListener("focus", onIn);
    el.addEventListener("blur",  onOut);
    return () => { el.removeEventListener("focus", onIn); el.removeEventListener("blur", onOut); };
  }, []);

  // ── Stable focusAt exposed to parent for cross-word navigation ───────────
  const focusAt = useCallback((pos: number) => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    // Input selection is clamped to typed length; visual cursor is unclamped
    const inputPos = Math.min(pos, valueRef.current.length);
    setTimeout(() => {
      el.setSelectionRange(inputPos, inputPos);
      setCursorPos(pos);
    }, 0);
  }, []); // stable — reads value through ref

  useEffect(() => { registerFocusAt(focusAt); }, [registerFocusAt, focusAt]);

  // ── Shared cursor-move helper ─────────────────────────────────────────────
  const moveCursor = useCallback((pos: number, currentVal: string) => {
    const inputPos = Math.min(pos, currentVal.length);
    inputRef.current?.setSelectionRange(inputPos, inputPos);
    setCursorPos(pos);
  }, []);

  // ── All keyboard handling in one place ───────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const pos = cursorRef.current;
      const val = valueRef.current;

      // Space — advance visual cursor; wrap to next word at end
      if (e.key === " ") {
        e.preventDefault();
        const next = pos + 1;
        if (next > correctLen) { onArrowNext(); }
        else { moveCursor(next, val); }
        return;
      }

      // ArrowLeft — move left or jump to prev word
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (pos > 0) { moveCursor(pos - 1, val); }
        else { onArrowPrev(); }
        return;
      }

      // ArrowRight — move right or jump to next word
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (pos < correctLen) { moveCursor(pos + 1, val); }
        else { onArrowNext(); }
        return;
      }

      // Backspace — delete char before cursor or go to prev word
      if (e.key === "Backspace") {
        e.preventDefault();
        if (pos > 0) {
          const newVal = val.slice(0, pos - 1) + val.slice(pos);
          onChange(newVal);
          moveCursor(pos - 1, newVal);
        } else {
          onBackspacePrev();
        }
        return;
      }

      // Delete — remove char at cursor
      if (e.key === "Delete") {
        e.preventDefault();
        if (pos < val.length) {
          const newVal = val.slice(0, pos) + val.slice(pos + 1);
          onChange(newVal);
          moveCursor(pos, newVal);
        }
        return;
      }

      // Printable chars — OVERWRITE mode (replaces char at cursor position)
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (pos >= correctLen) return; // no slot to overwrite at end
        const newVal = (val.slice(0, pos) + e.key + val.slice(pos + 1)).slice(0, correctLen);
        onChange(newVal);
        const nextPos = Math.min(pos + 1, correctLen);
        moveCursor(nextPos, newVal);
        if (newVal.length === correctLen) setTimeout(onComplete, 60);
        return;
      }
    },
    [correctLen, onChange, onComplete, onBackspacePrev, onArrowPrev, onArrowNext, moveCursor]
  );

  // onChange catches mobile soft-keyboard input (not intercepted by onKeyDown)
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = e.target.value.replace(/ /g, "");
      const next = cleaned.slice(0, correctLen);
      onChange(next);
      const pos = e.target.selectionStart ?? next.length;
      setCursorPos(pos);
      if (next.length === correctLen) setTimeout(onComplete, 60);
    },
    [correctLen, onChange, onComplete]
  );

  const letters = correct.split("");

  return (
    <span style={{ display: "inline-block", verticalAlign: "baseline", whiteSpace: "nowrap" }}>
      {letters.map((char, i) => {
        const typed    = value[i] ?? "";
        const empty    = typed === "";
        const isCorrect = !empty && typed.toLowerCase() === char.toLowerCase();
        const isWrong   = !empty && !isCorrect;
        const color = isCorrect ? "#2563eb" : isWrong ? "#dc2626" : "#9ca3af";

        return (
          <Fragment key={i}>
            {/* Vertical caret sits BEFORE slot i when cursorPos === i */}
            {focused && cursorPos === i && <Caret />}

            <span
              onMouseDown={(e) => { e.preventDefault(); focusAt(i); }}
              style={{
                display: "inline-block",
                verticalAlign: "baseline",
                // 1ch in a monospace font = exactly one character width.
                // This guarantees uniform slot size for W, m, i, l, etc.
                fontFamily: MONO,
                width: "1ch",
                textAlign: "center",
                // Small gap between slots so they read as distinct squares
                marginRight: i < letters.length - 1 ? "0.15em" : 0,
                color,
                cursor: "text",
                lineHeight: "inherit",
              }}
            >
              {empty ? "_" : typed}
            </span>
          </Fragment>
        );
      })}

      {/* Caret after the last slot */}
      {focused && cursorPos === correct.length && <Caret />}

      {/* Invisible input — captures all keystrokes */}
      <input
        ref={(el) => { inputRef.current = el; registerRef(el); }}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) => { setCursorPos(e.target.selectionStart ?? value.length); }}
        maxLength={correctLen}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        tabIndex={0}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
        aria-label={`Type hidden word (${correctLen} letters)`}
      />
    </span>
  );
}

// ── Dropdown ──────────────────────────────────────────────────────────────────
function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest text-stone-500">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-stone-200 bg-white px-4 py-2.5 pr-10 text-sm font-medium text-stone-800 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function MemorizationSlider() {
  const [division, setDivision] = useState<Division>("junior");
  const [week, setWeek]         = useState<string>("1");
  const [version, setVersion]   = useState<BibleVersion>("esv");
  const [level, setLevel]       = useState<number>(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [userInputs, setUserInputs]   = useState<Record<number, string>>({});
  const [celebrated, setCelebrated]   = useState(false);

  // Per-word hidden input elements (for backspace-prev / focus)
  const inputRefs   = useRef<Record<number, HTMLInputElement | null>>({});
  // Per-word focusAt(pos) functions exposed by each WordInput
  const focusAtRefs = useRef<Record<number, (pos: number) => void>>({});

  useEffect(() => {
    setMounted(true);
    try {
      const prefs = JSON.parse(localStorage.getItem("bibleBeePrefs") ?? "{}");
      if (prefs.division) setDivision(prefs.division);
      if (prefs.week)     setWeek(prefs.week);
      if (prefs.version)  setVersion(prefs.version);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("bibleBeePrefs", JSON.stringify({ division, week, version }));
  }, [division, week, version, mounted]);

  const divisionData = versesData[division] as Record<string, WeekData>;
  const weeks        = Object.keys(divisionData).sort((a, b) => Number(a) - Number(b));
  const activeWeek   = weeks.includes(week) ? week : weeks[0];
  const weekData     = divisionData[activeWeek];
  const verseText    = weekData[version];
  const reference    = weekData.reference;

  const tokens     = verseText.split(" ");
  const cutoff     = getCutoff(tokens.length, level);
  const hiddenSet  = new Set<number>(Array.from({ length: cutoff }, (_, i) => i));
  const hiddenList = [...hiddenSet].sort((a, b) => a - b);

  const wordCorrect = useCallback(
    (idx: number) => {
      const { core } = splitToken(tokens[idx]);
      const typed    = userInputs[idx] ?? "";
      return typed.length === core.length &&
        typed.split("").every((ch, ci) => ch.toLowerCase() === core[ci].toLowerCase());
    },
    [tokens, userInputs]
  );

  const correctCount = hiddenList.filter(wordCorrect).length;
  const allCorrect   = hiddenSet.size > 0 && correctCount === hiddenSet.size;

  useEffect(() => {
    if (allCorrect && !celebrated) setCelebrated(true);
  }, [allCorrect, celebrated]);

  const resetInputs = useCallback(() => {
    setUserInputs({});
    setCelebrated(false);
    setIsRevealing(false);
    inputRefs.current   = {};
    focusAtRefs.current = {};
  }, []);

  const handleDivisionChange = useCallback((v: string) => {
    setDivision(v as Division);
    setLevel(0);
    resetInputs();
    const nw = Object.keys(versesData[v as Division] as Record<string, WeekData>)
      .sort((a, b) => Number(a) - Number(b));
    setWeek(nw[0]);
  }, [resetInputs]);

  const handleWeekChange    = useCallback((v: string) => { setWeek(v); setLevel(0); resetInputs(); }, [resetInputs]);
  const handleVersionChange = useCallback((v: string) => { setVersion(v as BibleVersion); setLevel(0); resetInputs(); }, [resetInputs]);
  const handleLevelChange   = useCallback((l: number) => { setLevel(l); resetInputs(); }, [resetInputs]);
  const handleWordInput     = useCallback((index: number, value: string) => {
    setUserInputs((prev) => ({ ...prev, [index]: value }));
    setCelebrated(false);
  }, []);

  // Jump forward to next hidden word (auto-advance on completion or Space)
  const handleArrowNext = useCallback(
    (index: number) => {
      const pos  = hiddenList.indexOf(index);
      const next = hiddenList[pos + 1];
      if (next !== undefined) setTimeout(() => focusAtRefs.current[next]?.(0), 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenList.join(",")]
  );

  // Jump backward to prev hidden word (Backspace-at-start or ArrowLeft-at-start)
  const handleArrowPrev = useCallback(
    (index: number) => {
      const pos  = hiddenList.indexOf(index);
      const prev = hiddenList[pos - 1];
      if (prev !== undefined) {
        const { core } = splitToken(tokens[prev]);
        setTimeout(() => focusAtRefs.current[prev]?.(core.length), 0);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenList.join(","), tokens.join(" ")]
  );

  const weekOptions = weeks.map((w) => ({
    value: w,
    label: `Week ${w} — ${divisionData[w].reference}`,
  }));

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @keyframes slotBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      <div className="min-h-screen flex flex-col bg-stone-50">
        {/* Header */}
        <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-indigo-600 shadow-sm">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-stone-900 leading-tight">Bible Bee</h1>
              <p className="text-xs text-stone-500 leading-tight">Scripture Memorization</p>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col gap-6">
          {/* Selectors */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SelectField label="Division" value={division} onChange={handleDivisionChange} options={DIVISIONS} />
            <SelectField label="Week & Verse" value={activeWeek} onChange={handleWeekChange} options={weekOptions} />
            <SelectField label="Bible Version" value={version} onChange={handleVersionChange} options={VERSIONS} />
          </section>

          {/* Erasure Level slider */}
          <section className="rounded-2xl border border-stone-200 bg-white shadow-sm px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Erasure Level</p>
                <p className="text-sm font-semibold text-stone-700 mt-0.5">
                  Level {level + 1} — {LEVEL_LABELS[level]}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLevelChange(0)}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
                <button
                  onMouseDown={() => setIsRevealing(true)}
                  onMouseUp={() => setIsRevealing(false)}
                  onMouseLeave={() => setIsRevealing(false)}
                  onTouchStart={() => setIsRevealing(true)}
                  onTouchEnd={() => setIsRevealing(false)}
                  disabled={level === 0}
                  className={[
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition select-none",
                    level === 0
                      ? "border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed"
                      : isRevealing
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100",
                  ].join(" ")}
                >
                  {isRevealing ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {isRevealing ? "Revealing" : "Hold to Peek"}
                </button>
              </div>
            </div>

            <div className="flex gap-1.5 mb-2">
              {[0, 1, 2, 3, 4].map((l) => (
                <button
                  key={l}
                  onClick={() => handleLevelChange(l)}
                  className={`flex-1 h-2 rounded-full transition-all duration-200 ${
                    l <= level ? LEVEL_COLORS[level] : "bg-stone-200 hover:bg-stone-300"
                  }`}
                />
              ))}
            </div>
            <input
              type="range" min={0} max={4} value={level}
              onChange={(e) => handleLevelChange(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between mt-1">
              {LEVEL_LABELS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => handleLevelChange(i)}
                  className={`text-xs transition ${
                    i === level ? "font-semibold text-indigo-600" : "text-stone-400 hover:text-stone-600"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </section>

          {/* Congratulations banner */}
          {celebrated && (
            <section className="rounded-2xl border border-blue-200 bg-blue-50 px-6 py-5 flex items-start gap-4 shadow-sm">
              <PartyPopper className="h-8 w-8 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-lg font-bold text-blue-800">Excellent work! 🎉</p>
                <p className="text-sm text-blue-700 mt-0.5">
                  Every letter correct for <strong>{reference}</strong>. Try the next level!
                </p>
                <button
                  onClick={() => handleLevelChange(Math.min(level + 1, 4))}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  Next level →
                </button>
              </div>
            </section>
          )}

          {/* Verse Card */}
          <section className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/60">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                  {DIVISIONS.find((d) => d.value === division)?.label} ·{" "}
                  {VERSIONS.find((v) => v.value === version)?.label}
                </p>
                <p className="text-lg font-semibold text-stone-800 mt-0.5">{reference}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-400">Week</p>
                <p className="text-2xl font-bold text-indigo-600">{activeWeek}</p>
              </div>
            </div>

            <div className="px-6 py-8">
              <div
                className="text-xl sm:text-2xl leading-loose text-stone-800"
                style={{ fontFamily: "var(--font-lora), Georgia, serif", wordSpacing: "0.18em" }}
              >
                {tokens.map((token, i) => {
                  const { pre, core, post } = splitToken(token);
                  const isHidden = hiddenSet.has(i);

                  if (!isHidden) {
                    return <span key={i}>{i > 0 ? " " : ""}{token}</span>;
                  }

                  if (isRevealing) {
                    return (
                      <span key={i}>
                        {i > 0 ? " " : ""}
                        {pre}
                        <span className="text-indigo-500 font-medium">{core}</span>
                        {post && <span style={{ marginLeft: "0.05em" }}>{post}</span>}
                      </span>
                    );
                  }

                  return (
                    <span key={i}>
                      {i > 0 ? " " : ""}
                      {pre}
                      <WordInput
                        correct={core}
                        value={userInputs[i] ?? ""}
                        onChange={(v) => handleWordInput(i, v)}
                        onComplete={() => handleArrowNext(i)}
                        onBackspacePrev={() => handleArrowPrev(i)}
                        onArrowPrev={() => handleArrowPrev(i)}
                        onArrowNext={() => handleArrowNext(i)}
                        registerRef={(el) => { inputRefs.current[i] = el; }}
                        registerFocusAt={(fn) => { focusAtRefs.current[i] = fn; }}
                      />
                      {post && <span style={{ marginLeft: "0.08em" }}>{post}</span>}
                    </span>
                  );
                })}
              </div>

              {hiddenSet.size > 0 && (
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all duration-300"
                      style={{ width: `${(correctCount / hiddenSet.size) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-stone-400 tabular-nums whitespace-nowrap">
                    {correctCount} / {hiddenSet.size} words
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Level guide cards */}
          <section className="grid grid-cols-5 gap-2">
            {LEVEL_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => handleLevelChange(i)}
                className={`rounded-xl p-3 text-center transition border ${
                  i === level ? "border-indigo-200 bg-indigo-50 shadow-sm" : "border-stone-200 bg-white hover:bg-stone-50"
                }`}
              >
                <p className={`text-xl font-bold ${i === level ? "text-indigo-600" : "text-stone-400"}`}>{i + 1}</p>
                <p className="text-xs font-medium mt-0.5 leading-tight text-stone-500">{label}</p>
              </button>
            ))}
          </section>

          {/* How to use */}
          <section className="rounded-xl bg-indigo-50 border border-indigo-100 px-5 py-4">
            <p className="text-sm font-semibold text-indigo-800 mb-1">How to use</p>
            <ol className="text-sm text-indigo-700 space-y-1 list-decimal list-inside">
              <li>Select your division, week, and Bible version above.</li>
              <li>Set the slider to Level 1 and read the full verse until comfortable.</li>
              <li>Advance the slider — words from the beginning are replaced by letter slots.</li>
              <li>Click any slot and type — each letter turns <span className="text-blue-600 font-semibold">blue</span> if correct or <span className="text-red-600 font-semibold">red</span> if wrong. Typing overwrites the slot at the cursor.</li>
              <li>Use ← → arrows or Space to navigate freely across all slots. Backspace deletes and crosses word boundaries.</li>
              <li>Hold <strong>Peek</strong> to see the full verse without losing progress.</li>
            </ol>
          </section>
        </main>

        <footer className="border-t border-stone-200 py-6 text-center">
          <p className="text-xs text-stone-400">
            Bible Bee Scripture Memorization &mdash; built with love for God&apos;s Word
          </p>
        </footer>
      </div>
    </>
  );
}
