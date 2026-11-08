import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  calculate,
  stringCurrentAtTemp,
  stringVmpAtTemp,
  stringVocAtTemp,
  type CalcInput,
} from "./calc";
import type { DeviceType, MpptTracker, PVModule } from "./types";

const RUNS = 1000;
const SETTINGS = { numRuns: RUNS, seed: 20261108 } as const;

function finiteDouble(constraints: { min: number; max: number }): fc.Arbitrary<number> {
  return fc.double({ ...constraints, noNaN: true, noDefaultInfinity: true });
}

const moduleArb: fc.Arbitrary<PVModule> = fc
  .record({
    voc: finiteDouble({ min: 20, max: 80 }),
    isc: finiteDouble({ min: 3, max: 20 }),
    temp_coeff_voc: finiteDouble({ min: -0.45, max: -0.1 }),
    temp_coeff_pmax: finiteDouble({ min: -0.5, max: -0.2 }),
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
          manufacturer: "PBT",
          model_name: "physically-valid-module",
          power_stc: vmp * imp,
          voc: base.voc,
          vmp,
          isc: base.isc,
          imp,
          temp_coeff_voc: base.temp_coeff_voc,
          temp_coeff_pmax: base.temp_coeff_pmax,
          temp_coeff_isc: (base.isc * base.temp_coeff_isc_pct) / 100,
          source: "CEC" as const,
        };
      }),
  );

const trackerArb: fc.Arbitrary<MpptTracker> = finiteDouble({ min: 50, max: 1600 })
  .chain((v_max_absolute) =>
    finiteDouble({ min: 10, max: v_max_absolute }).chain((v_mppt_max) =>
      fc.record({
        tracker_label: fc.constant("PBT MPPT"),
        v_mppt_min: finiteDouble({ min: 1, max: v_mppt_max }),
        v_mppt_max: fc.constant(v_mppt_max),
        v_max_absolute: fc.constant(v_max_absolute),
        i_max: finiteDouble({ min: 1, max: 250 }),
        max_strings_parallel: fc.integer({ min: 1, max: 20 }),
        p_max_w: fc.option(finiteDouble({ min: 100, max: 30000 }), { nil: undefined }),
      }),
    ),
  );

const calcInputArb: fc.Arbitrary<CalcInput> = fc
  .record({
    module: moduleArb,
    modulesInSeries: fc.integer({ min: 1, max: 40 }),
    stringsParallel: fc.integer({ min: 1, max: 12 }),
    tracker: trackerArb,
    tempMin: finiteDouble({ min: -40, max: 20 }),
    tempMax: finiteDouble({ min: 30, max: 90 }),
    cableLength: finiteDouble({ min: 0.1, max: 200 }),
    crossSection: finiteDouble({ min: 0.5, max: 240 }),
    deviceType: fc.constantFrom<DeviceType>("mppt_charger", "string_inverter", "hybrid"),
  })
  .chain((input) =>
    input.deviceType === "mppt_charger"
      ? finiteDouble({ min: 10, max: 60 }).map((batteryFloatVoltage) => ({
          ...input,
          batteryFloatVoltage,
        }))
      : fc.constant(input),
  );

const inverterInputArb: fc.Arbitrary<CalcInput> = fc
  .constantFrom<DeviceType>("string_inverter", "hybrid")
  .chain((deviceType) =>
    calcInputArb.map((input) => ({
      ...input,
      deviceType,
      batteryFloatVoltage: undefined,
    })),
  );

const chargerInputArb: fc.Arbitrary<CalcInput> = calcInputArb.map((input) => ({
  ...input,
  deviceType: "mppt_charger",
  batteryFloatVoltage: input.batteryFloatVoltage ?? 53.6,
}));

