"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GoalMode = "maximum" | "minimum";
type Stats = {
  words: number;
  characters: number;
  noSpaces: number;
  sentences: number;
  paragraphs: number;
  readingMinutes: number;
};

const DRAFT_KEY = "clearcount:draft:v2";
const DRAFT_ENABLED_KEY = "clearcount:draft-enabled:v2";
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const SAMPLE =
  "Clear writing starts with a clear goal. Paste your essay here, set a word limit, and track your progress as you write. You can select a sentence or paragraph to count only that part of your text. By the way, I want to talk with Nailao, I love you.";

// Intl.Segmenter handles words in languages that don't use spaces (e.g. Chinese).
// Character counting uses Unicode code points (emoji sequences may count as multiple code points).
function countWords(input: string): number {
  if (!input.trim()) return 0;
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
    let count = 0;
    for (const token of segmenter.segment(input)) {
      if (token.isWordLike) count += 1;
    }
    return count;
  }
  return (input.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

function getStats(input: string): Stats {
  const words = countWords(input);
  const trimmed = input.trim();
  const paragraphs = trimmed
    ? trimmed.split(/(?:\r?\n\s*){2,}/).filter((part) => part.trim()).length
    : 0;
  // An estimated sentence count; sentence boundaries differ across languages.
  const sentences = trimmed
    ? (trimmed.match(/[^.!?。！？\n]+(?:[.!?。！？]+|(?=\n|$))/g) ?? [])
        .filter((part) => part.trim()).length
    : 0;
  return {
    words,
    characters: Array.from(input).length,
    noSpaces: Array.from(input.replace(/\s/gu, "")).length,
    sentences,
    paragraphs,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.ceil(words / 200)),
  };
}

function formatReadTime(minutes: number): string {
  return minutes === 0 ? "0 min" : `${minutes} min`;
}

