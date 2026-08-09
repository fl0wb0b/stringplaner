import type { CalcResult, CheckStatus } from "../lib/calc";
import type { Inverter } from "../lib/types";

interface Props {
  device: Inverter;
  results: Array<{ label: string; result: CalcResult }>;
}

const STATUS_STYLE: Record<CheckStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  warnung: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  fehler: "bg-red-500/15 text-red-400 border-red-500/40",
};

const fmt = (v: number, digits = 0) =>
  v.toLocaleString("de-DE", { maximumFractionDigits: digits });

// Aggregate over all enabled independent trackers: total installed DC power,
// DC/AC ratio, worst-of overall status.
export function TotalSummary({ device, results }: Props) {
  if (!results.length) return null;

  const totalWp = results.reduce((a, r) => a + r.result.powerTotal, 0);
  const acW = device.ac_power_nominal_w;
  const dcAcRatio = acW ? totalWp / acW : null;
  // Oversizing check on device level — catches trackers without their own p_max_w
  const oversized = dcAcRatio != null && dcAcRatio > 1.3;

  const worst: CheckStatus = results.some((r) => r.result.overallStatus === "fehler")
    ? "fehler"
    : oversized || results.some((r) => r.result.overallStatus === "warnung")
      ? "warnung"
      : "ok";

  const text =
    worst === "fehler"
      ? "Gesamtstatus: NICHT zulässig – mindestens ein Tracker verletzt eine Grenze"
      : oversized
        ? `Gesamtstatus: zulässig, mit Warnung – Überdimensionierung ${Math.round(
            dcAcRatio! * 100,
          )} % der AC-Nennleistung (> 130 % empfohlen)`
        : worst === "warnung"
          ? "Gesamtstatus: zulässig, mit Warnung"
          : "Gesamtstatus: alle Tracker zulässig";

  return (
    <div className={`rounded-2xl border px-4 py-3.5 shadow-lg shadow-black/20 ${STATUS_STYLE[worst]}`}>
      <div className="font-semibold">{text}</div>
      <div className="mt-1 text-sm">
        Gesamt-PV-Leistung: <span className="font-semibold tabular-nums">{fmt(totalWp)} Wp</span>
        {" über "}
        {results.length} Tracker
        {dcAcRatio != null && (
          <>
            {" · DC/AC-Verhältnis "}
            <span className="tabular-nums">
              {dcAcRatio.toLocaleString("de-DE", { maximumFractionDigits: 2 })}
            </span>{" "}
            ({fmt(acW!)} W AC)
          </>
        )}
      </div>
      <div className="mt-1 text-xs opacity-80">
        {results.map((r) => `${r.label}: ${fmt(r.result.powerTotal)} Wp`).join(" · ")}
      </div>
    </div>
  );
}
