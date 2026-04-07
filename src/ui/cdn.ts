// src/ui/cdn.ts
// Helpers for building SeasonalNet icon CDN URLs.
//
// The CDN (cdn.seasonalnet.org) exposes:
//   GET /icon?icon=ICONNAME&hex=RRGGBB  →  64×64 PNG (Lucide icon, recolored)
//
// iconUrl() is intentionally pure — no module state — so it can be called with
// any base URL (useful for tests or alternate CDN origins).

/**
 * Build an icon CDN URL for a Lucide icon name and a 6-digit hex color.
 *
 * @param baseUrl  - CDN origin, e.g. "https://cdn.seasonalnet.org"
 * @param icon     - Lucide icon name, e.g. "circle-check"
 * @param hexColor - 6-char hex color with or without leading #, e.g. "57F287"
 */
export function iconUrl(baseUrl: string, icon: string, hexColor: string): string {
  const hex = hexColor.replace(/^#/, '').toUpperCase();
  return `${baseUrl}/icon?icon=${icon}&hex=${hex}`;
}

/**
 * Convert a Discord.js integer color (e.g. 0x57f287) to the 6-char uppercase
 * hex string expected by the CDN (e.g. "57F287").
 */
export function colorToHex(color: number): string {
  return color.toString(16).padStart(6, '0').toUpperCase();
}
