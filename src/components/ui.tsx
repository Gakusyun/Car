import type { ReactNode } from "react";

/** 输入框统一样式（见 STYLE.md） */
export const INPUT =
  "px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-black text-sm focus:border-sky-500 dark:focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 w-full";

/** 白色圆角分区卡片，可带右上角操作按钮 */
export function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-black rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm dark:shadow-none space-y-3">
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** 卡片右上角小按钮（链接或按钮） */
export function SmallBtn({
  onClick,
  href,
  children,
}: {
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const cls =
    "text-xs px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-black transition-colors";
  return href ? (
    <a href={href} className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
