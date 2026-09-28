/** "Alice Ng" → "AN", "metrics-scraper" → "ME". Used for list avatars. */
export function initials(text: string): string {
  const parts = text.split(/[\s._-]+/).filter(Boolean);
  const letters =
    parts.length > 1 ? parts.slice(0, 2).map((p) => p[0]) : (parts[0] ?? text).slice(0, 2).split('');
  return letters.join('').toUpperCase();
}
