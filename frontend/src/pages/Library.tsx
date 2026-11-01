import { useEffect, useMemo, useState } from "react";
import { CodeView } from "../components/source/CodeView";
import { archiveUrl, listSources, readSource } from "../services/api";
import type { SourceContent, SourceFile } from "../types";

export function Library() {
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [active, setActive] = useState<string>("aes");
  const [content, setContent] = useState<SourceContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listSources()
      .then((body) => setFiles(body.files))
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!active) return;
    void readSource(active)
      .then(setContent)
      .catch((err: Error) => setError(err.message));
  }, [active]);

  const groups = useMemo(() => {
    const map = new Map<string, SourceFile[]>();
    for (const file of files) {
      const list = map.get(file.category) ?? [];
      list.push(file);
      map.set(file.category, list);
    }
    return [...map.entries()];
  }, [files]);

  return (
    <main className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-5 md:grid-cols-[280px_1fr] md:gap-8 md:px-8 md:py-8">
      <aside>
        <p className="font-mono text-[10px] tracking-[0.16em] text-ink-soft uppercase">
          Code exécuté
        </p>
        <h2 className="font-display text-3xl">Bibliothèque</h2>
        <p className="mt-3 text-sm text-ink-soft">
          Les fichiers affichés sont ceux du moteur Python, sans extrait fictif.
        </p>
        <a
          href={archiveUrl()}
          className="mt-4 inline-block border border-ink px-3 py-2 text-sm"
        >
          Télécharger le moteur (ZIP)
        </a>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <nav className="mt-6 flex gap-4 overflow-x-auto pb-2 md:block md:space-y-4 md:overflow-visible md:pb-0">
          {groups.map(([category, items]) => (
            <div key={category} className="shrink-0 md:shrink">
              <p className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
                {category}
              </p>
              <ul className="mt-1 flex gap-3 md:block md:space-y-1">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActive(item.id)}
                      className={`inline-flex min-h-11 items-center text-left text-sm ${
                        active === item.id ? "text-ink" : "text-ink-soft"
                      }`}
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      {content ? (
        <CodeView content={content.content} title={content.title} fileId={content.id} />
      ) : (
        <p className="text-ink-soft">Chargement du source…</p>
      )}
    </main>
  );
}
