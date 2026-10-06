import { useEffect, useRef, useState } from "react";
import { Card, SmallBtn } from "./components/ui";
import {
  CryptoConfigError,
  encryptAes,
  validateCrypto,
  type Algorithm,
  type CryptoCfg,
  type Mode,
  type Padding,
} from "./aes";

/** 车辆与联系信息：构建时由环境变量注入 */
const PLATE = String(import.meta.env.VITE_PLATE ?? "");
const CAR = String(import.meta.env.VITE_CAR ?? "");
const EMAIL = String(import.meta.env.VITE_EMAIL ?? "");

/**
 * 通知接口地址与设备令牌分开存放，构建时自动 base64 编码，
 * 运行时解码，构建产物中不出现明文地址与令牌。令牌随请求体一起提交。
 */
const fromB64 = (v: unknown): string => {
  try {
    return atob(String(v ?? ""));
  } catch {
    return "";
  }
};
const PUSH_URL = fromB64(import.meta.env.VITE_PUSH_URL);
const DEVICE_KEY = fromB64(import.meta.env.VITE_DEVICE_KEY);

/** 通知图标：优先用环境变量 VITE_ICON，未配置则用默认图（需 iOS 15+） */
const ICON =
  String(import.meta.env.VITE_ICON ?? "").trim() ||
  "https://files.238806.xyz/file/oeGYM365.png";

/** 备案号：编译时由环境变量注入，未配置则对应备案信息（含公安备案图标）不显示 */
const ICP_NUM = String(import.meta.env.VITE_ICP ?? "").trim();
const GA_NUM = String(import.meta.env.VITE_GA ?? "").trim();

/** 加密推送配置：编译时由环境变量注入，页面上不提供任何修改入口 */
function envCrypto(): CryptoCfg {
  const algo = String(import.meta.env.VITE_ALGO ?? "").trim().toUpperCase();
  const mode = String(import.meta.env.VITE_MODE ?? "").trim().toUpperCase();
  const pad = String(import.meta.env.VITE_PAD ?? "").trim().toLowerCase();
  return {
    algorithm: (algo || "AES256") as Algorithm,
    mode: (mode || "CBC") as Mode,
    padding: (pad === "nopadding" ? "noPadding" : "pkcs7") as Padding,
    key: fromB64(import.meta.env.VITE_KEY),
    iv: String(import.meta.env.VITE_IV ?? "").trim(),
  };
}

/**
 * 加密配置需通过校验才生效：未配置或不合法（密钥长度等）则回退为明文推送。
 * 算法与密钥必须与手机端保存的加密设置一致，否则手机端会显示 Decryption Failed。
 */
const CRYPTO_CFG: CryptoCfg | null = (() => {
  const cfg = envCrypto();
  return validateCrypto(cfg) ? null : cfg;
})();

const COOLDOWN_KEY = "car-notify-last";
const COOLDOWN_MS = 60_000;

type ToastKind = "ok" | "err" | "warn";
type Toast = { id: number; kind: ToastKind; text: string };

const TOAST_MS: Record<ToastKind, number> = {
  ok: 30_000,
  err: 30_000,
  warn: 3_000,
};

