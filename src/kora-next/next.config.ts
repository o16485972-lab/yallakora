import type { NextConfig } from "next";

/* KORA_STATIC=1 يحوّل نفس التطبيق إلى تصدير ثابت كامل للنشر على GitHub Pages */
const nextConfig: NextConfig =
  process.env.KORA_STATIC === "1"
    ? { output: "export", trailingSlash: true, images: { unoptimized: true } }
    : {};

export default nextConfig;
