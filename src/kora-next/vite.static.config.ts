import { defineConfig } from "vite";
import vinext from "vinext";

/* نسخة ثابتة من نفس تطبيق Next — تُنشر على GitHub Pages / yallakora.mooo.com */
export default defineConfig({
  plugins: [vinext()],
  build: { outDir: "dist-static", emptyOutDir: true },
});
