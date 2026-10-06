/**
 * 加密模块自测：与 Node 的 OpenSSL 实现交叉验证 + Bark 官方文档示例向量
 * 运行：pnpm dlx tsx test/aes.test.ts
 */
import { createCipheriv } from "node:crypto";
import {
  CryptoConfigError,
  encryptAes,
  validateCrypto,
  type Algorithm,
  type CryptoCfg,
  type Mode,
  type Padding,
} from "../src/aes.ts";

const encoder = new TextEncoder();
let failed = 0;

function check(name: string, actual: string, expected: string) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) console.log(`  actual:   ${actual}\n  expected: ${expected}`);
}

/** 用 Node/OpenSSL 独立计算期望密文 */
function opensslCipher(
  cfg: { algorithm: Algorithm; mode: Mode; padding: Padding; key: string; iv: string },
  plaintext: string,
): string {
  const keyBytes = { AES128: 16, AES192: 24, AES256: 32 }[cfg.algorithm];
  const isGCM = cfg.mode === "GCM";
  const cipherName = `aes-${keyBytes * 8}-${cfg.mode.toLowerCase()}`;
  const key = Buffer.from(cfg.key, "utf8");
  const iv = cfg.mode === "ECB" ? null : Buffer.from(cfg.iv, "utf8");
  const cipher = createCipheriv(cipherName as never, key as never, iv as never);
  let data = Buffer.from(plaintext, "utf8");
  if (isGCM) {
    // App 端（CryptoSwift）选 PKCS7 时先填充再加密，OpenSSL 的 GCM 不做填充，手动补
    if (cfg.padding === "pkcs7") {
      const n = 16 - (data.length % 16);
      data = Buffer.concat([data, Buffer.alloc(n, n)]);
    }
  } else {
    cipher.setAutoPadding(cfg.padding === "pkcs7");
  }
  const out = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([out, isGCM ? cipher.getAuthTag() : Buffer.alloc(0)]).toString("base64");
}

async function main() {
  const DOC_IV = "bd4ec1f5e1592391";
  const DOC_KEY = "DtI72GVo4g3Scc40TIrrh1bR1shlUjuJ";
  const DOC_JSON = '{"body": "test", "sound": "birdsong"}';
  const DOC_IV2 = "1234567890123456";
  const DOC_KEY2 = "1234567890123456";
  const P16 = "0123456789abcdef"; // 无填充测试用 16 字节明文

  // 1) 官方文档示例向量
  let r = await encryptAes(
    { algorithm: "AES256", mode: "CBC", padding: "pkcs7", key: DOC_KEY, iv: DOC_IV },
    DOC_JSON,
  );
  check(
    "doc: AES256-CBC-PKCS7 (官方示例)",
    r.ciphertext,
    "HL0brCWNYxrRawdnIYe0JcBZ37xer3NILaAYEKubTikfMoghaB7SbKQTo+68oH0h",
  );
  check("doc: iv 参数原样返回", r.iv, DOC_IV);

  r = await encryptAes(
    { algorithm: "AES128", mode: "CBC", padding: "pkcs7", key: DOC_KEY2, iv: DOC_IV2 },
    DOC_JSON,
  );
  check(
    "doc: AES128-CBC-PKCS7 (官方示例)",
    r.ciphertext,
    "+aPt5cwN9GbTLLSFri60l3h1X00u/9j1FENfWiTxhNHVLGU+XoJ15JJG5W/d/yf0",
  );

  // 2) 与 OpenSSL 交叉验证全组合
  const keys: Record<Algorithm, string> = {
    AES128: "1234567890123456",
    AES192: "123456789012345678901234",
    AES256: DOC_KEY,
  };
  const ivs: Record<Mode, string> = { CBC: DOC_IV, ECB: "", GCM: "1234567890ab" };
  for (const algorithm of ["AES128", "AES192", "AES256"] as Algorithm[]) {
    for (const mode of ["CBC", "ECB", "GCM"] as Mode[]) {
      for (const padding of ["pkcs7", "noPadding"] as Padding[]) {
        // 无填充要求明文为 16 字节倍数（与 App 端一致）
        const text = padding === "noPadding" ? P16 : DOC_JSON;
        const cfg: CryptoCfg = { algorithm, mode, padding, key: keys[algorithm], iv: ivs[mode] };
        r = await encryptAes(cfg, text);
        check(`${algorithm}-${mode}-${padding}`, r.ciphertext, opensslCipher(cfg, text));
      }
    }
  }

  // 3) 随机 IV：留空时每次生成，且能被 OpenSSL 解回明文
  const { createDecipheriv } = await import("node:crypto");
  for (let i = 0; i < 3; i++) {
    r = await encryptAes(
      { algorithm: "AES256", mode: "CBC", padding: "pkcs7", key: DOC_KEY, iv: "" },
      DOC_JSON,
    );
    if (r.iv.length !== 16) {
      failed++;
      console.log(`FAIL 随机 IV 长度应为 16，实际 ${r.iv.length}`);
    }
    const d = createDecipheriv("aes-256-cbc", Buffer.from(DOC_KEY), Buffer.from(r.iv));
    const plain = Buffer.concat([d.update(Buffer.from(r.ciphertext, "base64")), d.final()]).toString();
    check(`随机 IV 第 ${i + 1} 次可解密`, plain, DOC_JSON);
  }

  // 4) 校验规则（与 App 端一致）
  const expectErr = (name: string, cfg: Partial<CryptoCfg>, part: string) => {
    const msg = validateCrypto(cfg);
    const ok = msg !== null && msg.includes(part);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${msg ? `（${msg}）` : ""}`);
  };
  expectErr(
    "校验: 密钥长度",
    { algorithm: "AES256", mode: "CBC", padding: "pkcs7", key: "short", iv: "" },
    "32",
  );
  expectErr(
    "校验: IV 长度",
    { algorithm: "AES256", mode: "CBC", padding: "pkcs7", key: DOC_KEY, iv: "short" },
    "16",
  );
  expectErr("校验: 填充方式", { algorithm: "AES256", mode: "CBC", padding: "bad" as Padding, key: DOC_KEY, iv: "" }, "填充");

  // 5) 无填充且明文非 16 倍数 → 运行期抛配置错误
  try {
    await encryptAes(
      { algorithm: "AES256", mode: "CBC", padding: "noPadding", key: DOC_KEY, iv: DOC_IV },
      "not 16 bytes!!",
    );
    failed++;
    console.log("FAIL 无填充非 16 倍数应抛错");
  } catch (e) {
    const ok = e instanceof CryptoConfigError;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} 无填充非 16 倍数抛 CryptoConfigError`);
  }

  console.log(failed === 0 ? "\n全部通过 ✓" : `\n${failed} 项失败 ✗`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