const TOAST_STYLE: Record<ToastKind, string> = {
  ok: "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400",
  err: "border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400",
  warn: "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function App() {
  const [toast, setToast] = useState<Toast | null>(null);
  const inflight = useRef(false);
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(copyTimer.current);
    },
    [],
  );

  function showToast(kind: ToastKind, text: string) {
    setToast({ id: Date.now(), kind, text });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(
      () => setToast(null),
      TOAST_MS[kind],
    );
  }

  async function send() {
    if (inflight.current) return;
    // 发送时才检查间隔：不倒计时、不改按钮样式
    const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
    if (Date.now() - last < COOLDOWN_MS) {
      showToast("warn", "操作频繁，请稍后再试");
      return;
    }
    // 先写时间戳：飞行中的重复点击也会落进 60 秒拦截
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    inflight.current = true;
    try {
      if (!PUSH_URL || !DEVICE_KEY) throw new Error("missing endpoint");
      const d = new Date();
      const payload: Record<string, string> = {
        title: `挪车提醒 · ${PLATE}`,
        body: `有人请求你挪车 ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        group: "挪车",
        icon: ICON,
        level: "timeSensitive",
        ttl: "600",
      };
      const body = new URLSearchParams();
      if (CRYPTO_CFG) {
        // 加密推送：参数转 JSON 字符串，用编译时注入的秘钥加密，只发密文与 iv
        const { ciphertext, iv } = await encryptAes(CRYPTO_CFG, JSON.stringify(payload));
        body.set("ciphertext", ciphertext);
        if (iv) body.set("iv", iv);
      } else {
        for (const [k, v] of Object.entries(payload)) body.set(k, v);
      }
      // 设备令牌放请求体：urlencoded 属于 CORS 简单请求头，no-cors 下可直接携带
      body.set("device_key", DEVICE_KEY);
      // no-cors 简单 POST：通知照发，浏览器不校验跨域；resolve=已送达网络
      await fetch(PUSH_URL, {
        method: "POST",
        mode: "no-cors",
        cache: "no-store",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      showToast("ok", "✓ 车主已收到通知");
    } catch (e) {
      showToast(
        "err",
        e instanceof CryptoConfigError
          ? "加密配置有误，请使用其他方式联系"
          : "服务器错误，请使用其他方式联系",
      );
    } finally {
      inflight.current = false;
    }
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪贴板不可用则忽略，邮箱文字本身可长按复制 */
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-800 dark:text-slate-100">
      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          挪车提醒
        </h1>

        <Card title="车辆信息">
          <div className="flex items-baseline justify-between gap-3">
            <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
              车牌号
            </span>
            <span className="text-2xl font-bold tabular-nums text-right break-all text-slate-900 dark:text-slate-100">
              {PLATE}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
              车型
            </span>
            <span className="text-sm text-right text-slate-700 dark:text-slate-300">
              {CAR}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
              邮箱
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm break-all select-all text-slate-700 dark:text-slate-300">
                {EMAIL}
              </span>
              <SmallBtn onClick={copyEmail}>{copied ? "已复制" : "复制"}</SmallBtn>
              <SmallBtn href={`mailto:${EMAIL}?subject=${encodeURIComponent(`挪车 · ${PLATE}`)}`}>
                发邮件
              </SmallBtn>
            </div>
          </div>

          <button
            type="button"
            onClick={send}
            className="w-full px-4 py-3 rounded-lg bg-sky-600 border border-sky-600 text-white text-base font-medium transition-colors active:bg-sky-700"
          >
            发送挪车信息
          </button>
        </Card>

        {(ICP_NUM || GA_NUM) && (
          <footer className="text-center text-xs text-slate-300 dark:text-slate-600 pt-4 space-y-1">
            {ICP_NUM && (
              <a
                href="https://beian.miit.gov.cn"
                target="_blank"
                rel="noreferrer"
                className="block hover:text-slate-400"
              >
                {ICP_NUM}
              </a>
            )}
            {GA_NUM && (
              <div className="inline-flex items-center gap-1">
                <img
                  src="https://files.238806.xyz/file/nH4VT558.webp"
                  alt="公安备案"
                  className="w-3.5 h-4 inline"
                />
                <a
                  href="https://beian.mps.gov.cn"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-slate-400"
                >
                  {GA_NUM}
                </a>
              </div>
            )}
          </footer>
        )}
      </div>

      {/* 提示 toast：底部居中，成功/失败 30 秒、频繁提示 3 秒 */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)]"
        >
          <div
            className={
              "px-4 py-2.5 rounded-lg border bg-white dark:bg-black shadow-xl text-sm font-medium " +
              TOAST_STYLE[toast.kind]
            }
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}
