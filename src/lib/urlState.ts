// Configuration ⇄ URL query parameters (shareable links, TASKS.md 4c)
// plus a localStorage fallback for "last used" without a link.
//
// Two layouts share one state object:
// - variants devices (single input): m, t, s, p
// - independent-tracker devices: per tracker i → e{i} (enabled), m{i}, s{i}, p{i}
// Global: d, tmin, tmax, cl, cs. Old links using m/t/s/p on independent
// devices are mapped onto the tracker t.

export interface TrackerConfig {
  enabled: boolean;
  moduleSlug: string | null;
  modulesInSeries: number;
  stringsParallel: number;
}

export interface ConfigState {
  deviceSlug: string | null;
  // variants mode (and module preselection before a device is chosen)
  moduleSlug: string | null;
  trackerIndex: number;
  modulesInSeries: number;
  stringsParallel: number;
  // independent mode, aligned with device.trackers
  trackers: TrackerConfig[];
  tempMin: number;
  tempMax: number;
  cableLength: number; // m, one-way
  crossSection: number; // mm²
}

export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  enabled: false,
  moduleSlug: null,
  modulesInSeries: 2,
  stringsParallel: 1,
};

export const DEFAULT_CONFIG: ConfigState = {
  deviceSlug: null,
  moduleSlug: null,
  trackerIndex: 0,
  modulesInSeries: 2,
  stringsParallel: 1,
  trackers: [],
  tempMin: -10,
  tempMax: 70,
  cableLength: 10,
  crossSection: 6,
};

const STORAGE_KEY = "stringplaner:last-config";
const MAX_TRACKERS = 8;

export function encodeConfig(c: ConfigState, mode: "variants" | "independent"): string {
  const p = new URLSearchParams();
  if (c.deviceSlug) p.set("d", c.deviceSlug);
  if (mode === "independent" && c.trackers.length) {
    c.trackers.forEach((t, i) => {
      p.set(`e${i}`, t.enabled ? "1" : "0");
      if (t.moduleSlug) p.set(`m${i}`, t.moduleSlug);
      p.set(`s${i}`, String(t.modulesInSeries));
      p.set(`p${i}`, String(t.stringsParallel));
    });
  } else {
    if (c.moduleSlug) p.set("m", c.moduleSlug);
    p.set("t", String(c.trackerIndex));
    p.set("s", String(c.modulesInSeries));
    p.set("p", String(c.stringsParallel));
  }
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

const posInt = (v: number) => Math.max(1, Math.trunc(v));

export function decodeConfig(search: string): ConfigState | null {
  const p = new URLSearchParams(search);
  if (![...p.keys()].length) return null;
  const d = DEFAULT_CONFIG;

  const trackers: TrackerConfig[] = [];
  for (let i = 0; i < MAX_TRACKERS; i++) {
    if (!p.has(`e${i}`) && !p.has(`m${i}`) && !p.has(`s${i}`)) break;
    trackers.push({
      enabled: p.get(`e${i}`) !== "0",
      moduleSlug: p.get(`m${i}`),
      modulesInSeries: posInt(num(p, `s${i}`, 2)),
      stringsParallel: posInt(num(p, `p${i}`, 1)),
    });
  }

  return {
    deviceSlug: p.get("d"),
    moduleSlug: p.get("m"),
    trackerIndex: Math.max(0, Math.trunc(num(p, "t", d.trackerIndex))),
    modulesInSeries: posInt(num(p, "s", d.modulesInSeries)),
    stringsParallel: posInt(num(p, "p", d.stringsParallel)),
    trackers,
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

export function persistConfig(c: ConfigState, mode: "variants" | "independent"): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    // storage full/unavailable — URL still carries the state
  }
  const query = encodeConfig(c, mode);
  window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
}
