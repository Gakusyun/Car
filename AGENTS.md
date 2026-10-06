# AGENTS.md — 挪车提醒（car）

贴在车上的二维码指向的静态页面：访客查看车辆信息，点击「发送挪车信息」向车主手机发 Bark 推送。
React 19 + Vite + Tailwind CSS v4，纯静态产物（`dist/`），无后端、无容器。

## 硬性约束（不可违背）

1. **配置只来自编译时环境变量**
   - 车辆信息、接口地址、设备令牌、加密配置、备案号全部通过 `VITE_*` 注入（见 README 环境变量表）。
   - 页面上**不允许**出现任何配置/设置入口（曾有 `?settings` 面板，已按需求移除，不要重新加回），
     也不允许用 localStorage 覆盖加密配置——配置只能由所有者改环境变量后重新构建。
   - `.env` 已 gitignore，**绝不提交**；新增环境变量时必须同步更新 `.env.example` 与 README 表格。
2. **页面不出现 Bark 字样**，包括报错 toast、注释以外的任何用户可见文案。
3. **密钥与设备令牌必须放请求体**
   - 请求方式固定为 `POST` + `application/x-www-form-urlencoded` + `mode: "no-cors"`。
   - 服务器不返回 CORS 头且预检 `OPTIONS` 返回 400，**禁止**改成 `application/json`
     （会触发预检被浏览器拦截）；urlencoded 是 CORS 简单请求头，no-cors 下可直接携带。
   - 接口地址（`VITE_P1`）与设备令牌（`VITE_P2`）在构建产物中保持 base64，运行时解码。
4. **备案信息按环境变量显示**：`VITE_ICP`、`VITE_GA` 任一为空则该行不显示；
   `VITE_GA` 为空时公安备案图标（img）也必须一并隐藏。两者都为空时整个 footer 不渲染。
5. **加密实现只用浏览器 WebCrypto**，不引入任何第三方加密库（`src/aes.ts`）。
   - 必须与手机端 App 的加密设置兼容：AES128/192/256 × CBC/ECB/GCM × PKCS7/无填充，
     密钥 16/24/32 位 ASCII，IV 为 ASCII 字符串（CBC 16 位 / GCM 12 位 / ECB 不需要），
     GCM 输出 = 密文 ‖ 16 字节 tag，PKCS7 语义与 CryptoSwift 一致（GCM 选 PKCS7 时先填充）。
   - IV 未配置则每次随机生成，**始终随 `iv` 参数一起发送**（App 端优先用参数里的 iv）。
   - `VITE_KEY` 为空或配置校验不通过 → 回退为明文推送，不得报错。
6. **推送行为不变量**
   - 60 秒冷却：发送时才检查（不倒计时、不改按钮样式），时间戳先写入再发送，
     飞行中的重复点击静默去重。
   - toast：成功/失败 30 秒，频繁提示 3 秒；反馈统一用 toast，不得内嵌进卡片。
   - no-cors 响应不透明，`fetch` resolve 即视为送达，保持现状。

## 代码结构与风格

- `src/App.tsx` — 页面与发送逻辑（单组件，无路由）；`src/aes.ts` — 加密模块（纯函数，禁止访问
  `import.meta.env`/DOM UI，便于 Node 直接测试）；`src/components/ui.tsx` — 共享组件。
- 样式规范以 **STYLE.md 为唯一权威**：只用 Tailwind utility class、只用默认色板（sky/slate/emerald/rose）、
  所有颜色必须带 `dark:` 变体、输入框统一用 `INPUT` 常量、容器复用 `Card`/`SmallBtn`。
- 页面主要适配手机竖屏，改动需在窄屏下检查。
- TypeScript 严格模式（`strict`、`noUnusedLocals`、`verbatimModuleSyntax`），注意 TS 5.7+ 的
  `Uint8Array<ArrayBuffer>` 泛型：传给 WebCrypto 的 buffer 需为 `Uint8Array<ArrayBuffer>` 类型。

## 常用命令

```bash
pnpm dev      # 开发
pnpm build    # tsc && vite build（提交前必须通过）
pnpm test     # test/aes.test.ts：与 OpenSSL 交叉验证 + 官方文档示例向量（提交前必须通过）
```

- Node 24 + pnpm（Windows / Git Bash），无 Docker、无 make。
- `pnpm test` 中的官方文档向量（`HL0br...`、`+aPt5...`）是兼容性基准，不允许为过测试而改动期望值。

## 提交规范

- 提交前依次确认：`pnpm build` ✓、`pnpm test` ✓。
- 只提交源码与配置模板，`dist/`、`.env`、`node_modules/`、`.playwright-cli/` 已忽略。
- 提交信息用中文，概括改动动机与影响，推送到 `origin/main`（github.com/Gakusyun/Car）。
