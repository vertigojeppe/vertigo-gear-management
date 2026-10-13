import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/**
 * Renders the app icon (an SVG drawn here) into the PNG sizes the web
 * manifest and iOS need. Re-run after changing the mark:
 *   npx tsx scripts/make-icons.ts
 * Output: public/icons/*.png (committed, so builds do not depend on this).
 */
const dir = join(process.cwd(), "public", "icons");
mkdirSync(dir, { recursive: true });

// A dark tile with a light beam: Vertigo does light, laser and projection.
function svg(size: number, padding: number): string {
  const p = size * padding;
  const inner = size - 2 * p;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0b0b0f"/>
  <g transform="translate(${p} ${p})">
    <polygon points="${inner * 0.5},${inner * 0.08} ${inner * 0.93},${inner * 0.92} ${inner * 0.07},${inner * 0.92}" fill="#f5c542" opacity="0.18"/>
    <polygon points="${inner * 0.5},${inner * 0.08} ${inner * 0.72},${inner * 0.92} ${inner * 0.28},${inner * 0.92}" fill="#f5c542" opacity="0.45"/>
    <circle cx="${inner * 0.5}" cy="${inner * 0.12}" r="${inner * 0.07}" fill="#ffffff"/>
    <text x="${inner * 0.5}" y="${inner * 0.86}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${inner * 0.26}" fill="#ffffff">VG</text>
  </g>
</svg>`;
}

async function render(name: string, size: number, padding: number) {
  const png = await sharp(Buffer.from(svg(size, padding))).png().toBuffer();
  writeFileSync(join(dir, name), png);
  console.log(`${name} (${size}px)`);
}

async function main() {
  await render("icon-192.png", 192, 0.1);
  await render("icon-512.png", 512, 0.1);
  // Maskable icons are cropped to a circle or squircle by Android: keep the mark inside the safe zone.
  await render("icon-maskable-512.png", 512, 0.2);
  await render("apple-touch-icon.png", 180, 0.12);
  writeFileSync(join(dir, "icon.svg"), svg(512, 0.1));
  console.log("icon.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
