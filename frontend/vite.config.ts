import { env } from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxyTarget = env.APP_HTTP_URL;

export default defineConfig({
  define: {
    "process.env": process.env,
    _WORKLET: false,
    __DEV__: env.DEV,
    global: {},
  },
  plugins: [react()],
  server: {
    strictPort: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, "/api"),
      },
    },
  },
});
