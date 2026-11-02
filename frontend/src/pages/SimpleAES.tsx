import { useState } from "react";
import { Link } from "react-router-dom";
import { Portrait } from "../components/characters/Portrait";
import { decryptBlock, encryptBlock, fromHex, toHex, utf8 } from "../lib/aes128";

type Fmt = "texte" | "hex";
const bytesOf = (v: string, f: Fmt) => (f === "texte" ? utf8(v) : fromHex(v));

function Counter({ n }: { n: number | null }) {
  const ok = n === 16;
  return (
    <span className={`font-mono text-xl font-bold ${ok ? "text-green-600" : "text-danger"}`}>
      {n === null ? "hex invalide" : `${n}/16 octets`} {ok ? "✓" : ""}
    </span>
  );
}

function Grid({ bytes, title }: { bytes: Uint8Array; title: string }) {
  // Matrice d'état AES : remplie colonne par colonne
  return (
    <div>
      <p className="mb-2 text-lg font-semibold">{title}</p>
      <div className="inline-grid grid-cols-4 gap-1">
        {Array.from({ length: 16 }, (_, i) => {
          const idx = (i % 4) * 4 + Math.floor(i / 4);
          return (
            <div key={i} className="flex h-14 w-14 items-center justify-center rounded border border-rule bg-paper-2 font-mono text-xl">
              {bytes[idx].toString(16).padStart(2, "0")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border-2 border-rule p-5 md:p-6">
      <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold md:text-3xl">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-paper">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function FieldWithFmt({ value, setValue, fmt, setFmt, placeholder }: {
  value: string; setValue: (v: string) => void; fmt: Fmt; setFmt: (f: Fmt) => void; placeholder: string;
}) {
  const b = bytesOf(value, fmt);
  return (
    <div className="space-y-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="w-full rounded-lg border-2 border-rule bg-paper px-4 py-4 font-mono text-2xl md:text-3xl"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Counter n={b ? b.length : null} />
        <div className="flex gap-2 text-base">
          {(["texte", "hex"] as Fmt[]).map((f) => (
            <button key={f} type="button" onClick={() => setFmt(f)}
              className={`rounded-md border-2 px-3 py-1 ${fmt === f ? "border-ink bg-ink text-paper" : "border-rule"}`}>
              {f === "texte" ? "Texte" : "Hexadécimal"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SimpleAES() {
  const [msg, setMsg] = useState("Bonjour classe !");
  const [msgFmt, setMsgFmt] = useState<Fmt>("texte");
  const [key, setKey] = useState("ma-cle-secrete16");
  const [keyFmt, setKeyFmt] = useState<Fmt>("texte");
  const [cipher, setCipher] = useState<Uint8Array | null>(null);
  const [plain, setPlain] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");

  const m = bytesOf(msg, msgFmt);
  const k = bytesOf(key, keyFmt);

  const reset = () => { setCipher(null); setPlain(null); setError(""); };

  function encrypt() {
    setPlain(null);
    if (!m || m.length !== 16) {
      setCipher(null);
      setError(`Impossible de chiffrer : le message doit faire exactement 16 octets (actuellement ${m ? m.length : "hex invalide"}).`);
      return;
    }
    if (!k || k.length !== 16) {
      setCipher(null);
      setError(`Impossible de chiffrer : la clé doit faire exactement 16 octets (actuellement ${k ? k.length : "hex invalide"}).`);
      return;
    }
    setError("");
    setCipher(encryptBlock(m, k));
  }

  function decrypt() {
    if (cipher && k && k.length === 16) setPlain(decryptBlock(cipher, k));
  }

  function fips() {
    setMsgFmt("hex"); setMsg("00112233445566778899aabbccddeeff");
    setKeyFmt("hex"); setKey("000102030405060708090a0b0c0d0e0f");
    reset();
  }

  const plainText = plain ? new TextDecoder("utf-8", { fatal: false }).decode(plain) : "";

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold md:text-5xl">Chiffrer un message avec AES</h1>
        <p className="mt-3 text-xl text-ink-soft md:text-2xl">
          AES transforme un bloc de 16 octets en un bloc illisible grâce à une clé secrète de 16 octets — et la même clé permet de revenir en arrière.
        </p>
      </div>

      <Step n={1} title="Écrire le message (16 octets)">
        <FieldWithFmt value={msg} setValue={(v) => { setMsg(v); reset(); }} fmt={msgFmt}
          setFmt={(f) => { setMsgFmt(f); reset(); }} placeholder="16 caractères exactement" />
      </Step>

      <Step n={2} title="Choisir la clé secrète (16 octets)">
        <FieldWithFmt value={key} setValue={(v) => { setKey(v); reset(); }} fmt={keyFmt}
          setFmt={(f) => { setKeyFmt(f); reset(); }} placeholder="16 caractères exactement" />
      </Step>

      <Step n={3} title="Chiffrer">
        <button type="button" onClick={encrypt}
          className="w-full rounded-lg bg-ink py-4 text-2xl font-bold text-paper hover:opacity-90">
          🔒 Chiffrer avec AES-128
        </button>
        {error && <p role="alert" className="mt-4 rounded-lg border-2 border-danger p-4 text-xl text-danger">{error}</p>}
      </Step>

      <Step n={4} title="Voir le résultat, puis déchiffrer">
        {!cipher ? (
          <p className="text-xl text-ink-soft">Le message chiffré apparaîtra ici après l’étape 3.</p>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-lg font-semibold">Message chiffré (hexadécimal) :</p>
              <p className="mt-1 break-all font-mono text-2xl md:text-3xl">{toHex(cipher).match(/../g)!.join(" ")}</p>
            </div>
            <div className="flex flex-wrap gap-8">
              {m && m.length === 16 && <Grid bytes={m} title="Bloc d’entrée (matrice d’état 4×4)" />}
              <Grid bytes={cipher} title="Bloc chiffré (matrice d’état 4×4)" />
            </div>
            <button type="button" onClick={decrypt}
              className="w-full rounded-lg border-4 border-ink py-4 text-2xl font-bold hover:bg-paper-2">
              🔓 Déchiffrer avec la même clé
            </button>
            {plain && (
              <div className="rounded-lg bg-paper-2 p-4">
                <p className="text-lg font-semibold">Message retrouvé :</p>
                <p className="font-mono text-2xl">{toHex(plain).match(/../g)!.join(" ")}</p>
                <p className="mt-1 text-2xl">« {plainText} »</p>
              </div>
            )}
          </div>
        )}
      </Step>

      <details className="rounded-xl border border-rule p-5">
        <summary className="cursor-pointer text-xl font-semibold">Options avancées et ressources</summary>
        <div className="mt-4 space-y-4 text-lg">
          <p>Ici, AES chiffre <strong>un seul bloc</strong> : pas de mode d’opération, pas de remplissage, pas de vecteur d’initialisation.</p>
          <button type="button" onClick={fips} className="rounded-md border-2 border-rule px-4 py-2">
            Charger le vecteur de test officiel FIPS-197
          </button>
          <ul className="list-disc pl-6">
            <li><Link className="underline" to="/avance">Studio avancé (modes, étapes détaillées, Alice, Bob et Oscar)</Link></li>
            <li><Link className="underline" to="/notions">Glossaire des notions</Link></li>
            <li><Link className="underline" to="/bibliotheque">Bibliothèque</Link></li>
          </ul>
          <div className="flex gap-6"><Portrait person="alice" compact /><Portrait person="bob" compact /><Portrait person="oscar" compact /></div>
        </div>
      </details>
    </main>
  );
}
