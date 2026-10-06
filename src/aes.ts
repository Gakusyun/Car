/**
 * AES 加密推送：把 Bark 请求参数转成 JSON 字符串，用密钥加密成 ciphertext，
 * 与 Bark App「加密推送」的算法设置保持一致（AES128/192/256 · CBC/ECB/GCM · PKCS7/无填充）。
 * 仅依赖浏览器 WebCrypto，不出现第三方库。
 */

export type Algorithm = "AES128" | "AES192" | "AES256";
export type Mode = "CBC" | "ECB" | "GCM";
export type Padding = "pkcs7" | "noPadding";

export type CryptoCfg = {
  algorithm: Algorithm;
  mode: Mode;
  padding: Padding;
  /** 密钥原文：AES128/192/256 分别要求 16/24/32 位 ASCII */
  key: string;
  /** IV 原文：CBC 16 位、GCM 12 位、ECB 不需要；留空则每次随机生成 */
  iv: string;
};

export const ALGORITHMS: Algorithm[] = ["AES128", "AES192", "AES256"];
export const MODES: Mode[] = ["CBC", "ECB", "GCM"];
export const PADDINGS: Padding[] = ["pkcs7", "noPadding"];
export const KEY_LENGTH: Record<Algorithm, number> = { AES128: 16, AES192: 24, AES256: 32 };
export const IV_LENGTH: Record<Mode, number> = { CBC: 16, ECB: 0, GCM: 12 };

/** 加密配置不合法（与 Bark App 的校验规则一致） */
export class CryptoConfigError extends Error {}

const BLOCK = 16;
const HEX = "0123456789abcdef";
const encoder = new TextEncoder();

/** 校验配置，合法返回 null，否则返回错误文案 */
export function validateCrypto(cfg: Partial<CryptoCfg>): string | null {
  if (!ALGORITHMS.includes(cfg.algorithm as Algorithm)) return "算法无效";
  if (!MODES.includes(cfg.mode as Mode)) return "模式无效";
  if (!PADDINGS.includes(cfg.padding as Padding)) return "填充方式无效";
  const keyLen = KEY_LENGTH[cfg.algorithm as Algorithm];
  if ((cfg.key ?? "").length !== keyLen) return `密钥必须 ${keyLen} 位`;
  if (encoder.encode(cfg.key ?? "").length !== keyLen) return "密钥必须为 ASCII 字符";
  const ivLen = IV_LENGTH[cfg.mode as Mode];
  if (ivLen > 0 && (cfg.iv ?? "").length > 0) {
    if (cfg.iv!.length !== ivLen) return `${cfg.mode} 模式 IV 必须 ${ivLen} 位`;
    if (encoder.encode(cfg.iv!).length !== ivLen) return "IV 必须为 ASCII 字符";
  }
  return null;
}

function randomAscii(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => HEX[b % 16]).join("");
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function pkcs7Pad(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const n = BLOCK - (bytes.length % BLOCK);
  const out = new Uint8Array(bytes.length + n);
  out.set(bytes);
  out.fill(n, bytes.length);
  return out;
}

function requireBlockMultiple(bytes: Uint8Array): Uint8Array {
  if (bytes.length % BLOCK !== 0) throw new CryptoConfigError("无填充要求明文为 16 字节倍数");
  return bytes;
}

/**
 * 单块加密 E(x)：WebCrypto 没有「不填充」接口，
 * 用 IV=0 对 (x ‖ x) 做一次带填充的 CBC，取前 16 字节即 E(x)。
 */
async function encryptBlock(key: CryptoKey, x: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const doubled = new Uint8Array(BLOCK * 2);
  doubled.set(x);
  doubled.set(x, BLOCK);
  const out = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-CBC", iv: new Uint8Array(BLOCK) }, key, doubled),
  );
  return out.slice(0, BLOCK);
}

/**
 * 加密推送参数 JSON 字符串。
 * 返回 ciphertext（base64）与使用的 iv（ECB 返回空串，表示不发送 iv 参数）。
 */
export async function encryptAes(
  cfg: CryptoCfg,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const invalid = validateCrypto(cfg);
  if (invalid) throw new CryptoConfigError(invalid);

  const rawKey = encoder.encode(cfg.key);
  const name = cfg.mode === "GCM" ? "AES-GCM" : "AES-CBC";
  const importKey = () => crypto.subtle.importKey("raw", rawKey, name, false, ["encrypt"]);
  // IV 未配置则每次随机生成（随 iv 参数一起发送，App 端优先用参数里的 iv）
  const ivLen = IV_LENGTH[cfg.mode];
  const ivStr = ivLen > 0 && !cfg.iv ? randomAscii(ivLen) : cfg.iv;
  const ivBytes = ivStr ? encoder.encode(ivStr) : new Uint8Array(0);
  const plain = encoder.encode(plaintext);
  const key = await importKey();

  if (cfg.mode === "GCM") {
    // App 端（CryptoSwift）选择 PKCS7 时会先填充再加密，这里保持一致
    const msg = cfg.padding === "pkcs7" ? pkcs7Pad(plain) : plain;
    const out = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivBytes, tagLength: 128 }, key, msg),
    );
    return { ciphertext: toBase64(out), iv: ivStr };
  }

  if (cfg.mode === "CBC" && cfg.padding === "pkcs7") {
    const out = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv: ivBytes }, key, plain));
    return { ciphertext: toBase64(out), iv: ivStr };
  }

  // CBC 无填充：C_i = E(P_i ⊕ C_{i-1})；ECB：C_i = E(P_i)（按块手动实现）
  const blocks = cfg.padding === "pkcs7" ? pkcs7Pad(plain) : requireBlockMultiple(plain);
  const out = new Uint8Array(blocks.length);
  let prev = ivBytes;
  for (let i = 0; i < blocks.length; i += BLOCK) {
    const block = blocks.subarray(i, i + BLOCK);
    const input =
      cfg.mode === "CBC"
        ? block.map((b, j) => b ^ prev[j])
        : block;
    const enc = await encryptBlock(key, input);
    out.set(enc, i);
    prev = enc;
  }
  return { ciphertext: toBase64(out), iv: ivStr };
}
