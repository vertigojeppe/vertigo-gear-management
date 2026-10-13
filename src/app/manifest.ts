import type { MetadataRoute } from "next";
import { appConfig } from "../../config/app.config";

/**
 * Web app manifest: lets phones install the app on the home screen
 * (standalone window, own icon). Served at /manifest.webmanifest and let
 * through the login redirect in proxy.ts.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appConfig.name,
    short_name: appConfig.name,
    description: "Gear inventory, packing lists and production plans.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0f",
    theme_color: "#0b0b0f",
    lang: "da",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Scan", url: "/scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Projects", url: "/projects", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Inventory", url: "/inventory", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
