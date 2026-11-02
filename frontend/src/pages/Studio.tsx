import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Portrait } from "../components/characters/Portrait";
import { Thread, type Bubble } from "../components/conversation/Thread";
import { Transport } from "../components/controls/Transport";
import { CodeView } from "../components/source/CodeView";
import { HexEditor } from "../components/visualization/HexEditor";
import { OperationLesson } from "../components/visualization/OperationLesson";
import { RepresentationPanel, RepresentationToggles } from "../components/visualization/Representations";
import { useSimulation, type Simulation } from "../hooks/useSimulation";
import { formatGrouped, insertByte, normalizeHex, removeByte, sourceIdFromRef } from "../lib/hex";
import { glossary, readSource } from "../services/api";
import type { GlossaryTerm, Mode, SourceContent } from "../types";

const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "BLOC", label: "Sans mode", note: "1 bloc, 16 octets" },
  { id: "CBC", label: "CBC", note: "Chaînage + PKCS#7" },
  { id: "CTR", label: "CTR", note: "Flux, sans padding" },
  { id: "GCM", label: "GCM", note: "Confidentialité + tag" },
];

function cipherTitle(mode: Mode): string {
  return mode === "BLOC" ? "AES-128" : `AES-128-${mode}`;
}

export function Studio() {
  const sim = useSimulation();
  const [tab, setTab] = useState<"alice" | "canal" | "bob">("alice");
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [source, setSource] = useState<SourceContent | null>(null);

  useEffect(() => {
    void glossary().then(setTerms).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!sim.codeOpen || !sim.current) return;
    const id = sourceIdFromRef(sim.current.code_ref);
    void readSource(id)
      .then(setSource)
      .catch(() => setSource(null));
  }, [sim.codeOpen, sim.current]);

  const aliceBubbles = useMemo<Bubble[]>(() => {
    const items: Bubble[] = [];
    if (sim.message.trim()) {
      items.push({ id: "draft", from: "alice", body: sim.message, meta: "brouillon" });
    }
    if (sim.encrypt) {
      items.push({
        id: "sent",
        from: "alice",
        body: `${cipherTitle(sim.mode)}\n${formatGrouped(sim.encrypt.ciphertext_hex, 2)}`,
        meta: "envoyé",
      });
    }
    return items;
  }, [sim.encrypt, sim.message, sim.mode]);

  const bobBubbles = useMemo<Bubble[]>(() => {
    const items: Bubble[] = [];
    if (sim.encrypt) {
      items.push({
        id: "recv",
        from: "system",
        body: formatGrouped(sim.tamperedHex, 2),
        meta: sim.tamperedHex !== sim.encrypt.ciphertext_hex ? "reçu modifié" : "reçu",
      });
    }
    if (sim.decrypt) {
      const recovered = sim.decrypt.recovered_text ?? sim.decrypt.plaintext;
      if (sim.decrypt.authenticated === false) {
        items.push({
          id: "fail",
          from: "system",
          body:
            sim.decrypt.error ??
            "Le déchiffrement n’a pas restitué de texte en clair : le tag GCM est invalide.",
          meta: "échec d’authentification",
        });
      } else if (recovered !== null && recovered !== undefined) {
        const altered =
          sim.encrypt &&
          (sim.tamperedHex !== sim.encrypt.ciphertext_hex || sim.decrypt.padding_valid === false);
        const wrongKey = sim.bobKeyMismatch;
        items.push({
          id: "plain",
          from: "bob",
          body: wrongKey
            ? "Mauvaise clé. Bob n’a pas la clé qui a produit ce chiffré : le message d’Alice ne ressort pas."
            : recovered,
          meta: wrongKey
            ? "déchiffré · mauvaise clé"
            : altered
              ? "déchiffré · message altéré"
              : "déchiffré",
        });
      } else {
        items.push({
          id: "fail",
          from: "system",
          body: sim.decrypt.error ?? "Déchiffrement impossible.",
          meta: "échec",
        });
      }
    }
    return items;
  }, [sim.bobKeyMismatch, sim.decrypt, sim.encrypt, sim.tamperedHex]);

  const term = terms.find((item) => sim.current?.glossary.includes(item.id));

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-5 md:px-8 md:py-6">

      <div className="sticky top-[4.75rem] z-20 -mx-4 mt-4 border-y border-rule bg-paper/95 px-4 py-2 backdrop-blur md:hidden">
        <div className="flex gap-2">
          {(["alice", "canal", "bob"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-11 flex-1 border px-2 font-mono text-[11px] uppercase ${
                tab === id ? "border-ink bg-ink text-paper" : "border-rule"
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-0 border-t border-rule md:grid-cols-3">
        <section className={`min-w-0 overflow-hidden border-rule md:border-r md:pr-6 md:pt-6 ${tab === "alice" ? "block" : "hidden md:block"}`}>
          <AliceColumn sim={sim} bubbles={aliceBubbles} />
        </section>
        <section className={`min-w-0 overflow-hidden border-rule md:px-6 md:pt-6 ${tab === "canal" ? "block" : "hidden md:block"}`}>
          <ChannelColumn sim={sim} />
        </section>
        <section className={`min-w-0 overflow-hidden md:pl-6 md:pt-6 ${tab === "bob" ? "block" : "hidden md:block"}`}>
          <BobColumn sim={sim} bubbles={bobBubbles} />
        </section>
      </div>

      <section className="mt-8 border-t border-rule pt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-ink-soft uppercase">
              Trace réelle · {sim.mode === "BLOC" ? "AES-128, sans mode" : sim.mode}
            </p>
            <h2 className="font-display text-2xl leading-tight md:text-3xl md:leading-none">
              {sim.current?.title ?? "En attente d’une simulation"}
            </h2>
          </div>
          <button
            type="button"
            className="border border-rule px-3 py-1.5 text-sm"
            onClick={() => sim.setCodeOpen(!sim.codeOpen)}
            disabled={!sim.current}
          >
            {sim.codeOpen ? "Fermer le code" : "Voir le Python de l’étape"}
          </button>
        </div>
        <p className="max-w-3xl text-[15px]">{sim.current?.explanation ?? "Chiffrez un message pour dérouler les tours d’AES."}</p>
        {term && (
          <p className="mt-3 max-w-3xl text-sm text-ink-soft">
            <span className="font-medium text-ink">{term.title}.</span> {term.summary}
          </p>
        )}
        <Transport sim={sim} />
      </section>

      <section className="mt-6 -mx-4 bg-well px-4 py-5 text-well-ink sm:mx-0 md:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-[0.16em] text-well-mute uppercase">
            Sept représentations · valeurs calculées
          </p>
          <RepresentationToggles value={sim.reps} onToggle={sim.toggleRep} />
        </div>
        <OperationLesson sim={sim} step={sim.current} />
        <div className="mt-6 border-t border-white/10 pt-5">
          <RepresentationPanel visible={sim.reps} session={sim.decrypt ?? sim.encrypt} step={sim.current} />
        </div>
        {sim.codeOpen && source && (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="mb-2 font-mono text-[10px] text-well-mute uppercase">
              {sim.current?.code_ref}
            </p>
            <CodeView content={source.content} title={source.title} fileId={source.id} />
          </div>
        )}
      </section>
    </main>
  );
}

function AliceColumn({ sim, bubbles }: { sim: Simulation; bubbles: Bubble[] }) {
  return (
    <div className="min-w-0 space-y-4 py-5 md:space-y-5 md:py-0">
      <Portrait person="alice" />
      <Thread bubbles={bubbles} />
      {sim.encrypt && (
        <div className="space-y-2 border border-rule px-3 py-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
            Alice · ce que le message devient
          </p>
          <p className="break-all font-mono text-[13px] [overflow-wrap:anywhere]">
            {formatGrouped(sim.encrypt.ciphertext_hex, 2)}
          </p>
        </div>
      )}
      <label className="block">
        <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
          {sim.mode === "BLOC" ? "Message pour Bob · exactement 16 octets" : "Message pour Bob"}
        </span>
        <textarea
          value={sim.message}
          onChange={(event) => sim.setMessage(event.target.value)}
          rows={4}
          spellCheck={sim.mode === "BLOC" && sim.messageFormat === "hex" ? false : undefined}
          className="mt-1 w-full border border-rule bg-transparent px-3 py-2 outline-none"
        />
      </label>
      {sim.mode === "BLOC" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className={`font-mono text-xl ${sim.messageByteLength === 16 ? "text-bob" : "text-danger"}`}
            aria-live="polite"
          >
            {sim.messageByteLength === null
              ? "Hexadécimal invalide"
              : `${sim.messageByteLength} / 16 octets`}
          </p>
          <div className="flex gap-2">
            {(["texte", "hex"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => sim.setMessageFormat(format)}
                className={`border px-3 py-1 font-mono text-[11px] uppercase ${
                  sim.messageFormat === format ? "border-ink bg-paper-2" : "border-rule text-ink-soft"
                }`}
              >
                {format === "texte" ? "Texte" : "Hexadécimal"}
              </button>
            ))}
          </div>
        </div>
      )}
      <fieldset>
        <legend className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
          AES-128
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void sim.changeMode(item.id)}
              className={`border px-2 py-2 text-left ${
                sim.mode === item.id ? "border-ink bg-paper-2" : "border-rule"
              }`}
            >
              <span className="block font-mono text-[13px]">{item.label}</span>
              <span className="block text-[11px] text-ink-soft">{item.note}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {sim.mode === "BLOC" && (
        <p className="text-sm text-ink-soft">
          Un seul bloc AES-128 : pas de mode d’opération, pas de vecteur d’initialisation, pas de remplissage.
          Le message doit faire exactement 16 octets — par exemple « Bonjour classe ! » ou « BONJOUR CLASSE ! ». Une majuscule compte 1 octet, É en compte 2.
        </p>
      )}
      {sim.error && (
        <p role="alert" className="border border-danger px-3 py-2 text-sm text-danger">
          {sim.error}
        </p>
      )}
      {sim.mode === "GCM" && (
        <label className="block">
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
            Données associées (AAD)
          </span>
          <input
            value={sim.aad}
            onChange={(event) => sim.setAad(event.target.value)}
            className="mt-1 w-full border border-rule bg-transparent px-3 py-2 outline-none"
          />
        </label>
      )}
      <ParamFields sim={sim} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void sim.runEncrypt()}
          disabled={sim.busy || !sim.message.trim()}
          className="min-h-11 w-full border border-alice bg-alice px-4 py-2 text-sm text-chalk disabled:opacity-40 sm:w-auto"
        >
          {sim.busy ? "Calcul…" : "Chiffrer et envoyer"}
        </button>
        {sim.mode === "BLOC" && (
          <button
            type="button"
            onClick={sim.loadFips}
            className="min-h-11 w-full border border-rule px-4 py-2 text-sm sm:w-auto"
          >
            Vecteur FIPS-197
          </button>
        )}
        <button type="button" onClick={() => sim.resetTrace()} className="min-h-11 w-full border border-rule px-4 py-2 text-sm sm:w-auto">
          Nouveau brouillon
        </button>
      </div>
    </div>
  );
}

