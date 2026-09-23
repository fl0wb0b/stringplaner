import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, decodeConfig, sanitizeConfig } from "./urlState";

describe("sanitizeConfig — URL/localStorage values bypass UI limits", () => {
  it("clamps cross section and cable length from a link", () => {
    const c = sanitizeConfig(decodeConfig("?cs=0&cl=-5")!);
    expect(c.crossSection).toBe(0.5);
    expect(c.cableLength).toBe(0);
  });

  it("replaces non-numeric stored values with defaults", () => {
    const c = sanitizeConfig({
      ...DEFAULT_CONFIG,
      tempMin: "x" as unknown as number,
      crossSection: null as unknown as number,
    });
    expect(c.tempMin).toBe(DEFAULT_CONFIG.tempMin);
    expect(c.crossSection).toBe(DEFAULT_CONFIG.crossSection);
  });
});
