import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dynamic rendering by default. Cache Components (PPR + "use cache") are
  // deliberately off: every page here is behind login and reads live data.
  // See DECISIONS.md.
  output: "standalone",
  // Dev only: let phones and other machines on the local network load the
  // dev server (HMR, scripts) when testing via http(s)://<pc-ip>:3000.
  // Add more hostnames with DEV_ORIGINS="name.local,other.host".
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
    ...(process.env.DEV_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
