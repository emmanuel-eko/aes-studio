import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { TraceStep } from "../../types";

const ROUND_OPS = new Set([
  "AES.input",
  "SubBytes",
  "ShiftRows",
  "MixColumns",
  "AddRoundKey",
  "InvSubBytes",
  "InvShiftRows",
  "InvMixColumns",
]);

const HINTS: Record<string, string> = {
  "AES.input":
    "Les 16 octets entrent dans la grille colonne par colonne : d’abord la colonne de gauche, de haut en bas.",
  SubBytes: "Chaque case est remplacée par la S-box. Rien ne se déplace : seule la valeur change.",
  InvSubBytes: "Chaque case passe par la S-box inverse, pour annuler SubBytes.",
  ShiftRows:
    "La ligne 0 ne bouge pas. La ligne 1 glisse d’une case vers la gauche, la ligne 2 de deux, la ligne 3 de trois.",
  InvShiftRows: "Les lignes glissent vers la droite — une, deux ou trois cases — pour annuler ShiftRows.",
  MixColumns: "Chaque colonne est mélangée toute entière. Les quatre cases d’une colonne changent ensemble.",
  InvMixColumns: "Chaque colonne est mélangée avec la matrice inverse, pour annuler MixColumns.",
  AddRoundKey: "Chaque case est combinée par XOR avec l’octet correspondant de la clé de tour.",
};

export function isAesRoundOp(operation: string): boolean {
  return ROUND_OPS.has(operation);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clone(grid: string[][]): string[][] {
  return grid.map((row) => row.slice());
}

function blankGrid(): string[][] {
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => "··"));
}

function keyMatrix(hex: unknown): string[][] | null {
  if (typeof hex !== "string") return null;
  const clean = hex.replace(/\s+/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(clean)) return null;
  const bytes = clean.match(/../g);
  if (!bytes) return null;
  return Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => bytes[row + 4 * col]),
  );
}

function cellTone(hot: boolean, changed: boolean): string {
  if (hot) return "bg-[#c4a36a] text-[#1a1814]";
  if (changed) return "bg-[#3a2a20] text-[#f0d7b8]";
  return "bg-[#161b20] text-well-ink";
}

function shiftMarks(inverse: boolean): string[] {
  return [0, 1, 2, 3].map((row) => (row === 0 ? "fixe" : inverse ? `→ ${row}` : `← ${row}`));
}

