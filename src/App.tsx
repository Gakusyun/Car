import { useEffect, useRef, useState } from "react";
import { Card, SmallBtn } from "./components/ui";

/** 车辆与联系信息：构建时由环境变量注入 */
const PLATE = String(import.meta.env.VITE_PLATE ?? "");
const CAR = String(import.meta.env.VITE_CAR ?? "");
const EMAIL = String(import.meta.env.VITE_EMAIL ?? "");

/**
 * 通知接口地址与令牌分开存放（各为 base64），运行时解码拼接，
 * 构建产物中不出现明文地址与令牌。
 */
const ENDPOINT = (() => {
  try {
    return (
      atob(String(import.meta.env.VITE_P1 ?? "")) +
      atob(String(import.meta.env.VITE_P2 ?? ""))
    );
  } catch {
    return "";
  }
})();

/** 通知图标（需 iOS 15+），可换成任意可访问的图片 URL（如自己车的照片） */
const ICON =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@v14.0.2/assets/72x72/1f697.png";

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
      if (!ENDPOINT) throw new Error("missing endpoint");
      const d = new Date();
      const q = new URLSearchParams({
        title: `挪车提醒 · ${PLATE}`,
        body: `有人请求你挪车 ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        group: "挪车",
        icon: ICON,
        level: "timeSensitive",
        ttl: "600",
      });
      // no-cors 简单 GET：通知照发，浏览器不校验跨域；resolve=已送达网络
      await fetch(`${ENDPOINT}?${q.toString()}`, {
        mode: "no-cors",
        cache: "no-store",
      });
      showToast("ok", "✓ 车主已收到通知");
    } catch {
      showToast("err", "服务器错误，请使用其他方式联系");
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
        </Card>

        <Card>
          <button
            type="button"
            onClick={send}
            className="w-full px-4 py-3 rounded-lg bg-sky-600 border border-sky-600 text-white text-base font-medium transition-colors active:bg-sky-700"
          >
            发送挪车信息
          </button>
        </Card>

        <footer className="text-center text-xs text-slate-300 dark:text-slate-600 pt-4 space-y-1">
          <a
            href="https://beian.miit.gov.cn"
            target="_blank"
            rel="noreferrer"
            className="block hover:text-slate-400"
          >
            鄂ICP备2024069158号
          </a>
          <div className="inline-flex items-center gap-1">
            <img
              src="https://start.gxj62.cn/police.webp"
              alt="公安备案"
              className="w-3.5 h-4 inline"
            />
            <a
              href="https://beian.mps.gov.cn"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-400"
            >
              鄂公网安备42050002420933号
            </a>
          </div>
        </footer>
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
