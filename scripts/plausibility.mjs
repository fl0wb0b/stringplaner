// Plausibility rules for imported module data. Returns a reason string for
// rows that would produce absurd results (e.g. alpha_sc off by a unit factor
// → ~300 A at 70 °C, every module falsely rejected), otherwise null.
// A small negative alpha_sc (sign error) is accepted: calc.ts checks the max over
// both temperatures. Its magnitude is limited like a positive one.
const MAX_ALPHA_SC_PCT = 0.2; // %/°C — real modules: ~0.03–0.1

export function implausibleReason({ voc, vmp, isc, imp, temp_coeff_isc }) {
  if (vmp >= voc) return `Vmp ${vmp} >= Voc ${voc}`;
  if (imp > isc) return `Imp ${imp} > Isc ${isc}`;
  const alphaPct = (temp_coeff_isc / isc) * 100;
  if (Math.abs(alphaPct) > MAX_ALPHA_SC_PCT) return `alpha_sc ${alphaPct.toFixed(2)} %/°C > ${MAX_ALPHA_SC_PCT}`;
  return null;
}