function StaticGrid({
  grid,
  origin,
  hotKey,
  hotColumn,
  rowMarks,
}: {
  grid: string[][];
  origin?: string[][] | null;
  hotKey?: string | null;
  hotColumn?: number | null;
  rowMarks?: string[] | null;
}) {
  return (
    <div className={rowMarks ? "w-[20rem] sm:w-[26rem] md:w-[30rem]" : "w-[18rem] sm:w-[24rem] md:w-[28rem]"}>
      <div className={`mb-1 grid grid-cols-4 ${rowMarks ? "pl-14" : "pl-9"}`}>
        {[0, 1, 2, 3].map((col) => (
          <span key={col} className="text-center font-mono text-[11px] text-well-mute">
            {col}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {grid.map((row, r) => (
          <div key={r} className="flex items-center gap-2">
            <span className={`font-mono text-[11px] ${rowMarks ? "w-10 text-[#f0d7b8]" : "w-7 text-well-mute"}`}>
              {rowMarks ? rowMarks[r] : r}
            </span>
            <div className="grid flex-1 grid-cols-4 gap-1">
              {row.map((cell, c) => {
                const hot = hotKey === `${r}-${c}` || hotColumn === c;
                const changed = origin ? origin[r]?.[c] !== cell : false;
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`matrix-cell flex h-12 items-center justify-center font-mono text-lg sm:h-14 sm:text-xl md:h-16 md:text-2xl ${cellTone(hot, changed)}`}
                  >
                    {cell}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-well-mute uppercase">
        Lignes 0–3 · colonnes 0–3
      </p>
    </div>
  );
}

function RevealBoard({
  after,
  playKey,
  stepDurationMs,
  columnMajor,
  origin,
}: {
  after: string[][];
  playKey: string;
  stepDurationMs: number;
  columnMajor: boolean;
  origin: string[][] | null;
}) {
  const [grid, setGrid] = useState(origin ?? blankGrid());
  const [hotKey, setHotKey] = useState<string | null>(null);
  const [hotColumn, setHotColumn] = useState<number | null>(null);

  useEffect(() => {
    const order: [number, number][] = [];
    if (columnMajor) {
      for (let c = 0; c < 4; c += 1) {
        for (let r = 0; r < 4; r += 1) order.push([r, c]);
      }
    } else {
      for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 4; c += 1) order.push([r, c]);
      }
    }
    const start = origin ? clone(origin) : blankGrid();
    if (prefersReducedMotion()) {
      setGrid(clone(after));
      setHotKey(null);
      setHotColumn(null);
      return;
    }
    setGrid(start);
    let index = 0;
    const delay = Math.max(48, (stepDurationMs * 0.78) / order.length);
    const timer = window.setInterval(() => {
      if (index >= order.length) {
        window.clearInterval(timer);
        setHotKey(null);
        setHotColumn(null);
        setGrid(clone(after));
        return;
      }
      const [r, c] = order[index];
      setHotKey(`${r}-${c}`);
      setHotColumn(null);
      setGrid((prev) => {
        const next = clone(prev);
        next[r][c] = after[r][c];
        return next;
      });
      index += 1;
    }, delay);
    return () => window.clearInterval(timer);
  }, [after, columnMajor, origin, playKey, stepDurationMs]);

  return <StaticGrid grid={grid} origin={origin} hotKey={hotKey} hotColumn={hotColumn} />;
}

function ColumnBoard({
  before,
  after,
  playKey,
  stepDurationMs,
}: {
  before: string[][];
  after: string[][];
  playKey: string;
  stepDurationMs: number;
}) {
  const [grid, setGrid] = useState(before);
  const [hotColumn, setHotColumn] = useState<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setGrid(clone(after));
      setHotColumn(null);
      return;
    }
    setGrid(clone(before));
    let column = 0;
    const delay = Math.max(140, (stepDurationMs * 0.78) / 4);
    const timer = window.setInterval(() => {
      if (column >= 4) {
        window.clearInterval(timer);
        setHotColumn(null);
        setGrid(clone(after));
        return;
      }
      const current = column;
      setHotColumn(current);
      setGrid((prev) => {
        const next = clone(prev);
        for (let row = 0; row < 4; row += 1) next[row][current] = after[row][current];
        return next;
      });
      column += 1;
    }, delay);
    return () => window.clearInterval(timer);
  }, [after, before, playKey, stepDurationMs]);

  return <StaticGrid grid={grid} origin={before} hotColumn={hotColumn} />;
}

function ShiftBoard({
  before,
  after,
  inverse,
  playKey,
  stepDurationMs,
}: {
  before: string[][];
  after: string[][];
  inverse: boolean;
  playKey: string;
  stepDurationMs: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(0);
  const [run, setRun] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const update = () => setCell(node.clientWidth / 4);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (cell <= 0) return;
    if (prefersReducedMotion()) {
      setDone(true);
      setRun(false);
      return;
    }
    setDone(false);
    setRun(false);
    const durationMs = Math.min(1100, stepDurationMs * 0.7);
    const runId = window.setTimeout(() => setRun(true), 40);
    const doneId = window.setTimeout(() => setDone(true), 60 + durationMs);
    return () => {
      window.clearTimeout(runId);
      window.clearTimeout(doneId);
    };
  }, [cell, playKey, stepDurationMs]);

  if (done) return <StaticGrid grid={after} origin={before} rowMarks={shiftMarks(inverse)} />;

  const duration = Math.min(1.1, (stepDurationMs / 1000) * 0.7);

  return (
    <div>
      <div className="mb-1 grid w-[18rem] grid-cols-4 pl-14 sm:w-[24rem] md:w-[28rem]">
        {[0, 1, 2, 3].map((col) => (
          <span key={col} className="text-center font-mono text-[11px] text-well-mute">
            {col}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {before.map((row, r) => {
          const startOffset = inverse ? 4 : 0;
          const endOffset = inverse ? 4 - r : r;
          const offset = run ? endOffset : startOffset;
          const arrow = r === 0 ? "fixe" : inverse ? `→ ${r}` : `← ${r}`;
          return (
            <div key={r} className="flex items-center gap-2">
              <span className="w-12 font-mono text-[11px] text-[#f0d7b8]">{arrow}</span>
              <div
                ref={r === 0 ? viewport : undefined}
                className="w-[18rem] overflow-hidden border border-white/10 sm:w-[24rem] md:w-[28rem]"
              >
                <motion.div
                  className="flex w-[200%]"
                  initial={false}
                  animate={{ x: -offset * cell }}
                  transition={{ duration: run ? duration : 0, ease: "easeInOut" }}
                >
                  {[...row, ...row].map((value, index) => (
                    <div
                      key={`${r}-${index}`}
                      className="matrix-cell box-border flex w-[12.5%] shrink-0 items-center justify-center border border-white/15 bg-[#161b20] font-mono text-lg text-well-ink sm:text-xl md:text-2xl"
                      style={{ height: cell || 56 }}
                    >
                      {value}
                    </div>
                  ))}
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-well-mute uppercase">
        {inverse ? "Décalage vers la droite" : "Décalage vers la gauche"}
      </p>
    </div>
  );
}

function Board({
  before,
  after,
  operation,
  playKey,
  stepDurationMs,
}: {
  before: string[][];
  after: string[][];
  operation: string;
  playKey: string;
  stepDurationMs: number;
}) {
  if (operation === "ShiftRows" || operation === "InvShiftRows") {
    return (
      <ShiftBoard
        before={before}
        after={after}
        inverse={operation === "InvShiftRows"}
        playKey={playKey}
        stepDurationMs={stepDurationMs}
      />
    );
  }
  if (operation === "MixColumns" || operation === "InvMixColumns") {
    return (
      <ColumnBoard before={before} after={after} playKey={playKey} stepDurationMs={stepDurationMs} />
    );
  }
  if (operation === "AES.input") {
    return (
      <RevealBoard
        after={after}
        origin={null}
        columnMajor
        playKey={playKey}
        stepDurationMs={stepDurationMs}
      />
    );
  }
  return (
    <RevealBoard
      after={after}
      origin={before}
      columnMajor={false}
      playKey={playKey}
      stepDurationMs={stepDurationMs}
    />
  );
}

export function AesRoundStage({
  step,
  stepDurationMs,
}: {
  step: TraceStep;
  stepDurationMs: number;
}) {
  const before = step.state_before;
  const after = step.state_after;
  const playKey = `${step.index}-${step.operation}-${step.phase}-${step.round_number ?? "x"}`;

  useEffect(() => {
    document.getElementById("aes-round-stage")?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
    });
  }, [playKey]);

  if (!before || !after) return null;

  const lastRound = step.round_number === 10 && step.operation === "SubBytes";
  const hint = lastRound
    ? "Dernier tour : SubBytes, puis ShiftRows, puis AddRoundKey. Il n’y a pas de MixColumns."
    : (HINTS[step.operation] ?? step.explanation);
  const roundKey = step.operation === "AddRoundKey" ? keyMatrix(step.intermediates.round_key) : null;

  return (
    <div id="aes-round-stage" className="space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-well-mute uppercase">
            {step.operation === "AES.input"
              ? "Entrée du bloc"
              : step.round_number === null
                ? "Matrice d’état"
                : `Tour ${step.round_number} / 10`}
          </p>
          <h3 className="font-display text-3xl leading-none text-well-ink md:text-5xl">{step.title}</h3>
        </div>
        <p className="max-w-xl text-base leading-snug text-well-ink md:text-lg">{hint}</p>
      </div>
      <div className="flex flex-wrap items-start gap-8">
        <Board
          before={before}
          after={after}
          operation={step.operation}
          playKey={playKey}
          stepDurationMs={stepDurationMs}
        />
        {roundKey && (
          <div>
            <p className="mb-2 font-mono text-[11px] tracking-[0.16em] text-well-mute uppercase">
              Clé de tour · XOR
            </p>
            <StaticGrid grid={roundKey} />
          </div>
        )}
      </div>
    </div>
  );
}
