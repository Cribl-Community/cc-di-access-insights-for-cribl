import type { Paginated } from './types';

export class CriblApiError extends Error {
  readonly path: string;
  readonly status: number;

  constructor(path: string, status: number) {
    super(`Cribl API request to ${path} failed with status ${status}`);
    this.name = 'CriblApiError';
    this.path = path;
    this.status = status;
  }
}

type QueryParams = Record<string, string | number | undefined>;

function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** GET a single Cribl API resource. `path` starts with "/", e.g. "/system/teams". */
export async function criblGet<T>(path: string, params?: QueryParams): Promise<T> {
  const res = await fetch(`${window.CRIBL_API_URL}${path}${buildQuery(params)}`);
  if (!res.ok) {
    throw new CriblApiError(path, res.status);
  }
  return (await res.json()) as T;
}

const PAGE_SIZE = 100;

/** GET every page of a `{ count, items }` collection endpoint, following `offset`/`limit`. */
export async function criblGetAllPages<T>(path: string, params?: QueryParams): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await criblGet<Paginated<T>>(path, { ...params, offset, limit: PAGE_SIZE });
    items.push(...page.items);
    offset += page.items.length;
    if (page.items.length < PAGE_SIZE || offset >= page.count) break;
  }
  return items;
}
