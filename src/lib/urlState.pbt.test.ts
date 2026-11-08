import * as fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { calculate } from "./calc";
import {
  DEFAULT_CONFIG,
  decodeConfig,
  encodeConfig,
  loadInitialConfig,
  type ConfigState,
  type CustomModuleValues,
  type TrackerConfig,
} from "./urlState";

const RUNS = 1000;
const SETTINGS = { numRuns: RUNS, seed: 20261108 } as const;
type Mode = "variants" | "independent";

function finiteDouble(constraints: { min: number; max: number }): fc.Arbitrary<number> {
  return fc
    .double({ ...constraints, noNaN: true, noDefaultInfinity: true })
    .map((value) => (Object.is(value, -0) ? 0 : value));
}

const slugArb = fc.stringMatching(/^[a-z][a-z0-9_-]{0,30}$/);
const nullableSlugArb = fc.option(slugArb, { nil: null });

const customModuleArb: fc.Arbitrary<CustomModuleValues> = fc
  .record({
    voc: finiteDouble({ min: 20, max: 80 }),
    isc: finiteDouble({ min: 3, max: 20 }),
    temp_coeff_voc: finiteDouble({ min: -0.45, max: -0.1 }),
    temp_coeff_isc_pct: finiteDouble({ min: 0.01, max: 0.08 }),
  })
  .chain((base) =>
    fc
      .tuple(
        finiteDouble({ min: 0.7, max: 0.95 }),
        finiteDouble({ min: 0.75, max: 0.98 }),
      )
      .map(([vmpRatio, impRatio]) => {
        const vmp = base.voc * vmpRatio;
        const imp = base.isc * impRatio;
        return {
          power_stc: vmp * imp,
          voc: base.voc,
          vmp,
          isc: base.isc,
          imp,
          temp_coeff_voc: base.temp_coeff_voc,
          temp_coeff_isc_pct: base.temp_coeff_isc_pct,
        };
      }),
  );

const trackerConfigArb: fc.Arbitrary<TrackerConfig> = fc.record({
  enabled: fc.boolean(),
  modulesInSeries: fc.integer({ min: 1, max: 40 }),
  stringsParallel: fc.integer({ min: 1, max: 12 }),
  moduleSlug: nullableSlugArb,
});

function configArb(mode: Mode): fc.Arbitrary<ConfigState> {
  return fc.record({
    deviceSlug: nullableSlugArb,
    moduleSlug: nullableSlugArb,
    trackerIndex: fc.integer({ min: 0, max: 7 }),
    modulesInSeries: fc.integer({ min: 1, max: 40 }),
    stringsParallel: fc.integer({ min: 1, max: 12 }),
    trackers:
      mode === "independent"
        ? fc.array(trackerConfigArb, { minLength: 1, maxLength: 8 })
        : fc.constant([]),
    custom: fc.option(customModuleArb, { nil: null }),
    plz: fc.option(fc.stringMatching(/^[0-9]{5}$/), { nil: "" }),
    tempMin: finiteDouble({ min: -40, max: 20 }),
    tempMax: finiteDouble({ min: 30, max: 90 }),
    cableLength: finiteDouble({ min: 0.1, max: 200 }),
    crossSection: finiteDouble({ min: 0.5, max: 240 }),
    batteryFloatVoltage: finiteDouble({ min: 10, max: 60 }),
  });
}

const queryKeys = [
  "d",
  "m",
  "t",
  "s",
  "p",
  "e0",
  "m0",
  "s0",
  "p0",
  "e1",
  "m1",
  "s1",
  "p1",
  "cw",
  "cvo",
  "cvm",
  "cis",
  "cim",
  "ctv",
  "cti",
  "plz",
  "tmin",
  "tmax",
  "cl",
  "cs",
  "bfv",
  "unknown",
] as const;

const queryValueArb = fc.oneof(
  fc.constantFrom("", "0", "-0", "-6", "NaN", "Infinity", "-Infinity", "1e309", "abc"),
  finiteDouble({ min: -10000, max: 10000 }).map(String),
  fc.string({ maxLength: 24 }),
);

const structuredQueryArb = fc
  .array(fc.tuple(fc.constantFrom(...queryKeys), queryValueArb), {
    minLength: 1,
    maxLength: 16,
  })
  .map((entries) => new URLSearchParams(entries).toString());
const arbitraryQueryArb = fc.oneof(fc.string({ maxLength: 512 }), structuredQueryArb);

