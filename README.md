# 挪车提醒

贴在车上的二维码指向的静态页面：扫码者可以看到车牌、车型和邮箱，点击「发送挪车信息」后向车主手机推送通知。

- 纯静态、无后端（serverless），React 19 + Vite + Tailwind CSS v4
- 主要适配手机竖屏
- 页面不出现 Bark 字样，接口地址与令牌分开存放（base64），运行时才拼接

## 使用

```bash
pnpm install
pnpm dev      # 开发
pnpm build    # 产物在 dist/
```

## 环境变量

复制 `.env.example` 为 `.env` 后填写（`.env` 已 gitignore）：

| 变量 | 说明 |
|------|------|
| `VITE_PLATE` | 车牌号 |
| `VITE_CAR` | 颜色 + 车型 |
| `VITE_EMAIL` | 联系邮箱（页面展示 + mailto） |
| `VITE_P1` | 接口地址 base64，如 `printf %s "https://xxx/" \| base64` |
| `VITE_P2` | 令牌 base64 |

部署到托管平台时，把同样的变量配到平台的环境变量里即可。

## 行为

- 发送成功（网络送达）→ toast「✓ 车主已收到通知」，30 秒后自动消失
- 发送失败 → toast「服务器错误，请使用其他方式联系」（邮箱兜底），30 秒 后自动消失
- 60 秒内重复点击（localStorage 记录时间戳）→ toast「操作频繁，请稍后再试」，3 秒后消失；按钮样式始终保持不变，仅飞行中静默去重
- 推送参数：`title=挪车提醒 · 车牌`、`group=挪车`、`level=timeSensitive`、`ttl=600`
