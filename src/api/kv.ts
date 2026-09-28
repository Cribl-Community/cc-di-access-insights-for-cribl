/**
 * The app-scoped KV store (see AGENTS.md → Key-Value Store). The platform proxy
 * rewrites `/kvstore/*` to this app's own namespace, so no policy entry is
 * needed. Used only for UI preferences — failures degrade to defaults.
 */

function kvUrl(key: string): string {
  return `${window.CRIBL_API_URL}/kvstore/${key}`;
}

/** Read a JSON value, or `fallback` when missing / unreadable / outside Cribl. */
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(kvUrl(key));
    if (!res.ok) return fallback;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Best-effort write of a JSON value; a failure just means the preference doesn't persist. */
export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    await fetch(kvUrl(key), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  } catch {
    /* preference just won't persist */
  }
}
