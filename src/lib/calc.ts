// String sizing calculation core — pure functions only, no UI logic.
// Spec: CLAUDE.md section 6 (verified against Victron's VE-MPPT-Calc logic).

import type { MpptTracker, PVModule } from "./types";

export const COPPER_RESISTIVITY = 0.0178; // Ω·mm²/m, fixed constant per spec

export type CheckStatus = "ok" | "warnung" | "fehler";

export interface CalcInput {
  module: PVModule;
  modulesInSeries: number;
  stringsParallel: number;
  tracker: MpptTracker;
  tempMin: number; // °C, coldest expected ambient (DE default ≈ -10)
  tempMax: number; // °C, hottest expected cell temperature (DE default ≈ 70)
  cableLength: number; // m, one-way run (doubled internally for both conductors)
  crossSection: number; // mm²
  // MPPT-Laderegler (Victron etc.): Batterie-Float-/Erhaltungsspannung. Der
  // Laderegler kann nur regeln, solange die PV-Spannung darüber liegt —
  // zusätzlich zur Geräte-MPPT-Untergrenze relevant, unabhängig davon.
  // Bei Wechselrichtern nicht gesetzt.
  batteryFloatVoltage?: number;
}

export interface CalcResult {
  vocCold: number; // V, string Voc at tempMin
  iCold: number; // A, array current at tempMin
  vmpHotRaw: number; // V, string Vmp at tempMax before cable drop
  vmpHotCorrected: number; // V, after cable voltage drop
  cableDrop: number; // V
  iHot: number; // A, array current at tempMax
  powerTotal: number; // Wp installed
  powerRatio: number | null; // null when tracker has no p_max_w
  checks: {
    vocMax: CheckStatus;
    currentMax: CheckStatus;
    vmpMin: CheckStatus;
    powerRatio: CheckStatus;
  };
  accepted: boolean; // all three hard checks pass (Victron G29 logic)
  overallStatus: CheckStatus; // hard failures always dominate warnings
}

export function calculate(input: CalcInput): CalcResult {
  const { module: m, modulesInSeries, stringsParallel, tracker, tempMin, tempMax } = input;

  const vocCold =
    m.voc * (1 + (m.temp_coeff_voc / 100) * (tempMin - 25)) * modulesInSeries;

  const iCold = (m.imp + m.temp_coeff_isc * -(25 - tempMin)) * stringsParallel;

  const vmpHotRaw =
    m.vmp * (1 + (m.temp_coeff_voc / 100) * (tempMax - 25)) * modulesInSeries;
  const cableDropFactor =
    (2 * input.cableLength * COPPER_RESISTIVITY) / input.crossSection;
  const iHot = (m.imp + m.temp_coeff_isc * -(25 - tempMax)) * stringsParallel;
  const cableDrop = cableDropFactor * iHot;
  const vmpHotCorrected = vmpHotRaw - cableDrop;

  const powerTotal = m.power_stc * modulesInSeries * stringsParallel;
  const powerRatio =
    tracker.p_max_w != null && tracker.p_max_w > 0 ? powerTotal / tracker.p_max_w : null;

  // Bei MPPT-Ladereglern muss die PV-Spannung zusätzlich zur Geräte-Untergrenze
  // auch über der Batterie-Float-Spannung liegen, sonst kann der Regler den
  // Ladevorgang nicht mehr führen — die höhere der beiden Grenzen entscheidet.
  const vmpMinEffective = Math.max(tracker.v_mppt_min, input.batteryFloatVoltage ?? 0);

  const checks = {
    vocMax: (vocCold <= tracker.v_max_absolute ? "ok" : "fehler") as CheckStatus,
    currentMax: (iCold <= tracker.i_max && stringsParallel <= tracker.max_strings_parallel
      ? "ok"
      : "fehler") as CheckStatus,
    vmpMin: (vmpHotCorrected > vmpMinEffective ? "ok" : "fehler") as CheckStatus,
    powerRatio: (powerRatio != null && powerRatio > 1.3 ? "warnung" : "ok") as CheckStatus,
  };

  const accepted =
    checks.vocMax === "ok" && checks.currentMax === "ok" && checks.vmpMin === "ok";

  const overallStatus: CheckStatus = !accepted
    ? "fehler"
    : checks.powerRatio === "warnung"
      ? "warnung"
      : "ok";

  return {
    vocCold,
    iCold,
    vmpHotRaw,
    vmpHotCorrected,
    cableDrop,
    iHot,
    powerTotal,
    powerRatio,
    checks,
    accepted,
    overallStatus,
  };
}

// String voltages as a function of temperature — used by the V/T chart (TASKS.md 4b).
export function stringVocAtTemp(m: PVModule, modulesInSeries: number, temp: number): number {
  return m.voc * (1 + (m.temp_coeff_voc / 100) * (temp - 25)) * modulesInSeries;
}

export function stringVmpAtTemp(m: PVModule, modulesInSeries: number, temp: number): number {
  return m.vmp * (1 + (m.temp_coeff_voc / 100) * (temp - 25)) * modulesInSeries;
}

// Array current as a function of temperature — same formula as iCold/iHot in
// calculate(), used by the Current/Temperatur chart.
export function stringCurrentAtTemp(m: PVModule, stringsParallel: number, temp: number): number {
  return (m.imp + m.temp_coeff_isc * -(25 - temp)) * stringsParallel;
}
