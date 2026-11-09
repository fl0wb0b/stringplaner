import { describe, expect, it } from "vitest";
import { calculate, defaultFloatVoltage, stringCurrentAtTemp, stringVocAtTemp, type CalcInput } from "./calc";
import type { MpptTracker, PVModule } from "./types";

// Round numbers chosen so expected values are hand-computable.
const testModule: PVModule = {
  manufacturer: "Test",
  model_name: "T-400",
  power_stc: 400,
  voc: 40,
  vmp: 32,
  isc: 11,
  imp: 10,
  temp_coeff_voc: -0.3, // %/°C
  temp_coeff_pmax: -0.35,
  temp_coeff_isc: 0.005, // A/°C
  source: "CEC",
};

const testTracker: MpptTracker = {
  tracker_label: "MPPT1",
  v_mppt_min: 50,
  v_mppt_max: 100,
  v_max_absolute: 100,
  i_max: 22,
  max_strings_parallel: 2,
  p_max_w: 2000,
};

const baseInput: CalcInput = {
  module: testModule,
  modulesInSeries: 2,
  stringsParallel: 2,
  tracker: testTracker,
  tempMin: -10,
  tempMax: 70,
  cableLength: 10,
  crossSection: 6,
};

describe("calculate", () => {
  it("computes Voc at cold temperature", () => {
    // 40 × (1 + (-0.3/100)×(-35)) × 2 = 40 × 1.105 × 2 = 88.4
    const r = calculate(baseInput);
    expect(r.vocCold).toBeCloseTo(88.4, 6);
    expect(r.checks.vocMax).toBe("ok");
  });

  it("fails Voc check when cold voltage exceeds absolute maximum", () => {
    // 3 in series: 40 × 1.105 × 3 = 132.6 > 100
    const r = calculate({ ...baseInput, modulesInSeries: 3 });
    expect(r.vocCold).toBeCloseTo(132.6, 6);
    expect(r.checks.vocMax).toBe("fehler");
    expect(r.accepted).toBe(false);
    expect(r.overallStatus).toBe("fehler");
  });

  it("computes cold current per spec formula", () => {
    // (10 + 0.005 × -(25 - (-10))) × 2 = (10 - 0.175) × 2 = 19.65
    const r = calculate(baseInput);
    expect(r.iCold).toBeCloseTo(19.65, 6);
    expect(r.checks.currentMax).toBe("ok");
  });

  it("fails current check when strings exceed max_strings_parallel", () => {
    const r = calculate({ ...baseInput, stringsParallel: 3 });
    expect(r.checks.currentMax).toBe("fehler");
    expect(r.accepted).toBe(false);
  });

  it("fails current check when cold current exceeds i_max", () => {
    const tracker = { ...testTracker, i_max: 19 };
    const r = calculate({ ...baseInput, tracker });
    expect(r.checks.currentMax).toBe("fehler");
  });

  it("checks the hottest operating current, not the coldest", () => {
    // I_cold = 19.65 A would pass i_max = 20, but I_hot = 20.45 A does not.
    const tracker = { ...testTracker, i_max: 20 };
    const r = calculate({ ...baseInput, tracker });
    expect(r.iCheckIsIsc).toBe(false);
    expect(r.iCheck).toBeCloseTo(20.45, 6);
    expect(r.checks.currentMax).toBe("fehler");
    expect(r.accepted).toBe(false);
  });

  it("checks hot Isc against i_max for MPPT chargers", () => {
    // Isc_hot = (11 + 0.005 × 45) × 2 = 22.45 > 22; the same input on an
    // inverter only checks Imp_hot = 20.45 and passes.
    const charger = calculate({ ...baseInput, deviceType: "mppt_charger" });
    expect(charger.iCheckIsIsc).toBe(true);
    expect(charger.iCheck).toBeCloseTo(22.45, 6);
    expect(charger.checks.currentMax).toBe("fehler");
    expect(charger.accepted).toBe(false);

    const inverter = calculate({ ...baseInput, deviceType: "string_inverter" });
    expect(inverter.checks.currentMax).toBe("ok");
  });

  it("computes hot Vmp with cable voltage drop", () => {
    // Vmp_hot_raw = 32 × (1 + (-0.3/100)×45) × 2 = 32 × 0.865 × 2 = 55.36
    // dropFactor = (2 × 10 × 0.0178) / 6 = 0.0593333…
    // I_hot = (10 + 0.005×45) × 2 = 20.45
    // drop = 1.21336…; corrected = 54.14663…
    const r = calculate(baseInput);
    expect(r.vmpHotRaw).toBeCloseTo(55.36, 6);
    expect(r.iHot).toBeCloseTo(20.45, 6);
    expect(r.cableDrop).toBeCloseTo(1.213366, 5);
    expect(r.vmpHotCorrected).toBeCloseTo(54.146633, 5);
    expect(r.checks.vmpMin).toBe("ok");
  });

  it("fails Vmp check when corrected voltage drops below MPPT minimum", () => {
    const tracker = { ...testTracker, v_mppt_min: 55 };
    const r = calculate({ ...baseInput, tracker });
    expect(r.checks.vmpMin).toBe("fehler");
    expect(r.accepted).toBe(false);
  });

  it("warns on oversizing above 130 percent", () => {
    // 400 × 2 × 2 = 1600 Wp; p_max_w 1200 → ratio 1.333 > 1.3
    const tracker = { ...testTracker, p_max_w: 1200 };
    const r = calculate({ ...baseInput, tracker });
    expect(r.powerRatio).toBeCloseTo(1600 / 1200, 6);
    expect(r.checks.powerRatio).toBe("warnung");
    expect(r.accepted).toBe(true); // warning is not a blocker
    expect(r.overallStatus).toBe("warnung");
  });

  it("skips power check when tracker has no p_max_w", () => {
    const { p_max_w, ...rest } = testTracker;
    void p_max_w;
    const r = calculate({ ...baseInput, tracker: rest as MpptTracker });
    expect(r.powerRatio).toBeNull();
    expect(r.checks.powerRatio).toBe("ok");
  });

  it("never lets a warning mask a hard failure", () => {
    // Oversized AND over-voltage: overall must be fehler, not warnung
    const tracker = { ...testTracker, p_max_w: 1200 };
    const r = calculate({ ...baseInput, modulesInSeries: 3, tracker });
    expect(r.checks.powerRatio).toBe("warnung");
    expect(r.checks.vocMax).toBe("fehler");
    expect(r.overallStatus).toBe("fehler");
  });

  it("is accepted with all-ok status when everything passes", () => {
    const r = calculate(baseInput);
    expect(r.accepted).toBe(true);
    expect(r.overallStatus).toBe("ok");
  });
});