function hasPhysicallyPossibleNumericState(c: ConfigState): boolean {
  const finiteValues = [
    c.trackerIndex,
    c.modulesInSeries,
    c.stringsParallel,
    c.tempMin,
    c.tempMax,
    c.cableLength,
    c.crossSection,
    c.batteryFloatVoltage,
  ];
  if (!finiteValues.every(Number.isFinite)) return false;
  if (!Number.isInteger(c.trackerIndex) || c.trackerIndex < 0) return false;
  if (!Number.isInteger(c.modulesInSeries) || c.modulesInSeries < 1) return false;
  if (!Number.isInteger(c.stringsParallel) || c.stringsParallel < 1) return false;
  if (c.tempMin > c.tempMax) return false;
  if (c.cableLength < 0 || c.crossSection <= 0 || c.batteryFloatVoltage <= 0) return false;
  if (c.trackers.length > 8) return false;
  for (const tracker of c.trackers) {
    if (!Number.isInteger(tracker.modulesInSeries) || tracker.modulesInSeries < 1) return false;
    if (!Number.isInteger(tracker.stringsParallel) || tracker.stringsParallel < 1) return false;
  }
  if (c.custom) {
    const customFinite = [
      c.custom.power_stc,
      c.custom.voc,
      c.custom.vmp,
      c.custom.isc,
      c.custom.imp,
      c.custom.temp_coeff_voc,
      c.custom.temp_coeff_isc_pct,
    ];
    if (!customFinite.every(Number.isFinite)) return false;
    if (
      c.custom.power_stc <= 0 ||
      c.custom.voc <= c.custom.vmp ||
      c.custom.vmp <= 0 ||
      c.custom.isc <= c.custom.imp ||
      c.custom.imp <= 0 ||
      c.custom.temp_coeff_voc >= 0 ||
      c.custom.temp_coeff_isc_pct <= 0
    ) {
      return false;
    }
  }
  return true;
}

function stubStorage(initial: string): (value: string) => void {
  let stored = initial;
  vi.stubGlobal("window", { location: { search: "" } });
  vi.stubGlobal("localStorage", { getItem: () => stored });
  return (value: string) => {
    stored = value;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("URL configuration properties", () => {
  it("round-trips every mode-specific valid configuration value", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Mode>("variants", "independent").chain((mode) =>
          configArb(mode).map((config) => ({ mode, config })),
        ),
        ({ mode, config }) => {
          const decoded = decodeConfig(encodeConfig(config, mode));
          const expected =
            mode === "independent"
              ? {
                  ...config,
                  trackerIndex: DEFAULT_CONFIG.trackerIndex,
                  modulesInSeries: DEFAULT_CONFIG.modulesInSeries,
                  stringsParallel: DEFAULT_CONFIG.stringsParallel,
                }
              : config;
          expect(decoded).toEqual(expected);
        },
      ),
      SETTINGS,
    );
  });

  it("does not throw for arbitrary query strings", () => {
    fc.assert(
      fc.property(arbitraryQueryArb, (query) => {
        expect(() => decodeConfig(query)).not.toThrow();
      }),
      SETTINGS,
    );
  });

  it("never decodes physically impossible numeric values", () => {
    fc.assert(
      fc.property(arbitraryQueryArb, (query) => {
        const decoded = decodeConfig(query);
        if (decoded) expect(hasPhysicallyPossibleNumericState(decoded)).toBe(true);
      }),
      {
        ...SETTINGS,
        seed: 20261109,
        // Regression (Audit 04.11., behoben 08.11.): fixed counterexample cs=0 is returned as a divisor.
        examples: [["cs=0"]],
      },
    );
  });

  it("does not let a negative decoded cross-section produce acceptance", () => {
    fc.assert(
      fc.property(finiteDouble({ min: -240, max: -0.5 }), (crossSection) => {
        const decoded = decodeConfig(`cs=${crossSection}`);
        const result = calculate({
          module: {
            manufacturer: "PBT",
            model_name: "negative-cable-regression",
            power_stc: 400,
            voc: 40,
            vmp: 32,
            isc: 11,
            imp: 10,
            temp_coeff_voc: -0.3,
            temp_coeff_pmax: -0.35,
            temp_coeff_isc: 0.005,
            source: "CEC",
          },
          modulesInSeries: 2,
          stringsParallel: 2,
          tracker: {
            tracker_label: "PBT MPPT",
            v_mppt_min: 55,
            v_mppt_max: 100,
            v_max_absolute: 100,
            i_max: 22,
            max_strings_parallel: 2,
            p_max_w: 2000,
          },
          tempMin: -10,
          tempMax: 70,
          cableLength: 10,
          crossSection: decoded?.crossSection ?? 6,
          deviceType: "string_inverter",
        });
        expect(result.accepted).toBe(false);
        expect(result.checks.vmpMin).toBe("fehler");
      }),
      {
        ...SETTINGS,
        seed: 20261111,
        // Regression (Audit 04.11., behoben 08.11.): cs=-6 changes vmpMin from fehler to ok.
        examples: [[-6]],
      },
    );
  });
});

describe("localStorage configuration properties", () => {
  it("loads every valid stored configuration unchanged", () => {
    const setStored = stubStorage("");
    fc.assert(
      fc.property(configArb("independent"), (config) => {
        setStored(JSON.stringify(config));
        expect(loadInitialConfig()).toEqual(config);
      }),
      SETTINGS,
    );
  });

  it("does not throw for arbitrary stored strings", () => {
    const setStored = stubStorage("");
    fc.assert(
      fc.property(fc.string({ maxLength: 512 }), (stored) => {
        setStored(stored);
        expect(() => loadInitialConfig()).not.toThrow();
      }),
      SETTINGS,
    );
  });

  it("never loads a non-positive cable cross-section", () => {
    const setStored = stubStorage("");
    fc.assert(
      fc.property(fc.constantFrom(0, -6), (crossSection) => {
        setStored(JSON.stringify({ crossSection }));
        expect(loadInitialConfig().crossSection).toBeGreaterThan(0);
      }),
      {
        ...SETTINGS,
        seed: 20261110,
        // Regression (Audit 04.11., behoben 08.11.): fixed counterexample 0 survives the storage merge.
        examples: [[0]],
      },
    );
  });
});
