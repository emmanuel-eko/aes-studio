type Tone = "alice" | "bob" | "oscar" | "system";

export interface Bubble {
  id: string;
  from: Tone;
  body: string;
  meta?: string;
}

const TONE: Record<Tone, string> = {
  alice: "border-alice/40 bg-bubble-alice",
  bob: "border-bob/40 bg-bubble-bob",
  oscar: "border-oscar/40 bg-bubble-oscar",
  system: "border-rule bg-transparent text-ink-soft",
};

export function Thread({ bubbles }: { bubbles: Bubble[] }) {
  if (bubbles.length === 0) {
    return (
      <p className="border border-dashed border-rule px-3 py-6 text-sm text-ink-soft">
        Aucun message pour l’instant.
      </p>
    );
  }
  return (
    <ol className="min-w-0 space-y-3">
      {bubbles.map((bubble) => (
        <li key={bubble.id} className={`min-w-0 overflow-hidden border px-3 py-2 ${TONE[bubble.from]}`}>
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
            {bubble.from}
            {bubble.meta ? ` · ${bubble.meta}` : ""}
          </p>
          <p className="mt-1 max-w-full overflow-hidden break-all whitespace-pre-wrap font-mono text-[13px] leading-relaxed [overflow-wrap:anywhere]">
            {bubble.body}
          </p>
        </li>
      ))}
    </ol>
  );
}
