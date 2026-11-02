import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeHex, randomKeyHex } from "../lib/hex";
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
  const [keyHex, setKeyHex] = useState("");
  const [ivHex, setIvHex] = useState("");
  const [counterHex, setCounterHex] = useState("");
  const [nonceHex, setNonceHex] = useState("");
  const [oscarGuess, setOscarGuess] = useState("00000000000000000000000000000000");
  const [bobKeyHex, setBobKeyHex] = useState("");
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

  const seedParams = useCallback(async (nextMode: Mode) => {
    const params = await generateParams(nextMode);
    setKeyHex(params.key_hex);
    setBobKeyHex(params.key_hex);
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
        if (messageByteLength === null) {
          setError(
            "Le message hexadécimal est invalide. Utilisez uniquement des chiffres 0–9 et des lettres A–F, par paires.",
          );
          return;
        }
        if (messageByteLength !== 16) {
          setError(
            `Le message doit faire exactement 16 octets (actuellement ${messageByteLength}). AES sans mode n’utilise ni remplissage, ni vecteur d’initialisation, ni mode d’opération.`,
          );
          return;
        }
        if (normalizeHex(keyHex).length !== 32) {
          setError("La clé doit faire exactement 16 octets (32 chiffres hexadécimaux).");
          return;
        }
      }
      const session = await encryptSession({
        plaintext: mode === "BLOC" && messageFormat === "hex" ? "" : message,
        plaintext_hex: mode === "BLOC" && messageFormat === "hex" ? normalizeHex(message) : undefined,
        mode,
        key_hex: keyHex,
        iv_hex: mode === "CBC" ? ivHex : undefined,
        counter_hex: mode === "CTR" ? counterHex : undefined,
        nonce_hex: mode === "GCM" ? nonceHex : undefined,
        aad: mode === "GCM" ? aad : undefined,
      });
      setEncrypt(session);
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
          key_hex: bobKeyHex || keyHex,
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
    setBusy(true);
    setError(null);
    setPlaying(false);
    try {
      const session = await decryptSession({
        ciphertext_hex: actor === "bob" ? normalizeHex(tamperedHex) : encrypt.ciphertext_hex,
        mode,
        key_hex: actor === "oscar" ? oscarGuess : bobKeyHex || keyHex,
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
    if (!encrypt || mode === "GCM") return;
    const key = normalizeHex(bobKeyHex);
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
      setKeyHex(fipsKey);
      setBobKeyHex(fipsKey);
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
    keyHex,
    setKeyHex,
    ivHex,
    setIvHex,
    counterHex,
    setCounterHex,
    nonceHex,
    setNonceHex,
    oscarGuess,
    setOscarGuess,
    bobKeyHex,
    setBobKeyHex,
    generateBobKey: () => setBobKeyHex(randomKeyHex()),
    useAliceKey: () => setBobKeyHex(keyHex),
    restoreCipher: () => {
      if (!encrypt) return;
      setTamperedHex(encrypt.ciphertext_hex);
      setTamperedTag(encrypt.tag_hex ?? "");
    },
    bobUsesAliceKey: normalizeHex(bobKeyHex) === normalizeHex(keyHex),
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
