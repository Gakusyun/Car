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

const COOLDOWN_KEY = "car-notify-last";
const COOLDOWN_SECONDS = 60;
const FEEDBACK_MS = 30_000;

type Feedback = "ok" | "err";

function remainSeconds(): number {
  const last = Number(localStorage.getItem(COOLDOWN_KEY) || 0);
  return Math.max(0, Math.ceil((last + COOLDOWN_SECONDS * 1000 - Date.now()) / 1000));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function App() {
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [remain, setRemain] = useState(remainSeconds);
  const [copied, setCopied] = useState(false);
  const fbTimer = useRef<number | undefined>(undefined);

  // 冷却倒计时：每秒刷新，归零自动停止
  useEffect(() => {
    if (remain <= 0) return;
    const t = window.setInterval(() => setRemain(remainSeconds()), 1000);
    return () => window.clearInterval(t);
  }, [remain]);

  // 反馈提示 30 秒后自动清除
  useEffect(() => () => window.clearTimeout(fbTimer.current), []);

  function showFeedback(v: Feedback) {
    setFeedback(v);
    window.clearTimeout(fbTimer.current);
    fbTimer.current = window.setTimeout(() => setFeedback(null), FEEDBACK_MS);
  }

  async function send() {
    if (sending || remain > 0) return;
    setSending(true);
    // 点击即起算冷却，防止反复点击
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    setRemain(COOLDOWN_SECONDS);
    try {
      if (!ENDPOINT) throw new Error("missing endpoint");
      const d = new Date();
      const q = new URLSearchParams({
        title: `挪车提醒 · ${PLATE}`,
        body: `有人请求你挪车 ${pad(d.getHours())}:${pad(d.getMinutes())}`,
        group: "挪车",
        level: "timeSensitive",
        ttl: "600",
      });
      // no-cors 简单 GET：通知照发，浏览器不校验跨域；resolve=已送达网络
      await fetch(`${ENDPOINT}?${q.toString()}`, {
        mode: "no-cors",
        cache: "no-store",
      });
      showFeedback("ok");
    } catch {
      showFeedback("err");
    } finally {
      setSending(false);
    }
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
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
            disabled={sending || remain > 0}
            className="w-full px-4 py-3 rounded-lg bg-sky-600 border border-sky-600 text-white text-base font-medium transition-colors disabled:bg-slate-300 disabled:border-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700 dark:disabled:border-slate-700 dark:disabled:text-slate-400"
          >
            {sending
              ? "发送中…"
              : remain > 0
                ? `${remain} 秒后可再次发送`
                : "发送挪车信息"}
          </button>
          {feedback === "ok" && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              ✓ 车主已收到通知
            </p>
          )}
          {feedback === "err" && (
            <p className="text-sm text-rose-500 dark:text-rose-400">
              服务器错误，请使用其他方式联系
            </p>
          )}
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
    </div>
  );
}
