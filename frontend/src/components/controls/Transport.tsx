import type { CombinedStep, Simulation } from "../../hooks/useSimulation";

const btn = "min-h-11 flex-1 border px-3 py-2 text-sm disabled:opacity-40 sm:min-h-0 sm:flex-none sm:py-1.5";

function progressLabel(steps: CombinedStep[], stepIndex: number): string {
  if (steps.length === 0) return "Aucune trace";
  const encryptCount = steps.filter((step) => step.lane === "encrypt").length;
  const current = steps[stepIndex];
  if (current?.lane === "decrypt") {
    const decryptCount = steps.length - encryptCount;
    const position = stepIndex - encryptCount + 1;
    return `Déchiffrement · ${position} / ${decryptCount}`;
  }
  const within = Math.min(stepIndex + 1, Math.max(encryptCount, 1));
  return `Chiffrement · ${within} / ${Math.max(encryptCount, 1)}`;
}

export function Transport({ sim }: { sim: Simulation }) {
  const total = sim.steps.length;
  const atStart = sim.stepIndex <= 0;
  const atEnd = total === 0 || sim.stepIndex >= total - 1;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4 sm:gap-3">
      <button
        type="button"
        className={`${btn} border-rule`}
        onClick={() => {
          sim.setPlaying(false);
          sim.setStepIndex(0);
        }}
        disabled={total === 0}
      >
        Réinitialiser
      </button>
      <button
        type="button"
        className={`${btn} border-rule`}
        onClick={() => {
          sim.setPlaying(false);
          sim.setStepIndex(Math.max(0, sim.stepIndex - 1));
        }}
        disabled={atStart}
      >
        Précédent
      </button>
      <button
        type="button"
        className={`${btn} border-ink bg-ink text-paper`}
        onClick={() => sim.setPlaying(!sim.playing)}
        disabled={total === 0}
      >
        {sim.playing ? "Pause" : "Lecture"}
      </button>
      <button
        type="button"
        className={`${btn} border-rule`}
        onClick={() => {
          sim.setPlaying(false);
          sim.setStepIndex(Math.min(total - 1, sim.stepIndex + 1));
        }}
        disabled={atEnd}
      >
        Suivant
      </button>
      <button type="button" className={`${btn} border-rule font-mono text-xs`} onClick={sim.cycleSpeed}>
        ×{sim.speed}
      </button>
      <p className="w-full font-mono text-[11px] text-ink-soft sm:ml-auto sm:w-auto">
        {progressLabel(sim.steps, sim.stepIndex)}
      </p>
    </div>
  );
}
