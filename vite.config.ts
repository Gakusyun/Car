import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// ponytail: 相对 base，GitHub Pages 子路径 / Vercel dist 静态托管都可用
export default defineConfig(({ mode }) => {
  // .env 中直接填明文，构建时统一 base64 编码后注入，产物中不出现明文
  const env = loadEnv(mode, process.cwd(), "");
  const b64 = (v: string | undefined): string =>
    v ? Buffer.from(v).toString("base64") : "";

  return {
    base: "./",
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_PUSH_URL": JSON.stringify(b64(env.VITE_PUSH_URL)),
      "import.meta.env.VITE_DEVICE_KEY": JSON.stringify(
        b64(env.VITE_DEVICE_KEY),
      ),
      "import.meta.env.VITE_KEY": JSON.stringify(b64(env.VITE_KEY)),
    },
  };
});