describe("calculate properties with physically valid inputs", () => {
  it("raises cold Voc when the minimum temperature falls", () => {
    fc.assert(
      fc.property(calcInputArb, finiteDouble({ min: 0.1, max: 20 }), (input, delta) => {
        const baseline = calculate(input);
        const colder = calculate({ ...input, tempMin: input.tempMin - delta });
        expect(colder.vocCold).toBeGreaterThan(baseline.vocCold);
        expect(stringVocAtTemp(input.module, input.modulesInSeries, input.tempMin)).toBe(
          baseline.vocCold,
        );
      }),
      SETTINGS,
    );
  });

  it("scales cold Voc and raw hot Vmp proportionally with series modules", () => {
    fc.assert(
      fc.property(calcInputArb, (input) => {
        const baseline = calculate(input);
        const doubled = calculate({ ...input, modulesInSeries: input.modulesInSeries * 2 });
        expect(doubled.vocCold).toBeCloseTo(baseline.vocCold * 2, 8);
        expect(doubled.vmpHotRaw).toBeCloseTo(baseline.vmpHotRaw * 2, 8);
        expect(stringVmpAtTemp(input.module, input.modulesInSeries, input.tempMax)).toBe(
          baseline.vmpHotRaw,
        );
      }),
      SETTINGS,
    );
  });

  it("scales all array currents proportionally with parallel strings", () => {
    fc.assert(
      fc.property(calcInputArb, (input) => {
        const baseline = calculate(input);
        const doubled = calculate({ ...input, stringsParallel: input.stringsParallel * 2 });
        expect(doubled.iCheck).toBeCloseTo(baseline.iCheck * 2, 8);
        expect(doubled.iCold).toBeCloseTo(baseline.iCold * 2, 8);
        expect(doubled.iHot).toBeCloseTo(baseline.iHot * 2, 8);
        expect(stringCurrentAtTemp(input.module, input.stringsParallel, input.tempMin)).toBe(
          baseline.iCold,
        );
        expect(stringCurrentAtTemp(input.module, input.stringsParallel, input.tempMax)).toBe(
          baseline.iHot,
        );
      }),
      SETTINGS,
    );
  });

  it("uses an Imp worst case no smaller than either endpoint for inverters", () => {
    fc.assert(
      fc.property(inverterInputArb, (input) => {
        const result = calculate(input);
        expect(result.iCheckIsIsc).toBe(false);
        expect(result.iCheck).toBeGreaterThanOrEqual(result.iCold);
        expect(result.iCheck).toBeGreaterThanOrEqual(result.iHot);
        expect(result.iCheck).toBe(Math.max(result.iCold, result.iHot));
      }),
      SETTINGS,
    );
  });

  it("uses an Isc worst case no smaller than the Imp worst case for chargers", () => {
    fc.assert(
      fc.property(chargerInputArb, (input) => {
        const result = calculate(input);
        expect(result.iCheckIsIsc).toBe(true);
        expect(result.iCheck).toBeGreaterThanOrEqual(Math.max(result.iCold, result.iHot));
      }),
      SETTINGS,
    );
  });

  it("never turns a valid cable into a voltage gain", () => {
    fc.assert(
      fc.property(calcInputArb, (input) => {
        const result = calculate(input);
        expect(result.cableDrop).toBeGreaterThanOrEqual(0);
        expect(result.vmpHotCorrected).toBeLessThanOrEqual(result.vmpHotRaw);
        expect(result.vmpHotCorrected).toBe(result.vmpHotRaw - result.cableDrop);
      }),
      SETTINGS,
    );
  });

  it("increases cable loss when cable length increases", () => {
    fc.assert(
      fc.property(calcInputArb, finiteDouble({ min: 0.1, max: 100 }), (input, extraLength) => {
        const baseline = calculate(input);
        const longer = calculate({ ...input, cableLength: input.cableLength + extraLength });
        expect(longer.cableDrop).toBeGreaterThan(baseline.cableDrop);
        expect(longer.vmpHotCorrected).toBeLessThan(baseline.vmpHotCorrected);
      }),
      SETTINGS,
    );
  });

  it("increases cable loss when cross-section decreases", () => {
    fc.assert(
      fc.property(calcInputArb, finiteDouble({ min: 0.1, max: 0.95 }), (input, ratio) => {
        const baseline = calculate(input);
        const thinner = calculate({ ...input, crossSection: input.crossSection * ratio });
        expect(thinner.cableDrop).toBeGreaterThan(baseline.cableDrop);
        expect(thinner.vmpHotCorrected).toBeLessThan(baseline.vmpHotCorrected);
      }),
      SETTINGS,
    );
  });

  it("accepts exactly when all hard checks pass and prioritizes hard failures", () => {
    fc.assert(
      fc.property(calcInputArb, (input) => {
        const result = calculate(input);
        const hardChecksPass =
          result.checks.vocMax === "ok" &&
          result.checks.currentMax === "ok" &&
          result.checks.vmpMin === "ok";
        expect(result.accepted).toBe(hardChecksPass);
        expect(result.overallStatus).toBe(
          !hardChecksPass
            ? "fehler"
            : result.checks.powerRatio === "warnung"
              ? "warnung"
              : "ok",
        );
      }),
      SETTINGS,
    );
  });

  it("keeps Voc and current on their exact limits and rejects Vmp on its exact limit", () => {
    fc.assert(
      fc.property(calcInputArb, (input) => {
        const baseline = calculate(input);
        const atVocLimit = calculate({
          ...input,
          tracker: { ...input.tracker, v_max_absolute: baseline.vocCold },
        });
        expect(atVocLimit.checks.vocMax).toBe("ok");

        const atCurrentLimit = calculate({
          ...input,
          tracker: {
            ...input.tracker,
            i_max: baseline.iCheck,
            max_strings_parallel: input.stringsParallel,
          },
        });
        expect(atCurrentLimit.checks.currentMax).toBe("ok");

        const inverterInput: CalcInput = {
          ...input,
          deviceType: "string_inverter",
          batteryFloatVoltage: undefined,
        };
        const inverterBaseline = calculate(inverterInput);
        const atVmpLimit = calculate({
          ...inverterInput,
          tracker: {
            ...inverterInput.tracker,
            v_mppt_min: inverterBaseline.vmpHotCorrected,
          },
        });
        expect(atVmpLimit.checks.vmpMin).toBe("fehler");
        expect(atVmpLimit.accepted).toBe(false);
        expect(atVmpLimit.overallStatus).toBe("fehler");
      }),
      SETTINGS,
    );
  });

  it("returns no NaN or Infinity for physically valid inputs", () => {
    fc.assert(
      fc.property(calcInputArb, (input) => {
        const result = calculate(input);
        const values = [
          result.vocCold,
          result.iCold,
          result.vmpHotRaw,
          result.vmpHotCorrected,
          result.cableDrop,
          result.iHot,
          result.iCheck,
          result.powerTotal,
        ];
        if (result.powerRatio !== null) values.push(result.powerRatio);
        for (const value of values) expect(Number.isFinite(value)).toBe(true);
      }),
      SETTINGS,
    );
  });

  it("keeps helper functions at STC and follows temperature-coefficient signs", () => {
    fc.assert(
      fc.property(
        moduleArb,
        fc.integer({ min: 1, max: 40 }),
        fc.integer({ min: 1, max: 12 }),
        (module, modulesInSeries, stringsParallel) => {
          expect(stringVocAtTemp(module, modulesInSeries, 25)).toBeCloseTo(
            module.voc * modulesInSeries,
            10,
          );
          expect(stringVmpAtTemp(module, modulesInSeries, 25)).toBeCloseTo(
            module.vmp * modulesInSeries,
            10,
          );
          expect(stringCurrentAtTemp(module, stringsParallel, 25)).toBeCloseTo(
            module.imp * stringsParallel,
            10,
          );
          expect(stringVocAtTemp(module, modulesInSeries, -10)).toBeGreaterThan(
            stringVocAtTemp(module, modulesInSeries, 70),
          );
          expect(stringVmpAtTemp(module, modulesInSeries, -10)).toBeGreaterThan(
            stringVmpAtTemp(module, modulesInSeries, 70),
          );
          expect(stringCurrentAtTemp(module, stringsParallel, -10)).toBeLessThan(
            stringCurrentAtTemp(module, stringsParallel, 70),
          );
        },
      ),
      SETTINGS,
    );
  });
});
