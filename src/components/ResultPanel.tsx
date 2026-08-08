import type { CalcResult, CheckStatus } from "../lib/calc";
import type { MpptTracker } from "../lib/types";

interface Props {
  result: CalcResult;
  tracker: MpptTracker;
}

const STATUS_STYLE: Record<CheckStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  warnung: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  fehler: "bg-red-500/15 text-red-400 border-red-500/40",
};

const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: "OK",
  warnung: "Warnung",
  fehler: "Fehler",
};

function StatusBadge({ status }: { status: CheckStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}
    >
      {STATUS_TEXT[status]}
    </span>
  );
}

const fmt = (v: number, digits = 1) =>
  v.toLocaleString("de-DE", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function ResultPanel({ result: r, tracker }: Props) {
  const rows: Array<{
    label: string;
    value: string;
    limit: string;
    status: CheckStatus;
  }> = [
    {
      label: "Max. Spannung bei Kälte (Voc)",
      value: `${fmt(r.vocCold)} V`,
      limit: `≤ ${fmt(tracker.v_max_absolute)} V`,
      status: r.checks.vocMax,
    },
    {
      label: "Strom bei Kälte",
      value: `${fmt(r.iCold)} A`,
      limit: `≤ ${fmt(tracker.i_max)} A, max. ${tracker.max_strings_parallel} Strings`,
      status: r.checks.currentMax,
    },
    {
      label: "MPP-Spannung bei Hitze (inkl. Kabelverlust)",
      value: `${fmt(r.vmpHotCorrected)} V (−${fmt(r.cableDrop, 2)} V Kabel)`,
      limit: `> ${fmt(tracker.v_mppt_min)} V`,
      status: r.checks.vmpMin,
    },
    {
      label: "PV-Leistung / Tracker-Limit",
      value:
        r.powerRatio != null
          ? `${fmt(r.powerTotal, 0)} Wp (${fmt(r.powerRatio * 100, 0)} %)`
          : `${fmt(r.powerTotal, 0)} Wp`,
      limit: r.powerRatio != null ? "≤ 130 % empfohlen" : "kein Limit hinterlegt",
      status: r.checks.powerRatio,
    },
  ];

  const banner =
    r.overallStatus === "fehler"
      ? { text: "NICHT zulässig – Konfiguration anpassen", cls: STATUS_STYLE.fehler }
      : r.overallStatus === "warnung"
        ? { text: "Zulässig, mit Warnung (Überdimensionierung > 30 %)", cls: STATUS_STYLE.warnung }
        : { text: "Konfiguration zulässig", cls: STATUS_STYLE.ok };

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${banner.cls}`}>
        {banner.text}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800/60 text-left text-slate-400">
              <th className="px-3 py-2 font-medium">Prüfung</th>
              <th className="px-3 py-2 font-medium">Wert</th>
              <th className="px-3 py-2 font-medium">Grenze</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-slate-800 last:border-0">
                <td className="px-3 py-2 text-slate-200">{row.label}</td>
                <td className="px-3 py-2 tabular-nums text-slate-100">{row.value}</td>
                <td className="px-3 py-2 tabular-nums text-slate-400">{row.limit}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
