import { defineConfig, loadEnv } from "vite";
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";


export default ({ mode }: { mode: string }) => {
  // Load the .env file from the root of the project, and allow it to read variables starting with `API_`
  process.env = {...process.env, ...loadEnv(mode, `${process.cwd()}/../`, "API_")};

  // Configure Vite
  return defineConfig({
    base: "/s2118232/",
    plugins: [
      legacy({ targets: ["defaults", "iOS 10", "iOS 10.3"] }),
      nodePolyfills(), 
      react()
    ],
    server: {
      proxy: {
        "/api": {
          target: process.env.API_HTTP_URL,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, "/"),
          // Enable for detailed API interaction logs in the console
          // configure: (proxy, _options) => {
          //   proxy.on('error', (err, _req, _res) => {
          //     console.log('proxy error', err);
          //   });
          //   proxy.on('proxyReq', (proxyReq, req, _res) => {
          //     console.log('Sending Request to the Target:', req.method, req.url);
          //   });
          //   proxy.on('proxyRes', (proxyRes, req, _res) => {
          //     console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          //   });
          // }
        }
      }
    }
  });
}