describe("stringVocAtTemp", () => {
  it("matches the cold Voc at tempMin", () => {
    const r = calculate(baseInput);
    expect(stringVocAtTemp(testModule, 2, -10)).toBeCloseTo(r.vocCold, 9);
  });

  it("returns STC Voc at 25°C", () => {
    expect(stringVocAtTemp(testModule, 2, 25)).toBeCloseTo(80, 9);
  });
});

describe("stringCurrentAtTemp", () => {
  it("matches the cold/hot current from calculate()", () => {
    const r = calculate(baseInput);
    expect(stringCurrentAtTemp(testModule, 2, -10)).toBeCloseTo(r.iCold, 9);
    expect(stringCurrentAtTemp(testModule, 2, 70)).toBeCloseTo(r.iHot, 9);
  });

  it("returns STC Imp at 25°C", () => {
    expect(stringCurrentAtTemp(testModule, 2, 25)).toBeCloseTo(20, 9);
  });
});

describe("calculate — MPPT-Ladereglerbatterie (batteryFloatVoltage)", () => {
  it("ignores battery float voltage when unset (inverter case)", () => {
    const r = calculate(baseInput);
    expect(r.checks.vmpMin).toBe("ok");
  });

  it("fails Vmp check when float voltage exceeds tracker's own MPPT minimum", () => {
    // vmpHotCorrected ≈ 54.15 V (see hot-Vmp test above); float voltage above that fails
    const r = calculate({ ...baseInput, batteryFloatVoltage: 55 });
    expect(r.checks.vmpMin).toBe("fehler");
    expect(r.accepted).toBe(false);
  });

  it("passes when float voltage is below both vmpHotCorrected and v_mppt_min", () => {
    const r = calculate({ ...baseInput, batteryFloatVoltage: 30 });
    expect(r.checks.vmpMin).toBe("ok");
  });

  it("does not let a low float voltage weaken the tracker's own MPPT minimum", () => {
    const tracker = { ...testTracker, v_mppt_min: 55 };
    // float voltage far below v_mppt_min must not override the device limit
    const r = calculate({ ...baseInput, tracker, batteryFloatVoltage: 20 });
    expect(r.checks.vmpMin).toBe("fehler");
  });
});

// Audit 2026-11
describe("stringCurrentAtTemp — charger chart matches the check", () => {
  it("uses Isc for MPPT chargers, like the current check", () => {
    const input = { ...baseInput, deviceType: "mppt_charger" as const };
    const r = calculate(input);
    const chart = Math.max(
      stringCurrentAtTemp(testModule, 2, -10, r.iCheckIsIsc),
      stringCurrentAtTemp(testModule, 2, 70, r.iCheckIsIsc),
    );
    expect(chart).toBeCloseTo(r.iCheck, 9);
  });
});

describe("defaultFloatVoltage", () => {
  it("derives the LiFePO4 float voltage from the variant's battery voltage", () => {
    expect(defaultFloatVoltage("PV (12V-Batterie)")).toBeCloseTo(13.4, 9);
    expect(defaultFloatVoltage("PV (24V-Batterie)")).toBeCloseTo(26.8, 9);
    expect(defaultFloatVoltage("PV (36V-Batterie)")).toBeCloseTo(40.2, 9);
    expect(defaultFloatVoltage("Tracker 2 (48V-Batterie)")).toBeCloseTo(53.6, 9);
    expect(defaultFloatVoltage("MPPT1")).toBeUndefined();
  });

  it("lets a 12 V setup pass that the fixed 48 V default rejected", () => {
    const tracker12: MpptTracker = { ...testTracker, v_mppt_min: 13, v_max_absolute: 75, v_mppt_max: 75 };
    const input = { ...baseInput, modulesInSeries: 1, stringsParallel: 1, tracker: tracker12, deviceType: "mppt_charger" as const };
    expect(calculate({ ...input, batteryFloatVoltage: 53.6 }).checks.vmpMin).toBe("fehler");
    expect(calculate({ ...input, batteryFloatVoltage: defaultFloatVoltage("PV (12V-Batterie)") }).checks.vmpMin).toBe("ok");
  });
});
