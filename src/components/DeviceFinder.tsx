import { useMemo, useState } from "react";
import { calculate, type CalcResult, type CheckStatus } from "../lib/calc";
import { inverterSlug } from "../lib/data";
import type { Inverter, PVModule } from "../lib/types";

interface Props {
  inverters: Inverter[];
  module: PVModule;
  modulesInSeries: number;
  stringsParallel: number;
  tempMin: number;
  tempMax: number;
  cableLength: number;
  crossSection: number;
  onPick: (deviceSlug: string, trackerIndex: number) => void;
}

const STATUS_ORDER: Record<CheckStatus, number> = { ok: 0, warnung: 1, fehler: 2 };

const BADGE: Record<CheckStatus, { text: string; cls: string }> = {
  ok: { text: "passt", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40" },
  warnung: { text: "Warnung", cls: "bg-amber-500/15 text-amber-400 border-amber-500/40" },
  fehler: { text: "passt nicht", cls: "bg-red-500/15 text-red-400 border-red-500/40" },
};

const fmt = (v: number, d = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: d });

function failReason(r: CalcResult, t: Inverter["trackers"][number]): string | null {
  if (r.checks.vocMax === "fehler")
    return `Voc ${fmt(r.vocCold)} V > ${fmt(t.v_max_absolute)} V`;
  if (r.checks.currentMax === "fehler")
    return r.iCold > t.i_max
      ? `Strom ${fmt(r.iCold, 1)} A > ${fmt(t.i_max, 1)} A`
      : `max. ${t.max_strings_parallel} Strings parallel`;
  if (r.checks.vmpMin === "fehler")
    return `Vmp ${fmt(r.vmpHotCorrected)} V < ${fmt(t.v_mppt_min)} V MPPT-Minimum`;
  if (r.checks.powerRatio === "warnung")
    return `Überdimensionierung ${fmt(r.powerRatio! * 100)} %`;
  return null;
}

// Victron-calculator-style inverse flow: given the string layout, rate every
// device/tracker in the database and list them by suitability.
export function DeviceFinder({
  inverters,
  module: mod,
  modulesInSeries,
  stringsParallel,
  tempMin,
  tempMax,
  cableLength,
  crossSection,
  onPick,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<"alle" | "ok">("ok");

  const rows = useMemo(() => {
    const out: Array<{
      slug: string;
      device: Inverter;
      trackerIndex: number;
      trackerLabel: string | null;
      result: CalcResult;
      reason: string | null;
    }> = [];
    for (const device of inverters) {
      const isVariants = device.tracker_mode === "variants";
      device.trackers.forEach((tracker, i) => {
        const result = calculate({
          module: mod,
          modulesInSeries,
          stringsParallel,
          tracker,
          tempMin,
          tempMax,
          cableLength,
          crossSection,
        });
        out.push({
          slug: inverterSlug(device),
          device,
          trackerIndex: i,
          trackerLabel:
            isVariants || device.trackers.length > 1 ? tracker.tracker_label : null,
          result,
          reason: failReason(result, tracker),
        });
      });
    }
    out.sort(
      (a, b) =>
        STATUS_ORDER[a.result.overallStatus] - STATUS_ORDER[b.result.overallStatus] ||
        a.device.manufacturer.localeCompare(b.device.manufacturer, "de") ||
        a.device.model_name.localeCompare(b.device.model_name, "de", { numeric: true }),
    );
    return out;
  }, [inverters, mod, modulesInSeries, stringsParallel, tempMin, tempMax, cableLength, crossSection]);

  const visible = statusFilter === "ok" ? rows.filter((r) => r.result.overallStatus !== "fehler") : rows;
  const okCount = rows.filter((r) => r.result.overallStatus === "ok").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {okCount} von {rows.length} Eingängen geeignet
        </span>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={statusFilter === "ok"}
            onChange={(e) => setStatusFilter(e.target.checked ? "ok" : "alle")}
            className="h-4 w-4 rounded accent-sky-500"
          />
          nur geeignete zeigen
        </label>
      </div>
      <ul className="divide-y divide-slate-800/60 overflow-hidden rounded-xl border border-slate-800">
        {visible.map((r) => (
          <li key={`${r.slug}#${r.trackerIndex}`}>
            <button
              type="button"
              onClick={() => onPick(r.slug, r.trackerIndex)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-800/40"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-slate-100">
                  {r.device.manufacturer} {r.device.model_name}
                  {r.trackerLabel && (
                    <span className="text-slate-400"> · {r.trackerLabel}</span>
                  )}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {r.reason ??
                    `Voc ${fmt(r.result.vocCold)} V · ${fmt(r.result.iCold, 1)} A · Vmp ${fmt(r.result.vmpHotCorrected)} V`}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${BADGE[r.result.overallStatus].cls}`}
              >
                {BADGE[r.result.overallStatus].text}
              </span>
            </button>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-3 py-3 text-sm text-slate-500">
            Kein Gerät geeignet – Verschaltung anpassen.
          </li>
        )}
      </ul>
    </div>
  );
}
