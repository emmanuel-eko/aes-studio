import type { ReactNode } from "react";
import type { CombinedStep } from "../../hooks/useSimulation";
import type { RepresentationKey, SessionResponse } from "../../types";

const LABELS: { key: RepresentationKey; label: string }[] = [
  { key: "text", label: "Texte" },
  { key: "bytes", label: "Octets" },
  { key: "binary", label: "Binaire" },
  { key: "hex", label: "Hex" },
  { key: "matrix", label: "Matrice 4×4" },
  { key: "operations", label: "Opérations" },
  { key: "cipher", label: "Chiffré" },
];

export function RepresentationToggles({
  value,
  onToggle,
}: {
  value: Record<RepresentationKey, boolean>;
  onToggle: (key: RepresentationKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] tracking-[0.08em] uppercase">
      {LABELS.map((item) => (
        <label key={item.key} className="flex items-center gap-2 text-well-mute">
          <input
            type="checkbox"
            checked={value[item.key]}
            onChange={() => onToggle(item.key)}
            className="accent-ink"
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 font-mono text-[10px] tracking-[0.16em] text-well-mute uppercase">{label}</p>
      <div className="max-w-full overflow-hidden break-all font-mono text-[12px] leading-relaxed text-well-ink [overflow-wrap:anywhere]">
        {children}
      </div>
    </div>
  );
}

export function RepresentationPanel({
  visible,
  session,
  step,
}: {
  visible: Record<RepresentationKey, boolean>;
  session: SessionResponse | null;
  step: CombinedStep | null;
}) {
  if (!session) {
    return <p className="text-sm text-well-mute">En attente d’un chiffrement réel.</p>;
  }
  const afterHex =
    typeof step?.intermediates.after_hex === "string"
      ? step.intermediates.after_hex
      : session.representations.hex;
  const bytes =
    typeof afterHex === "string"
      ? afterHex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? session.representations.bytes_list
      : session.representations.bytes_list;
  const binary = bytes.map((b) => b.toString(2).padStart(8, "0")).join(" ");
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {visible.text && <Field label="1 · Message texte">{session.representations.text ?? "—"}</Field>}
      {visible.bytes && (
        <Field label="2 · Octets">{bytes.slice(0, 48).join(" ")}{bytes.length > 48 ? " …" : ""}</Field>
      )}
      {visible.binary && <Field label="3 · Binaire">{binary || "—"}</Field>}
      {visible.hex && <Field label="4 · Hexadécimal">{afterHex || "—"}</Field>}
      {visible.matrix && (
        <Field label="5 · Matrice AES">
          {step?.state_after
            ? step.state_after.map((row) => row.join(" ")).join(" / ")
            : "disponible à l’étape de bloc"}
        </Field>
      )}
      {visible.operations && (
        <Field label="6 · Opération">{step ? `${step.operation} — ${step.title}` : "—"}</Field>
      )}
      {visible.cipher && (
        <Field label="7 · Message chiffré">
          {session.ciphertext_hex}
          {session.tag_hex ? `\nTAG ${session.tag_hex}` : ""}
        </Field>
      )}
    </div>
  );
}
