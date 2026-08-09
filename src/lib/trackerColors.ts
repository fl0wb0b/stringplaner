// One color per tracker, shared between the tracker cards and the
// power-distribution bar in the total summary so both visibly match.
// (Yellow #facc15 is reserved for the monthly-yield chart.)
//
// Die vier Hex-Werte sind die Dark-Mode-Slots 1–4 der dataviz-Referenzpalette
// und wurden mit deren Validator gegen unser Surface #0f172a geprüft:
// Lightness-Band, Chroma, CVD-Separation (schlechtestes Paar ΔE 8,4 protan),
// Normalsicht-Floor und ≥3:1 Kontrast — alle PASS. Reihenfolge ist Teil des
// CVD-Schutzes, nicht kosmetisch: nicht umsortieren ohne erneute Validierung.
export const TRACKER_HEX = ["#3987e5", "#d95926", "#199e70", "#c98500"];

export const TRACKER_DOT = [
  "bg-[#3987e5]",
  "bg-[#d95926]",
  "bg-[#199e70]",
  "bg-[#c98500]",
];
export const TRACKER_BORDER = [
  "border-[#3987e5]/50",
  "border-[#d95926]/50",
  "border-[#199e70]/50",
  "border-[#c98500]/50",
];
