import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeHex, randomKeyHex } from "../lib/hex";
import {
  keyError,
  keyForBob,
  keyMaterialBytes,
  resolveKeyHex,
  switchKeyDraft,
  type KeyFormat,
} from "../lib/keyMaterial";
import { decryptSession, encryptSession, generateParams } from "../services/api";
import type { Mode, Phase, RepresentationKey, SessionResponse, TraceStep } from "../types";

const SPEEDS = [0.5, 1, 1.5, 2.5];
const STEP_BASE_MS = 1200;

export type MessageFormat = "texte" | "hex";

export interface CombinedStep extends TraceStep {
  lane: "encrypt" | "decrypt" | "oscar";
}

const DEFAULT_REPS: Record<RepresentationKey, boolean> = {
  text: true,
  bytes: false,
  binary: true,
  hex: true,
  matrix: true,
  operations: true,
  cipher: true,
};

export function useSimulation() {
  const [mode, setMode] = useState<Mode>("CBC");
  const [message, setMessage] = useState("Le rendez-vous est confirmé à 18 heures.");
  const [messageFormat, setMessageFormat] = useState<MessageFormat>("texte");
  const [aad, setAad] = useState("from:alice;to:bob");
  const [keyDraft, setKeyDraft] = useState("");
  const [keyFormat, setKeyFormat] = useState<KeyFormat>("hex");
  const [keyNote, setKeyNote] = useState<string | null>(null);
  const [bobDraft, setBobDraftState] = useState("");
  const [bobFormat, setBobFormat] = useState<KeyFormat>("hex");
  const [bobChoseOwnKey, setBobChoseOwnKey] = useState(false);
  const [encryptionKeyHex, setEncryptionKeyHex] = useState<string | null>(null);
  const [ivHex, setIvHex] = useState("");
  const [counterHex, setCounterHex] = useState("");
  const [nonceHex, setNonceHex] = useState("");
  const [oscarGuess, setOscarGuess] = useState("00000000000000000000000000000000");
  const [attacker, setAttacker] = useState(false);
  const [phase, setPhase] = useState<Phase>("compose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encrypt, setEncrypt] = useState<SessionResponse | null>(null);
  const [decrypt, setDecrypt] = useState<SessionResponse | null>(null);
  const [oscar, setOscar] = useState<SessionResponse | null>(null);
  const [tamperedHex, setTamperedHex] = useState("");
  const [tamperedTag, setTamperedTag] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [reps, setReps] = useState(DEFAULT_REPS);
  const [codeOpen, setCodeOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const autoStopAt = useRef<number | null>(null);

  const messageByteLength = useMemo<number | null>(() => {
    if (mode === "BLOC" && messageFormat === "hex") {
      const clean = message.replace(/\s+/g, "");
      if (!clean) return 0;
      if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) return null;
      return clean.length / 2;
    }
    return new TextEncoder().encode(message).length;
  }, [message, messageFormat, mode]);

  const aliceKeyHex = useMemo(() => resolveKeyHex(keyDraft, keyFormat), [keyDraft, keyFormat]);
  const bobKeyHex = useMemo(() => resolveKeyHex(bobDraft, bobFormat), [bobDraft, bobFormat]);
  const keyByteLength = useMemo(() => keyMaterialBytes(keyDraft, keyFormat), [keyDraft, keyFormat]);
  const bobKeyByteLength = useMemo(() => keyMaterialBytes(bobDraft, bobFormat), [bobDraft, bobFormat]);

  const seedParams = useCallback(async (nextMode: Mode) => {
    const params = await generateParams(nextMode);
    setKeyDraft(params.key_hex);
    setKeyFormat("hex");
    setKeyNote(null);
    setBobDraftState(params.key_hex);
    setBobFormat("hex");
    setBobChoseOwnKey(false);
    setIvHex(params.iv_hex ?? "");
    setCounterHex(params.counter_hex ?? "");
    setNonceHex(params.nonce_hex ?? "");
  }, []);

  useEffect(() => {
    void seedParams("CBC").catch((err: Error) => setError(err.message));
  }, [seedParams]);

  const steps: CombinedStep[] = useMemo(() => {
    const encryptSteps = (encrypt?.steps ?? []).map((step) => ({ ...step, lane: "encrypt" as const }));
    const decryptSteps = (decrypt?.steps ?? []).map((step, i) => ({
      ...step,
      index: encryptSteps.length + i,
      lane: "decrypt" as const,
    }));
    return [...encryptSteps, ...decryptSteps];
  }, [encrypt, decrypt]);

  const current = steps[stepIndex] ?? null;

  const stopTimer = () => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => {
    stopTimer();
    if (!playing || steps.length === 0) return;
    const delay = STEP_BASE_MS / SPEEDS[speedIndex];
    timer.current = window.setInterval(() => {
      setStepIndex((index) => {
        const next = index + 1;
        if (next >= steps.length) {
          setPlaying(false);
          autoStopAt.current = null;
          return index;
        }
        if (autoStopAt.current !== null && next > autoStopAt.current) {
          autoStopAt.current = null;
          setPlaying(false);
          return index;
        }
        return next;
      });
    }, delay);
    return stopTimer;
  }, [playing, speedIndex, steps.length]);

  const resetTrace = (nextMode: Mode = mode) => {
    setEncrypt(null);
    setDecrypt(null);
    setOscar(null);
    setTamperedHex("");
    setTamperedTag("");
    setStepIndex(0);
    setPlaying(false);
    setPhase("compose");
    setError(null);
    setEncryptionKeyHex(null);
    void seedParams(nextMode).catch((err: Error) => setError(err.message));
  };

  const changeMode = async (next: Mode) => {
    setMode(next);
    if (next !== "BLOC") setMessageFormat("texte");
    resetTrace(next);
  };

  const runEncrypt = async () => {
    setBusy(true);
    setError(null);
    setDecrypt(null);
    setOscar(null);
    setPlaying(false);
    try {
      if (mode === "BLOC") {
        if (messageFormat === "hex" && messageByteLength === null) {
          setError(
            "Ce n’est pas de l’hexadécimal : une phrase, surtout avec des majuscules, se saisit en « Texte ». L’hexadécimal n’accepte que 0–9 et A–F.",
          );
          return;
        }
        if (messageByteLength !== 16) {
          setError(
            `Le message doit faire exactement 16 octets (actuellement ${messageByteLength ?? 0}). AES sans mode n’utilise ni remplissage, ni vecteur d’initialisation, ni mode d’opération. Les majuscules comptent 1 octet, un accent comme É en compte 2.`,
          );
          return;
        }
      }
      const aliceHex = resolveKeyHex(keyDraft, keyFormat);
      if (!aliceHex) {
        setError(keyError(keyDraft, keyFormat) ?? "Clé invalide.");
        return;
      }
      const bobHex = keyForBob(aliceHex, bobKeyHex, bobChoseOwnKey);
      if (!bobHex) {
        setError(keyError(bobDraft, bobFormat) ?? "La clé de Bob est invalide.");
        return;
      }
      const session = await encryptSession({
        plaintext: mode === "BLOC" && messageFormat === "hex" ? "" : message,
        plaintext_hex: mode === "BLOC" && messageFormat === "hex" ? normalizeHex(message) : undefined,
        mode,
        key_hex: aliceHex,
        iv_hex: mode === "CBC" ? ivHex : undefined,
        counter_hex: mode === "CTR" ? counterHex : undefined,
        nonce_hex: mode === "GCM" ? nonceHex : undefined,
        aad: mode === "GCM" ? aad : undefined,
      });
      if (!bobChoseOwnKey) {
        setBobDraftState(keyDraft);
        setBobFormat(keyFormat);
      }
      setEncrypt(session);
      setEncryptionKeyHex(session.used_key_hex ?? aliceHex);
      setTamperedHex(session.ciphertext_hex);
      setTamperedTag(session.tag_hex ?? "");
      const firstRound = session.steps.findIndex((step) =>
        ["AES.input", "SubBytes", "ShiftRows", "MixColumns", "AddRoundKey"].includes(step.operation),
      );
      const start = firstRound >= 0 ? firstRound : 0;
      setStepIndex(start);
      autoStopAt.current = Math.max(0, session.steps.length - 1);
      setPlaying(session.steps.length > 1 && start < session.steps.length - 1);
      if (mode === "GCM") {
        setPhase(attacker ? "tamper" : "transit");
      } else {
        const recovered = await decryptSession({
          ciphertext_hex: session.ciphertext_hex,
          mode,
          key_hex: bobHex,
          iv_hex: mode === "CBC" ? ivHex : undefined,
          counter_hex: mode === "CTR" ? counterHex : undefined,
          actor: "bob",
        });
        setDecrypt(recovered);
        setPhase("complete");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chiffrement impossible");
      setPhase("compose");
    } finally {
      setBusy(false);
    }
  };

  const runDecrypt = async (actor: "bob" | "oscar" = "bob") => {
    if (!encrypt) return;
    const key = actor === "oscar" ? resolveKeyHex(oscarGuess, "hex") : bobKeyHex;
    if (!key) {
      setError(
        actor === "oscar"
          ? "L’essai d’Oscar doit être une clé hexadécimale de 16 octets."
          : (keyError(bobDraft, bobFormat) ?? "La clé de Bob est invalide."),
      );
      return;
    }
    setBusy(true);
    setError(null);
    setPlaying(false);
    try {
      const session = await decryptSession({
        ciphertext_hex: actor === "bob" ? normalizeHex(tamperedHex) : encrypt.ciphertext_hex,
        mode,
        key_hex: key,
        iv_hex: mode === "CBC" ? ivHex : undefined,
        counter_hex: mode === "CTR" ? counterHex : undefined,
        nonce_hex: mode === "GCM" ? nonceHex : undefined,
        tag_hex: mode === "GCM" ? (actor === "bob" ? tamperedTag : encrypt.tag_hex ?? undefined) : undefined,
        aad: mode === "GCM" ? aad : undefined,
        actor,
      });
      if (actor === "oscar") {
        setOscar(session);
      } else {
        setDecrypt(session);
        setPhase("complete");
        setStepIndex((encrypt?.steps.length ?? 0));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Déchiffrement impossible");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!encrypt || mode === "GCM" || !bobKeyHex) return;
    const key = bobKeyHex;
    const cipher = normalizeHex(tamperedHex);
    if (key.length !== 32 || cipher.length === 0) return;
    const timerId = window.setTimeout(() => {
      void decryptSession({
        ciphertext_hex: cipher,
        mode,
        key_hex: key,
        iv_hex: mode === "CBC" ? ivHex : undefined,
        counter_hex: mode === "CTR" ? counterHex : undefined,
        actor: "bob",
      })
        .then((session) => {
          setDecrypt(session);
          setPhase("complete");
        })
        .catch((err: Error) => setError(err.message));
    }, 280);
    return () => window.clearTimeout(timerId);
  }, [bobKeyHex, encrypt, ivHex, counterHex, mode, tamperedHex]);

  return {
    mode,
    message,
    setMessage,
    messageFormat,
    setMessageFormat,
    messageByteLength,
    loadFips: () => {
      setMessageFormat("hex");
      setMessage("00112233445566778899aabbccddeeff");
      const fipsKey = "000102030405060708090a0b0c0d0e0f";
      setKeyDraft(fipsKey);
      setKeyFormat("hex");
      setKeyNote(null);
      setBobDraftState(fipsKey);
      setBobFormat("hex");
      setBobChoseOwnKey(false);
      setEncryptionKeyHex(null);
      setError(null);
      setEncrypt(null);
      setDecrypt(null);
      setOscar(null);
      setTamperedHex("");
      setTamperedTag("");
      setStepIndex(0);
      setPlaying(false);
      setPhase("compose");
    },
    aad,
    setAad,
    keyDraft,
    setKeyDraft: (value: string) => {
      setKeyNote(null);
      setKeyDraft(value);
    },
    keyFormat,
    setAliceKeyFormat: (next: KeyFormat) => {
      const switched = switchKeyDraft(keyDraft, keyFormat, next);
      setKeyNote(switched.note);
      setKeyFormat(switched.format);
      setKeyDraft(switched.draft);
    },
    keyByteLength,
    keyNote,
    keyPending: Boolean(aliceKeyHex && encryptionKeyHex && aliceKeyHex !== encryptionKeyHex),
    ivHex,
    setIvHex,
    counterHex,
    setCounterHex,
    nonceHex,
    setNonceHex,
    oscarGuess,
    setOscarGuess,
    bobDraft,
    setBobDraft: (value: string) => {
      setBobChoseOwnKey(true);
      setBobDraftState(value);
    },
    bobFormat,
    setBobKeyFormat: (next: KeyFormat) => {
      const switched = switchKeyDraft(bobDraft, bobFormat, next);
      setBobChoseOwnKey(true);
      setBobFormat(switched.format);
      setBobDraftState(switched.draft);
    },
    bobKeyByteLength,
    bobKeyHex,
    generateBobKey: () => {
      setBobChoseOwnKey(true);
      setBobFormat("hex");
      setBobDraftState(randomKeyHex());
    },
    useAliceKey: () => {
      setBobChoseOwnKey(false);
      setBobFormat(keyFormat);
      setBobDraftState(keyDraft);
    },
    restoreCipher: () => {
      if (!encrypt) return;
      setTamperedHex(encrypt.ciphertext_hex);
      setTamperedTag(encrypt.tag_hex ?? "");
    },
    bobUsesAliceKey: Boolean(aliceKeyHex && bobKeyHex && aliceKeyHex === bobKeyHex),
    bobKeyMismatch: Boolean(encrypt && encryptionKeyHex && bobKeyHex && bobKeyHex !== encryptionKeyHex),
    attacker,
    setAttacker,
    phase,
    setPhase,
    busy,
    error,
    encrypt,
    decrypt,
    oscar,
    tamperedHex,
    setTamperedHex,
    tamperedTag,
    setTamperedTag,
    steps,
    current,
    stepIndex,
    setStepIndex,
    playing,
    setPlaying,
    speed: SPEEDS[speedIndex],
    stepDurationMs: STEP_BASE_MS / SPEEDS[speedIndex],
    cycleSpeed: () => setSpeedIndex((i) => (i + 1) % SPEEDS.length),
    reps,
    toggleRep: (key: RepresentationKey) => setReps((prev) => ({ ...prev, [key]: !prev[key] })),
    codeOpen,
    setCodeOpen,
    changeMode,
    seedParams: () => seedParams(mode),
    runEncrypt,
    runDecrypt,
    resetTrace,
  };
}

export type Simulation = ReturnType<typeof useSimulation>;
