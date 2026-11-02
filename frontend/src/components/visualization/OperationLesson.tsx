import { useEffect, useMemo, useState } from "react";
import type { CombinedStep, Simulation } from "../../hooks/useSimulation";
import { formatGrouped, normalizeHex, splitBytes } from "../../lib/hex";
import type { Mode } from "../../types";
import { AesRoundStage, isAesRoundOp } from "./AesRoundStage";
import { StateMatrix } from "./StateMatrix";

function asHex(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-fA-F]+$/.test(value.replace(/\s/g, ""))
    ? normalizeHex(value)
    : null;
}

function xorExplain(a: string, b: string, result: string) {
  const left = splitBytes(a);
  const right = splitBytes(b);
  const out = splitBytes(result);
  const n = Math.min(left.length, right.length, out.length);
  return Array.from({ length: n }, (_, i) => ({
    a: left[i],
    b: right[i],
    r: out[i],
    changed: left[i] !== right[i],
  }));
}

function HexRow({
  label,
  hex,
  highlight,
}: {
  label: string;
  hex: string;
  highlight?: Set<number>;
}) {
  const bytes = splitBytes(hex);
  return (
    <div className="min-w-0">
      <p className="mb-1 font-mono text-[10px] tracking-[0.14em] text-well-mute uppercase">{label}</p>
      <div className="flex flex-wrap gap-0.5">
        {bytes.map((byte, index) => (
          <span
            key={`${index}-${byte}`}
            className={`px-0.5 font-mono text-[11px] ${
              highlight?.has(index) ? "bg-[#3a2a20] text-[#f0d7b8]" : "text-well-ink"
            }`}
          >
            {byte}
          </span>
        ))}
      </div>
    </div>
  );
}

function TamperImpact({
  mode,
  original,
  tampered,
}: {
  mode: Mode;
  original: string;
  tampered: string;
}) {
  const [open, setOpen] = useState(true);
  const left = splitBytes(original);
  const right = splitBytes(tampered);
  const changed = left
    .map((byte, index) => (byte !== right[index] ? index : -1))
    .filter((index) => index >= 0);
  if (changed.length === 0) return null;
  const lesson =
    mode === "BLOC"
      ? "AES sans mode ne protège qu’un seul bloc. Un octet modifié rend tout le bloc déchiffré méconnaissable. Aucun tag ne prévient Bob."
      : mode === "CBC"
        ? "CBC déchiffre quand même. Le bloc qui contient l’octet modifié est brouillé ; le bloc suivant a exactement les mêmes bits inversés. Aucun tag n’arrête Bob."
        : mode === "CTR"
          ? "CTR déchiffre quand même. Chaque bit inversé dans le chiffré apparaît au même endroit dans le clair. C’est une modification contrôlée, sans détection."
          : "GCM refuse de montrer le clair : le tag ne correspond plus. Confidentialité et authentification sont séparées.";
  return (
    <div className="border border-white/10 p-3">
      <button type="button" className="font-mono text-[10px] tracking-[0.14em] text-well-mute uppercase" onClick={() => setOpen(!open)}>
        {open ? "−" : "+"} Conséquence d’Oscar · {changed.length} octet{changed.length > 1 ? "s" : ""} modifié{changed.length > 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-well-ink">{lesson}</p>
          <p className="font-mono text-[11px] text-well-mute">
            Positions : {changed.slice(0, 12).join(", ")}
            {changed.length > 12 ? "…" : ""}
          </p>
          <HexRow label="Chiffré d’Alice" hex={original} highlight={new Set(changed)} />
          <HexRow label="Chiffré transmis" hex={tampered} highlight={new Set(changed)} />
        </div>
      )}
    </div>
  );
}

function RecoveredDiff({ expected, recovered }: { expected: string; recovered: string }) {
  if (!recovered) return null;
  const max = Math.max(expected.length, recovered.length);
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] tracking-[0.14em] text-well-mute uppercase">
        Clair d’Alice / clair de Bob
      </p>
      <p className="font-mono text-[13px] leading-7">
        {Array.from({ length: max }, (_, i) => {
          const a = expected[i] ?? "·";
          const b = recovered[i] ?? "·";
          const same = a === b;
          return (
            <span key={i} className={same ? "text-well-ink" : "bg-[#3a2a20] text-[#f0d7b8]"} title={`Alice «${a}» → Bob «${b}»`}>
              {b}
            </span>
          );
        })}
      </p>
      <p className="mt-1 text-[12px] text-well-mute">
        Les caractères marqués diffèrent du message d’Alice. Survolez-les pour voir la paire.
      </p>
    </div>
  );
}

function XorBoard({ step }: { step: CombinedStep }) {
  const mid = step.intermediates;
  const a = asHex(mid.plaintext_block) ?? asHex(mid.input) ?? asHex(mid.before_hex);
  const b = asHex(mid.chaining_value) ?? asHex(mid.keystream) ?? asHex(mid.round_key);
  const r = asHex(mid.xor_input) ?? asHex(mid.output) ?? asHex(mid.after_hex) ?? asHex(mid.plaintext_block);
  if (!a || !b || !r) return null;
  const rows = xorExplain(a, b, r);
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] tracking-[0.14em] text-well-mute uppercase">
        XOR octet par octet — cliquez un couple
      </p>
      <XorInteractive rows={rows} />
    </div>
  );
}

