import type { Simulation } from "../../hooks/useSimulation";

const btn = "min-h-11 flex-1 border px-3 py-2 text-sm disabled:opacity-40 sm:min-h-0 sm:flex-none sm:py-1.5";

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
        className={`${btn} border-ink bg-ink text-chalk`}
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
        {total === 0 ? "Aucune trace" : `${sim.stepIndex + 1} / ${total}`}
      </p>
    </div>
  );
}