export default function Home() {
  const [text, setText] = useState("");
  const [showGoal, setShowGoal] = useState(false);
  const [goalMode, setGoalMode] = useState<GoalMode>("maximum");
  const [goalInput, setGoalInput] = useState("500");
  const [selectedText, setSelectedText] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftDirtyRef = useRef(false);
  const [storageReady, setStorageReady] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [fileMessage, setFileMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [speechRateInput, setSpeechRateInput] = useState("130");

  useEffect(() => {
    try {
      const enabled = window.localStorage.getItem(DRAFT_ENABLED_KEY) === "true";
      setAutoSave(enabled);
      if (enabled) {
        const saved = window.localStorage.getItem(DRAFT_KEY);
        if (saved) setPendingDraft(saved);
      }
    } catch {
      setDraftMessage("Browser storage is unavailable. Draft saving will not work here.");
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady || !autoSave || !draftDirtyRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        if (text) window.localStorage.setItem(DRAFT_KEY, text);
        else window.localStorage.removeItem(DRAFT_KEY);
        setDraftMessage(text ? "Saved on this device" : "Local draft cleared");
        draftDirtyRef.current = false;
      } catch {
        setDraftMessage("Could not save this draft (storage may be full or blocked).");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [text, autoSave, storageReady]);

  const updateText = (next: string) => {
    draftDirtyRef.current = true;
    setPendingDraft(null);
    setText(next);
    setSelectedText("");
    setCopyMessage("");
  };

  const toggleAutoSave = (enabled: boolean) => {
    if (!storageReady) return;
    try {
      if (enabled) {
        window.localStorage.setItem(DRAFT_ENABLED_KEY, "true");
        if (text) window.localStorage.setItem(DRAFT_KEY, text);
        setDraftMessage(text ? "Saved on this device" : "Local saving enabled");
      } else {
        window.localStorage.removeItem(DRAFT_KEY);
        window.localStorage.removeItem(DRAFT_ENABLED_KEY);
        setPendingDraft(null);
        setDraftMessage("Local draft deleted and saving disabled");
      }
      draftDirtyRef.current = false;
      setAutoSave(enabled);
    } catch {
      setDraftMessage("Browser storage is unavailable. Please check your browser settings.");
    }
  };

  const restoreDraft = () => {
    if (pendingDraft === null) return;
    draftDirtyRef.current = false;
    setText(pendingDraft);
    setSelectedText("");
    setPendingDraft(null);
    setDraftMessage("Local draft restored");
  };

  const discardDraft = () => {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignored */ }
    setPendingDraft(null);
    setDraftMessage("Saved draft discarded");
  };

  const deleteSavedDraft = () => {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignored */ }
    draftDirtyRef.current = false;
    setPendingDraft(null);
    setDraftMessage("Saved draft deleted. Current editor text is unchanged.");
  };

  const importTxt = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setFileMessage("Choose a TXT file smaller than 2 MB.");
      return;
    }
    if (!/\.txt$/i.test(file.name) && file.type !== "text/plain") {
      setFileMessage("Only plain-text .txt files are supported.");
      return;
    }
    try {
      const contents = await file.text();
      updateText(contents.replace(/^\uFEFF/, ""));
      setFileMessage(`Imported ${file.name}`);
    } catch {
      setFileMessage("File could not be read. Try another UTF-8 TXT file.");
    }
  };

  const exportTxt = () => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clearcount-draft.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFileMessage("TXT download started");
  };

  const speechRate = Number(speechRateInput);
  const validSpeechRate = Number.isSafeInteger(speechRate) && speechRate >= 80 && speechRate <= 240;
  const speechSeconds = validSpeechRate ? Math.ceil((countWords(text) / speechRate) * 60) : 0;

  const stats = useMemo(() => getStats(text), [text]);
  const selectionStats = useMemo(() => getStats(selectedText), [selectedText]);
  const goal = Number(goalInput);
  const validGoal = Number.isSafeInteger(goal) && goal > 0 && goal <= 1_000_000;
  const difference = validGoal ? goal - stats.words : 0;
  const goalMet = validGoal && (goalMode === "maximum" ? difference >= 0 : difference <= 0);
  const percentage = validGoal ? Math.round((stats.words / goal) * 100) : 0;

  const syncSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    setSelectedText(editor.value.slice(editor.selectionStart, editor.selectionEnd));
  }, []);

  const clearText = () => {
    updateText("");
    // Clearing the editor must also clear a locally saved draft immediately.
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* ignored */ }
    draftDirtyRef.current = false;
    setDraftMessage(autoSave ? "Local draft cleared" : "");
    editorRef.current?.focus();
  };

  const copyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Copied!");
    } catch {
      setCopyMessage("Copy failed — select the text and copy manually.");
    }
  };

  const metrics = [
    { label: "Words", value: stats.words.toLocaleString() },
    { label: "Characters", value: stats.characters.toLocaleString() },
    { label: "No Spaces", value: stats.noSpaces.toLocaleString() },
    { label: "Sentences", value: stats.sentences.toLocaleString() },
    { label: "Paragraphs", value: stats.paragraphs.toLocaleString() },
    { label: "Reading Time", value: formatReadTime(stats.readingMinutes) },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-9">
        <header className="mb-5 flex items-center justify-between gap-3">
          <a href="/" className="text-lg font-bold tracking-tight text-slate-900">ClearCount</a>
          <span className="text-xs text-slate-500">Free · Instant · Private</span>
        </header>

        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Online Word Counter, Free Forever</h1>
          <p className="mt-1 text-sm text-slate-600">Count words, check text length, and meet your writing goal instantly.</p>
        </div>

        <section aria-label="Text statistics" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-center shadow-sm">
              <div className="text-xl font-bold tabular-nums sm:text-2xl" aria-live="off">{metric.value}</div>
              <div className="mt-1 text-xs text-slate-500">{metric.label}</div>
            </div>
          ))}
        </section>

        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Writing goal">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Writing Goal <span className="font-normal text-slate-500">(optional)</span></h2>
              {!showGoal && <p className="mt-0.5 text-xs text-slate-500">Track how many words you need or have left.</p>}
            </div>
            <button type="button" aria-expanded={showGoal} aria-controls="goal-panel" onClick={() => setShowGoal((prev) => !prev)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
              {showGoal ? "Hide goal" : "Set a goal"}
            </button>
          </div>
          {showGoal && (
            <div id="goal-panel" className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
                  Goal type
                  <select value={goalMode} onChange={(e) => setGoalMode(e.target.value as GoalMode)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="maximum">Maximum words</option>
                    <option value="minimum">Minimum words</option>
                  </select>
                </label>
                <label className="flex w-36 flex-col gap-1 text-xs font-medium text-slate-600">
                  Word target
                  <input aria-invalid={!validGoal} type="number" inputMode="numeric" min={1} max={1000000} step={1} value={goalInput} onChange={(e) => setGoalInput(e.target.value)} className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <div className="flex gap-2">
                  {[250, 500, 1000].map((preset) => <button type="button" key={preset} onClick={() => setGoalInput(String(preset))} className="rounded-lg border border-slate-200 px-2 py-2 text-xs hover:bg-slate-50">{preset}</button>)}
                </div>
              </div>
              {!validGoal ? (
                <p role="alert" className="mt-3 text-sm text-rose-700">Enter a whole number between 1 and 1,000,000.</p>
              ) : (
                <div className="mt-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{stats.words.toLocaleString()} / {goal.toLocaleString()} words ({percentage}%)</span>
                    <span role="status" className={goalMet ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
                      {goalMode === "maximum" ? (difference >= 0 ? `${difference.toLocaleString()} words remaining` : `${Math.abs(difference).toLocaleString()} words over limit`) : (difference > 0 ? `${difference.toLocaleString()} more words needed` : "Goal reached")}
                    </span>
                  </div>
                  <div role="progressbar" aria-label="Writing goal progress" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(stats.words,goal)} className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-[width] ${goalMet ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, (stats.words / goal) * 100)}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{goalMode === "maximum" ? "Your text must stay at or below this number." : "Your text must reach at least this number."}</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section aria-label="Text editor" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <label htmlFor="editor" className="sr-only">Enter or paste text to count</label>
          <textarea id="editor" ref={editorRef} value={text} onChange={(e) => updateText(e.target.value)} onSelect={syncSelection} onKeyUp={syncSelection} onMouseUp={syncSelection} placeholder="Start typing or paste your text here..." spellCheck={false} className="block min-h-[320px] w-full resize-y border-0 bg-transparent p-4 text-base leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 sm:min-h-[380px] sm:p-5" />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-3 py-3 sm:px-4">
            <div aria-live="polite" className="text-xs text-slate-600">
              {selectedText ? <span>Selected: <strong>{selectionStats.words}</strong> words · <strong>{selectionStats.characters}</strong> characters</span> : <span>Select any part of your text to count it separately.</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => updateText(SAMPLE)} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">Try Sample</button>
              <button type="button" disabled={!text} onClick={copyText} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">Copy Text</button>
              <button type="button" disabled={!text} onClick={clearText} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">Clear</button>
            </div>
          </div>
          {copyMessage && <p role="status" className="px-4 pb-3 text-xs text-slate-600">{copyMessage}</p>}
        </section>

        <section aria-label="Draft and TXT file tools" className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Save draft on this device <span className="font-normal text-slate-500">(optional)</span></h2>
              <p className="mt-1 text-xs text-slate-500">Off by default. When enabled, text is stored only in this browser, not uploaded.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={autoSave} disabled={!storageReady} onChange={(e) => toggleAutoSave(e.target.checked)} className="h-4 w-4 accent-blue-600" />
              {autoSave ? "On" : "Off"}
            </label>
          </div>
          {pendingDraft !== null && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-slate-800" role="status">
              <p className="font-semibold">A saved draft was found in this browser.</p>
              <p className="mt-1 text-xs">Restore it into the editor, or discard it permanently. Restoring replaces current editor text.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={restoreDraft} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">Restore draft</button>
                <button type="button" onClick={discardDraft} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50">Discard saved draft</button>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <input ref={fileInputRef} type="file" accept=".txt,text/plain" className="sr-only" aria-label="Select a UTF-8 TXT file" onChange={(e) => { void importTxt(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">Import TXT</button>
            <button type="button" disabled={!text} onClick={exportTxt} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Download TXT</button>
            {autoSave && <button type="button" onClick={deleteSavedDraft} className="rounded-lg px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">Delete saved draft</button>}
          </div>
          {fileMessage && <p role="status" className="mt-2 text-xs text-slate-600">{fileMessage}</p>}
          {draftMessage && <p role="status" className="mt-2 text-xs text-slate-600">{draftMessage}</p>}
        </section>

        <section aria-label="Advanced statistics" className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Advanced Statistics</h2>
              {!showAdvanced && <p className="mt-1 text-xs text-slate-500">Speaking time and adjustable speaking pace.</p>}
            </div>
            <button type="button" aria-expanded={showAdvanced} aria-controls="advanced-panel" onClick={() => setShowAdvanced((prev) => !prev)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">{showAdvanced ? "Hide details" : "Show details"}</button>
          </div>
          {showAdvanced && <div id="advanced-panel" className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">Estimated Speaking Time</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{validSpeechRate ? (stats.words === 0 ? "0 sec" : `${Math.floor(speechSeconds / 60)} min ${String(speechSeconds % 60).padStart(2, "0")} sec`) : "—"}</p>
              </div>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                Speaking speed (words/minute)
                <input type="number" min={80} max={240} step={1} value={speechRateInput} aria-invalid={!validSpeechRate} onChange={(e) => setSpeechRateInput(e.target.value)} className="h-10 w-36 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </label>
            </div>
            {!validSpeechRate && <p role="alert" className="mt-2 text-xs text-rose-700">Enter a whole number between 80 and 240.</p>}
            <p className="mt-2 text-xs text-slate-500">This is an estimate based on word count and your speaking speed, not a recording. Reading Time above uses 200 words/minute.</p>
          </div>}
        </section>

        <section className="mt-8 space-y-3 text-sm leading-6 text-slate-600">
          <h2 className="text-base font-semibold text-slate-900">How it works</h2>
          <p>Type or paste your text to see the word count, character count, sentence count, paragraph count, and estimated reading time. Set a maximum or minimum writing goal to track your progress. Highlight any passage to count only your selection.</p>
          <h2 className="pt-2 text-base font-semibold text-slate-900">How does ClearCount count words?</h2>
          <p>We use your browser’s language-aware word segmentation when available. Word counts can differ from Microsoft Word or Google Docs for punctuation, hyphenated terms, Chinese text, and other languages. Characters are Unicode code points; a combined emoji can contain more than one code point. Sentence counts are estimates. Reading time assumes 200 words per minute.</p>
          <h2 className="pt-2 text-base font-semibold text-slate-900">Is my text private?</h2>
          <p>Counting runs in your browser and does not upload your text to our counting service. Draft saving is off by default. If you enable it, your text is stored in this browser on this device until you delete it or clear browser data. TXT imports and exports are handled locally. Do not use shared devices for confidential drafts.</p>
        </section>
      </div>
    </main>
  );
}
