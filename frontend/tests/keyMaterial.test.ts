import {
  hexToUtf8,
  keyError,
  keyForBob,
  keyMaterialBytes,
  resolveKeyHex,
  switchKeyDraft,
} from "../src/lib/keyMaterial.ts";

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const upperHex = "00112233445566778899AABBCCDDEEFF";
const lowerHex = upperHex.toLowerCase();
assert(resolveKeyHex(upperHex, "hex") === lowerHex, "majuscules hex de la clé");
assert(resolveKeyHex("0011 2233 4455 6677 8899 aabb ccddeeff", "hex") === lowerHex, "espaces");
assert(resolveKeyHex("001122", "hex") === null, "clé hex trop courte");

const textKey = "Clé du prof !!!";
assert(keyMaterialBytes(textKey, "texte") === 16, "clé texte avec accent = 16 octets");
const textHex = resolveKeyHex(textKey, "texte");
assert(textHex !== null && textHex.length === 32, "clé texte résolue");
assert(hexToUtf8(textHex!) === textKey, "retour au texte");
assert(resolveKeyHex("CleSecrete-12345", "texte") !== null, "clé texte en majuscules");
assert(keyError("BONJOUR", "texte")?.includes("16 octets"), "erreur clé texte trop courte");
assert(keyError(upperHex, "hex") === null, "clé hex majuscule acceptée");

const switched = switchKeyDraft(textKey, "texte", "hex");
assert(switched.format === "hex" && switched.draft === textHex, "texte vers hex");
const back = switchKeyDraft(switched.draft, "hex", "texte");
assert(back.format === "texte" && back.draft === textKey, "hex vers texte");
const stuck = switchKeyDraft(lowerHex, "hex", "texte");
assert(stuck.format === "texte" && stuck.draft === "" && stuck.note !== null, "FIPS n’est pas du texte");

assert(keyForBob("aa", "bb", false) === "aa", "Bob suit Alice s’il n’a pas choisi");
assert(keyForBob("aa", "bb", true) === "bb", "Bob garde sa clé");
assert(keyForBob("aa", null, true) === null, "clé de Bob vide");

const message = "BONJOUR CLASSE !";
assert(new TextEncoder().encode(message).length === 16, "message majuscules = 16 octets");
const accent = "ÉLÈVE MODÈLE!";
assert(new TextEncoder().encode(accent).length === 16, "message accentué = 16 octets");

console.log("keyMaterial ok");
