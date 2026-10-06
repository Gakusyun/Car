import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// ponytail: 相对 base，GitHub Pages 子路径 / Vercel dist 静态托管都可用
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
