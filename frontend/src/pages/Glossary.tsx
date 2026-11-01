import { useEffect, useState } from "react";
import { glossary } from "../services/api";
import type { GlossaryTerm } from "../types";

export function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void glossary()
      .then(setTerms)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-5 md:px-8 md:py-8">
      <p className="font-mono text-[10px] tracking-[0.16em] text-ink-soft uppercase">
        Lexique
      </p>
      <h2 className="font-display text-3xl md:text-4xl">Notions</h2>
      <p className="mt-3 text-ink-soft">
        Ces textes détaillent ce que le studio montre au moment où chaque notion apparaît.
      </p>
      {error && <p className="mt-4 text-danger">{error}</p>}
      <ol className="mt-10 space-y-10">
        {terms.map((term, index) => (
          <li key={term.id} id={term.id} className="border-t border-rule pt-5">
            <p className="font-mono text-[10px] text-ink-soft">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="font-display text-2xl">{term.title}</h3>
            <p className="mt-2 italic text-ink-soft">{term.summary}</p>
            <p className="mt-3">{term.detail}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
