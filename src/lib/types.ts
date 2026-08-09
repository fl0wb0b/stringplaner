// Core data model — see CLAUDE.md section 4. Keep in sync with the JSON files in /data.

export interface PVModule {
  manufacturer: string;
  model_name: string;
  power_stc: number; // Wp
  voc: number; // V at STC (25°C, 1000 W/m²)
  vmp: number; // V at STC
  isc: number; // A at STC
  imp: number; // A at STC
  temp_coeff_voc: number; // %/°C, usually negative
  temp_coeff_pmax: number; // %/°C, usually negative
  temp_coeff_isc: number; // A/°C, absolute (CEC alpha_sc) — needed for the cold-current check
  source: "CEC" | "manual";
  source_url?: string; // required for manual entries — provenance of the extracted values
}

export type DeviceType = "mppt_charger" | "string_inverter" | "hybrid";

export interface MpptTracker {
  tracker_label: string; // e.g. "MPPT1", "PV-Eingang A"
  v_mppt_min: number; // V
  v_mppt_max: number; // V
  v_max_absolute: number; // V, hard upper limit (device protection)
  i_max: number; // A, max input current
  max_strings_parallel: number; // default 1 for plain MPPT chargers
  p_max_w?: number; // optional additional PV power cap
}

export interface Inverter {
  manufacturer: string;
  model_name: string;
  device_type: DeviceType;
  ac_power_nominal_w?: number; // string_inverter / hybrid only
  source_url: string; // required — provenance of the extracted values
  trackers: MpptTracker[];
  // "independent": trackers are separate MPPT inputs, all usable at once (default).
  // "variants": tracker entries are alternative configurations of ONE input
  // (e.g. Victron battery-voltage variants) — exactly one can be selected.
  tracker_mode?: "independent" | "variants";
}
