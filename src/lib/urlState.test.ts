import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CONFIG,
  DEFAULT_CUSTOM_MODULE,
  DEFAULT_TRACKER_CONFIG,
  customToModule,
  decodeConfig,
  encodeConfig,
  loadInitialConfig,
  type ConfigState,
} from "./urlState";

const tracker = (moduleSlug: string | null) => ({
  enabled: true,
  modulesInSeries: 3,
  stringsParallel: 1,
  moduleSlug,
});

describe("encodeConfig/decodeConfig", () => {
  it("keeps a tracker-0 module override when no global module is set", () => {
    const c: ConfigState = { ...DEFAULT_CONFIG, moduleSlug: null, trackers: [tracker("mod-a"), tracker(null)] };
    const back = decodeConfig(encodeConfig(c, "independent"));
    expect(back?.moduleSlug).toBeNull();
    expect(back?.trackers[0].moduleSlug).toBe("mod-a");
    expect(back?.trackers[1].moduleSlug).toBeNull();
  });

  it("keeps the global module next to tracker overrides", () => {
    const c: ConfigState = { ...DEFAULT_CONFIG, moduleSlug: "mod-g", trackers: [tracker("mod-a"), tracker(null)] };
    const back = decodeConfig(encodeConfig(c, "independent"));
    expect(back?.moduleSlug).toBe("mod-g");
    expect(back?.trackers[0].moduleSlug).toBe("mod-a");
  });

  it("still reads old links that carried the global module as m0", () => {
    const back = decodeConfig("e0=1&s0=3&p0=1&m0=mod-old");
    expect(back?.moduleSlug).toBe("mod-old");
    expect(back?.trackers[0].moduleSlug).toBeNull();
  });
});

// Audit 2026-11
describe("decodeConfig — robustness", () => {
  it("ignores links that carry only foreign parameters (e.g. tracking)", () => {
    expect(decodeConfig("utm_source=newsletter")).toBeNull();
    expect(decodeConfig("fbclid=abc&d=dev")).not.toBeNull();
  });

  it("recognizes every key encodeConfig writes (CONFIG_KEY stays in sync)", () => {
    const full: ConfigState = {
      ...DEFAULT_CONFIG,
      deviceSlug: "dev",
      moduleSlug: "mod",
      custom: DEFAULT_CUSTOM_MODULE,
      plz: "10115",
      trackers: [tracker("mod-a"), tracker(null)],
    };
    for (const mode of ["variants", "independent"] as const) {
      for (const [key, value] of new URLSearchParams(encodeConfig(full, mode))) {
        expect(decodeConfig(`${key}=${encodeURIComponent(value)}`), key).not.toBeNull();
      }
    }
  });

  it("resets temperatures outside a physical range (chart loop would never end)", () => {
    expect(decodeConfig("tmin=-1e308&tmax=70")?.tempMin).toBe(DEFAULT_CONFIG.tempMin);
    expect(decodeConfig("tmin=-10&tmax=1e9")?.tempMax).toBe(DEFAULT_CONFIG.tempMax);
    expect(decodeConfig("tmin=-25&tmax=80")).toMatchObject({ tempMin: -25, tempMax: 80 });
  });
});

describe("loadInitialConfig — stored state", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (stored: unknown) => {
    vi.stubGlobal("window", { location: { search: "" } });
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(stored) });
  };

  it("drops a non-string postal code", () => {
    stub({ plz: 12345 });
    expect(loadInitialConfig().plz).toBe("");
  });

  it("repairs stored trackers field by field", () => {
    stub({ trackers: [{ enabled: true, modulesInSeries: -5, stringsParallel: "x", moduleSlug: 7 }, null] });
    expect(loadInitialConfig().trackers).toEqual([
      { enabled: true, modulesInSeries: 2, stringsParallel: 1, moduleSlug: null },
      DEFAULT_TRACKER_CONFIG,
    ]);
  });
});

describe("customToModule", () => {
  it("rejects physically impossible custom values instead of calculating with them", () => {
    expect(customToModule({ ...DEFAULT_CUSTOM_MODULE, temp_coeff_voc: 0.25 })).toBeNull();
    expect(customToModule({ ...DEFAULT_CUSTOM_MODULE, imp: 15 })).toBeNull();
  });

  it("converts valid values (Isc coefficient %/°C → A/°C)", () => {
    const m = customToModule(DEFAULT_CUSTOM_MODULE);
    expect(m?.voc).toBe(DEFAULT_CUSTOM_MODULE.voc);
    expect(m?.temp_coeff_isc).toBeCloseTo((0.045 * 14.5) / 100, 9);
  });
});
