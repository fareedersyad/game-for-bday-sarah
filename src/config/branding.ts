/**
 * BRANDING — the official "S" logo (gold S with crown, heart gem, pink rose,
 * sage background), used for the browser tab and Home Screen icons only.
 * The logo is deliberately NOT shown on the title screen (owner's decision).
 *
 * The original artwork is `public/images/princess-sarah-logo.png` (1254×1254)
 * and is never modified. Every file below was made from it with ffmpeg
 * (Lanczos down-scaling only — nothing redrawn, recoloured or stretched):
 *
 * - Favicons (16 / 32 / 48 px): a centred square crop of the S + crown
 *   (crop=736:736:240:224), so the letter stays readable at tab size.
 * - Home Screen icons (iPhone 180 px, Android 192 / 512 px): the full logo.
 *   The Android "maskable" 512 px icon is the full logo at 92% on its own
 *   sage colour, so the gold ring stays inside Android's round safe zone.
 * - `unusedTitleLogo`: 512 / 1024 px versions made for the title screen
 *   before it was decided not to show the logo there. Not referenced by the
 *   game; kept until the owner decides whether to delete them.
 *
 * index.html links the icons with root paths ("/icons/…"), which Vite
 * prefixes with the deploy base path (/game-for-bday-sarah/ on GitHub Pages).
 * The manifest uses paths relative to itself, so it works under any base.
 * The Home Screen name ("Sarah's World") lives in index.html (iPhone) and in
 * the manifest's short_name (Android).
 */
export const BRANDING = {
  original: 'images/princess-sarah-logo.png',
  favicons: ['icons/favicon-16.png', 'icons/favicon-32.png', 'icons/favicon-48.png'],
  appleTouchIcon: 'icons/apple-touch-icon.png',
  manifest: 'manifest.webmanifest',
  unusedTitleLogo: {
    webp512: 'images/princess-sarah-logo-512.webp',
    webp1024: 'images/princess-sarah-logo-1024.webp',
    png512: 'images/princess-sarah-logo-512.png',
  },
} as const;
