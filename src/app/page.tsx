
"use client";

import { useMemo, useState } from "react";

const SAMPLE_TEXT =
  "Hello world. This is my first website.";

export default function Home() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const trimmed = text.trim();

    // Count words separated by whitespace.
    const words = trimmed
      ? trimmed.split(/\s+/u).length
      : 0;

    // Count Unicode code points.
    const characters = Array.from(text).length;

    // Characters excluding whitespace.
    const charactersNoSpaces = Array.from(
      text.replace(/\s/gu, "")
    ).length;

    // Approximate sentence count.
    const sentences = trimmed
      ? (
          text.match(
            /[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/gu
          ) ?? []
        ).filter((part) => part.trim()).length
      : 0;

    // Paragraphs separated by blank lines.
    const paragraphs = trimmed
      ? trimmed
          .split(/\n\s*\n/u)
          .filter((part) => part.trim()).length
      : 0;

    // Estimated reading speed: 200 WPM.
    const readingTime = words
      ? Math.max(1, Math.ceil(words / 200))
      : 0;

    return {
      words,
      characters,
      charactersNoSpaces,
      sentences,
      paragraphs,
      readingTime,
    };
  }, [text]);

  async function copyText() {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Unable to copy. Please copy manually.");
    }
  }

  function clearText() {
    setText("");
    setCopied(false);
  }

  const statCards = [
    {
      label: "Words",
      value: stats.words,
    },
    {
      label: "Characters",
      value: stats.characters,
    },
    {
      label: "No Spaces",
      value: stats.charactersNoSpaces,
    },
    {
      label: "Sentences",
      value: stats.sentences,
    },
    {
      label: "Paragraphs",
      value: stats.paragraphs,
    },
    {
      label: "Reading Time",
      value: `${stats.readingTime} min`,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">

      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">

          <span className="text-2xl font-bold tracking-tight text-blue-600">
            ClearCount
          </span>

          <span className="text-sm text-slate-500">
            Free Writing Tools
          </span>

        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-5 py-6">

        {/* Compact Title */}
        <section className="mb-5 flex flex-wrap items-center justify-between gap-3">

          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            Word Counter
          </h1>

          <p className="text-sm text-slate-500">
            Free · Instant · Private
          </p>

        </section>

        {/* Statistics - Above Editor */}
        <section
          aria-label="Text statistics"
          className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3"
        >
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >

              <p className="text-sm text-slate-500">
                {stat.label}
              </p>

              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                {stat.value}
              </p>

            </div>
          ))}
        </section>

        {/* Text Editor */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* Editor Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">

            <h2 className="font-semibold">
              Your Text
            </h2>

            <button
              type="button"
              onClick={() => setText(SAMPLE_TEXT)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Try Sample Text
            </button>

          </div>

          {/* Text Input */}
          <label
            htmlFor="text-editor"
            className="sr-only"
          >
            Text to count
          </label>

          <textarea
            id="text-editor"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setCopied(false);
            }}
            placeholder="Start typing or paste your text here..."
            spellCheck
            className="h-80 w-full resize-y p-5 text-base leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:bg-blue-50/20"
          />

          {/* Editor Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-5 py-3">

            <p className="text-xs text-slate-500">
              Your text is processed locally in your browser.
            </p>

            <div className="flex gap-3">

              <button
                type="button"
                onClick={clearText}
                disabled={!text}
                className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={copyText}
                disabled={!text}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copied ? "Copied!" : "Copy Text"}
              </button>

            </div>
          </div>

        </section>

        {/* How It Works */}
        <section className="mt-14">

          <h2 className="text-2xl font-bold">
            How It Works
          </h2>

          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Type or paste your text into the editor.
            ClearCount automatically updates your
            word count, character count, sentence count,
            paragraph count, and estimated reading time.
            No account or upload is required.
          </p>

        </section>

        {/* FAQ */}
        <section className="mt-12">

          <h2 className="text-2xl font-bold">
            Frequently Asked Questions
          </h2>

          <div className="mt-6 space-y-6">

            <div>
              <h3 className="font-semibold">
                Is ClearCount free?
              </h3>

              <p className="mt-2 text-slate-600">
                Yes. ClearCount is completely free
                and requires no registration.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                Is my text stored on a server?
              </h3>

              <p className="mt-2 text-slate-600">
                No. Text counting runs locally
                in your browser.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                How is reading time calculated?
              </h3>

              <p className="mt-2 text-slate-600">
                Reading time is estimated using
                200 words per minute and rounded
                up to the nearest whole minute.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">
                Does the tool support other languages?
              </h3>

              <p className="mt-2 text-slate-600">
                Character counting supports Unicode
                text. Word counting uses whitespace
                separation, so languages without
                spaces between words may not be
                counted accurately.
              </p>
            </div>

          </div>
        </section>

        {/* Footer */}
        <footer className="mt-14 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
          ClearCount — Free Online Writing Tools
        </footer>

      </div>
    </main>
  );
}
