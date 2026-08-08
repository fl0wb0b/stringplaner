// Configuration ⇄ URL query parameters (shareable links, TASKS.md 4c)
// plus a localStorage fallback for "last used" without a link.

export interface ConfigState {
  moduleSlug: string | null;
  deviceSlug: string | null;
  trackerIndex: number;
  modulesInSeries: number;
  stringsParallel: number;
  tempMin: number;
  tempMax: number;
  cableLength: number; // m, one-way
  crossSection: number; // mm²
}

export const DEFAULT_CONFIG: ConfigState = {
  moduleSlug: null,
  deviceSlug: null,
  trackerIndex: 0,
  modulesInSeries: 2,
  stringsParallel: 1,
  tempMin: -10,
  tempMax: 70,
  cableLength: 10,
  crossSection: 6,
};

const STORAGE_KEY = "stringplaner:last-config";

export function encodeConfig(c: ConfigState): string {
  const p = new URLSearchParams();
  if (c.moduleSlug) p.set("m", c.moduleSlug);
  if (c.deviceSlug) p.set("d", c.deviceSlug);
  p.set("t", String(c.trackerIndex));
  p.set("s", String(c.modulesInSeries));
  p.set("p", String(c.stringsParallel));
  p.set("tmin", String(c.tempMin));
  p.set("tmax", String(c.tempMax));
  p.set("cl", String(c.cableLength));
  p.set("cs", String(c.crossSection));
  return p.toString();
}

function num(p: URLSearchParams, key: string, fallback: number): number {
  const v = Number.parseFloat(p.get(key) ?? "");
  return Number.isFinite(v) ? v : fallback;
}

export function decodeConfig(search: string): ConfigState | null {
  const p = new URLSearchParams(search);
  if (![...p.keys()].length) return null;
  const d = DEFAULT_CONFIG;
  return {
    moduleSlug: p.get("m"),
    deviceSlug: p.get("d"),
    trackerIndex: Math.max(0, Math.trunc(num(p, "t", d.trackerIndex))),
    modulesInSeries: Math.max(1, Math.trunc(num(p, "s", d.modulesInSeries))),
    stringsParallel: Math.max(1, Math.trunc(num(p, "p", d.stringsParallel))),
    tempMin: num(p, "tmin", d.tempMin),
    tempMax: num(p, "tmax", d.tempMax),
    cableLength: num(p, "cl", d.cableLength),
    crossSection: num(p, "cs", d.crossSection),
  };
}

export function loadInitialConfig(): ConfigState {
  const fromUrl = decodeConfig(window.location.search);
  if (fromUrl) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...(JSON.parse(stored) as Partial<ConfigState>) };
  } catch {
    // corrupt storage — fall through to defaults
  }
  return DEFAULT_CONFIG;
}

export function persistConfig(c: ConfigState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    // storage full/unavailable — URL still carries the state
  }
  const query = encodeConfig(c);
  window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
}
