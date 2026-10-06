# 挪车提醒 · 样式规范

> 使用 Tailwind CSS v4，所有样式通过 utility class 实现。`src/style.css` 仅含 `@import "tailwindcss"` 与全局隐藏滚动条（`html::-webkit-scrollbar { display: none }`）。
> 基础 UI 沿用 salary-calc 的风格，新增页面/组件必须遵守本规范。

## 色彩

仅用 Tailwind 默认色系，不自定义颜色：

| 用途 | Tailwind class |
|------|---------------|
| 页面/卡片背景 | `bg-white`（深色 `dark:bg-black`） |
| 正文文字 | `text-slate-800` / `text-slate-900` |
| 次要文字 | `text-slate-500` / `text-slate-600` |
| 标题文字 | `text-slate-700` / `text-slate-900` |
| 强调色（主按钮/聚焦环） | `sky` 系列（`bg-sky-600`, `border-sky-500`, `text-sky-600`） |
| 成功提示 | `emerald` 系列（`text-emerald-600`, `border-emerald-300`） |
| 错误/危险提示 | `rose` 系列（`text-rose-500`, `border-rose-300`） |
| 中性/频繁等提醒 | `slate` 系列 |
| 边框/分割线 | `border-slate-200` / `border-slate-700` |

所有颜色必须配 `dark:` 变体，深色模式下不可缺。

## 组件复用

使用 `src/components/ui.tsx` 中的共享组件，不要重复写相同结构：

- `Card` — 白色圆角卡片容器（`space-y-3 p-4`，可带右上角 action）
- `SmallBtn` — 卡片右上角/行内小按钮（可为 `button` 或 `a` 链接）

反馈提示统一用 App 内的 toast（见下「Toast 提示」），不要把反馈文字内嵌进卡片。

## 输入框

统一样式，使用 `INPUT` 常量（`src/components/ui.tsx`）：

```
px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-black text-sm focus:border-sky-500 dark:focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 w-full
```

## 间距

| 用途 | class |
|------|-------|
| 页面容器 padding | `px-4 py-6` |
| 页面卡片间间距 | `space-y-5` |
| 卡片内间距 | `space-y-3` |
| 网格间距 | `gap-3` |
| 卡片 padding | `p-4` |

页面容器宽度：`mx-auto max-w-lg`（竖屏手机优先）。

## 圆角

| 元素 | class |
|------|-------|
| 卡片 | `rounded-xl` |
| 按钮 | `rounded-lg` |
| 输入框/select | `rounded-md` |
| toast | `rounded-lg` |

## Toast 提示

所有反馈（成功/失败/频繁限制）一律 toast，不内嵌页面：

- 位置：`fixed bottom-6 left-1/2 -translate-x-1/2 z-50`，最大宽 `max-w-[calc(100vw-2rem)]`
- 内卡：`px-4 py-2.5 rounded-lg border bg-white dark:bg-black shadow-xl text-sm font-medium`
- 语义色：成功 emerald / 失败 rose / 中性 slate（见「色彩」表）
- 时长：成功与失败 30 秒，中性提醒 3 秒（`TOAST_MS`）
- 必须带 `role="status"` 与 `aria-live="polite"`

## 禁止事项

- ❌ 不要在 `style.css` 中写自定义 CSS（全局滚动条隐藏除外）
- ❌ 不要用 inline style
- ❌ 不要引入新的颜色值——只用 Tailwind 默认 slate/sky/emerald/rose
- ❌ 不要自建新的共享组件——先看 `ui.tsx` 是否已有
- ❌ 不要把反馈提示写死在卡片里——一律 toast