function KeyEditor({
  label,
  value,
  onChange,
  format,
  onFormat,
  byteLength,
  note,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  format: "texte" | "hex";
  onFormat: (format: "texte" | "hex") => void;
  byteLength: number | null;
  note?: string | null;
}) {
  const ready = byteLength === 16;
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">{label}</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          className="mt-1 w-full border border-rule bg-transparent px-3 py-2 font-mono text-[12px] outline-none"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`font-mono text-sm ${ready ? "text-bob" : "text-danger"}`} aria-live="polite">
          {byteLength === null ? "Hexadécimal invalide" : `${byteLength} / 16 octets`}
        </p>
        <div className="flex gap-2">
          {(["texte", "hex"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onFormat(item)}
              className={`border px-3 py-1 font-mono text-[11px] uppercase ${
                format === item ? "border-ink bg-paper-2" : "border-rule text-ink-soft"
              }`}
            >
              {item === "texte" ? "Texte" : "Hexadécimal"}
            </button>
          ))}
        </div>
      </div>
      {note && <p className="text-sm text-ink-soft">{note}</p>}
    </div>
  );
}

function ParamFields({ sim }: { sim: Simulation }) {
  return (
    <div className="space-y-3">
      <KeyEditor
        label="Clé secrète · 16 octets"
        value={sim.keyDraft}
        onChange={sim.setKeyDraft}
        format={sim.keyFormat}
        onFormat={sim.setAliceKeyFormat}
        byteLength={sim.keyByteLength}
        note={sim.keyNote ?? "Texte : 16 octets, majuscules et accents compris. Hexadécimal : 32 chiffres, majuscules ou minuscules."}
      />
      {sim.keyPending && (
        <p className="text-sm text-ink-soft">
          Cette clé n’est pas encore celle du dernier chiffré. « Chiffrer et envoyer » l’applique, et Bob la reprend s’il utilisait la précédente.
        </p>
      )}
      {sim.mode === "CBC" && (
        <label className="block">
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
            IV public · 128 bits
          </span>
          <input
            value={sim.ivHex}
            onChange={(event) => sim.setIvHex(event.target.value)}
            spellCheck={false}
            className="mt-1 w-full border border-rule bg-transparent px-3 py-2 font-mono text-[12px] outline-none"
          />
        </label>
      )}
      {sim.mode === "CTR" && (
        <label className="block">
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
            Compteur initial · public
          </span>
          <input
            value={sim.counterHex}
            onChange={(event) => sim.setCounterHex(event.target.value)}
            spellCheck={false}
            className="mt-1 w-full border border-rule bg-transparent px-3 py-2 font-mono text-[12px] outline-none"
          />
        </label>
      )}
      {sim.mode === "GCM" && (
        <label className="block">
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
            Nonce public · 96 bits
          </span>
          <input
            value={sim.nonceHex}
            onChange={(event) => sim.setNonceHex(event.target.value)}
            spellCheck={false}
            className="mt-1 w-full border border-rule bg-transparent px-3 py-2 font-mono text-[12px] outline-none"
          />
        </label>
      )}
      <button
        type="button"
        onClick={() => void sim.seedParams()}
        className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-soft"
      >
        Générer de nouveaux paramètres
      </button>
    </div>
  );
}

