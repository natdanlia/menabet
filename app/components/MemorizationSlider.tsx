"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { BookOpen, RotateCcw, Eye, EyeOff, PartyPopper } from "lucide-react";
import versesData from "@/data/verses.json";

type Division = keyof typeof versesData;
type BibleVersion = "esv" | "kjv" | "nkjv" | "nasb" | "niv";
type PassageType = "navigate" | "explore";

interface PassageData {
  reference: string;
  esv: string;
  kjv: string;
  nkjv: string;
  nasb: string;
  niv: string;
}

interface UnitData {
  navigate: PassageData;
  explore?: PassageData;
}

const DIVISIONS: { value: Division; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "primary",  label: "Primary" },
  { value: "junior",   label: "Junior" },
  { value: "senior",   label: "Senior" },
];

const VERSIONS: { value: BibleVersion; label: string }[] = [
  { value: "esv",  label: "ESV" },
  { value: "kjv",  label: "KJV" },
  { value: "nkjv", label: "NKJV" },
  { value: "nasb", label: "NASB" },
  { value: "niv",  label: "NIV" },
];

const LEVEL_LABELS = ["Full Text", "25% Hidden", "50% Hidden", "75% Hidden", "100% Hidden"];
const LEVEL_COLORS = ["bg-emerald-500", "bg-teal-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500"];

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
  const [focused, setFocused]     = useState(false);
  const [cursorPos, setCursorPos] = useState(0);

  const slots = (value + " ".repeat(correct.length)).slice(0, correct.length);

  const slotsRef   = useRef(slots);   slotsRef.current   = slots;
  const cursorRef  = useRef(cursorPos); cursorRef.current = cursorPos;
  const correctLen = correct.length;

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const onIn  = () => setFocused(true);
    const onOut = () => setFocused(false);
    el.addEventListener("focus", onIn);
    el.addEventListener("blur",  onOut);
    return () => { el.removeEventListener("focus", onIn); el.removeEventListener("blur", onOut); };
  }, []);

  const focusAt = useCallback((pos: number) => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    setTimeout(() => { el.setSelectionRange(pos, pos); setCursorPos(pos); }, 0);
  }, []);

  useEffect(() => { registerFocusAt(focusAt); }, [registerFocusAt, focusAt]);

  const moveCursor = useCallback((pos: number) => {
    inputRef.current?.setSelectionRange(pos, pos);
    setCursorPos(pos);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const pos = cursorRef.current;
      const s   = slotsRef.current;

      if (e.key === " ") {
        e.preventDefault();
        if (!s.includes(" ")) { onArrowNext(); return; }
        const next = pos + 1;
        if (next > correctLen) { onArrowNext(); } else { moveCursor(next); }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (pos > 0) { moveCursor(pos - 1); } else { onArrowPrev(); }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (pos < correctLen) { moveCursor(pos + 1); } else { onArrowNext(); }
        return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        if (pos > 0) {
          onChange(s.slice(0, pos - 1) + " " + s.slice(pos));
          moveCursor(pos - 1);
        } else { onBackspacePrev(); }
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        if (pos < correctLen) onChange(s.slice(0, pos) + " " + s.slice(pos + 1));
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (pos >= correctLen) return;
        const newSlots = s.slice(0, pos) + e.key + s.slice(pos + 1);
        onChange(newSlots);
        moveCursor(Math.min(pos + 1, correctLen));
        return;
      }
    },
    [correctLen, onChange, onComplete, onBackspacePrev, onArrowPrev, onArrowNext, moveCursor]
  );

  const letters = correct.split("");

  return (
    <span style={{ display: "inline-block", verticalAlign: "baseline", whiteSpace: "nowrap" }}>
      {letters.map((char, i) => {
        const typed     = slots[i];
        const empty     = typed === " ";
        const isCorrect = !empty && typed.toLowerCase() === char.toLowerCase();
        const isWrong   = !empty && !isCorrect;
        const color = isCorrect ? "#2563eb" : isWrong ? "#dc2626" : "#9ca3af";

        return (
          <Fragment key={i}>
            {focused && cursorPos === i && <Caret />}
            <span
              onMouseDown={(e) => { e.preventDefault(); focusAt(i); }}
              style={{
                display: "inline-block",
                verticalAlign: "baseline",
                fontFamily: MONO,
                width: "1ch",
                textAlign: "center",
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
      {focused && cursorPos === correct.length && <Caret />}

      <input
        ref={(el) => { inputRef.current = el; registerRef(el); }}
        type="text"
        value={slots}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onFocus={(e) => { setCursorPos(e.target.selectionStart ?? slots.length); }}
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
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <svg className="h-4 w-4 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function MemorizationSlider() {
  const [division, setDivision]         = useState<Division>("senior");
  const [selectedPassage, setSelected]  = useState<string>("1-navigate");
  const [version, setVersion]           = useState<BibleVersion>("esv");
  const [level, setLevel]               = useState<number>(0);
  const [isRevealing, setIsRevealing]   = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [userInputs, setUserInputs]     = useState<Record<number, string>>({});
  const [celebrated, setCelebrated]     = useState(false);

  const inputRefs   = useRef<Record<number, HTMLInputElement | null>>({});
  const focusAtRefs = useRef<Record<number, (pos: number) => void>>({});

  useEffect(() => {
    setMounted(true);
    try {
      const prefs = JSON.parse(localStorage.getItem("bibleBeePrefs") ?? "{}");
      if (prefs.division) setDivision(prefs.division);
      if (prefs.passage)  setSelected(prefs.passage);
      if (prefs.version)  setVersion(prefs.version);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("bibleBeePrefs", JSON.stringify({ division, passage: selectedPassage, version }));
  }, [division, selectedPassage, version, mounted]);

  // ── Derive unit + passageType from "1-navigate" style key ────────────────
  const [unitStr, passageType] = selectedPassage.split("-") as [string, PassageType];
  const divisionData = versesData[division] as Record<string, UnitData>;
  const units        = Object.keys(divisionData).sort((a, b) => Number(a) - Number(b));
  const activeUnit   = units.includes(unitStr) ? unitStr : units[0];
  const unitData     = divisionData[activeUnit];
  const passageData  = (passageType === "explore" && unitData.explore)
    ? unitData.explore
    : unitData.navigate;

  const verseText = passageData[version];
  const reference = passageData.reference;

  // ── Passage dropdown options ──────────────────────────────────────────────
  const passageOptions = units.flatMap((u) => {
    const ud = divisionData[u];
    const opts = [{ value: `${u}-navigate`, label: `Unit ${u} — ${ud.navigate.reference} (Navigate)` }];
    if (ud.explore) opts.push({ value: `${u}-explore`, label: `Unit ${u} — ${ud.explore.reference} (Explore)` });
    return opts;
  });

  // Normalize selectedPassage in case division changed and old key is invalid
  const activePassage = passageOptions.find((o) => o.value === selectedPassage)
    ? selectedPassage
    : passageOptions[0]?.value ?? "1-navigate";

  const tokens    = verseText ? verseText.split(" ") : [];
  const cutoff    = getCutoff(tokens.length, level);
  const hiddenSet = new Set<number>(Array.from({ length: cutoff }, (_, i) => i));
  const hiddenList = [...hiddenSet].sort((a, b) => a - b);

  const wordCorrect = useCallback(
    (idx: number) => {
      const { core } = splitToken(tokens[idx]);
      const typed = (userInputs[idx] ?? "").padEnd(core.length, " ");
      return typed.split("").every((ch, ci) => ch !== " " && ch.toLowerCase() === core[ci].toLowerCase());
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
    const div = v as Division;
    setDivision(div);
    setLevel(0);
    resetInputs();
    // Jump to first passage of new division
    const ud = versesData[div] as Record<string, UnitData>;
    const firstUnit = Object.keys(ud).sort((a, b) => Number(a) - Number(b))[0];
    setSelected(`${firstUnit}-navigate`);
  }, [resetInputs]);

  const handlePassageChange  = useCallback((v: string) => { setSelected(v); setLevel(0); resetInputs(); }, [resetInputs]);
  const handleVersionChange  = useCallback((v: string) => { setVersion(v as BibleVersion); setLevel(0); resetInputs(); }, [resetInputs]);
  const handleLevelChange    = useCallback((l: number) => { setLevel(l); resetInputs(); }, [resetInputs]);
  const handleWordInput      = useCallback((index: number, value: string) => {
    setUserInputs((prev) => ({ ...prev, [index]: value }));
    setCelebrated(false);
  }, []);

  const handleArrowNext = useCallback(
    (index: number) => {
      const pos  = hiddenList.indexOf(index);
      const next = hiddenList[pos + 1];
      if (next !== undefined) setTimeout(() => focusAtRefs.current[next]?.(0), 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenList.join(",")]
  );

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

  const passageLabel = passageType === "explore"
    ? "Explore Memory Passage"
    : "Navigate Memory Passage";

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
            <SelectField label="Division"      value={division}      onChange={handleDivisionChange} options={DIVISIONS} />
            <SelectField label="Unit & Passage" value={activePassage} onChange={handlePassageChange}  options={passageOptions} />
            <SelectField label="Bible Version" value={version}       onChange={handleVersionChange}  options={VERSIONS} />
          </section>

          {/* Erasure Level */}
          <section className="rounded-2xl border border-stone-200 bg-white shadow-sm px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-stone-600">
                Level {level + 1} — <span className="text-indigo-600">{LEVEL_LABELS[level]}</span>
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleLevelChange(0)}
                  className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 transition"
                >
                  <RotateCcw className="h-3 w-3" />
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
                    "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition select-none",
                    level === 0
                      ? "border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed"
                      : isRevealing
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100",
                  ].join(" ")}
                >
                  {isRevealing ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  Peek
                </button>
              </div>
            </div>

            <div className="flex gap-1 mb-1.5">
              {[0, 1, 2, 3, 4].map((l) => (
                <button
                  key={l}
                  onClick={() => handleLevelChange(l)}
                  className={`flex-1 h-1.5 rounded-full transition-all duration-200 ${
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
              {[
                { n: 1, label: "Full text" },
                { n: 2, label: "25% hidden" },
                { n: 3, label: "50% hidden" },
                { n: 4, label: "75% hidden" },
                { n: 5, label: "All hidden" },
              ].map(({ n, label }, i) => (
                <button
                  key={i}
                  onClick={() => handleLevelChange(i)}
                  className={`flex flex-col items-center gap-0.5 transition ${
                    i === level ? "text-indigo-600" : "text-stone-400 hover:text-stone-600"
                  }`}
                >
                  <span className={`text-xs font-bold ${i === level ? "" : ""}`}>{n}</span>
                  <span className="text-[9px] leading-tight text-center whitespace-nowrap">{label}</span>
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
                  {VERSIONS.find((v) => v.value === version)?.label} · {passageLabel}
                </p>
                <p className="text-lg font-semibold text-stone-800 mt-0.5">{reference}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-400">Unit</p>
                <p className="text-2xl font-bold text-indigo-600">{activeUnit}</p>
              </div>
            </div>

            <div className="px-6 py-8">
              {verseText ? (
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
              ) : (
                <p className="text-stone-400 italic text-sm">
                  Passage text not yet provided for this division. Please add it to data/verses.json.
                </p>
              )}

              {verseText && hiddenSet.size > 0 && (
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

          {/* How to use */}
          <section className="rounded-xl bg-indigo-50 border border-indigo-100 px-5 py-4">
            <p className="text-sm font-semibold text-indigo-800 mb-1">How to use</p>
            <ol className="text-sm text-indigo-700 space-y-1 list-decimal list-inside">
              <li>Select your division, unit &amp; passage, and Bible version above.</li>
              <li>Set the slider to Level 1 and read the full passage until comfortable.</li>
              <li>Advance the slider — words from the beginning are replaced by letter slots.</li>
              <li>Click any slot and type — each letter turns <span className="text-blue-600 font-semibold">blue</span> if correct or <span className="text-red-600 font-semibold">red</span> if wrong.</li>
              <li>Press <strong>Space</strong> after a completed word to advance. Use ← → arrows to navigate freely.</li>
              <li>Hold <strong>Peek</strong> to see the full passage without losing progress.</li>
            </ol>
          </section>
        </main>

        <footer className="border-t border-stone-200 py-6 text-center">
          <p className="text-xs text-stone-400">
            National Bible Bee · Scripture Memorization Tool
          </p>
        </footer>
      </div>
    </>
  );
}
