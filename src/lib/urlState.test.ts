import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, decodeConfig, encodeConfig, type ConfigState } from "./urlState";

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