function ChannelColumn({ sim }: { sim: Simulation }) {
  const [focusByte, setFocusByte] = useState<number | null>(null);
  const onWire = Boolean(sim.encrypt);
  const modified = Boolean(sim.encrypt && sim.tamperedHex !== sim.encrypt.ciphertext_hex);
  return (
    <div className="min-w-0 space-y-4 py-5 md:space-y-5 md:py-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-ink-soft uppercase">02 / Canal</p>
          <h2 className="font-display text-2xl leading-none">Transit</h2>
        </div>
        <label className="flex items-center gap-2 font-mono text-[11px] uppercase">
          <input
            type="checkbox"
            checked={sim.attacker}
            onChange={(event) => sim.setAttacker(event.target.checked)}
          />
          Oscar agit
        </label>
      </div>

      <div className="relative overflow-hidden border border-rule bg-paper-2 px-3 py-6">
        <p className="font-mono text-[10px] text-ink-soft uppercase">
          {onWire ? (modified ? "Trame altérée" : "Trame en transit") : "Canal silencieux"}
        </p>
        {onWire && (
          <motion.div
            key={sim.tamperedHex}
            initial={{ x: "-20%" }}
            animate={{ x: "8%" }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
            className="mt-4 inline-block border border-ink bg-paper px-3 py-2 font-mono text-[11px]"
          >
            {sim.tamperedHex.slice(0, 32)}…
          </motion.div>
        )}
      </div>

      {sim.encrypt && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
            Hexadécimal public
          </p>
          <p className="max-w-full overflow-hidden break-all font-mono text-[12px] [overflow-wrap:anywhere]">
            {formatGrouped(sim.tamperedHex, 2)}
          </p>
          <p className="break-all font-mono text-[11px] text-ink-soft">
            {sim.encrypt.representations.binary.slice(0, 200)}
            {sim.encrypt.representations.binary.length > 200 ? "…" : ""}
          </p>
          <dl className="grid grid-cols-2 gap-2 font-mono text-[11px]">
            {Object.entries(sim.encrypt.public_params).map(([key, value]) => (
              <div key={key} className="border-t border-rule pt-2">
                <dt className="text-ink-soft">{key}</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {sim.attacker && (
        <div className="space-y-3 border-t border-rule pt-4">
          <Portrait person="oscar" compact />
          <p className="text-sm text-ink-soft">
            Oscar voit le chiffré, pas la clé d’Alice. Modifiez n’importe quel octet, puis transmettez.
          </p>
          {sim.encrypt ? (
            <>
              <HexEditor
                hex={sim.tamperedHex}
                original={sim.encrypt.ciphertext_hex}
                onChange={sim.setTamperedHex}
                selected={focusByte}
                onSelect={setFocusByte}
              />
              {sim.mode === "GCM" && (
                <label className="block">
                  <span className="font-mono text-[10px] uppercase text-ink-soft">Tag</span>
                  <input
                    value={sim.tamperedTag}
                    onChange={(event) => sim.setTamperedTag(event.target.value)}
                    className="mt-1 w-full border border-rule bg-transparent px-3 py-2 font-mono text-[12px]"
                  />
                </label>
              )}
              <label className="block">
                <span className="font-mono text-[10px] uppercase text-ink-soft">
                  Essai de clé (Oscar)
                </span>
                <input
                  value={sim.oscarGuess}
                  onChange={(event) => sim.setOscarGuess(event.target.value)}
                  className="mt-1 w-full border border-rule bg-transparent px-3 py-2 font-mono text-[12px]"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void sim.runDecrypt("oscar")}
                  className="border border-oscar px-3 py-2 text-sm"
                >
                  Tenter sans la vraie clé
                </button>
                <button
                  type="button"
                  onClick={() => void sim.runDecrypt("bob")}
                  className="border border-ink px-3 py-2 text-sm"
                >
                  Transmettre à Bob
                </button>
              </div>
              {sim.oscar && (
                <RecoveredMessage
                  actor="Oscar"
                  mode={sim.mode}
                  session={sim.oscar}
                />
              )}
              <TamperLesson mode={sim.mode} modified={modified} />
            </>
          ) : (
            <p className="text-sm text-ink-soft">Attendez qu’Alice envoie une trame.</p>
          )}
        </div>
      )}
    </div>
  );
}

function RecoveredMessage({
  actor,
  mode,
  session,
  wrongKey = false,
}: {
  actor: string;
  mode: Mode;
  session: NonNullable<Simulation["decrypt"]>;
  wrongKey?: boolean;
}) {
  const text = wrongKey
    ? "Mauvaise clé : ce bloc n’est pas le message d’Alice."
    : (session.recovered_text ?? session.plaintext);
  if (mode === "GCM" && session.authenticated === false) {
    return (
      <p className="border border-danger px-3 py-2 text-sm text-danger">
        {actor} : authentification GCM échouée. Le clair n’est pas restitué.
      </p>
    );
  }
  return (
    <div className="space-y-2 border border-rule px-3 py-3">
      <p className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
        {actor} · ce que le déchiffrement produit
      </p>
      <p className="break-all whitespace-pre-wrap font-mono text-[14px] [overflow-wrap:anywhere]">
        {text || "∅"}
      </p>
      <p className="break-all font-mono text-[11px] text-ink-soft [overflow-wrap:anywhere]">
        hex {formatGrouped(session.plaintext_hex ?? "", 2) || "—"}
      </p>
    </div>
  );
}

function TamperLesson({ mode, modified }: { mode: Mode; modified: boolean }) {
  const text =
    mode === "BLOC"
      ? "AES sans mode : un seul bloc. Modifier un octet rend tout le bloc déchiffré illisible. Il n’y a ni chaînage, ni tag."
      : mode === "CBC"
        ? "CBC : un octet modifié brouille un bloc et déplace des bits dans le suivant. Aucun tag ne signale la fraude."
        : mode === "CTR"
          ? "CTR : le bit inversé dans le chiffré apparaît au même endroit dans le clair. L’intégrité n’est pas protégée."
          : "GCM : toute modification du chiffré, de l’AAD ou du tag doit faire échouer la vérification. Bob ne voit pas le clair.";
  return (
    <p className="text-sm text-ink-soft">
      {modified ? "Modification en cours. " : ""}
      {text}
    </p>
  );
}

function BobColumn({ sim, bubbles }: { sim: Simulation; bubbles: Bubble[] }) {
  const cipherBytes = Math.ceil(normalizeHex(sim.tamperedHex).length / 2);
  const cipherChanged = Boolean(
    sim.encrypt && normalizeHex(sim.tamperedHex) !== normalizeHex(sim.encrypt.ciphertext_hex),
  );
  return (
    <div className="space-y-4 py-5 md:space-y-5 md:py-0">
      <Portrait person="bob" />
      <Thread bubbles={bubbles} />
      <div className="space-y-2 text-sm">
        <p className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
          Paramètres de réception
        </p>
        <p>Algorithme : {cipherTitle(sim.mode)}{sim.mode === "BLOC" ? " · sans mode" : ""}</p>
        {sim.mode === "CBC" && <p className="break-all font-mono text-[12px]">IV {sim.ivHex}</p>}
        {sim.mode === "CTR" && <p className="break-all font-mono text-[12px]">CTR {sim.counterHex}</p>}
        {sim.mode === "GCM" && <p className="break-all font-mono text-[12px]">Nonce {sim.nonceHex}</p>}
      </div>

      <label className="block space-y-2 text-sm">
        <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">
          Chiffré reçu — {cipherBytes} octet{cipherBytes > 1 ? "s" : ""}
        </span>
        <textarea
          value={sim.tamperedHex}
          onChange={(event) => sim.setTamperedHex(normalizeHex(event.target.value))}
          disabled={!sim.encrypt}
          spellCheck={false}
          rows={4}
          className="w-full resize-y border border-rule bg-paper px-3 py-2 font-mono text-[12px] break-all [overflow-wrap:anywhere] disabled:opacity-40"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!sim.encrypt}
          onClick={() => sim.setTamperedHex((hex) => insertByte(hex, Math.ceil(normalizeHex(hex).length / 2), "00"))}
          className="border border-rule px-3 py-1 text-sm disabled:opacity-40"
        >
          Ajouter 00
        </button>
        <button
          type="button"
          disabled={!sim.encrypt || cipherBytes === 0}
          onClick={() => sim.setTamperedHex((hex) => removeByte(hex, Math.ceil(normalizeHex(hex).length / 2) - 1))}
          className="border border-rule px-3 py-1 text-sm disabled:opacity-40"
        >
          Effacer le dernier
        </button>
        <button
          type="button"
          disabled={!sim.encrypt || !cipherChanged}
          onClick={sim.restoreCipher}
          className="border border-rule px-3 py-1 text-sm disabled:opacity-40"
        >
          Restaurer le chiffré
        </button>
      </div>
      <p className="text-sm text-ink-soft">
        Bob peut ajouter, retirer ou réécrire des octets hexadécimaux, puis déchiffrer
        comme si le canal n’avait rien signalé.
      </p>
      {cipherChanged && (
        <p className="border border-oscar/40 px-3 py-2 text-sm">
          Le chiffré n’est plus celui d’Alice. Bob le traite quand même comme un message reçu.
        </p>
      )}

      {sim.mode === "GCM" && (
        <label className="block space-y-2 text-sm">
          <span className="font-mono text-[10px] tracking-[0.14em] text-ink-soft uppercase">Tag GCM</span>
          <input
            value={sim.tamperedTag}
            onChange={(event) => sim.setTamperedTag(normalizeHex(event.target.value))}
            disabled={!sim.encrypt}
            className="w-full border border-rule bg-paper px-3 py-2 font-mono text-[12px] break-all disabled:opacity-40"
          />
        </label>
      )}

      <KeyEditor
        label="Clé utilisée par Bob"
        value={sim.bobDraft}
        onChange={sim.setBobDraft}
        format={sim.bobFormat}
        onFormat={sim.setBobKeyFormat}
        byteLength={sim.bobKeyByteLength}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={sim.generateBobKey} className="border border-rule px-3 py-1 text-sm">
          Générer une autre clé
        </button>
        <button
          type="button"
          onClick={sim.useAliceKey}
          disabled={sim.bobUsesAliceKey}
          className="border border-rule px-3 py-1 text-sm disabled:opacity-40"
        >
          Reprendre la clé d’Alice
        </button>
      </div>
      {sim.bobKeyMismatch && (
        <p className="border border-oscar/40 px-3 py-2 text-sm">
          {sim.mode === "GCM"
            ? "Mauvaise clé. Bob n’utilise pas la clé qui a chiffré ce message : GCM recalcule un autre tag et ne restitue pas le clair."
            : "Mauvaise clé. Bob n’utilise pas la clé qui a chiffré ce message. AES produit un autre bloc, pas le texte d’Alice. Reprenez la clé d’Alice, ou chiffrez à nouveau une fois les deux clés identiques."}
        </p>
      )}

      {sim.decrypt?.warnings.map((warning) => (
        <p key={warning} className="border border-rule px-3 py-2 text-sm text-ink-soft">
          {warning}
        </p>
      ))}
      {sim.decrypt && (
        <RecoveredMessage
          actor="Bob"
          mode={sim.mode}
          session={sim.decrypt}
          wrongKey={sim.bobKeyMismatch}
        />
      )}
      {sim.decrypt && sim.decrypt.authenticated !== false && sim.decrypt.padding_valid === false && (
        <p className="border border-rule px-3 py-2 text-sm">
          CBC a tout de même produit un clair. Le padding est cassé : le message n’est pas intègre.
        </p>
      )}
      <button
        type="button"
        onClick={() => void sim.runDecrypt("bob")}
        disabled={!sim.encrypt || sim.busy || !sim.bobKeyHex}
        className="min-h-11 w-full border border-bob bg-bob px-4 py-2 text-sm text-chalk disabled:opacity-40 sm:w-auto"
      >
        Déchiffrer
      </button>
    </div>
  );
}
