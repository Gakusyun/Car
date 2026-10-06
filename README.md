# 挪车提醒

贴在车上的二维码指向的静态页面：扫码者可以看到车牌、车型和邮箱，点击「发送挪车信息」后向车主手机推送通知。

- 纯静态、无后端（serverless），React 19 + Vite + Tailwind CSS v4
- 主要适配手机竖屏
- 页面不出现 Bark 字样，接口地址与设备令牌分开存放（base64），运行时解码
- 所有配置均由环境变量在编译时注入，页面上不提供任何修改入口

## 使用

```bash
pnpm install
pnpm dev      # 开发
pnpm build    # 产物在 dist/
pnpm test     # 加密自测：与 OpenSSL 交叉验证 + 官方文档示例向量
```

## 环境变量

复制 `.env.example` 为 `.env` 后填写（`.env` 已 gitignore）：

| 变量 | 说明 |
|------|------|
| `VITE_PLATE` | 车牌号 |
| `VITE_CAR` | 颜色 + 车型 |
| `VITE_EMAIL` | 联系邮箱（页面展示 + mailto） |
| `VITE_ICON` | 通知图标 URL（可选，留空用内置默认图） |
| `VITE_ICP` | ICP 备案号（可选，留空则备案行不显示） |
| `VITE_GA` | 公安备案号（可选，留空则备案行与公安备案图标都不显示） |
| `VITE_P1` | 接口地址 base64，POST 目标，如 `printf %s "https://xxx/push" \| base64` |
| `VITE_P2` | 设备令牌 base64，随请求体提交 |
| `VITE_ALGO` | 加密算法 `AES128` / `AES192` / `AES256`（可选，缺省 AES256） |
| `VITE_MODE` | 加密模式 `CBC` / `ECB` / `GCM`（可选，缺省 CBC） |
| `VITE_PAD` | 填充 `pkcs7` / `noPadding`（可选，缺省 pkcs7） |
| `VITE_KEY` | 密钥 base64，如 `printf %s "32位密钥" \| base64`；留空则明文推送 |
| `VITE_IV` | IV，留空则每次随机生成（CBC 16 位 / GCM 12 位 / ECB 不需要） |

部署到托管平台时，把同样的变量配到平台的环境变量里即可。

## 行为

- 发送成功（网络送达）→ toast「✓ 车主已收到通知」，30 秒后自动消失
- 发送失败 → toast「服务器错误，请使用其他方式联系」（邮箱兜底），30 秒 后自动消失
- 60 秒内重复点击（localStorage 记录时间戳）→ toast「操作频繁，请稍后再试」，3 秒后消失；按钮样式始终保持不变，仅飞行中静默去重
- 推送参数：`title=挪车提醒 · 车牌`、`group=挪车`、`level=timeSensitive`、`ttl=600`
- 请求方式：POST `application/x-www-form-urlencoded` 到 `VITE_P1`，`device_key` 放在请求体
  （urlencoded 属于 CORS 简单请求头，`no-cors` 下不触发预检，服务器按表单解析）
- 配置了 `VITE_KEY` 且校验通过 → 加密推送：推送参数先转成 JSON 字符串，用 WebCrypto 按
  `VITE_ALGO`/`VITE_MODE`/`VITE_PAD` 加密，只发 `ciphertext` + `iv` + `device_key`；
  算法、密钥必须与手机端保存的加密设置一致，否则手机端显示 Decryption Failed
- 未配置加密（`VITE_KEY` 为空或不合法）→ 明文推送，参数直接随请求体发送
