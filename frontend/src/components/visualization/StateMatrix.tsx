import { AnimatePresence, motion } from "framer-motion";

export function StateMatrix({
  before,
  after,
  label,
}: {
  before?: string[][] | null;
  after?: string[][] | null;
  label: string;
}) {
  const grid = after ?? before;
  if (!grid) {
    return (
      <div className="border border-white/10 px-3 py-6 text-sm text-well-mute">
        Aucune matrice 4×4 à cette étape.
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-well-mute uppercase">
        {label}
      </p>
      <div className="grid grid-cols-4 gap-px bg-white/10">
        {grid.map((row, r) =>
          row.map((cell, c) => {
            const previous = before?.[r]?.[c];
            const changed = previous !== undefined && previous !== cell;
            return (
              <AnimatePresence key={`${r}-${c}-${cell}`}>
                <motion.div
                  layout
                  className={`matrix-cell flex h-11 items-center justify-center font-mono text-[13px] ${
                    changed ? "bg-[#3a2a20] text-[#f0d7b8]" : "bg-[#161b20] text-well-ink"
                  }`}
                >
                  {cell}
                </motion.div>
              </AnimatePresence>
            );
          }),
        )}
      </div>
    </div>
  );
}
