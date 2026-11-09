import { describe, expect, it } from "vitest";
import { implausibleReason } from "./plausibility.mjs";

const ok = { voc: 49.4, vmp: 41.4, isc: 13.83, imp: 13.1, temp_coeff_isc: 0.0062 };

describe("implausibleReason (CEC import)", () => {
  it("accepts a normal module and a negative Isc coefficient (calc takes the max over both temperatures)", () => {
    expect(implausibleReason(ok)).toBeNull();
    expect(implausibleReason({ ...ok, temp_coeff_isc: -0.0044 })).toBeNull();
  });

  it("rejects an Isc coefficient off by a unit factor", () => {
    expect(implausibleReason({ ...ok, temp_coeff_isc: 6.34797 })).toMatch(/alpha_sc/);
    expect(implausibleReason({ ...ok, temp_coeff_isc: 0.0927 })).toMatch(/alpha_sc/); // 0.67 %/°C
  });

  it("rejects a negative Isc coefficient off by a unit factor, too", () => {
    expect(implausibleReason({ ...ok, temp_coeff_isc: -6.34797 })).toMatch(/alpha_sc/);
  });

  it("rejects Imp > Isc and Vmp >= Voc", () => {
    expect(implausibleReason({ ...ok, imp: 14 })).toMatch(/Imp/);
    expect(implausibleReason({ ...ok, vmp: 50 })).toMatch(/Vmp/);
  });
});