function XorInteractive({
  rows,
}: {
  rows: { a: string; b: string; r: string; changed: boolean }[];
}) {
  const [focus, setFocus] = useState(0);
  const cell = rows[focus];
  return (
    <div>
      <div className="flex flex-wrap gap-0.5">
        {rows.map((row, index) => (
          <button
            key={`${index}-${row.r}`}
            type="button"
            onClick={() => setFocus(index)}
            className={`min-w-7 border px-1 py-1 font-mono text-[11px] ${
              index === focus
                ? "border-[#c4a36a] text-[#f0d7b8]"
                : "border-white/10 text-well-ink"
            }`}
          >
            {row.r}
          </button>
        ))}
      </div>
      {cell && (
        <p className="mt-3 font-mono text-[12px] text-well-ink">
          Octet {focus} : {cell.a}<sub>16</sub> ⊕ {cell.b}<sub>16</sub> = {cell.r}<sub>16</sub>
          {" · "}
          {parseInt(cell.a, 16).toString(2).padStart(8, "0")} ⊕ {parseInt(cell.b, 16).toString(2).padStart(8, "0")} ={" "}
          {parseInt(cell.r, 16).toString(2).padStart(8, "0")}
        </p>
      )}
    </div>
  );
}

function IntermediateList({ step }: { step: CombinedStep }) {
  const skip = new Set(["before_hex", "after_hex", "blocks", "round_keys", "words"]);
  const entries = Object.entries(step.intermediates).filter(([key, value]) => {
    if (skip.has(key)) return false;
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
  });
  if (entries.length === 0) return null;
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0 border-t border-white/10 pt-2">
          <dt className="font-mono text-[10px] tracking-[0.12em] text-well-mute uppercase">{key}</dt>
          <dd className="break-all font-mono text-[12px] [overflow-wrap:anywhere]">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OperationLesson({ sim, step }: { sim: Simulation; step: CombinedStep | null }) {
  const tampered = Boolean(sim.encrypt && sim.tamperedHex !== sim.encrypt.ciphertext_hex);
  const recovered = sim.decrypt?.recovered_text ?? sim.decrypt?.plaintext ?? "";
  const chips = useMemo(() => {
    return sim.steps.map((item, index) => ({
      index,
      label: item.operation === "AES.input" ? "Entrée" : item.operation.replace(/^[A-Za-z]+\./, ""),
      title: item.title,
    }));
  }, [sim.steps]);

  const showRound = Boolean(step && isAesRoundOp(step.operation) && (step.state_after || step.state_before));

  useEffect(() => {
    document.getElementById(`step-chip-${sim.stepIndex}`)?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [sim.stepIndex]);

  return (
    <div className="space-y-5">
      {chips.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] tracking-[0.14em] text-well-mute uppercase">
            Étapes — cliquez pour inspecter
          </p>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {chips.map((chip) => (
              <button
                key={chip.index}
                id={`step-chip-${chip.index}`}
                type="button"
                title={chip.title}
                onClick={() => {
                  sim.setPlaying(false);
                  sim.setStepIndex(chip.index);
                }}
                className={`shrink-0 border px-2 py-1 font-mono text-[11px] uppercase ${
                  chip.index === sim.stepIndex
                    ? "border-[#c4a36a] text-[#f0d7b8]"
                    : "border-white/10 text-well-mute"
                }`}
              >
                {chip.index + 1}. {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showRound && step && <AesRoundStage step={step} stepDurationMs={sim.stepDurationMs} />}

      <div className={showRound ? "space-y-4" : "grid gap-6 lg:grid-cols-2"}>
        {!showRound && (
          <div className="space-y-4">
            <StateMatrix
              before={step?.state_before}
              after={step?.state_after}
              label={step ? `Avant → après · ${step.operation}` : "Matrice 4×4"}
            />
          </div>
        )}
        <div className="space-y-4">
          {step && <XorBoard step={step} />}
          {step && <IntermediateList step={step} />}
        </div>
      </div>

      {tampered && sim.encrypt && (
        <TamperImpact mode={sim.mode} original={sim.encrypt.ciphertext_hex} tampered={sim.tamperedHex} />
      )}

      {sim.decrypt && recovered && sim.encrypt?.plaintext && (
        <RecoveredDiff expected={sim.encrypt.plaintext} recovered={recovered} />
      )}
    </div>
  );
}

export function formatHint(mode: Mode, index: number | null): string {
  if (index === null) return "Cliquez un octet pour voir l’effet d’une modification.";
  if (mode === "BLOC") {
    return `Octet ${index} : sans mode, modifier cet octet brouille tout le bloc au déchiffrement. Pas de tag.`;
  }
  if (mode === "CBC") {
    return `Octet ${index} : en CBC, le modifier brouille tout le bloc ${Math.floor(index / 16)} et inverse le même bit du bloc suivant. Bob déchiffre quand même.`;
  }
  if (mode === "CTR") {
    return `Octet ${index} : en CTR, Bob retrouvera le clair avec ce bit inversé à la même position. Pas d’authentification.`;
  }
  return `Octet ${index} : en GCM, toute modification casse le tag. Bob refuse le clair.`;
}

export function groupedOrEmpty(hex: string) {
  return hex ? formatGrouped(hex, 2) : "";
}
