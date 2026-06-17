// Rasterizes the BookCoin SVGs into the PNG sources that @capacitor/assets consumes.
// Run once whenever the icon design changes:  node scripts/gen-icons.mjs  (needs `sharp`).
// The resulting PNGs are committed so CI only needs @capacitor/assets, no rasterizer.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const A = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const render = (svg, size) => sharp(readFileSync(join(A, svg)), { density: 384 }).resize(size, size).png();

await render('icon.svg', 1024).toFile(join(A, 'icon-only.png'));
await render('icon-foreground.svg', 1024).toFile(join(A, 'icon-foreground.png'));
await render('icon-background.svg', 1024).toFile(join(A, 'icon-background.png'));

const glyph = await render('icon-foreground.svg', 1100).toBuffer();
for (const [file, bg] of [['splash.png', '#FBF3E7'], ['splash-dark.png', '#211D1A']]) {
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: bg } })
    .composite([{ input: glyph, gravity: 'center' }]).png().toFile(join(A, file));
}
console.log('BookCoin icons generated in', A);
