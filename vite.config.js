import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { buildInfo } from "./scripts/build-info.mjs";
const info = buildInfo();
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(info.version) },
  plugins: [
    vue(),
    {
      name: "build-version",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify(info, null, 2) + "\n",
        });
      },
    },
  ],
});
