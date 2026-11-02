import { encryptBlock, decryptBlock, toHex, fromHex, utf8 } from "../src/lib/aes128.ts";
const k = fromHex("000102030405060708090a0b0c0d0e0f")!, p = fromHex("00112233445566778899aabbccddeeff")!;
const c = encryptBlock(p, k);
console.log("FIPS enc", toHex(c), toHex(c) === "69c4e0d86a7b0430d8cdb78070b4c55a");
console.log("FIPS dec", toHex(decryptBlock(c, k)) === toHex(p));
const m = utf8("Bonjour la classe".slice(0,16)), kk = utf8("cle-secrete-1234");
const cc = encryptBlock(m, kk);
console.log("roundtrip", toHex(cc), new TextDecoder().decode(decryptBlock(cc, kk)));
try { encryptBlock(utf8("court"), kk); } catch (e) { console.log("refus:", (e as Error).message); }
